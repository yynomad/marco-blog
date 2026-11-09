---
title: "理解 AI Agent 的 5 个核心概念：AGENTS.md、Skills、MCP、A2A 与 Subagents"
permalink: "AI-Agent-5-terms"
date: 2026-11-05
notion_id: 40ff66ff-04f8-8196-b57e-cdeda4edb7a4
notion_hash: d84734581d208c36eb3bb8c217125a95
tags:
categories:
---

<!-- more -->

大语言模型（LLM）擅长理解问题、生成文本和推理，但单靠模型本身，还不能完整解释一个 AI Agent 为什么能够遵守项目规范、调用外部系统，甚至把工作交给其他 Agent。

 AGENTS.md、Agent Skills、MCP、A2A 和 Subagents 虽然经常被放在一起讨论，但其实分别解决不同层面的问题。理解它们的边界，比单纯记住几个缩写更重要。

## 一、先用一张表理解这 5 个概念

前两个概念偏向 Agent 内部的行为与能力，MCP 和 A2A 解决 外部连接与协作，Subagents 则是一种 任务规模化的组织方式。

## 二、AGENTS.md：告诉 Agent 这个项目该怎么做

可以把 AGENTS.md 理解为“写给 AI Agent 的 README”。

普通 README 面向开发者，描述项目如何运行；AGENTS.md 则侧重告诉 Agent：在这个仓库里做事时，必须遵守哪些约定。

例如：

```markdown
# AGENTS.md

## 项目约定
- 修改代码前先阅读项目结构
- 遵循现有代码风格
- 提交前运行测试
- PR 标题使用约定格式

## 验证命令
pnpm test
```

当 Agent 在项目中执行任务时，这类说明可以约束其工作方式。它不是一套独立的推理模型，也不是一个外部工具，而是 项目级指令层。

视频还提到，AGENTS.md 可以分层放置：仓库根目录有通用约定，子目录可以有更具体的约定。Agent 应按其所处工作范围使用相关规则。

关键区别：AGENTS.md 描述“这个项目如何工作”，不是“所有类型的任务都怎么做”。

## 三、Agent Skills：把专业能力做成按需加载的模块

如果把制作 PPT、分析数据、检查代码等所有操作规范都塞进 AGENTS.md，那么即便用户只想改一行代码，Agent 也要带着大量无关说明工作。

Agent Skills 解决的正是这个问题。

视频介绍的 Skill 通常是一个目录，包含 SKILL.md，以及任务所需的脚本、模板或其他资源，例如：

```plain text
skills/
└── create-slides/
    ├── SKILL.md
    ├── scripts/
    └── templates/
```

SKILL.md 会说明这项能力的用途、触发场景和执行方法。当用户需求与技能描述相匹配时，Agent 才加载相关内容。

因此，两者可以这样区分：

- AGENTS.md： 长期适用于某个项目的工作约定。
- Agent Skills： 执行某类具体任务时才需要的知识、步骤和资源。
这种按需加载方式，可以减少不相关上下文的占用，让能力更容易跨任务复用。

## 四、MCP：让 Agent 用统一方式连接工具和数据

有了规则和技能，Agent 依然需要访问真实世界中的系统：数据库、开发工具、Notion、支付 API 等。

如果每个 Agent 都要为每个服务独立编写一种接入方式，集成成本会很高。MCP（Model Context Protocol） 提供了统一接口，让支持 MCP 的应用通过 MCP Server 使用外部能力。

一个简化的调用关系是：

```plain text
用户提出任务
    ↓
AI Agent
    ↓ 通过 MCP 接口
MCP Server
    ↓ 调用底层 API
Notion / 数据库 / 其他服务
```

例如，用户让 Agent 查询 Notion 里的项目资料。Agent 可以通过已经接入的 MCP Server 访问对应能力，而不是每次都重新设计一套 Notion 集成。

这里要注意两个边界：

1. MCP 定义的是连接方式，不等于 Agent 自动拥有所有工具。 Agent 需要有可用的服务连接与权限。
1. MCP 不是 Agent 本身。 它主要负责把外部工具、数据和工作流以标准方式提供给 AI 应用。
视频提到，MCP 最初由 Anthropic 推出，后来进入 Linux Foundation 旗下相关组织的治理框架。

## 五、A2A：当 Agent 需要与另一个 Agent 合作

MCP 解决“Agent 如何访问工具”，但如果对方不是工具，而是另一个具有独立职责的 Agent 呢？

这就是 A2A（Agent-to-Agent） 所处理的问题。

视频举了一个企业采购场景：

- 采购 Agent 负责供应商合同。
- 财务 Agent 负责支出审批。
- 采购 Agent 完成合同流程后，需要把审批工作交给财务 Agent。
A2A 中有一个核心概念：Agent Card。它用来描述某个 Agent 能做什么、以及其他 Agent 应该如何与它通信。这样，一个 Agent 可以发现另一个 Agent 的能力，并把适合的工作委派过去。

```plain text
采购 Agent
    ↓ 查找并读取 Agent Card
财务 Agent
    ↓ 接收审批任务
返回审批结果
```

与 MCP 的区别非常直观：

- MCP：Agent ↔ 工具 / 数据源
- A2A：Agent ↔ Agent
视频介绍，A2A 起源于 Google，后来也成为 Linux Foundation 体系下的开放标准。

## 六、Subagents：通过子 Agent 拆分复杂任务

还有一种常见场景：并不是需要另一个独立系统中的 Agent，而是 当前主 Agent 自己的任务太大。

例如：

- 要审查一个包含数千个文件的代码库。
- 要对 20 个相互独立的函数执行检查。
- 一个任务需要多个方向并行分析。
如果所有信息都放进主 Agent 的上下文，容易占用大量上下文空间。Subagents 的做法是：主 Agent 创建一个或多个子 Agent，让它们在各自独立的上下文中处理指定任务，最后把结果交还主 Agent。

```plain text
主 Agent
├── 子 Agent A：分析模块 A
├── 子 Agent B：分析模块 B
└── 子 Agent C：检查测试

子 Agent 汇总结果
        ↓
主 Agent 整理最终结论
```

这里的重点不是“子 Agent 更聪明”，而是 工作可以拆分、上下文可以隔离、独立任务可以并行。

需要注意的是，并行不一定意味着固定的速度倍增，实际效率仍取决于任务依赖、资源和汇总开销。

Subagents 与 A2A 也不是同一件事。 A2A 是 Agent 之间的通信标准；Subagents 是主 Agent 管理子 Agent 的常见架构模式。视频特别强调，Subagents 不像前面四个概念那样对应一个统一的正式标准。

## 七、放到实际项目里，应该怎么选择？

下面是基于这五个概念的一个实践理解，并非视频中的原始案例。

假设我们在开发一个“代码审查 Agent”：

它们并不是五选一的替代关系，而是可以组合起来的不同层次。

不过，一个简单 Agent 并不需要一次性引入所有机制。先明确任务，再判断是否需要项目规则、可复用流程、外部工具、跨 Agent 协议或多 Agent 执行，往往更容易控制系统复杂度。

## 八、总结：先分清边界，再设计架构

这五个概念可以串成一条很清晰的思路：

- AGENTS.md 让 Agent 知道在这个项目里如何做事。
- Agent Skills 让 Agent 按需掌握某一类任务的工作方法。
- MCP 让 Agent 通过标准接口使用外部工具和数据。
- A2A 让不同 Agent 之间能够通信与委派。
- Subagents 让主 Agent 把大型任务拆成独立或并行的子任务。
我觉得理解 AI Agent 架构时，最有用的问题不是“用了多少新框架”，而是逐层问自己：规则在哪里？能力如何加载？工具怎么连接？Agent 如何协作？复杂任务怎么拆分？

当这五个问题都能回答清楚时，Agent 系统的设计边界也就清楚了。

