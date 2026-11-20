const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { randomUUID, randomBytes } = require('node:crypto');
const { Frames, SecureChannel, parseInvite, localAddress, LIMIT } = require('../src/protocol.cjs');
const { packet, matches } = require('../src/discovery.cjs');

const invitation = () => ({ jamId: randomUUID(), secret: randomBytes(32), expires: Date.now() + 3600000 });
const uri = (i, ep = '') => `morphejam://join?v=${ep ? 2 : 1}&jam=${i.jamId}&secret=${i.secret.toString('base64url')}&exp=${i.expires}${ep ? '&ep=' + ep : ''}`;
async function pair(t, invite = invitation()) {
  const server = net.createServer(); t.after(() => server.close());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const accepted = new Promise(resolve => server.once('connection', socket => resolve(new Frames(socket))));
  const clientFrames = new Frames(net.createConnection({ host: '127.0.0.1', port: server.address().port }));
  const hostFrames = await accepted;
  t.after(() => { clientFrames.close(); hostFrames.close(); });
  return { invite, clientFrames, hostFrames };
}
test('parses Android v1/v2 invitations and local endpoint hints', () => {
  const i = invitation(); const v1 = parseInvite(uri(i)); assert.equal(v1.jamId, i.jamId); assert.deepEqual(v1.secret, i.secret);
  const ep = Buffer.from([192, 168, 1, 8]).toString('base64url') + '.45678';
  assert.deepEqual(parseInvite(uri(i, ep)).endpoints, [{ host: '192.168.1.8', port: 45678 }]);
  assert(localAddress('fd00::1')); assert(!localAddress('::1')); assert(!localAddress('8.8.8.8'));
});
test('rejects expired, duplicate, public endpoints and malformed credentials', () => {
  const i = invitation();
  assert.throws(() => parseInvite(uri({ ...i, expires: Date.now() - 1 })));
  assert.throws(() => parseInvite(uri(i) + '&jam=' + i.jamId));
  assert.throws(() => parseInvite(uri(i, Buffer.from([8, 8, 8, 8]).toString('base64url') + '.80')));
  assert.throws(() => parseInvite(uri({ ...i, secret: randomBytes(31) })));
  assert.throws(() => parseInvite('https://example.com'));
});
test('MJP2 discovery bytes match fixed Java ByteBuffer layout', () => {
  const id = '00112233-4455-6677-8899-aabbccddeeff'; const nonce = Buffer.from('0102030405060708', 'hex');
  assert.equal(packet(id, nonce).toString('hex'), '4d4a5032020100112233445566778899aabbccddeeff01020304050607080000');
  assert(matches(packet(id, nonce, 12345), id, nonce, true));
  assert(!matches(packet(id, randomBytes(8), 12345), id, nonce, true));
  assert(!matches(packet(id, nonce), id, nonce, true));
});
test('authenticated bidirectional AES-GCM exchange over real TCP', async t => {
  const { invite, clientFrames, hostFrames } = await pair(t);
  const [client, host] = await Promise.all([SecureChannel.open(clientFrames, invite), SecureChannel.open(hostFrames, invite, { host: true })]);
  t.after(() => { client.close(); host.close(); });
  client.send({ op: 'SYNC', title: 'Музыка 🎶' }); assert.deepEqual(await host.receive(), { op: 'SYNC', title: 'Музыка 🎶' });
  host.send({ ok: true, items: [] }); assert.deepEqual(await client.receive(), { ok: true, items: [] });
  assert.equal(client.sent, 1n); assert.equal(host.received, 1n);
});
test('incorrect invitation secret cannot authenticate', async t => {
  const { invite, clientFrames, hostFrames } = await pair(t);
  const outcomes = await Promise.allSettled([SecureChannel.open(clientFrames, { ...invite, secret: randomBytes(32) }), SecureChannel.open(hostFrames, invite, { host: true })]);
  assert(outcomes.every(r => r.status === 'rejected'));
});
test('tampering and replay close channel before accepting payload', async t => {
  const { invite, clientFrames, hostFrames } = await pair(t);
  const [client, host] = await Promise.all([SecureChannel.open(clientFrames, invite), SecureChannel.open(hostFrames, invite, { host: true })]);
  t.after(() => { client.close(); host.close(); });
  let captured; const write = clientFrames.write.bind(clientFrames);
  clientFrames.write = frame => { captured = Buffer.from(frame); write(frame); };
  client.send({ op: 'PING' }); await host.receive();
  write(captured); await assert.rejects(host.receive(), /Replay/);
});
test('AES-GCM tag corruption is rejected', async t => {
  const { invite, clientFrames, hostFrames } = await pair(t);
  const [client, host] = await Promise.all([SecureChannel.open(clientFrames, invite), SecureChannel.open(hostFrames, invite, { host: true })]);
  t.after(() => { client.close(); host.close(); });
  const write = clientFrames.write.bind(clientFrames);
  clientFrames.write = frame => { const bad = Buffer.from(frame); bad[bad.length - 1] ^= 1; write(bad); };
  client.send({ op: 'PING' }); await assert.rejects(host.receive());
});
test('frames reject oversized lengths and handle cancellation', async t => {
  const { clientFrames, hostFrames } = await pair(t);
  const read = hostFrames.read(); const bad = Buffer.alloc(4); bad.writeInt32BE(LIMIT + 1); clientFrames.socket.write(bad);
  await assert.rejects(read, /размер/);
});
module.exports = { pair, invitation, uri };
