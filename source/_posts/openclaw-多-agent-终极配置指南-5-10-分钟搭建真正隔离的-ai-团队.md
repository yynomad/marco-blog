---
title: OpenClaw 多 Agent 终极配置指南：5–10 分钟搭建真正隔离的 AI 团队
slug: openclaw-multi-agent-isolated
date: 2026-03-04
tags:
categories:
---

<!-- more -->

OpenClaw 是一个开源、本地运行的 AI Agent 框架（GitHub: openclaw/openclaw），它的最大亮点之一就是原生支持多个真正隔离的 Agent。

每个 Agent 拥有独立的：

- workspace（工作目录）
- 记忆文件（sessions & memory）
- 模型选择（可以给不同 Agent 分配不同 LLM，省钱又高效）
- 工具权限与沙箱级别
- 通道绑定（Telegram、飞书、WhatsApp、Discord 等）
这直接解决了单 Agent 模式最常见的四大痛点：

- 上下文窗口快速填满 → Token 爆炸
- 长期对话导致提示词污染 → 输出质量下降
- 所有任务串行阻塞 → 效率低下
- 一个 Agent 拥有全部权限 → 安全风险高
官方最推荐的方式（2026 年最新）：多个独立 Agent + bindings 路由（而不是 sub-agent 动态生成，除非是临时任务）。本文带你用最少步骤、在 5–15 分钟内跑通多 Agent 系统。

前置条件

1. 已安装并运行 OpenClaw bash
1. 确认 gateway 正常运行 bash
1. 强烈建议 先备份全局配置文件 bash
步骤 1：创建多个独立 Agent（核心）

使用 CLI 创建，每个 Agent 会自动生成独立的目录和 workspace。bash

```bash
# 推荐使用简短、有语义的 IDopenclaw agentsadd writeropenclaw agentsadd coderopenclaw agentsadd researcher# 可按需添加更多
```

执行后，你会在以下路径看到独立文件夹：

- ~/.openclaw/agents/writer/
- ~/.openclaw/agents/coder/
- ~/.openclaw/workspace-writer/
- ~/.openclaw/workspace-coder/
- ……
最重要的一步

：定义 Agent 人格

进入对应 workspace 目录，编辑以下文件（纯文本，越详细越好）：

- SOUL.md：核心人格、价值观、语气（Agent 的“灵魂”）
- AGENTS.md：可用工具、技能描述、行为准则
- USER.md：（可选）对用户的长期认知
示例（writer 的 SOUL.md）：markdown

```markdown
你是一位专业中文内容创作者，文风温暖、专业、逻辑清晰。永远用列表、标题、分段提高可读性。
拒绝低质量、灌水、夸张表达。
当用户需要代码时，直接说“我把需求转给 coder 处理”，然后 @coder。
```

查看所有 Agent：bash

```bash
openclaw agents list
```

步骤 2：为不同 Agent 创建独立的通道账号（推荐彻底隔离）

不同 Agent 最好绑定不同 Bot / 账号，避免记忆交叉污染。

- Telegram：用  创建多个 Bot，拿到多个 token
- 飞书：创建一个 App，然后在不同群绑定同一个 App 的不同机器人，或直接用多群 + 群 ID 区分
- WhatsApp / Discord：多账号 / 多 Bot
添加账号示例（Telegram）：bash

```bash
openclaw channels --channel telegram --account writer-bot --token xxxxxxxxxopenclaw channels --channel telegram --account coder-bot --token yyyyyyyyy
```

飞书示例（常用方案：一个 App + 多群）：bash

```bash
openclaw channelsadd --channel feishu --app-id xxxxx --app-secret yyyyy# 群 ID 可通过 @userinfobot 或飞书开放平台获取
```

步骤 3：配置路由 Bindings（消息 → Agent 的映射规则）

有两种方式，推荐先尝试第一种（最省事）。

方式 A：让主 Agent 帮你生成（中文用户最爱）

在主聊天窗口（通常是 default 的 main Agent）直接说：

帮我生成 multi-agent 的 openclaw.json 配置：我有三个 Agent：writer、coder、researcherwriter 绑定飞书群「内容创作讨论群」（群ID: oc_xxxxxx）coder 绑定 Telegram Bot @coder_botresearcher 绑定 WhatsApp 个人号给 writer 用 claude-sonnet-4，coder 用 gpt-4o-mini，researcher 用 deepseek-r1，main 默认 gpt-4o

主 Agent 会输出一段 JSON，直接复制覆盖（或追加）到 ~/.openclaw/openclaw.json 的对应位置。

方式 B：手动编辑 ~/.openclaw/openclaw.json

（关键片段）json

```json
{"agents":{"list":[{"id":"main","default":true,"model":"openai/gpt-4o"},{"id":"writer","workspace":"~/.openclaw/workspace-writer","model":"anthropic/claude-sonnet-4"},{"id":"coder","workspace":"~/.openclaw/workspace-coder","model":"openai/gpt-4o-mini"},{"id":"researcher","workspace":"~/.openclaw/workspace-researcher","model":"deepseek/deepseek-r1"}]},"bindings":[{"agentId":"writer","match":{"channel":"feishu","peer":{"id":"oc_xxxxxx"}}},{"agentId":"coder","match":{"channel":"telegram","accountId":"coder-bot"}},{"agentId":"researcher","match":{"channel":"whatsapp","accountId":"research-phone"}}]}
```

路由匹配优先级

（官方顺序，越靠前越优先）：

1. 精确 peer（群 / DM ID）
1. accountId（Bot / 账号）
1. channel
1. 默认 → main Agent
步骤 4：重启 & 验证

bash

```bash
# 重启 gateway（配置变更必须重启）openclaw gateway restart

# 检查 bindings 是否生效openclaw agents list --bindings

# 检查通道状态openclaw channels status --probe
```

看到类似输出即成功：

```plain text
writer    →  feishu:oc_xxxxxxcoder     →  telegram:coder-bot
```

步骤 5：高级玩法速览（按需解锁）

- Agent 之间协作：在 SOUL.md 写「需要代码时 」或「 帮我查资料」，OpenClaw 会自动转发
- 临时 Sub-Agent：主 Agent 运行时用 sessions_spawn 创建一次性子 Agent
- 不同沙箱级别（v2026.1.6+）：json
- 权限精细控制：agents.list[].tools.allow / deny 限制工具
- 成本优化：写作用便宜模型，编程用强模型
常见踩坑 & 解决方案

- 不要共用 workspace → 隔离彻底失效
- 改完配置不重启 → bindings 不生效
- 飞书群 ID 找不到 → 用  或飞书后台获取
- Token 还是很贵 → 给弱任务用 gpt-4o-mini / deepseek，强任务用 claude / gpt-4o / o1
- 记忆还是串了 → 检查是否用了同一个 channel account
官方必读资源（2026年3月最新）

- 核心文档：https://docs.openclaw.ai/concepts/multi-agent
- 配置参考：https://docs.openclaw.ai/gateway/configuration
- CLI 命令：https://docs.openclaw.ai/cli/agents
照着以上步骤，绝大多数人 5–10 分钟就能跑通 2–3 个独立 Agent 系统。有具体的平台（飞书群、TG Bot、WhatsApp 号）或想直接生成一份属于你的 openclaw.json 配置？把你的需求贴出来（比如“我要 writer 绑飞书群XXX，coder 绑 TG bot YYY，用什么模型”），我可以直接给你复制粘贴的 JSON 版本～祝你早日组建属于自己的 AI 军团！

