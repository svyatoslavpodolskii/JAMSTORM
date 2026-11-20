const fs = require('node:fs');
const { fileURLToPath } = require('node:url');
function localPageGuard(file) {
  const canonical = value => { const real = fs.realpathSync(value); return process.platform === 'win32' ? real.toLowerCase() : real; };
  const expected = canonical(file);
  return value => {
    try { const url = new URL(value); return url.protocol === 'file:' && !url.search && !url.hash && canonical(fileURLToPath(url)) === expected; }
    catch { return false; }
  };
}
module.exports = { localPageGuard };
