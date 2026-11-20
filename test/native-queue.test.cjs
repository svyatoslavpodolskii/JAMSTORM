const test=require('node:test');
const assert=require('node:assert/strict');
const {JamPlayer}=require('../src/player.cjs');
const {parseLrc}=require('../src/lyrics.cjs');
test('native metadata remains authoritative and does not invalidate an unchanged revision',async()=>{
 const p=new JamPlayer({});p.sample=async()=>({videoId:'abcdefghijk',title:'Different title',artist:'Different artist'});
 let rows=[{videoId:'abcdefghijk',title:'Native title',artist:'Native artist',current:true},{videoId:'12345678901',title:'Second'}];
 p.native={read:async()=>({available:true,source:'music',items:rows}),mutate:async(op,fields)=>{rows.splice(fields.index,1);return {available:true,source:'music',items:rows};}};
 const first=await p.call({op:'SNAPSHOT'}),second=await p.call({op:'SNAPSHOT'});
 assert.equal(first.revision,second.revision);assert.equal(second.items[0].title,'Native title');
 const removed=await p.call({op:'REMOVE',item:first.items[1].id,revision:first.revision});assert(removed.confirmed);assert.equal(removed.items.length,1);
});
test('unavailable native queue never invents a separate current item',async()=>{
 const p=new JamPlayer({});p.sample=async()=>({videoId:'abcdefghijk',title:'Playing'});p.native={read:async()=>({available:false,items:[]})};
 assert.deepEqual((await p.call({op:'SNAPSHOT'})).items,[]);
});
test('lyrics parse multiple timestamps, fractions, sorting and metadata',()=>{
 assert.deepEqual(parseLrc('[ar:Artist]\n[00:12.50][00:25.1]Hello\n[00:01]Start'),[{time:1000,text:'Start'},{time:12500,text:'Hello'},{time:25100,text:'Hello'}]);
});
