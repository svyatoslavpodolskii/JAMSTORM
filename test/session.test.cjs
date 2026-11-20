const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const { JamSession } = require('../src/session.cjs');
const { Frames, SecureChannel, parseInvite } = require('../src/protocol.cjs');
const { addresses } = require('../src/discovery.cjs');
const snapshot = () => ({ ok: true, revision: 'fixture:1', items: [{ id: '1', videoId: 'abcdefghijk', title: 'Тест', current: true }], autoplay: [], clock: { videoId: 'abcdefghijk', position: 0, duration: 100000, playing: false } });
test('real host/guest sessions sync queue and apply remote commands', { skip: !addresses().length, timeout: 15000 }, async t => {
  const host = new JamSession(); const guest = new JamSession(); t.after(() => { guest.disconnect(); host.disconnect(); });
  const commands = [];
  const state = await host.host(async command => { commands.push(command); return snapshot(); });
  assert.equal(state.phase, 'connected', state.error); assert(state.invite);
  const joined = await guest.join(state.invite); assert.equal(joined.phase, 'connected', joined.error); assert.equal(joined.queue.items[0].title, 'Тест');
  await guest.command('SKIP_NEXT'); assert(commands.some(c => c.op === 'SKIP_NEXT' && c.id));
  assert.equal(host.state.peers, 1); guest.disconnect(); assert.equal(guest.state.phase, 'idle');
});
test('host rejects backup negotiation and deduplicates commands across reconnects', { skip: !addresses().length, timeout: 15000 }, async t => {
  const host = new JamSession(); t.after(() => host.disconnect()); let edits = 0;
  const state = await host.host(async command => { if (command.op === 'ADD') edits++; return snapshot(); });
  const invite = parseInvite(state.invite); const endpoint = invite.endpoints[0]; const identity = randomUUID();
  const connect = async () => { const channel = await SecureChannel.open(new Frames(net.createConnection(endpoint)), invite, { identity }); t.after(() => channel.close()); return channel; };
  let channel = await connect();
  channel.send({ op: 'CHANNEL', version: 1, role: 'BACKUP' }); assert.equal((await channel.receive()).ok, false);
  const command = { op: 'ADD', id: randomUUID(), videoId: 'abcdefghijk' };
  channel.send(command); assert((await channel.receive()).ok); channel.close();
  channel = await connect(); channel.send(command); assert((await channel.receive()).ok); assert.equal(edits, 1);
  channel.send({ ...command, videoId: '12345678901' }); assert.equal((await channel.receive()).error, 'Command id reused'); assert.equal(edits, 1);
});
test('leaving while a handshake waits prevents a late connected state', { timeout: 5000 }, async t => {
  const server = net.createServer(socket => { t.after(() => socket.destroy()); }); t.after(() => server.close());
  // Use an actual local address because invitation parsing rejects loopback hints.
  const address = addresses()[0]?.address; if (!address) return t.skip();
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  const { randomBytes } = require('node:crypto');
  const ep = `${Buffer.from(address.split('.').map(Number)).toString('base64url')}.${server.address().port}`;
  const guest = new JamSession(); t.after(() => guest.disconnect());
  const pending = guest.join(`morphejam://join?v=2&jam=${randomUUID()}&secret=${randomBytes(32).toString('base64url')}&exp=${Date.now() + 60000}&ep=${ep}`);
  await new Promise(resolve => setTimeout(resolve, 30)); guest.disconnect(); await pending;
  assert.equal(guest.state.phase, 'idle'); assert.equal(guest.channel, null);
});
