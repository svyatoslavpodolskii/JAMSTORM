const test=require('node:test'),assert=require('node:assert/strict');
const surfaceLayout=require('../src/ui/surface-layout.js');
const {cover}=require('../src/ui/artwork.js');
test('remote catalog/TV and local listening scene are always exclusive',()=>{
 for(const mode of ['music','tv'])for(const tab of ['music','catalog','jam','invite','settings']){
   const value=surfaceLayout(tab,mode);assert(!(value.remoteVisible&&value.sceneVisible));
   if(mode==='tv')assert(!value.sceneVisible&&!value.dockVisible);
   if(tab==='catalog')assert(value.remoteVisible&&!value.dockVisible);
   if(mode==='music'&&tab==='music')assert(value.sceneVisible&&!value.remoteVisible&&value.dockVisible);
 }
});
test('artwork requests a real high-resolution CDN asset and rejects arbitrary image origins',()=>{
 assert.equal(cover({videoId:'abcdefghijk',cover:'https://lh3.googleusercontent.com/image=w60-h60-l90-rj'}),'https://lh3.googleusercontent.com/image=w1000-h1000-l90-rj');
 assert.equal(cover({videoId:'abcdefghijk',cover:'https://attacker.example/image.jpg'}),'https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg');
 assert.equal(cover({videoId:'bad'}),'cover-placeholder.svg');
 assert.equal(cover({videoId:'abcdefghijk',cover:'file:///C:/private.png'}),'https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg');
});
