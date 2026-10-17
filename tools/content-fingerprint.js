'use strict';

// Notion renews access credentials for the same uploaded file on every fetch.
// Preserve the asset path and non-auth query parameters (for example versionId).
function stableFileUrl(value) {
  let url;
  try { url = new URL(value); } catch { return value; }
  let changed = false;
  for (const key of [...url.searchParams.keys()]) {
    if (/^x-amz-/i.test(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  return changed ? url.href : value;
}

function stableBlockContent(value) {
  if (Array.isArray(value)) return value.map(stableBlockContent);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stableBlockContent(item)]));
  if (value.type === 'file' && value.file?.url) {
    result.file.url = stableFileUrl(value.file.url);
    delete result.file.expiry_time;
  }
  return result;
}

// Used only to migrate existing Markdown without downloading/uploading its images.
// External links and their query strings remain significant.
function stableMarkdown(value) {
  return value.replace(/https:\/\/[^\s<>"')]+/g, candidate => {
    let url;
    try { url = new URL(candidate); } catch { return candidate; }
    const notionFile = /^prod-files-secure\.s3[.-][\w.-]+\.amazonaws\.com$/.test(url.hostname)
      || /(^|\.)notion-static\.com$/.test(url.hostname)
      || (/^s3[.-][\w.-]+\.amazonaws\.com$/.test(url.hostname)
        && url.pathname.startsWith('/secure.notion-static.com/'));
    return notionFile ? stableFileUrl(candidate) : candidate;
  });
}

module.exports = { stableFileUrl, stableBlockContent, stableMarkdown };
