'use strict';
(()=>{
 const body=document.body,popover=document.getElementById('appearance-popover'),pane=document.querySelector('.artwork-pane');
 let settings={enabled:false,followCatalog:true,ambient:true,intensity:75,size:76},last='',pending=0;
 const button=document.createElement('button');button.id='dock-video';button.className='stage-icon';button.innerHTML='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/></svg>';document.querySelector('.dock-actions').prepend(button);
 const options=document.createElement('div');options.innerHTML='<label>Видео в плеере<input id="video-enabled" type="checkbox" role="switch"></label><label>Открывать из каталога<input id="video-follow" type="checkbox" role="switch"></label><label>Ambient видео<input id="video-ambient" type="checkbox" role="switch"></label><label>Свечение видео <output id="video-intensity-value"></output><input id="video-intensity" type="range" min="0" max="100"></label>';options.insertAdjacentHTML('beforeend','<label>\u0420\u0430\u0437\u043c\u0435\u0440 \u0432\u0438\u0434\u0435\u043e 21:9 <output id="video-size-value"></output><input id="video-size" type="range" min="55" max="100"></label>');popover.append(options);
 const controls=[['video-enabled','enabled'],['video-follow','followCatalog'],['video-ambient','ambient'],['video-intensity','intensity'],['video-size','size']];
 function render(){for(const [id,key] of controls){const input=document.getElementById(id);if(input.type==='checkbox')input.checked=settings[key];else input.value=settings[key];}document.getElementById('video-size-value').value=settings.size+'%';document.getElementById('video-intensity-value').value=settings.intensity+'%';button.setAttribute('aria-pressed',String(settings.enabled));button.title=settings.enabled?'Показать обложку':'Показать видео';button.setAttribute('aria-label',button.title);schedule();}
 async function set(patch){try{const value=await window.jam.video(patch);if(!value.ok)throw Error(value.error);settings=value.value;render();}catch(error){if(typeof message==='function')message(error.message);}}
 function update(){pending=0;const r=pane.getBoundingClientRect(),remote=body.classList.contains('remote-playback'),unavailable=body.classList.contains('video-unavailable'),active=settings.enabled&&!remote&&!unavailable&&body.classList.contains('listening-view')&&body.classList.contains('has-track')&&document.getElementById('listening-stage').dataset.focus==='artwork'&&r.width>0;
  button.title=unavailable?(settings.enabled?'Видео недоступно · используется обложка':'Включать видео, когда оно доступно'):(settings.enabled?'Показать обложку':'Показать видео');button.setAttribute('aria-label',button.title);
  body.classList.toggle('video-view-active',active);button.disabled=remote||!body.classList.contains('has-track');const value={active,bounds:{x:r.x,y:r.y,width:r.width,height:r.height}},key=JSON.stringify(value);if(key===last)return;last=key;window.jam.videoLayout(value).then(()=>window.dispatchEvent(new Event('appearance-surface-change'))).catch(()=>{});
 }
 function schedule(){if(!pending){pending=1;queueMicrotask(update);}}
 button.onclick=()=>set({enabled:!settings.enabled});
 for(const [id,key] of controls)document.getElementById(id).addEventListener('input',event=>set({[key]:event.target.type==='checkbox'?event.target.checked:Number(event.target.value)}));
 new ResizeObserver(schedule).observe(pane);new MutationObserver(schedule).observe(body,{attributes:true,attributeFilter:['class']});new MutationObserver(schedule).observe(document.getElementById('listening-stage'),{attributes:true});window.addEventListener('resize',schedule);
 window.jam.onTabChanged(value=>{if(typeof tab==='function')tab(value).catch(()=>{});});
 window.jam.onVideo(value=>{settings=value;render();});
 window.jam.video().then(value=>{if(value.ok){settings=value.value;render();}}).catch(()=>{});render();
})();
