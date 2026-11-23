'use strict';
const {app,session,safeStorage}=require('electron'),fs=require('node:fs'),path=require('node:path');
const profile=process.env.JAM_SESSION_REVIEW_PROFILE;
if(!profile)throw Error('Missing isolated review profile');
for(const [key,dir] of [['userData',profile],['sessionData',path.join(profile,'session')]]){fs.mkdirSync(dir,{recursive:true});app.setPath(key,dir);}
app.whenReady().then(async()=>{
 const s=session.fromPartition('persist:youtube-music');
 const store=new (require('../src/login-store.cjs').LoginStore)(s,path.join(profile,'login-session.bin'),safeStorage);await store.start();
 if(process.argv.includes('--write')){
  await s.cookies.set({url:'https://music.youtube.com',name:'persistent_review',value:'fixture',expirationDate:Date.now()/1000+3600,secure:true});
  await s.cookies.set({url:'https://music.youtube.com',name:'session_review',value:'fixture',secure:true});
  await s.cookies.flushStore();s.flushStorageData();console.log('SESSION_REVIEW_WRITTEN');
 }else{const cookies=await s.cookies.get({url:'https://music.youtube.com'});console.log('SESSION_REVIEW_READ',JSON.stringify(cookies.map(c=>({name:c.name,session:c.session}))));if(!cookies.some(c=>c.name==='persistent_review')||!cookies.some(c=>c.name==='session_review'&&c.session))throw Error('Cookie lost');}
 await store.close();
 app.quit();
}).catch(e=>{console.error(e.message);app.exit(1);});
