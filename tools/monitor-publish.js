'use strict';

// Deliberately uses only Node built-ins: notifications must work when npm ci fails.
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');

const escapeHtml = text => text.replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[ch]);

function cloudflareCheck(checks) {
  return checks.filter(check => check.app?.slug === 'cloudflare-workers-and-pages'
    && check.name === 'Workers Builds: marco-blog')
    .sort((a, b) => b.id - a.id)[0];
}

function publicationNotice(previous, current) {
  if (current.status === 'pending') return null;
  if (current.status === 'failed') {
    if (previous?.status === 'failed' && previous.stage === current.stage) return null;
    return `❌ 博客发布失败\n阶段：${current.stage}\n${current.detail}\n${current.url}`;
  }
  // An absent cache establishes a baseline; it must not announce the archive.
  // A known route stays known when its body, title or temporary image URLs change.
  const knownIds = new Set(previous?.articleIds || []);
  const added = previous?.articles ? current.articles.filter(article =>
    !Object.hasOwn(previous.articles, article.path) && (!article.id || !knownIds.has(article.id))) : [];
  if (previous?.status !== 'failed' && added.length === 0) return null;
  const heading = previous?.status === 'failed' ? '✅ 博客发布已恢复' : '✅ 博客文章已上线';
  const list = added.slice(0, 5).map(article => `${article.title}\n${new URL(article.path, current.site).href}`);
  return `${heading}\n${list.join('\n') || current.site}`;
}

async function jsonRequest(url, options = {}, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(20000) });
  } catch {
    // Never include URLs here: Telegram puts its secret token in the request path.
    throw new Error('Network request failed');
  }
  if (!response.ok) throw new Error(`Remote service returned HTTP ${response.status}`);
  return response.json();
}

async function sendTelegram(text, env = process.env, fetchImpl = fetch) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new Error('Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in GitHub Secrets');
  }
  const result = await jsonRequest(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: text.slice(0, 4000),
      link_preview_options: { is_disabled: true } }),
  }, fetchImpl);
  if (!result.ok) throw new Error('Telegram rejected the notification');
}

async function verifySite(commit, site, fetchImpl = fetch) {
  const manifest = await jsonRequest(new URL(`deployment.json?revision=${commit}`, site), {
    headers: { 'cache-control': 'no-cache' },
  }, fetchImpl);
  if (manifest.commit !== commit) throw new Error('线上仍是旧版本');
  if (!Array.isArray(manifest.articles) || manifest.articles.length === 0) throw new Error('线上文章清单为空');
  const home = await fetchImpl(site, { signal: AbortSignal.timeout(20000) });
  if (!home.ok) throw new Error(`首页返回 HTTP ${home.status}`);
  const homepage = await home.text();
  const latest = manifest.articles[0];
  if (!homepage.includes(escapeHtml(latest.title))) throw new Error('首页缺少最新文章');
  for (const article of manifest.articles) {
    const url = new URL(article.path, site);
    if (url.origin !== new URL(site).origin) throw new Error('文章地址不属于博客域名');
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
    const html = await response.text();
    const pageTitle = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '';
    if (!response.ok || !pageTitle.startsWith(`${escapeHtml(article.title)} | `)) {
      throw new Error(`文章无法正常访问：${article.title}`);
    }
  }
  return manifest;
}

async function inspectPublication(github, site, fetchImpl = fetch, now = Date.now()) {
  const commit = await github('/commits/main');
  const checks = await github(`/commits/${commit.sha}/check-runs?per_page=100`);
  const check = cloudflareCheck(checks.check_runs);
  const age = now - Date.parse(check?.started_at || commit.commit.committer.date);
  const base = { commit: commit.sha, url: check?.details_url || commit.html_url };
  if (!check || check.status !== 'completed') {
    return age < 20 * 60 * 1000 ? { ...base, status: 'pending' }
      : { ...base, status: 'failed', stage: 'Cloudflare 构建', detail: '超过 20 分钟仍未完成构建，请检查日志。' };
  }
  if (check.conclusion !== 'success') return {
    ...base, status: 'failed', stage: 'Cloudflare 构建', detail: `构建结果：${check.conclusion}`,
  };
  try {
    const manifest = await verifySite(commit.sha, site, fetchImpl);
    return { ...base, status: 'published', site, articles: manifest.articles };
  } catch (error) {
    if (age < 20 * 60 * 1000) return { ...base, status: 'pending' };
    return { ...base, status: 'failed', stage: '线上验证', detail: error.message };
  }
}

async function markPublished(manifest, env, fetchImpl = fetch) {
  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) return;
  const headers = { authorization: `Bearer ${env.NOTION_TOKEN}`,
    'notion-version': '2022-06-28', 'content-type': 'application/json' };
  const articles = new Map(manifest.articles.map(article => [article.title, article]));
  let cursor;
  do {
    const data = await jsonRequest(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
      method: 'POST', headers,
      body: JSON.stringify({ filter: { property: '状态', status: { equals: '已同步' } },
        ...(cursor ? { start_cursor: cursor } : {}) }),
    }, fetchImpl);
    for (const page of data.results) {
      const title = (page.properties['名称']?.title || []).map(part => part.plain_text).join('');
      if (!articles.has(title) || page.properties['发布状态']?.select?.name === '已发布') continue;
      // Do not mark an edit made after the deployed snapshot as published.
      if (Date.parse(page.last_edited_time) > Date.parse(manifest.builtAt)) continue;
      await jsonRequest(`https://api.notion.com/v1/pages/${page.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ properties: { '发布状态': { select: { name: '已发布' } } } }),
      }, fetchImpl);
    }
    cursor = data.next_cursor;
  } while (cursor);
}

async function main(env = process.env, fetchImpl = fetch) {
  if (!env.GITHUB_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || '')) {
    throw new Error('Missing GitHub repository credentials');
  }
  const site = 'https://blog.heyyao.com/';
  const stateFile = env.PUBLISH_STATE_FILE || '.publish-state/state.json';
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
  const original = JSON.stringify(state);
  const github = route => jsonRequest(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${route}`, {
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' },
  }, fetchImpl);
  let current = { status: 'pending' };
  let failure;
  try {
    const runs = await github('/actions/workflows/sync.yml/runs?branch=main&status=completed&per_page=1');
    const run = runs.workflow_runs[0];
    if (run) {
      const failed = !['success', 'skipped'].includes(run.conclusion);
      if (failed && !state.syncFailed) {
        await sendTelegram(`❌ 博客 Notion 同步失败\n文章可能尚未提交，请查看日志：\n${run.html_url}`, env, fetchImpl);
      } else if (!failed && state.syncFailed) {
        await sendTelegram(`✅ 博客 Notion 同步已恢复\n${run.html_url}`, env, fetchImpl);
      }
      state.syncFailed = failed;
    }
    const deadline = Date.now() + (process.argv.includes('--wait') ? 8 * 60 * 1000 : 0);
    do {
      current = await inspectPublication(github, site, fetchImpl);
      if (current.status !== 'pending' || Date.now() >= deadline) break;
      await sleep(15000);
    } while (true);
    if (current.status !== 'pending') {
      const notice = publicationNotice(state.publication, current);
      if (notice) await sendTelegram(notice, env, fetchImpl);
      if (current.status === 'published') {
        state.publication = { status: 'published', commit: current.commit,
          articleIds: [...new Set([...(state.publication?.articleIds || []),
            ...current.articles.flatMap(article => article.id ? [article.id] : [])])],
          // Keep removed routes too, so restoring an old article is not a new publication.
          articles: { ...state.publication?.articles,
            ...Object.fromEntries(current.articles.map(article => [article.path, article.hash])) } };
        const manifest = await jsonRequest(new URL(`deployment.json?revision=${current.commit}`, site), {}, fetchImpl);
        await markPublished(manifest, env, fetchImpl);
      } else {
        // Retain known routes so recovery only lists genuinely new articles.
        state.publication = { ...state.publication, status: 'failed', stage: current.stage, commit: current.commit };
      }
    }
    if (state.monitorFailed) await sendTelegram('✅ 博客发布检查已恢复。', env, fetchImpl);
    state.monitorFailed = false;
  } catch (error) {
    failure = error;
    if (!state.monitorFailed) {
      await sendTelegram('❌ 博客发布检查未能完成，请查看 GitHub Actions 中的 Blog Publish Monitor 日志。', env, fetchImpl);
    }
    state.monitorFailed = true;
  }
  const changed = JSON.stringify(state) !== original;
  if (changed) {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state));
  }
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `state_changed=${changed}\n`);
  console.log(`Publication status: ${current.status}; notification state changed: ${changed}`);
  if (failure) throw failure;
  return { failed: current.status === 'failed' || state.syncFailed, status: current.status };
}

if (require.main === module) main().then(result => {
  process.exitCode = result.failed ? 1 : 0;
}).catch(error => {
  console.error(`Publish monitor failed: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { cloudflareCheck, publicationNotice, jsonRequest, sendTelegram,
  verifySite, inspectPublication, markPublished, main };
