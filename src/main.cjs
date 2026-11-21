'use strict';
const { app, BrowserWindow, WebContentsView, ipcMain, session, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { JamSession } = require('./session.cjs');
const { JamPlayer } = require('./player.cjs');
const { BrowserRoom } = require('./room.cjs');
const { Tunnel } = require('./tunnel.cjs');
const { Addons } = require('./addons.cjs');
const {NativeQueue}=require('./native-queue.cjs');
const {Lyrics}=require('./lyrics.cjs');
const lyrics=new Lyrics();
const QRCode = require('qrcode');
const liveSmoke = process.argv.includes('--live-smoke-test');
const musicSmoke = process.argv.includes('--music-mode');
const smoke = process.argv.includes('--smoke-test') || liveSmoke;
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'jam-desktop-smoke'));
if (smoke && !liveSmoke) app.disableHardwareAcceleration();
let policy;
let window, music, player, jam, room, tunnel, addons, panel={queue:'hidden',lyrics:'hidden'}, selectedTab = 'music', mode = 'music';
const nativeMaterialSupported=process.platform==='win32'&&Number(require('node:os').release().split('.')[2])>=22621;
let material=nativeMaterialSupported?'mica':'none',ambientTrack='',ambientBusy=false,lastLevelAt=0,visualsEnabled=true,lastAudioLevel=0;
const tvUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Cobalt/27.lts.3.1040976-gold (unlike Gecko) v8/13.8.258.54-jit gles Starboard/18, JamDesktop_DESKTOP_x8664_2026/0.2.0 (JamDesktop, Windows) local.jam.desktop/0.2.0';
const home = () => mode === 'tv' ? 'https://www.youtube.com/tv' : 'https://music.youtube.com';
const isLocalPage = require('./local-page.cjs').localPageGuard(path.join(__dirname, 'ui/index.html'));
const remoteAllowed = value => { try { const u = new URL(value); return u.protocol === 'https:' && (['music.youtube.com', 'accounts.google.com', 'consent.youtube.com', 'consent.google.com'].includes(u.hostname) || u.hostname === 'www.youtube.com' && (u.pathname === '/tv' || u.pathname.startsWith('/tv/'))); } catch { return false; } };
function layout() {
  if(!window||!music)return;
  const [width,height]=window.getContentSize(),full=window.isFullScreen(),tv=mode==='tv'&&selectedTab==='music',top=full?48:72,inset=0;
  music.setBounds({x:inset,y:top,width:width-inset*2,height:Math.max(0,height-top-inset)});
  music.setVisible(require('./ui/surface-layout.js')(selectedTab,mode).remoteVisible);
}
function send(channel,value){if(window&&!window.isDestroyed())window.webContents.send(channel,value);}
function guard(event) {
  if(!window||window.isDestroyed())throw new Error('Application closing');
  if(event.sender!==window.webContents||event.senderFrame!==event.sender.mainFrame||!isLocalPage(event.senderFrame.url))throw new Error('Forbidden sender');
}
app.whenReady().then(async () => {
  require('electron').nativeTheme.themeSource='dark';
  const identityFile = path.join(app.getPath('userData'), 'identity.json'); let identity;
  try { identity = JSON.parse(fs.readFileSync(identityFile, 'utf8')).id; if (!require('./protocol.cjs').uuid.test(identity)) identity = undefined; } catch {}
  jam = new JamSession(identity);
  policy=new (require('./policy.cjs').PlaybackPolicy)(path.join(app.getPath('userData'),'playback-policy.json'));
  room = new BrowserRoom(jam);room.policy=policy;
  tunnel = new Tunnel(path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'vendor/cloudflared.exe'));
  const roomView = () => ({ ...room.view(), publicUrl: tunnel.url && room.token ? tunnel.url + '/#' + room.token : '' });
  fs.mkdirSync(path.dirname(identityFile), { recursive: true }); fs.writeFileSync(identityFile, JSON.stringify({ id: jam.identity }));
  const prefs = { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: false };
  window = new BrowserWindow({ width: 1320, height: 880, minWidth: 860, minHeight: 620, backgroundColor: nativeMaterialSupported?'#00000000':'#151a24',...(nativeMaterialSupported?{backgroundMaterial:'mica'}:{}), title: 'JAMSTORM', icon: path.join(__dirname, '../assets/icon.png'), autoHideMenuBar: true,
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
  music.setBackgroundColor(nativeMaterialSupported?'#00000000':'#151a24');
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
  const fullscreen=()=>{layout();send('app:fullscreen',window.isFullScreen());};
  window.on('enter-full-screen',fullscreen);window.on('leave-full-screen',fullscreen);
  for(const wc of [window.webContents,music.webContents])wc.on('before-input-event',(e,input)=>{if(input.type==='keyDown'&&(input.control||input.meta)&&(input.code==='KeyK'||['k','л'].includes(input.key.toLowerCase()))&&mode==='music'){e.preventDefault();selectedTab='music';layout();send('app:search-open',{});window.webContents.focus();}if(input.type==='keyDown'&&!input.isAutoRepeat&&(input.key==='F11'||input.key==='Escape'&&window.isFullScreen())){e.preventDefault();window.setFullScreen(input.key==='F11'?!window.isFullScreen():false);}});
  for (const event of ['will-navigate', 'will-redirect']) music.webContents.on(event, (e, url) => { if (!remoteAllowed(url)) e.preventDefault(); });
  music.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  music.webContents.on('did-start-loading', () => send('player:state', { phase: 'loading' }));
  music.webContents.on('did-finish-load', () => {
    music.webContents.send('visual:enabled',visualsEnabled);music.webContents.send('filter:enabled',policy.settings.blockExplicit);layout();send('player:state', { phase: 'ready' });

    if(music.webContents.getURL().startsWith('https://www.youtube.com/tv'))music.webContents.insertCSS(fs.readFileSync(path.join(__dirname,'tv-theme.css'),'utf8')).catch(()=>{});
    if(music.webContents.getURL().startsWith('https://music.youtube.com/'))music.webContents.insertCSS(fs.readFileSync(path.join(__dirname,'music-theme.css'),'utf8')).catch(()=>{});
  });
  music.webContents.on('did-fail-load', (_e, code, _description, _url, mainFrame) => {
    if (mainFrame && code !== -3) { selectedTab = 'jam'; layout(); send('player:state', { phase: 'error', message: 'YouTube Music не загрузился. Проверь подключение к интернету.' }); }
  });
  player = new JamPlayer(music.webContents);player.policy=policy;
  player.native=new NativeQueue(music.webContents,()=>mode);
  addons = new Addons(path.join(app.getPath('userData'), 'addons.json'), music.webContents, player);
  await addons.configure();
  await applyMode(liveSmoke&&!musicSmoke?'tv':'music');
  jam.on('state', state => {
    if (state.role !== 'host') { tunnel.stop(); room.stop(); }
    if (!music.webContents.isDestroyed()) music.webContents.setAudioMuted(state.role === 'guest');
    send('jam:state', state);
  });
  const handle = (name, fn) => ipcMain.handle(name, async (event, ...args) => {
    try { guard(event);return { ok: true, value: await fn(...args) }; } catch (e) { return { ok: false, error: e?.message||'Плеер ещё загружается. Попробуй ещё раз.' }; }
  });
  const navigationState=()=>({back:music.webContents.navigationHistory.canGoBack(),forward:music.webContents.navigationHistory.canGoForward()});
  for(const event of ['did-navigate','did-navigate-in-page','did-stop-loading'])music.webContents.on(event,()=>send('app:navigation',navigationState()));
  handle('app:navigation',navigationState);
  handle('app:navigate',async action=>{const history=music.webContents.navigationHistory;if(action==='back'&&history.canGoBack())history.goBack();else if(action==='forward'&&history.canGoForward())history.goForward();else if(action==='home')await music.webContents.loadURL(home());else if(!['back','forward'].includes(action))throw Error('Unknown navigation action');return navigationState();});
  function controlledCommand(command,context={}){if(['SNAPSHOT','SYNC'].includes(command.op))return player.call(command);return policy.run(command,context.actor,cmd=>player.call(cmd),()=>player.call({op:'SNAPSHOT'}),id=>player.native.metadata(id));}
  handle('app:policy',value=>{if(value){policy.set(value);music.webContents.send('filter:enabled',policy.settings.blockExplicit);}return policy.settings;});
  handle('jam:state', () => jam.view());
  handle('app:queue',async()=>{const value=jam.state.role==='guest'?jam.state.queue:await player.call({op:'SNAPSHOT'});layout();return value;});
  handle('app:lyrics',track=>lyrics.get(track));
  handle('app:search',async query=>(await require('./search.cjs').searchYouTube(query)).filter(i=>!policy.settings.blockExplicit||!policy.settings.hideExplicit||!i.explicit));
  handle('app:play-track',async id=>{
    if(!/^[\w-]{11}$/.test(id||''))throw new Error('Invalid video ID');
    if(jam.state.role==='guest')throw new Error('Сейчас музыкой управляет телефон');
    if(mode!=='music')throw new Error('Для поиска переключи плеер на Music');
    await policy.verify(id,id=>player.native.metadata(id));
    let q=await player.call({op:'SNAPSHOT'}),item=q.items.find(row=>row.videoId===id);
    if(!q.native||!q.items.length){await player.select({id:'loading',videoId:id},false);await player.ready(id);for(let attempt=0;attempt<80;attempt++){q=await player.call({op:'SNAPSHOT'});item=q.items.find(row=>row.videoId===id);if(item)break;await new Promise(resolve=>setTimeout(resolve,150));}if(!item)throw new Error('Очередь ещё загружается. Попробуй включить песню ещё раз.');q=await player.call({op:'PLAY',item:item.id,videoId:id,playing:true});}
    else{if(!item){q=await player.call({op:'ADD',videoId:id});item=q.items.find(row=>row.videoId===id);}if(item)q=await player.call({op:'PLAY',item:item.id,videoId:id,playing:true});}
    if(!q.ok)throw new Error(q.error);selectedTab='music';layout();return q;
  });

  handle('app:material',value=>{
    if(!['acrylic','mica','none'].includes(value))throw new Error('Unknown material');
    material=nativeMaterialSupported?value:'none';
    if(nativeMaterialSupported)window.setBackgroundMaterial(material);
    window.setBackgroundColor(material==='none'?'#151a24':'#00000000');music.setBackgroundColor(material==='none'?'#151a24':'#00000000');

    return {supported:nativeMaterialSupported,material};
  });
  handle('app:visuals',enabled=>{if(typeof enabled!=='boolean')throw new Error('Invalid visual setting');visualsEnabled=enabled;music.webContents.send('visual:enabled',enabled);return enabled;});
  ipcMain.on('player:level',(event,value)=>{
    if(event.sender!==music.webContents||event.senderFrame!==music.webContents.mainFrame||typeof value!=='number'||!Number.isFinite(value)||value<0||value>1||performance.now()-lastLevelAt<120)return;
    lastAudioLevel=Math.max(lastAudioLevel,value);lastLevelAt=performance.now();send('app:level',value);
  });

  handle('app:panel',value=>{if(value===null)panel={queue:'hidden',lyrics:'hidden'};else if(['queue','lyrics'].includes(value))panel=require('./ui/panel-modes.js').nextPanel(panel,value);else if(value&&['queue','lyrics'].includes(value.kind)&&['hidden','side','center'].includes(value.placement)){panel={...panel,[value.kind]:value.placement};if(value.placement==='center'&&panel[value.kind==='queue'?'lyrics':'queue']==='center')panel[value.kind==='queue'?'lyrics':'queue']='hidden';}else throw new Error('Unknown panel');selectedTab='music';layout();send('app:panel',panel);return panel;});
  handle('app:panels',()=>panel);
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
  handle('jam:host', async () => { music.webContents.setAudioMuted(false); return await jam.host(controlledCommand); });
  handle('jam:leave', () => { tunnel.stop(); room.stop(); jam.disconnect(); music.webContents.setAudioMuted(false); return jam.view(); });
  handle('jam:command', async (op, fields) => {
    if (!fields || typeof fields !== 'object' || JSON.stringify(fields).length > 4096) throw new Error('Некорректная команда');
    if(!jam.state.role)await jam.host(controlledCommand);return jam.command(op, fields);
  });
  handle('jam:copy', () => { if (!jam.state.invite) throw new Error('Сначала создай Jam'); clipboard.writeText(jam.state.invite); });
  handle('jam:qr', () => { if (!jam.state.invite) throw new Error('Сначала создай Jam'); return QRCode.toDataURL(jam.state.invite, { errorCorrectionLevel: 'M', margin: 3, width: 256 }); });
  handle('app:tab', async tab => { if (!['music','catalog','jam','invite','settings'].includes(tab)) throw new Error('Unknown tab');selectedTab=tab;layout();if(tab==='catalog'||tab==='music'&&mode==='tv')music.webContents.focus();else window.webContents.focus();return {mode}; });
  handle('app:mode', async value => { if (!['tv', 'music'].includes(value)) throw new Error('Unknown player'); await applyMode(value); selectedTab = 'music'; layout(); send('app:mode',mode);await music.webContents.loadURL(home());music.webContents.navigationHistory.clear(); });
  handle('room:start', async () => { if (jam.state.role === 'guest') throw new Error('Для браузерной комнаты хостом должен быть этот ПК'); if (jam.state.role !== 'host') { await jam.host(controlledCommand); } return room.start(); });
  handle('room:state', roomView);
  handle('room:stop', () => { tunnel.stop(); room.stop(); return roomView(); });
  handle('room:internet', async () => { if (!room.server) throw new Error('Сначала открой браузерную комнату'); const token = room.token; await tunnel.start(room.port); if (room.token !== token) { tunnel.stop(); throw new Error('Комната закрыта'); } return roomView(); });
  handle('room:local', () => { tunnel.stop(); return roomView(); });
  handle('room:copy', () => { if (!room.url) throw new Error('Открой комнату'); clipboard.writeText(roomView().publicUrl || room.url); });
  handle('room:qr', () => { if (!room.url) throw new Error('Открой комнату'); return QRCode.toDataURL(roomView().publicUrl || room.url, { margin: 3, width: 256 }); });
  handle('app:retry', async () => { selectedTab = 'music'; layout(); send('app:mode',mode);await music.webContents.loadURL(home()); });
  ipcMain.on('player:cast',event=>{if(event.sender!==music.webContents||event.senderFrame!==music.webContents.mainFrame)return;selectedTab='settings';layout();send('app:cast',{});window.webContents.focus();});
  handle('app:open-browser',async()=>{const sample=await player.sample();const url='https://music.youtube.com'+(sample?.videoId&&/^[\w-]{11}$/.test(sample.videoId)?'/watch?v='+sample.videoId:'');await require('electron').shell.openExternal(url);});
  ipcMain.on('player:ended', event => {
    if (!player.native&&event.sender === music.webContents && event.senderFrame === music.webContents.mainFrame && jam.state.role === 'host') jam.command('SKIP_NEXT').catch(() => {});
  });
  const ambientTimer=setInterval(async()=>{
    const item=player.items.find(entry=>entry.id===player.current);
    if(!item||item.videoId===ambientTrack||ambientBusy||!window||window.isDestroyed())return;
    ambientBusy=true;const videoId=item.videoId;
    try{
      const response=await fetch('https://i.ytimg.com/vi/'+videoId+'/mqdefault.jpg',{signal:AbortSignal.timeout(5000)});
      if(!response.ok||Number(response.headers.get('content-length')||0)>1000000)return;
      const data=await response.arrayBuffer();if(data.byteLength>1000000)return;
      const picture=require('electron').nativeImage.createFromBuffer(Buffer.from(data)).resize({width:24,height:24});
      const color=require('./ambient.cjs').dominantColor(picture.toBitmap());ambientTrack=videoId;send('app:ambient',color);
      await music.webContents.executeJavaScript(`document.documentElement.style.setProperty('--jamstorm-ambient',${JSON.stringify(color.join(' '))})`);
    }catch{}finally{ambientBusy=false;}
  },2500);
  window.on('closed',()=>clearInterval(ambientTimer));
  window.on('resize', layout); window.on('closed', () => { tunnel.stop(); room.stop(); jam.disconnect(); music.webContents.close(); window = null; });
  await window.loadFile(path.join(__dirname, 'ui/index.html')); layout();
  if (smoke) {
    selectedTab = 'jam'; layout();
    await window.webContents.executeJavaScript(`tab('jam');document.body.classList.remove('booting','intro-running');document.querySelector('#boot-screen').hidden=true;for(const el of document.querySelectorAll('.topbar,.listening-stage,.playback-dock'))el.style.animation='none';`);
    const result = await window.webContents.executeJavaScript(`({ title: document.title, bridge: typeof window.jam?.join, heading: document.querySelector('h1')?.textContent, inputs: document.querySelectorAll('input,textarea').length })`);
    const scroll = await window.webContents.executeJavaScript(`(() => { const main=document.querySelector('main'),bar=document.querySelector('.topbar'),details=document.createElement('div');details.style.height='1500px';main.append(details);main.scrollTop=600;const result={barTop:bar.getBoundingClientRect().top,scrolled:main.scrollTop,bodyScroll:document.scrollingElement.scrollTop};main.scrollTop=0;details.remove();return result;})()`);
    if (scroll.barTop !== 10 || scroll.bodyScroll !== 0 || scroll.scrolled <= 0) throw new Error('Fixed topbar regression');
    const ipc = await window.webContents.executeJavaScript(`window.jam.state()`);
    if (!ipc.ok || ipc.value.phase !== 'idle') throw new Error('Local IPC failed');
    if(!liveSmoke){
      await applyMode('tv');selectedTab='music';layout();send('app:mode','tv');await window.webContents.executeJavaScript(`tab('music')`);
      const tvExclusive=await window.webContents.executeJavaScript(`document.querySelector('#listening-stage').hidden&&document.querySelector('#playback-dock').hidden&&document.querySelector('#overlay-queue').disabled`);
      if(!music.getVisible()||!tvExclusive)throw new Error('TV overlays the local scene');
      if(music.getBounds().y!==72)throw new Error('TV content overlaps the toolbar');
      await window.webContents.executeJavaScript(`tab('catalog')`);if(mode!=='tv'||player.mode!=='tv'||!music.getVisible())throw new Error('Catalog unexpectedly changed the TV mode');
      await applyMode('music');send('app:mode','music');await window.webContents.executeJavaScript(`tab('music')`);
      if(music.getVisible())throw new Error('Native Music unexpectedly overlays the listening scene');
      await window.webContents.executeJavaScript(`tab('catalog')`);if(!music.getVisible())throw new Error('Catalog is not visible');
      await window.webContents.executeJavaScript(`tab('jam')`);if(music.getVisible())throw new Error('Catalog overlaps local queue');

      window.webContents.emit('before-input-event',{preventDefault(){}},{type:'keyDown',key:'F11',isAutoRepeat:false});
      await new Promise(resolve=>setTimeout(resolve,400));
      if(!window.isFullScreen()||music.getBounds().y!==48)throw new Error('Fullscreen layout regression');
      const hidden=await window.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.topbar')).display==='none'`);
      if(!hidden)throw new Error('Fullscreen topbar still visible');
      window.setFullScreen(false);await new Promise(resolve=>setTimeout(resolve,300));
    }
    console.log('SMOKE', JSON.stringify(result));
    const dir = app.isPackaged ? path.join(app.getPath('temp'), 'jam-desktop-smoke-artifacts') : path.join(__dirname, '../artifacts'); fs.mkdirSync(dir, { recursive: true });
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!liveSmoke) fs.writeFileSync(path.join(dir, 'desktop.png'), (await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
    if (liveSmoke) {
      await addons.set('adblock',true);

      selectedTab = 'music'; layout();await window.webContents.executeJavaScript(`tab('music')`);
      window.restore(); window.focus(); window.webContents.focus();
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
        if(mode==='tv'){
          send('app:mode',mode);await window.webContents.executeJavaScript(`tab('music')`);
          await new Promise(resolve=>setTimeout(resolve,700));
          fs.writeFileSync(path.join(dir,'tv-frame-0.5.1.png'),(await window.capturePage()).toPNG());
          const frame=await window.webContents.executeJavaScript(`({scene:document.querySelector('#listening-stage').hidden})`);
          if(!frame.scene||music.getBounds().y!==72)throw new Error('Live TV frame overlaps');
          await window.webContents.executeJavaScript(`tab('catalog')`);if(mode!=='tv')throw new Error('TV catalog switched the mode');
          await window.webContents.executeJavaScript(`window.jam.mode('music')`);await window.webContents.executeJavaScript(`tab('catalog')`);
          if(mode!=='music'||!music.webContents.getURL().startsWith('https://music.youtube.com'))throw new Error('Live TV-to-Music catalog failed');
          console.log('TV_CATALOG_PRESERVED_THEN_EXPLICIT_MUSIC',JSON.stringify({mode,url:music.webContents.getURL(),frame}));
        }
        const bootstrap=await window.webContents.executeJavaScript(`window.jam.playTrack('5NV6Rdv1a3I')`);if(!bootstrap.ok)throw new Error('Search play entry failed: '+bootstrap.error);
        await player.select({ id: 'smoke', videoId: '5NV6Rdv1a3I' }, false);
        await new Promise(resolve => setTimeout(resolve, 3000));
        const playback = await player.sample();
        console.log('LIVE_PLAYER', JSON.stringify({ videoId: playback?.videoId, title: playback?.title, playing: playback?.playing }));
        if (playback?.videoId !== '5NV6Rdv1a3I' || playback.playing) throw new Error('TV player adapter failed or manual pause lost');
        const baseline=await player.call({op:'SNAPSHOT'});
        if(!baseline.native)throw new Error('Native queue not readable');
        const catalogGlass=await music.webContents.executeJavaScript(`({body:getComputedStyle(document.body).backgroundColor,app:getComputedStyle(document.querySelector('ytmusic-app')).backgroundColor,ambient:!!document.querySelector('.jamstorm-ambient'),gradient:document.querySelector('.background-gradient')?getComputedStyle(document.querySelector('.background-gradient')).backgroundImage:'none',guide:document.querySelector('#guide-wrapper')?getComputedStyle(document.querySelector('#guide-wrapper')).backgroundColor:'rgba(0, 0, 0, 0)'})`);
        console.log('CATALOG_GLASS',JSON.stringify(catalogGlass));if(catalogGlass.body!=='rgba(0, 0, 0, 0)'||!catalogGlass.ambient||catalogGlass.gradient!=='none'||catalogGlass.guide!=='rgba(0, 0, 0, 0)')throw new Error('Catalog opacity or audio light regression');
        let markedProbe=false;
        for(const id of ['MBJFPq2Llps','XbGs_qK2PQA']){const info=await player.native.metadata(id);console.log('EXPLICIT_METADATA',JSON.stringify({id,...info}));if(info.known&&info.explicit){let blocked=false;try{await controlledCommand({op:'ADD',videoId:id},{actor:'browser:explicit-smoke'});}catch(error){blocked=/маркировкой E/.test(error.message);}if(!blocked)throw new Error('Explicit guest addition was accepted');const after=await player.call({op:'SNAPSHOT'});if(after.items.length!==baseline.items.length)throw new Error('Rejected Explicit addition changed native queue');markedProbe=true;break;}}
        console.log('EXPLICIT_LIVE_BLOCK',markedProbe);if(!markedProbe)throw new Error('No marked E reference track was verified');

        await jam.host(controlledCommand);await room.start();
        const guestCommand=async(op,fields)=>{
          const response=await fetch('http://127.0.0.1:'+room.port+'/api/command',{method:'POST',headers:{Authorization:'Bearer '+room.token,'Content-Type':'application/json'},body:JSON.stringify({id:require('node:crypto').randomUUID(),op,fields})});
          const result=await response.json();if(result.error)throw new Error(result.error);return result.queue;
        };
        const added=await guestCommand('ADD',{videoId:'dQw4w9WgXcQ'});
        if(!added.confirmed)throw new Error('Native ADD not confirmed');
        const entry=added.items.find(i=>i.videoId==='dQw4w9WgXcQ');
        const removed=await guestCommand('REMOVE',{item:entry.id,revision:added.revision});
        if(!removed.confirmed)throw new Error('Native REMOVE not confirmed');
        console.log('NATIVE_QUEUE_CONFIRMED',JSON.stringify({before:baseline.items.length,afterAdd:added.items.length,afterRemove:removed.items.length}));
        const lyricTrack=removed.items.find(item=>item.current),lyricResult=await lyrics.get({...lyricTrack,duration:removed.clock.duration});
        console.log('LIVE_LYRICS',JSON.stringify({title:lyricTrack.title,artist:lyricTrack.artist,lines:lyricResult.lines.length,plain:!!lyricResult.plain}));
        if(!lyricResult.lines.length)throw new Error('No synced lyrics for reference track');
        await new Promise(resolve=>setTimeout(resolve,2000));
        await window.webContents.executeJavaScript(`tab('music')`);
        panel={lyrics:'side',queue:'side'};send('app:panel',panel);
        await new Promise(resolve=>setTimeout(resolve,1600));
        const panelState=await window.webContents.executeJavaScript(`({lines:document.querySelectorAll('#stage-lines .lyric-line').length,queue:document.querySelectorAll('#stage-tracks .stage-track').length})`);
        if(!panelState.lines)throw new Error('Unified lyrics failed: '+JSON.stringify(panelState));
        await player.call({op:'SEEK',videoId:lyricTrack.videoId,position:65000});
        await new Promise(resolve=>setTimeout(resolve,1400));
        fs.writeFileSync(path.join(dir,'stage-3-player.png'),(await window.webContents.capturePage()).toPNG());
        for(const variant of [{lyrics:false,queue:false},{lyrics:true,queue:false},{lyrics:false,queue:true},{lyrics:true,queue:true}]){
          panel=variant;send('app:panel',panel);await new Promise(resolve=>setTimeout(resolve,100));
          console.log('PANEL_MOTION',JSON.stringify(await window.webContents.executeJavaScript(`({running:document.getAnimations().filter(a=>a.playState==='running').length,viewTransition:document.getAnimations().some(a=>(a.animationName||'').includes('view-transition'))})`)));
          await new Promise(resolve=>setTimeout(resolve,300));
          const geometry=await window.webContents.executeJavaScript(`(()=>{const art=document.querySelector('#cover-frame').getBoundingClientRect(),stage=document.querySelector('#listening-stage').getBoundingClientRect();return {w:art.width,h:art.height,left:art.left,right:art.right,stageRight:stage.right};})()`);
          if(geometry.w>480||geometry.left<0||geometry.right>geometry.stageRight+1)throw new Error('Stage geometry failed '+JSON.stringify(geometry));
          fs.writeFileSync(path.join(dir,'stage-3-'+Number(variant.lyrics)+Number(variant.queue)+'.png'),(await window.webContents.capturePage()).toPNG());
        }
        fs.writeFileSync(path.join(dir,'stage-3-full-player.png'),(await window.webContents.capturePage()).toPNG());
        const quality=await window.webContents.executeJavaScript(`(()=>{const image=document.querySelector('#stage-cover');return {width:image.naturalWidth,height:image.naturalHeight,rendered:image.clientWidth,source:image.currentSrc.split('?')[0]};})()`);
        console.log('ARTWORK_QUALITY',JSON.stringify(quality));if(quality.width<640)throw new Error('Artwork still uses a low-resolution thumbnail');

        await player.select({id:'smoke',videoId:'5NV6Rdv1a3I'},true);
        await new Promise(resolve => setTimeout(resolve, 8000));
        selectedTab = 'jam'; layout(); window.minimize();
        await new Promise(resolve => setTimeout(resolve, 2000));
        const background = await player.sample();
        console.log('LIVE_BACKGROUND', JSON.stringify({ mode, playing: background?.playing, position: background?.position,audioLevel:lastAudioLevel,material }));
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
