---
title: yt-dlp解决机器人验证
slug: yt-dlp-captcha-bypass
date: 2025-01-08
tags:
categories:
---

<!-- more -->

## 问题背景

在使用 yt-dlp 下载 YouTube 视频时，经常会遇到 "Sign in to confirm you're not a bot" 的提示，这严重影响了下载体验。本文将介绍如何使用 Cloudflare WARP 的 IP 代理服务来解决这个问题。

## 解决方案

主要思路是使用 Cloudflare WARP 提供的代理服务来绕过 YouTube 的机器人检测。WARP 是 Cloudflare 提供的一项免费服务，可以为我们提供干净的 IP 地址。

## 安装步骤

### CentOS 安装 WARP

```shell
# 安装依赖
yum install epel-release elrepo-release
yum install wget curl

# 下载并安装 WARP 仓库
curl -fsSL <https://pkg.cloudflareclient.com/cloudflare-warp-ascii.repo> | tee /etc/yum.repos.d/cloudflare-warp.repo

# 安装 WARP
yum install cloudflare-warp

# 注册 WARP
warp-cli register

# 连接 WARP
warp-cli connect

```

### Ubuntu 安装 WARP

```shell
# 添加 Cloudflare GPG key
curl -fsSL <https://pkg.cloudflareclient.com/pubkey.gpg> | sudo gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg

# 添加 Cloudflare 源
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] <https://pkg.cloudflareclient.com/> $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflare-client.list

# 更新包列表并安装
sudo apt update
sudo apt install cloudflare-warp

# 注册并连接
warp-cli register
warp-cli connect

```

## 测试结果

我们进行了以下测试来验证解决方案的有效性：

1. 不使用代理直接下载：
```shell
yt-dlp "<https://www.youtube.com/watch?v=example>"
# 结果：出现 "Sign in to confirm you're not a bot" 错误

```

1. 使用 WARP 代理下载：
```shell
# 确保 WARP 已连接
warp-cli status
# 使用 WARP 的 SOCKS5 代理下载
yt-dlp --proxy socks5://127.0.0.1:40000 "<https://www.youtube.com/watch?v=example>"
# 结果：成功下载，无需人机验证

```

## 使用 ProxyChains 的方法

除了直接使用 yt-dlp 的代理参数外，我们还可以使用 ProxyChains 来实现全局代理：

1. 安装 ProxyChains：
```shell
# Ubuntu
sudo apt install proxychains4

# CentOS
sudo yum install proxychains-ng

```

1. 配置 ProxyChains：
```shell
# 编辑配置文件
sudo vim /etc/proxychains.conf

# 在文件末尾添加 WARP 的 SOCKS5 代理配置
socks5 127.0.0.1 40000

```

1. 使用 ProxyChains 下载：
```shell
proxychains4 yt-dlp "<https://www.youtube.com/watch?v=example>"

```

## 性能优化建议

1. 使用持久化连接：
```shell
# 设置 WARP 自动连接
warp-cli enable-always-on

```

1. 配置下载参数：
```shell
yt-dlp --proxy socks5://127.0.0.1:40000 \\
       --format "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" \\
       --concurrent-fragments 3 \\
       "<https://www.youtube.com/watch?v=example>"

```

## 注意事项

1. 确保系统防火墙允许 WARP 连接（端口 40000）
1. 定期检查 WARP 连接状态
1. 如遇下载速度慢，可尝试切换 WARP 节点
1. 建议在生产环境中添加错误处理和重试机制
## 结论

通过结合使用 yt-dlp 和 Cloudflare WARP，我们成功解决了 YouTube 下载时的人机验证问题。该方案具有以下优势：

- 完全免费
- 配置简单
- 稳定可靠
- 适用于多种 Linux 发行版
希望本文对你的 YouTube 下载项目开发有所帮助。如有问题，欢迎讨论交流。

