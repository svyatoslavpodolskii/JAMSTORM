'use strict';
const fs=require('node:fs');
class PlaybackPolicy{
 constructor(file){this.file=file;this.settings={blockExplicit:true,hideExplicit:true,guestLimit:3,guestReorder:true};this.pending=new Map();this.cache=new Map();this.tail=Promise.resolve();try{this.set(JSON.parse(fs.readFileSync(file,'utf8')),false);}catch{}}
 set(value,persist=true){
  const next={...this.settings};
  for(const key of ['blockExplicit','hideExplicit','guestReorder'])if(typeof value[key]==='boolean')next[key]=value[key];
  if(value.guestLimit!==undefined){if(!Number.isInteger(value.guestLimit)||value.guestLimit<0||value.guestLimit>50)throw Error('Лимит должен быть от 0 до 50');next.guestLimit=value.guestLimit;}
  this.settings=next;if(persist&&this.file)fs.writeFileSync(this.file,JSON.stringify(next));return {...next};
 }
 async verify(id,metadata){
  if(!this.settings.blockExplicit)return;
  if(!/^[\w-]{11}$/.test(id||''))throw Error('Некорректный трек');
  let info=this.cache.get(id);if(!info){info=await metadata(id);if(info?.known){if(this.cache.size>=1000)this.cache.delete(this.cache.keys().next().value);this.cache.set(id,info);}}
  if(!info?.known)throw Error('Не удалось проверить маркировку E. Повтори после загрузки Music.');
  if(info.explicit)throw Error('Треки с маркировкой E запрещены хостом');
 }
 run(command,actor,execute,snapshot,metadata){
  const task=this.tail.catch(()=>{}).then(async()=>{
   const before=await snapshot(),items=before.items||[],current=items.findIndex(i=>i.current);
   for(const [key,ids] of this.pending){const remaining=ids.filter(id=>{const index=items.findIndex(i=>i.id===id);return index>=0&&(current<0||index>=current);});remaining.length?this.pending.set(key,remaining):this.pending.delete(key);}
   if(actor&&!this.settings.guestReorder&&['MOVE','PLAY_NEXT','REMOVE','PLAY','SKIP_NEXT','SKIP_PREVIOUS','SEEK'].includes(command.op))throw Error('Хост разрешил гостям только добавлять треки в конец очереди');
   if(actor&&['ADD','PLAY_NEXT'].includes(command.op)&&this.settings.guestLimit&&(this.pending.get(actor)?.length||0)>=this.settings.guestLimit)throw Error('Лимит добавлений достигнут. Дождись, пока твои песни проиграют.');
   if(['ADD','PLAY_NEXT','PLAY'].includes(command.op)&&command.playing!==false)await this.verify(command.videoId,metadata);
   const result=await execute(command);
   if(actor&&result.ok&&['ADD','PLAY_NEXT'].includes(command.op)){
    const old=new Set(items.map(i=>i.id)),added=(result.items||[]).filter(i=>!old.has(i.id)).map(i=>i.id);
    this.pending.set(actor,[...(this.pending.get(actor)||[]),...added]);
   }
   return result;
  });this.tail=task;return task;
 }
}
module.exports={PlaybackPolicy};
