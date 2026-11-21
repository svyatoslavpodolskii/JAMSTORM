'use strict';
(() => {
  const el=id=>document.getElementById(id),stage=el('listening-stage'),dock=el('playback-dock');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let queue=null,page='music',mode='music',panels={lyrics:'hidden',queue:'hidden'},rowsKey='',trackKey='',lyricKey='',lyricRequest=0,lines=[],highlight=-1,clock={},received=0,manualUntil=0,searching=false,lyricAvailable=null,peekState=null;
  const pauseIcon='<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor"><path d="M7 5h3v14H7zm7 0h3v14h-3z"/></svg>';
  const playIcon='<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor"><path d="m8 5 12 7-12 7z"/></svg>';
  const time=ms=>{const seconds=Math.max(0,Math.floor((ms||0)/1000));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
  async function call(promise){const value=await promise;if(!value.ok)throw Error(value.error);return value.value;}
  function fail(error){if(typeof message==='function')message(error.message||String(error));}
  function current(){return queue?.items?.find(row=>row.current);}
  function image(node,item){
    const src=window.artwork.cover(item);if(node.dataset.source===src)return;node.dataset.source=src;node.src=src;
    node.onload=()=>{if(node.naturalWidth<300&&node.src.includes('maxresdefault'))node.src='https://i.ytimg.com/vi/'+item.videoId+'/hqdefault.jpg';};
    node.onerror=()=>{if(node.src.includes('maxresdefault'))node.src='https://i.ytimg.com/vi/'+item.videoId+'/hqdefault.jpg';else{node.onerror=null;node.src='cover-placeholder.svg';}};
  }
  function updatePage(){
    const surface=window.surfaceLayout(page,mode);stage.hidden=!surface.sceneVisible;dock.hidden=!surface.dockVisible;
    document.body.classList.toggle('remote-view',surface.remoteVisible);document.body.classList.toggle('catalog-view',page==='catalog'||mode==='tv'&&page==='music');
    
    for(const key of ['lyrics','queue'])el('overlay-'+key).disabled=mode==='tv'||page!=='music'||key==='lyrics'&&lyricAvailable===false;
    document.body.classList.toggle('listening-view',page==='music'&&mode!=='tv');
  }
  let transition;
  function setPanels(value,animate=true){
    const next={lyrics:window.panelModes.normalize(value.lyrics),queue:window.panelModes.normalize(value.queue)};
    if(next.lyrics===panels.lyrics&&next.queue===panels.queue&&stage.dataset.ready)return;
    const change=()=>{panels=next;stage.dataset.ready='true';for(const key of ['lyrics','queue']){
      const placement=panels[key],pane=el(key+'-pane');stage.dataset[key]=String(placement==='side');stage.dataset[key+'Mode']=placement;
      pane.inert=placement==='hidden';pane.setAttribute('aria-hidden',String(placement==='hidden'));pane.dataset.placement=placement;
      const control=el('overlay-'+key),label=key==='lyrics'?'Слова':'Очередь';
      control.title=label+' · '+({side:'сбоку → по центру',center:'по центру → скрыть',hidden:'скрыто → сбоку'})[placement];
      control.setAttribute('aria-label',control.title);control.setAttribute('aria-pressed',String(placement!=='hidden'));
    }stage.dataset.focus=panels.lyrics==='center'?'lyrics':panels.queue==='center'?'queue':'artwork';highlight=-2;requestAnimationFrame(tick);if(next.lyrics!=='hidden')loadLyrics();};
    if(animate&&!reduced&&document.startViewTransition&&!stage.hidden){transition?.skipTransition();transition=document.startViewTransition(change);transition.ready.catch(()=>{});transition.finished.catch(()=>{});}else change();
    if(next.lyrics!=='hidden')loadLyrics();
  }
  async function toggle(kind){try{setPanels(await call(window.jam.panel(kind)));}catch(error){fail(error);}}
  async function command(op,fields){if(typeof message==='function')message('');try{const q=await call(window.jam.command(op,fields));if(q?.items)render(q);}catch(error){fail(error);}}
  function lyricsState(title,description,retry=false){
    const box=document.createElement('div');box.className='stage-empty';const h=document.createElement('h3');h.textContent=title;const p=document.createElement('p');p.textContent=description;box.append(h,p);
    if(retry){const button=document.createElement('button');button.className='secondary';button.textContent='Попробовать снова';button.onclick=()=>{lyricKey='';loadLyrics();};box.append(button);}
    el('stage-lines').replaceChildren(box);
  }
  async function loadLyrics(){
    if(mode==='tv')return;
    const now=current();if(!now){if(lyricKey!=='empty'){lyricKey='empty';lines=[];lyricRequest++;lyricAvailable=false;updatePage();el('lyrics-caption').textContent='В такт музыке';el('lyrics-credit').textContent='Тексты: LRCLIB';lyricsState('Слова появятся здесь','Выбери песню. Найдём подходящий текст.');}return;}
    const key=JSON.stringify([now.videoId,now.title,now.artist,Math.round((clock.duration||0)/1000)]);if(key===lyricKey)return;
    lyricKey=key;const request=++lyricRequest;lines=[];highlight=-1;lyricAvailable=null;
    el('lyrics-caption').textContent=now.artist||now.title;el('lyrics-credit').textContent='Ищем в LRCLIB';lyricsState('Ищем слова…','Подбираем текст для этой версии песни.');
    try{
      const data=await call(window.jam.lyrics({...now,duration:clock.duration}));if(request!==lyricRequest)return;
      lines=data.lines||[];lyricAvailable=!!(lines.length||data.plain);updatePage();el('overlay-lyrics').title=lyricAvailable?'Текст: сбоку / по центру / скрыть':'Для этой песни текста нет';el('stage-lines').replaceChildren();
      if(lines.length){for(const line of lines){const button=document.createElement('button');button.className='lyric-line';button.textContent=line.text;button.title='Перемотать к строке';button.onclick=()=>{manualUntil=0;command('SEEK',{videoId:now.videoId,position:line.time});};el('stage-lines').append(button);}el('lyrics-credit').textContent='LRCLIB · строку можно нажать';tick();}
      else if(data.plain){const p=document.createElement('p');p.className='plain-lyrics';p.textContent=data.plain;el('stage-lines').append(p);el('lyrics-credit').textContent='LRCLIB · без временных меток';}
      else{lyricsState(data.instrumental?'Без слов':'Пока без текста',data.instrumental?'Инструментальная композиция.':'У LRCLIB пока нет подходящего текста.',true);el('lyrics-credit').textContent='Тексты: LRCLIB';}
    }catch(error){if(request===lyricRequest){lyricsState('Не удалось загрузить',error.message,true);el('lyrics-credit').textContent='Тексты: LRCLIB';}}
  }
  function renderRows(items){
    const key=JSON.stringify(items);if(key===rowsKey)return;rowsKey=key;el('stage-tracks').replaceChildren();
    if(!items.length){const empty=document.createElement('li');empty.className='stage-empty';empty.textContent='Начни с песни. Друзья смогут продолжить.';el('stage-tracks').append(empty);return;}
    items.forEach((item,index)=>{
      const row=document.createElement('li');row.className='stage-track'+(item.current?' is-current':'');
      const play=document.createElement('button');play.className='stage-track-play';const cover=document.createElement('img');cover.alt='';cover.loading='lazy';image(cover,item);
      const copy=document.createElement('span');copy.className='stage-track-copy';const title=document.createElement('strong');title.textContent=window.artwork.title(item);title.title=item.title;const artist=document.createElement('small');artist.textContent=item.artist||'';copy.append(title,artist);play.append(cover,copy);
      play.onclick=()=>command('PLAY',{item:item.id,videoId:item.videoId,playing:true});row.append(play);wireDrag(row,item,items);
      if(item.current){const badge=document.createElement('span');badge.className='track-live';badge.textContent='Играет';row.append(badge);}
      else{const menu=document.createElement('details');menu.className='row-menu';const summary=document.createElement('summary');summary.textContent='•••';summary.setAttribute('aria-label','Действия с '+item.title);const actions=document.createElement('div');actions.className='row-menu-items';
        if(index>0){const up=document.createElement('button');up.textContent='Поднять выше';up.onclick=()=>{menu.open=false;command('MOVE',{item:item.id,target:items[index-1].id,revision:queue.revision});};actions.append(up);}
        const remove=document.createElement('button');remove.textContent='Убрать из очереди';remove.onclick=()=>{menu.open=false;command('REMOVE',{item:item.id,revision:queue.revision});};actions.append(remove);menu.append(summary,actions);row.append(menu);}
      el('stage-tracks').append(row);
    });
  }
  function wireDrag(row,item,items){
    row.draggable=true;row.dataset.item=item.id;
    row.ondragstart=event=>{event.dataTransfer.setData('application/x-jamstorm-item',JSON.stringify({id:item.id,revision:queue.revision}));event.dataTransfer.effectAllowed='move';row.classList.add('dragging');};
    row.ondragend=()=>document.querySelectorAll('.drop-target,.dragging').forEach(el=>el.classList.remove('drop-target','dragging'));
    row.ondragover=event=>{if(event.dataTransfer.types.includes('application/x-jamstorm-item')){event.preventDefault();event.dataTransfer.dropEffect='move';row.classList.add('drop-target');}};
    row.ondragleave=()=>row.classList.remove('drop-target');
    row.ondrop=event=>{event.preventDefault();row.classList.remove('drop-target');try{const data=JSON.parse(event.dataTransfer.getData('application/x-jamstorm-item'));if(data.id!==item.id&&items.some(i=>i.id===data.id))command('MOVE',{item:data.id,target:item.id,revision:data.revision});}catch{}};
  }
  function render(q){
    if(!q)return;queue=q;clock=q.clock||{};received=performance.now();const now=current(),items=q.items||[];
    el('hero-title').textContent=window.artwork.title(now)||'С чего начнём?';el('hero-title').title=now?.title||'';el('hero-artist').textContent=now?.artist||'Найди любимую песню или открой каталог.';
    el('hero-eyebrow').textContent=now?'Сейчас играет':'Твоя музыка. Ваша очередь.';el('hero-start').hidden=!!now;
    el('dock-title').textContent=window.artwork.title(now)||'Пока тихо';el('dock-artist').textContent=now?.artist||'Выбери первую песню';
    window.playerEffects.update(now,clock,item=>image(el('stage-cover'),item));image(el('dock-cover'),now);
    if(now?.videoId!==trackKey){trackKey=now?.videoId;manualUntil=0;lyricAvailable=null;}
    el('dock-play').dataset.playing=String(!!clock.playing);el('dock-play').setAttribute('aria-label',clock.playing?'Пауза':'Воспроизвести');
    el('dock-play').disabled=!now;el('dock-seek').disabled=!now||!clock.duration;
    const index=items.findIndex(row=>row.current);el('dock-previous').disabled=index<=0;el('dock-next').disabled=index<0||index>=items.length-1;
    el('stage-count').textContent=String(items.length);el('dock-duration').textContent=time(clock.duration);renderRows(items);loadLyrics();tick();
  }
  function tick(){
    const position=Math.min(clock.duration||Infinity,(clock.position||0)+(clock.playing?Math.min(1800,performance.now()-received):0));
    window.playerEffects.tick(position,clock.duration,clock.playing);el('dock-position').textContent=time(position);if(document.activeElement!==el('dock-seek'))el('dock-seek').value=clock.duration?Math.round(position/clock.duration*1000):0;
    if(!lines.length||panels.lyrics==='hidden')return;let index=-1;for(let i=0;i<lines.length;i++){if(lines[i].time>position)break;index=i;}if(index===highlight)return;highlight=index;
    const container=el('stage-lines');[...container.children].forEach((line,i)=>{line.classList.toggle('is-active',i===index);line.classList.toggle('is-past',i<index);});
    const line=container.children[index];if(line&&performance.now()>manualUntil)container.scrollTo({top:Math.max(0,container.scrollTop+line.getBoundingClientRect().top-container.getBoundingClientRect().top-(container.clientHeight-line.offsetHeight)/2),behavior:reduced?'instant':'smooth'});
  }
  function openSearch(){if(mode==='tv'){fail(Error('Поиск доступен в режиме YouTube Music'));return;}el('search-dialog').showModal();el('stage-query').focus();}
  for(const id of ['stage-search','hero-start','stage-add'])el(id).onclick=openSearch;
  el('search-close').onclick=()=>el('search-dialog').close();el('search-dialog').onclick=event=>{if(event.target===el('search-dialog')){const box=el('search-dialog').getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)el('search-dialog').close();}};
  el('stage-search-form').onsubmit=async event=>{
    event.preventDefault();if(searching)return;searching=true;el('stage-search-submit').disabled=true;el('search-hint').textContent='Ищем музыку…';
    try{const query=el('stage-query').value.trim();if(!query)return;let id='';try{const url=new URL(query);if(['music.youtube.com','youtube.com','www.youtube.com','youtu.be'].includes(url.hostname))id=url.hostname==='youtu.be'?url.pathname.slice(1):url.searchParams.get('v');}catch{}
      const results=/^[\w-]{11}$/.test(id||'')?[{videoId:id,title:'Включить песню по ссылке'}]:await call(window.jam.search(query));el('stage-search-results').replaceChildren();el('search-hint').textContent=results.length?'Выбери песню, чтобы включить':'Ничего не нашлось. Попробуй другое название.';
      for(const item of results){const button=document.createElement('button');button.className='search-result';const cover=document.createElement('img');cover.alt='';image(cover,item);const copy=document.createElement('span');const title=document.createElement('strong');title.textContent=window.artwork.title(item);title.title=item.title;const artist=document.createElement('small');artist.textContent=item.artist||'';copy.append(title,artist);button.append(cover,copy);button.onclick=async()=>{button.disabled=true;el('search-hint').textContent='Включаем…';try{const q=await call(window.jam.playTrack(item.videoId));render(q);el('search-dialog').close();await tab('music');}catch(error){el('search-hint').textContent=error.message;}finally{button.disabled=false;}};el('stage-search-results').append(button);}
    }catch(error){el('search-hint').textContent=error.message;}finally{searching=false;el('stage-search-submit').disabled=false;}
  };
  for(const key of ['lyrics','queue'])el('close-'+key).onclick=()=>{const next={...panels,[key]:'hidden'};setPanels(next);window.jam.panel({kind:key,placement:'hidden'}).catch(fail);};
  
  el('queue-all').onclick=()=>tab('jam').catch(fail);el('dock-invite').onclick=()=>el('invite-tab').click();
  el('dock-play').onclick=()=>{const now=current();if(now)command('PLAY',{item:now.id,videoId:now.videoId,playing:!clock.playing});};
  for(const [id,op] of [['dock-previous','SKIP_PREVIOUS'],['dock-next','SKIP_NEXT']])el(id).onclick=()=>command(op,{});
  el('dock-seek').onchange=()=>command('SEEK',{videoId:current()?.videoId,position:Math.round(Number(el('dock-seek').value)/1000*clock.duration)});
  el('stage-lines').onwheel=()=>{manualUntil=performance.now()+4500;};el('stage-lines').addEventListener('touchmove',()=>{manualUntil=performance.now()+4500;},{passive:true});
  document.addEventListener('keydown',event=>{if(event.code==='Space'&&page==='music'&&mode==='music'&&!el('search-dialog').open&&!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement.tagName)){event.preventDefault();el('dock-play').click();}if((event.ctrlKey||event.metaKey)&&(event.code==='KeyK'||['k','л'].includes(event.key.toLowerCase()))){event.preventDefault();openSearch();}});
  for(const key of ['lyrics','queue']){
    const edge=el('peek-'+key),pane=el(key+'-pane');
    const show=()=>{if(page!=='music'||mode==='tv'||panels[key]!=='hidden'||key==='lyrics'&&lyricAvailable===false)return;peekState={...panels};setPanels({...panels,[key]:'side'});};
    edge.onpointerenter=event=>{if(event.pointerType==='mouse')show();};edge.onpointerleave=()=>setTimeout(()=>{if(peekState&&!pane.matches(':hover')){const previous=peekState;peekState=null;setPanels(previous);}},250);edge.onclick=()=>toggle(key);
    pane.onpointerleave=event=>{if(peekState&&event.pointerType==='mouse'){const previous=peekState;peekState=null;setPanels(previous);}};
  }
  new ResizeObserver(()=>{if(panels.lyrics!=='hidden'){highlight=-2;requestAnimationFrame(tick);}}).observe(stage);
  window.jam.onPanel(value=>{peekState=null;setPanels(value);});call(window.jam.panels()).then(value=>setPanels(value,false)).catch(fail);
  setTimeout(()=>{document.body.classList.remove('booting','intro-running');el('boot-screen').classList.add('finished');setTimeout(()=>el('boot-screen').hidden=true,500);},reduced?0:1550);
  window.listening={render,drag:wireDrag,search:openSearch,page:value=>{page=value;updatePage();},mode:value=>{mode=value;updatePage();},panels:setPanels};updatePage();setInterval(tick,100);
})();
