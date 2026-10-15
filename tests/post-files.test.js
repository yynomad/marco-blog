'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { frontmatterValue, removeStalePosts } = require('../tools/post-files');

test('renaming a Notion article removes its orphaned file without deleting other articles', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-posts-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const files = {
    'old-title.md': 'notion_hash: old\npermalink: stable-route/',
    'old-id.md': 'notion_id: page-1\npermalink: other-route/',
    'active.md': 'notion_hash: active\npermalink: stable-route/',
    'manual.md': 'permalink: stable-route/',
    'different-page.md': 'notion_id: page-2\npermalink: stable-route/',
    'current.md': 'notion_id: page-1\npermalink: stable-route/',
  };
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), `---\n${text}\n---\nbody`);
  const removed = removeStalePosts(dir, { filename: 'current.md', pageId: 'page-1', permalink: '/stable-route',
    activeFiles: new Set(['active.md']) });
  assert.deepEqual(removed.sort(), ['old-id.md', 'old-title.md']);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['active.md', 'current.md', 'different-page.md', 'manual.md']);
});

test('metadata reading stays inside frontmatter and supports quoted permalinks', () => {
  assert.equal(frontmatterValue('---\npermalink: "a-route/"\n---\npermalink: wrong', 'permalink'), 'a-route/');
  assert.equal(frontmatterValue('body\nnotion_hash: do-not-delete', 'notion_hash'), '');
});
