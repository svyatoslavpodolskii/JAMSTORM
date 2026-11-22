'use strict';
const { randomUUID } = require('node:crypto');
const videoId = /^[a-zA-Z0-9_-]{11}$/;
// The Jam queue is owned here. YouTube Music's radio/recommendations are not
// silently advertised as a fully imported editable queue.
class JamPlayer {
  constructor(browser) { this.browser = browser; this.mode = 'tv'; this.reset(); this.tail = Promise.resolve(); }
  reset() { this.items = []; this.current = null; this.serial = 0; this.revision = 0; this.generation = randomUUID(); this.playbackGeneration = randomUUID(); this.sequence = 0; this.observed = null; this.lastMedia = null; this.nativeState = null; }
  beginNavigation(){this.reset();this.navigating=true;}
  finishNavigation(){this.navigating=false;}
  emptySnapshot(){return {ok:true,native:false,items:[],nowPlaying:null,autoplay:[],revision:this.generation+':0',clock:{generation:this.playbackGeneration,sequence:++this.sequence,sampledAt:Math.round(performance.now()),age:0,videoId:'',playbackControl:false,playing:false,position:0,duration:0}};}
  async sample() {
    if (this.browser.isDestroyed() || !['https://music.youtube.com', 'https://www.youtube.com'].includes(new URL(this.browser.getURL() || 'about:blank').origin)) return null;
    try {
      return await this.browser.executeJavaScript(`(() => {
        const media = document.querySelector('video');
        const player = document.querySelector('.html5-video-player,#movie_player');
        const data = player?.getVideoData?.() || {};
        const advertisement = !!player?.classList.contains('ad-showing');
        const urlId = new URL(location.href).searchParams.get('v') || new URLSearchParams(location.hash.split('?')[1] || '').get('v');
        const id = advertisement ? urlId : data.video_id || data.videoId || urlId;
        const metadata = navigator.mediaSession?.metadata;
        return { videoId: id, advertisement, ready:media?.readyState||0, hasMedia:!!media, hasVideo:!!media&&media.videoWidth>0&&media.videoHeight>0, title: advertisement ? '' : document.querySelector('ytmusic-player-bar .title')?.textContent?.trim() || metadata?.title || data.title || id,
          artwork:advertisement?'':metadata?.artwork?.at(-1)?.src||'',artist: advertisement ? '' : metadata?.artist || data.author || '', playing: !!media && !media.paused,
          position: advertisement ? 0 : Math.round((media?.currentTime || 0) * 1000), duration: advertisement ? 0 : Math.round((Number.isFinite(media?.duration) ? media.duration : 0) * 1000) };
      })()`);
    } catch { return null; }
  }
  async snapshot() {
    if(this.navigating)return this.emptySnapshot();const generation=this.generation;
    if(this.native){let value=await this.native.read();if(generation!==this.generation||this.navigating)return this.emptySnapshot();if(this.policy?.settings.blockExplicit&&value.available&&value.items.some(i=>i.explicit)){const selected=value.items.findIndex(i=>i.current);if(value.items[selected]?.explicit){const next=value.items.findIndex((i,n)=>n>selected&&!i.explicit);if(next>=0)await this.native.command('PLAY',{index:next});else await this.browser.executeJavaScript(`document.querySelector('video')?.pause()`);value=await this.native.read();}for(let i=value.items.length-1;i>=0;i--)if(value.items[i].explicit&&!value.items[i].current)await this.native.command('REMOVE',{index:i});value=await this.native.read();value.items=value.items.filter(i=>!i.explicit);}if(generation!==this.generation||this.navigating)return this.emptySnapshot();this.nativeState=value; if(value.available)this.reconcile(value.items);else{this.items=[];this.current=null;}}
    if(generation!==this.generation||this.navigating)return this.emptySnapshot();const media = await this.sample();
    if(generation!==this.generation||this.navigating)return this.emptySnapshot();
    this.lastMedia=media;
    if (media && videoId.test(media.videoId || '') && !this.native) {
      const current = this.items.find(i => i.id === this.current);
      if (!current || current.videoId !== media.videoId) {
        let selected = this.items.find(i => i.videoId === media.videoId);
        if (!selected && !this.native) {
          if (this.items.length >= 500) return { ok: false, error: 'Очередь Jam достигла лимита 500 треков' };
          selected = { id: String(++this.serial), videoId: media.videoId, title: media.title || media.videoId, artist: media.artist || '' }; this.items.push(selected);
        }
        this.current = selected?.id || this.current; this.revision++; this.playbackGeneration = randomUUID();
      }
      const item = this.items.find(i => i.id === this.current);
      if (item && ((media.title && item.title !== media.title) || (media.artist && item.artist !== media.artist))) {
        item.title = media.title || item.title; item.artist = media.artist || item.artist; this.revision++;
      }
      this.observed = media;
    }
    const current = this.items.find(i => i.id === this.current);
    if(this.mode==='tv'&&this.nativeState?.source==='tv'&&current?.videoId===media?.videoId){current.title=media.title||current.title;current.artist=media.artist||current.artist;}
    const nowPlaying=this.mode==='tv'&&media?.hasMedia!==false&&videoId.test(media?.videoId||'')?{id:'playback:'+media.videoId,videoId:media.videoId,title:media.title||media.videoId,artist:media.artist||'',cover:media.artwork||'',current:true}:null;
    return { ok: true, native: this.nativeState?.available ?? false, source:this.nativeState?.source||'', nowPlaying, revision: `${this.generation}:${this.revision}`, items: this.items.map(i => ({ ...i, cover:i.id===this.current&&media?.artwork&&(media.artwork.includes('.googleusercontent.com')||!i.cover)?media.artwork:i.cover, current: i.id === this.current })), autoplay: [],
      clock: { generation: this.playbackGeneration, sequence: ++this.sequence, sampledAt: Math.round(performance.now()), age: 0,
        videoId: current?.videoId || nowPlaying?.videoId || '', playbackControl: !!media, playing: !!media?.playing, position: media?.position || 0, duration: media?.duration || 0 } };
  }
  call(command) {
    const result = this.tail.catch(() => {}).then(() => this.execute(command)); this.tail = result; return result;
  }
  reconcile(rows) {
    const previousCurrent=this.current,remaining=[...this.items],next=[];
    for(const row of rows){
      let index=row.key?remaining.findIndex(item=>item.nativeKey===row.key):-1;
      if(index<0)index=remaining.findIndex(item=>item.videoId===row.videoId&&(row.current?item.id===this.current:true));
      if(index<0)index=remaining.findIndex(item=>item.videoId===row.videoId);
      const previous=index>=0?remaining.splice(index,1)[0]:null;
      const item={id:previous?.id||String(++this.serial),videoId:row.videoId,title:row.title||previous?.title||row.videoId,artist:row.artist||previous?.artist||'',explicit:!!row.explicit,cover:row.cover||previous?.cover||'',nativeKey:row.key||''};
      next.push(item);if(row.current)this.current=item.id;
    }
    if(!next.some(item=>item.id===this.current))this.current=null;
    if(previousCurrent!==this.current)this.playbackGeneration=randomUUID();
    if(JSON.stringify(this.items)!==JSON.stringify(next)){this.items=next;this.revision++;}
  }
  async ready(id){
    const result=await this.browser.executeJavaScript(`new Promise(resolve=>{let tries=0;const wait=()=>{const video=document.querySelector('video'),player=document.querySelector('.html5-video-player,#movie_player'),data=player?.getVideoData?.()||{};const current=data.video_id||data.videoId||new URL(location.href).searchParams.get('v')||new URLSearchParams(location.hash.split('?')[1]||'').get('v');if(video?.readyState>=2&&(current===${JSON.stringify(id)}||player?.classList.contains('ad-showing')))return resolve(true);if(++tries>=100)return resolve(false);setTimeout(wait,100);};wait();})`);
    if(!result)throw new Error('Песня не загрузилась. Открой каталог и проверь сообщение YouTube.');
  }
  async nativeExecute(command,before) {
    const index=this.items.findIndex(item=>item.id===command.item),target=this.items.findIndex(item=>item.id===command.target);
    if(['REMOVE','MOVE'].includes(command.op)&&command.revision!==before.revision)return {ok:false,error:'Очередь изменилась. Обнови список.'};
    if(['ADD','PLAY_NEXT'].includes(command.op)&&!videoId.test(command.videoId||''))return {ok:false,error:'Некорректный трек'};
    if(['REMOVE','MOVE','PLAY'].includes(command.op)&&index<0)return {ok:false,error:'Трек больше не находится в очереди'};
    if(command.op==='MOVE'&&target<0)return {ok:false,error:'Позиция трека изменилась'};
    if(command.op==='PLAY'&&this.items[index].videoId!==command.videoId)return {ok:false,error:'Трек изменился'};
    if(command.op!=='PLAY'||!this.nativeState.items[index]?.current){
      const value=await this.native.mutate(command.op,{...command,index,targetIndex:target},this.nativeState);
      this.reconcile(value.items);this.nativeState=value;
    }
    if(command.op==='PLAY')await this.transport(command.playing!==false,command.videoId);
    if(command.op==='PLAY'&&command.playing!==false)await this.ready(command.videoId);
    return {...await this.snapshot(),confirmed:true};
  }
  async transport(playing,id){
    if(id&&!videoId.test(id))throw Error('Некорректный трек');
    await this.browser.executeJavaScript(`(async()=>{
      window.__jamstormPaused=${!playing};const target=${JSON.stringify(id||null)},deadline=Date.now()+10000;
      for(;;){const v=document.querySelector('video'),p=document.querySelector('.html5-video-player,#movie_player');
        if(!v)throw Error('Плеер ещё не готов');
        if(!${playing}){p?.pauseVideo?.();v.pause();return;}
        const data=p?.getVideoData?.()||{},current=data.video_id||data.videoId,ad=p?.classList.contains('ad-showing');
        if(target&&current&&current!==target&&!ad){if(Date.now()>=deadline)throw Error('Трек ещё переключается');await new Promise(r=>setTimeout(r,100));continue;}
        let timer;try{p?.playVideo?.();await Promise.race([v.play(),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Видео не загрузилось')),Math.max(1,deadline-Date.now())))]);return;}
        catch(error){if(error.name!=='AbortError'||Date.now()>=deadline)throw Error(error.name+': '+error.message);await new Promise(r=>setTimeout(r,150));}
        finally{clearTimeout(timer);}
      }
    })()`,true);
  }
  async select(item, playing = true) {
    try {
    const media = await this.sample();
    if (media?.videoId !== item.videoId) {
      if (this.mode === 'tv') {
        const loaded = await this.browser.executeJavaScript(`new Promise(resolve=>{let attempts=0;const wait=()=>{if(window.__jamstormWatch?.(${JSON.stringify(item.videoId)}))return resolve(true);if(++attempts>=50)return resolve(false);setTimeout(wait,100);};wait();})`, true);
        if (!loaded) throw new Error('Открой вкладку «Плеер» и заверши первый запуск YouTube TV, затем повтори.');
      } else await this.browser.loadURL(`https://music.youtube.com/watch?v=${encodeURIComponent(item.videoId)}`);
      // Web components initialize asynchronously after navigation.
      await this.browser.executeJavaScript(`new Promise(resolve => {
        let attempts = 0; const wait = () => { const v = document.querySelector('video');
          if (v || ++attempts >= 80) return resolve(!!v); setTimeout(wait, 100); }; wait();
      })`);
    }
    this.current = item.id; this.revision++; this.playbackGeneration = randomUUID();
    await this.transport(playing,item.videoId);
    } catch (error) { if (this.mode === 'tv' && this.fallback) { await this.fallback(item.videoId); return this.select(item,playing); } throw error; }
  }
  async execute(command) {
    const before = await this.snapshot();
    if (command.op === 'SNAPSHOT' || command.op === 'SYNC') return before;
    if(this.navigating)return {ok:false,error:'Player is switching; please wait'};
    if(this.mode==='tv'&&command.op==='PLAY'&&before.nowPlaying&&command.item===before.nowPlaying.id&&command.videoId===before.nowPlaying.videoId){
      if(typeof command.playing!=='boolean')return {ok:false,error:'Invalid playing flag'};
      await this.transport(command.playing,command.videoId);
      return {...await this.snapshot(),dispatched:true};
    }
    if(this.native&&['ADD','PLAY_NEXT','REMOVE','MOVE','PLAY'].includes(command.op))return this.nativeExecute(command,before);
    if(this.native&&['SKIP_NEXT','SKIP_PREVIOUS'].includes(command.op)){
      const index=this.items.findIndex(item=>item.id===this.current)+(command.op==='SKIP_NEXT'?1:-1),item=this.items[index];
      if(!item)return {ok:false,error:'Нет следующего трека'};
      return this.nativeExecute({op:'PLAY',item:item.id,videoId:item.videoId,playing:true},before);
    }
    const fail = error => ({ ok: false, error });
    if (['MOVE', 'REMOVE'].includes(command.op) && command.revision !== before.revision) return fail('Queue changed; refresh before editing');
    if (['ADD', 'PLAY_NEXT'].includes(command.op)) {
      if (!videoId.test(command.videoId || '')) return fail('Invalid YouTube video ID');
      if (this.items.length >= 500) return fail('Queue exceeds 500-item Jam limit');
      const item = { id: String(++this.serial), videoId: command.videoId, title: typeof command.title === 'string' ? command.title.slice(0,300) : command.videoId, artist: typeof command.artist === 'string' ? command.artist.slice(0,200) : '' };
      if (command.op === 'PLAY_NEXT') this.items.splice(Math.max(0, this.items.findIndex(i => i.id === this.current) + 1), 0, item);
      else this.items.push(item);
      this.revision++; return { ...(await this.snapshot()), confirmed: true };
    }
    if (command.op === 'REMOVE') {
      const i = this.items.findIndex(item => item.id === command.item);
      if (i < 0) return fail('Queue item no longer exists');
      if (command.item === this.current) return fail('Сначала переключи текущий трек');
      this.items.splice(i, 1); this.revision++;
    } else if (command.op === 'MOVE') {
      const from = this.items.findIndex(i => i.id === command.item); const target = this.items.findIndex(i => i.id === command.target);
      if (from < 0 || target < 0) return fail('Queue item no longer exists');
      const [item] = this.items.splice(from, 1); this.items.splice(target, 0, item); this.revision++;
    } else if (command.op === 'PLAY') {
      const item = this.items.find(i => i.id === command.item && i.videoId === command.videoId);
      if (!item || (command.playing !== undefined && typeof command.playing !== 'boolean')) return fail('Queue item no longer exists or invalid playing flag');
      await this.select(item, command.playing ?? true);
    } else if (command.op === 'SEEK') {
      if (command.videoId !== before.clock.videoId || !Number.isSafeInteger(command.position) || command.position < 0) return fail('Track changed or invalid position');
      const position = Math.min(command.position, before.clock.duration);
      await this.browser.executeJavaScript(`(() => { const v = document.querySelector('video'); if (v) v.currentTime = ${position / 1000}; })()`);
    } else if (['SKIP_NEXT', 'SKIP_PREVIOUS'].includes(command.op)) {
      const next = this.items[this.items.findIndex(i => i.id === this.current) + (command.op === 'SKIP_NEXT' ? 1 : -1)];
      if (!next) return fail('В очереди Jam больше нет треков');
      await this.select(next);
    } else return fail('Unsupported operation');
    return { ...(await this.snapshot()), dispatched: true };
  }
}
module.exports = { JamPlayer };
