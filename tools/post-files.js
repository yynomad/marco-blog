'use strict';

const fs = require('node:fs');
const path = require('node:path');

function frontmatterValue(content, key) {
  const header = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] || '';
  const value = header.match(new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm'))?.[1];
  if (!value) return '';
  if (value.startsWith('"')) return JSON.parse(value);
  if (value.startsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

const canonical = value => value.replace(/^\/+|\/+$/g, '');

function removeStalePosts(directory, { filename, pageId, permalink, activeFiles = new Set() }) {
  const removed = [];
  for (const file of fs.readdirSync(directory)) {
    if (!file.endsWith('.md') || file === filename || activeFiles.has(file)) continue;
    const content = fs.readFileSync(path.join(directory, file), 'utf8');
    const oldId = frontmatterValue(content, 'notion_id');
    const samePage = oldId && oldId === pageId;
    const legacyRename = !oldId && frontmatterValue(content, 'notion_hash') && permalink
      && canonical(frontmatterValue(content, 'permalink')) === canonical(permalink);
    if (!samePage && !legacyRename) continue;
    fs.unlinkSync(path.join(directory, file));
    removed.push(file);
  }
  return removed;
}

module.exports = { frontmatterValue, removeStalePosts };
