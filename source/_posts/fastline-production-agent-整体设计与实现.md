---
title: "FastLine Production Agent 整体设计与实现"
permalink: "fastline-agent-architecture"
date: 2026-11-22
notion_id: 420f66ff-04f8-8101-aca8-dc43d27072c3
notion_hash: 947c7d93e1d413377a37ebe6b0d3bba1
tags:
categories:
---

<!-- more -->

前司在做地图数据生产过程总总是会遇到，然后我们设计了一个运维与测评 Agent 项目 FastLine Production Agent，或者像 Muse 那样主动巡检并 @人交互处理，简单的 ReAct 循环很快就会失控。

这篇文章完整梳理 FastLine Production Agent 的整体设计与实现：如何基于 Python 3.12 + LangChain / LangGraph + SQLite + pgvector，搭出一个可验证、可恢复、能从被动问答演进到主动值守的工程化 Agent 系统。

---

## 一、整体架构与模块分层

为了避免单文件原型膨胀后难以维护，整个代码库按职责拆分为 7 个平级子包：

```plain text
fastline_agent/
├── __main__.py        # CLI 统一入口 (python -m fastline_agent)
├── core/              # 配置 (config)、状态机 (domain)、SQLite 存储 (storage)、鉴权 (security)
├── llm/               # 模型工厂 (models)、Gemini 签名适配 (gemini_model)、Embedding (embeddings)
├── agent/             # 运行时 (runtime)、上下文预算 (context)、Prompt、主动巡检 (monitor)
├── tools/             # 11 个业务工具 (tools)、安全策略 (policy)、事务动作 (actions)、多场景 Mock (adapters)
├── knowledge/         # Markdown 结构切分 (chunks)、检索服务 (service)、pgvector 与旧后端
├── evals/             # 固定案例评测 (evaluation)、可复现实验 (labs)
└── interfaces/        # CLI (cli)、FastAPI + SSE (api)、Streamable HTTP MCP (mcp_service)、企微 (wecom_bot)
```

核心设计原则只有一条：把“大模型推理”和“确定性工程约束”彻底分开。
模型负责理解意图、选择工具、综合证据；而权限校验、参数边界、状态流转、幂等去重、上下文预算和事务提交，全部由确定性 Python 代码与 SQLite 事务兜底。

---

## 二、工具调用与安全边界（The Hands）

模型不能直接执行任意 Shell 或修改文件，所有能力通过 ToolRegistry 以 StructuredTool + JSON Schema 暴露：

- 只读调查工具：Airflow DAG 状态与日志、NVIDIA GPU 指标（DCGM/Prometheus）、Qwen-VL 推理并发与吞吐、异常检测、规则诊断、优化建议、分类指标评测与汇总报告。
- 受限写操作：set_inference_concurrency 与 retry_airflow_task 均受 ActionPolicy 约束：
---

## 三、运行时 Harness：状态机、检查点与崩溃恢复

这是 Agent 能不能“放心用”的分水岭，主要由 core/domain.py、core/storage.py 和 agent/runtime.py 协同完成：

1. 双层持久化：
1. 审批中断（HITL）：
1. 动作幂等与崩溃恢复：
---

## 四、版本化 RAG：结构切分 + pgvector 事务发布

运维手册检索最怕两件事：切片把代码块/表格切碎导致断章取义，以及更新文档时把线上正在查的旧版本删空。

- Markdown 结构切分（knowledge/chunks.py）：按标题层级、段落与目标字符数切分，完整保留代码块、表格按完整行拆分并重复表头，为每个切片记录稳定的 chunk_id、来源路径、章节标题与原文行号，方便回答中精确引用 [chunk_id]。
- 单事务版本切换（knowledge/pgvector.py）：
---

## 五、上下文工程与长期记忆

在 agent/context.py 中，每一轮送给模型的内容都经过 ContextBuilder 按保守 UTF-8 字节预算严格组装：

1. 两级压缩：
1. 候选记忆与用户确认：
---

## 六、多角色协作与对外接口（CLI / API / MCP / 企微）

- 进程内多角色协作（team）：主控 coordinator 可调度 operator、knowledge、quality 三个只读子 Agent（各自独立会话与工具子集，返回结构化证据）。
- FastAPI + SSE + Streamable HTTP MCP（interfaces/api.py & mcp_service.py）：
- 企微消息逻辑（interfaces/wecom_bot.py）：根据企业与发送者映射以只读身份运行 Agent，按群聊与发送者隔离会话，并基于 message_id 做重复投递去重。
---

## 七、从“被动问答”升级到“主动值守”（类似 Muse 的联动闭环）

为了让 Agent 真正主动干活，我在 agent/monitor.py 里补齐了 「主动巡检 → @人通知 → 群内追问/审批」 的事件闭环：

1. 零成本规则预检：ProactiveMonitor.check_once() 先确定性执行 detect_anomalies()，集群健康时直接返回，0 次 LLM 调用；只有发现异常才唤醒 AgentRuntime 诊断并进入审批暂停。
1. 指纹去重与冷却：在 SQLite monitor_alerts 表中按 (tenant, scenario, anomaly_keys) 生成指纹，未解决或冷却期内的同类故障不会重复建单和刷屏。
1. 按异常路由 @人：根据异常码自动路由给 @gpu-oncall、@pipeline-oncall 或 @ml-ops，通过 Notifier 推送包含 task_id 与待审批动作的告警卡片。
1. 审批前追问不破坏断点：负责人收到 @ 后，如果回复“批准/同意”或“拒绝/取消”，直接推进 AgentRuntime.resume()；如果先提出追问，系统会另起只读会话回答，原任务的 waiting_approval 检查点完好保留，等确认后再继续执行。
终端里可以直接用交互模式体验整套流程：

```bash
.venv/bin/python -m fastline_agent --db data/watch.sqlite \
  watch --replay --scenario oom --backend local --interactive
```

---

## 八、脱离生产环境也能全链路验证：多场景 Mock 与离线评测

离开真实公司环境后，没有生产 Airflow、Prometheus 和 GPU 集群权限，怎么验证 Agent 逻辑没有退化？

项目在 tools/adapters.py 中内置了可切换的 SCENARIO_PRESETS 多场景状态机：

- oom：显存占满、并发过高导致失败，必须先降并发再重试；
- network：对象存储下载超时、GPU 利用率极低，验证 Agent 不会盲目降 GPU 并发；
- healthy：集群健康，验证巡检器不会误触发；
- quality：基础设施正常，但 v2 模型离线 F1 低于 v1。
配合确定性的 ReplayModel、本地 BM25 检索以及 6 个固定评测案例（evals/evaluation.py），每次改动都可以运行 scripts/validate.py 完成 Ruff 静态检查与 88 项离线单元测试（涵盖真实 LangChain 图执行、SQLite 崩溃恢复、HTTP MCP 本机联调与主动巡检闭环）。同时在文档与报告中严格区分“离线机制验证通过”与“真实云端模型/向量库效果”，不把离线回放冒充在线准确率。

---

## 总结

做工程化 Agent，大模型只是其中一环；真正决定系统能不能在生产中站住脚的，是外围的状态机、幂等事务、上下文预算、权限边界，以及从“等人来问”到“发现问题主动找人协同”的交互闭环。接下来如果要继续往团队生产环境落地，只需要把 Notifier 接到真实的企微/飞书卡片回调，并把巡检器放进独立后台 Worker 即可。

