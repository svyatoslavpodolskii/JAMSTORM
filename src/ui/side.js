'use strict';
const $=id=>document.getElementById(id),kind=document.body.dataset.panel||'queue';
let active=true,queue=null,signature='',trackKey='',lines=[],highlight=-1,polling=false,loading=false,requestId=0,clock=null,receivedAt=0,manualScrollUntil=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
async function call(promise){const result=await promise;if(!result.ok)throw Error(result.error);return result.value;}
function status(text){$('status').textContent=text||'';}
function empty(title,detail,action){
  const box=document.createElement('div');box.className='empty-state';
  const heading=document.createElement('h2');heading.textContent=title;
  const p=document.createElement('p');p.textContent=detail;box.append(heading,p);
  if(action){const button=document.createElement('button');button.className='retry';button.textContent='Попробовать ещё раз';button.onclick=action;box.append(button);}
  $('content').replaceChildren(box);
}
function resetLyrics(){trackKey='';requestId++;lines=[];highlight=-1;loading=false;}
$('title').textContent=kind==='lyrics'?'Текст песни':'Дальше в очереди';
$('close').onclick=()=>call(window.jam.panel(kind)).catch(error=>status(error.message));
window.jam.onPanel(value=>{active=!!value?.[kind];if(active){if(kind==='lyrics'&&!lines.length)resetLyrics();poll();}});
$('content').addEventListener('wheel',()=>{manualScrollUntil=performance.now()+4500;},{passive:true});
$('content').addEventListener('touchmove',()=>{manualScrollUntil=performance.now()+4500;},{passive:true});
async function command(op,fields){
  try{status('Применяем…');await call(window.jam.command(op,fields));signature='';await poll();}
  catch(error){status(error.message);}
}
function renderQueue(q){
  const items=q.items||[],now=items.find(item=>item.current);
  $('credit').textContent=q.native?'Одна очередь с YouTube Music':'Очередь сессии';
  $('count').textContent=String(items.length);$('count').hidden=false;
  const key=JSON.stringify([items,q.clock?.playing]);if(key===signature)return;signature=key;
  if(!items.length){empty('Начни с любимой песни','Выбери трек в плеере. Здесь появится его очередь.');return;}
  $('content').replaceChildren();
  for(const [index,item] of items.entries()){
    const row=document.createElement('div');row.className='track'+(item.current?' current':'');
    const play=document.createElement('button');play.className='track-play';play.setAttribute('aria-label',(item.current&&q.clock?.playing?'Приостановить ':'Включить ')+item.title);
    const img=document.createElement('img');img.alt='';img.loading='lazy';if(/^[\w-]{11}$/.test(item.videoId))img.src='https://i.ytimg.com/vi/'+item.videoId+'/mqdefault.jpg';img.onerror=()=>{img.removeAttribute('src');img.classList.add('no-cover');};
    const text=document.createElement('span');text.className='track-copy';const name=document.createElement('strong');name.textContent=item.title;const artist=document.createElement('small');artist.textContent=item.artist||'YouTube Music';text.append(name,artist);play.append(img,text);
    play.onclick=()=>command('PLAY',{item:item.id,videoId:item.videoId,playing:!item.current||!q.clock?.playing});row.append(play);
    if(item.current){const indicator=document.createElement('span');indicator.className='playing-indicator';indicator.textContent=q.clock?.playing?'Ⅱ':'▶';row.append(indicator);}
    else{
      const menu=document.createElement('details');menu.className='track-menu';const summary=document.createElement('summary');summary.textContent='•••';summary.setAttribute('aria-label','Действия с '+item.title);menu.append(summary);
      const actions=document.createElement('div');actions.className='menu-items';
      if(index>0){const up=document.createElement('button');up.textContent='Поднять выше';up.onclick=()=>{menu.open=false;command('MOVE',{item:item.id,target:items[index-1].id,revision:queue.revision});};actions.append(up);}
      const remove=document.createElement('button');remove.textContent='Убрать из очереди';remove.onclick=()=>{menu.open=false;command('REMOVE',{item:item.id,revision:queue.revision});};actions.append(remove);menu.append(actions);row.append(menu);
    }
    $('content').append(row);
  }
  status(now?'Сейчас: '+now.title:'Выбери песню');
}
async function renderLyrics(q){
  const now=q.items?.find(item=>item.current);
  $('count').hidden=true;
  if(!now){resetLyrics();empty('Слова появятся здесь','Включи песню. Текст найдётся автоматически.');status('В такт музыке');$('credit').textContent='Тексты: LRCLIB';return;}
  status(now.title+' · '+(now.artist||''));
  // Metadata can arrive after the initial queue row. Retry when it becomes usable.
  const key=JSON.stringify([now.videoId,now.title,now.artist,Math.round((q.clock?.duration||0)/1000)]);
  if(key===trackKey||loading)return;
  trackKey=key;loading=true;const request=++requestId;lines=[];highlight=-1;
  empty('Ищем слова…','Находим текст и временные метки для этой версии песни.');
  $('credit').textContent='Название и исполнитель передаются LRCLIB';
  try{
    const data=await call(window.jam.lyrics({...now,duration:q.clock?.duration}));if(request!==requestId||!active)return;
    lines=data.lines||[];$('content').replaceChildren();
    if(lines.length){
      $('content').classList.add('synced');
      for(const line of lines){const button=document.createElement('button');button.className='line';button.textContent=line.text;button.title='Перейти к этой строке';button.onclick=()=>{manualScrollUntil=0;command('SEEK',{videoId:now.videoId,position:line.time});};$('content').append(button);}
      $('credit').textContent='LRCLIB · нажми строку, чтобы перемотать';tick();
    }else if(data.plain){const p=document.createElement('p');p.className='plain';p.textContent=data.plain;$('content').append(p);$('credit').textContent='LRCLIB · текст без временных меток';}
    else{empty(data.instrumental?'Без слов':'Пока без текста',data.instrumental?'Инструментальная композиция.':'У LRCLIB нет текста для этой версии песни. Можно попробовать другой трек.',()=>{resetLyrics();poll();});$('credit').textContent='Тексты: LRCLIB';}
  }catch(error){if(request===requestId){empty('Не удалось загрузить текст',error.message,()=>{resetLyrics();poll();});$('credit').textContent='Тексты: LRCLIB';}}
  finally{if(request===requestId)loading=false;}
}
function tick(){
  if(kind!=='lyrics'||!active||!clock||!lines.length)return;
  const position=(clock.position||0)+(clock.playing?Math.min(2000,performance.now()-receivedAt):0);
  let index=-1;for(let i=0;i<lines.length;i++){if(lines[i].time>position)break;index=i;}
  if(index===highlight)return;highlight=index;
  [...$('content').children].forEach((el,i)=>{el.classList.toggle('active',i===index);el.classList.toggle('past',i<index);});
  const current=$('content').children[index];
  if(current&&performance.now()>manualScrollUntil)$('content').scrollTo({top:Math.max(0,current.offsetTop-$('content').offsetTop-($('content').clientHeight-current.offsetHeight)/2),behavior:reduced?'instant':'smooth'});
}
async function poll(){
  if(polling||!active)return;polling=true;
  try{const q=await call(window.jam.queue());if(!q)return;queue=q;clock=q.clock;receivedAt=performance.now();if(kind==='lyrics')await renderLyrics(q);else renderQueue(q);}
  catch(error){status(error.message);}finally{polling=false;}
}
call(window.jam.panels()).then(value=>{active=!!value?.[kind];poll();}).catch(error=>status(error.message));
setInterval(poll,1100);setInterval(tick,100);

window.jam.onBackdrop(value=>{if(typeof value==='string'&&value.startsWith('data:image/png;base64,')&&!matchMedia('(prefers-reduced-transparency: reduce)').matches)document.body.style.setProperty('--backdrop','url("'+value+'")');});

window.jam.onAmbient(color=>{if(Array.isArray(color)&&color.length===3&&color.every(value=>Number.isInteger(value)&&value>=0&&value<=255))document.body.style.setProperty('--ambient',color.join(' '));});
