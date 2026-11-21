'use strict';
const {app,session}=require('electron'),path=require('node:path');
app.whenReady().then(async()=>{
 const {BrowserLogin}=require('../src/browser-login.cjs');
 const login=new BrowserLogin(path.join(__dirname,'../artifacts/login-review-profile'),session.fromPartition('login-review'),async()=>{},()=>{});
 try{
  await login.start();const result=await login.command('Browser.getVersion');
  console.log('LOGIN_BROWSER_PIPE_OK',result.product);
  const {targetInfos}=await login.command('Target.getTargets');
  if(!targetInfos.some(t=>t.type==='page'&&/^https:\/\/accounts\.google\.com\//.test(t.url)))throw Error('Google sign-in not opened');
  await login.command('Browser.close').catch(()=>{});login.stop();app.exit(0);
 }catch(error){console.error(error.message);login.stop();app.exit(1);}
});
