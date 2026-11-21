// Runs in YouTube's main world before its scripts. No privileged bridge.
(() => {
  if (!['www.youtube.com', 'music.youtube.com'].includes(location.hostname)) return;
  // Cobalt capability adaptation, based on VacuumTube (MIT, shy 2025-2026).
  // Chromium does not validate the extra MIME parameters used by the TV player.
  if (location.pathname === '/tv' && typeof MediaSource !== 'undefined') {
    const supports = MediaSource.isTypeSupported.bind(MediaSource);
    const limits = { width:7680,height:4320,framerate:120,bitrate:200000000,channels:8 };
    MediaSource.isTypeSupported = type => {
      const [mime,...parameters] = String(type).split(';').map(s=>s.trim()), kept=[mime];
      for (const parameter of parameters) {
        const [raw,...rest] = parameter.split('='), key=raw.trim().toLowerCase(), value=rest.join('=').trim().replace(/^"|"$/g,'');
        if (limits[key]) { if (!(Number(value)>0 && Number(value)<=limits[key])) return false; }
        else if (key==='eotf') { if(value!=='bt709' && !window.matchMedia('(dynamic-range: high)').matches)return false; }
        else if (key==='cryptoblockformat') { if(value!=='subsample')return false; }
        else if (key==='decode-to-texture') { if(value!=='true'&&value!=='false')return false; }
        else kept.push(parameter);
      }
      return supports(kept.join('; '));
    };
  }
  if (location.hostname === 'www.youtube.com' && location.pathname === '/tv') {
    const listeners = [];
    const id = new URLSearchParams(location.hash.split('?')[1] || '').get('v');
    window.h5vcc = { runtime: { initialDeepLink: /^[\w-]{11}$/.test(id || '') ? 'https://www.youtube.com/watch?v=' + id : '', onDeepLink: { addListener: fn => { if (typeof fn === 'function') listeners.push(fn); } } }, system: { getVideoContainerSizeOverride: () => '1920x1080' } };
    let identityReady = localStorage.getItem('jamstorm:guest-initialized') === 'yes'||/(?:^|; )SAPISID=/.test(document.cookie);
    window.__jamstormWatch = videoId => {
      if (!/^[\w-]{11}$/.test(videoId || '') || !identityReady) return false;
      const root = document.querySelector('ytlr-app');
      if (!root || root.classList.contains('zylon-hidden')) return false;
      const instance = Object.values(window._yttv || {}).find(value=>value?.instance?.resolveCommand)?.instance;
      if (instance) { instance.resolveCommand({ commandMetadata: { webCommandMetadata: { url: '/watch?v=' + videoId, webPageType: 'WEB_PAGE_TYPE_WATCH' } }, watchEndpoint: { videoId } }); return true; }
      if (!listeners.length) return false;
      for (const fn of listeners) fn('https://www.youtube.com/watch?v=' + videoId); return true;
    };
    if (!identityReady) {
      let attempts = 0; const bootstrap = setInterval(() => {
        const instance = Object.values(window._yttv || {}).find(value=>value?.instance?.resolveCommand)?.instance;
        if (!instance) { if (++attempts > 200) clearInterval(bootstrap); return; }
        clearInterval(bootstrap);
        instance.resolveCommand({ switchToGuestMode: { identityType: 'UNAUTHENTICATED_IDENTITY_TYPE_GUEST' } });
        localStorage.setItem('jamstorm:guest-initialized','yes');
        setTimeout(()=>{identityReady=true;},1500);
      },100);
    }
  }
  if(location.hostname==='music.youtube.com'){
    const explicit=row=>/MUSIC_EXPLICIT_BADGE|EXPLICIT/.test(JSON.stringify(row?.badges||[]));
    const filter=()=>{
      const enabled=document.documentElement?.dataset.jamstormExplicit==='block';
      for(const node of document.querySelectorAll('ytmusic-responsive-list-item-renderer,ytmusic-playlist-panel-video-renderer')){
        const blocked=enabled&&explicit(node.data);if(blocked){node.dataset.jamExplicitHidden='true';node.style.display='none';}else if(node.dataset.jamExplicitHidden){delete node.dataset.jamExplicitHidden;node.style.removeProperty('display');}
      }
      if(!enabled)return;
      const el=document.querySelector('#queue'),items=el?.queue?.getItems?.();if(!Array.isArray(items))return;
      const row=entry=>entry.playlistPanelVideoRenderer||entry.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
      const index=items.findIndex(i=>row(i)?.selected);if(index<0||!explicit(row(items[index])))return;
      document.querySelector('video')?.pause();const next=items.findIndex((i,n)=>n>index&&!explicit(row(i)));if(next>=0)el.dispatch?.({type:'SET_INDEX',payload:next});
    };
    document.addEventListener('play',filter,true);setInterval(filter,350);
  }
  for (const name of ['visibilitychange', 'webkitvisibilitychange']) document.addEventListener(name, e => e.stopImmediatePropagation(), true);
  // Leanback pauses its application lifecycle when an embedded view loses focus.
  // Keep that lifecycle active; explicit media pause is untouched.
  document.hasFocus = () => true;
  window.addEventListener('blur', event => event.stopImmediatePropagation(), true);
  document.addEventListener('play', event => { if (window.__jamstormPaused && event.target instanceof HTMLMediaElement) event.target.pause(); },true);
  for (const name of ['pointerdown','keydown']) document.addEventListener(name,()=>{window.__jamstormPaused=false;},true);
  for (const [name, value] of Object.entries({ hidden: false, webkitHidden: false, visibilityState: 'visible', webkitVisibilityState: 'visible' })) {
    try { Object.defineProperty(document, name, { configurable: true, get: () => value }); } catch {}
  }
  const parse = JSON.parse;
  JSON.parse = function (...args) {
    const value = Reflect.apply(parse, this, args);
    const players = [value, value?.playerResponse, value?.response?.playerResponse];
    for (const player of players) {
      if (!player || typeof player !== 'object' || !player.playabilityStatus) continue;
      if (window.__jamstormAdblock) for (const field of ['adPlacements','adSlots','playerAds']) if (Object.hasOwn(player,field)) player[field] = [];
      if (Array.isArray(player.messages)) player.messages = player.messages.filter(message=>!message?.youThereRenderer);
    }
    return value;
  };
})();
