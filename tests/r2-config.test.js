'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { credentialDiagnostics, r2Config } = require('../tools/r2-config');
const env = { R2_ACCESS_KEY: 'a'.repeat(32), R2_SECRET_KEY: 'b'.repeat(64),
  R2_ENDPOINT: 'https://example.r2.cloudflarestorage.com/',
  R2_BUCKET: 'blog-images', R2_PUBLIC_URL: 'https://images.example.com/' };

test('R2 validation catches malformed credentials before signing and never leaks their values', () => {
  assert.equal(r2Config(env).publicUrl, 'https://images.example.com');
  for (const name of ['R2_ACCESS_KEY', 'R2_SECRET_KEY']) {
    for (const bad of ['凭据说明', '\n' + env[name], env[name] + '\r\n', '"' + env[name] + '"', 'missing']) {
      assert.throws(() => r2Config({ ...env, [name]: bad }), error =>
        error.message.includes(name) && !error.message.includes(bad));
      const diagnostics = credentialDiagnostics({ ...env, [name]: bad });
      assert.equal(diagnostics[name].validFormat, false);
      assert(!JSON.stringify(diagnostics).includes(bad));
    }
  }
  const result = credentialDiagnostics({ ...env, R2_ACCESS_KEY: env.R2_ACCESS_KEY + '\n说明' });
  assert.equal(result.R2_ACCESS_KEY.controlCharacters, true);
  assert.equal(result.R2_ACCESS_KEY.nonAscii, true);
});

test('R2 endpoint and public origin reject accidental credentials, queries and whitespace', () => {
  for (const name of ['R2_ENDPOINT', 'R2_PUBLIC_URL']) {
    for (const bad of ['http://example.com', 'https://user:password@example.com',
      'https://example.com?token=secret', ' https://example.com']) {
      assert.throws(() => r2Config({ ...env, [name]: bad }), new RegExp(name));
    }
  }
});
