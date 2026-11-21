'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
const allowedDomain=domain=>/^(?:.*\.)?(google\.com|youtube\.com)$/.test(String(domain).replace(/^\./,''));
function cookieDetails(cookie){
 if(!allowedDomain(cookie.domain)||cookie.partitionKey)return null;
 const host=cookie.domain.replace(/^\./,''),value={url:`${cookie.secure?'https':'http'}://${host}${cookie.path||'/'}`,name:cookie.name,value:cookie.value,path:cookie.path||'/',secure:!!cookie.secure,httpOnly:!!cookie.httpOnly};
 if(cookie.domain.startsWith('.'))value.domain=cookie.domain;
 if(cookie.expires>0)value.expirationDate=cookie.expires;
 if(cookie.sameSite)value.sameSite=({Strict:'strict',Lax:'lax',None:'no_restriction'})[cookie.sameSite];
 return value;
}
class BrowserLogin{
 constructor(directory,session,onDone,onState){Object.assign(this,{directory,session,onDone,onState});this.active=false;}
 async start(){
  if(this.active)return {pending:true};
  const candidates=[process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,'Google/Chrome/Application/chrome.exe'),process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),process.env['PROGRAMFILES(X86)']&&path.join(process.env['PROGRAMFILES(X86)'],'Microsoft/Edge/Application/msedge.exe'),process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,'Microsoft/Edge/Application/msedge.exe')].filter(Boolean);
  let executable;for(const candidate of candidates)try{await fs.access(candidate);executable=candidate;break;}catch{}
  if(!executable)throw Error('Для входа нужен установленный Google Chrome или Microsoft Edge.');
  await fs.mkdir(this.directory,{recursive:true});
  // Only this dedicated app profile is accessible through the pipe. No TCP
  // debug port and no access to the user's ordinary browser profile.
  const child=spawn(executable,['--remote-debugging-pipe','--user-data-dir='+this.directory,'--no-first-run','--no-default-browser-check','--disable-features=WebAuthenticationConditionalUI','https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F'],{stdio:['ignore','ignore','ignore','pipe','pipe'],windowsHide:false});
  this.active=true;this.child=child;this.pending=new Map();this.serial=0;let buffer='';
  child.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let index;while((index=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,index);buffer=buffer.slice(index+1);try{const message=JSON.parse(raw),task=this.pending.get(message.id);if(task){this.pending.delete(message.id);clearTimeout(task.timer);message.error?task.reject(Error('Браузер не подтвердил операцию входа.')):task.resolve(message.result);}}catch{}}});
  child.once('error',()=>this.stop('Не удалось открыть браузер.'));child.once('exit',()=>{if(this.active)this.stop('Окно входа закрыто. Можно повторить вход в настройках.');});
  for(const pipe of [child.stdio[3],child.stdio[4]])pipe.on('error',()=>this.stop('Связь с окном входа прервана. Повтори вход в настройках.'));
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  this.onState?.('Войди в открывшемся браузере. После входа JAMSTORM подключится автоматически.');
  this.timer=setInterval(()=>this.poll().catch(()=>{}),1500);this.deadline=Date.now()+15*60*1000;
  return {pending:true};
 }
 command(method,params={}){return new Promise((resolve,reject)=>{if(!this.active)return reject(Error('Окно входа закрыто.'));const id=++this.serial,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Браузер не ответил.'));},7000);this.pending.set(id,{resolve,reject,timer});this.child.stdio[3].write(JSON.stringify({id,method,params})+'\0');});}
 async poll(){
  if(this.busy||!this.active)return;if(Date.now()>this.deadline){await this.command('Browser.close').catch(()=>{});this.stop('Время ожидания входа истекло.');return;}this.busy=true;
  try{
   const {targetInfos}=await this.command('Target.getTargets');
   if(!targetInfos.some(t=>t.type==='page'&&/^https:\/\/music\.youtube\.com\//.test(t.url)))return;
   const {cookies}=await this.command('Storage.getCookies');
   if(!cookies.some(c=>allowedDomain(c.domain)&&/^(?:SAPISID|__Secure-3PAPISID)$/.test(c.name)))return;
   const selected=cookies.map(cookieDetails).filter(Boolean);for(const cookie of selected)await this.session.cookies.set(cookie);
   await this.session.cookies.flushStore();
   try{await this.onDone();}catch{this.stop('Браузер вошёл в Google, но YouTube ещё не подтвердил вход в JAMSTORM. Оставь окно браузера открытым и повтори вход.');return;}
   await this.command('Browser.close').catch(()=>{});this.stop();this.onState?.('Вход завершён. Аккаунт подключён к JAMSTORM.');
  }finally{this.busy=false;}
 }
 stop(message){this.active=false;clearInterval(this.timer);for(const task of this.pending?.values()||[]){clearTimeout(task.timer);task.reject(Error('Окно входа закрыто.'));}this.pending?.clear();if(message)this.onState?.(message);}
}
module.exports={BrowserLogin,cookieDetails,allowedDomain};
