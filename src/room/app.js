'use strict';
const $ = id => document.getElementById(id);
const token = location.hash.slice(1) || sessionStorage.getItem('jam-token') || ''; if (token) sessionStorage.setItem('jam-token', token); history.replaceState(null, '', location.pathname);
let currentQueue=null,toastTimer;
let pending = false, signature = '', stopped = false, revision = '', stateVersion=-1;
const uuid = () => { const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128; const h = Array.from(b, n => n.toString(16).padStart(2, '0')).join(''); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; };
const clientId = uuid();
function error(text = '') { $('error').hidden = !text; $('error').textContent = text; }
async function api(url, body) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'X-Jam-Client': clientId, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(35000) });
  const data = await response.json(); if (!response.ok || data.error) { if ([401,410].includes(response.status)) stopped = true; throw new Error(data.error || 'Не удалось подключиться'); } return data;
}
function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},2400);}
async function command(op, fields) {
  if (pending) return; pending = true; error();document.body.classList.add('pending');
  try { const result=await api('/api/command', { id: uuid(), op, fields: { ...fields, ...(['MOVE','REMOVE'].includes(op) ? { revision } : {}) } }); if(result.queue)apply(result);if(['ADD','PLAY_NEXT'].includes(op))notify('Добавлено в общую очередь');await refresh(); } catch (e) { error(e.message); } finally { pending = false;document.body.classList.remove('pending'); }
}
function track(item, inQueue, previous) {
  const row = document.createElement('div'); row.className = 'track'+(item.current?' current':'');
  const label = document.createElement('div'); label.className = 'label';
  const title = document.createElement('strong'); title.textContent = item.title || item.videoId;
  const artist = document.createElement('small'); artist.textContent = item.artist || item.duration || ''; label.append(title, artist);
  const button = document.createElement('button'); button.textContent = inQueue ? item.current ? (item.playing?'Ⅱ':'▶') : '▶' : '＋';button.setAttribute('aria-label',(inQueue?'Воспроизвести или приостановить ':'Добавить в очередь ')+(item.title||''));
  button.onclick = () => command(inQueue ? 'PLAY' : 'ADD', inQueue ? { item: item.id, videoId: item.videoId, playing: !item.current || !item.playing } : { videoId: item.videoId, title: item.title, artist: item.artist });
  const cover=document.createElement('img');cover.alt='';cover.loading='lazy';if(/^[\w-]{11}$/.test(item.videoId))cover.src='https://i.ytimg.com/vi/'+item.videoId+'/mqdefault.jpg';row.append(cover,label,button);
  const menu=document.createElement('details');menu.className='track-menu';const summary=document.createElement('summary');summary.textContent='•••';summary.setAttribute('aria-label','Действия с треком');menu.append(summary);const actions=document.createElement('div');actions.className='actions';menu.append(actions);if(inQueue&&!item.current)row.append(menu);
  if (inQueue && previous) { const move = document.createElement('button'); move.textContent='Поднять выше';move.className='quiet';move.setAttribute('aria-label','Поднять трек выше');move.onclick=()=>{menu.open=false;command('MOVE',{item:item.id,target:previous.id});};actions.append(move); }
  if (inQueue && !item.current) { const remove = document.createElement('button'); remove.textContent = 'Убрать из очереди'; remove.setAttribute('aria-label', `Удалить ${item.title || 'трек'}`); remove.className = 'quiet'; remove.onclick = () => {menu.open=false;command('REMOVE', { item: item.id });}; actions.append(remove); }
  return row;
}
async function refresh() {
  apply(await api('/api/state'));
}
function apply(data){
  if(Number.isFinite(data.version)&&data.version<stateVersion)return;if(Number.isFinite(data.version))stateVersion=data.version;
  currentQueue=data.queue;const now=data.queue?.items?.find(item=>item.current);$('guest-now').hidden=!now;if(now){$('guest-title').textContent=now.title;$('guest-artist').textContent=now.artist||'';const src='https://i.ytimg.com/vi/'+now.videoId+'/mqdefault.jpg';if($('guest-cover').src!==src)$('guest-cover').src=src;$('guest-play').textContent=data.queue.clock?.playing?'Ⅱ':'▶';$('guest-play').setAttribute('aria-label',data.queue.clock?.playing?'Пауза':'Воспроизвести');}
  $('status').textContent = 'В комнате · музыка у хоста';$('total').textContent=String(data.queue?.items?.length||0);
  const items = data.queue?.items || [], playing = data.queue?.clock?.playing; revision = data.queue?.revision || '';
  const nextSignature = JSON.stringify([items, playing]);
  $('next').disabled=!items.some((item,index)=>index>0&&items[index-1]?.current);
  if (signature !== nextSignature) { signature = nextSignature; $('queue').replaceChildren(...items.map((i,index) => track({ ...i, playing }, true, items[index-1]))); if (!items.length) $('queue').textContent = 'Пока тихо. Добавь первый трек из поиска.'; }
}
$('search').onsubmit = async event => {
  event.preventDefault(); const button = event.submitter||$('search').querySelector('button'); button.disabled = true; error();
  try {
    const query = $('query').value.trim();if(!query)return; $('results').textContent='Ищем музыку…';let videoId;
    try { const u = new URL(query); if (['youtu.be','www.youtube.com','youtube.com','music.youtube.com'].includes(u.hostname)) videoId = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v'); } catch {}
    const items = /^[\w-]{11}$/.test(videoId || '') ? [{ videoId, title: 'Добавить видео по ссылке' }] : (await api('/api/search?q=' + encodeURIComponent(query))).items;
    $('results').replaceChildren(...items.map(i => track(i, false))); if (!items.length) $('results').textContent = 'Ничего не найдено. Попробуй другое название.';
  } catch(e) { error(e.message); } finally { button.disabled = false; }
};
$('next').onclick = () => command('SKIP_NEXT', {});
async function poll() { try { await refresh(); } catch(e) { $('status').textContent = 'Нет подключения'; error(e.message); } if (!stopped) setTimeout(poll, 1800); }
if (!token) { error('Открой полную ссылку-приглашение от хоста.'); stopped = true; } else poll();

function section(key){$('search-section').hidden=key!=='search';$('queue-section').hidden=key!=='queue';for(const name of ['queue','search']){$('show-'+name).classList.toggle('active',name===key);$('show-'+name).setAttribute('aria-pressed',String(name===key));}if(key==='search')$('query').focus();}
$('show-queue').onclick=()=>section('queue');$('show-search').onclick=()=>section('search');

$('add-song').onclick=()=>section('search');
$('guest-play').onclick=()=>{const now=currentQueue?.items?.find(item=>item.current);if(now)command('PLAY',{item:now.id,videoId:now.videoId,playing:!currentQueue.clock?.playing});};
