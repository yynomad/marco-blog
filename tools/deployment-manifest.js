'use strict';

const crypto = require('node:crypto');

function createManifest(posts, commit, now = new Date()) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Missing build commit');
  const articles = posts
    .filter(post => post.published && new Date(post.date) <= now)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || a.path.localeCompare(b.path))
    .map(post => ({
      title: post.title,
      path: post.path,
      hash: crypto.createHash('sha256').update(post.content || '').digest('hex'),
    }));
  return { commit, builtAt: now.toISOString(), articles };
}

module.exports = { createManifest };
