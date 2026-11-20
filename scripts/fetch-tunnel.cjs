'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const version='2026.11.1',expected='341deda3db5ec498a0482254d6c38c0b7cf01a30c37bb5dd95d2216d08955e35';
async function main(){
  const dir=path.join(__dirname,'../vendor');fs.mkdirSync(dir,{recursive:true});
  const response=await fetch(`https://github.com/cloudflare/cloudflared/releases/download/${version}/cloudflared-windows-amd64.exe`,{signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw new Error('cloudflared download failed');
  const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error('cloudflared SHA-256 mismatch');
  fs.writeFileSync(path.join(dir,'cloudflared.exe'),bytes);console.log(`Verified cloudflared ${version}`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
