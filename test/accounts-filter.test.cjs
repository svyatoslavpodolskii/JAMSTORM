'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {Accounts}=require('../src/accounts.cjs');
test('feedback delegates to native controls and rejects arbitrary actions',()=>{
 const {script}=require('../src/feedback.cjs');let clicks=0;const root={querySelector:()=>({click(){clicks++;},getAttribute:()=>null})};
 for(const action of ['like','dislike','menu'])assert.equal(vm.runInNewContext(script(action),{document:{querySelector:()=>({querySelector:()=>root})}}).available,true);
 assert.equal(clicks,3);assert.throws(()=>script('arbitrary'));
 assert.equal(vm.runInNewContext(script('like'),{document:{querySelector:()=>null}}).available,false);
});
test('reading native rating state never clicks and TV Like is separate from Dislike',()=>{
 const {script,stateScript}=require('../src/feedback.cjs');let clicks=0;
 const make=label=>({data:{},getAttribute:key=>key==='aria-label'?label:key==='aria-pressed'?String(label==='Нравится'):null,click(){clicks++;}}),buttons=[make('Не нравится'),make('Нравится')],root={querySelectorAll:()=>buttons};
 const document={querySelector:selector=>selector==='ytmusic-player-bar'?null:selector==='video'?{}:selector.startsWith('ytlr-player')?root:null};
 const like=vm.runInNewContext(script('like',false),{document}),dislike=vm.runInNewContext(script('dislike',false),{document});assert.equal(like.pressed,true);assert.equal(dislike.pressed,false);assert.equal(clicks,0);
 vm.runInNewContext(stateScript(),{document});assert.equal(clicks,0);vm.runInNewContext(script('like'),{document});assert.equal(clicks,1);
});
test('Music and TV login remain independent and concurrent probes coalesce',async()=>{
 let calls=0;const accounts=new Accounts({music:async()=>{calls++;return true;},tv:async()=>false});
 await Promise.all([accounts.refresh(),accounts.refresh()]);assert.equal(calls,1);assert.deepEqual(accounts.view(),{music:'signed-in',tv:'signed-out'});
 accounts.set('tv',true);accounts.set('tv',undefined);assert.equal(accounts.view().tv,'signed-in');accounts.set('music',false);assert.equal(accounts.view().music,'signed-out');
});
test('Music hides explicit catalog cards and DOM badges, restores recycled rows, preserves block-only mode',()=>{
 const row=(data,badges=[])=>({data,dataset:{},querySelectorAll:()=>badges});
 const explicit={badges:[{musicInlineBadgeRenderer:{icon:{iconType:'MUSIC_EXPLICIT_BADGE'}}}]};
 const rows=[row(explicit),row({musicTwoRowItemRenderer:explicit}),row({},[{data:{},icon:'music_explicit_badge',getAttribute:()=>null,textContent:''}]),row({title:'Explicit artist'})];
 const dataset={jamstormExplicit:'block',jamstormHideExplicit:'hide'};let filter,paused=0,moved=0;
 const queue={queue:{getItems:()=>[{playlistPanelVideoRenderer:{...explicit,selected:true}},{playlistPanelVideoRenderer:{title:'Clean'}}]},dispatch:()=>moved++};
 const document={documentElement:{dataset},addEventListener(){},querySelectorAll:()=>rows,querySelector:s=>s==='#queue'?queue:s==='video'?{pause(){paused++;}}:null};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/page-hooks.js'),'utf8'),{document,window:{addEventListener(){}},location:{hostname:'music.youtube.com'},setInterval:fn=>filter=fn});
 filter();assert.deepEqual(rows.map(r=>!!r.dataset.jamExplicitHidden),[true,true,true,false]);assert.equal(paused,1);assert.equal(moved,1);
 dataset.jamstormHideExplicit='show';filter();assert(rows.every(r=>!r.dataset.jamExplicitHidden));assert.equal(paused,2);
 dataset.jamstormHideExplicit='hide';rows[0].data={};filter();assert.equal(rows[0].dataset.jamExplicitHidden,undefined);
 dataset.jamstormExplicit='allow';filter();assert(rows.every(r=>!r.dataset.jamExplicitHidden));
});
