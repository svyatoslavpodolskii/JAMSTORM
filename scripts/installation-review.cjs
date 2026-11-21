'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
// Leave this disposable installation available for inspection; no user install is touched.
const directory=path.join(root,'artifacts','installer review '+version);
const installer=path.join(root,'dist',`JAMSTORM-${version}-setup.exe`);
const install=spawnSync(installer,['/S','/D='+directory],{windowsHide:true,windowsVerbatimArguments:true,encoding:'utf8',timeout:120000});
if(install.error||install.status!==0)throw install.error||Error('Installer failed: '+install.status);
if(!fs.existsSync(path.join(directory,'self-contained')))throw Error('Self-contained marker missing');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const check=spawnSync(path.join(directory,'JAMSTORM.exe'),['--installation-check'],{env,windowsHide:true,encoding:'utf8',timeout:30000});
if(check.error||check.status!==0)throw check.error||Error('Installed application failed: '+check.stderr);
const paths=JSON.parse(check.stdout.match(/INSTALLATION_PATHS (.+)/)?.[1]||'null');
if(!paths?.selfContained)throw Error('Installation check produced no result: '+check.stdout);
for(const key of ['userData','sessionData','logs','temp'])if(!paths[key].startsWith(directory+path.sep))throw Error(key+' escapes the chosen folder');
console.log('INSTALLATION_REVIEW_OK',JSON.stringify(paths));
