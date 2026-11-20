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
 await win.webContents.executeJavaScript(`tab('music')`);const hidden=await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('main')).visibility==='hidden'`);if(!hidden)throw new Error('Local UI leaks through native transparent player');
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
 const lyric=await make('side-lyrics.html',340,640);await new Promise(resolve=>setTimeout(resolve,800));await shot(lyric,'08-lyrics-active');
 const lyricState=await lyric.webContents.executeJavaScript(`({lines:document.querySelectorAll('.line').length,active:document.querySelectorAll('.line.active').length})`);
 if(lyricState.lines!==14||lyricState.active!==1)throw new Error('Lyrics state failed: '+JSON.stringify(lyricState));
 const queue=await make('side.html',340,640);await new Promise(resolve=>setTimeout(resolve,500));await shot(queue,'09-queue-panel');
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('UI_REVIEW_OK',JSON.stringify({screenshots:9,toolbar:header,lyrics:lyricState}));
 app.exit(0);
}).catch(error=>{console.error('UI_REVIEW_FAILED',error.stack);app.exit(1);});
