'use strict';
const $ = id => document.getElementById(id);
let state = { phase: 'idle', queue: null }, busy = false, lastQueueSignature = '', qrInvite = '';
const time = ms => { const s = Math.max(0, Math.floor((ms || 0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function message(text) { $('message').textContent = text || ''; $('message').hidden = !text; }
async function call(promise) { const result = await promise; if (!result.ok) throw new Error(result.error); return result.value; }
async function action(fn) {
  if (busy) return; busy = true; message(''); render(state);
  try { await fn(); } catch (error) { message(error.message || 'Не удалось выполнить действие'); }
  finally { busy = false; render(state); }
}
function current() { return state.queue?.items?.find(i => i.current); }
function render(next) {
  state = next;
  const online = state.phase === 'connected'; const connecting = state.phase === 'connecting';
  $('status').textContent = connecting ? 'Подключение…' : online ? state.role === 'host' ? `ПК играет · участников: ${state.peers || 0}` : 'Подключено к телефону' : state.phase === 'error' ? 'Не удалось подключиться' : 'Нет подключения';
  $('status').classList.toggle('online', online); $('peer-dot').classList.toggle('online', online);
  $('host').disabled = busy || connecting || online; $('join').disabled = busy || connecting || online; $('invite').disabled = connecting || online;
  $('leave').hidden = !online && !connecting; $('leave').textContent = connecting ? 'Отменить подключение' : state.role === 'host' ? 'Завершить Jam' : 'Отключиться';
  $('host-invite').hidden = !state.invite; $('share-invite').value = state.invite || '';
  if (state.invite !== qrInvite) {
    qrInvite = state.invite; $('invite-qr').hidden = true;
    if (qrInvite) { const expected = qrInvite; call(window.jam.qr()).then(data => {
      if (qrInvite === expected) { $('invite-qr').src = data; $('invite-qr').hidden = false; }
    }).catch(error => message(error.message)); }
  }
  $('add-form').hidden = !online;
  $('add').disabled = busy;
  const items = Array.isArray(state.queue?.items) ? state.queue.items : [];
  $('queue-count').textContent = `${items.length} треков`;
  $('empty').hidden = items.length > 0; $('queue-content').hidden = !items.length;
  const now = current(); const clock = state.queue?.clock || {};
  $('now-title').textContent = now?.title || 'Выбери трек'; $('now-artist').textContent = now?.artist || '';
  $('plays-on').textContent = state.role === 'host' ? 'ИГРАЕТ НА ЭТОМ ПК' : 'ИГРАЕТ НА ТЕЛЕФОНЕ';
  $('queue-note').textContent = state.role === 'host' ? 'Очередь Jam ведётся здесь. Добавляй треки по ссылкам или с телефона. Радио и плейлисты YouTube Music не импортируются.' : 'Это очередь телефона. Команды выполняет хост; звук на ПК выключен.';
  $('play').textContent = clock.playing ? 'Ⅱ' : '▶'; $('play').setAttribute('aria-label', clock.playing ? 'Пауза' : 'Воспроизвести');
  for (const id of ['play', 'previous', 'next']) $(id).disabled = busy || !online || !now;
  $('position').textContent = time(clock.position); $('duration').textContent = time(clock.duration);
  $('seek').disabled = busy || !online || !now || !clock.duration;
  if (document.activeElement !== $('seek')) $('seek').value = clock.duration ? Math.round(clock.position / clock.duration * 1000) : 0;
  const signature = JSON.stringify(items);
  if (signature !== lastQueueSignature) {
    lastQueueSignature = signature; $('tracks').replaceChildren();
    items.forEach((item, index) => {
      const li = document.createElement('li'); li.className = `track${item.current ? ' current' : ''}`;
      const number = document.createElement('span'); number.className = 'track-index'; number.textContent = item.current ? '♫' : String(index + 1);
      const name = document.createElement('button'); name.className = 'track-name'; name.textContent = item.title || item.videoId || 'Без названия';
      const artist = document.createElement('small'); artist.textContent = item.artist || ''; name.append(artist);
      name.addEventListener('click', () => action(() => call(window.jam.command('PLAY', { item: item.id, videoId: item.videoId, playing: true }))));
      const remove = document.createElement('button'); remove.className = 'track-remove'; remove.textContent = '×'; remove.title = 'Удалить из очереди'; remove.setAttribute('aria-label', `Удалить ${item.title || 'трек'}`);
      remove.addEventListener('click', () => action(() => call(window.jam.command('REMOVE', { item: item.id }))));
      li.append(number, name, remove); $('tracks').append(li);
    });
  }
  for (const button of document.querySelectorAll('.track button')) button.disabled = busy || !online;
  if (state.error) message(state.error);
}
async function tab(value) {
  await call(window.jam.tab(value));
  for (const name of ['music', 'jam']) { $(`${name}-tab`).classList.toggle('active', name === value); $(`${name}-tab`).setAttribute('aria-pressed', String(name === value)); }
}
$('music-tab').addEventListener('click', () => action(() => tab('music')));
$('jam-tab').addEventListener('click', () => action(() => tab('jam')));
$('open-music').addEventListener('click', () => action(() => tab('music')));
$('host').addEventListener('click', () => action(async () => render(await call(window.jam.host()))));
$('join-form').addEventListener('submit', event => { event.preventDefault(); action(async () => { const result = await call(window.jam.join($('invite').value)); if (result.phase === 'connected') $('invite').value = ''; render(result); }); });
// Cancellation must remain possible while join is in flight.
$('leave').addEventListener('click', async () => { try { render(await call(window.jam.leave())); } catch (e) { message(e.message); } });
$('copy').addEventListener('click', () => action(async () => { await call(window.jam.copy()); message('Приглашение скопировано. Отправь его на телефон.'); }));
$('play').addEventListener('click', () => action(async () => { const now = current(); if (now) await call(window.jam.command('PLAY', { item: now.id, videoId: now.videoId, playing: !state.queue.clock?.playing })); }));
for (const [id, op] of [['previous', 'SKIP_PREVIOUS'], ['next', 'SKIP_NEXT']]) $(id).addEventListener('click', () => action(() => call(window.jam.command(op, {}))));
$('seek').addEventListener('change', () => action(() => call(window.jam.command('SEEK', { videoId: current()?.videoId, position: Math.round(Number($('seek').value) / 1000 * state.queue.clock.duration) }))));
$('add-form').addEventListener('submit', event => {
  event.preventDefault(); action(async () => {
    const text = $('video').value.trim(); let video = text;
    if (!/^[\w-]{11}$/.test(video)) {
      let url; try { url = new URL(text); } catch { throw new Error('Вставь ссылку на трек YouTube Music или YouTube'); }
      if (url.protocol !== 'https:' || !['music.youtube.com', 'www.youtube.com', 'youtube.com', 'youtu.be'].includes(url.hostname)) throw new Error('Нужна ссылка YouTube Music или YouTube');
      video = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
    }
    if (!/^[\w-]{11}$/.test(video || '')) throw new Error('Не найден идентификатор трека');
    await call(window.jam.command('ADD', { videoId: video })); $('video').value = '';
  });
});
$('retry-player').addEventListener('click', () => action(async () => { $('player-error').hidden = true; await call(window.jam.retry()); await tab('music'); }));
window.jam.onState(render);
window.jam.onPlayer(value => {
  if (value.phase === 'fallback') { $('player-mode').value='music';message(value.message); }
  if (value.phase === 'error') { $('player-error-text').textContent = value.message; $('player-error').hidden = false; tab('jam').catch(() => {}); }
  if (value.phase === 'ready') $('player-error').hidden = true;
});
call(window.jam.state()).then(render).catch(error => message(error.message));
// Appearance remains local; it never changes the remote site's privileges.
let glass = localStorage.getItem('glass') !== 'off';
function appearance() { document.body.classList.toggle('glass', glass); $('glass').setAttribute('aria-pressed', String(glass)); }
$('glass').onclick = () => { glass = !glass; localStorage.setItem('glass', glass ? 'on' : 'off'); appearance(); };
appearance(); $('music-tab').textContent = 'Плеер'; $('open-music').textContent = 'Открыть ТВ-плеер ↗';
$('empty').querySelector('h2').textContent = 'Очередь пока пуста';
$('empty').querySelector('p').textContent = 'Включи трек в ТВ-плеере или открой браузерную комнату и добавь музыку с телефона.';
$('player-mode').onchange = () => action(async () => { await call(window.jam.mode($('player-mode').value)); await tab('music'); });
let roomSignature = '';
async function roomRender(value) {
  $('room-start').hidden = value.active; $('room-share').hidden = !value.active;
  const url = value.publicUrl || value.url || '';
  $('room-url').value = url;
  $('room-internet').hidden = !!value.publicUrl; $('room-local').hidden = !value.publicUrl;
  $('room-scope').textContent = value.publicUrl ? `Доступно через интернет · гостей: ${value.guests || 0}` : `Одна Wi-Fi-сеть · гостей: ${value.guests || 0}`;
  if (url !== roomSignature) { roomSignature = url; $('room-qr').hidden = true; if (url) { const expected = url; const data = await call(window.jam.room('qr')); if (roomSignature === expected) { $('room-qr').src = data; $('room-qr').hidden = false; } } }
}
for (const [id, command] of [['room-start','start'],['room-stop','stop'],['room-internet','internet'],['room-local','local']]) $(id).onclick = () => action(async () => { $(id).disabled = true; const previous = $(id).textContent; if (command === 'internet') $(id).textContent = 'Создаём интернет-ссылку…'; try { await roomRender(await call(window.jam.room(command))); } finally { $(id).disabled = false; $(id).textContent = previous; } });
$('room-copy').onclick = () => action(async () => { await call(window.jam.room('copy')); message('Ссылка скопирована.'); });
setInterval(() => call(window.jam.room('state')).then(roomRender).catch(() => {}), 2500);
call(window.jam.addons()).then(settings => { for (const key of ['sponsorblock','adblock']) $(`addon-${key}`).checked = settings[key]; }).catch(error=>message(error.message));
for (const key of ['sponsorblock','adblock']) $(`addon-${key}`).onchange = async event => { const input=event.target; input.disabled=true; try { await call(window.jam.setAddon(key,input.checked)); } catch(error) { input.checked=!input.checked;message(error.message); } finally {input.disabled=false;} };
