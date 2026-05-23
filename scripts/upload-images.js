/**
 * 批量上传文章中的本地图片到 R2
 *
 * 用法：
 *   1. 把图片放到 source/images/ 目录下
 *   2. 运行：R2_SECRET_KEY=xxx node scripts/upload-images.js
 *   3. 脚本自动上传并替换文章中的图片引用
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================
// 配置
// ============================================================

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

const POSTS_DIR = path.join(__dirname, '..', 'source', '_posts');
const IMAGES_DIR = path.join(__dirname, '..', 'source', 'images'); // 放待上传图片

// ============================================================
// S3 客户端
// ============================================================

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
// 上传单张图片
// ============================================================

async function uploadImage(filePath) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath) || '.png';
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const filename = `${hash}${ext}`;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const key = `${year}/${month}/${filename}`;

  const contentType =
    ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'application/octet-stream';

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  const url = `${R2_PUBLIC_URL}/${key}`;
  console.log(`  ✅ ${filename} → ${url}`);
  return url;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  // 检查配置
  const missing = [];
  if (!R2_ENDPOINT) missing.push('R2_ENDPOINT');
  if (!R2_ACCESS_KEY) missing.push('R2_ACCESS_KEY');
  if (!R2_SECRET_KEY) missing.push('R2_SECRET_KEY');
  if (!R2_BUCKET) missing.push('R2_BUCKET');
  if (!R2_PUBLIC_URL) missing.push('R2_PUBLIC_URL');
  if (missing.length) {
    console.error(`❌ 缺少环境变量: ${missing.join(', ')}`);
    process.exit(1);
  }

  // 确保 images 目录存在
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log(`📁 请把图片放到 ${IMAGES_DIR} 目录下再运行`);
    return;
  }

  // 读取所有图片
  const imageFiles = fs.readdirSync(IMAGES_DIR).filter(f =>
    /\.(png|jpg|jpeg|gif|webp)$/i.test(f)
  );

  if (imageFiles.length === 0) {
    console.log('📭 没有找到图片');
    console.log(`📁 请把图片放到 ${IMAGES_DIR} 目录下`);
    return;
  }

  console.log(`📷 找到 ${imageFiles.length} 张图片，开始上传...\n`);

  // 上传所有图片
  const imageMap = {};
  for (const file of imageFiles) {
    const filePath = path.join(IMAGES_DIR, file);
    const url = await uploadImage(filePath);
    // 用文件名（不含扩展名）做 key，方便替换
    const nameWithoutExt = path.basename(file, path.extname(file));
    imageMap[nameWithoutExt] = url;
    imageMap[file] = url; // 也支持全名匹配
  }

  console.log('\n🔗 开始替换文章中的图片引用...\n');

  // 扫描所有 markdown 文章
  const mdFiles = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

  for (const mdFile of mdFiles) {
    const filePath = path.join(POSTS_DIR, mdFile);
    let content = fs.readFileSync(filePath, 'utf-8');
    let updated = false;

    // 替换 ![alt](filename) 形式的引用
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    content = content.replace(imgRegex, (match, alt, src) => {
      const cleanSrc = src.replace(/^attachment:[^:]*:/, '').trim(); // 去除 Notion 前缀
      const basename = path.basename(cleanSrc, path.extname(cleanSrc));

      if (imageMap[basename] || imageMap[cleanSrc]) {
        const url = imageMap[basename] || imageMap[cleanSrc];
        updated = true;
        return `![${alt}](${url})`;
      }
      return match;
    });

    if (updated) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`  ✅ ${mdFile} 已更新`);
    }
  }

  console.log('\n✅ 完成！');
}

main().catch(err => {
  console.error('❌ 失败:', err);
  process.exit(1);
});
