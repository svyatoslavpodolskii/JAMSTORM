const test=require('node:test'),assert=require('node:assert/strict');
const {PlaybackPolicy}=require('../src/policy.cjs');
test('Explicit gate rejects marked and unverified IDs without trusting supplied fields',async()=>{
 const p=new PlaybackPolicy();let calls=0;
 await assert.rejects(p.verify('abcdefghijk',async()=>({known:true,explicit:true})),/маркировкой E/);
 await assert.rejects(p.verify('12345678901',async()=>({known:false})),/проверить/);
 await p.verify('clean123456',async()=>{calls++;return {known:true,explicit:false};});
 await p.verify('clean123456',async()=>{throw Error('cached');});assert.equal(calls,1);
});
test('simultaneous guest additions cannot exceed the outstanding limit; played tracks release slots',async()=>{
 const p=new PlaybackPolicy();p.set({blockExplicit:false,guestLimit:1});let serial=0,items=[];
 const snapshot=async()=>({items:items.map(i=>({...i}))});
 const execute=async()=>{await new Promise(resolve=>setTimeout(resolve,5));items.push({id:String(++serial)});return {ok:true,...await snapshot()};};
 const send=actor=>p.run({op:'ADD',videoId:'abcdefghijk'},actor,execute,snapshot,()=>{});
 const result=await Promise.allSettled([send('browser:one'),send('browser:one')]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(items.length,1);
 await send('android:two');items[1].current=true;await send('browser:one');assert.equal(items.length,3);
});
test('add-only room rejects jump, removal and ordering commands from both guest transports',async()=>{
 const p=new PlaybackPolicy();p.set({blockExplicit:false,guestReorder:false});let dispatched=0;
 for(const actor of ['browser:one','android:two'])for(const op of ['MOVE','PLAY_NEXT','PLAY','REMOVE','SEEK','SKIP_NEXT'])await assert.rejects(p.run({op},actor,async()=>{dispatched++;},async()=>({items:[]}),()=>{}),/только добавлять/);
 assert.equal(dispatched,0);
 await p.run({op:'MOVE'},null,async()=>{dispatched++;return {ok:true};},async()=>({items:[]}),()=>{});assert.equal(dispatched,1);
});
