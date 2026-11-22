'use strict';
module.exports=async({window,music,dir,path,fs})=>{
 const output=path.join(dir,'catalog-review');fs.mkdirSync(output,{recursive:true});
 await window.webContents.executeJavaScript(`tab('catalog')`);
 if(process.argv.includes('--appearance-overlay-review')){
  console.log('OVERLAY_BEGIN');const before=music.getBounds();await window.webContents.executeJavaScript(`document.getElementById('appearance-popover').showPopover()`);await new Promise(r=>setTimeout(r,700));
  console.log('OVERLAY_OPENED');const view=window.contentView.children.find(v=>v.webContents?.getURL().endsWith('/appearance-panel.html'));if(!view)throw Error('Appearance overlay missing');
  if(JSON.stringify(before)!==JSON.stringify(music.getBounds()))throw Error('Appearance resizes catalog');
  console.log('OVERLAY_VIEW',view.webContents.getURL());const controls=await view.webContents.executeJavaScript(`(()=>{const checkbox=document.querySelector('input[type=checkbox]'),panel=document.querySelector('#appearance-popover');return {checkboxWidth:checkbox?.getBoundingClientRect().width,panelWidth:panel.clientWidth,overflow:panel.scrollWidth>panel.clientWidth,size:!!document.querySelector('#appearance-size')};})()`);
  if(controls.checkboxWidth>50||controls.overflow||!controls.size)throw Error('Appearance controls clip: '+JSON.stringify(controls));
  await view.webContents.executeJavaScript(`window.appearancePanel.event({id:'appearance-size',type:'input',value:'130',checked:false})`);await new Promise(r=>setTimeout(r,250));
  console.log('OVERLAY_CONTROL_SENT');const size=await window.webContents.executeJavaScript(`getComputedStyle(document.body).getPropertyValue('--artwork-size')`);if(size.trim()!=='1.3')throw Error('Overlay does not update main appearance');
  try{fs.writeFileSync(path.join(output,'appearance-overlay.png'),(await view.webContents.capturePage()).toPNG());}catch(e){console.log('OVERLAY_CAPTURE_UNAVAILABLE',e.message);}console.log('APPEARANCE_OVERLAY_OK',JSON.stringify({catalogUnchanged:true,...controls,size}));return;
 }
 if(process.argv.includes('--dock-review')){
  await music.webContents.loadURL('https://music.youtube.com/watch?v=5NV6Rdv1a3I');await new Promise(r=>setTimeout(r,4500));
  const result=await music.webContents.executeJavaScript(`(()=>{const bar=document.querySelector('ytmusic-player-bar'),like=bar?.querySelector('ytmusic-like-button-renderer');return {bar:!!bar,menu:!!bar?.querySelector('ytmusic-menu-renderer button,ytmusic-menu-renderer tp-yt-paper-icon-button'),background:getComputedStyle(bar).backgroundImage,blur:getComputedStyle(bar).backdropFilter,border:getComputedStyle(document.querySelector('ytmusic-nav-bar'),'::before').borderBottomWidth};})()`);
  for(const action of ['like','dislike'])result[action]=(await music.webContents.executeJavaScript(require('../src/feedback.cjs').script(action).replace('button.click();',''))).available;console.log('NATIVE_DOCK',JSON.stringify(result));if(!result.like||!result.dislike||!result.menu||result.blur==='none'||result.border!=='0px')throw Error('Native dock controls or glass failed');fs.writeFileSync(path.join(output,'native-dock.png'),(await window.webContents.capturePage()).toPNG());return;
 }
 if(process.argv.includes('--explicit-review')){
  await music.webContents.loadURL('https://music.youtube.com/search?q=Eminem+Rap+God');
  await new Promise(r=>setTimeout(r,3500));
  const result=await music.webContents.executeJavaScript(`(()=>{const rows=[...document.querySelectorAll('ytmusic-responsive-list-item-renderer,ytmusic-two-row-item-renderer')];const hidden=rows.filter(e=>e.dataset.jamExplicitHidden==='true');return {rows:rows.length,hidden:hidden.length,displayHidden:hidden.every(e=>getComputedStyle(e).display==='none'),cleanVisible:rows.some(e=>!e.dataset.jamExplicitHidden&&getComputedStyle(e).display!=='none')};})()`);
  console.log('EXPLICIT_CATALOG',JSON.stringify(result));if(!result.hidden||!result.displayHidden||!result.cleanVisible)throw Error('Explicit catalog hiding failed');return;
 }
 const art=require('node:url').pathToFileURL(path.join(__dirname,'../.github/media/cover-demo.svg')).href;
 await window.webContents.executeJavaScript(`document.body.classList.remove('booting','intro-running');document.querySelector('#boot-screen').hidden=true;window.playerEffects.ambient([70,130,180]);document.querySelector('.floating-artwork').style.backgroundImage='url('+${JSON.stringify(art)}+')';`);
 const shot=async name=>{try{fs.writeFileSync(path.join(output,name+'.png'),(await window.webContents.capturePage()).toPNG());}catch(error){if(!/Current display surface not available/.test(error.message))throw error;console.log('CAPTURE_UNAVAILABLE',name);}};
 const results=[];
 if(process.argv.includes('--inspect-layout')){
  console.log('CATALOG_LAYOUT',await music.webContents.executeJavaScript(`(()=>{const rows=[...document.querySelectorAll('*')].filter(el=>el.clientHeight>200&&el.scrollHeight>el.clientHeight+200);for(const el of rows)el.scrollTop=420;return {scroll:rows.map(el=>({tag:el.tagName,id:el.id,classes:el.className,top:el.getBoundingClientRect().top,height:el.clientHeight,scroll:el.scrollTop,position:getComputedStyle(el).position,overflow:getComputedStyle(el).overflow})),layout:[...document.querySelectorAll('ytmusic-app,#layout,#content,#page-manager,ytmusic-browse-response,ytmusic-nav-bar')].map(el=>({tag:el.tagName,id:el.id,top:el.getBoundingClientRect().top,height:el.clientHeight,position:getComputedStyle(el).position,overflow:getComputedStyle(el).overflow,clip:getComputedStyle(el).clipPath}))};})()`));return;
 }
 for(const id of ['glass','cover','daylight','quiet']){
  await window.webContents.executeJavaScript(`(()=>{const select=document.querySelector('#appearance-preset');select.value=${JSON.stringify(id)};select.dispatchEvent(new Event('change'));})()`);
  await new Promise(resolve=>setTimeout(resolve,950));
  await music.webContents.executeJavaScript(`for(const el of document.querySelectorAll('*'))if(el.clientHeight>200&&el.scrollHeight>el.clientHeight+500)el.scrollTop=420`);
  await new Promise(resolve=>setTimeout(resolve,200));
  const state=await music.webContents.executeJavaScript(`(()=>{const nav=document.querySelector('ytmusic-nav-bar'),style=getComputedStyle(nav,'::before'),r=nav.getBoundingClientRect();return {theme:document.documentElement.dataset.jamTheme,glass:document.documentElement.dataset.jamGlass,background:style.backgroundColor,blur:style.backdropFilter,top:r.top,left:r.left,right:r.right,width:innerWidth,clip:getComputedStyle(document.querySelector('#content')).clipPath,text:getComputedStyle(document.querySelector('ytmusic-carousel-shelf-renderer h2 yt-formatted-string')||document.querySelector('ytmusic-carousel-shelf-renderer h2')||document.querySelector('ytmusic-app')).color};})()`);
  if(state.clip==='none')throw Error('Catalog cards can paint through the fixed header');
  if(state.left<0||state.right>state.width+1||state.top<0)throw Error('Catalog header is clipped: '+JSON.stringify(state));
  if(id==='daylight'&&(state.theme!=='light'||state.text==='rgb(255, 255, 255)')||id==='quiet'&&(state.glass!=='off'||state.blur!=='none'))throw Error('Catalog theme failed: '+JSON.stringify(state));
  results.push({preset:id,...state});
  await shot(id);
  try{fs.writeFileSync(path.join(output,id+'-catalog.png'),(await music.webContents.capturePage()).toPNG());}catch(error){if(!/Current display surface not available/.test(error.message))throw error;console.log('NATIVE_CAPTURE_UNAVAILABLE',id);}
 }
 await window.webContents.executeJavaScript(`(()=>{const select=document.querySelector('#appearance-preset');select.value='glass';select.dispatchEvent(new Event('change'));})()`);
 await music.webContents.executeJavaScript(`document.querySelector('ytmusic-search-box input')?.focus()`);
 await new Promise(resolve=>setTimeout(resolve,250));
 await shot('search-focused');
 const point=await window.webContents.executeJavaScript(`(()=>{const r=document.querySelector('[data-window=close]').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};})()`);
 window.webContents.sendInputEvent({type:'mouseMove',...point});await new Promise(resolve=>setTimeout(resolve,180));
 await shot('caption-hover');
 window.setSize(860,620);await new Promise(resolve=>setTimeout(resolve,350));
 const fits=await window.webContents.executeJavaScript(`[...document.querySelectorAll('.topbar button')].filter(e=>e.getBoundingClientRect().width).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=72})`);
 if(!fits)throw Error('Compact toolbar clips controls');
 await shot('compact');
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log('CATALOG_REVIEW_OK',JSON.stringify(results));
};
