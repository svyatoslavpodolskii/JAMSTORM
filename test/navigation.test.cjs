const {test}=require('node:test'),assert=require('node:assert/strict');
const {remoteAllowed}=require('../src/navigation.cjs');
test('Music sign-in accepts the YouTube handoff and Google account flow',()=>{
 for(const url of ['https://www.youtube.com/signin?action_handle_signin=true','https://accounts.google.com/ServiceLogin','https://music.youtube.com/','https://consent.youtube.com/m'])assert.equal(remoteAllowed(url),true,url);
 for(const url of ['http://accounts.google.com/','https://accounts.google.com.evil.org/','javascript:alert(1)','https://www.youtube.com/watch?v=abcdefghijk','https://user:password@music.youtube.com/'])assert.equal(remoteAllowed(url),false,url);
});
test('history skips bootstrap, auth handoffs and duplicate entries in both directions',()=>{
 const {historyTargets}=require('../src/navigation.cjs');
 const rows=['about:blank','https://accounts.google.com/ServiceLogin','https://music.youtube.com/','https://music.youtube.com/','https://www.youtube.com/signin','https://music.youtube.com/watch?v=abcdefghijk'].map(url=>({url}));
 assert.deepEqual(historyTargets(rows,5),{back:3,forward:-1});
 assert.deepEqual(historyTargets(rows,3),{back:-1,forward:5});
 assert.deepEqual(historyTargets(rows,2),{back:-1,forward:5});
});
