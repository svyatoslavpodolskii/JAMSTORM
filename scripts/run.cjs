const { spawn } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env };
// Coding-agent shells may use Electron as a Node executable. The app needs GUI mode.
delete env.ELECTRON_RUN_AS_NODE;
const args = process.argv.slice(2);
const testing=args.some(a=>a.includes('smoke-test')||a==='--catalog-review');
let completed,teardown,forced=false,output='';
const child = spawn(require('electron'), [path.join(__dirname, '..'), ...args], {
  env, stdio: testing?['ignore','pipe','pipe']:'inherit', windowsHide: args.some(a => a.includes('smoke-test'))
});
if(testing){
 child.stderr.on('data',chunk=>process.stderr.write(chunk));
 child.stdout.on('data',chunk=>{
  process.stdout.write(chunk);output=(output+chunk.toString()).slice(-5000);
  const marker=output.match(/^SMOKE_EXIT ([01])\r?$/m);
  if(marker&&completed===undefined){completed=Number(marker[1]);teardown=setTimeout(()=>{forced=true;console.log('SMOKE_TEARDOWN_FORCED after completed assertions');child.kill();},2000);}
 });
}
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => {clearTimeout(teardown);process.exitCode=forced?completed:code??1;});
