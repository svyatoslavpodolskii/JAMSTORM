'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {AccountFlow}=require('../src/account-flow.cjs');
test('combined login reuses verified Music and opens only the missing TV connection',async()=>{
 const calls=[],flow=new AccountFlow({status:async()=>({music:'signed-in',tv:'signed-out'}),music:async()=>calls.push('music'),tv:async()=>{calls.push('tv');return {page:'catalog'};}});assert.equal((await flow.start()).step,'tv');assert.deepEqual(calls,['tv']);
});
test('TV is requested after Music verification, without claiming both are signed in',async()=>{
 let status={music:'signed-out',tv:'signed-out'};const calls=[],flow=new AccountFlow({status:async()=>status,music:async()=>calls.push('music'),tv:async()=>calls.push('tv')});await flow.start();assert.deepEqual(calls,['music']);status.music='signed-in';assert.equal((await flow.musicConnected()).step,'tv');assert.deepEqual(calls,['music','tv']);assert.equal(status.tv,'signed-out');
});
test('already connected accounts do not reopen authentication and explicit Music switching stays separate',async()=>{
 const calls=[],flow=new AccountFlow({status:async()=>({music:'signed-in',tv:'signed-in'}),music:async()=>calls.push('music'),tv:async()=>calls.push('tv')});assert.equal((await flow.start()).step,'complete');assert.deepEqual(calls,[]);await flow.start('music');assert.deepEqual(calls,['music']);assert.equal(flow.pendingTV,false);await assert.rejects(flow.start('other'));
});
test('repeated clicks during human sign-in preserve the pending TV step',async()=>{
 let opened=0;const flow=new AccountFlow({status:async()=>({music:'signed-out',tv:'signed-out'}),music:async()=>opened++,tv:async()=>{}});await flow.start();assert.equal((await flow.start()).alreadyOpen,true);assert.equal(opened,1);assert.equal(flow.pendingTV,true);flow.cancelMusic();await flow.start();assert.equal(opened,2);
});
