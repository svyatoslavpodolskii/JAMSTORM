'use strict';
const { randomUUID } = require('node:crypto');
const videoId = /^[a-zA-Z0-9_-]{11}$/;
// The Jam queue is owned here. YouTube Music's radio/recommendations are not
// silently advertised as a fully imported editable queue.
class JamPlayer {
  constructor(browser) { this.browser = browser; this.mode = 'tv'; this.reset(); this.tail = Promise.resolve(); }
  reset() { this.items = []; this.current = null; this.serial = 0; this.revision = 0; this.generation = randomUUID(); this.playbackGeneration = randomUUID(); this.sequence = 0; this.observed = null; }
  async sample() {
    if (this.browser.isDestroyed() || !['https://music.youtube.com', 'https://www.youtube.com'].includes(new URL(this.browser.getURL() || 'about:blank').origin)) return null;
    try {
      return await this.browser.executeJavaScript(`(() => {
        const media = document.querySelector('video');
        const player = document.querySelector('.html5-video-player');
        const data = player?.getVideoData?.() || {};
        const advertisement = !!player?.classList.contains('ad-showing');
        const urlId = new URL(location.href).searchParams.get('v') || new URLSearchParams(location.hash.split('?')[1] || '').get('v');
        const id = advertisement ? urlId : data.video_id || data.videoId || urlId;
        const metadata = navigator.mediaSession?.metadata;
        return { videoId: id, advertisement, title: advertisement ? '' : document.querySelector('ytmusic-player-bar .title')?.textContent?.trim() || metadata?.title || data.title || id,
          artist: advertisement ? '' : metadata?.artist || data.author || '', playing: !!media && !media.paused,
          position: advertisement ? 0 : Math.round((media?.currentTime || 0) * 1000), duration: advertisement ? 0 : Math.round((Number.isFinite(media?.duration) ? media.duration : 0) * 1000) };
      })()`);
    } catch { return null; }
  }
  async snapshot() {
    const media = await this.sample();
    if (media && videoId.test(media.videoId || '')) {
      const current = this.items.find(i => i.id === this.current);
      if (!current || current.videoId !== media.videoId) {
        let selected = this.items.find(i => i.videoId === media.videoId);
        if (!selected) {
          if (this.items.length >= 500) return { ok: false, error: 'Очередь Jam достигла лимита 500 треков' };
          selected = { id: String(++this.serial), videoId: media.videoId, title: media.title || media.videoId, artist: media.artist || '' }; this.items.push(selected);
        }
        this.current = selected.id; this.revision++; this.playbackGeneration = randomUUID();
      }
      const item = this.items.find(i => i.id === this.current);
      if (item && ((media.title && item.title !== media.title) || (media.artist && item.artist !== media.artist))) {
        item.title = media.title || item.title; item.artist = media.artist || item.artist; this.revision++;
      }
      this.observed = media;
    }
    const current = this.items.find(i => i.id === this.current);
    return { ok: true, revision: `${this.generation}:${this.revision}`, items: this.items.map(i => ({ ...i, current: i.id === this.current })), autoplay: [],
      clock: { generation: this.playbackGeneration, sequence: ++this.sequence, sampledAt: Math.round(performance.now()), age: 0,
        videoId: current?.videoId || '', playbackControl: !!media, playing: !!media?.playing, position: media?.position || 0, duration: media?.duration || 0 } };
  }
  call(command) {
    const result = this.tail.catch(() => {}).then(() => this.execute(command)); this.tail = result; return result;
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
    await this.browser.executeJavaScript(`(async () => { window.__jamstormPaused=${!playing}; const v = document.querySelector('video'); if (!v) throw new Error('Плеер ещё не готов'); ${playing ? "await Promise.race([v.play(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Видео не загрузилось. Проверь сообщение в плеере.')),8000))])" : 'v.pause()'}; })()`, true);
    } catch (error) { if (this.mode === 'tv' && this.fallback) { await this.fallback(item.videoId); return this.select(item,playing); } throw error; }
  }
  async execute(command) {
    const before = await this.snapshot();
    if (command.op === 'SNAPSHOT' || command.op === 'SYNC') return before;
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
