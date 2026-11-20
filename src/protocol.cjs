'use strict';
const net = require('node:net');
const { randomBytes, randomUUID, createHmac, createCipheriv, createDecipheriv, timingSafeEqual } = require('node:crypto');
const LIMIT = 1048576;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const utf = (s) => Buffer.from(s, 'utf8');
const cat = (...b) => Buffer.concat(b.map(v => typeof v === 'string' ? utf(v) : v));
const hmac = (key, ...data) => createHmac('sha256', key).update(cat(...data)).digest();
function base64(text) {
  if (typeof text !== 'string' || !/^[\w-]+$/.test(text)) throw new Error('Некорректное приглашение');
  const bytes = Buffer.from(text, 'base64url');
  if (bytes.toString('base64url') !== text) throw new Error('Некорректная кодировка приглашения');
  return bytes;
}
function localAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  return net.isIP(address) === 6 && /^(f[cd]|fe[89ab])/i.test(address);
}
function parseInvite(value, now = Date.now()) {
  if (typeof value !== 'string' || value.length > 1024) throw new Error('Вставь ссылку morphejam://join из Jam-Layer');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Вставь ссылку morphejam://join из Jam-Layer'); }
  if (url.protocol !== 'morphejam:' || url.hostname !== 'join' || url.hash || url.username || url.password) throw new Error('Это не приглашение Jam-Layer');
  const p = url.searchParams;
  for (const key of p.keys()) if (p.getAll(key).length !== 1) throw new Error('Повторяющиеся поля приглашения');
  if (!['1', '2'].includes(p.get('v')) || !uuid.test(p.get('jam') || '')) throw new Error('Неизвестная версия или идентификатор Jam');
  const secret = base64(p.get('secret'));
  const expires = Number(p.get('exp'));
  if (secret.length !== 32 || !Number.isSafeInteger(expires) || expires <= now || expires > now + 13 * 3600000) throw new Error('Приглашение истекло или повреждено');
  const endpoints = [];
  if (p.get('v') === '2' && p.has('ep')) {
    const hints = p.get('ep').split(',');
    if (hints.length > 4) throw new Error('Слишком много адресов в приглашении');
    for (const hint of hints) {
      const [encoded, portText, extra] = hint.split('.');
      const bytes = base64(encoded);
      if (![4, 16].includes(bytes.length) || extra !== undefined || !/^\d+$/.test(portText)) throw new Error('Некорректный адрес в приглашении');
      const host = bytes.length === 4 ? [...bytes].join('.') : Array.from({ length: 8 }, (_, i) => bytes.readUInt16BE(i * 2).toString(16)).join(':');
      const port = Number(portText);
      if (!localAddress(host) || port < 1 || port > 65535) throw new Error('Приглашение должно содержать адрес локальной сети');
      endpoints.push({ host, port });
    }
  }
  return { jamId: p.get('jam'), secret, expires, endpoints };
}

// TCP framing: signed-positive big-endian length followed by one complete record.
class Frames {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.queue = [];
    this.pending = null;
    this.failure = null;
    socket.setNoDelay(true);
    socket.on('data', data => {
      this.buffer = cat(this.buffer, data);
      while (this.buffer.length >= 4) {
        const size = this.buffer.readInt32BE();
        if (size < 1 || size > LIMIT) return this.close(new Error('Недопустимый размер сетевого пакета'));
        if (this.buffer.length < size + 4) break;
        const frame = Buffer.from(this.buffer.subarray(4, size + 4));
        this.buffer = this.buffer.subarray(size + 4);
        if (this.queue.length >= 16) return this.close(new Error('Слишком много входящих пакетов'));
        this.queue.push(frame);
        this.deliver();
      }
    });
    socket.on('error', () => this.close(new Error('Соединение с устройством прервано')));
    socket.on('close', () => this.close(new Error('Устройство отключилось')));
    socket.on('end', () => this.close(new Error('Устройство закрыло соединение')));
  }
  deliver() {
    if (!this.pending) return;
    if (this.failure) { const p = this.pending; this.pending = null; clearTimeout(p.timer); p.reject(this.failure); }
    else if (this.queue.length) {
      const p = this.pending; this.pending = null; clearTimeout(p.timer);
      const frame = this.queue.shift();
      if (frame.length > p.max) { const e = new Error('Пакет превышает допустимый размер'); p.reject(e); this.close(e); }
      else p.resolve(frame);
    }
  }
  read(max = LIMIT, timeout = 45000) {
    if (this.pending) return Promise.reject(new Error('Concurrent reads are forbidden'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.close(new Error('Устройство не ответило вовремя')), timeout);
      this.pending = { resolve, reject, max, timer }; this.deliver();
    });
  }
  write(frame) {
    if (this.failure) throw this.failure;
    if (!frame.length || frame.length > LIMIT) throw new Error('Frame limit');
    const size = Buffer.alloc(4); size.writeInt32BE(frame.length);
    this.socket.write(cat(size, frame));
  }
  close(error = new Error('Соединение закрыто')) {
    if (!this.failure) this.failure = error;
    this.deliver(); this.socket.destroy(); this.queue = []; this.buffer = Buffer.alloc(0);
  }
}
function crypt(encrypt, key, direction, sequence, data) {
  const nonce = Buffer.alloc(12); nonce.writeInt32BE(direction); nonce.writeBigInt64BE(sequence, 4);
  const cipher = encrypt ? createCipheriv('aes-256-gcm', key, nonce) : createDecipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(cat('morphejam/1', nonce));
  if (!encrypt) cipher.setAuthTag(data.subarray(-16));
  const result = cat(cipher.update(encrypt ? data : data.subarray(0, -16)), cipher.final());
  return encrypt ? cat(result, cipher.getAuthTag()) : result;
}
class SecureChannel {
  static async open(frames, invite, { host = false, identity = randomUUID() } = {}) {
    if (!uuid.test(identity) || invite.secret.length !== 32) throw new Error('Invalid channel identity');
    const prefix = `MORPHEJAM/1:${invite.jamId}:`;
    let hostNonce, clientNonce, transcript;
    try {
      if (host) {
        hostNonce = randomBytes(32); frames.write(cat(prefix, hostNonce));
        const hello = await frames.read(128, 15000);
        if (hello.length !== 100) throw new Error('Client hello');
        clientNonce = hello.subarray(0, 32); identity = hello.subarray(32, 68).toString('ascii');
        if (!uuid.test(identity)) throw new Error('Client identity');
        transcript = cat(prefix + identity, hostNonce, clientNonce);
        if (!timingSafeEqual(hello.subarray(68), hmac(invite.secret, 'client', transcript))) throw new Error('Authentication failed');
        frames.write(hmac(invite.secret, 'host', transcript));
      } else {
        const challenge = await frames.read(128, 15000);
        if (challenge.length !== Buffer.byteLength(prefix) + 32 || !challenge.subarray(0, -32).equals(utf(prefix))) throw new Error('Protocol/session mismatch');
        hostNonce = challenge.subarray(-32); clientNonce = randomBytes(32);
        transcript = cat(prefix + identity, hostNonce, clientNonce);
        frames.write(cat(clientNonce, identity, hmac(invite.secret, 'client', transcript)));
        const proof = await frames.read(32, 15000);
        if (proof.length !== 32 || !timingSafeEqual(proof, hmac(invite.secret, 'host', transcript))) throw new Error('Host authentication failed');
      }
      const prk = hmac(cat(hostNonce, clientNonce), invite.secret);
      const clientKey = hmac(prk, `morphejam-v1-client:${invite.jamId}${identity}`, Buffer.from([1]));
      const hostKey = hmac(prk, `morphejam-v1-host:${invite.jamId}${identity}`, Buffer.from([1])); prk.fill(0);
      return new SecureChannel(frames, identity, host ? hostKey : clientKey, host ? clientKey : hostKey, host ? 2 : 1);
    } catch (error) { frames.close(); throw error; }
  }
  constructor(frames, identity, txKey, rxKey, direction) {
    Object.assign(this, { frames, identity, txKey, rxKey, direction }); this.sent = 0n; this.received = 0n;
  }
  send(value) {
    const data = utf(JSON.stringify(value));
    if (data.length > LIMIT - 24 || this.sent >= 0x7ffffffffffffffen) throw new Error('Frame limit');
    const seq = ++this.sent; const header = Buffer.alloc(8); header.writeBigInt64BE(seq);
    this.frames.write(cat(header, crypt(true, this.txKey, this.direction, seq, data)));
  }
  async receive() {
    try {
      const frame = await this.frames.read();
      if (frame.length < 24) throw new Error('Truncated frame');
      const seq = frame.readBigInt64BE();
      if (seq !== this.received + 1n || seq <= 0n) throw new Error('Replay or sequence gap');
      const plain = crypt(false, this.rxKey, this.direction === 1 ? 2 : 1, seq, frame.subarray(8));
      const value = JSON.parse(plain.toString('utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid JSON response');
      this.received = seq; return value;
    } catch (error) { this.close(); throw error; }
  }
  close() { this.txKey.fill(0); this.rxKey.fill(0); this.frames.close(); }
}
module.exports = { Frames, SecureChannel, parseInvite, localAddress, LIMIT, uuid };
