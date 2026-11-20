'use strict';
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
class Tunnel extends EventEmitter {
  constructor(binary) { super(); this.binary = binary; this.child = null; this.url = ''; }
  async start(port) {
    if (this.child) { if (this.url) return this.url; throw new Error('Интернет-ссылка уже создаётся'); }
    return new Promise((resolve, reject) => {
      let settled = false, text = '';
      const child = spawn(this.binary, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://127.0.0.1:${port}`], { windowsHide: true, stdio: ['ignore','pipe','pipe'] });
      this.child = child;
      const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
      const timer = setTimeout(() => { this.stop(); finish(new Error('Не удалось создать интернет-ссылку за минуту. Локальная комната доступна.')); }, 55000);
      const read = chunk => {
        text = (text + chunk.toString()).slice(-12000);
        const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/);
        if (match && this.child === child) { this.url = match[0]; finish(null, this.url); }
      };
      child.stdout.on('data', read); child.stderr.on('data', read);
      child.once('error', () => { if (this.child === child) { this.child = null; this.url = ''; } finish(new Error('Не удалось запустить встроенный туннель')); this.emit('change'); });
      child.once('exit', () => { if (this.child === child) { this.child = null; this.url = ''; } finish(new Error('Интернет-туннель остановлен')); this.emit('change'); });
    });
  }
  stop() { const child = this.child; this.child = null; this.url = ''; child?.kill(); this.emit('change'); }
}
module.exports = { Tunnel };
