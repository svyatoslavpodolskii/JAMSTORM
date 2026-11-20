'use strict';
const dgram = require('node:dgram');
const os = require('node:os');
const { randomBytes } = require('node:crypto');
function packet(jamId, nonce, port = 0) {
  const b = Buffer.alloc(32); b.writeUInt32BE(0x4d4a5032); b[4] = 2; b[5] = port ? 2 : 1;
  Buffer.from(jamId.replaceAll('-', ''), 'hex').copy(b, 6); nonce.copy(b, 22); b.writeUInt16BE(port, 30); return b;
}
function matches(b, jamId, nonce, offer) {
  return b.length === 32 && b.readUInt32BE() === 0x4d4a5032 && b[4] === 2 && b[5] === (offer ? 2 : 1) &&
    b.subarray(6, 22).equals(Buffer.from(jamId.replaceAll('-', ''), 'hex')) &&
    (!nonce || b.subarray(22, 30).equals(nonce)) && (offer ? b.readUInt16BE(30) > 0 : b.readUInt16BE(30) === 0);
}
function addresses() {
  return Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal);
}
function broadcast(a) {
  return a.address.split('.').map((v, i) => Number(v) | (255 ^ Number(a.netmask.split('.')[i]))).join('.');
}
function discover(jamId, { signal, timeout = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4'); const nonce = randomBytes(8); let settled = false;
    const finish = (error, value) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      try { socket.close(); } catch {} error ? reject(error) : resolve(value);
    };
    const abort = () => finish(new Error('Подключение отменено'));
    const timer = setTimeout(() => finish(new Error('Телефон не найден. Подключи устройства к одной Wi-Fi сети и создай новое приглашение.')), timeout);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) return abort();
    socket.on('error', () => finish(new Error('Не удалось выполнить поиск по локальной сети')));
    socket.on('message', (b, remote) => {
      if (matches(b, jamId, nonce, true)) finish(null, { host: remote.address, port: b.readUInt16BE(30) });
    });
    socket.bind(0, '0.0.0.0', () => {
      socket.setBroadcast(true);
      for (const host of new Set(['255.255.255.255', ...addresses().map(broadcast)])) socket.send(packet(jamId, nonce), 39548, host);
    });
  });
}
function advertise(jamId, port) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  socket.on('error', () => {}); // Invitation hints still work if UDP is unavailable.
  let count = 0; let windowStart = 0;
  socket.on('message', (b, remote) => {
    if (!matches(b, jamId, null, false)) return;
    if (Date.now() - windowStart > 1000) { count = 0; windowStart = Date.now(); }
    if (++count <= 32) socket.send(packet(jamId, b.subarray(22, 30), port), remote.port, remote.address);
  });
  socket.bind(39548, '0.0.0.0');
  return { close() { try { socket.close(); } catch {} } };
}
module.exports = { packet, matches, addresses, discover, advertise };
