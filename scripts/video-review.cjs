'use strict';
// Local generated frames only. Never opens a window or produces audio.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.disableHardwareAcceleration();app.commandLine.appendSwitch('mute-audio');
app.setPath('userData',path.join(app.getPath('temp'),'jamstorm-video-review'));
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,focusable:false,width:2560,height:1080,backgroundColor:'#0b1018',webPreferences:{offscreen:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});
 win.webContents.setAudioMuted(true);
 const html='<!doctype html><html><body style="margin:0;background:#0b1018"><main style="padding:32px"><div id="original"><video muted autoplay playsinline></video><button id="native-control">Native controls</button></div></main></body></html>';
 await win.loadURL('data:text/html,'+encodeURIComponent(html));
 await win.webContents.executeJavaScript(`(async()=>{const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d');window.paintFrame=black=>{const gradient=ctx.createLinearGradient(0,0,960,540);gradient.addColorStop(0,'#132840');gradient.addColorStop(.5,'#b55a2f');gradient.addColorStop(1,'#d5b77d');ctx.fillStyle=black?'#000':gradient;ctx.fillRect(0,0,960,540);if(!black){ctx.fillStyle='#f5e6cb';ctx.beginPath();ctx.arc(640,160,72,0,Math.PI*2);ctx.fill();}window.localStream?.getVideoTracks()[0]?.requestFrame?.();};window.localStream=canvas.captureStream(1);window.paintFrame(false);const video=document.querySelector('video');video.srcObject=window.localStream;await video.play();})()`);
 await win.webContents.insertCSS(fs.readFileSync(path.join(__dirname,'../src/video-scene.css'),'utf8'),{cssOrigin:'user'});await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'../src/video-scene.js'),'utf8'));
 const output=path.join(__dirname,'../artifacts/video-review');fs.mkdirSync(output,{recursive:true});const cases=[];
 for(const [width,height] of [[2560,1080],[3440,1440],[1920,1080],[1320,880]]){
  win.setSize(width,height);await win.webContents.executeJavaScript(`window.__jamVideoScene.set({active:true,ambient:true,intensity:85,ultrawide:innerWidth/innerHeight>2.1,size:76})`);await new Promise(r=>setTimeout(r,300));
  const scene=await win.webContents.executeJavaScript(`(()=>{const video=document.querySelector('video'),r=video.getBoundingClientRect(),canvas=document.getElementById('jam-video-ambient');return {width:innerWidth,height:innerHeight,video:{width:r.width,height:r.height,x:r.x,y:r.y},canvas:canvas.width>0,controls:getComputedStyle(document.getElementById('native-control')).display};})()`);
  if(Math.abs(scene.video.width/scene.video.height-16/9)>.02||scene.video.x<-1||scene.video.y<-1||scene.controls!=='none'||!scene.canvas)throw Error('Video layout failed '+JSON.stringify(scene));
  fs.writeFileSync(path.join(output,width+'x'+height+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true})).toPNG());cases.push(scene);
 }
 win.setSize(2560,1080);await win.webContents.executeJavaScript(`window.paintFrame(true)`);await new Promise(r=>setTimeout(r,1200));
 const black=await win.webContents.executeJavaScript(`(()=>{const pixel=document.getElementById('jam-video-ambient').getContext('2d').getImageData(20,20,1,1).data;return [...pixel].slice(0,3).every(v=>v<5);})()`);if(!black)throw Error('Black video retains a colored ambient');
 fs.writeFileSync(path.join(output,'black-frame.png'),(await win.webContents.capturePage(undefined,{stayHidden:true})).toPNG());
 const restored=await win.webContents.executeJavaScript(`(()=>{window.__jamVideoScene.set({active:false});return !document.querySelector('[data-jam-video-path]')&&!document.getElementById('jam-video-ambient')&&getComputedStyle(document.getElementById('native-control')).display!=='none';})()`);if(!restored)throw Error('Native document did not restore');
 if(win.isVisible()||win.isFocused()||!win.webContents.isAudioMuted())throw Error('Review became visible or audible');
 console.log('VIDEO_REVIEW_OK',JSON.stringify({cases,black,restored,hidden:true,muted:true}));win.destroy();app.exit(0);
}).catch(error=>{console.error('VIDEO_REVIEW_FAILED',error.stack);app.exit(1);});
