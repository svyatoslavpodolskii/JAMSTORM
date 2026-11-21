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
handle('app:material',value=>({material:value,supported:true}));handle('app:visuals',()=>true);
handle('jam:state',()=>state);handle('app:queue',()=>state.queue);handle('app:panels',()=>panels);
handle('app:search',()=>fixtures.map(([videoId,title,artist])=>({videoId,title,artist})));handle('app:play-track',()=>state.queue);
handle('app:tab',()=>{});handle('app:panel',key=>(panels[key]=!panels[key],panels));
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
 await win.webContents.executeJavaScript(`tab('jam')`);await shot(win,'01-empty-queue');
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
  const geometry=await win.webContents.executeJavaScript(`(()=>{const art=document.querySelector('#stage-cover').getBoundingClientRect();return {width:art.width,height:art.height,right:art.right,left:art.left};})()`);
  if(Math.abs(geometry.width-geometry.height)>1||geometry.width>480||geometry.left<0||geometry.right>1320)throw new Error('Unbounded artwork '+JSON.stringify(geometry));
 }
 await win.webContents.executeJavaScript(`window.listening.panels({lyrics:true,queue:true},false)`);
 const lyricState=await win.webContents.executeJavaScript(`({lines:document.querySelectorAll('#stage-lines .lyric-line').length,active:document.querySelectorAll('#stage-lines .is-active').length})`);
 if(lyricState.lines!==14||lyricState.active!==1)throw new Error('Unified lyrics failed: '+JSON.stringify(lyricState));
 win.setSize(1920,1080);await shot(win,'stage-wide');
 win.setSize(860,700);await shot(win,'stage-small');
 const bounds=await win.webContents.executeJavaScript(`(()=>{const ids=['lyrics-pane','artwork-pane','queue-pane'];return ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,left:r.left,right:r.right,top:r.top,bottom:r.bottom};});})()`);
 if(bounds[0].right>bounds[1].left+1||bounds[1].right>bounds[2].left+1||bounds[2].right>860)throw new Error('Panels overlap: '+JSON.stringify(bounds));
 await win.webContents.executeJavaScript(`window.listening.mode('tv')`);const tv=await win.webContents.executeJavaScript(`({stage:document.querySelector('#listening-stage').hidden,dock:document.querySelector('#playback-dock').hidden,disabled:document.querySelector('#overlay-lyrics').disabled})`);
 if(!tv.stage||!tv.dock||!tv.disabled)throw new Error('TV overlaps local stage');
 await shot(win,'tv-exclusive');await win.webContents.executeJavaScript(`window.listening.mode('music')`);
 await win.webContents.executeJavaScript(`document.querySelector('#stage-search').click();document.querySelector('#stage-query').value='test';document.querySelector('#stage-search-form').requestSubmit()`);await shot(win,'search-dialog');
 const searchCount=await win.webContents.executeJavaScript(`document.querySelectorAll('.search-result').length`);if(searchCount!==3)throw new Error('Search missing results');
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('UI_REVIEW_OK',JSON.stringify({screenshots:15,toolbar:header,lyrics:lyricState}));
 app.exit(0);
}).catch(error=>{console.error('UI_REVIEW_FAILED',error.stack);app.exit(1);});
