'use strict';
module.exports=async({window,music,player,dir,path,fs})=>{
 await window.webContents.executeJavaScript(`tab('catalog')`);
 window.setSize(1320,880);await new Promise(r=>setTimeout(r,2500));
 if(process.argv.includes('--account-inspect')){const account=require('../src/accounts.cjs');console.log('TV_LOGIN_OPENED',await music.webContents.executeJavaScript(account.tvLoginScript));await new Promise(r=>setTimeout(r,1800));console.log('TV_SIGNIN_PROBE',await music.webContents.executeJavaScript(`JSON.stringify({path:location.hash.split('?')[0],tags:[...document.querySelectorAll('*')].filter(e=>/sign-in|signin|account-selector|pairing|oauth/i.test(e.tagName)).map(e=>e.tagName).slice(0,15),activateLink:document.body.innerText.includes('youtube.com/activate')||document.body.innerText.includes('yt.be/activate')})`));return;}
 const results=[];for(const size of [[1965,850],[1320,880],[2560,1080]]){window.setSize(...size);window.emit('resize');if(process.argv.includes('--background-review')){const bounds=music.getBounds();await music.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width:bounds.width,height:bounds.height,deviceScaleFactor:1,mobile:false});}await new Promise(r=>setTimeout(r,350));const g=await music.webContents.executeJavaScript(`(()=>{const r=document.querySelector('#container').getBoundingClientRect();return {width:innerWidth,height:innerHeight,x:r.x,y:r.y,w:r.width,h:r.height}})()`);if(Math.abs(g.w-g.width)>2||Math.abs(g.h-g.height)>2||Math.abs(g.x)>1)throw Error('TV is letterboxed: '+JSON.stringify(g));const bounds=music.getBounds();if(Math.abs(g.width-bounds.width)>2||Math.abs(g.height-bounds.height)>2)throw Error('TV viewport did not resize: '+JSON.stringify({size,bounds,g}));results.push({requested:size,bounds,emulated:process.argv.includes('--background-review'),...g});}
 console.log('TV_VIEWPORT_OK',JSON.stringify(results));
 await music.webContents.executeJavaScript(`(()=>{const instance=Object.values(window._yttv||{}).find(v=>v?.instance?.resolveCommand)?.instance;instance?.resolveCommand({browseEndpoint:{browseId:'FEtopics_music'}});})()`);await new Promise(r=>setTimeout(r,1500));
 console.log('TV_MUSIC_SECTION',await music.webContents.executeJavaScript(`JSON.stringify({url:location.href,text:document.body.innerText.slice(0,1000)})`));
 if(process.argv.includes('--stress-back')){
  for(let i=0;i<20;i++){const result=await window.webContents.executeJavaScript(`window.jam.navigate('back')`);if(!result.ok)throw Error('Back failed at '+i);await new Promise(resolve=>setTimeout(resolve,400));if(window.isDestroyed()||music.webContents.isDestroyed())throw Error('Back closed the application');}
  await music.webContents.executeJavaScript(`window.close()`);await new Promise(resolve=>setTimeout(resolve,1500));
  if(window.isDestroyed()||music.webContents.isDestroyed())throw Error('TV Exit closed the host');
  console.log('TV_BACK_STRESS_OK',20,'EXIT_INTERCEPTED');
 }
 if(process.argv.includes('--hold-review'))await new Promise(r=>setTimeout(r,60000));
};
