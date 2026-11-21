const { ipcRenderer } = require('electron');
// No privileged API is exposed to YouTube Music or Google sign-in pages.
const advertised = new WeakMap();
for (const name of ['playing','timeupdate']) document.addEventListener(name,event=>{if(event.target instanceof HTMLMediaElement) advertised.set(event.target,!!document.querySelector('.html5-video-player.ad-showing'));},true);
document.addEventListener('ended', event => {
  if (event.target instanceof HTMLMediaElement && !advertised.get(event.target) && !document.querySelector('.html5-video-player.ad-showing') && ['https://music.youtube.com', 'https://www.youtube.com'].includes(location.origin)) ipcRenderer.send('player:ended');
}, true);

// Analyse an independent capture of an existing same-origin MediaSource stream.
// It is never connected to speakers and never replaces the player's audio path.
let visualsEnabled=false,analysis=null,analysisBusy=false;
function stopAnalysis(){if(!analysis)return;analysis.stream.getTracks().forEach(track=>track.stop());analysis.context.close().catch(()=>{});analysis=null;}
ipcRenderer.on('visual:enabled',(_event,value)=>{visualsEnabled=!!value;if(visualsEnabled&&!document.querySelector('.jamstorm-ambient')){const light=document.createElement('div');light.className='jamstorm-ambient';document.body?.prepend(light);}if(!visualsEnabled)stopAnalysis();});
async function startAnalysis(video){
 if(analysis||analysisBusy||!visualsEnabled||video.paused||typeof video.captureStream!=='function'||!video.currentSrc.startsWith('blob:'+location.origin+'/'))return;
 analysisBusy=true;
 let stream,context;
 try{
  stream=video.captureStream();stream.getVideoTracks().forEach(track=>track.stop());if(!stream.getAudioTracks().length){stream.getTracks().forEach(track=>track.stop());return;}
  context=new AudioContext();await context.resume();if(!visualsEnabled){stream.getTracks().forEach(track=>track.stop());context.close().catch(()=>{});return;}const analyser=context.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.75;
  context.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(analyser);
  analysis={video,stream,context,analyser,samples:new Uint8Array(analyser.frequencyBinCount)};
 }catch{stream?.getTracks().forEach(track=>track.stop());context?.close().catch(()=>{});}
 finally{analysisBusy=false;}
}
setInterval(()=>{
 if(!visualsEnabled)return;
 const video=document.querySelector('video');if(!video)return;if(analysis?.video!==video)stopAnalysis();
 if(!analysis){startAnalysis(video);return;}
 let level=0;
 if(!video.paused){analysis.analyser.getByteFrequencyData(analysis.samples);level=Math.min(1,Math.sqrt(analysis.samples.slice(1,48).reduce((sum,value)=>sum+value*value,0)/47)/180);}
 ipcRenderer.send('player:level',level);
 if(analysis)ipcRenderer.send('player:spectrum',Array.from(analysis.samples.slice(1,49),value=>video.paused?0:value/255));
 const light=document.querySelector('.jamstorm-ambient');if(light)light.style.opacity=String(.38+level*.13);
},160);
window.addEventListener('pagehide',stopAnalysis);

// The Cast icon is present in the site even when this runtime has no Media Router.
document.addEventListener('click',event=>{if(event.composedPath().some(el=>el?.tagName==='YTMUSIC-CAST-BUTTON')){event.preventDefault();event.stopImmediatePropagation();ipcRenderer.send('player:cast');}},true);
ipcRenderer.on('filter:enabled',(_event,value)=>{if(document.documentElement)document.documentElement.dataset.jamstormExplicit=value?'block':'allow';});
