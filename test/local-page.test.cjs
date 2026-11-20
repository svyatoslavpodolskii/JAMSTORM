const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { localPageGuard } = require('../src/local-page.cjs');
test('local IPC origin accepts canonical file URLs and rejects other documents and web URLs', () => {
  const file = path.join(__dirname, '../src/ui/index.html'); const allowed = localPageGuard(file);
  assert(allowed(pathToFileURL(file).href));
  assert(!allowed(pathToFileURL(path.join(__dirname, '../src/ui/app.js')).href));
  assert(!allowed('https://music.youtube.com'));
  assert(!allowed('file:///missing.html'));
  assert(!allowed(pathToFileURL(file).href + '?injected'));
  if (process.platform === 'win32') assert(allowed(pathToFileURL(file).href.toUpperCase().replace('FILE:', 'file:')));
});
