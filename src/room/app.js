'use strict';
const $ = id => document.getElementById(id);
const token = location.hash.slice(1) || sessionStorage.getItem('jam-token') || ''; if (token) sessionStorage.setItem('jam-token', token); history.replaceState(null, '', location.pathname);
let pending = false, signature = '', stopped = false, revision = '';
const uuid = () => { const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128; const h = Array.from(b, n => n.toString(16).padStart(2, '0')).join(''); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; };
const clientId = uuid();
function error(text = '') { $('error').hidden = !text; $('error').textContent = text; }
async function api(url, body) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'X-Jam-Client': clientId, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(35000) });
  const data = await response.json(); if (!response.ok || data.error) { if ([401,410].includes(response.status)) stopped = true; throw new Error(data.error || 'Не удалось подключиться'); } return data;
}
async function command(op, fields) {
  if (pending) return; pending = true; error();
  try { await api('/api/command', { id: uuid(), op, fields: { ...fields, ...(['MOVE','REMOVE'].includes(op) ? { revision } : {}) } }); await refresh(); } catch (e) { error(e.message); } finally { pending = false; }
}
function track(item, inQueue, previous) {
  const row = document.createElement('div'); row.className = 'track';
  const label = document.createElement('div'); label.className = 'label';
  const title = document.createElement('strong'); title.textContent = `${item.current ? '♫ ' : ''}${item.title || item.videoId}`;
  const artist = document.createElement('small'); artist.textContent = item.artist || item.duration || ''; label.append(title, artist);
  const button = document.createElement('button'); button.textContent = inQueue ? item.current ? 'Пауза / пуск' : 'Играть' : '+ В очередь';
  button.onclick = () => command(inQueue ? 'PLAY' : 'ADD', inQueue ? { item: item.id, videoId: item.videoId, playing: !item.current || !item.playing } : { videoId: item.videoId, title: item.title, artist: item.artist });
  row.append(label, button);
  if (inQueue && previous) { const move = document.createElement('button'); move.textContent='↑';move.className='quiet';move.setAttribute('aria-label','Поднять трек выше');move.onclick=()=>command('MOVE',{item:item.id,target:previous.id});row.append(move); }
  if (inQueue && !item.current) { const remove = document.createElement('button'); remove.textContent = '×'; remove.setAttribute('aria-label', `Удалить ${item.title || 'трек'}`); remove.className = 'quiet'; remove.onclick = () => command('REMOVE', { item: item.id }); row.append(remove); }
  return row;
}
async function refresh() {
  const data = await api('/api/state'); $('status').textContent = 'В комнате · звук у хоста';
  const items = data.queue?.items || [], playing = data.queue?.clock?.playing; revision = data.queue?.revision || '';
  const nextSignature = JSON.stringify([items, playing]);
  if (signature !== nextSignature) { signature = nextSignature; $('queue').replaceChildren(...items.map((i,index) => track({ ...i, playing }, true, items[index-1]))); if (!items.length) $('queue').textContent = 'Пока тихо. Добавь первый трек из поиска.'; }
}
$('search').onsubmit = async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true; error();
  try {
    const query = $('query').value.trim(); let videoId;
    try { const u = new URL(query); if (['youtu.be','www.youtube.com','youtube.com','music.youtube.com'].includes(u.hostname)) videoId = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v'); } catch {}
    const items = /^[\w-]{11}$/.test(videoId || '') ? [{ videoId, title: 'Добавить видео по ссылке' }] : (await api('/api/search?q=' + encodeURIComponent(query))).items;
    $('results').replaceChildren(...items.map(i => track(i, false))); if (!items.length) $('results').textContent = 'Ничего не найдено. Попробуй другое название.';
  } catch(e) { error(e.message); } finally { button.disabled = false; }
};
$('next').onclick = () => command('SKIP_NEXT', {});
async function poll() { try { await refresh(); } catch(e) { $('status').textContent = 'Нет подключения'; error(e.message); } if (!stopped) setTimeout(poll, 1800); }
if (!token) { error('Открой полную ссылку-приглашение от хоста.'); stopped = true; } else poll();
