const { ipcRenderer } = require('electron');
window.addEventListener('jamstorm-tv-exit',()=>{if(location.hostname==='www.youtube.com'&&location.pathname==='/tv')ipcRenderer.send('player:tv-exit');});
// Keep catalog cards below the fixed header without changing YouTube's player
// geometry or its document scroll/history. A paint clip extends beyond the
// small, overflow-visible #content box used by the current site layout.
let clipFrame=0,lastClip='',appliedClip='',clippedContent=null;
const clipResize=new ResizeObserver(scheduleClip),clipMutation=new MutationObserver(scheduleClip);
function updateHeaderClip(){
 clipFrame=0;if(location.hostname!=='music.youtube.com')return;
 const content=document.querySelector('#content'),nav=document.querySelector('ytmusic-nav-bar');if(!content||!nav)return;
 const height=document.fullscreenElement||getComputedStyle(nav).visibility==='hidden'?0:nav.getBoundingClientRect().height;
 const edge=Math.max(0,Math.ceil(height-content.getBoundingClientRect().top));
 const clip=height?`polygon(-100vw ${edge}px,200vw ${edge}px,200vw 100000px,-100vw 100000px)`:'none';
 if(content!==clippedContent){clipResize.disconnect();clipMutation.disconnect();for(const node of [content,nav]){clipResize.observe(node);clipMutation.observe(node,{attributes:true,attributeFilter:['style','class']});}}
 if(content!==clippedContent||clip!==lastClip||content.style.clipPath!==appliedClip){content.style.clipPath=clip;clippedContent=content;lastClip=clip;appliedClip=content.style.clipPath;}
}
function scheduleClip(){if(!clipFrame)clipFrame=requestAnimationFrame(updateHeaderClip);}
document.addEventListener('DOMContentLoaded',scheduleClip);window.addEventListener('scroll',scheduleClip,{passive:true,capture:true});window.addEventListener('resize',scheduleClip);document.addEventListener('fullscreenchange',scheduleClip);setInterval(scheduleClip,1000);
// No privileged API is exposed to YouTube Music or Google sign-in pages.
const advertised = new WeakMap();
for (const name of ['playing','timeupdate']) document.addEventListener(name,event=>{if(event.target instanceof HTMLMediaElement) advertised.set(event.target,!!document.querySelector('.html5-video-player.ad-showing'));},true);
document.addEventListener('ended', event => {
  if (event.target instanceof HTMLMediaElement && !advertised.get(event.target) && !document.querySelector('.html5-video-player.ad-showing') && ['https://music.youtube.com', 'https://www.youtube.com'].includes(location.origin)) ipcRenderer.send('player:ended');
}, true);

// Analyse an independent capture of an existing same-origin MediaSource stream.
// It is never connected to speakers and never replaces the player's audio path.
let visualsEnabled=false,analysis=null,pendingAnalysis=null,analysisBusy=false,analysisEpoch=0,navigationHold=false,analysisClosing=Promise.resolve();
function stopAnalysis(){analysisEpoch++;const old=analysis||pendingAnalysis;analysis=pendingAnalysis=null;if(!old)return analysisClosing;old.stream.getTracks().forEach(track=>track.stop());analysisClosing=Promise.all([analysisClosing,old.context.close().catch(()=>{})]);return analysisClosing;}
ipcRenderer.on('visual:enabled',(_event,value)=>{visualsEnabled=!!value;if(visualsEnabled&&!document.querySelector('.jamstorm-ambient')){const light=document.createElement('div');light.className='jamstorm-ambient';document.body?.prepend(light);}if(!visualsEnabled)stopAnalysis();});
async function startAnalysis(video){
 if(analysis||analysisBusy||navigationHold||!visualsEnabled||video.paused||!video.isConnected||typeof video.captureStream!=='function'||!video.currentSrc.startsWith('blob:'+location.origin+'/'))return;
 analysisBusy=true;
 const epoch=analysisEpoch;
 let stream,context;
 try{
  stream=video.captureStream();stream.getVideoTracks().forEach(track=>track.stop());if(!stream.getAudioTracks().length){stream.getTracks().forEach(track=>track.stop());return;}
  context=new AudioContext();pendingAnalysis={stream,context};await context.resume();if(!visualsEnabled||navigationHold||epoch!==analysisEpoch||!video.isConnected){stream.getTracks().forEach(track=>track.stop());context.close().catch(()=>{});return;}const analyser=context.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.75;
  context.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(analyser);
  analysis={video,stream,context,analyser,samples:new Uint8Array(analyser.frequencyBinCount)};
 }catch{stream?.getTracks().forEach(track=>track.stop());context?.close().catch(()=>{});}
 finally{if(pendingAnalysis?.context===context)pendingAnalysis=null;analysisBusy=false;}
}
setInterval(()=>{
 if(!visualsEnabled)return;
 const video=document.querySelector('video');if(!video||!video.isConnected){stopAnalysis();return;}if(analysis?.video!==video&&analysis)stopAnalysis();
 if(!analysis){startAnalysis(video);return;}
 let level=0;
 if(!video.paused){analysis.analyser.getByteFrequencyData(analysis.samples);level=Math.min(1,Math.sqrt(analysis.samples.slice(1,48).reduce((sum,value)=>sum+value*value,0)/47)/180);}
 ipcRenderer.send('player:level',level);
 if(analysis)ipcRenderer.send('player:spectrum',Array.from(analysis.samples.slice(1,49),value=>video.paused?0:value/255));
 const light=document.querySelector('.jamstorm-ambient');if(light)light.style.opacity=String(.38+level*.13);
},160);
window.addEventListener('pagehide',stopAnalysis);
for(const event of ['emptied','abort'])document.addEventListener(event,event=>{if(event.target===analysis?.video)stopAnalysis();},true);
ipcRenderer.on('player:prepare-navigation',async(_event,token)=>{navigationHold=true;await stopAnalysis();ipcRenderer.send('player:navigation-ready',token);setTimeout(()=>navigationHold=false,1200);});

// The Cast icon is present in the site even when this runtime has no Media Router.
document.addEventListener('click',event=>{if(event.composedPath().some(el=>el?.tagName==='YTMUSIC-CAST-BUTTON')){event.preventDefault();event.stopImmediatePropagation();ipcRenderer.send('player:cast');}},true);
// Pause before a TV stream can sound. The main process verifies the current
// video against Music's real E badge; playlist IDs are not evidence of safety.
let blockExplicit=true,gateTicket=0;
const generations=new WeakMap(),approved=new WeakMap(),wanted=new WeakSet();
const isTV=()=>location.hostname==='www.youtube.com'&&location.pathname==='/tv';
function authorizeTV(video){
 if(!isTV()||!blockExplicit||!(video instanceof HTMLMediaElement))return;
 const generation=generations.get(video)||0;if(approved.get(video)===generation)return;
 wanted.add(video);video.pause();const ticket=++gateTicket;
 ipcRenderer.invoke('player:authorize').then(result=>{
  if(ticket!==gateTicket||!video.isConnected||generation!==(generations.get(video)||0)||navigationHold||!blockExplicit)return;
  if(result?.allowed){if(result.videoId)document.documentElement.dataset.jamApprovedVideo=result.videoId;approved.set(video,generation);video.play().catch(()=>{});}else wanted.delete(video);
 }).catch(()=>wanted.delete(video));
}
document.addEventListener('play',event=>authorizeTV(event.target),true);
document.addEventListener('loadstart',event=>{if(event.target instanceof HTMLMediaElement){generations.set(event.target,(generations.get(event.target)||0)+1);approved.delete(event.target);gateTicket++;}},true);
document.addEventListener('loadedmetadata',event=>{if(wanted.has(event.target))authorizeTV(event.target);},true);
window.addEventListener('jamstorm-track-check',()=>{const video=document.querySelector('video');if(video){approved.delete(video);authorizeTV(video);}});
ipcRenderer.on('player:prepare-navigation',()=>{gateTicket++;});
ipcRenderer.on('filter:enabled',(_event,value)=>{blockExplicit=!!value;if(document.documentElement)document.documentElement.dataset.jamstormExplicit=value?'block':'allow';const video=document.querySelector('video');if(value&&video&&!video.paused)authorizeTV(video);});
