const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
let failed = false;
for (const dir of ['src', 'src/ui', 'src/room', 'scripts', 'test']) for (const name of readdirSync(dir)) {
  if (!/\.(cjs|js)$/.test(name)) continue;
  const r = spawnSync(process.execPath, ['--check', join(dir, name)], { encoding: 'utf8' });
  if (r.status) { process.stderr.write(r.stderr); failed = true; }
}
process.exitCode = failed ? 1 : 0;
