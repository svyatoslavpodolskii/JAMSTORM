'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
const {JamSession}=require('../src/session.cjs'),{JamPlayer}=require('../src/player.cjs'),{BrowserRoom}=require('../src/room.cjs'),{Tunnel}=require('../src/tunnel.cjs');
app.disableHardwareAcceleration();let jam,room,tunnel;
app.whenReady().then(async()=>{
  const player=new JamPlayer({});player.sample=async()=>null;jam=new JamSession();await jam.host(c=>player.call(c));
  room=new BrowserRoom(jam,async q=>[{videoId:'abcdefghijk',title:'Проверка: '+q,artist:'JAMSTORM'}]);await room.start();
  const win=new BrowserWindow({width:390,height:844,show:false,webPreferences:{offscreen:true,sandbox:true,contextIsolation:true,nodeIntegration:false}});
  await win.loadURL(`http://127.0.0.1:${room.port}/#${room.token}`);await new Promise(r=>setTimeout(r,400));
  await win.webContents.executeJavaScript(`document.querySelector('#show-search').click();document.querySelector('#query').value='test';document.querySelector('#search').requestSubmit(document.querySelector('#search button'))`);
  await new Promise(r=>setTimeout(r,600));await win.webContents.executeJavaScript(`document.querySelector('#results button').click()`);await new Promise(r=>setTimeout(r,600));
  fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../artifacts/guest-search.png'),(await win.webContents.capturePage(undefined,{stayHidden:true})).toPNG());
  await win.webContents.executeJavaScript(`document.querySelector('#show-queue').click()`);await new Promise(resolve=>setTimeout(resolve,300));
  const result=await win.webContents.executeJavaScript(`({queue:document.querySelector('#queue').textContent,error:document.querySelector('#error').textContent,overflow:document.documentElement.scrollWidth>innerWidth,node:typeof require})`);
  if(!result.queue.includes('Проверка: test')||result.error||result.overflow||result.node!=='undefined')throw new Error('Guest browser failed: '+JSON.stringify(result));
  fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../artifacts/guest-mobile.png'),(await win.webContents.capturePage(undefined,{stayHidden:true})).toPNG());
  console.log('GUEST_BROWSER_OK');
  if(process.argv.includes('--internet')){
    for(const key of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'])if(process.env[key]?.includes('127.0.0.1:9'))delete process.env[key];
    tunnel=new Tunnel(path.join(__dirname,'../vendor/cloudflared.exe'));const started=tunnel.start(room.port);tunnel.child.stderr.on('data',chunk=>{const text=String(chunk);if(text.includes('ERR'))console.log('Tunnel diagnostic:',text.slice(-1200));});const url=await started;console.log('Tunnel hostname:',new URL(url).hostname);let ok=false;
    for(let attempt=0;attempt<15;attempt++){try{const response=await fetch(url+'/api/state',{headers:{Authorization:'Bearer '+room.token},signal:AbortSignal.timeout(8000)});if(response.ok&&(await response.json()).queue.items.length===1){ok=true;break;}console.log('Tunnel HTTP status',response.status);}catch(e){
      if(e.cause?.code==='ENOTFOUND'){
        const dns=await fetch('https://dns.google/resolve?type=A&name='+new URL(url).hostname).then(r=>r.json());const address=dns.Answer?.find(a=>a.type===1)?.data;
        if(address){const data=await new Promise((resolve,reject)=>{const request=require('node:https').get(url+'/api/state',{headers:{Authorization:'Bearer '+room.token},lookup:(_host,_opts,cb)=>cb(null,[{address,family:4}])},response=>{let body='';response.on('data',c=>body+=c);response.on('end',()=>response.statusCode===200?resolve(JSON.parse(body)):reject(new Error('HTTP '+response.statusCode)));});request.setTimeout(10000,()=>request.destroy(new Error('Timeout')));request.on('error',reject);});if(data.queue.items.length===1){console.log('SYSTEM_DNS_FILTER_DETECTED: public DNS verified; Windows settings unchanged');ok=true;break;}}
      }else console.log('Tunnel request:',e.cause?.code||e.name);
    }await new Promise(r=>setTimeout(r,1500));}
    if(!ok)throw new Error('Public HTTPS room unreachable');console.log('PUBLIC_HTTPS_ROOM_OK');
  }
  tunnel?.stop();room.stop();jam.disconnect();app.exit(0);
}).catch(e=>{console.error(e.message);tunnel?.stop();room?.stop();jam?.disconnect();app.exit(1);});
