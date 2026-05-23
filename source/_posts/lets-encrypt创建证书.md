---
title: lets encrypt创建证书
date: 2026-05-23
tags:
categories:
---

<!-- more -->

### Let's Encrypt

自己建站需要用到https，Let's Encrypt是一个开源免费的证书工具，现在有一个工具使用方法，certbot

### 安装certbot

> centos

```plain text
sudo yum install certbot

```

> ubuntu

```plain text
sudo apt update
sudo apt install certbot


```

### 选择插件，最常见的是nginx和apache

> nginx

```plain text
sudo yum install python3-certbot-nginx

```

> apache

```plain text
sudo yum install python3-certbot-apache

```

### 获取ssl证书

> nginx

```plain text
sudo certbot --nginx

```

> apache

```plain text
sudo certbot --apache

```

Certbot 会引导你完成以下步骤：

- 输入你的电子邮件地址。
- 同意服务条款。
- 选择要为其获取证书的域名。
会提示你已经成功添加到conf文件中

### 验证证书

完成后，可以通过访问你的域名来验证 SSL 证书是否正确安装。你可以在浏览器中查看地址栏的锁图标来检查 HTTPS 连接是否正常。

### 自动续期

通过crontab来续期，

```plain text
crontab -l

```

查看有没有定时任务，如果没有

```plain text
crontab -e

```

打开文件，编辑输入

```plain text
0 0 */85 * * certbot renew --quiet

```

保存退出，这样就能定期续期了

### Let's Encrypt

自己建站需要用到https，Let's Encrypt是一个开源免费的证书工具，现在有一个工具使用方法，certbot

### 安装certbot

> centos

```plain text
sudo yum install certbot

```

> ubuntu

```plain text
sudo apt update
sudo apt install certbot


```

### 选择插件，最常见的是nginx和apache

> nginx

```plain text
sudo yum install python3-certbot-nginx

```

> apache

```plain text
sudo yum install python3-certbot-apache

```

### 获取ssl证书

> nginx

```plain text
sudo certbot --nginx

```

> apache

```plain text
sudo certbot --apache

```

Certbot 会引导你完成以下步骤：

- 输入你的电子邮件地址。
- 同意服务条款。
- 选择要为其获取证书的域名。
如果是多个域名，可以用

```plain text
certbot --expand -d leaflike.cn -d allyoutube.online

```

会提示你已经成功添加到conf文件中

### 验证证书

完成后，可以通过访问你的域名来验证 SSL 证书是否正确安装。你可以在浏览器中查看地址栏的锁图标来检查 HTTPS 连接是否正常。

### 自动续期

通过crontab来续期，

```plain text
crontab -l

```

查看有没有定时任务，如果没有

```plain text
crontab -e

```

打开文件，编辑输入

```plain text
0 0 */85 * * certbot renew --quiet

```

保存退出，这样就能定期续期了

