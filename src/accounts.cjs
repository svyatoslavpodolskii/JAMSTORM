'use strict';
const status=value=>value===true?'signed-in':value===false?'signed-out':'unknown';
class Accounts{
 constructor(probes,notify=()=>{}){this.probes=probes;this.notify=notify;this.state={music:'unknown',tv:'unknown'};this.pending=new Map();}
 view(){return {...this.state};}
 set(kind,value){if(value===undefined)return this.view();const next=status(value);if(this.state[kind]!==next){this.state[kind]=next;this.notify(this.view());}return this.view();}
 async refresh(kind){
  const keys=kind?[kind]:['music','tv'];await Promise.all(keys.map(key=>{
   if(this.pending.has(key))return this.pending.get(key);
   const task=Promise.resolve().then(()=>this.probes[key]()).then(value=>this.set(key,value),()=>this.set(key,null)).finally(()=>this.pending.delete(key));this.pending.set(key,task);return task;
  }));return this.view();
 }
}
const musicScript=`(()=>{const value=window.ytcfg?.get?.('LOGGED_IN');return typeof value==='boolean'?value:null;})()`;
const tvScript=`(()=>{const guide=document.querySelector('ytlr-guide-response');if(!guide)return null;const value=window.ytcfg?.get?.('LOGGED_IN');const entries=[...guide.querySelectorAll('ytlr-guide-entry-renderer,ytlr-button')];const guest=entries.some(e=>e.data?.navigationEndpoint?.signInEndpoint||e.data?.command?.signInEndpoint||/^(Sign in|Войти)$/i.test(e.getAttribute('aria-label')||''));if(guest)return false;return typeof value==='boolean'?value:null;})()`;
const tvLoginScript=`new Promise(resolve=>{let tries=0;const open=()=>{const instance=Object.values(window._yttv||{}).find(v=>v?.instance?.resolveCommand)?.instance;if(instance){instance.resolveCommand({clientActionEndpoint:{action:{actionType:'OPEN_SIGN_IN_PROMPT'}}});return resolve(true);}if(++tries>100)return resolve(false);setTimeout(open,100);};open();})`;
module.exports={Accounts,musicScript,tvScript,tvLoginScript};
