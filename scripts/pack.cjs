const path = require('node:path');
const { spawn } = require('node:child_process');
const { getMakeNsisPath } = require('app-builder-lib/out/toolsets/windows');
async function main() {
  const root = path.join(__dirname, '..');
  const compiler = await getMakeNsisPath();
  const output = path.join(root, 'dist', `JAMSTORM-${require('../package.json').version}-portable.exe`);
  await new Promise((resolve, reject) => {
    const child = spawn(compiler.path, ['-V2', '-INPUTCHARSET', 'UTF8', `-DJAM_ICON=${path.join(root, 'assets/icon.ico')}`, `-DJAM_APP=${path.join(root, 'dist/win-unpacked')}`, `-DJAM_OUT=${output}`, path.join(__dirname, 'portable.nsi')], {
      env: { ...process.env, ...compiler.env }, stdio: 'inherit', windowsHide: true
    });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`NSIS exited with ${code}`)));
  });
  console.log('Portable ready:', output);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
