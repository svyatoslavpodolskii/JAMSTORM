'use strict';
const {app,session}=require('electron'),path=require('node:path');
app.whenReady().then(async()=>{
 const {BrowserLogin,findBrowser}=require('../src/browser-login.cjs');
 const login=new BrowserLogin(path.join(__dirname,'../artifacts/login-reader-review-profile'),session.fromPartition('login-review'),async()=>{},()=>{});
 try{
  login.executable=await findBrowser();login.active=true;await login.openReader();
  await login.command('Storage.setCookies',{cookies:[{name:'jamstorm_login_review',value:'fixture',domain:'.youtube.com',path:'/',secure:true,expires:Math.floor(Date.now()/1000)+600}]});
  await login.closeReader();await login.openReader();
  const {cookies}=await login.command('Storage.getCookies');
  if(!cookies.some(c=>c.name==='jamstorm_login_review'&&c.value==='fixture'))throw Error('Closed-browser cookie persistence failed');
  const {targetInfos}=await login.command('Target.getTargets');
  if(targetInfos.some(t=>t.type==='page'&&/^https?:/.test(t.url)))throw Error('Reader opened a remote authentication page');
  await login.closeReader();login.stop();console.log('CLOSED_BROWSER_SESSION_READ_OK');app.exit(0);
 }catch(error){console.error(error.message);await login.closeReader();login.stop();app.exit(1);}
});
