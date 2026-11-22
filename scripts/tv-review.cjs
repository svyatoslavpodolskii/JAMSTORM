'use strict';
module.exports=async({window,music,player,dir,path,fs})=>{
 await window.webContents.executeJavaScript(`tab('catalog')`);
 window.setSize(1320,880);await new Promise(r=>setTimeout(r,2500));
 const results=[];for(const size of [[1965,850],[1320,880],[2560,1080]]){window.setSize(...size);await new Promise(r=>setTimeout(r,350));const g=await music.webContents.executeJavaScript(`(()=>{const r=document.querySelector('#container').getBoundingClientRect();return {width:innerWidth,height:innerHeight,x:r.x,y:r.y,w:r.width,h:r.height}})()`);if(Math.abs(g.w-g.width)>2||Math.abs(g.h-g.height)>2||Math.abs(g.x)>1)throw Error('TV is letterboxed: '+JSON.stringify(g));results.push(g);}
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
