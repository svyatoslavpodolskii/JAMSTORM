'use strict';
(() => {
 const frame=document.getElementById('cover-frame'),disc=document.getElementById('record-spin'),cover=document.getElementById('stage-cover');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let vinyl=localStorage.getItem('vinyl')==='on',paper=localStorage.getItem('vinyl-paper')!=='off',track='',sequence=0,changing=false,speed=0,rate=0,raf=0,last=0,motion=null;
 const rotation=disc.animate([{transform:'rotate(0)'},{transform:'rotate(360deg)'}],{duration:12000,iterations:Infinity});rotation.pause();
 function loop(now){const dt=Math.min(64,now-(last||now));last=now;speed+=(rate-speed)*(1-Math.exp(-dt/500));if(Math.abs(rate-speed)<.002)speed=rate;rotation.playbackRate=speed;if(speed>0&&rotation.playState!=='running')rotation.play();if(speed===0)rotation.pause();if(speed>0||rate>0)raf=requestAnimationFrame(loop);else{raf=0;last=0;}}
 function target(value){rate=vinyl&&!reduced&&!changing?value:0;if(!raf&&rate!==speed)raf=requestAnimationFrame(loop);}
 function appearance(){if(!vinyl){cancelAnimationFrame(raf);raf=0;speed=rate=0;rotation.pause();rotation.currentTime=0;}document.body.classList.toggle('vinyl',vinyl);document.body.classList.toggle('vinyl-paper',paper);document.getElementById('vinyl-mode').checked=vinyl;document.getElementById('vinyl-paper').checked=paper;document.getElementById('vinyl-toggle').setAttribute('aria-pressed',String(vinyl));document.getElementById('paper-toggle').setAttribute('aria-pressed',String(paper));}
 function set(kind,value){if(kind==='vinyl'){vinyl=value;localStorage.setItem('vinyl',value?'on':'off');}else{paper=value;localStorage.setItem('vinyl-paper',value?'on':'off');}appearance();}
 document.getElementById('vinyl-mode').onchange=event=>set('vinyl',event.target.checked);
 document.getElementById('vinyl-paper').onchange=event=>set('paper',event.target.checked);
 document.getElementById('vinyl-toggle').onclick=()=>set('vinyl',!vinyl);document.getElementById('paper-toggle').onclick=()=>set('paper',!paper);
 async function update(item,clock,setImage){
  if((item?.videoId||'')!==track){
   const previous=track;track=item?.videoId||'';const generation=++sequence;changing=true;target(0);motion?.cancel();
   if(previous&&!reduced){motion=frame.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(18px) scale(.94)'}],{duration:280,easing:'ease-in-out',fill:'forwards'});await motion.finished.catch(()=>{});}
   if(generation!==sequence)return;
   setImage(item);document.body.classList.toggle('has-track',!!item?.videoId);window.dispatchEvent(new CustomEvent('artwork-change',{detail:item}));await Promise.race([cover.decode().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,1500))]);if(generation!==sequence)return;
   motion?.cancel();if(!reduced)motion=frame.animate([{opacity:0,transform:'translateY(-12px) scale(.96)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:520,easing:'cubic-bezier(.23,1,.32,1)'});
   changing=false;
  }
  tick(clock.position,clock.duration,clock.playing);
 }
 function tick(position,duration,playing){document.body.classList.toggle("playback-paused",!playing);const remaining=duration?duration-position:10000;target(playing?Math.max(0,Math.min(1,remaining/4500)):0);}
 const ambient=document.getElementById('ambient-light'),pulse=document.createElement('div');pulse.className='ambient-pulse';ambient.append(pulse);let color='';
 function setAmbient(rgb){if(!Array.isArray(rgb)||rgb.length!==3||rgb.some(n=>!Number.isInteger(n)||n<0||n>255))return;const next=rgb.join(' ');if(next===color)return;color=next;document.body.style.setProperty('--ambient',next);document.body.style.setProperty('--accent',`rgb(${next})`);const layer=document.createElement('div');layer.className='ambient-color';layer.style.background=`radial-gradient(ellipse at 25% 18%,rgb(${next} / .8),transparent 64%),radial-gradient(ellipse at 85% 90%,rgb(${next} / .5),transparent 62%)`;for(const old of ambient.querySelectorAll('.ambient-color')){old.animate([{opacity:1},{opacity:0}],{duration:1100,fill:'forwards'}).finished.then(()=>old.remove()).catch(()=>{});}ambient.append(layer);if(!reduced)layer.animate([{opacity:0},{opacity:1}],{duration:1100,easing:'ease-in-out'});}
 appearance();setAmbient([190,195,202]);window.playerEffects={update,tick,ambient:setAmbient,level:value=>{pulse.style.opacity=String(.05+Math.max(0,Math.min(1,value))*.24);pulse.style.transform='scale('+(1+value*.05)+')';}};
})();
