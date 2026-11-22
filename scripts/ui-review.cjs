'use strict';
// Review-only fixture. This file is not included in production builds.
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path'),fs=require('node:fs'),QRCode=require('qrcode');
app.disableHardwareAcceleration();
app.setPath('userData',path.join(__dirname,'../artifacts/ui-profile-'+process.pid));
const out=path.join(__dirname,'../artifacts/ui-review');fs.mkdirSync(out,{recursive:true});
let room={active:false},panels={lyrics:true,queue:true};
let state={phase:'idle',role:null,peers:0,queue:{ok:true,native:true,revision:'review:1',items:[],clock:{position:32000,duration:180000,playing:true}}};
const fixtures=[['5NV6Rdv1a3I','Get Lucky','Daft Punk'],['fLexgOxsZu0','Uptown Funk','Mark Ronson · Bruno Mars'],['kJQP7kiw5Fk','Despacito','Luis Fonsi · Daddy Yankee']];
const windows=[];const errors=[];let screenshots=0;
const handle=(key,fn)=>ipcMain.handle(key,async(_event,...args)=>{try{return {ok:true,value:await fn(...args)};}catch(error){return {ok:false,error:error.message};}});
handle('unused:login-state',()=>{});
handle('app:accounts',()=>({music:'signed-in',tv:'signed-out'}));
handle('app:feedback',kind=>{const feedback=state.queue.feedback;if(feedback&&['like','dislike'].includes(kind)){feedback[kind].pressed=!feedback[kind].pressed;if(feedback[kind].pressed)feedback[kind==='like'?'dislike':'like'].pressed=false;}return {page:null,feedback};});
let videoSettings={enabled:false,followCatalog:true,ambient:true,intensity:75,size:76};handle('app:video',value=>videoSettings={...videoSettings,...value});handle('app:video-layout',value=>({visible:!!value.active}));
handle('app:navigation',()=>({back:true,forward:false}));handle('app:navigate',()=>({back:false,forward:true}));
handle('app:appearance',()=>{});
handle('app:appearance-snapshot',()=>{});
handle('app:frame',()=>({overlay:true}));
handle('app:presentation',value=>value);handle('app:window',()=>({maximized:false}));
handle('app:update',()=>({available:false}));
handle('app:policy',()=>({blockExplicit:true,hideExplicit:true,guestLimit:3,guestReorder:false}));handle('app:open-browser',()=>{});
handle('app:material',value=>({material:value,supported:true}));handle('app:visuals',()=>true);
handle('jam:state',()=>state);handle('app:queue',()=>state.queue);handle('app:panels',()=>panels);
handle('jam:command',(op,fields)=>{if(op==='MOVE'){const items=state.queue.items,from=items.findIndex(i=>i.id===fields.item),to=items.findIndex(i=>i.id===fields.target);const [item]=items.splice(from,1);items.splice(to,0,item);state.queue.revision='review:drag';}return state.queue;});
handle('app:search',()=>fixtures.map(([videoId,title,artist])=>({videoId,title,artist})));handle('app:play-track',()=>state.queue);
handle('app:tab',()=>({mode:'music'}));handle('app:panel',key=>panels=require('../src/ui/panel-modes.js').nextPanel(panels,key));
handle('addons:state',()=>({adblock:false,sponsorblock:false}));handle('addons:set',()=>{});
handle('room:state',()=>room);handle('room:start',()=>room={active:true,url:'http://192.168.1.10:45123/#review-only',guests:2});
handle('room:qr',()=>QRCode.toDataURL(room.url));handle('room:stop',()=>room={active:false});handle('room:copy',()=>{});
handle('app:lyrics',()=>({lines:Array.from({length:14},(_,i)=>({time:i*10000,text:['Музыка собирает нас','В одном ритме, в одном месте','Каждый выбирает свой трек','И вечер звучит по-новому'][i%4]})),source:'Review fixture'}));
async function make(file,width,height){
 const win=new BrowserWindow({width,height,backgroundColor:'#151a24',show:false,webPreferences:{offscreen:true,backgroundThrottling:false,sandbox:true,contextIsolation:true,preload:path.join(__dirname,'../src/preload.cjs')}});windows.push(win);
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('ERR_'))errors.push(event.message);});
 await win.loadFile(path.join(__dirname,'../src/ui',file));const execute=win.webContents.executeJavaScript.bind(win.webContents);win.webContents.executeJavaScript=async source=>{try{return await execute(source)}catch(error){console.error('REVIEW_SCRIPT',source.slice(0,1200),'RENDERER_ERRORS',errors);throw error;}};return win;
}
async function shot(win,name){
 await new Promise(resolve=>setTimeout(resolve,300));
 for(let attempt=0;attempt<3;attempt++)try{fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true})).toPNG());screenshots++;return;}catch(error){
  if(attempt===2||!/UnknownVizError|Current display surface not available/.test(error.message))throw Error('Screenshot '+name+': '+error.message);
  if(win.webContents.isOffscreen())win.webContents.invalidate();await new Promise(resolve=>setTimeout(resolve,200));
 }
}
app.whenReady().then(async()=>{
 const win=await make('index.html',1320,880);
 if(process.argv.includes('--ambient-only')){
  win.setSize(2560,1080);state.queue.items=[{id:'ambient',videoId:'5NV6Rdv1a3I',title:'Afterglow',artist:'JAMSTORM Sessions',current:true}];
  await win.webContents.executeJavaScript(`document.body.classList.remove('booting','intro-running');document.getElementById('boot-screen').hidden=true;render(${JSON.stringify(state)});window.listening.panels({lyrics:'hidden',queue:'hidden'},false);document.querySelector('#appearance-preset').value='glass';document.querySelector('#appearance-preset').dispatchEvent(new Event('change'));window.playerEffects.palette([[203,93,42],[42,110,180],[153,63,160]]);`);
  const results=[];for(const mode of ['lava','corona']){
   await win.webContents.executeJavaScript(`document.querySelector('#appearance-visualizer').value=${JSON.stringify(mode)};document.querySelector('#appearance-visualizer').dispatchEvent(new Event('input'))`);
   for(let i=0;i<24;i++){win.webContents.send('app:spectrum',Array.from({length:48},(_,n)=>.15+Math.sin(n/5+i/6)**2*.7));await new Promise(r=>setTimeout(r,80));}
   const pixels=await win.webContents.executeJavaScript(`(()=>{const c=document.querySelector('.immersion-background'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0,total=0;for(let i=3;i<data.length;i+=64){total++;if(data[i]>10)count++;}return {mode:document.body.dataset.visualizer,coverage:count/total,width:c.width,height:c.height};})()`);results.push(pixels);if(pixels.coverage<.25)throw Error('Ambient does not fill the screen: '+JSON.stringify(pixels));await shot(win,mode+'-full-ambient');
  }
  console.log('AMBIENT_REVIEW_OK',JSON.stringify(results));app.exit(0);return;
 }
 await win.webContents.executeJavaScript(`document.querySelector('#appearance-dock').value='always';document.querySelector('#appearance-dock').dispatchEvent(new Event('input'))`);
 await new Promise(resolve=>setTimeout(resolve,120));
 const bootMotion=await win.webContents.executeJavaScript(`document.getAnimations().filter(a=>a.playState==='running').map(a=>a.animationName||'')`);
 await win.webContents.executeJavaScript(`document.body.classList.add('native-material');document.documentElement.style.background='linear-gradient(125deg,#e99b44,#198eae 48%,#c54434)'`);
 await shot(win,'boot-vortex');
 if(!bootMotion.includes('fire-spiral')||!bootMotion.includes('boot-mark'))throw new Error('Startup animation did not play: '+bootMotion);
 await new Promise(resolve=>setTimeout(resolve,1400));await win.webContents.executeJavaScript(`tab('jam')`);await shot(win,'01-empty-queue');
 state={...state,queue:{...state.queue,items:fixtures.map(([videoId,title,artist],index)=>({id:String(index+1),videoId,title,artist,current:index===0}))}};
 await win.webContents.executeJavaScript(`render(${JSON.stringify(state)})`);await shot(win,'02-queue');
 await win.webContents.executeJavaScript(`tab('invite')`);await shot(win,'03-invite');
 await win.webContents.executeJavaScript(`document.querySelector('#room-start').click()`);await new Promise(resolve=>setTimeout(resolve,400));await shot(win,'04-share-qr');
 await win.webContents.executeJavaScript(`tab('settings')`);await shot(win,'05-settings');
 const accountState=await win.webContents.executeJavaScript(`({music:document.querySelector('#music-login').dataset.accountState,tv:document.querySelector('#tv-login').dataset.accountState})`);
 if(accountState.music!=='signed-in'||accountState.tv!=='signed-out')throw Error('Account status is stale: '+JSON.stringify(accountState));
 win.setSize(860,700);await shot(win,'06-settings-small');
 await win.webContents.executeJavaScript(`document.querySelector('main').scrollTop=99999`);
 const settingsEnd=await win.webContents.executeJavaScript(`(()=>{const main=document.querySelector('main'),last=document.querySelector('#settings-page .about').getBoundingClientRect();return {bottom:last.bottom,viewport:main.getBoundingClientRect().bottom,dock:document.querySelector('#playback-dock').hidden};})()`);
 if(settingsEnd.bottom>settingsEnd.viewport||!settingsEnd.dock)throw Error('Settings end is clipped: '+JSON.stringify(settingsEnd));
 await shot(win,'settings-end');
 await win.webContents.executeJavaScript(`document.querySelector('main').scrollTop=0;document.querySelector('#appearance-toggle').click();for(const [key,value] of Object.entries({background:'artwork',opacity:35,grain:45})){const el=document.querySelector('#appearance-'+key);el.value=value;el.dispatchEvent(new Event('input'));}`);
 const presetRoundtrip=await win.webContents.executeJavaScript(`(()=>{const select=document.querySelector('#appearance-preset');select.value='quiet';select.dispatchEvent(new Event('change'));const opaque=!document.body.classList.contains('glass')&&document.body.dataset.translucent==='false';select.value='cover';select.dispatchEvent(new Event('change'));const material=document.querySelector('#window-material');material.value='none';material.dispatchEvent(new Event('change'));const ordinary=document.body.dataset.translucent==='false';material.value='acrylic';material.dispatchEvent(new Event('change'));document.querySelector('#preset-name').value='Review custom';document.querySelector('#preset-save').click();const id=select.value,count=JSON.parse(localStorage.getItem('appearance-custom')).length;document.querySelector('#appearance-grain').value=11;document.querySelector('#appearance-grain').dispatchEvent(new Event('input'));document.querySelector('#preset-save').click();const updated=select.value===id&&JSON.parse(localStorage.getItem('appearance-custom')).length===count;select.value='daylight';select.dispatchEvent(new Event('change'));select.value=id;select.dispatchEvent(new Event('change'));const restored=document.body.dataset.background==='artwork'&&document.body.dataset.theme==='dark';document.querySelector('#preset-delete').click();document.querySelector('#appearance-dock').value='always';document.querySelector('#appearance-dock').dispatchEvent(new Event('input'));for(const [key,value] of Object.entries({background:'artwork',opacity:35,grain:45})){const el=document.querySelector('#appearance-'+key);el.value=value;el.dispatchEvent(new Event('input'));}return {opaque,ordinary,updated,restored};})()`);
 if(!presetRoundtrip.opaque||!presetRoundtrip.ordinary||!presetRoundtrip.updated||!presetRoundtrip.restored)throw Error('Preset roundtrip failed: '+JSON.stringify(presetRoundtrip));
 const appearance=await win.webContents.executeJavaScript(`({open:document.querySelector('#appearance-popover').matches(':popover-open'),background:document.body.dataset.background,opacity:document.body.style.getPropertyValue('--window-opacity'),grain:document.body.style.getPropertyValue('--grain')})`);
 if(!appearance.open||appearance.background!=='artwork'||Number(appearance.opacity)!==.65||Math.abs(Number(appearance.grain)-.072)>.000001)throw Error('Appearance controls failed: '+JSON.stringify(appearance));
 await shot(win,'appearance');
 await win.webContents.executeJavaScript(`document.querySelector('#appearance-popover').hidePopover();for(const [key,value] of Object.entries({background:'ambient',opacity:65,grain:0})){const el=document.querySelector('#appearance-'+key);el.value=value;el.dispatchEvent(new Event('input'));}`);

 const header=await win.webContents.executeJavaScript(`({overflow:document.querySelector('.topbar').scrollWidth>document.querySelector('.topbar').clientWidth,buttons:[...document.querySelectorAll('.topbar button')].filter(e=>e.getBoundingClientRect().right>innerWidth).length})`);
 if(header.overflow||header.buttons)throw new Error('Toolbar overflows at 860px: '+JSON.stringify(header));
 await win.webContents.executeJavaScript(`tab('jam')`);await shot(win,'07-queue-small');

 win.setSize(1320,880);await win.webContents.executeJavaScript(`tab('music');render(${JSON.stringify(state)})`);await new Promise(resolve=>setTimeout(resolve,600));
 const variants=[{lyrics:true,queue:true},{lyrics:false,queue:true},{lyrics:true,queue:false},{lyrics:false,queue:false}];
 for(const [i,value] of variants.entries()){
  await win.webContents.executeJavaScript(`window.listening.panels(${JSON.stringify(value)},false)`);await shot(win,'stage-'+i);
  const geometry=await win.webContents.executeJavaScript(`(()=>{const art=document.querySelector('#cover-frame').getBoundingClientRect();return {width:art.width,height:art.height,right:art.right,left:art.left};})()`);
  if(Math.abs(geometry.width-geometry.height)>1||geometry.width>480||geometry.left<0||geometry.right>1320)throw new Error('Unbounded artwork '+JSON.stringify(geometry));
 }
 await win.webContents.executeJavaScript(`window.listening.panels({lyrics:true,queue:true},false)`);
 const lyricState=await win.webContents.executeJavaScript(`({lines:document.querySelectorAll('#stage-lines .lyric-line').length,active:document.querySelectorAll('#stage-lines .is-active').length})`);
 if(lyricState.lines!==14||lyricState.active!==1)throw new Error('Unified lyrics failed: '+JSON.stringify(lyricState));
 win.setSize(1920,1080);await shot(win,'stage-wide');
 win.setSize(860,700);await shot(win,'stage-small');
 const bounds=await win.webContents.executeJavaScript(`(()=>{const ids=['lyrics-pane','artwork-pane','queue-pane'];return ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,left:r.left,right:r.right,top:r.top,bottom:r.bottom};});})()`);
 if(bounds[0].right>bounds[1].left+1||bounds[1].right>bounds[2].left+1||bounds[2].right>860)throw new Error('Panels overlap: '+JSON.stringify(bounds));

 // Reproduce the reported short-window clipping, including the first-use empty state.
 const geometryFailures=[];let cases=0;
 for(const [width,height] of [[1163,774],[1163,700],[860,620],[1320,620],[960,650],[2560,1080],[3440,1440]]){
  win.setSize(width,height);
  for(const empty of [true,false]){
   const data=empty?{...state,queue:{...state.queue,items:[]}}:state;
   await win.webContents.executeJavaScript(`render(${JSON.stringify(data)})`);
   for(const value of [{lyrics:'side',queue:'side'},{lyrics:'hidden',queue:'hidden'},{lyrics:'center',queue:'side'},{lyrics:'side',queue:'center'}]){
    await win.webContents.executeJavaScript(`window.listening.panels(${JSON.stringify(value)},false)`);
    await new Promise(resolve=>setTimeout(resolve,80));cases++;
    const result=await win.webContents.executeJavaScript(`(()=>{
     const box=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
     const search=box('stage-search'),art=box('cover-frame'),start=box('hero-start'),dock=box('playback-dock'),stage=box('listening-stage');
     const focused=document.querySelector('#listening-stage').dataset.focus;
     const hit=document.elementFromPoint((search.left+search.right)/2,(search.top+search.bottom)/2);
     return {search,art,start,dock,stage,focused,searchClickable:!!hit?.closest('#stage-search'),startVisible:document.getElementById('hero-start').hidden||focused!=='artwork'||start.bottom<=stage.bottom+1};
    })()`);
    if(!result.searchClickable||!result.startVisible||result.search.top<0||result.dock.height>0&&result.stage.bottom>result.dock.top||result.focused==='artwork'&&result.art.height>0&&(result.art.top<result.stage.top||result.art.bottom>result.stage.bottom))geometryFailures.push({width,height,empty,value,result});
   }
  }
 }
 if(geometryFailures.length)throw new Error('Short-window clipping: '+JSON.stringify(geometryFailures));
 win.setSize(1163,774);await win.webContents.executeJavaScript(`render({...${JSON.stringify(state)},queue:{...${JSON.stringify(state.queue)},items:[]}});window.listening.panels({lyrics:'side',queue:'side'},false)`);if(!await win.webContents.executeJavaScript(`!document.body.classList.contains('has-track')&&getComputedStyle(document.querySelector('.cover-shell')).display==='none'`))throw Error('An empty player displays stale artwork');await shot(win,'empty-short-fixed');
 await win.webContents.executeJavaScript(`render(${JSON.stringify(state)});window.listening.panels({lyrics:'center',queue:'hidden'},false)`);await new Promise(resolve=>setTimeout(resolve,900));await shot(win,'lyrics-center');
 const centered=await win.webContents.executeJavaScript(`(()=>{const a=document.querySelector('#stage-lines .is-active').getBoundingClientRect(),b=document.querySelector('#stage-lines').getBoundingClientRect();const p=document.querySelector('#lyrics-pane').getBoundingClientRect();if(b.bottom>p.bottom||b.top<p.top)throw new Error('Lyrics scroll container exceeds its pane');return Math.abs((a.top+a.bottom-b.top-b.bottom)/2);})()`);if(centered>10)throw new Error('Lyric line is not centered: '+centered);
 await win.webContents.executeJavaScript(`window.listening.panels({lyrics:'hidden',queue:'center'},false)`);await shot(win,'queue-center');
 await win.webContents.executeJavaScript(`window.listening.panels({lyrics:'hidden',queue:'hidden'},false)`);await shot(win,'focus-short');
 // Both startup motion and actual lyric changes must produce animations, not just classes.
 await win.webContents.executeJavaScript(`window.listening.panels({lyrics:'center',queue:'hidden'},false);render(${JSON.stringify({...state,queue:{...state.queue,clock:{...state.queue.clock,position:45000,playing:false}}})})`);
 await new Promise(resolve=>setTimeout(resolve,60));
 const motion=await win.webContents.executeJavaScript(`({active:document.querySelector('#stage-lines .is-active')?.textContent,animations:document.getAnimations().filter(a=>a.playState==='running').length,boot:!![...document.styleSheets].flatMap(s=>[...s.cssRules]).find(r=>r.name==='boot-stage')})`);
 if(motion.animations<1||!motion.boot)throw new Error('No visible animation '+JSON.stringify(motion));
 await win.webContents.executeJavaScript(`window.listening.mode('tv')`);const tv=await win.webContents.executeJavaScript(`({stage:document.querySelector('#listening-stage').hidden,dock:document.querySelector('#playback-dock').hidden,disabled:document.querySelector('#overlay-lyrics').disabled})`);
 if(tv.stage||tv.dock||tv.disabled)throw new Error('TV shared scene controls are missing');
 await shot(win,'tv-exclusive');await win.webContents.executeJavaScript(`window.listening.mode('music')`);
 await win.webContents.executeJavaScript(`document.querySelector('#stage-search').click();document.querySelector('#stage-query').value='test';document.querySelector('#stage-search-form').requestSubmit()`);await shot(win,'search-dialog');
 const searchCount=await win.webContents.executeJavaScript(`document.querySelectorAll('.search-result').length`);if(searchCount!==3)throw new Error('Search missing results');

 await win.webContents.executeJavaScript(`document.querySelector('#search-dialog').close();document.dispatchEvent(new KeyboardEvent('keydown',{key:'л',code:'KeyK',ctrlKey:true,bubbles:true}))`);
 if(!await win.webContents.executeJavaScript(`document.querySelector('#search-dialog').open`))throw new Error('Russian Ctrl K failed');
 await win.webContents.executeJavaScript(`document.querySelector('#search-dialog').close();window.listening.panels({lyrics:'hidden',queue:'side'},false);document.querySelector('#vinyl-mode').checked=true;document.querySelector('#vinyl-mode').dispatchEvent(new Event('change'));window.listening.render({...${JSON.stringify(state.queue)},clock:{...${JSON.stringify(state.queue.clock)},playing:true}})`);
 await new Promise(resolve=>setTimeout(resolve,800));await shot(win,'vinyl');
 const spinning=await win.webContents.executeJavaScript(`({round:document.body.classList.contains('vinyl'),label:document.body.classList.contains('vinyl-paper'),rate:document.querySelector('#record-spin').getAnimations()[0]?.playbackRate})`);
 if(!spinning.round||!spinning.label||!spinning.rate)throw new Error('Vinyl failed '+JSON.stringify(spinning));
 const paperHit=await win.webContents.executeJavaScript(`(()=>{const el=document.querySelector('#paper-toggle'),r=el.getBoundingClientRect();return [r.left+3,r.right-3].every(x=>document.elementFromPoint(x,r.top+r.height/2)?.closest('#paper-toggle'));})()`);if(!paperHit)throw new Error('Paper-label control is clipped');
 state.queue.clock.playing=false;
 await win.webContents.executeJavaScript(`window.listening.render(${JSON.stringify(state.queue)});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);await new Promise(resolve=>setTimeout(resolve,450));
 state.queue.clock.playing=true;
 const pausedShape=await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.play-left')).d`);
 await win.webContents.executeJavaScript(`window.listening.render(${JSON.stringify(state.queue)})`);await new Promise(resolve=>setTimeout(resolve,500));
 const playingShape=await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.play-left')).d`);
 if(pausedShape===playingShape)throw new Error('Play/pause SVG states are identical');
 const pauseStyle=await win.webContents.executeJavaScript(`(()=>{const light=document.querySelector('#ambient-light');document.body.classList.add('playback-paused');const rule=[...document.styleSheets].flatMap(s=>[...s.cssRules]).find(r=>r.selectorText==='body.playback-paused .ambient-light');return {paused:Number(rule.style.opacity),transition:getComputedStyle(light).transitionDuration};})()`);
 if(pauseStyle.paused!==.35||pauseStyle.transition!=='1.4s')throw new Error('Pause must dim the shared light smoothly');
 await win.webContents.executeJavaScript(`document.body.classList.remove('playback-paused')`);


 await win.webContents.executeJavaScript(`(()=>{const rows=document.querySelectorAll('#stage-tracks .stage-track'),data=new DataTransfer();rows[2].dispatchEvent(new DragEvent('dragstart',{dataTransfer:data,bubbles:true}));rows[1].dispatchEvent(new DragEvent('drop',{dataTransfer:data,bubbles:true}));})()`);
 await new Promise(resolve=>setTimeout(resolve,100));if(state.queue.items[1].id!=='3')throw new Error('Drag drop did not move native queue fixture');
 await win.webContents.executeJavaScript(`document.body.classList.add('fullscreen')`);await shot(win,'fullscreen-player');
 if(!await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('#fullscreen-nav')).display==='flex'`))throw new Error('Fullscreen navigation missing');

 // Public screenshots use our own artwork and original lyric fixture, never copied lyrics or covers.
 win.setSize(1320,880);
 const publicQueue={...state.queue,items:state.queue.items.map((i,n)=>({...i,title:['Afterglow','Night drive','Slow orbit'][n],artist:'JAMSTORM Sessions'})),clock:{position:32000,duration:180000,playing:false}};
 state={...state,queue:publicQueue};
 await win.webContents.executeJavaScript(`render(${JSON.stringify(state)});document.body.classList.remove('fullscreen');document.querySelector('#vinyl-mode').checked=false;document.querySelector('#vinyl-mode').dispatchEvent(new Event('change'));window.listening.render(${JSON.stringify(publicQueue)});window.listening.panels({lyrics:'side',queue:'side'},false)`);
 await new Promise(resolve=>setTimeout(resolve,700));
 const publicArt=require('node:url').pathToFileURL(path.join(__dirname,'../.github/media/cover-demo.svg')).href;
 await win.webContents.executeJavaScript(`Promise.all([...document.querySelectorAll('#stage-cover,#dock-cover,.stage-track img')].map(image=>{image.src=${JSON.stringify(publicArt)};return image.decode().catch(()=>{});}));window.playerEffects.ambient([192,120,75])`);await shot(win,'public-player');
 await win.webContents.executeJavaScript(`window.listening.panels({lyrics:'center',queue:'hidden'},false)`);await new Promise(resolve=>setTimeout(resolve,700));await shot(win,'public-lyrics');
 await win.webContents.executeJavaScript(`window.listening.panels({lyrics:'hidden',queue:'side'},false);document.querySelector('#vinyl-mode').checked=true;document.querySelector('#vinyl-mode').dispatchEvent(new Event('change'))`);await shot(win,'public-vinyl');

 // Real-time spectrum fixtures verify that only listened positions leave a trail.
 state.queue.clock.playing=true;state.queue.clock.position=7000;
 await win.webContents.executeJavaScript(`render(${JSON.stringify(state)});document.querySelector('#appearance-visualizer').value='trail';document.querySelector('#appearance-visualizer').dispatchEvent(new Event('input'))`);
 win.webContents.send('app:spectrum',Array(48).fill(.6));await new Promise(resolve=>setTimeout(resolve,80));
 state.queue.clock.position=72000;
 await win.webContents.executeJavaScript(`render(${JSON.stringify(state)})`);win.webContents.send('app:spectrum',Array(48).fill(.8));await new Promise(resolve=>setTimeout(resolve,80));
 const trail=await win.webContents.executeJavaScript(`window.immersion.history()`);if(trail!==2)throw Error('Waveform invents audio in skipped positions: '+trail);
 await shot(win,'waveform-trail');
 await win.webContents.executeJavaScript(`const choice=document.querySelector('#appearance-dock');choice.value='auto';choice.dispatchEvent(new Event('input'));document.activeElement?.blur()`);
 let collapsed=false;for(let i=0;i<25;i++){await new Promise(resolve=>setTimeout(resolve,200));collapsed=await win.webContents.executeJavaScript(`document.body.classList.contains('dock-collapsed')&&getComputedStyle(document.querySelector('#playback-dock')).opacity==='0'`);if(collapsed)break;}
 if(!collapsed)throw Error('Player did not collapse: '+JSON.stringify(await win.webContents.executeJavaScript(`({mode:document.body.dataset.dock,collapsed:document.body.classList.contains('dock-collapsed'),opacity:getComputedStyle(document.querySelector('#playback-dock')).opacity,hover:document.querySelector('#playback-dock').matches(':hover'),focus:document.activeElement.id})`)));
 await shot(win,'player-collapsed');
 await win.webContents.executeJavaScript(`document.querySelector('#dock-reveal').click()`);
 if(await win.webContents.executeJavaScript(`document.body.classList.contains('dock-collapsed')`))throw Error('Player did not reveal');
 await win.webContents.executeJavaScript(`document.querySelector('#appearance-dock').value='always';document.querySelector('#appearance-dock').dispatchEvent(new Event('input'));document.querySelector('#appearance-lyrics').value='particles';document.querySelector('#appearance-lyrics').dispatchEvent(new Event('input'));window.listening.panels({lyrics:'center',queue:'hidden'},false)`);
 await new Promise(resolve=>setTimeout(resolve,700));
 await win.webContents.executeJavaScript(`(()=>{const lines=document.querySelectorAll('.lyric-line');window.dispatchEvent(new CustomEvent('lyric-change',{detail:{previous:lines[3],current:lines[4]}}));})()`);
 await new Promise(resolve=>setTimeout(resolve,120));await shot(win,'lyrics-particles');

 await win.webContents.executeJavaScript(`window.playerEffects.palette([[185,92,65],[68,117,145],[190,168,135]]);document.querySelector('.floating-artwork').style.backgroundImage='url('+${JSON.stringify(publicArt)}+')';window.listening.panels({lyrics:'hidden',queue:'side'},false);document.querySelector('#vinyl-mode').checked=false;document.querySelector('#vinyl-mode').dispatchEvent(new Event('change'))`);
 for(const id of ['glass','cover','silver','daylight','quiet']){
  await win.webContents.executeJavaScript(`(()=>{const select=document.querySelector('#appearance-preset');select.value=${JSON.stringify(id)};select.dispatchEvent(new Event('change'));document.querySelector('#appearance-dock').value='always';document.querySelector('#appearance-dock').dispatchEvent(new Event('input'));})()`);
  await new Promise(resolve=>setTimeout(resolve,650));await shot(win,'preset-'+id);
  const chrome=await win.webContents.executeJavaScript(`({glass:document.body.dataset.translucent,blur:getComputedStyle(document.querySelector('.topbar')).backdropFilter,color:getComputedStyle(document.querySelector('.topbar')).color,controls:[...document.querySelectorAll('[data-window]')].map(e=>e.getBoundingClientRect().height)})`);
  if(chrome.controls.some(h=>h!==34)||id==='quiet'&&(chrome.glass!=='false'||chrome.blur!=='none'))throw Error('Chrome preset failed: '+JSON.stringify(chrome));
 }
 for(const style of ['horizon','bloom']){await win.webContents.executeJavaScript(`(()=>{const select=document.querySelector('#appearance-background');select.value=${JSON.stringify(style)};select.dispatchEvent(new Event('input'));})()`);await shot(win,'background-'+style);}
 await win.webContents.executeJavaScript(`window.listening.mode('tv');window.listening.render({...${JSON.stringify(state.queue)},items:[{id:'tv-fixture',videoId:'5NV6Rdv1a3I',title:'TV review',artist:'JAMSTORM Sessions',current:true}]});window.listening.panels({lyrics:'center',queue:'hidden'},false)`);
 await new Promise(resolve=>setTimeout(resolve,150));
 const tvLyrics=await win.webContents.executeJavaScript(`({lines:document.querySelectorAll('.lyric-line').length,disabled:document.querySelector('#overlay-lyrics').disabled})`);if(tvLyrics.lines!==14||tvLyrics.disabled)throw Error('TV lyrics are unavailable '+JSON.stringify(tvLyrics));
 win.setSize(2560,1080);await win.webContents.executeJavaScript(`window.listening.mode('music');window.listening.panels({lyrics:'hidden',queue:'hidden'},false);document.querySelector('#appearance-visualizer').value='corona';document.querySelector('#appearance-visualizer').dispatchEvent(new Event('input'));document.body.classList.remove('playback-paused')`);win.webContents.send('app:spectrum',Array.from({length:48},(_,i)=>.15+Math.sin(i/5)**2*.65));await shot(win,'rays-ultrawide');await win.webContents.executeJavaScript(`document.querySelector('#appearance-visualizer').value='lava';document.querySelector('#appearance-visualizer').dispatchEvent(new Event('input'))`);win.webContents.send('app:spectrum',Array.from({length:48},(_,i)=>.2+Math.sin(i/6)**2*.65));await shot(win,'lava-ultrawide');
 state.queue.feedback={like:{available:true,pressed:false},dislike:{available:true,pressed:false}};
 await win.webContents.executeJavaScript(`render(${JSON.stringify(state)});document.getElementById('feedback-like').click()`);await new Promise(r=>setTimeout(r,120));
 if(!await win.webContents.executeJavaScript(`document.getElementById('feedback-like').getAttribute('aria-pressed')==='true'`))throw Error('Like did not reflect native response');
 await win.webContents.executeJavaScript(`render({...state,queue:{...state.queue,feedback:undefined}})`);if(!await win.webContents.executeJavaScript(`document.getElementById('feedback-like').getAttribute('aria-pressed')==='true'`))throw Error('Queue refresh lost the rating');
 await win.webContents.executeJavaScript(`document.getElementById('dock-video').click()`);await new Promise(r=>setTimeout(r,120));if(!await win.webContents.executeJavaScript(`document.body.classList.contains('video-view-active')`))throw Error('Host video precondition failed');await win.webContents.executeJavaScript(`render({...state,role:'guest'})`);await new Promise(r=>setTimeout(r,100));const guest=await win.webContents.executeJavaScript(`({ratings:document.querySelector('.track-feedback').hidden,videoDisabled:document.getElementById('dock-video').disabled,videoVisible:document.body.classList.contains('video-view-active')})`);if(!guest.ratings||!guest.videoDisabled||guest.videoVisible)throw Error('Guest controls target local media: '+JSON.stringify(guest));
 if(windows.some(w=>w.isVisible()||w.isFocused()))throw Error('UI review must remain hidden');if(errors.length)throw new Error(errors.join('\n'));
 console.log('UI_REVIEW_OK',JSON.stringify({screenshots,resizeCases:cases,toolbar:header,lyrics:lyricState,motion,bootMotion}));
 app.exit(0);
}).catch(error=>{console.error('UI_REVIEW_FAILED',error.stack);app.exit(1);});
