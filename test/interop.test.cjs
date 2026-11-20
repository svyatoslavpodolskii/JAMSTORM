const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, mkdirSync } = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const { Frames, SecureChannel } = require('../src/protocol.cjs');
const upstream = path.join(__dirname, '../upstream/Jam-Layer/app/src/main/java/app/morphe/jam/companion');
test('Node client interoperates with the unmodified Java SecureChannel from Jam-Layer', { skip: !existsSync(upstream), timeout: 30000 }, async t => {
  const out = path.join(__dirname, '../artifacts/java'); mkdirSync(out, { recursive: true });
  const source = ['SecureChannel.java', 'ChannelTransport.java', 'SocketChannelTransport.java'].map(n => path.join(upstream, n));
  const compile = spawnSync('javac', ['-encoding', 'UTF-8', '-d', out, ...source, path.join(__dirname, 'java/InteropHost.java')], { encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stderr || compile.error?.message);
  const invite = { jamId: randomUUID(), secret: randomBytes(32) };
  const host = spawn('java', ['-cp', out, 'InteropHost', invite.jamId, invite.secret.toString('base64url')], { windowsHide: true });
  t.after(() => host.kill());
  let errors = ''; host.stderr.on('data', b => { errors += b; });
  const port = await new Promise((resolve, reject) => {
    let data = ''; host.stdout.on('data', b => { data += b; if (data.includes('\n')) resolve(Number(data.trim())); });
    host.on('error', reject); host.on('exit', code => { if (code) reject(new Error(errors)); });
  });
  const frames = new Frames(net.createConnection({ host: '127.0.0.1', port })); t.after(() => frames.close());
  const channel = await SecureChannel.open(frames, invite); t.after(() => channel.close());
  for (const command of [{ op: 'SYNC', revision: '' }, { op: 'ADD', id: randomUUID(), videoId: 'abcdefghijk', title: 'Музыка 🎶' }, { op: 'PING' }]) {
    channel.send(command); assert.deepEqual(await channel.receive(), command);
  }
  const server = net.createServer(); t.after(() => server.close());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const incoming = new Promise(resolve => server.once('connection', resolve));
  const client = spawn('java', ['-cp', out, 'InteropHost', invite.jamId, invite.secret.toString('base64url'), String(server.address().port)], { windowsHide: true });
  t.after(() => client.kill()); let stdout = ''; let stderr = '';
  client.stdout.on('data', b => { stdout += b; }); client.stderr.on('data', b => { stderr += b; });
  const exited = new Promise((resolve, reject) => { client.on('error', reject); client.on('exit', resolve); });
  const socket = await incoming; const hostChannel = await SecureChannel.open(new Frames(socket), invite, { host: true }); t.after(() => hostChannel.close());
  assert.deepEqual(await hostChannel.receive(), { op: 'SYNC', revision: '' }); hostChannel.send({ ok: true, items: [] });
  assert.equal(await exited, 0, stderr); assert.match(stdout, /JAVA_CLIENT_OK/);
});
