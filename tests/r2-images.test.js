'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyPublicImage } = require('../tools/r2-images');

test('successful storage writes are accepted only when the public URL actually serves an image', async () => {
  const url = 'https://images.example.com/image.png';
  await verifyPublicImage(url, async (target, options) => {
    assert.equal(target, url);
    assert.equal(options.method, 'HEAD');
    return new Response(null, { headers: { 'content-type': 'image/png' } });
  });
  for (const response of [new Response(null, { status: 403 }), new Response(null, { status: 404 }),
    new Response(null, { headers: { 'content-type': 'text/html' } })]) {
    await assert.rejects(verifyPublicImage(url, async () => response), error =>
      error.name === 'PublicImageVerificationError' && error.statusCode === response.status);
  }
  await assert.rejects(verifyPublicImage(url, async () => { throw new Error('network unavailable'); }), /network/);
});
