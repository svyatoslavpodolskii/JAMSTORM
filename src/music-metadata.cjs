'use strict';
// TV does not expose Music's E badges through getPlaylist(). Ask the actual
// Music client in a separate, non-playing view in the same account session.
class MusicMetadata{
 constructor(createView){this.createView=createView;this.cache=new Map();this.pending=new Map();this.view=null;this.ready=null;}
 async client(){
  if(this.ready)return this.ready;
  const view=this.view=this.createView();
  this.ready=(async()=>{await view.webContents.loadURL('https://music.youtube.com/');
   const ready=await view.webContents.executeJavaScript(`new Promise(resolve=>{let count=0;const poll=()=>{if(document.querySelector('ytmusic-app')?.networkManager?.fetch)return resolve(true);if(++count>80)return resolve(false);setTimeout(poll,100);};poll();})`);
   if(!ready)throw Error('Music metadata is unavailable');return view.webContents;
  })().catch(error=>{this.lastError=error.code||error.message;this.close();throw error;});return this.ready;
 }
 async get(id){
  if(!/^[\w-]{11}$/.test(id||''))return {known:false};
  const cached=this.cache.get(id);if(cached&&cached.expires>Date.now())return cached.value;
  if(this.pending.has(id))return this.pending.get(id);
  const task=(async()=>{
   try{const wc=await this.client();const value=await wc.executeJavaScript(`Promise.race([(async()=>{const app=document.querySelector('ytmusic-app');const response=await app.networkManager.fetch('/music/get_queue',{videoIds:[${JSON.stringify(id)}]});const entry=response?.queueDatas?.[0]?.content,row=entry?.playlistPanelVideoRenderer||entry?.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;if(row?.videoId!==${JSON.stringify(id)})return {known:false};const text=v=>v?.simpleText||v?.runs?.map(r=>r.text).join('')||'';return {known:true,explicit:/MUSIC_EXPLICIT_BADGE|EXPLICIT_BADGE|EXPLICIT/.test(JSON.stringify(row.badges||[])),title:text(row.title),artist:text(row.longBylineText||row.shortBylineText)};})(),new Promise(resolve=>setTimeout(()=>resolve({known:false}),10000))])`);
    if(this.cache.size>=500)this.cache.delete(this.cache.keys().next().value);this.cache.set(id,{value,expires:Date.now()+(value.known?21600000:10000)});return value;
   }catch{return {known:false};}
  })().finally(()=>this.pending.delete(id));this.pending.set(id,task);return task;
 }
 close(){const wc=this.view?.webContents;this.view=null;this.ready=null;if(wc&&!wc.isDestroyed()){wc.removeAllListeners?.();wc.close({waitForBeforeUnload:false});}}
}
module.exports={MusicMetadata};
