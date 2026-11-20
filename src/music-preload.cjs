const { ipcRenderer } = require('electron');
// No privileged API is exposed to YouTube Music or Google sign-in pages.
const advertised = new WeakMap();
for (const name of ['playing','timeupdate']) document.addEventListener(name,event=>{if(event.target instanceof HTMLMediaElement) advertised.set(event.target,!!document.querySelector('.html5-video-player.ad-showing'));},true);
document.addEventListener('ended', event => {
  if (event.target instanceof HTMLMediaElement && !advertised.get(event.target) && !document.querySelector('.html5-video-player.ad-showing') && ['https://music.youtube.com', 'https://www.youtube.com'].includes(location.origin)) ipcRenderer.send('player:ended');
}, true);
