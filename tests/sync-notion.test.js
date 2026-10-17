'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
// Override credentials before loading the script; tests never access real services.
for (const name of ['NOTION_TOKEN', 'NOTION_DATABASE_ID', 'R2_SECRET_KEY', 'R2_ACCESS_KEY']) process.env[name] = 'test';
process.env.R2_ENDPOINT = 'https://example.com';
const { main, computeContentHash, slugify } = require('../tools/sync-notion');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stableMarkdown } = require('../tools/content-fingerprint');

const signedImage = (signature, asset = 'asset') => [{ id: 'image-1', type: 'image', image: {
  type: 'file', caption: [], file: {
    url: `https://prod-files-secure.s3.us-west-2.amazonaws.com/workspace/${asset}/image.png?X-Amz-Date=${signature}&X-Amz-Signature=${signature}`,
    expiry_time: `expiry-${signature}`,
  },
} }];

test('Notion file signature renewal is ignored, while actual content and asset changes are detected', () => {
  const first = signedImage('first');
  const original = structuredClone(first);
  assert.equal(computeContentHash(first), computeContentHash(signedImage('second')));
  assert.deepEqual(first, original, 'fingerprinting must not alter download URLs');
  assert.notEqual(computeContentHash(first), computeContentHash(signedImage('second', 'new-asset')));
  const version = signedImage('first');
  version[0].image.file.url += '&versionId=updated';
  assert.notEqual(computeContentHash(first), computeContentHash(version));
  const caption = signedImage('first');
  caption[0].image.caption = [{ plain_text: 'New caption' }];
  assert.notEqual(computeContentHash(first), computeContentHash(caption));
  const paragraph = text => [{ id: 'text-1', type: 'paragraph', paragraph: { rich_text: [{ plain_text: text }] } }];
  assert.notEqual(computeContentHash(paragraph('old')), computeContentHash(paragraph('new')));
  const external = query => [{ id: 'image-2', type: 'image', image: {
    type: 'external', external: { url: `https://example.com/image.png?${query}` },
  } }];
  assert.notEqual(computeContentHash(external('v=1')), computeContentHash(external('v=2')));
  assert.notEqual(computeContentHash(external('X-Amz-Signature=1')), computeContentHash(external('X-Amz-Signature=2')));
});

test('Markdown comparison only ignores credentials on Notion hosted file URLs', () => {
  const markdown = signature => `![caption](${signedImage(signature)[0].image.file.url}&versionId=1)`;
  assert.equal(stableMarkdown(markdown('first')), stableMarkdown(markdown('second')));
  assert.notEqual(stableMarkdown(markdown('first')), stableMarkdown(markdown('second').replace('versionId=1', 'versionId=2')));
  const external = '![caption](https://example.com/image.png?X-Amz-Signature=1)';
  assert.equal(stableMarkdown(external), external);
});

const page = { id: 'page-1', created_time: '2026-10-13T10:00:00Z', properties: {
  '名称': { title: [{ plain_text: '用 AI ' }, { plain_text: '做项目的一些思考' }] },
  '状态': { status: { name: '完成' } },
} };

test('failed saves are not marked synced, while other pages can still finish', async () => {
  const updates = [];
  await assert.rejects(main({
    queryDatabase: async () => [page, { ...page, id: 'page-2' }],
    getPageBlocks: async () => [],
    processPage: async id => { if (id === 'page-1') throw new Error('disk write failed'); },
    notionAPI: async (url, body) => updates.push({ url, body }),
  }), /1 篇/);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].url, '/pages/page-2');
  assert.equal(updates[0].body.properties['发布状态'].select.name, '待发布');
});

test('block fetch failures fail the workflow and leave Notion status untouched', async () => {
  let updated = false;
  await assert.rejects(main({ queryDatabase: async () => [page],
    getPageBlocks: async () => { throw new Error('unavailable'); },
    notionAPI: async () => { updated = true; },
  }), /同步未完成/);
  assert.equal(updated, false);
});

test('complete rich-text titles survive synchronization', async () => {
  let title;
  await main({ queryDatabase: async () => [page], getPageBlocks: async () => [],
    processPage: async (_, text) => { title = text; }, notionAPI: async () => {},
  });
  assert.equal(title, '用 AI 做项目的一些思考');
});

test('a title change with the same slug and unchanged body still synchronizes', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-title-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const title = '用 AI 做项目的一些思考';
  const existing = path.join(dir, `${slugify(title)}.md`);
  fs.writeFileSync(existing, '---\ntitle: 用 ai 做项目的一些思考\n---\nbody');
  let saved = false;
  await main({ postsDir: dir,
    queryDatabase: async () => [{ ...page, properties: { ...page.properties, '状态': { status: { name: '已同步' } } } }],
    getPageBlocks: async () => [], getStoredHash: () => computeContentHash([]),
    processPage: async () => { saved = true; }, notionAPI: async () => {},
  });
  assert.equal(saved, true);
});

test('legacy signature-only updates migrate fingerprints without rewriting images or publication status', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-fingerprint-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const title = '用 AI 做项目的一些思考';
  const file = path.join(dir, `${slugify(title)}.md`);
  const oldUrl = signedImage('old')[0].image.file.url;
  const original = `---\ntitle: ${JSON.stringify(title)}\nnotion_id: page-1\nnotion_hash: legacy\n---\n\n<!-- more -->\n\n![](${oldUrl})\n\n`;
  fs.writeFileSync(file, original);
  const blocks = signedImage('renewed');
  const services = { postsDir: dir,
    queryDatabase: async () => [{ ...page, properties: { ...page.properties, '状态': { status: { name: '已同步' } } } }],
    getPageBlocks: async () => blocks,
    getStoredHash: () => fs.readFileSync(file, 'utf8').match(/^notion_hash: (.+)$/m)?.[1],
    processPage: async () => assert.fail('signature renewal must not regenerate the article'),
    notionAPI: async () => assert.fail('signature renewal must not reset publication status'),
  };
  await main(services);
  const migrated = fs.readFileSync(file, 'utf8');
  assert.equal(migrated, original.replace('notion_hash: legacy', `notion_hash: ${computeContentHash(blocks)}`));
  await main(services);
  assert.equal(fs.readFileSync(file, 'utf8'), migrated);
  blocks[0].image.file.url = signedImage('renewed', 'replacement')[0].image.file.url;
  let regenerated = false;
  await main({ ...services, processPage: async () => { regenerated = true; }, notionAPI: async () => {} });
  assert.equal(regenerated, true, 'replacing an actual image must still sync');
});

test('unchanged legacy articles gain stable page identities without republishing their bodies', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-identity-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const title = '用 AI 做项目的一些思考';
  const file = path.join(dir, `${slugify(title)}.md`);
  const hash = computeContentHash([]);
  const original = `---\ntitle: ${JSON.stringify(title)}\nnotion_hash: ${hash}\n---\n\nExisting body\n`;
  fs.writeFileSync(file, original);
  await main({ postsDir: dir,
    queryDatabase: async () => [{ ...page, properties: { ...page.properties, '状态': { status: { name: '已同步' } } } }],
    getPageBlocks: async () => [], getStoredHash: () => hash,
    processPage: async () => assert.fail('unchanged article must not be regenerated'),
    notionAPI: async () => assert.fail('published status must stay unchanged'),
  });
  assert.equal(fs.readFileSync(file, 'utf8'), original.replace('notion_hash:', 'notion_id: page-1\nnotion_hash:'));
});
