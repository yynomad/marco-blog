---
title: cloudflare开启挑战页面
date: 2025-01-21 10:00:00
tags: [cloudflare, 挑战页面]
---

最近上线了一个网站，提供解析youtube视频地址的功能，之前见过很多网站有这样的功能

也想给自己的网站加个这个验证界面，从图上可以看出这就是赛博菩萨cloudflare的功能，然后就搜了一下才知道这个叫挑战页面，如果要使用的话，需要把自己的域名用cloudflare的DNS服务器解析

### 注册cloudflare

首先注册cloudflare，很简单，可以使用google登录

### 添加域

点击添加域，

![2025-01-21-16-19-08](https://cdn.jsdelivr.net/gh/yynomad/pic/blogpic/2025-01-21-16-19-08.png)

添加后，然后点击域名跳转页面，点击右侧DNS记录

![2025-01-21-16-28-52](https://cdn.jsdelivr.net/gh/yynomad/pic/blogpic/2025-01-21-16-28-52.png)

可以看到cloudflare提供的两个dns服务器的地址，去你的域名注册商那里修改dns，改成这两个，需要等一段时间才能生效

### 开启挑战页面

快速操作是在右侧，DNS下方，开启under attack模式，会让你选择模式，低中高under attack四种模式

![2025-01-21-16-30-19](https://cdn.jsdelivr.net/gh/yynomad/pic/blogpic/2025-01-21-16-30-19.png)

或者在【安全性】-【设置】中，设置安全级别，跟上边的选项是一样的

**如果你选择了under attack，就会每次访问都会出现挑战页面，其他的应该是cloudflare根据请求的次数来自动调整。**

### 重定向次数过多

配置好了之后我遇到了一个问题，输入域名访问，页面提示重定向次数过错，删除cookies，错误原因就是因为我把HTTP请求都重定向到HTTPS，但是cloudflare到我的网站是HTTP，然后又HTTPS。。。无限循环了，🤣解决办法也很简单

https://7zht.com/index.php/jjtchtsjncdxdcsgddwt.html