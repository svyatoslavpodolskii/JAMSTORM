'use strict';
(()=>{
 if(window.__jamVideoScene)return;
 let settings={active:false,ambient:true,intensity:75,size:76,ultrawide:false},canvas=null,video=null,frame=0,last=0,path=[],shadow=null;
 const sourceFrame=document.createElement('canvas');
 let crop={left:0,right:0,top:0,bottom:0},candidateKey='',candidateFrames=0,canRead=true;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function clearPath(){for(const node of path)node.removeAttribute('data-jam-video-path');path=[];}
 function refresh(){
  const next=document.querySelector('video');if(next!==video||video&&!path.includes(video.parentElement)){clearPath();video=next;crop={left:0,right:0,top:0,bottom:0};candidateFrames=0;candidateKey='';canRead=true;}
  if(video&&!path.length){let node=video.parentElement;while(node&&node!==document.documentElement){node.setAttribute('data-jam-video-path','');path.push(node);node=node.parentElement;}}
  if(!canvas){canvas=document.createElement('canvas');canvas.id='jam-video-ambient';canvas.setAttribute('aria-hidden','true');}
  const parent=video?.parentElement||document.documentElement;if(canvas.parentElement!==parent)parent.append(canvas);
  if(!shadow&&window.JamAmbientShadow)shadow=new window.JamAmbientShadow(false);
  canvas.style.opacity=settings.ambient&&settings.intensity>0?'1':'0';canvas.style.setProperty('--ambient-intensity',String(settings.intensity/100));
 }
 function draw(now){
  frame=0;if(!settings.active)return;refresh();
  if(video){const ratio=(video.videoWidth||16)/(video.videoHeight||9),scale=settings.ultrawide?settings.size/100:1,width=Math.min(innerWidth*scale,innerHeight*scale*ratio),height=width/ratio;video.style.setProperty('--jam-video-width',width+'px');video.style.setProperty('--jam-video-height',height+'px');canvas.style.setProperty('--fade-x',Math.max(1,(innerWidth-width)/2)+'px');canvas.style.setProperty('--fade-y',Math.max(1,(innerHeight-height)/2)+'px');video.style.setProperty('--jam-video-mask-x',width<innerWidth-2?'linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)':'linear-gradient(#000,#000)');video.style.setProperty('--jam-video-mask-y',height<innerHeight-2?'linear-gradient(180deg,transparent,#000 6%,#000 94%,transparent)':'linear-gradient(#000,#000)');
   if(settings.ambient&&video.readyState>=2&&now-last>(reduced?1000:33)){
    last=now;const cw=Math.max(1,Math.round(innerWidth/6)),ch=Math.max(1,Math.round(innerHeight/6));if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
    const ctx=canvas.getContext('2d'),sw=video.videoWidth,sh=video.videoHeight;
    try{
     ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,cw,ch);
     const sourceHeight=Math.max(1,Math.round(320*sh/sw));if(sourceFrame.width!==320||sourceFrame.height!==sourceHeight){sourceFrame.width=320;sourceFrame.height=sourceHeight;}const sourceContext=sourceFrame.getContext('2d',{willReadFrequently:true});sourceContext.drawImage(video,0,0,sw,sh,0,0,320,sourceHeight);
     if(canRead&&window.JamVideoBars)try{const candidate=window.JamVideoBars.detect(sourceContext.getImageData(0,0,320,sourceHeight).data,320,sourceHeight);if(candidate){const key=JSON.stringify(candidate);candidateFrames=key===candidateKey?candidateFrames+1:1;candidateKey=key;if(candidateFrames>=4)crop=candidate;}}catch{canRead=false;candidateFrames=0;}
     const contentWidth=width*(1-crop.left-crop.right),contentHeight=height*(1-crop.top-crop.bottom),dw=contentWidth/innerWidth*cw,dh=contentHeight/innerHeight*ch,sx=320*crop.left,sy=sourceHeight*crop.top,sourceWidth=320*(1-crop.left-crop.right),croppedHeight=sourceHeight*(1-crop.top-crop.bottom);
     // Concentric projections preserve the nearest image near the video and
     // spread progressively wider samples into the surrounding light field.
     for(let layer=24;layer>=0;layer--){const t=layer/24,w=dw+(cw-dw)*t,h=dh+(ch-dh)*t;ctx.drawImage(sourceFrame,sx,sy,sourceWidth,croppedHeight,(cw-w)/2,(ch-h)/2,w,h);}
     if(shadow){shadow.rescale({x:innerWidth/contentWidth,y:innerHeight/contentHeight},{w:contentWidth,h:contentHeight},{spreadFadeCurve:50-settings.intensity*.2,spreadFadeStart:15,directionTopEnabled:true,directionRightEnabled:true,directionBottomEnabled:true,directionLeftEnabled:true});ctx.globalCompositeOperation='destination-out';ctx.drawImage(shadow.elem,0,0,cw,ch);ctx.globalCompositeOperation='source-over';}
    }catch{}
   }
  }
  if(video){if(crop.left||crop.right)video.style.setProperty('--jam-video-mask-x',`linear-gradient(90deg,transparent ${crop.left*100}%,#000 ${(crop.left+(1-crop.left-crop.right)*.05)*100}%,#000 ${(1-crop.right-(1-crop.left-crop.right)*.05)*100}%,transparent ${(1-crop.right)*100}%)`);if(crop.top||crop.bottom)video.style.setProperty('--jam-video-mask-y',`linear-gradient(180deg,transparent ${crop.top*100}%,#000 ${(crop.top+(1-crop.top-crop.bottom)*.06)*100}%,#000 ${(1-crop.bottom-(1-crop.top-crop.bottom)*.06)*100}%,transparent ${(1-crop.bottom)*100}%)`);}
  if(!video||!video.paused||candidateFrames>0&&candidateFrames<4)frame=requestAnimationFrame(draw);
 }
 function set(value){settings={...settings,...value};if(settings.active)refresh();document.documentElement.dataset.jamVideoScene=settings.active?'on':'off';if(settings.active){if(!frame)draw(performance.now());}else{cancelAnimationFrame(frame);frame=0;clearPath();canvas?.remove();canvas=null;video=null;}}
 window.__jamVideoScene={set,view:()=>({crop:{...crop}})};
 document.addEventListener('loadstart',event=>{if(event.target!==video)return;crop={left:0,right:0,top:0,bottom:0};candidateFrames=0;candidateKey='';canRead=true;},true);
 const wake=()=>{if(settings.active&&!frame)draw(performance.now());};
 for(const name of ['playing','seeked','loadeddata','loadedmetadata'])document.addEventListener(name,wake,true);
 window.addEventListener('resize',wake);
 window.addEventListener('pagehide',()=>set({active:false}),{once:true});
})();
