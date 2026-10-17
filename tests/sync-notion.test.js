'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
// Override credentials before loading the script; tests never access real services.
for (const name of ['NOTION_TOKEN', 'NOTION_DATABASE_ID', 'R2_SECRET_KEY', 'R2_ACCESS_KEY']) process.env[name] = 'test';
process.env.R2_ENDPOINT = 'https://example.com';
process.env.R2_ACCESS_KEY = 'a'.repeat(32);
process.env.R2_SECRET_KEY = 'b'.repeat(64);
process.env.R2_BUCKET = 'test-bucket';
process.env.R2_PUBLIC_URL = 'https://images.example.com';
const { main, computeContentHash, slugify, processPage, blocksToMarkdown } = require('../tools/sync-notion');
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

test('signature renewal leaves articles already using permanent R2 images untouched', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-fingerprint-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const title = '用 AI 做项目的一些思考';
  const file = path.join(dir, `${slugify(title)}.md`);
  const original = `---\ntitle: ${JSON.stringify(title)}\nnotion_id: page-1\nnotion_hash: ${computeContentHash(signedImage('old'))}\n---\n\n<!-- more -->\n\n![](https://images.example.com/permanent.png)\n\n`;
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
  assert.equal(migrated, original);
  await main(services);
  assert.equal(fs.readFileSync(file, 'utf8'), migrated);
  blocks[0].image.file.url = signedImage('renewed', 'replacement')[0].image.file.url;
  let regenerated = false;
  await main({ ...services, processPage: async () => { regenerated = true; }, notionAPI: async () => {} });
  assert.equal(regenerated, true, 'replacing an actual image must still sync');
});

test('expired Notion image references are repaired even when the content hash is unchanged', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-image-repair-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const title = '用 AI 做项目的一些思考';
  const blocks = signedImage('fresh');
  const hash = computeContentHash(blocks);
  const file = path.join(dir, `${slugify(title)}.md`);
  const original = `---\ntitle: ${JSON.stringify(title)}\nnotion_id: page-1\nnotion_hash: ${hash}\n---\n\n<!-- more -->\n\n![](${signedImage('expired')[0].image.file.url})\n\n`;
  fs.writeFileSync(file, original);
  let uploaded = 0;
  let marked = 0;
  const services = { postsDir: dir,
    queryDatabase: async () => [{ ...page, properties: { ...page.properties, '状态': { status: { name: '已同步' } } } }],
    getPageBlocks: async () => blocks, getStoredHash: () => hash,
    processPage: (...args) => processPage(...args, { postsDir: dir,
      downloadImage: async url => {
        assert.equal(url, blocks[0].image.file.url);
        return { buffer: Buffer.from('image'), filename: 'image.png', contentType: 'image/png' };
      },
      uploadToR2: async () => { uploaded++; return 'https://images.example.com/permanent.png'; },
    }),
    notionAPI: async () => { marked++; },
  };
  await main(services);
  assert.equal(uploaded, 1);
  assert.equal(marked, 1);
  assert.match(fs.readFileSync(file, 'utf8'), /https:\/\/images\.example\.com\/permanent\.png/);
  assert(!fs.readFileSync(file, 'utf8').includes('X-Amz-'));
  blocks[0].image.file.url = signedImage('later')[0].image.file.url;
  await main(services);
  assert.equal(uploaded, 1);
  assert.equal(marked, 1);
});

test('R2 failures preserve the previous article, fail sync and never mark it published', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-image-failure-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const title = '用 AI 做项目的一些思考';
  const file = path.join(dir, `${slugify(title)}.md`);
  const original = 'An existing article with usable images';
  fs.writeFileSync(file, original);
  let marked = false;
  await assert.rejects(main({ postsDir: dir,
    queryDatabase: async () => [page], getPageBlocks: async () => signedImage('fresh'),
    processPage: (...args) => processPage(...args, { postsDir: dir,
      downloadImage: async () => ({ buffer: Buffer.from('image'), filename: 'image.png', contentType: 'image/png' }),
      uploadToR2: async () => { throw new Error('secret-request-must-not-be-logged'); },
    }), notionAPI: async () => { marked = true; },
  }), /同步未完成/);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.equal(marked, false);
  await assert.rejects(blocksToMarkdown(signedImage('fresh'), {}), /拒绝保存临时链接/);
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
