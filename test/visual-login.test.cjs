'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalize,luminance}=require('../src/ui/accent.js');
const {cookieDetails,allowedDomain,signInArguments,readerArguments,BrowserLogin}=require('../src/browser-login.cjs');
test('cover accents stay readable even for dark gold, blue and black',()=>{
 for(const rgb of [[64,55,27],[8,12,48],[0,0,0],[255,0,0],[0,255,0],[255,255,255]]){
  const result=normalize(rgb);assert.ok((luminance(result)+.05)/(luminance([21,25,31])+.05)>6.95);
 }
});
test('Google authentication runs without automation; the reader never opens a sign-in page',()=>{
 const profile='C:\\fixture\\login-profile',args=signInArguments(profile),reader=readerArguments(profile);
 assert.ok(args.some(arg=>arg.startsWith('https://accounts.google.com/')));
 assert.ok(!args.some(arg=>/debugging|headless|automation|disable-features|user-agent/.test(arg)));
 assert.ok(reader.includes('--remote-debugging-pipe'));assert.ok(reader.includes('about:blank'));
 assert.ok(!reader.some(arg=>/^https?:/.test(arg)));
});
test('no command channel is exposed during the human sign-in phase',async()=>{
 const login=new BrowserLogin('fixture',{},()=>{},()=>{});login.active=true;login.phase='signin';
 await assert.rejects(login.command('Storage.getCookies'));assert.equal(login.pending.size,0);
});
test('browser sign-in transfers only Google/YouTube cookies with exact security attributes',()=>{
 assert.equal(allowedDomain('evilgoogle.com'),false);assert.equal(allowedDomain('.youtube.com'),true);
 assert.equal(cookieDetails({domain:'.example.com'}),null);
 assert.equal(cookieDetails({domain:'.google.com',partitionKey:{topLevelSite:'https://example.com'}}),null);
 assert.deepEqual(cookieDetails({domain:'.youtube.com',name:'test',value:'fixture',secure:true,httpOnly:true,sameSite:'None',path:'/',expires:100}),{url:'https://youtube.com/',name:'test',value:'fixture',secure:true,httpOnly:true,path:'/',domain:'.youtube.com',expirationDate:100,sameSite:'no_restriction'});
 const host=cookieDetails({domain:'accounts.google.com',name:'host',value:'fixture',secure:true});assert.equal(host.domain,undefined);
});
