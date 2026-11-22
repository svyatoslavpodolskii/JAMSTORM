'use strict';
(()=>{
 if(window.__jamVideoScene)return;
 let settings={active:false,ambient:true,intensity:75,size:76,ultrawide:false},canvas=null,video=null,frame=0,last=0,path=[];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function clearPath(){for(const node of path)node.removeAttribute('data-jam-video-path');path=[];}
 function refresh(){
  const next=document.querySelector('video');if(next!==video||video&&!path.includes(video.parentElement)){clearPath();video=next;}
  if(video&&!path.length){let node=video.parentElement;while(node&&node!==document.documentElement){node.setAttribute('data-jam-video-path','');path.push(node);node=node.parentElement;}}
  if(!canvas){canvas=document.createElement('canvas');canvas.id='jam-video-ambient';canvas.setAttribute('aria-hidden','true');document.documentElement.append(canvas);}
  canvas.style.opacity=settings.ambient&&settings.intensity>0?'1':'0';canvas.style.setProperty('--ambient-intensity',String(settings.intensity/100));
 }
 function draw(now){
  frame=0;if(!settings.active)return;refresh();
  if(video){const ratio=(video.videoWidth||16)/(video.videoHeight||9),scale=settings.ultrawide?settings.size/100:1,width=Math.min(innerWidth*scale,innerHeight*scale*ratio),height=width/ratio;video.style.setProperty('--jam-video-width',width+'px');video.style.setProperty('--jam-video-height',height+'px');canvas.style.setProperty('--fade-x',Math.max(1,(innerWidth-width)/2)+'px');canvas.style.setProperty('--fade-y',Math.max(1,(innerHeight-height)/2)+'px');video.style.setProperty('--jam-video-mask-x',width<innerWidth-2?'linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)':'linear-gradient(#000,#000)');video.style.setProperty('--jam-video-mask-y',height<innerHeight-2?'linear-gradient(180deg,transparent,#000 6%,#000 94%,transparent)':'linear-gradient(#000,#000)');
   if(settings.ambient&&video.readyState>=2&&now-last>(reduced?1000:80)){
    last=now;const cw=Math.max(1,Math.round(innerWidth/8)),ch=Math.max(1,Math.round(innerHeight/8));if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
    const ctx=canvas.getContext('2d',{alpha:false}),dw=width/innerWidth*cw,dh=height/innerHeight*ch,dx=(cw-dw)/2,dy=(ch-dh)/2,sw=video.videoWidth,sh=video.videoHeight,slice=1;
    try{
     ctx.drawImage(video,0,0,sw,sh,dx,dy,dw,dh);
     if(dx>0){ctx.drawImage(video,0,0,slice,sh,0,dy,dx+.5,dh);ctx.drawImage(video,sw-slice,0,slice,sh,dx+dw-.5,dy,cw-dx-dw+.5,dh);}
     if(dy>0){ctx.drawImage(canvas,0,Math.min(ch-1,Math.ceil(dy)),cw,1,0,0,cw,dy+1);ctx.drawImage(canvas,0,Math.max(0,Math.floor(dy+dh)-1),cw,1,0,dy+dh-1,cw,ch-dy-dh+1);}
    }catch{}
   }
  }
  if(!video||!video.paused)frame=requestAnimationFrame(draw);
 }
 function set(value){settings={...settings,...value};if(settings.active)refresh();document.documentElement.dataset.jamVideoScene=settings.active?'on':'off';if(settings.active){if(!frame)draw(performance.now());}else{cancelAnimationFrame(frame);frame=0;clearPath();canvas?.remove();canvas=null;video=null;}}
 window.__jamVideoScene={set};
 const wake=()=>{if(settings.active&&!frame)draw(performance.now());};
 for(const name of ['playing','seeked','loadeddata','loadedmetadata'])document.addEventListener(name,wake,true);
 window.addEventListener('resize',wake);
 window.addEventListener('pagehide',()=>set({active:false}),{once:true});
})();
