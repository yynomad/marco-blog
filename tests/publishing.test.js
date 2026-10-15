'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createManifest } = require('../tools/deployment-manifest');
const { cloudflareCheck, publicationNotice, verifySite, inspectPublication,
  sendTelegram, markPublished, main } = require('../tools/monitor-publish');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sha = 'a'.repeat(40);
const site = 'https://blog.heyyao.com/';
const articles = [{ title: '用 AI 做项目的一些思考', path: 'ai-coding-delivery-workflow/', hash: 'body-v2' }];
const manifest = { commit: sha, builtAt: '2026-10-15T10:00:00Z', articles };
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const published = { status: 'published', commit: sha, site, articles };

test('the optional dependency that blocked Cloudflare is present in the lock file', () => {
  const lock = require('../package-lock.json');
  const entry = lock.packages['node_modules/@types/trusted-types'];
  assert.equal(entry.version, '2.0.7');
  assert.equal(entry.optional, true);
  assert.match(entry.integrity, /^sha512-/);
});

test('manifest excludes drafts and scheduled articles, and detects body changes', () => {
  const post = { title: 'A', path: 'a/', published: true, date: '2026-10-13', content: 'one' };
  const first = createManifest([post, { ...post, path: 'draft/', published: false },
    { ...post, path: 'future/', date: '2027-01-01' }], sha, new Date('2026-10-15'));
  assert.equal(first.articles.length, 1);
  const second = createManifest([{ ...post, content: 'two' }], sha, new Date('2026-10-15'));
  assert.notEqual(first.articles[0].hash, second.articles[0].hash);
  assert.throws(() => createManifest([post], ''), /commit/);
  assert.throws(() => createManifest([post, { ...post, title: 'Renamed' }], sha, new Date('2026-10-15')), /Duplicate article path/);
});

test('successful Notion sync cannot masquerade as successful Cloudflare build', () => {
  const check = cloudflareCheck([
    { id: 20, name: 'sync', conclusion: 'success', app: { slug: 'github-actions' } },
    { id: 10, name: 'Workers Builds: marco-blog', conclusion: 'failure',
      app: { slug: 'cloudflare-workers-and-pages' } },
  ]);
  assert.equal(check.conclusion, 'failure');
});

test('unchanged publications and repeated failures stay quiet; recovery notifies', () => {
  const previous = { status: 'published', articles: { [articles[0].path]: articles[0].hash } };
  assert.equal(publicationNotice(previous, published), null);
  const failed = { status: 'failed', stage: 'Cloudflare 构建', detail: 'error', url: 'https://example.com/logs' };
  assert.match(publicationNotice(previous, failed), /失败/);
  assert.equal(publicationNotice(failed, { ...failed, commit: 'new' }), null);
  assert.equal(publicationNotice(previous, { status: 'pending' }), null);
  assert.match(publicationNotice({ ...previous, ...failed }, published), /恢复/);
  assert.match(publicationNotice(undefined, published), /ai-coding-delivery-workflow/);
});

test('old deployments, missing articles and homepage omissions fail verification', async () => {
  await assert.rejects(verifySite(sha, site, async () => json({ ...manifest, commit: 'old' })), /旧版本/);
  await assert.rejects(verifySite(sha, site, async url => String(url).includes('deployment.json')
    ? json(manifest) : new Response('old homepage')), /首页/);
  await assert.rejects(verifySite(sha, site, async url => String(url).includes('deployment.json')
    ? json(manifest) : String(url) === site ? new Response(articles[0].title) : new Response('', { status: 404 })), /文章/);
  const checked = [];
  assert.deepEqual(await verifySite(sha, site, async url => {
    checked.push(String(url));
    return String(url).includes('deployment.json') ? json(manifest)
      : new Response(`<title>${articles[0].title} | 小远的blog</title>`);
  }), manifest);
  assert(checked.includes(site + articles[0].path));
  await assert.rejects(verifySite(sha, site, async url => String(url).includes('deployment.json')
    ? json(manifest) : String(url) === site ? new Response(articles[0].title)
      : new Response(`<title>Another article | 小远的blog</title><aside>${articles[0].title}</aside>`)), /文章/);
});

test('a failed or stalled build is actionable while a fresh build stays pending', async () => {
  const now = Date.parse('2026-10-15T10:00:00Z');
  const commit = { sha, commit: { committer: { date: '2026-10-15T09:59:00Z' } } };
  const check = { id: 1, name: 'Workers Builds: marco-blog', app: { slug: 'cloudflare-workers-and-pages' },
    status: 'completed', conclusion: 'failure', details_url: 'https://example.com/logs' };
  const github = async route => route === '/commits/main' ? commit : { check_runs: [check] };
  assert.equal((await inspectPublication(github, site, undefined, now)).status, 'failed');
  check.status = 'in_progress';
  assert.equal((await inspectPublication(github, site, undefined, now)).status, 'pending');
  assert.equal((await inspectPublication(github, site, undefined, now + 21 * 60000)).status, 'failed');
});

test('Telegram failures are surfaced without leaking bot credentials', async () => {
  const env = { TELEGRAM_BOT_TOKEN: 'secret-token', TELEGRAM_CHAT_ID: '123' };
  await assert.rejects(sendTelegram('test', env, async url => { throw new Error(String(url)); }), error =>
    !error.message.includes('secret-token') && /Network/.test(error.message));
  await assert.rejects(sendTelegram('test', env, async () => json({ ok: false })), /rejected/);
  await sendTelegram('已上线', env, async (url, request) => {
    assert.equal(JSON.parse(request.body).chat_id, '123');
    assert.equal(JSON.parse(request.body).text, '已上线');
    return json({ ok: true });
  });
});

test('Notion marks only deployed articles and never a newer unsynced edit', async () => {
  const updated = [];
  const page = (id, title, edited) => ({ id, last_edited_time: edited,
    properties: { '名称': { title: [{ plain_text: title }] } } });
  await markPublished(manifest, { NOTION_TOKEN: 'test', NOTION_DATABASE_ID: 'db' }, async (url, request) => {
    if (String(url).endsWith('/query')) return json({ results: [
      page('ready', articles[0].title, '2026-10-15T09:00:00Z'),
      page('newer-edit', articles[0].title, '2026-10-15T11:00:00Z'),
      page('not-on-site', 'Unpublished', '2026-10-15T09:00:00Z'),
    ], next_cursor: null });
    updated.push({ url: String(url), body: JSON.parse(request.body) });
    return json({});
  });
  assert.equal(updated.length, 1);
  assert(updated[0].url.endsWith('/ready'));
  assert.equal(updated[0].body.properties['发布状态'].select.name, '已发布');
});

test('monitor persists deduplication and retries a failed Telegram delivery', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-monitor-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { GITHUB_TOKEN: 'github-test', GITHUB_REPOSITORY: 'owner/blog',
    TELEGRAM_BOT_TOKEN: 'telegram-test', TELEGRAM_CHAT_ID: '123',
    PUBLISH_STATE_FILE: path.join(dir, 'state.json') };
  const notices = [];
  let telegramAvailable = false;
  const fakeFetch = async (url, options) => {
    const target = String(url);
    if (target.startsWith('https://api.telegram.org/')) {
      if (!telegramAvailable) throw new Error('transport unavailable');
      notices.push(JSON.parse(options.body).text);
      return json({ ok: true });
    }
    if (target.includes('/actions/workflows/')) return json({ workflow_runs: [] });
    if (target.includes('/check-runs')) return json({ check_runs: [{
      id: 1, app: { slug: 'cloudflare-workers-and-pages' }, name: 'Workers Builds: marco-blog',
      status: 'completed', conclusion: 'failure', details_url: 'https://example.com/build',
    }] });
    return json({ sha, commit: { committer: { date: '2026-10-13T00:00:00Z' } } });
  };
  await assert.rejects(main(env, fakeFetch), /Network/);
  assert.equal(fs.existsSync(env.PUBLISH_STATE_FILE), false);
  telegramAvailable = true;
  assert.equal((await main(env, fakeFetch)).failed, true);
  await main(env, fakeFetch);
  assert.equal(notices.length, 1);
  assert.match(notices[0], /Cloudflare/);
});

test('an API outage alerts once and preserves the last successful publication', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-monitor-outage-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const stateFile = path.join(dir, 'state.json');
  const publication = { status: 'published', commit: sha, articles: {} };
  fs.writeFileSync(stateFile, JSON.stringify({ publication }));
  const env = { GITHUB_TOKEN: 'test', GITHUB_REPOSITORY: 'owner/blog', TELEGRAM_BOT_TOKEN: 'test',
    TELEGRAM_CHAT_ID: '123', PUBLISH_STATE_FILE: stateFile };
  let notices = 0;
  const fakeFetch = async url => {
    if (String(url).startsWith('https://api.telegram.org/')) { notices++; return json({ ok: true }); }
    return new Response('', { status: 503 });
  };
  await assert.rejects(main(env, fakeFetch), /503/);
  await assert.rejects(main(env, fakeFetch), /503/);
  assert.equal(notices, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(stateFile)).publication, publication);
});
