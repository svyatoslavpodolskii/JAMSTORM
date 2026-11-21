'use strict';
module.exports=async({window,music,dir,path,fs})=>{
 const output=path.join(dir,'catalog-review');fs.mkdirSync(output,{recursive:true});
 await window.webContents.executeJavaScript(`tab('catalog')`);
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
