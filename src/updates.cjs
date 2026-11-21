'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const repository='https://github.com/svyatoslavpodolskii/JAMSTORM';
function newer(candidate,current){
 const parse=value=>/^v?(\d+)\.(\d+)\.(\d+)$/.exec(value)?.slice(1).map(Number);
 const a=parse(candidate),b=parse(current);if(!a||!b)return false;
 for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;
}
async function check(current){
 const response=await fetch('https://api.github.com/repos/svyatoslavpodolskii/JAMSTORM/releases/latest',{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('GitHub: '+response.status);
 const release=await response.json();if(!newer(release.tag_name,current))return {available:false};
 const version=release.tag_name.replace(/^v/,''),filename=`JAMSTORM-${version}-setup.exe`;
 const asset=release.assets?.find(a=>a.name===filename),checksum=release.assets?.find(a=>a.name==='SHA256SUMS');
 const prefix=repository+'/releases/download/'+release.tag_name+'/';
 if(!asset||!checksum||asset.browser_download_url!==prefix+filename||checksum.browser_download_url!==prefix+'SHA256SUMS')throw Error('Release has no verified installer');
 return {available:true,version,filename,url:asset.browser_download_url,checksum:checksum.browser_download_url};
}
async function download(release,directory){
 await fs.mkdir(directory,{recursive:true});
 const sums=await fetch(release.checksum,{signal:AbortSignal.timeout(15000)});if(!sums.ok)throw Error('Checksum download failed');
 const line=(await sums.text()).split(/\r?\n/).find(line=>line.trim().endsWith(' '+release.filename));
 const hash=line?.match(/^([a-f0-9]{64})\s+\*?([^\s]+)$/i);
 if(!hash||hash[2]!==release.filename)throw Error('Installer checksum missing');
 const response=await fetch(release.url,{signal:AbortSignal.timeout(180000)});
 if(!response.ok||Number(response.headers.get('content-length'))>300000000)throw Error('Installer download failed');
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>300000000)throw Error('Installer too large');chunks.push(chunk);}
 const data=Buffer.concat(chunks);if(crypto.createHash('sha256').update(data).digest('hex')!==hash[1].toLowerCase())throw Error('Installer checksum mismatch');
 const filename=path.join(directory,release.filename);await fs.writeFile(filename,data);return filename;
}
module.exports={newer,check,download};
