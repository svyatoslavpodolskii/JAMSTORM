'use strict';
// Review-only fixture. This file is not included in production builds.
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path'),fs=require('node:fs'),QRCode=require('qrcode');
app.disableHardwareAcceleration();
app.setPath('userData',path.join(app.getPath('temp'),'jamstorm-ui-review'));
const out=path.join(__dirname,'../artifacts/ui-review');fs.mkdirSync(out,{recursive:true});
let room={active:false},panels={lyrics:true,queue:true};
let state={phase:'idle',role:null,peers:0,queue:{ok:true,native:true,revision:'review:1',items:[],clock:{position:32000,duration:180000,playing:true}}};
const fixtures=[['5NV6Rdv1a3I','Get Lucky','Daft Punk'],['fLexgOxsZu0','Uptown Funk','Mark Ronson · Bruno Mars'],['kJQP7kiw5Fk','Despacito','Luis Fonsi · Daddy Yankee']];
const windows=[];const errors=[];
const handle=(key,fn)=>ipcMain.handle(key,async(_event,...args)=>{try{return {ok:true,value:await fn(...args)};}catch(error){return {ok:false,error:error.message};}});
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
 const win=new BrowserWindow({width,height,backgroundColor:'#151a24',show:false,webPreferences:{offscreen:true,sandbox:true,contextIsolation:true,preload:path.join(__dirname,'../src/preload.cjs')}});windows.push(win);
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('ERR_'))errors.push(event.message);});
 await win.loadFile(path.join(__dirname,'../src/ui',file));return win;
}
async function shot(win,name){await new Promise(resolve=>setTimeout(resolve,300));fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true})).toPNG());}
app.whenReady().then(async()=>{
 const win=await make('index.html',1320,880);
 await new Promise(resolve=>setTimeout(resolve,120));
 const bootMotion=await win.webContents.executeJavaScript(`document.getAnimations().filter(a=>a.playState==='running').map(a=>a.animationName||'')`);
 await shot(win,'boot-vortex');
 if(!bootMotion.includes('boot-stage')||!bootMotion.includes('boot-bar'))throw new Error('Startup animation did not play: '+bootMotion);
 await new Promise(resolve=>setTimeout(resolve,1400));await win.webContents.executeJavaScript(`tab('jam')`);await shot(win,'01-empty-queue');
 state={...state,queue:{...state.queue,items:fixtures.map(([videoId,title,artist],index)=>({id:String(index+1),videoId,title,artist,current:index===0}))}};
 await win.webContents.executeJavaScript(`render(${JSON.stringify(state)})`);await shot(win,'02-queue');
 await win.webContents.executeJavaScript(`tab('invite')`);await shot(win,'03-invite');
 await win.webContents.executeJavaScript(`document.querySelector('#room-start').click()`);await new Promise(resolve=>setTimeout(resolve,400));await shot(win,'04-share-qr');
 await win.webContents.executeJavaScript(`tab('settings')`);await shot(win,'05-settings');
 win.setSize(860,700);await shot(win,'06-settings-small');
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
 for(const [width,height] of [[1163,774],[1163,700],[860,620],[1320,620],[960,650]]){
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
    if(!result.searchClickable||!result.startVisible||result.search.top<result.stage.top-1||result.stage.bottom>result.dock.top||result.focused==='artwork'&&(result.art.top<result.search.bottom||result.art.bottom>result.stage.bottom))geometryFailures.push({width,height,empty,value,result});
   }
  }
 }
 if(geometryFailures.length)throw new Error('Short-window clipping: '+JSON.stringify(geometryFailures));
 win.setSize(1163,774);await win.webContents.executeJavaScript(`render({...${JSON.stringify(state)},queue:{...${JSON.stringify(state.queue)},items:[]}});window.listening.panels({lyrics:'side',queue:'side'},false)`);await shot(win,'empty-short-fixed');
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
 if(!tv.stage||!tv.dock||!tv.disabled)throw new Error('TV overlaps local stage');
 await shot(win,'tv-exclusive');await win.webContents.executeJavaScript(`window.listening.mode('music')`);
 await win.webContents.executeJavaScript(`document.querySelector('#stage-search').click();document.querySelector('#stage-query').value='test';document.querySelector('#stage-search-form').requestSubmit()`);await shot(win,'search-dialog');
 const searchCount=await win.webContents.executeJavaScript(`document.querySelectorAll('.search-result').length`);if(searchCount!==3)throw new Error('Search missing results');

 await win.webContents.executeJavaScript(`document.querySelector('#search-dialog').close();document.dispatchEvent(new KeyboardEvent('keydown',{key:'л',code:'KeyK',ctrlKey:true,bubbles:true}))`);
 if(!await win.webContents.executeJavaScript(`document.querySelector('#search-dialog').open`))throw new Error('Russian Ctrl K failed');
 await win.webContents.executeJavaScript(`document.querySelector('#search-dialog').close();window.listening.panels({lyrics:'hidden',queue:'side'},false);document.querySelector('#vinyl-mode').checked=true;document.querySelector('#vinyl-mode').dispatchEvent(new Event('change'));window.listening.render({...${JSON.stringify(state.queue)},clock:{...${JSON.stringify(state.queue.clock)},playing:true}})`);
 await new Promise(resolve=>setTimeout(resolve,800));await shot(win,'vinyl');
 const spinning=await win.webContents.executeJavaScript(`({round:document.body.classList.contains('vinyl'),label:document.body.classList.contains('vinyl-paper'),rate:document.querySelector('#record-spin').getAnimations()[0]?.playbackRate})`);
 if(!spinning.round||!spinning.label||!spinning.rate)throw new Error('Vinyl failed '+JSON.stringify(spinning));
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
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('UI_REVIEW_OK',JSON.stringify({screenshots:25,resizeCases:cases,toolbar:header,lyrics:lyricState,motion,bootMotion}));
 app.exit(0);
}).catch(error=>{console.error('UI_REVIEW_FAILED',error.stack);app.exit(1);});
