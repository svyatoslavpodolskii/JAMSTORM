'use strict';
class AccountFlow{
 constructor({status,music,tv}){this.status=status;this.music=music;this.tv=tv;this.pendingTV=false;this.awaitingMusic=false;this.lastStep='idle';this.starting=null;}
 start(target='all'){
  if(!['all','music','tv'].includes(target))return Promise.reject(Error('Unknown account target'));
  if(this.awaitingMusic)return Promise.resolve({step:'music',alreadyOpen:true});
  if(this.starting)return this.starting;
  this.starting=this.run(target).finally(()=>this.starting=null);return this.starting;
 }
 async run(target){
  this.pendingTV=false;
  if(target==='music'){this.lastStep='music';this.awaitingMusic=true;try{await this.music();}catch(error){this.cancelMusic();throw error;}return {step:'music'};}
  if(target==='tv'){this.lastStep='tv';return {step:'tv',...await this.tv()};}
  const status=await this.status();
  if(status.music!=='signed-in'){this.pendingTV=true;this.awaitingMusic=true;this.lastStep='music';try{await this.music();}catch(error){this.cancelMusic();throw error;}return {step:'music'};}
  if(status.tv!=='signed-in'){this.lastStep='tv';return {step:'tv',...await this.tv()};}
  this.lastStep='complete';return {step:'complete'};
 }
 async musicConnected(){
  this.awaitingMusic=false;
  if(!this.pendingTV)return {step:'music'};this.pendingTV=false;
  const status=await this.status();if(status.tv==='signed-in'){this.lastStep='complete';return {step:'complete'};}
  this.lastStep='tv';return {step:'tv',...await this.tv()};
 }
 cancelMusic(){this.awaitingMusic=false;this.pendingTV=false;}
}
module.exports={AccountFlow};
