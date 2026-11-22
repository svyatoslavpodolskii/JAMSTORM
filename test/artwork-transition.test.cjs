'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('a late cover for the same track updates both the scene and background event',async()=>{
 const events=[],drawn=[],animation=()=>({finished:Promise.resolve(),pause(){},play(){},cancel(){},playState:'paused'}),node=()=>({style:{setProperty(){}},classList:{toggle(){}},setAttribute(){},animate:animation,decode:async()=>{},querySelectorAll:()=>[],append(){}}),nodes=new Map();
 const document={body:node(),getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};
 const window={artwork:{cover:item=>item?.cover||''},accentColor:{css:()=>''},dispatchEvent:event=>events.push(event)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/ui/player-effects.js'),'utf8'),{document,window,matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},Image:class{decode(){return Promise.resolve();}},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},Event:class{},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout(){}});
 const clock={position:0,duration:10000,playing:false};await window.playerEffects.update({videoId:'abcdefghijk',cover:'first'},clock,item=>drawn.push(item.cover));await window.playerEffects.update({videoId:'abcdefghijk',cover:'corrected'},clock,item=>drawn.push(item.cover));
 assert.deepEqual(drawn,['first','corrected']);assert.equal(events.at(-1).detail.cover,'corrected');
});
