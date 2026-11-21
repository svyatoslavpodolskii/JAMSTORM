'use strict';
const $ = id => document.getElementById(id);
let roomState={active:false,guests:0};
let state = { phase: 'idle', queue: null }, busy = false, lastQueueSignature = '', qrInvite = '';
const time = ms => { const s = Math.max(0, Math.floor((ms || 0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function message(text) { $('message').textContent = text || ''; $('message').hidden = !text; }
async function call(promise) { const result = await promise; if (!result.ok) throw new Error(result.error); return result.value; }
async function action(fn) {
  if (busy) return; busy = true; message(''); render(state);
  try { await fn(); } catch (error) { message(error.message || 'Не удалось выполнить действие'); }
  finally { busy = false; render(state); }
}
function current() { return state.queue?.items?.find(i => i.current)||state.queue?.nowPlaying; }
function render(next) {
  state = next;window.listening?.render(next.queue);
  const online = state.phase === 'connected'; const connecting = state.phase === 'connecting';
  $('status').textContent = connecting ? 'Подключаемся…' : state.role==='guest'&&online ? 'Музыка на телефоне' : roomState.active ? 'Комната открыта · гостей: '+((roomState.guests||0)+(state.peers||0)) : online ? 'Jam готов · участников: '+(state.peers||0) : state.phase==='error' ? 'Подключение прервано' : 'Личное прослушивание';
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
  $('add-form').hidden = connecting || (!state.queue?.native && state.role!=='guest');
  $('add').disabled = busy;
  const items = Array.isArray(state.queue?.items) ? state.queue.items : [];
  $('queue-count').textContent = `${items.length} треков`;
  $('empty').hidden = items.length > 0||!!state.queue?.nowPlaying; $('queue-content').hidden = !items.length&&!state.queue?.nowPlaying;
  const now = current(); const clock = state.queue?.clock || {};
  $('now-title').textContent = now?.title || 'Выбери трек'; $('now-artist').textContent = now?.artist || '';
  $('plays-on').textContent = state.role !== 'guest' ? 'Сейчас на этом ПК' : 'Сейчас на телефоне';
  $('queue-note').textContent = state.queue?.native ? 'Очередь YouTube Music · изменения видны в самом плеере' : state.role === 'guest' ? 'Очередь телефона · звук у хоста' : 'Включи трек в YouTube Music. Очередь TV экспериментальная.';
  if(now?.videoId) $('now-cover').src = window.artwork.cover(now);
  $('play').innerHTML = clock.playing ? '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor"><path d="M7 5h3v14H7zm7 0h3v14h-3z"/></svg>' : '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor"><path d="m8 5 12 7-12 7z"/></svg>'; $('play').setAttribute('aria-label', clock.playing ? 'Пауза' : 'Воспроизвести');
  for (const id of ['play', 'previous', 'next']) $(id).disabled = busy || connecting || !now;
  $('position').textContent = time(clock.position); $('duration').textContent = time(clock.duration);
  $('seek').disabled = busy || connecting || !now || !clock.duration;
  if (document.activeElement !== $('seek')) $('seek').value = clock.duration ? Math.round(clock.position / clock.duration * 1000) : 0;
  const signature = JSON.stringify(items);
  if (signature !== lastQueueSignature) {
    lastQueueSignature = signature; $('tracks').replaceChildren();
    items.forEach((item, index) => {
      const li = document.createElement('li'); li.className = `track${item.current ? ' current' : ''}`;
      const number = document.createElement('span'); number.className = 'track-index'; number.textContent = ''; const cover=document.createElement('img');cover.src=window.artwork.cover(item);cover.alt='';cover.loading='lazy';number.append(cover);
      const name = document.createElement('button'); name.className = 'track-name'; name.textContent = item.title || item.videoId || 'Без названия';
      const artist = document.createElement('small'); artist.textContent = item.artist || ''; name.append(artist);
      name.addEventListener('click', () => action(() => call(window.jam.command('PLAY', { item: item.id, videoId: item.videoId, playing: true }))));
      const remove = document.createElement('button'); remove.className = 'track-remove'; remove.textContent = '×'; remove.title = 'Удалить из очереди'; remove.setAttribute('aria-label', `Удалить ${item.title || 'трек'}`);
      remove.hidden=item.current; remove.addEventListener('click', () => action(() => call(window.jam.command('REMOVE', { item: item.id, revision: state.queue.revision }))));
      li.append(number, name, remove);window.listening?.drag(li,item,items); $('tracks').append(li);
    });
  }
  for (const button of document.querySelectorAll('.track button')) button.disabled = busy || connecting;
  if (state.error) message(state.error);
}
async function tab(value) {
  document.body.classList.toggle('queue-view',value==='jam');const result=await call(window.jam.tab(value));if(result?.mode){$('player-mode').value=result.mode;window.listening.mode(result.mode);}window.listening?.page(value);document.body.classList.toggle('player-view',value==='music'||value==='catalog');
  for(const [id,key] of [['queue-page','jam'],['invite-page','invite'],['settings-page','settings']]) $(id).hidden=value!==key;
  document.querySelector('.intro').textContent=({jam:'Всё, что хочется услышать дальше.',invite:'Один плеер. Каждый добавляет своё.',settings:'Пусть всё будет по-твоему.'})[value]||'';
  document.querySelector('main .page-heading h1').textContent=({jam:'Твоя очередь',invite:'Вместе звучит лучше',settings:'Настройки'})[value]||'Музыка';
  for (const name of ['music','catalog','jam','invite','settings']) { $(`${name}-tab`).classList.toggle('active', name === value); $(`${name}-tab`).setAttribute('aria-pressed', String(name === value)); }
}
window.jam.onLogin(text=>message(text));
$('music-login').onclick=()=>action(async()=>{await call(window.jam.login());});
$('catalog-tab').onclick=()=>action(()=>tab('catalog'));
$('music-tab').addEventListener('click', () => action(() => tab('music')));
$('jam-tab').addEventListener('click', () => action(() => tab('jam')));
$('open-music').addEventListener('click', () => action(async()=>{await tab('music');window.listening.search();}));
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
  if (value.phase === 'fallback') { $('player-mode').value='music';window.listening.mode('music');message(value.message); }
  if (value.phase === 'error') { $('player-error-text').textContent = value.message; $('player-error').hidden = false; tab('jam').catch(() => {}); }
  if (value.phase === 'ready') $('player-error').hidden = true;
});
call(window.jam.state()).then(render).catch(error => message(error.message));
// Appearance remains local; it never changes the remote site's privileges.
let glass = localStorage.getItem('glass') !== 'off';
function appearance() { document.body.classList.toggle('glass', glass); $('glass').setAttribute('aria-pressed', String(glass));$('glass').textContent=glass?'Включён':'Выключен';window.dispatchEvent(new Event('glass-change')); }
$('glass').onclick = () => { glass = !glass; localStorage.setItem('glass', glass ? 'on' : 'off'); appearance(); };
appearance(); $('player-mode').value='music';
$('player-mode').onchange = () => action(async () => { const mode=$('player-mode').value;window.listening.mode(mode);await call(window.jam.mode(mode));await tab(mode==='tv'?'catalog':'music'); });
window.jam.onMode(mode=>{ $('player-mode').value=mode;window.listening.mode(mode); });
let roomSignature = '';
async function roomRender(value) {
  roomState=value;render(state);$('invite-page').classList.toggle('sharing',!!value.active);document.querySelector('.room-panel h2').textContent=value.active?'Приглашение готово':'Хорошая музыка. Хорошая компания.';
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

$('settings-tab').onclick=()=>action(()=>tab('settings'));
$('queue-invite').onclick=()=>$('invite-tab').click();
$('invite-tab').onclick=()=>action(async()=>{await tab('invite');if(!roomState.active)await roomRender(await call(window.jam.room('start')));});
$('overlay-queue').onclick=()=>action(async()=>{await tab('music');panels(await call(window.jam.panel('queue')));});
$('overlay-lyrics').onclick=()=>action(async()=>{await tab('music');panels(await call(window.jam.panel('lyrics')));});
window.jam.onFullscreen(value=>document.body.classList.toggle('fullscreen',value));
let pollingQueue=false;
setInterval(async()=>{if(pollingQueue)return;pollingQueue=true;try{const queue=await call(window.jam.queue());if(queue)render({...state,queue});}catch{}finally{pollingQueue=false;}},1500);

function panels(value){for(const key of ['queue','lyrics'])$('overlay-'+key).setAttribute('aria-pressed',String(window.panelModes.normalize(value?.[key])!=='hidden'));}
window.jam.onPanel(panels);call(window.jam.panels()).then(panels).catch(()=>{});

const reducedTransparency=matchMedia('(prefers-reduced-transparency: reduce)').matches;
async function nativeMaterial(){const choice=localStorage.getItem('window-material')||'acrylic';$('window-material').value=choice;try{const result=await call(window.jam.material(glass&&!reducedTransparency?choice:'none'));document.body.classList.toggle('native-material',result.material!=='none');$('window-material').disabled=!result.supported;$('material-hint').textContent=result.supported?'Системное размытие Windows 11':'Нужна Windows 11 22H2 или новее';}catch{}}
$('window-material').onchange=()=>{localStorage.setItem('window-material',$('window-material').value);nativeMaterial();};
$('glass').addEventListener('click',nativeMaterial);nativeMaterial();
let visualMotion=localStorage.getItem('ambient-sound')!=='off'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
$('ambient-sound').checked=visualMotion;call(window.jam.visuals(visualMotion)).catch(()=>{});
$('ambient-sound').onchange=()=>{visualMotion=$('ambient-sound').checked;localStorage.setItem('ambient-sound',visualMotion?'on':'off');call(window.jam.visuals(visualMotion)).catch(()=>{});if(!visualMotion)window.playerEffects.level(0);};
window.jam.onAmbient(color=>{if(Array.isArray(color)&&color.length===3&&color.every(value=>Number.isInteger(value)&&value>=0&&value<=255))window.playerEffects.ambient(color);});
window.jam.onPalette(colors=>window.playerEffects.palette(colors));
window.jam.onLevel(level=>{if(visualMotion)window.playerEffects.level(level);});

for(const button of document.querySelectorAll('#fullscreen-nav [data-page]'))button.onclick=()=>action(()=>tab(button.dataset.page));
window.jam.onSearch?.(()=>action(async()=>{await tab('music');window.listening.search();}));
window.jam.onCast?.(()=>action(async()=>{await tab('settings');$('cast-dialog').showModal();}));
$('cast-close').onclick=()=>$('cast-dialog').close();$('cast-browser').onclick=()=>call(window.jam.openBrowser()).catch(error=>message(error.message));$('cast-room').onclick=()=>{$('cast-dialog').close();$('invite-tab').click();};
async function loadPolicy(){try{const value=await call(window.jam.policy());for(const [id,key] of [['block-explicit','blockExplicit'],['hide-explicit','hideExplicit'],['guest-reorder','guestReorder']])$(id).checked=value[key];$('guest-limit').value=value.guestLimit;}catch(error){message(error.message);}}
for(const id of ['block-explicit','hide-explicit','guest-reorder','guest-limit'])$(id).onchange=async()=>{try{await call(window.jam.policy({blockExplicit:$('block-explicit').checked,hideExplicit:$('hide-explicit').checked,guestReorder:$('guest-reorder').checked,guestLimit:Number($('guest-limit').value)}));}catch(error){message(error.message);await loadPolicy();}};
loadPolicy();

function navigation(value){for(const key of ['back','forward'])for(const button of document.querySelectorAll('[data-navigation="'+key+'"]')){button.disabled=!value[key];if(key==='back'){button.title=value.tv?'Назад в YouTube TV (Esc)':'Назад';button.setAttribute('aria-label',button.title);}}}
for(const button of document.querySelectorAll('[data-navigation]'))button.onclick=()=>action(async()=>navigation(await call(window.jam.navigate(button.dataset.navigation))));
window.jam.onNavigation(navigation);call(window.jam.navigation()).then(navigation).catch(()=>{});

let availableUpdate=false;
$('update-check').onclick=()=>action(async()=>{
 const button=$('update-check');button.disabled=true;
 if(availableUpdate)button.textContent='Загрузка…';
 try{const value=await call(window.jam.update(availableUpdate));availableUpdate=!!value.available&&!!value.canInstall;button.textContent=availableUpdate?'Установить и перезапустить':'Проверить';$('update-hint').textContent=value.available?'Доступна версия '+value.version+(value.canInstall?'':' · скачай установщик с GitHub'):'Установлена актуальная версия';}
 finally{button.disabled=false;}
});
async function checkUpdates(){try{const value=await call(window.jam.update(false));if(value.available){availableUpdate=!!value.canInstall;$('update-hint').textContent='Доступна версия '+value.version;$('update-check').textContent=availableUpdate?'Установить и перезапустить':'Проверить';}}catch{}}
setTimeout(checkUpdates,8000);setInterval(checkUpdates,6*60*60*1000);
