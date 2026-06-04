---
title: cloudflare R2 管理博客图片
date: 2026-05-22
permalink: cloudflare-r2-blog-images/
tags:
  - Cloudflare
  - R2
  - VS Code
  - 图床
categories:
  - 教程
---

写博客时图片管理一直是个麻烦事。之前一直用 GitHub 当图床，但访问速度和稳定性都不太理想。最近换成了 **Cloudflare R2** + **VS Code 的 Markdown Image 插件**，体验非常好，写篇文章记录一下配置过程。

<!-- more -->

## 整体流程

```
截图 / 复制图片
    ↓
在 Markdown 文件里按 Option+Shift+V
    ↓
Markdown Image 插件自动上传到 R2
    ↓
自动插入图片 URL 到文章中
```

全程不需要离开编辑器，不需要打开网页上传，不需要手动复制链接。

## 准备工作

### 1. 创建 R2 存储桶

在 Cloudflare 控制台进入 **R2**，创建一个 bucket，我取名 `blog-images`。

### 2. 绑定自定义域名

在 bucket 的 Settings 里找到 **Custom Domains**，绑定你的域名（比如 `img.heyyao.com`），这样图片可以通过自己的域名访问，不受 R2 开发域名的速率限制。

### 3. 创建 API 密钥

在 R2 的 **Overview** 页面，点 **Manage R2 API Tokens**，创建一个新的 token，权限选择 **Edit**（需要读写权限）。创建后会得到：

- **Access Key ID**
- **Secret Access Key**

这两个后面要用到。

## 安装 VS Code 插件

在 VS Code 扩展商店搜索 **Markdown Image**（作者 hancel），安装。

## 配置插件

打开 VS Code 设置（`Cmd + ,`），或者直接编辑 `settings.json`（`Cmd + Shift + P` → `Preferences: Open Settings (JSON)`），添加以下配置：

```json
"markdown-image.base.uploadMethod": "S3",
"markdown-image.s3.endpoint": "https://<你的account-id>.r2.cloudflarestorage.com",
"markdown-image.s3.region": "auto",
"markdown-image.s3.bucketName": "blog-images",
"markdown-image.s3.accessKeyId": "你的 Access Key ID",
"markdown-image.s3.secretAccessKey": "你的 Secret Access Key",
"markdown-image.s3.cdn": "https://img.heyyao.com/${filepath}",
"markdown-image.s3.config": {
    "forcePathStyle": true
}
```

几个关键点说明：

- **`uploadMethod`** 必须填 `"S3"`（大写 S），小写不识别
- **endpoint** 是 R2 的 S3 兼容地址，末尾**不要加 bucket 名称**
- **`forcePathStyle: true`** 必须开启，R2 需要路径风格寻址
- **`cdn`** 是你的自定义域名模板。如果你的域名已经绑定了 bucket，直接用 `/${filepath}` 即可，`${filepath}` 会替换为文件在 bucket 中的完整路径。不要用 `${pathname}`，因为它会带上 `forcePathStyle` 产生的 bucket 前缀，导致路径重复

### 常见踩坑

**路径重复：**
```
https://img.heyyao.com/blog-images/blog-images/xxx.png  ❌
```
这是因为 `${pathname}` 包含了 bucket 名称，而你的域名已经绑定了 bucket，所以用 `${filepath}` 替代。

**上传失败无提示：**
如果 `uploadMethod` 写成了 `"s3"`（小写），插件不会报错，只会把图片存到本地。改成 `"S3"`（大写）即可。

**403/404 访问不到：**
确认：
1. bucket 通过自定义域名公开访问
2. 文件确实上传到了 R2（在 Cloudflare R2 控制台能看到）
3. CDN 模板的路径和文件实际存储路径一致

## 使用方式

配置好之后，写博客时只需要：

1. **截图**（`Cmd+Shift+4`）或 **复制图片**
2. 在 VS Code 的 Markdown 文件中按 **`Option+Shift+V`**
3. 插件自动上传到 R2，自动生成 Markdown 图片语法

```markdown
![](https://img.heyyao.com/2026/05/xxx.png)
```

就是这么简单。

## 方案对比

| 方案 | 缺点 |
|------|------|
| **GitHub 图床** | 国内访问不稳定，GitHub 有滥用限制 |
| **PicGo 桌面版** | 需要额外开一个应用 |
| **七牛/又拍云** | 需要备案域名 |
| **SMMS** | 免费版有限制，不稳定 |

Cloudflare R2 有 **10GB 免费存储 + 每月 100 万次读取**，对于个人博客完全够用，而且不需要备案。

## 总结

VS Code 的 Markdown Image 插件内置了 S3 上传功能，配合 Cloudflare R2，实现了**截图 → 自动上传 → 插入链接**的一站式体验。配置好后写博客非常流畅。
