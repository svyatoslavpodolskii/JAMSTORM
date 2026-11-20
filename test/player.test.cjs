const test = require('node:test');
const assert = require('node:assert/strict');
const { JamPlayer } = require('../src/player.cjs');
const make = () => { const p = new JamPlayer({}); p.sample = async () => ({ videoId: 'abcdefghijk', title: 'Первый', artist: 'Исполнитель', playing: true, position: 10, duration: 1000 }); return p; };
test('Jam queue retains stable occurrence IDs and rejects stale edits', async () => {
  const p = make(); const initial = await p.call({ op: 'SNAPSHOT' });
  const added = await p.call({ op: 'ADD', videoId: '12345678901' });
  assert.equal(added.items.length, 2); assert(added.confirmed); assert.equal(added.items[0].id, initial.items[0].id);
  const stale = await p.call({ op: 'REMOVE', item: added.items[1].id, revision: initial.revision }); assert(!stale.ok);
  const removed = await p.call({ op: 'REMOVE', item: added.items[1].id, revision: added.revision }); assert.equal(removed.items.length, 1);
});
test('duplicate videos are separate queue entries; play-next inserts after current', async () => {
  const p = make(); await p.call({ op: 'SNAPSHOT' });
  await p.call({ op: 'ADD', videoId: '12345678901' });
  const added = await p.call({ op: 'PLAY_NEXT', videoId: 'abcdefghijk' });
  assert.equal(added.items.length, 3); assert.equal(added.items[1].videoId, 'abcdefghijk');
  assert.notEqual(added.items[0].id, added.items[1].id);
});
test('unsupported operations and malformed video IDs do not mutate queue', async () => {
  const p = make(); await p.call({ op: 'SNAPSHOT' });
  assert(!(await p.call({ op: 'ADD', videoId: "'; process.exit()" })).ok);
  assert(!(await p.call({ op: 'EXEC' })).ok);
  const snapshot = await p.call({ op: 'SNAPSHOT' }); assert.equal(snapshot.items.length, 1);
  assert(!(await p.call({ op: 'REMOVE', item: snapshot.items[0].id, revision: snapshot.revision })).ok);
});
test('TV failure falls back once and preserves queued occurrence IDs', async () => {
  const p=make();p.browser={executeJavaScript:async()=>{if(p.mode==='tv')throw new Error('Unsupported TV format');}};
  await p.call({op:'SNAPSHOT'});const queue=await p.call({op:'ADD',videoId:'12345678901'});const target=queue.items[1];let fallbacks=0;
  p.fallback=async id=>{fallbacks++;p.mode='music';p.sample=async()=>({videoId:id,title:'Music fallback',playing:true,position:1,duration:1000});};
  const played=await p.call({op:'PLAY',item:target.id,videoId:target.videoId});
  assert.equal(fallbacks,1);assert.equal(played.items.length,2);assert.equal(played.items.find(i=>i.current).id,target.id);
});
