const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('client registers the package identity requested by the host', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const factories = new Map();
  vm.runInNewContext(fs.readFileSync(path.join(root, manifest.exports['./client']), 'utf8'), {
    window: { __ModuleLoader__: { load(registration) {
      assert.equal(factories.has(registration.id), false, 'duplicate registration');
      factories.set(registration.id, registration.factory);
    } } },
  });
  assert.equal(typeof factories.get(manifest.name), 'function',
    `host must find ${manifest.name} after loading its client bundle`);
  assert.equal(factories.size, 1);
  const patch = fs.readFileSync(path.join(root, manifest.dsh.bundle.patch), 'utf8');
  const entryName = patch.match(/^\s+name:\s*['"]?([^'"\s]+)['"]?\s*$/m)?.[1];
  assert.equal(entryName, manifest.name);
});
