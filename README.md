# 姚远的博客

基于 Hexo 构建的个人博客，使用 maupassant 主题。

## 🚀 快速开始

### 环境要求
- Node.js (推荐 v16+)
- Git

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <your-repo-url>
   cd my-blog
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **安装主题**
   ```bash
   git clone https://github.com/tufu9441/maupassant-hexo.git themes/maupassant
   ```

4. **生成静态文件**
   ```bash
   hexo generate
   ```

5. **本地预览**
   ```bash
   hexo server
   ```
   访问 http://localhost:4000

## 📝 写作

### 创建新文章
```bash
hexo new "文章标题"
```

### 文章格式
```markdown
---
title: 文章标题
date: 2025-01-01 12:00:00
tags: [标签1, 标签2]
---

文章内容...
```

## 🚀 部署

Cloudflare Workers Builds 监听 `main` 分支，执行 `npm run build` 和 `npx wrangler deploy`。Notion 同步任务负责将文章提交到仓库，独立的发布检查负责验证线上版本、更新 Notion 发布状态并发送 Telegram 通知。

环境版本、通知配置和故障处理见 [PUBLISHING.md](PUBLISHING.md)。


## 📁 项目结构

```
├── _config.yml          # 主配置文件
├── package.json         # 依赖管理
├── source/              # 源文件目录
│   ├── _posts/          # 文章目录
│   └── about/           # 关于页面
├── themes/              # 主题目录
│   └── maupassant/      # maupassant 主题 (不提交到 git)
├── public/              # 生成的静态文件
└── .deploy_git/         # 部署临时目录
```

## ⚙️ 配置

主要配置在 `_config.yml` 文件中：

- **网站信息**：title, description, author
- **URL 配置**：url, permalink
- **主题设置**：theme: maupassant
- **部署配置**：`wrangler.jsonc` 与 Cloudflare Workers Builds

## 🎨 主题

使用 [maupassant](https://github.com/tufu9441/maupassant-hexo) 主题，特点：
- 简洁美观
- 响应式设计
- 支持代码高亮
- 支持多种评论系统

## 📚 常用命令

```bash
# 清理缓存
hexo clean

# 生成静态文件
hexo generate

# 启动本地服务器
hexo server

# 部署到远程
npm run deploy

# 创建新文章
hexo new "标题"

# 创建新页面
hexo new page "页面名"
```

## 🔧 故障排除

### 主题不显示
确保主题已正确安装：
```bash
git clone https://github.com/tufu9441/maupassant-hexo.git themes/maupassant
```

### 部署失败
查看 GitHub Actions 的 `Blog Publish Monitor` 和 Cloudflare Workers Builds 日志；本地先执行 `npm ci`、`npm test`、`npm run build`。

### 图片不显示
建议将图片放在 `source/images/` 目录下，使用相对路径引用。

## 📄 许可证

MIT License
