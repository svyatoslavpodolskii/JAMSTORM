'use strict';
const { app, BrowserWindow, WebContentsView, ipcMain, session, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { JamSession } = require('./session.cjs');
const { JamPlayer } = require('./player.cjs');
const { BrowserRoom } = require('./room.cjs');
const { Tunnel } = require('./tunnel.cjs');
const { Addons } = require('./addons.cjs');
const QRCode = require('qrcode');
const liveSmoke = process.argv.includes('--live-smoke-test');
const musicSmoke = process.argv.includes('--music-mode');
const smoke = process.argv.includes('--smoke-test') || liveSmoke;
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'jam-desktop-smoke'));
if (smoke && !liveSmoke) app.disableHardwareAcceleration();
let window, music, player, jam, room, tunnel, addons, selectedTab = 'music', mode = 'tv';
const tvUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Cobalt/27.lts.3.1040976-gold (unlike Gecko) v8/13.8.258.54-jit gles Starboard/18, JamDesktop_DESKTOP_x8664_2026/0.2.0 (JamDesktop, Windows) local.jam.desktop/0.2.0';
const home = () => mode === 'tv' ? 'https://www.youtube.com/tv' : 'https://music.youtube.com';
const isLocalPage = require('./local-page.cjs').localPageGuard(path.join(__dirname, 'ui/index.html'));
const remoteAllowed = value => { try { const u = new URL(value); return u.protocol === 'https:' && (['music.youtube.com', 'accounts.google.com', 'consent.youtube.com', 'consent.google.com'].includes(u.hostname) || u.hostname === 'www.youtube.com' && (u.pathname === '/tv' || u.pathname.startsWith('/tv/'))); } catch { return false; } };
function layout() {
  if (!window || !music) return;
  const [width, height] = window.getContentSize(); music.setBounds({ x: 0, y: 72, width, height: Math.max(0, height - 72) });
  music.setVisible(selectedTab === 'music');
  if (selectedTab === 'music') music.webContents.focus();
}
function send(channel, value) { if (window && !window.isDestroyed()) window.webContents.send(channel, value); }
function guard(event) {
  if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !isLocalPage(event.senderFrame.url)) throw new Error('Forbidden sender');
}
app.whenReady().then(async () => {
  const identityFile = path.join(app.getPath('userData'), 'identity.json'); let identity;
  try { identity = JSON.parse(fs.readFileSync(identityFile, 'utf8')).id; if (!require('./protocol.cjs').uuid.test(identity)) identity = undefined; } catch {}
  jam = new JamSession(identity);
  room = new BrowserRoom(jam);
  tunnel = new Tunnel(path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'vendor/cloudflared.exe'));
  const roomView = () => ({ ...room.view(), publicUrl: tunnel.url && room.token ? tunnel.url + '/#' + room.token : '' });
  fs.mkdirSync(path.dirname(identityFile), { recursive: true }); fs.writeFileSync(identityFile, JSON.stringify({ id: jam.identity }));
  const prefs = { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: false };
  window = new BrowserWindow({ width: 1320, height: 880, minWidth: 860, minHeight: 620, backgroundColor: '#101112', title: 'JAMSTORM', icon: path.join(__dirname, '../assets/icon.png'), autoHideMenuBar: true,
    webPreferences: { ...prefs, offscreen: smoke && !liveSmoke, preload: path.join(__dirname, 'preload.cjs') }, show: !smoke || liveSmoke });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (e, url) => { if (!isLocalPage(url)) e.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  const musicSession = session.fromPartition(smoke ? 'jam-smoke' : 'persist:youtube-music');
  musicSession.setPermissionRequestHandler((_wc, _p, cb) => cb(false)); musicSession.setPermissionCheckHandler(() => false);
  musicSession.webRequest.onHeadersReceived((details, callback) => {
    const url = new URL(details.url);
    if (url.hostname !== 'www.youtube.com' || url.pathname !== '/tv') return callback({});
    const headers = { ...details.responseHeaders };
    // Leanback's Cobalt CSP assumes an engine without Chromium Trusted Types;
    // its player feature checks otherwise fail in Chromium. Keep source policies.
    for (const key of Object.keys(headers)) if (key.toLowerCase()==='content-security-policy') headers[key]=headers[key].map(value=>value.replace(/require-trusted-types-for\s+'script';?\s*/g,''));
    callback({responseHeaders:headers});
  });
  music = new WebContentsView({ webPreferences: { ...prefs, session: musicSession, preload: path.join(__dirname, 'music-preload.cjs') } });
  await music.webContents.loadURL('about:blank');
  music.webContents.debugger.attach('1.3');
  await music.webContents.debugger.sendCommand('Page.enable');
  await music.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(__dirname, 'page-hooks.js'), 'utf8') });
  const desktopUA = music.webContents.getUserAgent();
  musicSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders }, host = new URL(details.url).hostname;
    if (mode === 'tv' && ['youtube.com','googlevideo.com','ytimg.com','google.com','googleapis.com','gstatic.com','ggpht.com'].some(domain=>host===domain||host.endsWith('.'+domain))) {
      for (const key of Object.keys(headers)) if (key.toLowerCase()==='user-agent' || key.toLowerCase().startsWith('sec-ch-ua')) delete headers[key];
      Object.assign(headers, { 'User-Agent':tvUA,'sec-ch-ua':'"JamDesktop";v="27"','sec-ch-ua-mobile':'?0','sec-ch-ua-platform':'"Starboard"' });
    }
    callback({requestHeaders:headers});
  });
  const applyMode = async value => {
    mode = value; player.mode = mode;
    musicSession.setUserAgent(mode === 'tv' ? tvUA : desktopUA);
    await music.webContents.debugger.sendCommand('Emulation.setUserAgentOverride', { userAgent: mode === 'tv' ? tvUA : desktopUA, ...(mode === 'tv' ? { userAgentMetadata: { brands:[{brand:'JamDesktop',version:'27'}], fullVersionList:[{brand:'JamDesktop',version:'27.lts.3'}], platform:'Starboard',platformVersion:'',architecture:'x86',model:'',mobile:false,bitness:'64',wow64:false } } : {}) });
    music.webContents.setUserAgent(mode === 'tv' ? tvUA : desktopUA);
  };
  window.contentView.addChildView(music);
  for (const event of ['will-navigate', 'will-redirect']) music.webContents.on(event, (e, url) => { if (!remoteAllowed(url)) e.preventDefault(); });
  music.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  music.webContents.on('did-start-loading', () => send('player:state', { phase: 'loading' }));
  music.webContents.on('did-finish-load', () => send('player:state', { phase: 'ready' }));
  music.webContents.on('did-fail-load', (_e, code, _description, _url, mainFrame) => {
    if (mainFrame && code !== -3) { selectedTab = 'jam'; layout(); send('player:state', { phase: 'error', message: 'YouTube Music не загрузился. Проверь подключение к интернету.' }); }
  });
  player = new JamPlayer(music.webContents);
  player.fallback = async videoId => {
    await applyMode('music');
    await music.webContents.loadURL('https://music.youtube.com/watch?v='+encodeURIComponent(videoId));
    send('player:state',{phase:'fallback',message:'YouTube TV не запустил видео. Включён YouTube Music; общая очередь сохранена.'});
  };
  addons = new Addons(path.join(app.getPath('userData'), 'addons.json'), music.webContents, player);
  await addons.configure();
  await applyMode(musicSmoke ? 'music' : 'tv');
  jam.on('state', state => {
    if (state.role !== 'host') { tunnel.stop(); room.stop(); }
    if (!music.webContents.isDestroyed()) music.webContents.setAudioMuted(state.role === 'guest');
    send('jam:state', state);
  });
  const handle = (name, fn) => ipcMain.handle(name, async (event, ...args) => {
    guard(event); try { return { ok: true, value: await fn(...args) }; } catch (e) { return { ok: false, error: e.message }; }
  });
  handle('jam:state', () => jam.view());
  handle('addons:state', () => addons.view());
  handle('addons:set', (key,value) => addons.set(key,value));
  handle('jam:join', async invite => {
    if (typeof invite !== 'string' || invite.length > 1024) throw new Error('Некорректное приглашение');
    require('./protocol.cjs').parseInvite(invite);
    // Guests must remain silent; audio stays with the session host.
    if (remoteAllowed(music.webContents.getURL())) await music.webContents.executeJavaScript(`document.querySelector('video')?.pause()`);
    music.webContents.setAudioMuted(true);
    try { return await jam.join(invite); }
    finally { if (jam.state.role !== 'guest') music.webContents.setAudioMuted(false); }
  });
  handle('jam:host', async () => { music.webContents.setAudioMuted(false); player.reset(); return await jam.host(command => player.call(command)); });
  handle('jam:leave', () => { tunnel.stop(); room.stop(); jam.disconnect(); music.webContents.setAudioMuted(false); return jam.view(); });
  handle('jam:command', (op, fields) => {
    if (!fields || typeof fields !== 'object' || JSON.stringify(fields).length > 4096) throw new Error('Некорректная команда');
    return jam.command(op, fields);
  });
  handle('jam:copy', () => { if (!jam.state.invite) throw new Error('Сначала создай Jam'); clipboard.writeText(jam.state.invite); });
  handle('jam:qr', () => { if (!jam.state.invite) throw new Error('Сначала создай Jam'); return QRCode.toDataURL(jam.state.invite, { errorCorrectionLevel: 'M', margin: 3, width: 256 }); });
  handle('app:tab', tab => { if (!['music', 'jam'].includes(tab)) throw new Error('Unknown tab'); selectedTab = tab; layout(); });
  handle('app:mode', async value => { if (!['tv', 'music'].includes(value)) throw new Error('Unknown player'); await applyMode(value); selectedTab = 'music'; layout(); await music.webContents.loadURL(home()); });
  handle('room:start', async () => { if (jam.state.role === 'guest') throw new Error('Для браузерной комнаты хостом должен быть этот ПК'); if (jam.state.role !== 'host') { player.reset(); await jam.host(command => player.call(command)); } return room.start(); });
  handle('room:state', roomView);
  handle('room:stop', () => { tunnel.stop(); room.stop(); return roomView(); });
  handle('room:internet', async () => { if (!room.server) throw new Error('Сначала открой браузерную комнату'); const token = room.token; await tunnel.start(room.port); if (room.token !== token) { tunnel.stop(); throw new Error('Комната закрыта'); } return roomView(); });
  handle('room:local', () => { tunnel.stop(); return roomView(); });
  handle('room:copy', () => { if (!room.url) throw new Error('Открой комнату'); clipboard.writeText(roomView().publicUrl || room.url); });
  handle('room:qr', () => { if (!room.url) throw new Error('Открой комнату'); return QRCode.toDataURL(roomView().publicUrl || room.url, { margin: 3, width: 256 }); });
  handle('app:retry', async () => { selectedTab = 'music'; layout(); await music.webContents.loadURL(home()); });
  ipcMain.on('player:ended', event => {
    if (event.sender === music.webContents && event.senderFrame === music.webContents.mainFrame && jam.state.role === 'host') jam.command('SKIP_NEXT').catch(() => {});
  });
  window.on('resize', layout); window.on('closed', () => { tunnel.stop(); room.stop(); jam.disconnect(); music.webContents.close(); window = null; });
  await window.loadFile(path.join(__dirname, 'ui/index.html')); layout();
  if (smoke) {
    selectedTab = 'jam'; layout();
    await window.webContents.executeJavaScript(`tab('jam')`);
    const result = await window.webContents.executeJavaScript(`({ title: document.title, bridge: typeof window.jam?.join, heading: document.querySelector('h1')?.textContent, inputs: document.querySelectorAll('input,textarea').length })`);
    const scroll = await window.webContents.executeJavaScript(`(() => { const main=document.querySelector('main'),bar=document.querySelector('.topbar'),details=document.querySelector('details');details.open=true;main.scrollTop=600;const result={barTop:bar.getBoundingClientRect().top,scrolled:main.scrollTop,bodyScroll:document.scrollingElement.scrollTop};main.scrollTop=0;details.open=false;return result;})()`);
    if (scroll.barTop !== 10 || scroll.bodyScroll !== 0 || scroll.scrolled <= 0) throw new Error('Fixed topbar regression');
    const ipc = await window.webContents.executeJavaScript(`window.jam.state()`);
    if (!ipc.ok || ipc.value.phase !== 'idle') throw new Error('Local IPC failed');
    console.log('SMOKE', JSON.stringify(result));
    const dir = app.isPackaged ? path.join(app.getPath('temp'), 'jam-desktop-smoke-artifacts') : path.join(__dirname, '../artifacts'); fs.mkdirSync(dir, { recursive: true });
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!liveSmoke) fs.writeFileSync(path.join(dir, 'desktop.png'), (await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
    if (liveSmoke) {
      await addons.set('adblock',true);
      await window.webContents.executeJavaScript(`document.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true)`);
      selectedTab = 'music'; layout();
      window.restore(); window.focus(); music.webContents.focus();
      const timeout = setTimeout(() => { console.error('LIVE_SMOKE_TIMEOUT'); app.exit(1); }, 90000);
      try {
        await music.webContents.loadURL(home());
        await music.webContents.executeJavaScript(`new Promise(resolve=>{let count=0;const poll=()=>{if(document.body.innerText.trim().length>30||++count>200)return resolve();setTimeout(poll,100);};poll();})`);
        const remote = await music.webContents.executeJavaScript(`({ title: document.title, url: location.href, app: !!document.querySelector('ytmusic-app, #app') || !!window._yttv, require: typeof require, bridge: typeof window.jam, visible: document.visibilityState })`);
        console.log('LIVE_SMOKE', JSON.stringify(remote));
        console.log('TV_HOOK', await music.webContents.executeJavaScript(`({watch:typeof window.__jamstormWatch,h5vcc:typeof window.h5vcc,guest:localStorage.getItem('jamstorm:guest-initialized'),instances:Object.values(window._yttv||{}).filter(v=>v?.instance?.resolveCommand).length})`));
        if (await music.webContents.executeJavaScript(`document.body.innerText.includes('Смотрите новые видео, подобранные для вас')`)) {
          music.webContents.sendInputEvent({ type:'keyDown',keyCode:'Return' }); music.webContents.sendInputEvent({ type:'keyUp',keyCode:'Return' });
          await new Promise(resolve=>setTimeout(resolve,2000));
          console.log('TV_SETUP', await music.webContents.executeJavaScript(`document.body.innerText.slice(0,800)`));
        }
        if (!remote.app || remote.require !== 'undefined' || remote.bridge !== 'undefined') { clearTimeout(timeout); return app.exit(1); }
        music.webContents.setAudioMuted(true);
        await player.select({ id: 'smoke', videoId: '5NV6Rdv1a3I' }, false);
        await new Promise(resolve => setTimeout(resolve, 3000));
        const playback = await player.sample();
        console.log('LIVE_PLAYER', JSON.stringify({ videoId: playback?.videoId, title: playback?.title, playing: playback?.playing }));
        if (playback?.videoId !== '5NV6Rdv1a3I' || playback.playing) throw new Error('TV player adapter failed or manual pause lost');
        await player.select({id:'smoke',videoId:'5NV6Rdv1a3I'},true);
        await new Promise(resolve => setTimeout(resolve, 8000));
        selectedTab = 'jam'; layout(); window.minimize();
        await new Promise(resolve => setTimeout(resolve, 2000));
        const background = await player.sample();
        console.log('LIVE_BACKGROUND', JSON.stringify({ mode, playing: background?.playing, position: background?.position }));
        if (!background?.playing) throw new Error('Background playback paused');
        await music.webContents.executeJavaScript(`document.querySelector('video').pause()`);
      } catch (e) { console.error('LIVE_SMOKE_FAILED', e.message); console.log('TV_DIAGNOSTIC', await music.webContents.executeJavaScript(`({url:location.href,text:document.body.innerText.slice(-2000),video:!!document.querySelector('video'),ready:document.querySelector('video')?.readyState,src:!!document.querySelector('video')?.currentSrc,player:document.querySelector('.html5-video-player')?.getPlayerState?.(),resources:performance.getEntriesByType('resource').map(x=>({url:x.name.split('?')[0],duration:x.duration})).slice(-8)})`)); clearTimeout(timeout); return app.exit(1); }
      clearTimeout(timeout);
    }
    app.exit(result.bridge === 'function' && !!result.heading ? 0 : 1);
  } else music.webContents.loadURL(home()).catch(() => {});
}).catch(error => { console.error('APP_START_FAILED', error.message); app.exit(1); });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { addons?.stop(); tunnel?.stop(); room?.stop(); jam?.disconnect(); });
