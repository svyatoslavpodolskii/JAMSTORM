const test=require('node:test');
const assert=require('node:assert/strict');
const {JamPlayer}=require('../src/player.cjs');
const {parseLrc}=require('../src/lyrics.cjs');
const {Lyrics,metadata,choose}=require('../src/lyrics.cjs');
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
test('lyrics find the correct version when exact lookup fails and share concurrent requests',async()=>{
 const requests=[];
 const provider=new Lyrics(async url=>{requests.push(url);return url.includes('/get?')?{status:404}:{status:200,ok:true,json:async()=>[
  {trackName:'Our Song',artistName:'Other Artist',duration:100,syncedLyrics:'[00:01]Wrong artist'},
  {trackName:'Our Song',artistName:'Artist',duration:200,syncedLyrics:'[00:01]Wrong version'},
  {trackName:'Our Song',artistName:'Artist',duration:101,syncedLyrics:'[00:02]Correct version'}
 ]};});
 const track={title:'Our Song (Official Audio) (feat. Guest)',artist:'Artist • Album',duration:100000};
 const [first,second]=await Promise.all([provider.get(track),provider.get(track)]);
 assert.equal(first.lines[0].text,'Correct version');assert.deepEqual(first,second);assert.equal(requests.length,2);
 assert.equal(new URL(requests[0]).searchParams.get('track_name'),'Our Song');
 await provider.get(track);assert.equal(requests.length,2);
});
test('lyrics do not substitute another song or a version with different timing',()=>{
 assert.equal(choose([{trackName:'Song',artistName:'Artist',duration:200}],{title:'Song',artist:'Artist',duration:100}),undefined);
 assert.equal(choose([{trackName:'Other Song',artistName:'Artist',duration:100}],{title:'Song',artist:'Artist',duration:100}),undefined);
 assert.equal(metadata({title:'Song [Official Music Video]',artist:'Artist - Topic'}).artist,'Artist');
});
test('temporary lyric service errors can be retried',async()=>{
 let calls=0;const provider=new Lyrics(async()=>++calls===1?{status:503,ok:false}:{status:200,ok:true,json:async()=>({syncedLyrics:'[00:01]Recovered'})});
 const track={title:'Song',artist:'Artist',duration:100000};await assert.rejects(provider.get(track));
 assert.equal((await provider.get(track)).lines[0].text,'Recovered');
});
