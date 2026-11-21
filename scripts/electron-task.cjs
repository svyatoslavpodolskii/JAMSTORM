const {spawn}=require('node:child_process'),path=require('node:path');
const filename={review:'ui-review.cjs',icons:'icons.cjs'}[process.argv[2]];
if(!filename)throw Error('Expected review or icons');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
spawn(require('electron'),[path.join(__dirname,filename)],{env,stdio:'inherit',windowsHide:true}).on('error',e=>{console.error(e.message);process.exitCode=1;}).on('exit',code=>process.exitCode=code??1);
