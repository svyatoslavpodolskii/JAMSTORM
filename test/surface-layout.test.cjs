const test=require('node:test'),assert=require('node:assert/strict');
const surfaceLayout=require('../src/ui/surface-layout.js');
const {cover}=require('../src/ui/artwork.js');
const {nextPanel}=require('../src/ui/panel-modes.js');

test('panels cycle through side, center and hidden without two center surfaces',()=>{
 let state={lyrics:'hidden',queue:'hidden'};
 state=nextPanel(state,'lyrics');assert.equal(state.lyrics,'side');
 state=nextPanel(state,'lyrics');assert.equal(state.lyrics,'center');
 state=nextPanel(state,'queue');assert.equal(state.queue,'side');assert.equal(state.lyrics,'center');
 state=nextPanel(state,'queue');assert.equal(state.queue,'center');assert.equal(state.lyrics,'hidden');
 state=nextPanel(state,'queue');assert.equal(state.queue,'hidden');
 assert.equal(nextPanel({lyrics:true,queue:false},'lyrics').lyrics,'center');
});
test('remote catalog/TV and local listening scene are always exclusive',()=>{
 for(const mode of ['music','tv'])for(const tab of ['music','catalog','jam','invite','settings']){
   const value=surfaceLayout(tab,mode);assert(!(value.remoteVisible&&value.sceneVisible));
   if(tab==='catalog')assert(value.remoteVisible&&!value.dockVisible);
   if(tab==='music')assert(value.sceneVisible&&!value.remoteVisible&&value.dockVisible);
 }
});
test('artwork requests a real high-resolution CDN asset and rejects arbitrary image origins',()=>{
 assert.equal(cover({videoId:'abcdefghijk',cover:'https://lh3.googleusercontent.com/image=w60-h60-l90-rj'}),'https://lh3.googleusercontent.com/image=w1000-h1000-l90-rj');
 assert.equal(cover({videoId:'abcdefghijk',cover:'https://attacker.example/image.jpg'}),'https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg');
 assert.equal(cover({videoId:'bad'}),'cover-placeholder.svg');
 assert.equal(cover({videoId:'abcdefghijk',cover:'file:///C:/private.png'}),'https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg');
});
