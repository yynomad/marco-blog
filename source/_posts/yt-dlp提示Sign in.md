---
title: yt-dlp提示Sign in
date: 2024-01-18 10:00:00
tags: [yt-dlp, 代理]
---


## 问题背景

在使用 yt-dlp 下载 YouTube 视频时，经常会遇到 "Sign in to confirm you're not a bot" 的提示，这严重影响了下载体验。本文将介绍如何使用 Cloudflare WARP 的 IP 代理服务来解决这个问题。

## 解决方案

主要思路是使用 Cloudflare WARP 提供的代理服务来绕过 YouTube 的机器人检测。WARP 是 Cloudflare 提供的一项免费服务，可以为我们提供干净的 IP 地址。

## 安装warp-cli

CentOS 安装 WARP，不同系统安装命令可能不同，需要读者根据自己的系统去查询对应的命令，去官网找

https://developers.cloudflare.com/warp-client/get-started/linux/

## 使用warp

```jsx
warp-cli registration new
warp-cli mode proxy
warp-cli connect
```

## 测试结果

我们进行了以下测试来验证解决方案的有效性，先进入到yt-dlp目录下，

不使用代理直接下载：

```bash
# -g 获取实际下载地址
./yt-dlp -g https://www.youtube.com/watch?v=rVQ2i8q2Y9A
# 结果：出现 "Sign in to confirm you're not a bot" 错误

```

1. 使用 WARP 代理下载：

```bash
# 确保 WARP 已连接
warp-cli status
# 使用 WARP 的 SOCKS5 代理下载
./yt-dlp --proxy socks5://127.0.0.1:40000 -g "https://www.youtube.com/watch?v=example"
# 结果：成功下载，无需人机验证

```

## 使用 ProxyChains 的方法

除了直接使用 yt-dlp 的代理参数外，我们还可以使用 ProxyChains 来实现全局代理：

proxychains也是利用了warp的代理，需要在conf文件中加配置

安装 ProxyChains，不知道为什么yum install安装不了

[https://maobuni.com/2021/06/26/centos-7安装proxychains教程实现linux-伪全局代理/](https://maobuni.com/2021/06/26/centos-7%E5%AE%89%E8%A3%85proxychains%E6%95%99%E7%A8%8B%E5%AE%9E%E7%8E%B0linux-%E4%BC%AA%E5%85%A8%E5%B1%80%E4%BB%A3%E7%90%86/)

配置 ProxyChains

```bash
# 编辑配置文件
sudo vim /etc/proxychains.conf

# 在文件末尾添加 WARP 的 SOCKS5 代理配置
socks5 127.0.0.1 40000

```

使用 ProxyChains 下载

```bash
proxychains4 ./yt-dlp -g "https://www.youtube.com/watch?v=rVQ2i8q2Y9A"

```

# 又遇到了问题

使用过一段时间后，又遇到了sign in的报错，偶尔可以获取地址成功，但是大部分时候会提示Sign in to confirm you are not a robot，其实是IP又被封了，因为cloudflare提供的是固定的IP，或者在一段时间内固定，所以我们需要找到的是一个免费代理IP列表，然后利用上边的原理随机使用去代理请求yt-dlp，可以见这篇博客：[免费代理IP资源](https://www.notion.so/IP-183f66ff04f88097b2ebe976d3dc25a5?pvs=21) 

其实还是使用代理，只不过是使用一个代理IP列表，然后轮询使用，不至于让ip被封，这个方法还没有走通

另一个方法也是使用代理，使用clash，配置命令行翻墙，参考这个网站：https://go.runba.cyou/，这样就把warp提供的IP换了，也能使用一阵，总之就是使用代理的方式

# 不想使用代理

如果你不想用代理，觉得慢或者怎么样，可以使用cookies，必须要先登录，https://github.com/yt-dlp/yt-dlp/wiki/FAQ，传cookies来使用，但是最好使用一个小号，因为cookies用多了没准youtube会封号