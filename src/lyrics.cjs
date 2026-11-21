'use strict';
function parseLrc(text='') {
  const lines=[];
  for(const row of text.split(/\r?\n/)) {
    const tags=[...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)],content=row.replace(/\[[^\]]+\]/g,'').trim();
    for(const tag of tags) if(content) lines.push({time:Math.round((Number(tag[1])*60+Number(tag[2]))*1000),text:content});
  }
  return lines.sort((a,b)=>a.time-b.time).slice(0,1000);
}
const normalize=value=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function metadata(track) {
  if(!track||typeof track.title!=='string'||typeof track.artist!=='string')throw new Error('Включи песню, и здесь появится её текст');
  const title=track.title.slice(0,250).replace(/\s*[([][^)\]]*(?:official|feat\.?|ft\.?|lyric|audio|video)[^)\]]*[)\]]/gi,'').replace(/\s*[-–|]\s*(?:official|lyrics?|audio|music video).*$/i,'').trim();
  const artist=track.artist.slice(0,200).split(/[•·]/)[0].replace(/\s*-\s*Topic$/i,'').split(/,|\s+(?:feat\.?|ft\.?)\s+/i)[0].trim();
  if(!title||!artist||/^[\w-]{11}$/.test(title))throw new Error('Название и исполнитель ещё загружаются');
  return {title,artist,duration:Number.isFinite(track.duration)&&track.duration>0?track.duration/1000:null};
}
function choose(candidates,track) {
  const title=normalize(track.title),artist=normalize(track.artist);
  return candidates.filter(row=>normalize(String(row.trackName||''))===title&&normalize(String(row.artistName||''))===artist)
    .filter(row=>!track.duration||Math.abs(row.duration-track.duration)<=8)
    .sort((a,b)=>(Math.abs((a.duration||0)-(track.duration||0))-Math.abs((b.duration||0)-(track.duration||0)))||Number(!!b.syncedLyrics)-Number(!!a.syncedLyrics))[0];
}
class Lyrics {
  constructor(request=fetch){this.cache=new Map();this.pending=new Map();this.request=request;}
  async get(input) {
    const track=metadata(input),key=JSON.stringify(track);
    if(this.cache.has(key))return this.cache.get(key);
    if(this.pending.has(key))return this.pending.get(key);
    const task=this.lookup(track).then(value=>{if(this.cache.size>=100)this.cache.delete(this.cache.keys().next().value);this.cache.set(key,value);return value;}).finally(()=>this.pending.delete(key));
    this.pending.set(key,task);return task;
  }
  async query(endpoint,params){
    const response=await this.request('https://lrclib.net/api/'+endpoint+'?'+new URLSearchParams(params),{signal:AbortSignal.timeout(10000),headers:{'User-Agent':'JAMSTORM/0.3.1 (https://github.com/svyatoslavpodolskii/JAMSTORM)'}});
    if(response.status===404)return null;
    if(!response.ok)throw new Error('LRCLIB сейчас недоступен. Попробуй ещё раз');
    return response.json();
  }
  async lookup(track){
    const params={track_name:track.title,artist_name:track.artist};if(track.duration)params.duration=String(Math.round(track.duration));
    let data=await this.query('get',params);
    if(!data||(!data.syncedLyrics&&!data.plainLyrics&&!data.instrumental))data=choose(await this.query('search',{track_name:track.title,artist_name:track.artist})||[],track);
    if(!data)return {lines:[],plain:'',missing:true,source:'LRCLIB'};
    const lines=parseLrc(String(data.syncedLyrics||'').slice(0,100000));
    return {lines,plain:String(data.plainLyrics||'').slice(0,100000),instrumental:!!data.instrumental,source:'LRCLIB',duration:data.duration};
  }
}
module.exports={Lyrics,parseLrc,metadata,choose};
