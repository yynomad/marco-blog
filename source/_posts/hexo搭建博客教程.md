---
title: Hexo搭建博客
date: 2025-02-06 10:00:00
tags: [Hexo, 博客]
---

Hexo 是一个快速、简洁且高效的博客框架，使用 Node.js 构建，可以轻松搭建个人博客。下面是 Hexo 搭建博客的步骤：


### 1. 安装 Node.js 和 npm

首先，你需要安装 Node.js 和 npm（Node.js 的包管理器）。你可以通过以下命令检查是否已安装：

```bash
bash
复制代码
node -v
npm -v

```

如果没有安装，可以去 [Node.js 官网](https://nodejs.org/) 下载并安装最新版本。

### 2. 安装 Hexo

安装 Hexo 需要使用 npm。打开终端，运行以下命令：

```bash
bash
复制代码
npm install -g hexo-cli

```

### 3. 初始化 Hexo 项目

创建一个新的 Hexo 博客项目：

```bash
bash
复制代码
hexo init blog
cd blog
npm install

```

这将创建一个名为 `blog` 的文件夹，并在其中安装 Hexo 所需的依赖文件。

### 4. 启动博客

在项目目录下，运行以下命令启动 Hexo 本地服务器：

```bash
bash
复制代码
hexo server

```

默认情况下，博客将在 `http://localhost:4000` 上运行，你可以在浏览器中查看。

### 5. 创建新文章

可以使用 Hexo 的命令来创建新文章：

```bash
bash
复制代码
hexo new post "My First Post"

```

这将在 `source/_posts/` 文件夹中创建一个名为 `My First Post.md` 的文件，你可以编辑这个文件来添加文章内容。

### 6. 生成静态文件

在完成博客内容后，运行以下命令生成静态文件：

```bash
bash
复制代码
hexo generate

```

这将在 `public` 文件夹中生成你的网站静态文件。

### 7. 部署到 GitHub Pages 或其他平台

你可以将 Hexo 博客部署到 GitHub Pages、Netlify 等平台。以 GitHub Pages 为例，首先在 `_config.yml` 配置文件中设置你的 GitHub 仓库地址：

```yaml
yaml
复制代码
deploy:
  type: git
  repository: https://github.com/yourusername/yourrepository.git
  branch: gh-pages

```

然后，运行以下命令进行部署：

```bash
bash
复制代码
hexo deploy

```

确保你已经在 GitHub 上创建了仓库，并配置好了 SSH 密钥。

### 8. 自定义主题

Hexo 提供了丰富的主题，常用的有 **Landscape** 和 **Next**。你可以通过以下命令安装一个新的主题（以 Next 为例）：

```bash
bash
复制代码
cd themes
git clone https://github.com/iissnan/hexo-theme-next.git next

```

然后，在 `_config.yml` 中修改主题配置：

```yaml
yaml
复制代码
theme: next

```

接下来，你可以在 `themes/next` 文件夹中进行主题的自定义修改。

### 9. 更新 Hexo 和插件

当 Hexo 版本更新时，你可以通过以下命令更新 Hexo 和相关插件：

```bash
bash
复制代码
npm update hexo-cli
npm update

```

这样，你就完成了 Hexo 博客的搭建。