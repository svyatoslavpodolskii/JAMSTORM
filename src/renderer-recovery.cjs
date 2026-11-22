'use strict';
class RendererRecovery{
 constructor(restore,notify=()=>{},now=Date.now){Object.assign(this,{restore,notify,now});this.failures=[];this.pending=null;this.closed=false;}
 recover(details){
  if(this.closed||['clean-exit','killed'].includes(details.reason))return Promise.resolve(false);
  if(this.pending)return this.pending;
  const now=this.now();this.failures=this.failures.filter(time=>now-time<120000);
  if(this.failures.length>=2){this.notify('error');return Promise.resolve(false);}
  this.failures.push(now);this.notify('recovering');
  this.pending=Promise.resolve().then(()=>this.restore()).then(()=>{if(!this.closed)this.notify('recovered');return true;},()=>{if(!this.closed)this.notify('error');return false;}).finally(()=>this.pending=null);
  return this.pending;
 }
 close(){this.closed=true;}
}
module.exports={RendererRecovery};
