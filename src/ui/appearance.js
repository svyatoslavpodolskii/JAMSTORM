'use strict';
(() => {
 const root=document.body,system=matchMedia('(prefers-color-scheme: light)'),library=window.appearancePresets;
 const defaults=library.defaults,reduceGlass=matchMedia('(prefers-reduced-transparency: reduce)');
 let saved={};try{saved=JSON.parse(localStorage.getItem('appearance')||'{}')||{};}catch{}
 let prefs=library.normalize({...saved,glass:localStorage.getItem('glass')!=='off',material:localStorage.getItem('window-material')||saved.material||'acrylic'}),custom=library.readCustom(localStorage.getItem('appearance-custom')),selected=localStorage.getItem('appearance-preset')||'custom',syncTimer;
 let editId=selected.startsWith('user:')?selected:'';
 const options={layout:['airy','large'],theme:['dark','light','system'],background:['ambient','artwork','horizon','bloom','plain'],palette:['album','mono','noir'],lyrics:['none','soft','mist','prism','particles'],visualizer:['none','trail','wave','spectrum','orbit'],dock:['always','auto']};
 for(const [key,values] of Object.entries(options))if(!values.includes(prefs[key]))prefs[key]=defaults[key];
 for(const key of ['opacity','grain','motion'])prefs[key]=Number.isFinite(Number(prefs[key]))?Math.max(0,Math.min(100,Number(prefs[key]))):defaults[key];
 function apply(){
  root.dataset.theme=prefs.theme==='system'?(system.matches?'light':'dark'):prefs.theme;
  root.dataset.background=prefs.background;
  for(const key of ['layout','palette','lyrics','visualizer','dock'])root.dataset[key]=prefs[key];
  root.style.setProperty('--motion-duration',(40-prefs.motion*.28)+'s');root.classList.toggle('still-background',prefs.motion===0);
  root.style.setProperty('--window-opacity',String(root.classList.contains('glass')&&!reduceGlass.matches&&prefs.material!=='none'?1-prefs.opacity/100:1));
  root.dataset.translucent=String(root.classList.contains('glass')&&!reduceGlass.matches&&prefs.material!=='none'&&prefs.opacity>0);
  document.getElementById('appearance-opacity').disabled=!root.classList.contains('glass')||prefs.material==='none'||reduceGlass.matches;
  root.style.setProperty('--grain',String(prefs.grain/100*.16));
  document.getElementById('opacity-value').value=prefs.opacity+'%';
  document.getElementById('grain-value').value=prefs.grain+'%';
  document.getElementById('motion-value').value=prefs.motion+'%';
  clearTimeout(syncTimer);syncTimer=setTimeout(()=>window.jam.presentation({theme:root.dataset.theme,system:prefs.theme==='system',glass:root.classList.contains('glass')&&!reduceGlass.matches&&prefs.material!=='none',opacity:prefs.opacity}).catch(()=>{}),60);
 }
 function remember(){prefs.vinyl=document.getElementById('vinyl-mode').checked;prefs.paper=document.getElementById('vinyl-paper').checked;prefs.glass=root.classList.contains('glass');prefs.material=document.getElementById('window-material').value;localStorage.setItem('appearance',JSON.stringify(prefs));localStorage.setItem('appearance-preset',selected);}
 function list(){const select=document.getElementById('appearance-preset');select.replaceChildren();for(const group of [{name:'Готовые',rows:library.builtins},{name:'Мои',rows:custom}]){if(!group.rows.length)continue;const section=document.createElement('optgroup');section.label=group.name;for(const row of group.rows){const option=document.createElement('option');option.value=row.id;option.textContent=row.name;section.append(option);}select.append(section);}const edited=document.createElement('option');edited.value='custom';edited.textContent='Своя настройка';select.append(edited);select.value=selected;if(!select.value)select.value='custom';document.getElementById('preset-delete').disabled=!selected.startsWith('user:');}
 function edited(){selected='custom';list();remember();apply();}
 function controls(){for(const key of Object.keys(defaults)){const input=document.getElementById('appearance-'+key);if(input)input.value=prefs[key];}}
 for(const key of Object.keys(defaults)){const input=document.getElementById('appearance-'+key);if(!input)continue;input.addEventListener('input',()=>{prefs[key]=input.type==='range'?Number(input.value):input.value;edited();});}
 document.getElementById('appearance-preset').onchange=()=>{const row=[...library.builtins,...custom].find(row=>row.id===document.getElementById('appearance-preset').value);if(!row)return;const target=library.normalize(row.settings);prefs={...target};if(root.classList.contains('glass')!==target.glass)document.getElementById('glass').click();document.getElementById('window-material').value=target.material;document.getElementById('window-material').dispatchEvent(new Event('change'));selected=row.id;editId=row.id.startsWith('user:')?row.id:'';for(const [key,id] of [['vinyl','vinyl-mode'],['paper','vinyl-paper']]){const input=document.getElementById(id);if(input.checked!==target[key]){input.checked=target[key];input.dispatchEvent(new Event('change'));}}prefs=target;controls();list();remember();apply();document.getElementById('preset-name').value=row.id.startsWith('user:')?row.name:'';document.getElementById('preset-status').textContent='';};
 document.getElementById('preset-save').onclick=()=>{const name=document.getElementById('preset-name').value.trim();if(!name){document.getElementById('preset-status').textContent='Дай пресету название.';document.getElementById('preset-name').focus();return;}remember();const existing=custom.find(row=>row.id===editId&&row.name===name),row={id:existing?.id||'user:'+crypto.randomUUID(),name,settings:library.normalize(prefs)},next=existing?custom.map(item=>item.id===existing.id?row:item):[...custom,row];try{localStorage.setItem('appearance-custom',JSON.stringify(next));custom=next;selected=row.id;editId=row.id;remember();list();document.getElementById('preset-status').textContent=existing?'Пресет обновлён.':'Пресет сохранён.';}catch{document.getElementById('preset-status').textContent='Не хватает места для сохранения.';}};
 document.getElementById('preset-delete').onclick=()=>{if(!selected.startsWith('user:'))return;custom=custom.filter(row=>row.id!==selected);localStorage.setItem('appearance-custom',JSON.stringify(custom));selected='custom';editId='';remember();list();document.getElementById('preset-status').textContent='Пресет удалён. Оформление сохранено.';};
 window.addEventListener('vinyl-change',edited);window.addEventListener('glass-change',edited);document.getElementById('window-material').addEventListener('change',edited);
 const picture=document.createElement('div');picture.className='floating-artwork';picture.setAttribute('aria-hidden','true');document.getElementById('ambient-light').append(picture);
 window.addEventListener('artwork-change',event=>{const item=event.detail;picture.style.backgroundImage=item?.videoId?'url("'+window.artwork.cover(item)+'")':'none';});
 system.addEventListener('change',apply);reduceGlass.addEventListener('change',apply);controls();list();apply();
 document.getElementById('appearance-popover').addEventListener('toggle',event=>window.jam.appearance(event.newState==='open').catch(()=>{}));
 window.jam.frame().then(result=>{if(result.ok)root.classList.toggle('unified-frame',result.value.overlay);}).catch(()=>{});
 for(const button of document.querySelectorAll('[data-window]'))button.onclick=()=>window.jam.window(button.dataset.window).then(result=>{if(result.ok&&button.dataset.window==='maximize'){button.title=result.value.maximized?'Восстановить':'Развернуть';button.setAttribute('aria-label',button.title);}}).catch(()=>{});
 document.querySelector('.topbar').addEventListener('dblclick',event=>{if(!event.target.closest('button,input,select,a'))window.jam.window('maximize').catch(()=>{});});
})();
