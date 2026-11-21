const {test}=require('node:test'),assert=require('node:assert/strict');
const {newer}=require('../src/updates.cjs');
test('updates accept only strictly newer stable versions',()=>{
 assert.equal(newer('v0.7.0','0.6.2'),true);
 assert.equal(newer('v0.10.0','0.9.9'),true);
 for(const candidate of ['v0.6.2','v0.6.1','v0.7.0-beta','latest','../../../setup.exe'])assert.equal(newer(candidate,'0.6.2'),false);
});
test('download refuses a corrupted installer before writing an executable',async()=>{
 const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
 const {download}=require('../src/updates.cjs');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'jamstorm-update-test-'));
 const previous=global.fetch;
 global.fetch=async url=>url==='checksum'?new Response('a'.repeat(64)+'  JAMSTORM-0.7.0-setup.exe'):new Response('corrupted installer');
 try{
  await assert.rejects(download({checksum:'checksum',url:'installer',filename:'JAMSTORM-0.7.0-setup.exe'},directory),/checksum mismatch/);
  assert.deepEqual(await fs.readdir(directory),[]);
 }finally{global.fetch=previous;await fs.rm(directory,{recursive:true,force:true});}
});
