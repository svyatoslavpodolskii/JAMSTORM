const test=require('node:test'),assert=require('node:assert/strict'),{ModeSwitch}=require('../src/mode-switch.cjs');
test('failed TV switch restores Music and does not persist the failed choice',async()=>{
 let mode='music',saved='music',restored=false;const nav=new ModeSwitch({getMode:()=>mode,activate:async m=>mode=m,load:async m=>{if(m==='tv')throw Error('load failed');},commit:async m=>saved=m,restore:async()=>restored=true});
 await assert.rejects(nav.run('tv'),/load failed/);assert.equal(mode,'music');assert.equal(saved,'music');assert.equal(restored,true);await nav.run('music');assert.equal(saved,'music');
});
test('rapid requests cannot change mode during another navigation',async()=>{
 let mode='music',release;const order=[];const nav=new ModeSwitch({getMode:()=>mode,activate:async m=>{mode=m;order.push(m);},load:async m=>{if(m==='tv')await new Promise(r=>release=r);},commit:async()=>{},restore:async()=>{}});
 const first=nav.run('tv'),second=nav.run('music');await new Promise(r=>setImmediate(r));assert.deepEqual(order,['tv']);release();await Promise.all([first,second]);assert.equal(mode,'music');assert.deepEqual(order,['tv','music']);
});
test('failed rollback still releases the navigation gate',async()=>{
 let released=false;const nav=new ModeSwitch({getMode:()=> 'music',activate:async()=>{},load:async()=>{throw Error('offline');},commit:async()=>{},restore:async()=>released=true});await assert.rejects(nav.run('tv'));assert.equal(released,true);
});
