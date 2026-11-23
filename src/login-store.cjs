'use strict';
const fs=require('node:fs'),path=require('node:path');
const allowed=c=>/^(?:.*\.)?(?:google\.com|youtube\.com)$/.test(String(c.domain).replace(/^\./,''))&&!c.partitionKey;
const key=c=>JSON.stringify([c.domain,c.path,c.name,c.secure]);
const lifetime=30*86400*1000;
// Session-only cookies keep their original attributes. The additional desktop
// store is encrypted for the current OS user and never logged or exported.
class LoginStore{
 constructor(session,file,crypto){Object.assign(this,{session,file,crypto});this.entries=new Map();this.listener=()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>this.save().catch(()=>{}),200);};}
 async start(){
  if(!await this.crypto.isAsyncEncryptionAvailable())return false;
  try{const data=JSON.parse((await this.crypto.decryptStringAsync(fs.readFileSync(this.file))).result);if(data.version===1)for(const entry of data.cookies||[])if(allowed(entry.cookie)&&entry.cookie.session&&entry.until>Date.now())this.entries.set(key(entry.cookie),entry);}catch{}
  const current=await this.session.cookies.get({}),present=new Set(current.map(key));
  for(const entry of this.entries.values())if(!present.has(key(entry.cookie))){const c=entry.cookie,details={url:`${c.secure?'https':'http'}://${c.domain.replace(/^\./,'')}${c.path||'/'}`,name:c.name,value:c.value,path:c.path,secure:c.secure,httpOnly:c.httpOnly,sameSite:c.sameSite};if(c.domain.startsWith('.'))details.domain=c.domain;try{await this.session.cookies.set(details);}catch{this.entries.delete(key(c));}}
  this.session.cookies.on('changed',this.listener);await this.save();return true;
 }
 save(){this.saving=(this.saving||Promise.resolve()).catch(()=>{}).then(()=>this.write());return this.saving;}
 async write(){
  if(!await this.crypto.isAsyncEncryptionAvailable())return;
  const cookies=await this.session.cookies.get({}),next=new Map();
  for(const c of cookies)if(c.session&&allowed(c)){const old=this.entries.get(key(c));next.set(key(c),{cookie:c,until:old?.cookie.value===c.value?old.until:Date.now()+lifetime});}
  this.entries=next;fs.mkdirSync(path.dirname(this.file),{recursive:true});const temporary=this.file+'.tmp';fs.writeFileSync(temporary,await this.crypto.encryptStringAsync(JSON.stringify({version:1,cookies:[...next.values()]})));fs.renameSync(temporary,this.file);await this.session.cookies.flushStore();
 }
 async close(){clearTimeout(this.timer);this.session.cookies.removeListener('changed',this.listener);await this.save();this.session.flushStorageData();}
}
module.exports={LoginStore};
