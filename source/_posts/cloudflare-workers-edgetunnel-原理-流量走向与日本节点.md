---
title: "Cloudflare Workers + EdgeTunnel：原理、流量走向与日本节点"
permalink: "edgetunnel-workers-guide"
date: 2026-11-22
notion_id: 420f66ff-04f8-81d1-9c82-edd95f520608
notion_hash: 6e82101fc49ef4e8bd8ff313106788cf
tags:
categories:
---

<!-- more -->

前文我写过用 Oracle 云服务器和 Xray 搭建双节点。这次记录另一种思路：把 EdgeTunnel 部署到 Cloudflare Workers 或 Pages 上，让 Cloudflare 的边缘运行环境来接收客户端连接。

它和“租一台 Linux 服务器、安装 Xray”的方式不同：EdgeTunnel 项目本身提供代理协议处理、管理面板和订阅生成。通常不需要自己维护一台 VPS，也不需要在服务器上安装 Xray。这里重点讲清楚它由什么组成、请求怎么走，以及它能不能当作日本节点。

## 一、先说结论：Workers 是运行环境，EdgeTunnel 是运行在上面的程序

可以这样理解：

- Cloudflare Workers / Pages：提供运行代码的环境。EdgeTunnel 的代码部署在这里，负责接收请求并处理代理连接。
- EdgeTunnel：项目代码和管理面板，提供 VLESS、Trojan、Shadowsocks 等协议支持，以及节点订阅生成和配置管理。
- VLESS / Trojan / Shadowsocks：客户端和 EdgeTunnel 之间使用的代理协议。
- FlClash 等客户端：运行在电脑或手机上，根据规则决定哪些请求直连、哪些交给代理节点。
- KV：Cloudflare 提供的键值存储，项目部署时可绑定给 Worker，供面板保存配置等数据。
- 自定义域名：让客户端通过自己的域名访问 Worker，也用于后台和订阅入口。
因此，EdgeTunnel 不是“在 Workers 里装了一个 Xray”。它是另一套实现：Worker 代码自己处理客户端连接。一般也不需要另外搭 Caddy；域名和 HTTPS 由 Cloudflare 平台接入处理。

项目 README 介绍了 Workers、Pages 上传和 Pages + GitHub 等部署方式，并列出了协议、面板、订阅和可选代理能力：cmliu/edgetunnel。

## 二、两种请求分别怎么走

订阅更新和日常上网是两条不同的请求。

### 1. 获取或更新订阅

客户端访问 EdgeTunnel 提供的订阅地址，Worker 根据后台配置返回节点信息：

FlClash → HTTPS 订阅地址 → EdgeTunnel Worker → 返回订阅配置

订阅只是告诉客户端节点地址、协议和连接参数；它本身不转发你日常访问的网站流量，也不会自动加速。

### 2. 通过节点访问网站

以常见的 VLESS + WebSocket + TLS 配置为例：

应用 → FlClash 按规则选路 → Cloudflare 网络入口 → EdgeTunnel Worker → 目标网站

如果配置了额外的 ProxyIP、SOCKS5 或 HTTP 代理，Worker 的出站路径还会经过相应的代理。没有匹配代理规则的流量，也可以由客户端直接连接目标网站。

可以把 Worker 理解为这条连接的“接待和转发程序”：它接收客户端连接、处理 EdgeTunnel 支持的协议，再按配置把请求送往目标。它不是一台由你独占、可以随意登录的普通 Linux 服务器。

## 三、它和 Oracle + Xray 有什么不同

| 对比 | Oracle + Xray | Cloudflare Workers + EdgeTunnel |
| --- | --- | --- |
| 程序运行在哪里 | 自己的云服务器 | Cloudflare Workers / Pages |
| 是否要维护 Linux 主机 | 要维护系统和服务 | 通常不用管理底层主机 |
| 代理程序 | Xray | EdgeTunnel Worker 代码 |
| 节点入口地址 | 通常是服务器公网 IP | 由域名和 Cloudflare 网络接入 |
| 出口 IP 是否固定 | 通常是自己的服务器公网 IP | 不能把 Cloudflare 入口 IP 当作固定出口 IP |
| 主要配置方式 | SSH、服务配置文件、防火墙 | Cloudflare 部署设置和 EdgeTunnel 管理面板 |

Workers 的便利之处是少维护一台主机；相应地，网络入口、运行限制和出站行为由 Cloudflare 平台决定。免费额度、用量限制和计费规则也可能变化，部署前要看自己账号当前的 Cloudflare 规则，不能把“没有 VPS”理解成“永远不限量、完全没有成本”。

## 四、日本节点要分清“入口”和“出口”

“日本节点”可能指两件事：

1. 入口机房在日本：客户端连接进入 Cloudflare 的东京或大阪机房。
1. 出口 IP 在日本：目标网站看到的来源 IP 是日本地址。
这两件事不能画等号。Cloudflare 使用 Anycast，同一个 Cloudflare IP 可以由多个地区的机房接入；实际接入位置会受客户端所在网络和路由影响。IP 查询网站显示的国家，也不一定是这次连接实际进入的机房。Cloudflare Anycast 说明

如果只想从自己的网络里筛出当前接入东京或大阪机房的候选 IP，可以在本机运行 CloudflareSpeedTest 的 HTTPing 地区筛选，例如：

cfst -httping -cfcolo NRT,KIX

-cfcolo 必须配合 -httping 使用；测试结果只反映运行测速时、那条网络上的落点。把筛选结果放进 EdgeTunnel 的自定义订阅，可以让订阅只包含这些候选入口，但路由变化后仍可能接入其他机房。CloudflareSpeedTest 参数说明

如果要求目标网站始终看到固定的日本出口 IP，仅筛选 Cloudflare 入口 IP 不够。需要再配置真正位于日本的服务器或出站代理，并确认 EdgeTunnel 的代理链路确实经过它。

## 五、从哪里开始部署

下面只列部署顺序，具体控制台界面以项目 README 和 Cloudflare 当前界面为准：

1. 在 Cloudflare 选择 Workers 或 Pages 部署项目代码。
1. 按项目说明设置管理员密码；使用 KV 的部署方式还要创建 KV 命名空间并绑定为 KV。
1. 给 Worker / Pages 绑定自己的子域名，等待 Cloudflare 完成域名接入。
1. 访问域名下的 /admin，登录后配置协议、主机名、UUID 和订阅模式。
1. 生成订阅链接，在 FlClash 等客户端中通过链接导入。
1. 分别测试订阅能否更新、节点能否连通，以及客户端分流规则是否符合预期。
后台密码、UUID 和完整订阅链接都要保密。不要把带鉴权信息的链接、二维码或配置文件贴到公开博客，也不要提交到 Git 仓库。

## 六、我的理解

Oracle + Xray 的核心是“我有一台服务器，自己管理上面的 Xray”；EdgeTunnel 的核心是“我把代理程序部署到 Cloudflare Workers，由 Cloudflare 提供运行入口”。

它少了主机维护，但不等于获得了一个固定位置、固定出口 IP 的专用服务器。想要日本入口，需要按自己的线路实测候选 IP；想要固定日本出口，则还要有真正的日本出站服务器或代理。

如果你想先了解另一种自建方式，可以接着看：Oracle 免费服务器搭建双节点。

## 参考资料

- EdgeTunnel 官方仓库与部署说明
- Cloudflare 关于 Anycast IP 的说明
- CloudflareSpeedTest 官方参数说明
