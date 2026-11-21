'use strict';
(() => {
 const $=id=>document.getElementById(id),body=document.body,reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const search=$('stage-search');document.querySelector('.topbar').insertBefore(search,document.querySelector('.toolbar-spacer'));search.querySelector('span').textContent='Поиск';search.title='Поиск · Ctrl K';
 const dock=$('playback-dock'),reveal=document.createElement('button');reveal.id='dock-reveal';reveal.className='dock-reveal';reveal.setAttribute('aria-label','Показать плеер');reveal.title='Показать плеер';reveal.innerHTML='<span></span>';body.append(reveal);
 let hideTimer,showUntil=0;
 function show(){showUntil=performance.now()+2400;body.classList.remove('dock-collapsed');schedule();}
 function schedule(){clearTimeout(hideTimer);if(body.dataset.dock==='auto')hideTimer=setTimeout(()=>{if(!dock.matches(':hover,:focus-within')&&performance.now()>=showUntil)body.classList.add('dock-collapsed');else schedule();},2600);else body.classList.remove('dock-collapsed');}
 reveal.onpointerenter=show;reveal.onclick=show;dock.addEventListener('pointerenter',show);dock.addEventListener('pointerleave',schedule);dock.addEventListener('focusin',show);dock.addEventListener('focusout',schedule);
 document.addEventListener('pointermove',event=>{if(event.clientY>innerHeight-35&&body.classList.contains('listening-view'))show();},{passive:true});
 document.addEventListener('click',event=>{if(body.dataset.dock==='auto'&&body.classList.contains('listening-view')&&!event.target.closest('button,input,select,a,summary,dialog,[popover],.stage-pane,.playback-dock,.topbar,.fullscreen-nav')){if(body.classList.contains('dock-collapsed'))show();else body.classList.add('dock-collapsed');}});
 document.addEventListener('keydown',event=>{if(event.key==='Tab')show();});
 const canvas=document.createElement('canvas');canvas.className='immersion-canvas';canvas.setAttribute('aria-hidden','true');body.append(canvas);const ctx=canvas.getContext('2d');
 let w=0,h=0,dpr=1,frame=0,last=0,level=0,targetLevel=0,lastSound=0,spectrum=Array(48).fill(0),history=Array(400).fill(null),particles=[];
 function resize(){dpr=Math.min(1.5,devicePixelRatio||1);w=innerWidth;h=innerHeight;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);wake();}
 function wake(){if(!frame&&!document.hidden)frame=requestAnimationFrame(draw);}
 function receive(values){
  if(!Array.isArray(values)||values.length!==48)return;spectrum=values;targetLevel=Math.sqrt(values.reduce((n,v)=>n+v*v,0)/48);lastSound=performance.now();
  if(!body.classList.contains('playback-paused')&&targetLevel>.002){const position=Number($('dock-seek').value)/1000,index=Math.min(399,Math.floor(position*400));history[index]=Math.max(history[index]||0,targetLevel);}
  wake();
 }
 window.jam.onSpectrum(receive);
 window.addEventListener('artwork-change',()=>{history=Array(400).fill(null);particles=[];wake();});
 function burst(line){
  if(!line)return;const r=line.getBoundingClientRect();if(!r.width||r.bottom<0||r.top>h)return;
  const style=getComputedStyle(line),sample=document.createElement('canvas'),scale=Math.min(1,1000/r.width);sample.width=Math.ceil(r.width*scale);sample.height=Math.ceil(r.height*scale);const c=sample.getContext('2d');c.scale(scale,scale);c.font=style.font;c.fillStyle='#fff';c.textAlign=style.textAlign==='center'?'center':'left';c.textBaseline='top';
  const padding=parseFloat(style.paddingLeft)||0,available=r.width-padding*2,words=line.textContent.split(/\s+/);let rows=[],row='';for(const word of words){const next=row?row+' '+word:word;if(c.measureText(next).width>available&&row){rows.push(row);row=word;}else row=next;}if(row)rows.push(row);
  const lineHeight=parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.3;rows.forEach((text,i)=>c.fillText(text,c.textAlign==='center'?r.width/2:padding,(parseFloat(style.paddingTop)||0)+i*lineHeight));
  const pixels=c.getImageData(0,0,sample.width,sample.height).data,candidates=[];for(let y=0;y<sample.height;y+=5)for(let x=0;x<sample.width;x+=5)if(pixels[(y*sample.width+x)*4+3]>90)candidates.push([x/scale,y/scale]);
  const step=Math.max(1,Math.ceil(candidates.length/180));for(let i=0;i<candidates.length;i+=step){const [x,y]=candidates[i];particles.push({x:r.left+x,y:r.top+y,vx:(Math.random()-.5)*48,vy:-12-Math.random()*35,birth:performance.now(),life:650+Math.random()*550,size:.6+Math.random()*1.4});}particles=particles.slice(-350);wake();
 }
 window.addEventListener('lyric-change',event=>{
  if(reduced.matches||body.dataset.lyrics==='none')return;const {previous,current}=event.detail,kind=body.dataset.lyrics||'soft';
  if(kind==='particles')burst(previous);
  if(current&&kind!=='soft')current.animate(kind==='prism'?[{opacity:.15,filter:'blur(5px)',transform:'translateY(7px) skewX(-3deg)'},{opacity:1,filter:'blur(0)',transform:'none'}]:[{opacity:.35,filter:'blur(7px)',transform:'translateY(9px)'},{opacity:1,filter:'blur(0)',transform:'none'}],{duration:kind==='particles'?850:650,easing:'cubic-bezier(.16,1,.3,1)'});
  if(previous&&kind==='prism'){
   const r=previous.getBoundingClientRect();for(let i=0;i<5;i++){const shard=previous.cloneNode(true);shard.className='lyric-shard';Object.assign(shard.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',font:getComputedStyle(previous).font,textAlign:getComputedStyle(previous).textAlign,padding:getComputedStyle(previous).padding,clipPath:`inset(${i*20}% 0 ${80-i*20}% 0)`});shard.setAttribute('aria-hidden','true');shard.inert=true;body.append(shard);shard.animate([{opacity:.5,transform:'none'},{opacity:0,transform:`translate(${(i-2)*15}px,${(i-2)*9}px)`,filter:'blur(6px)'}],{duration:600,easing:'ease-out'}).finished.finally(()=>shard.remove());}
  }
 });
 function draw(now){
  const ink=body.dataset.theme==='light'?'45,65,85':'224,235,246';frame=0;if(now-last<30){wake();return;}last=now;ctx.clearRect(0,0,w,h);const playing=!body.classList.contains('playback-paused'),mode=body.dataset.visualizer||'trail',visible=body.classList.contains('listening-view'),active=visible&&playing&&now-lastSound<1200&&!reduced.matches;
  level+=(active?targetLevel-level:-level)*.2;
  if(visible&&mode!=='none'){
   const seek=$('dock-seek'),r=seek.getBoundingClientRect(),progress=Number(seek.value)/1000;ctx.strokeStyle=`rgba(${ink},.55)`;ctx.fillStyle=`rgba(${ink},.5)`;ctx.lineWidth=1;
   if(mode==='trail'&&r.width&&getComputedStyle(dock).opacity!=='0'){
    const y=r.top+r.height/2;for(let i=0;i<history.length;i++){if(history[i]===null||i/400>progress)continue;const x=r.left+i/400*r.width,bar=2+history[i]*23;ctx.fillStyle=`rgba(${ink},${.14+history[i]*.55})`;ctx.fillRect(x,y-bar/2,Math.max(1,r.width/400*.62),bar);}
    if(active){const x=r.left+progress*r.width,glow=ctx.createRadialGradient(x,y,1,x,y,15+level*15);glow.addColorStop(0,`rgba(${ink},.65)`);glow.addColorStop(1,`rgba(${ink},0)`);ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,15+level*15,0,Math.PI*2);ctx.fill();}
   }else if(active){
    const art=$('cover-frame').getBoundingClientRect(),stage=$('listening-stage').getBoundingClientRect(),center=art.width?art.left+art.width/2:w/2;
    if(mode==='orbit'&&art.width){for(let i=0;i<72;i++){const angle=i/72*Math.PI*2+now/15000,value=spectrum[i%48],radius=art.width*.54+value*16;ctx.globalAlpha=.12+value*.6;ctx.beginPath();ctx.arc(center+Math.cos(angle)*radius,art.top+art.height/2+Math.sin(angle)*radius,.7+value*1.8,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
    else{const width=Math.min(600,w*.65),left=center-width/2,y=stage.bottom-18;ctx.beginPath();for(let i=0;i<96;i++){const x=left+i/95*width,value=spectrum[Math.floor(i/2)]||0,amplitude=value*Math.sin(i/95*Math.PI)*22;
     if(mode==='spectrum'){ctx.moveTo(x,y-amplitude);ctx.lineTo(x,y+amplitude);}else{const dy=Math.sin(i*.17+now/700)*amplitude;if(i===0)ctx.moveTo(x,y+dy);else ctx.lineTo(x,y+dy);}}
     ctx.shadowColor=`rgba(${ink},.45)`;ctx.shadowBlur=12;ctx.stroke();ctx.shadowBlur=0;
    }
   }
  }
  particles=particles.filter(p=>now-p.birth<p.life);for(const p of particles){const t=(now-p.birth)/1000,fade=1-(now-p.birth)/p.life;ctx.fillStyle=`rgba(${ink},${fade*.6})`;ctx.beginPath();ctx.arc(p.x+p.vx*t,p.y+p.vy*t,p.size*fade,0,Math.PI*2);ctx.fill();}
  if(active&&mode!=='none'||particles.length||level>.003)wake();
 }
 new MutationObserver(()=>{schedule();wake();}).observe(body,{attributes:true,attributeFilter:['data-dock','data-visualizer','data-lyrics']});
 new MutationObserver(wake).observe(body,{attributes:true,attributeFilter:['class']});
 window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(!document.hidden)wake();});resize();schedule();
 window.immersion={showDock:show,history:()=>history.filter(v=>v!==null).length};
})();
