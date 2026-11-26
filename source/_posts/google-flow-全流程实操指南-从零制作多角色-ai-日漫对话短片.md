---
title: "Google Flow 全流程实操指南：从零制作多角色 AI 日漫对话短片"
permalink: "google-flow-anime-dialogue-guide"
date: 2026-11-26
notion_id: 424f66ff-04f8-81e7-a43f-cd4045ec46ca
notion_hash: 691e37bb9cbaca0e7b3fd70e5d38bd8a
tags:
categories:
---

<!-- more -->

开通了google AI Pro，给的google flow 点数不要浪费，可以做些视频，我最近正好在学习日语，做了一些新标日会话的短视频，分享一下经验

## 一、为什么传统“先盲生视频、再外挂配音”会翻车？

最初尝试做日语对话动画时，我先用文生视频/图生视频生成 8 秒静音片段，再外挂 TTS 配音，结果立刻暴露两个硬伤：

1. 口型与动作完全对不上：静音生成时模型不知道台词长短，随机安排张嘴和停顿，硬贴外部音频必然错位。
1. 跨镜头人物与场景漂移：没有锁定数字资产时，上一秒穿蓝衬衫、下一秒变黑西装，甚至背景从公司食堂漂移到办公室。
正确解法：利用 Google Flow 的 「角色资产锁定（Characters）+ 全局记忆（Agent Instructions）+ 原生音画直出（Omni 1.2 Flash）+ Scenes 时间线剪辑」，让模型在同一个数字世界里“自己张嘴说台词”。

## 二、Google Flow 完整 6 步实操流程

### 第一步：配置全局规则（Flow 智能体 → 智能体设置 → 记忆）

在底部输入框打开 Flow 智能体 → 智能体设置 → 记忆（即 Agent Instructions），把全片必须严格遵守的画风、画幅和字幕规则写进全局记忆里：

```plain text
Visual Style: Modern Japanese slice-of-life 2D anime (Kyoto Animation style), clean crisp lineart, soft cel shading, warm sunlit daylight.
Setting: Bright modern Japanese company cafeteria dining hall (社員食堂) with wooden dining tables, lunch trays, bento/ramen bowls, tea cups. Strictly NO office desks, NO computers, NO monitors.
Audio: Fluent, natural native Tokyo Japanese speech with accurate pitch accent and lip-sync.
Subtitles: Display clean, crisp black-outlined bilingual subtitles centered at the bottom (Japanese on top, Simplified Chinese translation below).
```

> 💡 保存规则时务必点亮标题左侧的圆形开关，否则全局记忆不会生效；同时建议将 Confirm before generating 设为 Always，防止 Agent 自动改写后误扣点数。

### 第二步：创建「纯白底」角色资产并绑定声线（角色）

进入左侧 角色（Characters） → + 新角色，为每个出场人物生成设定图并绑定固定声线：

1. 必须锁死纯白背景：角色设定 Prompt 里一定要加上 ISOLATED ON A PLAIN SOLID PURE WHITE STUDIO BACKGROUND, no room, no desk, no office。在我们的真实测试中，第一版角色图背后带了办公桌和电脑，结果生成食堂对话时模型把办公室背景“顺手带进了食堂”；换成纯白底三视图后，背景串场问题彻底消失。
1. 绑定声线（Select Voice）与表演设定：
![纯白底角色三视图与声线锁定](https://img.heyyao.com/2026/11/179520640d1c0fb2a114f04ca8dd149c.png)

### 第三步：单独生成一张纯净的场景底图（图片 模式）

为了确保 8~9 个分镜都在同一个食堂里发生，不要每次只靠文字描述背景，而是先切到 图片 模式（16:9），生成 1 张无人的日本公司食堂空镜底图（木质餐桌、餐盘、取餐台、窗外绿树、无电脑工位）。

之后生成每一个视频镜头时，固定挂载 @场景底图 + @纯白底角色，就能把人物自然地“放进”同一个场景里。

### 第四步：选对模型并开启原生音频（避坑重点）

在右上角 设置 中关闭 返回无声视频开关（开启原生音频）。模型选择上，我们实测踩出了两个重要差异：

| 对比维度 | Veo 3.1 - Lite | Omni 1.2 Flash |
| --- | --- | --- |
| 多角色同框 | 限制最多 1 个带声线角色（第 2 个 @角色 会降级为纯文本，甚至把名字印在画面右下角） | 支持同时挂载多个 @角色  • 场景底图 |
| 日语口音与字幕 | 日语偶有腔调怪异 | 日语自然地道，且直出中日双语描边字幕几乎零错字 |
| 每段点数 | 720p / 8 秒约 10 点 | 720p / 8 秒约 24 点 |

下面是我们在实操中踩过的真实对比截图：

1. Veo 3.1 - Lite 触发单音频素材上限：@Noda 被降级成纯文本，导致画面右下角印出了多余的 "Noda" 字样，且没有绑定女角色外观。
![Veo 3.1 Lite 单音频素材限制导致文字水印](https://img.heyyao.com/2026/11/942bd844fa88c932acacf760bc667885.png)

1. Omni 1.2 Flash + 带办公室背景的旧角色图：双人同框和双语字幕都非常漂亮，但因为旧角色图带了电脑桌，背景串场成了办公室。
![Omni 1.2 Flash 双角色直出字幕但旧角色图带出办公室背景](https://img.heyyao.com/2026/11/eb0ff3ff51109090ef818231fd3fc26f.png)

1. 最终正确配方（Omni 1.2 Flash + 纯白底角色 + 食堂底图）：三件套同时挂载后，人物、纯食堂场景、对口型日语配音和底部描边双语字幕一次到位！
![纯白底角色 + 食堂底图三件套锁定成功](https://img.heyyao.com/2026/11/69007d2ae87d8751c0314ac15789cdec.png)

### 第五步：按标准公式逐镜生成（8 秒/镜）

不要把整篇长对话一次性塞进输入框，而是按每 1~2 句（≤8 秒）拆成单镜头逐个渲染，遵循标准 Prompt 公式：

```plain text
[画风与镜头机位] + [@场景底图] + [@角色名] + [动作神态] + [日语台词] + [底部双语字幕要求]
```

如果前后镜头需要连贯，在下一镜开头加上 Continue directly in the same bright Japanese company cafeteria。

![主画布多资产组合提交界面](https://img.heyyao.com/2026/11/6477e504ab164e5f750633d0e0cedd27.png)

> 防误读小技巧：如果遇到日本地名、人名或难读汉字，可以在台词里直接写成平假名（例如 りゅうこしゅぞうの さとうさん），能大幅降低模型念错多音字的概率。

### 第六步：在 Scenes 时间线拼装、无损裁剪与导出

所有镜头生成完毕后，进入左侧 Scenes（场景） 模块：

1. 按顺序排入时间线：把 Shot 1 → Shot 8 依次添加到时间线，即可直接全片预览。
1. 0 点数裁剪多余尾音：我们在第 2 镜中发现野田说完台词后多了一小段空白背景音乐，直接用 Flow 时间线里的 拆分片段 功能在说完台词后 0.35 秒处切开，删掉尾部多余片段，不花任何点数就完成了节奏修剪。
1. 补充背景音乐与导出：可在顶部 Flow Music 配一段轻柔背景音，最后点击右上角 下载场景 直接导出完整 MP4。
![Scenes 时间线拼装 9 段完整成片](https://img.heyyao.com/2026/11/0329ec80115ba6220894054b2ec801ee.png)

## 三、Google Flow 点数机制与省钱策略

在操作过程中顺便摸清了 Google Flow 的双层点数规则：

1. 每日免费重置点数（50 点/天）：所有用户每天首次生成时会刷新 50 点，当天不用完会清零、不累加，系统会优先消耗这部分点数。
1. Google AI Pro 月度点数（1,000 点/月）：按订阅周期每月重置一次。
![Google Flow 每日点数重置与消耗明细](https://img.heyyao.com/2026/11/a7c5aede4d21793ae8a564a0999870f5.png)

省点数建议：

- Agent Instructions、修改角色声线、在 Scenes 里拆分裁剪和导出，全部 0 点数消耗；
- 利用每天必清零的 50 点免费额度，每天稳定跑 2 段 Omni 1.2 Flash（每段 24 点），几天就能零额外成本拼出一部完整的教学动画短片。
## 四、总结

Google Flow 真正好用的地方在于把 “角色定妆 + 固定声线 + 场景底图 + 分镜剪辑” 整合在了一个工作台里：

- 角色图一定要纯白底，场景单独用一张图来锁；
- 多角色对话直接上 Omni 1.2 Flash，别用有单音频上限的 Veo 3.1 - Lite；
- 善用 Scenes 拆分裁剪和每日 50 点重置，零废片、低成本也能做出稳定连贯的 AI 日漫短片。
