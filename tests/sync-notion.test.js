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
