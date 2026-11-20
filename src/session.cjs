'use strict';
const net = require('node:net');
const { EventEmitter } = require('node:events');
const { randomUUID, randomBytes } = require('node:crypto');
const { Frames, SecureChannel, parseInvite, localAddress } = require('./protocol.cjs');
const { discover, advertise, addresses } = require('./discovery.cjs');

class JamSession extends EventEmitter {
  constructor(identity = randomUUID()) {
    super(); this.identity = identity; this.generation = 0; this.state = { version:0, phase: 'idle', role: null, queue: null, peers: 0 }; this.tail = Promise.resolve();
    this.sockets = new Set(); this.channels = new Set(); this.peers = new Map(); this.hostCommands = new Map();
  }
  update(value) { Object.assign(this.state, value); this.state.version++; this.emit('state', this.view()); }
  view() { return structuredClone(this.state); }
  disconnect() {
    this.generation++; this.abort?.abort(); clearTimeout(this.poll); clearTimeout(this.expiryTimer);
    this.channel?.close(); this.channel = null;
    for (const c of this.channels) c.close(); this.channels.clear();
    for (const s of this.sockets) s.destroy(); this.sockets.clear(); this.peers.clear(); this.hostCommands.clear();
    this.server?.close(); this.server = null; this.advertiser?.close(); this.advertiser = null;
    this.invite?.secret.fill(0); this.invite = null;
    this.update({ phase: 'idle', role: null, queue: null, peers: 0, invite: null, error: null, endpoint: null });
  }
  armExpiry(invite, generation) {
    this.expiryTimer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.disconnect(); this.update({ phase: 'error', error: 'Сессия истекла. Создай новое приглашение.' });
    }, Math.max(1, invite.expires - Date.now()));
  }
  async connect(endpoint, invite, generation, signal) {
    const socket = net.createConnection(endpoint); this.sockets.add(socket);
    socket.on('close', () => this.sockets.delete(socket));
    const frames = new Frames(socket);
    const abort = () => frames.close(new Error('Подключение отменено'));
    signal.addEventListener('abort', abort, { once: true });
    try {
      if (signal.aborted || generation !== this.generation) throw new Error('Подключение отменено');
      const channel = await SecureChannel.open(frames, invite, { identity: this.identity });
      if (generation !== this.generation) { channel.close(); throw new Error('Подключение отменено'); }
      return channel;
    } catch (e) { frames.close(); throw e; }
    finally { signal.removeEventListener('abort', abort); }
  }
  async join(value) {
    const invite = parseInvite(value); this.disconnect(); this.invite = invite;
    const generation = this.generation; this.abort = new AbortController(); this.armExpiry(invite, generation);
    this.update({ phase: 'connecting', role: 'guest', error: null });
    try {
      let channel, endpoint;
      for (const candidate of invite.endpoints) {
        if (generation !== this.generation) return this.view();
        try { channel = await this.connect(candidate, invite, generation, this.abort.signal); endpoint = candidate; break; } catch {}
      }
      if (!channel) {
        endpoint = await discover(invite.jamId, { signal: this.abort.signal });
        channel = await this.connect(endpoint, invite, generation, this.abort.signal);
      }
      if (generation !== this.generation) { channel.close(); return this.view(); }
      this.channel = channel;
      this.update({ phase: 'connected', endpoint: `${endpoint.host}:${endpoint.port}` });
      await this.sync(generation); return this.view();
    } catch (error) {
      if (generation === this.generation) { this.disconnect(); this.update({ phase: 'error', error: error.message }); }
      return this.view();
    }
  }
  request(command) {
    const generation = this.generation;
    const result = this.tail.catch(() => {}).then(async () => {
      if (generation !== this.generation || !this.channel) throw new Error('Нет подключения к Jam');
      this.channel.send(command); return await this.channel.receive();
    });
    this.tail = result; return result;
  }
  async sync(generation) {
    try {
      const value = await this.request({ op: 'SYNC', revision: this.state.queue?.revision || '' });
      if (generation !== this.generation) return;
      if (!value.ok) this.update({ error: value.error || 'Очередь телефона недоступна' });
      else if (value.items) this.update({ queue: value, error: null });
      else if (value.clock && this.state.queue) this.update({ queue: { ...this.state.queue, clock: value.clock }, error: null });
      if (generation === this.generation) this.poll = setTimeout(() => this.sync(generation), 1500);
    } catch {
      if (generation === this.generation) { this.disconnect(); this.update({ phase: 'error', error: 'Связь с телефоном потеряна. Подключись по приглашению снова.' }); }
    }
  }
  async command(op, fields = {}) {
    const allowed = ['ADD', 'PLAY_NEXT', 'REMOVE', 'MOVE', 'PLAY', 'SEEK', 'SKIP_NEXT', 'SKIP_PREVIOUS'];
    if (!allowed.includes(op)) throw new Error('Unsupported command');
    const generation = this.generation;
    const request = { ...fields, op, id: randomUUID() };
    if (['MOVE', 'REMOVE'].includes(op)) {
      if (!this.state.queue?.revision) throw new Error('Сначала обнови очередь');
      if (fields.revision !== undefined && fields.revision !== this.state.queue.revision) throw new Error('Очередь изменилась. Повтори действие после обновления.');
      request.revision = this.state.queue.revision;
    }
    const result = this.state.role === 'host' ? await this.adapter(request) : await this.request(request);
    if (generation === this.generation && result.items) this.update({ queue: result });
    if (!result.ok) throw new Error(result.error || 'Команда отклонена');
    return result;
  }
  async host(adapter) {
    this.disconnect(); const generation = this.generation; this.adapter = adapter;
    const invite = { jamId: randomUUID(), secret: randomBytes(32), expires: Date.now() + 12 * 3600000 };
    this.invite = invite; this.armExpiry(invite, generation);
    this.update({ phase: 'connecting', role: 'host', error: null });
    const server = net.createServer(socket => {
      // Bound unauthenticated handshakes and ignore public-network clients.
      const remote = socket.remoteAddress?.replace(/^::ffff:/, '');
      if (!localAddress(remote) || this.sockets.size >= 16) return socket.destroy();
      this.sockets.add(socket); socket.on('close', () => this.sockets.delete(socket));
      this.serve(socket, invite, generation).catch(() => {});
    });
    this.server = server;
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '0.0.0.0', resolve); });
      if (generation !== this.generation) { server.close(); return this.view(); }
      server.on('error', () => { if (generation === this.generation) { this.disconnect(); this.update({ phase: 'error', error: 'Не удалось сохранить сетевую сессию' }); } });
      const port = server.address().port;
      const endpoints = addresses().filter(a => localAddress(a.address)).slice(0, 4);
      if (!endpoints.length) throw new Error('Подключи ПК к локальной сети Wi-Fi или Ethernet');
      const hints = endpoints.map(a => `${Buffer.from(a.address.split('.').map(Number)).toString('base64url')}.${port}`).join(',');
      const uri = `morphejam://join?v=2&jam=${invite.jamId}&secret=${invite.secret.toString('base64url')}&exp=${invite.expires}&ep=${hints}`;
      this.advertiser = advertise(invite.jamId, port);
      this.update({ phase: 'connected', role: 'host', invite: uri, endpoint: `${endpoints[0].address}:${port}` });
      const refresh = async () => {
        try { const queue = await adapter({ op: 'SNAPSHOT' }); if (generation === this.generation) this.update({ queue, error: queue.ok ? null : queue.error }); } catch { /* Next poll retries the local player. */ }
        if (generation === this.generation) this.poll = setTimeout(refresh, 1500);
      };
      await refresh(); return this.view();
    } catch (e) { if (generation === this.generation) { this.disconnect(); this.update({ phase: 'error', error: e.message }); } return this.view(); }
  }
  async serve(socket, invite, generation) {
    let channel;
    try {
      channel = await SecureChannel.open(new Frames(socket), invite, { host: true });
      if (generation !== this.generation) return;
      this.channels.add(channel); this.peers.set(channel.identity, (this.peers.get(channel.identity) || 0) + 1);
      this.update({ peers: this.peers.size });
      while (generation === this.generation && invite.expires > Date.now()) {
        const command = await channel.receive(); let response;
        if (command.op === 'PING') response = { ok: true };
        else if (command.op === 'CHANNEL') {
          // Advertise no warm-backup support: Android falls back to its legacy
          // single-primary path. Do not claim channel authority we don't enforce.
          response = { ok: false, version: 1 };
        } else if (['SYNC', 'SNAPSHOT'].includes(command.op)) {
          response = await this.adapter({ op: 'SNAPSHOT' });
          if (command.op === 'SYNC' && response.ok && command.revision === response.revision) response = { ok: true, unchanged: true, clock: response.clock };
        } else if (typeof command.id !== 'string' || !require('./protocol.cjs').uuid.test(command.id)) response = { ok: false, error: 'Invalid command id' };
        else if (this.hostCommands.has(`${channel.identity}:${command.id}`)) {
          const previous = this.hostCommands.get(`${channel.identity}:${command.id}`);
          response = previous.body === JSON.stringify(command) ? await previous.result : { ok: false, error: 'Command id reused' };
        } else if (this.hostCommands.size >= 4096) response = { ok: false, error: 'Session command limit reached' };
        else {
          const result = Promise.resolve().then(() => this.adapter(command)).catch(() => ({ ok: false, error: 'Outcome unknown; refresh queue before another edit' }));
          this.hostCommands.set(`${channel.identity}:${command.id}`, { body: JSON.stringify(command), result });
          response = await result;
          if (generation === this.generation && response.items) this.update({ queue: response });
        }
        channel.send(response);
      }
    } finally {
      const registered = this.channels.delete(channel); channel?.close(); socket.destroy();
      if (registered && generation === this.generation) {
        const count = (this.peers.get(channel.identity) || 1) - 1;
        count ? this.peers.set(channel.identity, count) : this.peers.delete(channel.identity);
        this.update({ peers: this.peers.size });
      }
    }
  }
}
module.exports = { JamSession };
