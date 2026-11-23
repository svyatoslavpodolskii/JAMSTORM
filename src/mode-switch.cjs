'use strict';
class ModeSwitch{
 constructor({getMode,activate,load,commit,restore}){Object.assign(this,{getMode,activate,load,commit,restore});this.tail=Promise.resolve();}
 run(target){const task=this.tail.catch(()=>{}).then(async()=>{const previous=this.getMode();try{await this.activate(target);await this.load(target);await this.commit(target);return {mode:target};}catch(error){try{await this.activate(previous);await this.load(previous);}catch{}finally{await this.restore(previous);}throw error;}});this.tail=task;return task;}
}
module.exports={ModeSwitch};
