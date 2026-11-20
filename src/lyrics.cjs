'use strict';
function parseLrc(text=''){
  const lines=[];
  for(const row of text.split(/\r?\n/)){
    const tags=[...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)],content=row.replace(/\[[^\]]+\]/g,'').trim();
    for(const tag of tags)if(content)lines.push({time:Math.round((Number(tag[1])*60+Number(tag[2]))*1000),text:content});
  }
  return lines.sort((a,b)=>a.time-b.time).slice(0,1000);
}
class Lyrics {
  constructor(){this.cache=new Map();}
  async get(track){
    if(!track||typeof track.title!=='string'||typeof track.artist!=='string')throw new Error('Сначала включи песню');
    const title=track.title.slice(0,250).replace(/\s*\((?:Official|feat\.?)[^)]*\)/gi,'').trim(),artist=track.artist.slice(0,200).replace(/ - Topic$/,'');
    if(!title||!artist||/^[\w-]{11}$/.test(title))throw new Error('Подожди, пока плеер загрузит название и исполнителя');
    const query=new URLSearchParams({track_name:title,artist_name:artist});if(Number.isFinite(track.duration)&&track.duration>0)query.set('duration',String(Math.round(track.duration/1000)));
    const key=query.toString();if(this.cache.has(key))return this.cache.get(key);
    const response=await fetch('https://lrclib.net/api/get?'+query,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'JAMSTORM/0.3.0 (https://github.com/svyatoslavpodolskii/JAMSTORM)'}});
    if(response.status===404)return {lines:[],plain:'',missing:true};if(!response.ok)throw new Error('Сервис текстов сейчас недоступен');
    const data=await response.json(),result={lines:parseLrc(String(data.syncedLyrics||'').slice(0,100000)),plain:String(data.plainLyrics||'').slice(0,100000),instrumental:!!data.instrumental,source:'LRCLIB'};
    if(this.cache.size>100)this.cache.delete(this.cache.keys().next().value);this.cache.set(key,result);return result;
  }
}
module.exports={Lyrics,parseLrc};
