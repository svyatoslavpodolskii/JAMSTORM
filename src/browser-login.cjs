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
const signInURL='https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F';
// No CDP, script injection or WebAuthn override during authentication.
const signInArguments=directory=>['--user-data-dir='+directory,'--no-first-run','--no-default-browser-check','--new-window',signInURL];
const readerArguments=directory=>['--user-data-dir='+directory,'--headless=new','--remote-debugging-pipe','--disable-background-networking','--no-first-run','about:blank'];
async function findBrowser(){
 const candidates=[process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,'Google/Chrome/Application/chrome.exe'),process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),process.env['PROGRAMFILES(X86)']&&path.join(process.env['PROGRAMFILES(X86)'],'Microsoft/Edge/Application/msedge.exe'),process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,'Microsoft/Edge/Application/msedge.exe')].filter(Boolean);
 for(const candidate of candidates)try{await fs.access(candidate);return candidate;}catch{}
 throw Error('Для входа нужен установленный Google Chrome или Microsoft Edge.');
}
class BrowserLogin{
 constructor(directory,session,onDone,onState){Object.assign(this,{directory,session,onDone,onState});this.active=false;this.phase='idle';this.pending=new Map();this.serial=0;}
 async start(){
  if(this.active)return {pending:true,phase:this.phase};
  this.active=true;this.phase='starting';
  try{this.executable=await findBrowser();await fs.mkdir(this.directory,{recursive:true});}catch(error){this.stop();throw error;}
  this.phase='signin';
  const child=spawn(this.executable,signInArguments(this.directory),{stdio:'ignore',windowsHide:false});this.signInChild=child;
  child.once('exit',()=>{if(this.active&&this.phase==='signin')this.complete().catch(()=>this.stop('Не удалось перенести вход. Закрой отдельное окно браузера и повтори попытку.'));});
  child.once('error',()=>this.stop('Не удалось открыть браузер.'));
  try{await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});}catch(error){this.stop();throw error;}
  this.onState?.('Войди в Google в отдельном окне браузера, затем закрой это окно. JAMSTORM подключит аккаунт автоматически.');
  return {pending:true,phase:'signin'};
 }
 async openReader(){
  this.phase='reading';await new Promise(resolve=>setTimeout(resolve,500));if(!this.active)throw Error('Вход отменён.');
  const child=spawn(this.executable,readerArguments(this.directory),{stdio:['ignore','ignore','ignore','pipe','pipe'],windowsHide:true});this.child=child;let buffer='';
  child.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let index;while((index=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,index);buffer=buffer.slice(index+1);try{const message=JSON.parse(raw),task=this.pending.get(message.id);if(task){this.pending.delete(message.id);clearTimeout(task.timer);message.error?task.reject(Error('Браузер не подтвердил перенос сессии.')):task.resolve(message.result);}}catch{}}});
  for(const pipe of [child.stdio[3],child.stdio[4]])pipe.on('error',()=>this.rejectPending());
  child.once('exit',()=>this.rejectPending());child.once('error',()=>this.rejectPending());
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});await this.command('Browser.getVersion');
 }
 command(method,params={}){return new Promise((resolve,reject)=>{
  if(!this.active||this.phase!=='reading'||!this.child?.stdio[3]?.writable)return reject(Error('Канал переноса сессии закрыт.'));
  const id=++this.serial,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Браузер не ответил. Закрой все окна входа и повтори попытку.'));},7000);
  this.pending.set(id,{resolve,reject,timer});this.child.stdio[3].write(JSON.stringify({id,method,params})+'\0');
 });}
 async closeReader(){
  const child=this.child;if(!child)return;
  const exited=new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)return resolve();child.once('exit',resolve);});
  await this.command('Browser.close').catch(()=>{});await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,3000))]);
  if(child.exitCode===null&&child.signalCode===null)child.kill();this.child=null;
 }
 async complete(){
  this.onState?.('Подключаем аккаунт из закрытого окна браузера…');let cookies;
  try{await this.openReader();cookies=(await this.command('Storage.getCookies')).cookies;}finally{await this.closeReader();}
  if(!this.active)return;
  if(!cookies.some(c=>allowedDomain(c.domain)&&/^(?:SAPISID|__Secure-3PAPISID)$/.test(c.name))){this.stop('Вход не завершён. Нажми «Войти», войди до страницы YouTube Music и закрой отдельное окно браузера.');return;}
  for(const cookie of cookies.map(cookieDetails).filter(Boolean))await this.session.cookies.set(cookie);
  await this.session.cookies.flushStore();this.phase='verifying';
  try{await this.onDone();}catch{this.stop('Браузер вошёл в Google, но YouTube ещё не подтвердил вход в JAMSTORM. Повтори подключение в настройках.');return;}
  this.stop('Вход завершён. Аккаунт подключён к JAMSTORM.');
 }
 rejectPending(){for(const task of this.pending.values()){clearTimeout(task.timer);task.reject(Error('Канал переноса сессии закрыт.'));}this.pending.clear();}
 stop(message){this.active=false;this.phase='idle';this.rejectPending();if(message)this.onState?.(message);}
}
module.exports={BrowserLogin,cookieDetails,allowedDomain,signInArguments,readerArguments,findBrowser};
