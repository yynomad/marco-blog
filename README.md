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

### 同仓库部署到 GitHub Pages（gh-pages 分支）
```bash
hexo clean && hexo generate && hexo deploy
```

> 当前项目默认将生成内容发布到本仓库 `gh-pages` 分支。
> 首次发布后请在 GitHub 仓库设置中将 Pages Source 设置为 `gh-pages` 分支（`/root`）。
>
> 你也可以直接使用仓库内置的 GitHub Actions 工作流（`.github/workflows/deploy-pages.yml`）自动部署：
> 1. 推送到 `main`（或当前示例分支 `work`）；
> 2. Actions 会自动构建并创建/更新 `gh-pages` 分支；
> 3. 在 GitHub Pages 中选择 `Deploy from a branch` -> `gh-pages` -> `/root`。

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
- **部署配置**：deploy 部分

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
hexo deploy

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
检查 `_config.yml` 中的 deploy 配置是否正确。

### 图片不显示
建议将图片放在 `source/images/` 目录下，使用相对路径引用。

## 📄 许可证

MIT License
