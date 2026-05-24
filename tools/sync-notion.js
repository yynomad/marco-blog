/**
 * Notion → Hexo 同步脚本
 *
 * 使用方法：
 *   NOTION_TOKEN=xxx NOTION_DATABASE_ID=xxx node scripts/sync-notion.js
 *
 * 功能：
 *   1. 读取 Notion 数据库中标记为 "Published" 的文章
 *   2. 下载文章中的图片，上传到 Cloudflare R2
 *   3. 生成 Hexo 格式的 Markdown 文件
 */

/**
 * 自动从项目根目录加载 .env 文件
 */
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

// ============================================================
// 配置 - 从环境变量读取
// ============================================================

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

const POSTS_DIR = path.join(__dirname, '..', 'source', '_posts');

// ============================================================
// 初始化客户端
// ============================================================

/** Notion API 调用封装 */
async function notionAPI(path, body, method) {
  const isGet = !body || Object.keys(body).length === 0;
  const options = {
    method: method || (isGet ? 'GET' : 'POST'),
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
  };
  if (!isGet) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`https://api.notion.com/v1${path}`, options);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Notion API ${response.status}: ${err}`);
  }
  return response.json();
}

/** 查询数据库 */
async function queryDatabase(databaseId, filter) {
  let allResults = [];
  let cursor;
  do {
    const body = { filter };
    if (cursor) body.start_cursor = cursor;
    const data = await notionAPI(`/databases/${databaseId}/query`, body);
    allResults = allResults.concat(data.results);
    cursor = data.next_cursor;
  } while (cursor);
  return allResults;
}

/** Notion API GET 请求（带查询参数） */
async function notionGet(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `https://api.notion.com/v1${path}${query ? '?' + query : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Notion API ${response.status}: ${err}`);
  }
  return response.json();
}

/** 获取页面下的所有块 */
async function getPageBlocks(pageId) {
  let allBlocks = [];
  let cursor;
  do {
    const params = {};
    if (cursor) params.start_cursor = cursor;
    const data = await notionGet(`/blocks/${pageId}/children`, params);
    allBlocks = allBlocks.concat(data.results);
    cursor = data.next_cursor;
  } while (cursor);
  return allBlocks;
}

const s3 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
  forcePathStyle: true,
});

// ============================================================
// 工具函数
// ============================================================

/** 下载图片 */
async function downloadImage(url) {
  const https = require('https');
  const { buffer, contentType } = await new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`下载图片失败: ${res.statusCode}`));
        return;
      }
      const ct = res.headers['content-type'] || 'image/png';
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: ct }));
    }).on('error', reject);
  });

  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const ext = contentType.split('/')[1] || 'png';
  const filename = `${hash}.${ext}`;

  return { buffer, filename, contentType };
}

/** 上传到 R2 */
async function uploadToR2(buffer, filename, contentType) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const key = `${year}/${month}/${filename}`;

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `${R2_PUBLIC_URL}/${key}`;
}

/** 将文件名转为合法的 Hexo slug */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'untitled';
}

/** 获取今天的日期 */
function today() {
  return new Date().toISOString().split('T')[0];
}

// ============================================================
// Notion Block → Markdown 转换
// ============================================================

async function blocksToMarkdown(blocks, imageMap) {
  let md = '';

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph': {
        const text = block.paragraph.rich_text.map(t => t.plain_text).join('');
        md += text ? `${text}\n\n` : '\n';
        break;
      }
      case 'heading_1': {
        const text = block.heading_1.rich_text.map(t => t.plain_text).join('');
        md += `# ${text}\n\n`;
        break;
      }
      case 'heading_2': {
        const text = block.heading_2.rich_text.map(t => t.plain_text).join('');
        md += `## ${text}\n\n`;
        break;
      }
      case 'heading_3': {
        const text = block.heading_3.rich_text.map(t => t.plain_text).join('');
        md += `### ${text}\n\n`;
        break;
      }
      case 'bulleted_list_item': {
        const text = block.bulleted_list_item.rich_text.map(t => t.plain_text).join('');
        md += `- ${text}\n`;
        break;
      }
      case 'numbered_list_item': {
        const text = block.numbered_list_item.rich_text.map(t => t.plain_text).join('');
        md += `1. ${text}\n`;
        break;
      }
      case 'code': {
        const text = block.code.rich_text.map(t => t.plain_text).join('');
        const language = block.code.language || '';
        md += `\`\`\`${language}\n${text}\n\`\`\`\n\n`;
        break;
      }
      case 'quote': {
        const text = block.quote.rich_text.map(t => t.plain_text).join('');
        md += `> ${text}\n\n`;
        break;
      }
      case 'divider': {
        md += `---\n\n`;
        break;
      }
      case 'image': {
        // 用之前上传好的 R2 URL 替换 Notion 链接
        const blockId = block.id;
        if (imageMap[blockId]) {
          md += `![${block.image.caption?.[0]?.plain_text || ''}](${imageMap[blockId]})\n\n`;
        } else {
          // fallback: 用原始 URL
          const url = block.image.type === 'external'
            ? block.image.external.url
            : block.image.file.url;
          md += `![${block.image.caption?.[0]?.plain_text || ''}](${url})\n\n`;
        }
        break;
      }
      case 'callout': {
        const text = block.callout.rich_text.map(t => t.plain_text).join('');
        md += `> 💡 ${text}\n\n`;
        break;
      }
      case 'to_do': {
        const text = block.to_do.rich_text.map(t => t.plain_text).join('');
        const checked = block.to_do.checked ? 'x' : ' ';
        md += `- [${checked}] ${text}\n`;
        break;
      }
      case 'table_of_contents': {
        // 跳过目录块
        break;
      }
      default:
        // 遇到不支持的块类型，静默跳过
        console.warn(`  ⚠️  不支持的块类型: ${block.type}`);
    }
  }

  return md;
}

// ============================================================
// 处理单篇文章
// ============================================================

async function processPage(pageId, pageTitle, createdTime) {
  console.log(`\n📄 处理文章: ${pageTitle}`);

  // 获取所有块
  const blocks = await getPageBlocks(pageId);

  // 处理图片：下载 → 上传 R2
  const imageMap = {};
  for (const block of blocks) {
    if (block.type === 'image') {
      const url = block.image.type === 'external'
        ? block.image.external.url
        : block.image.file.url;

      console.log(`  📷 下载图片: ${url.slice(0, 60)}...`);

      try {
        const { buffer, filename, contentType } = await downloadImage(url);
        const r2Url = await uploadToR2(buffer, filename, contentType);
        imageMap[block.id] = r2Url;
        console.log(`  ✅ 已上传: ${r2Url}`);
      } catch (err) {
        console.error(`  ❌ 图片处理失败: ${err.message}`);
      }
    }
  }

  // 块转 Markdown
  const body = await blocksToMarkdown(blocks, imageMap);

  // 组装 Frontmatter
  const slug = slugify(pageTitle);
  const createdDate = createdTime ? createdTime.split('T')[0] : new Date().toISOString().split('T')[0];
  const frontmatter = `---
title: ${pageTitle}
date: ${createdDate}
tags:
categories:
---

`;

  const fullMd = frontmatter + '<!-- more -->\n\n' + body;

  // 保存文件
  const filename = `${slug}.md`;
  const filepath = path.join(POSTS_DIR, filename);
  fs.writeFileSync(filepath, fullMd, 'utf-8');
  console.log(`  ✅ 已保存: ${filename}`);

  return filepath;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('🔄 开始同步 Notion → Hexo...\n');

  // 检查必要配置
  if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
    console.error('❌ 请设置环境变量: NOTION_TOKEN 和 NOTION_DATABASE_ID');
    process.exit(1);
  }
  if (!R2_SECRET_KEY) {
    console.error('❌ 请设置环境变量: R2_SECRET_KEY');
    process.exit(1);
  }

  // 确保 posts 目录存在
  fs.mkdirSync(POSTS_DIR, { recursive: true });

  // 查询 Notion 数据库中状态为 "完成" 的文章
  const pages = await queryDatabase(NOTION_DATABASE_ID, {
    property: '状态',
    status: {
      equals: '完成',
    },
  });
  if (pages.length === 0) {
    console.log('📭 没有新文章需要同步');
    return;
  }

  console.log(`📝 发现 ${pages.length} 篇待同步文章\n`);

  for (const page of pages) {
    const title = page.properties['名称']?.title?.[0]?.plain_text;
    if (!title) {
      console.log(`  ⏭️  跳过无标题页面: ${page.id}`);
      continue;
    }
    try {
      await processPage(page.id, title, page.created_time);
    } catch (err) {
      console.error(`  ❌ 处理失败: ${title} - ${err.message}`);
    }

    // 同步完成后把状态改为 "已同步"，不再重复处理
    try {
      await notionAPI(`/pages/${page.id}`, {
        properties: {
          '状态': { status: { name: '已同步' } },
        },
      }, 'PATCH');
    } catch (err) {
      // 只是标记状态，失败了不影响文章同步结果
      console.error(`  ⚠️  状态标记失败: ${err.message}`);
    }
  }

  console.log('\n✅ 同步完成！');
}

main().catch(err => {
  console.error('❌ 同步失败:', err);
  process.exit(1);
});
