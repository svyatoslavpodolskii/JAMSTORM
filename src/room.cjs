'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, timingSafeEqual, createHmac, randomUUID } = require('node:crypto');
const { addresses } = require('./discovery.cjs');
const { searchYouTube } = require('./search.cjs');
class BrowserRoom {
  constructor(jam, search = searchYouTube) { this.jam = jam; this.search = search; this.server = null; this.token = ''; this.pending = new Map(); this.clients = new Map(); }
  view() { return { active: !!this.server, url: this.url || '', guests: this.clients.size }; }
  async start() {
    if (this.server) return this.view();
    if (this.jam.state.role !== 'host') throw new Error('Сначала создай Jam на этом ПК');
    const address = addresses()[0]; if (!address) throw new Error('Не найден адрес локальной сети');
    this.token = randomBytes(32).toString('base64url');
    const server = http.createServer((req, res) => this.handle(req, res).catch(error => {
      if (!res.headersSent) this.json(res, 400, { error: error.message }); else res.destroy();
    }));
    server.requestTimeout = 15000; server.headersTimeout = 10000; server.maxConnections = 64;
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '0.0.0.0', resolve); });
    this.server = server; this.port = server.address().port;
    this.url = `http://${address.address}:${this.port}/#${this.token}`;
    return this.view();
  }
  stop() { const server = this.server; this.server = null; this.token = ''; this.url = ''; this.pending.clear(); this.clients.clear(); server?.closeAllConnections(); server?.close(); }
  json(res, code, value) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
  async handle(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' https://i.ytimg.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    const url = new URL(req.url, 'http://room');
    const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
    if (req.method === 'GET' && assets[url.pathname]) {
      const [name, type] = assets[url.pathname]; res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(path.join(__dirname, 'room', name))); return;
    }
    const supplied = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
    const secret = Buffer.from(this.token);
    if (!secret.length || supplied.length !== secret.length || !timingSafeEqual(secret, supplied)) return this.json(res, 401, { error: 'Приглашение недействительно. Попроси новую ссылку у хоста.' });
    if (req.headers.origin && req.headers.origin !== `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host}`) return this.json(res, 403, { error: 'Origin denied' });
    if (this.jam.state.role !== 'host') return this.json(res, 410, { error: 'Jam завершён' });
    const now = Date.now(); for (const [ip, client] of this.clients) if (now - client.seen > 90000) this.clients.delete(ip);
    let device=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('jam-device='))?.slice(11)||'';
    const signed=id=>id+'.'+createHmac('sha256',this.token).update(id).digest('base64url');
    const parts=device.split('.');if(parts.length!==2||device!==signed(parts[0])){device=signed(randomUUID());res.setHeader('Set-Cookie','jam-device='+device+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000'+(req.headers['x-forwarded-proto']==='https'?'; Secure':''));}
    const clientId = device.split('.')[0];
    const ip = /^[\da-f-]{36}$/i.test(clientId || '') ? clientId : req.socket.remoteAddress, client = this.clients.get(ip) || { seen: now, since: now, count: 0 };
    if (now - client.since > 10000) { client.count = 0; client.since = now; }
    if (++client.count > 60 || this.clients.size >= 128 && !this.clients.has(ip)) return this.json(res, 429, { error: 'Слишком много запросов. Подожди немного.' });
    client.seen = now; this.clients.set(ip, client);
    if (req.method === 'GET' && url.pathname === '/api/state') return this.json(res, 200, { queue: this.jam.view().queue, version:this.jam.view().version, guests: this.clients.size, policy:this.policy?.settings||{} });
    if (req.method === 'GET' && url.pathname === '/api/search') {
      if (client.searching || now - (client.lastSearch || 0) < 1500) return this.json(res, 429, { error: 'Подожди перед следующим поиском' });
      client.searching = true; client.lastSearch = now;
      try { return this.json(res, 200, { items: (await this.search(url.searchParams.get('q'))).filter(i=>!this.policy?.settings.blockExplicit||!this.policy.settings.hideExplicit||!i.explicit) }); } finally { client.searching = false; }
    }
    if (req.method === 'POST' && url.pathname === '/api/command') {
      if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Expected JSON');
      let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 4096) throw new Error('Request too large'); }
      const { id, op, fields } = JSON.parse(body);
      if (!/^[\da-f-]{36}$/i.test(id || '') || !['ADD', 'PLAY_NEXT', 'PLAY', 'REMOVE', 'MOVE', 'SKIP_NEXT', 'SKIP_PREVIOUS', 'SEEK'].includes(op) || !fields || typeof fields !== 'object') throw new Error('Invalid command');
      const payload = JSON.stringify({ op, fields }), old = this.pending.get(id);
      if (old && old.payload !== payload) throw new Error('Command ID reused');
      if (!old && this.pending.size >= 4096) throw new Error('Лимит команд достигнут. Перезапусти комнату.');
      const task = old?.task || this.jam.command(op, fields,'browser:'+ip).then(queue => ({ queue, version:this.jam.view().version })).catch(e => ({ error: e.message }));
      this.pending.set(id, { payload, task }); return this.json(res, 200, await task);
    }
    return this.json(res, 404, { error: 'Not found' });
  }
}
module.exports = { BrowserRoom };
