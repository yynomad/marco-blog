'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('package-lock.json only resolves packages from registry.npmjs.org', () => {
  const lockfilePath = path.join(__dirname, '..', 'package-lock.json');
  const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
  const badEntries = [];

  for (const [pkgPath, meta] of Object.entries(lockfile.packages || {})) {
    if (!meta || typeof meta.resolved !== 'string') continue;
    if (!meta.resolved.startsWith('https://registry.npmjs.org/')) {
      badEntries.push(`${pkgPath || '<root>'}: ${meta.resolved}`);
    }
  }

  assert.deepEqual(
    badEntries,
    [],
    `Found non-npmjs.org resolved URLs in package-lock.json:\n${badEntries.join('\n')}`
  );
});
