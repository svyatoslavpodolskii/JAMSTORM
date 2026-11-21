'use strict';
// Only the public shape of YouTube's own renderer commands crosses this boundary.
// No Node bridge, authentication tokens or arbitrary script input reach the page.
class NativeQueue {
  constructor(browser, mode = ()=>'music') { this.browser=browser;this.mode=mode; }
  async read() {
    if (!/^https:\/\/(music|www)\.youtube\.com\//.test(this.browser.getURL())) return {available:false,items:[]};
    return this.browser.executeJavaScript(`(() => {
      const queue=document.querySelector('#queue')?.queue;
      const raw=queue?.getItems?.();
      if(Array.isArray(raw))return {available:true,source:'music',items:raw.slice(0,500).map((entry,index)=>{
        const row=entry.playlistPanelVideoRenderer||entry.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
        const text=value=>value?.simpleText||value?.runs?.map(run=>run.text).join('')||'';
        return {key:String(entry.queueItemId??row?.queueItemId??''),videoId:row?.videoId,title:text(row?.title),artist:text(row?.longBylineText||row?.shortBylineText).split(/[•·]/)[0].trim(),cover:row?.thumbnail?.thumbnails?.at(-1)?.url||'',current:!!row?.selected,index};
      }).filter(row=>/^[\\w-]{11}$/.test(row.videoId||''))};
      const p=document.querySelector('.html5-video-player'),ids=p?.getPlaylist?.();
      if(Array.isArray(ids)&&ids.length)return {available:true,source:'tv',items:ids.slice(0,500).filter(id=>/^[\\w-]{11}$/.test(id)).map((videoId,index)=>({videoId,index,current:index===p.getPlaylistIndex?.(),title:videoId,artist:''}))};
      return {available:false,source:location.hostname==='music.youtube.com'?'music':'tv',items:[]};
    })()`);
  }
  async command(op, fields) {
    const input=JSON.stringify({op,videoId:fields.videoId,index:fields.index,targetIndex:fields.targetIndex});
    return this.browser.executeJavaScript(`(async()=>{
      const c=${input},el=document.querySelector('#queue'),queue=el?.queue,store=queue?.store?.store;
      if(store&&el?.dispatch){
        if(c.op==='ADD'||c.op==='PLAY_NEXT'){
          const app=document.querySelector('ytmusic-app');if(!app?.networkManager?.fetch)throw new Error('Нативная очередь YouTube Music ещё не готова');
          const state=store.getState().queue;
          const response=await app.networkManager.fetch('/music/get_queue',{videoIds:[c.videoId],queueContextParams:state.queueContextParams,queueInsertPosition:c.op==='PLAY_NEXT'?'INSERT_AFTER_CURRENT_VIDEO':'INSERT_AT_END'});
          const entries=response?.queueDatas?.map(row=>row.content).filter(Boolean);if(!entries?.length)throw new Error('YouTube не вернул трек для очереди');
          const latest=store.getState().queue;
          const selected=latest.items.findIndex(row=>(row.playlistPanelVideoRenderer||row.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer)?.selected);
          el.dispatch({type:'ADD_ITEMS',payload:{items:entries,index:c.op==='PLAY_NEXT'&&selected>=0?selected+1:latest.items.length,nextQueueItemId:latest.nextQueueItemId,shouldAssignIds:true,shuffleEnabled:false}});
        }else if(c.op==='REMOVE')el.dispatch({type:'REMOVE_ITEM',payload:c.index});
        else if(c.op==='MOVE')el.dispatch({type:'MOVE_ITEM',payload:{fromIndex:c.index,toIndex:c.targetIndex}});
        else if(c.op==='PLAY')el.dispatch({type:'SET_INDEX',payload:c.index});
        else throw new Error('Неизвестная команда очереди');
        return true;
      }
      if(c.op==='ADD'||c.op==='PLAY_NEXT'){
        const receiver=Object.values(window._yttv||{}).find(value=>value?.instance?.resolveCommand)?.instance;
        if(receiver){receiver.resolveCommand({queueAddEndpoint:{queueTarget:{videoId:c.videoId},queueInsertPosition:c.op==='PLAY_NEXT'?'INSERT_AFTER_CURRENT_VIDEO':'INSERT_AT_END'}});return true;}
      }
      throw new Error('YouTube TV не предоставил управление очередью. Переключи плеер на YouTube Music.');
    })()`,true);
  }
  async mutate(op,fields,before) {
    if(!before.available)throw new Error('Нативная очередь недоступна. Включи трек в YouTube Music; отдельная скрытая очередь больше не создаётся.');
    await this.command(op,fields);
    for(let attempt=0;attempt<30;attempt++){
      const next=await this.read();
      const ids=next.items.map(item=>item.videoId),old=before.items.map(item=>item.videoId);
      const confirmed=op==='ADD'||op==='PLAY_NEXT'?ids.filter(id=>id===fields.videoId).length>old.filter(id=>id===fields.videoId).length:
        op==='REMOVE'?ids.length<old.length:op==='MOVE'?ids[fields.targetIndex]===old[fields.index]:next.items[fields.index]?.current;
      if(next.available&&confirmed)return next;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('YouTube не подтвердил изменение очереди. Обнови список перед повтором.');
  }
}
module.exports={NativeQueue};
