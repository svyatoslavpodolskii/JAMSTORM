'use strict';
(() => {
 const root=document.body,system=matchMedia('(prefers-color-scheme: light)');
 const defaults={theme:'dark',background:'ambient',palette:'album',motion:65,opacity:65,grain:0,lyrics:'soft',visualizer:'trail',dock:'auto'};
 let saved={};try{saved=JSON.parse(localStorage.getItem('appearance')||'{}')||{};}catch{}
 const prefs={...defaults,...saved};
 const options={theme:['dark','light','system'],background:['ambient','artwork','plain'],palette:['album','mono','noir'],lyrics:['none','soft','mist','prism','particles'],visualizer:['none','trail','wave','spectrum','orbit'],dock:['always','auto']};
 for(const [key,values] of Object.entries(options))if(!values.includes(prefs[key]))prefs[key]=defaults[key];
 for(const key of ['opacity','grain','motion'])prefs[key]=Number.isFinite(Number(prefs[key]))?Math.max(0,Math.min(100,Number(prefs[key]))):defaults[key];
 function apply(){
  root.dataset.theme=prefs.theme==='system'?(system.matches?'light':'dark'):prefs.theme;
  root.dataset.background=prefs.background;
  for(const key of ['palette','lyrics','visualizer','dock'])root.dataset[key]=prefs[key];
  root.style.setProperty('--motion-duration',(40-prefs.motion*.28)+'s');root.classList.toggle('still-background',prefs.motion===0);
  root.style.setProperty('--window-opacity',String(1-prefs.opacity/100));
  root.style.setProperty('--grain',String(prefs.grain/100*.16));
  document.getElementById('opacity-value').value=prefs.opacity+'%';
  document.getElementById('grain-value').value=prefs.grain+'%';
  document.getElementById('motion-value').value=prefs.motion+'%';
 }
 for(const key of Object.keys(defaults)){const input=document.getElementById('appearance-'+key);input.value=prefs[key];input.addEventListener('input',()=>{prefs[key]=input.type==='range'?Number(input.value):input.value;localStorage.setItem('appearance',JSON.stringify(prefs));apply();});}
 const picture=document.createElement('div');picture.className='floating-artwork';picture.setAttribute('aria-hidden','true');document.getElementById('ambient-light').append(picture);
 window.addEventListener('artwork-change',event=>{const item=event.detail;picture.style.backgroundImage=item?.videoId?'url("'+window.artwork.cover(item)+'")':'none';});
 system.addEventListener('change',apply);apply();
 document.getElementById('appearance-popover').addEventListener('toggle',event=>window.jam.appearance(event.newState==='open').catch(()=>{}));
 window.jam.frame().then(result=>{if(result.ok)root.classList.toggle('unified-frame',result.value.overlay);}).catch(()=>{});
})();
