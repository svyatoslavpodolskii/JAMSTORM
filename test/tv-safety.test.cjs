'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {RendererRecovery}=require('../src/renderer-recovery.cjs');
const {MusicMetadata}=require('../src/music-metadata.cjs');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function preload(){
 const events=new Map(),ipc=new Map(),requests=[];
 const video={paused:false,isConnected:true,pause(){this.paused=true;this.pauses=(this.pauses||0)+1;},play(){this.paused=false;this.plays=(this.plays||0)+1;emit('play',this);return Promise.resolve();}};
 const emit=(name,target=video)=>{for(const fn of events.get(name)||[])fn({target});};
 const doc={documentElement:{dataset:{}},querySelector:selector=>selector==='video'?video:null,addEventListener:(name,fn)=>events.set(name,[...(events.get(name)||[]),fn])};
 const observer=class{observe(){}disconnect(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/music-preload.cjs'),'utf8'),{
  require:()=>({ipcRenderer:{on:(name,fn)=>ipc.set(name,[...(ipc.get(name)||[]),fn]),send(){},invoke:()=>new Promise(resolve=>requests.push(resolve))}}),document:doc,window:{addEventListener(){}},location:{hostname:'www.youtube.com',pathname:'/tv',origin:'https://www.youtube.com'},HTMLMediaElement:{[Symbol.hasInstance]:value=>value===video},ResizeObserver:observer,MutationObserver:observer,setInterval(){},setTimeout(){},requestAnimationFrame(){},WeakMap,WeakSet,Promise,MediaStream:class{},
 });return {video,emit,requests,filter:value=>{for(const fn of ipc.get('filter:enabled'))fn(null,value);},navigate:()=>{for(const fn of ipc.get('player:prepare-navigation'))fn(null,'fixture');}};
}
test('TV autoplay stays paused until authoritative metadata permits it',async()=>{
 const p=preload();p.emit('play');assert.ok(p.video.paused);assert.equal(p.requests.length,1);
 p.requests[0]({allowed:false});await flush();assert.equal(p.video.plays||0,0);
 p.emit('play');p.requests[1]({allowed:true});await flush();assert.equal(p.video.plays,1);assert.equal(p.requests.length,2);
});
test('TV does not resume a stale stream after source change or Back',async()=>{
 for(const interrupt of ['loadstart','back']){const p=preload();p.emit('play');interrupt==='back'?p.navigate():p.emit('loadstart');p.requests[0]({allowed:true});await flush();assert.equal(p.video.plays||0,0);}
 const p=preload();p.filter(false);p.emit('play');assert.equal(p.requests.length,0);assert.equal(p.video.pauses||0,0);
});
test('enabling the E filter rechecks an already playing media element',async()=>{
 const p=preload();p.emit('play');p.requests[0]({allowed:true});await flush();assert.equal(p.video.plays,1);
 p.filter(false);p.filter(true);assert.ok(p.video.paused);assert.equal(p.requests.length,2);
 p.requests[1]({allowed:false});await flush();assert.equal(p.video.plays,1);
});
test('renderer recovery coalesces failures and stops reload loops',async()=>{
 let finish,count=0,now=0;const phases=[],r=new RendererRecovery(()=>{count++;return new Promise(resolve=>finish=resolve);},phase=>phases.push(phase),()=>now);
 const one=r.recover({reason:'crashed'}),same=r.recover({reason:'oom'});assert.equal(one,same);await flush();assert.equal(count,1);finish();assert.equal(await one,true);
 const two=r.recover({reason:'crashed'});await flush();finish();await two;assert.equal(await r.recover({reason:'crashed'}),false);assert.equal(count,2);
 now=120001;const three=r.recover({reason:'crashed'});await flush();finish();await three;assert.equal(count,3);r.close();assert.equal(await r.recover({reason:'crashed'}),false);
 assert.ok(phases.includes('recovered'));
});
test('TV metadata uses the real Music queue response and coalesces lookups',async()=>{
 let reads=0,closed=0;const wc={loadURL:async()=>{},executeJavaScript:async source=>{if(source.includes('const poll='))return true;reads++;return {known:true,explicit:true};},isDestroyed:()=>false,close:()=>closed++};
 const metadata=new MusicMetadata(()=>({webContents:wc}));assert.deepEqual(await Promise.all([metadata.get('abcdefghijk'),metadata.get('abcdefghijk')]),[{known:true,explicit:true},{known:true,explicit:true}]);assert.equal(reads,1);await metadata.get('abcdefghijk');assert.equal(reads,1);metadata.close();assert.equal(closed,1);
});
