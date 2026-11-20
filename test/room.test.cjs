const test = require('node:test'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { BrowserRoom } = require('../src/room.cjs');
const { JamPlayer } = require('../src/player.cjs');
const { JamSession } = require('../src/session.cjs');
const { parseSearch } = require('../src/search.cjs');
const { addresses } = require('../src/discovery.cjs');
test('browser guests authenticate, search, share real Jam queue and deduplicate edits', { skip: !addresses().length }, async t => {
  const player = new JamPlayer({}); player.sample = async()=>null;
  const jam = new JamSession(); t.after(()=>jam.disconnect());
  await jam.host(command=>player.call(command));
  const room = new BrowserRoom(jam,async q=>[{videoId:'abcdefghijk',title:q}]); t.after(()=>room.stop());
  await room.start(); const base=`http://127.0.0.1:${room.port}`;
  const headers={Authorization:`Bearer ${room.token}`,'Content-Type':'application/json'};
  assert.equal((await fetch(base+'/api/state')).status,401);
  assert.equal((await fetch(base+'/api/state',{headers:{...headers,Origin:'https://evil.invalid'}})).status,403);
  assert.equal((await fetch(base+'/api/search?q=music',{headers})).status,200);
  const body=JSON.stringify({id:randomUUID(),op:'ADD',fields:{videoId:'abcdefghijk'}});
  const send=()=>fetch(base+'/api/command',{method:'POST',headers,body}).then(r=>r.json());
  const [a,b]=await Promise.all([send(),send()]); assert.equal(a.queue.items.length,1);assert.deepEqual(a,b);
  assert.equal(jam.view().queue.items.length,1);
  await jam.command('ADD',{videoId:'12345678901'});
  const state=await fetch(base+'/api/state',{headers}).then(r=>r.json());assert.equal(state.queue.items.length,2);
  const traversal=await fetch(base+'/%2e%2e/package.json');assert.equal(traversal.status,401);
  const token=room.token;room.stop();await room.start();assert.notEqual(room.token,token);
});
test('search parser handles braces in strings, duplicate videos and untrusted titles as data',()=>{
  const data={contents:[{videoRenderer:{videoId:'abcdefghijk',title:{runs:[{text:'<script>{hello}</script>"'}]},ownerText:{simpleText:'Artist'}}},{videoRenderer:{videoId:'abcdefghijk'}},{videoRenderer:{videoId:'bad-id'}}]};
  const result=parseSearch('var ytInitialData = '+JSON.stringify(data)+'; unrelated()');assert.equal(result.length,1);assert.equal(result[0].title,'<script>{hello}</script>"');
  assert.throws(()=>parseSearch('<html>consent required</html>'),/YouTube/);
});
test('background hook reports visible and suppresses only visibility pause handlers',()=>{
  const vm=require('node:vm'),fs=require('node:fs');const listeners={};const document={addEventListener:(name,fn)=>{listeners[name]=fn;}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/page-hooks.js'),'utf8'),{document,window:{addEventListener(){}},location:{hostname:'www.youtube.com'}});
  assert.equal(document.hidden,false);assert.equal(document.visibilityState,'visible');let stopped=false;listeners.visibilitychange({stopImmediatePropagation(){stopped=true;}});assert(stopped);
  assert.equal(listeners.pause,undefined);
});
