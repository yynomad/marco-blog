---
title: "从 Go 后端到 Agent：我的 LangChain 与 LangGraph 六课笔记"
permalink: "langgraph-lessons"
date: 2026-11-05
notion_id: 40ff66ff-04f8-8146-9a85-ebd2f323eb67
notion_hash: 54bccd54ac26d53c981f310449004886
tags:
categories:
---

<!-- more -->

我做 Go 后端，第一次看 LangGraph 时，最想弄清楚的是几件具体的事。节点是谁调用的？模型说要用一个工具，谁来执行？下一轮模型又是从哪里拿到结果的？我顺着教程从计数器、计算器和研究助手读起，再看规划、分工和反思。六个例子反复用到节点、边和 State。读每一课时，我都会问同样两个问题：这一步由谁决定，结果存在哪里？

## Lesson 0：没有模型的图也能跑

计数器从 1 开始，每轮加一、翻倍，再判断是否达到 10。

```plain text
START → increment → double → check
          ↑                    │
          └──── 小于 10 ────────┤
                               └── 达到 10 → END
```

第一轮走过 1 → 2 → 4，检查后回到 increment。第二轮走过 4 → 5 → 10，检查后结束。我用项目的 .venv 跑过，终端最终打印 Count: 10 和 Status: done。

最开始我把 add_node 和调用函数混在了一起。graph.add_node("increment", increment_node) 传的是函数本身，像在 Go 里把函数注册到路由表。add_edge("increment", "double") 记录的是执行关系。等到 app.invoke(initial_state)，LangGraph 才从 START 出发，按边调用函数。执行顺序由边的起点和终点决定，跟写 add_edge 的行序无关。

我读了教程环境里 LangGraph 0.2.45 的源码。编译前，节点保存在字典里，固定边保存在由 (起点, 终点) 组成的集合里，条件边则保存路由函数和目标映射。compile() 把这些定义组装成可运行的图，并建立节点之间的触发关系。

```python
class CounterState(TypedDict):
    count: int
    history: Annotated[list[str], operator.add]
    status: str
```

TypedDict 描述的是字典的字段和类型，可以类比 Go 里定义一份有固定字段的结构。节点收到当前 State，返回一个包含这一步更新的字典。谁调用函数，谁拿到 return，所以这里由 LangGraph 接住返回值并应用更新规则。

例如，加一节点返回 count=2 和 history=["Incremented to 2"]。count 用新值覆盖，history 则调用 operator.add(旧列表, 新列表)，把这条记录接到历史末尾。Annotated 在这里给字段附上一个合并函数，LangGraph 在写入时才调用它。check_node 只写 status，随后条件边读这个字段，决定回到 increment 还是结束。合并规则和路由规则分别解决数据怎么存和流程往哪走。

## Lesson 1：让模型选工具，让 Python 执行工具

计算器还是一张图，但加减乘除的选择由模型根据用户的问题提出。tools = [add, multiply, subtract, divide] 里装的是四个 Python 函数。graph.add_node("tools", tool_node) 里的 "tools" 则是图上的一个节点名，四个函数共用这个执行节点。

llm.bind_tools(tools) 是 LangChain 聊天模型客户端的方法。它把函数名、说明和参数结构准备好。invoke() 才发出请求，把工具描述和模型输入一起送出去。Lesson 1 的 SystemMessage 告诉模型自己是计算器助手，并建议一次请求一个工具。用户的问题、模型之前的请求和工具结果则来自 state["messages"]。[system_msg] + messages 会为这次模型调用拼出一个新列表。

以「先算 4 × 5，再减 8」为例，预期第一轮返回一个带 tool_calls 的 AIMessage，其中有 multiply、参数和调用 ID。条件边检查到有请求，把图引向 tool_node。这个节点的核心动作可以拆成两句：

```python
tool_func = tools_by_name[tool_name]
result = tool_func(**tool_args)
```

第一句按名字查字典，拿到对应的函数。第二句的 ** 把字典展开成具名参数，例如 multiply(a=4, b=5)。原例还会把模型给的数字字符串转成浮点数。我更容易先用普通 for 读懂这段转换，再回头看原来的字典推导式。

工具节点把 20 包成 ToolMessage，用 tool_call_id 和原请求配对。add_messages 把它合并进历史，图沿 tools → agent 回到模型。模型看到了 20，就可以请求 subtract(a=20, b=8)，最后给出答案。没有待处理工具请求时，条件边通向 END。

这就是我在 demo 里看到的 ReAct 循环。模型提出动作，运行环境执行，结果再影响模型的下一步。OpenAI 和 Claude 的公开 API 也展示了这种工具调用方式。有的工具由业务程序执行，有的由平台托管。API 的例子能用来对照这段代码，ChatGPT 产品内部的完整编排只能从公开资料看到一部分。 OpenAI 工具调用 · Claude 工具调用

## Lesson 2：用 State 接力搜索、分析和回答

研究助手保留了 START → agent、tools → agent 和 agent 出口上的条件边。我原先以为搜索、分析和回答各有一个节点。读完代码才发现，同一个 agent_node 每轮读到的 State 不同，所以会选不同的提示词。

我卡得最久的是 topic 从哪里来。对于「What is LangGraph and how does it relate to agents?」，第一次请求已经带上了整句问题、工具说明和可选主题 python、langgraph、agents。模型可能在同一次调用里选好工具名和 {"topic": "langgraph"}。它也可以选 agents，实际选了什么可以看终端里的 DEBUG: tool_calls value。

agent_node 从模型返回的 AIMessage 里提取第一条工具请求，写到 last_tool_call。随后工具节点从 State 取出这个请求，调用 search_knowledge_base(topic="langgraph")。所谓「搜索」是匹配本地字典的键，「提取要点」也只是按句号拆文本、取前几段。工具节点把结果直接写到 search_results 或 analysis，下一轮模型通过重新构造的 SystemMessage 看到它。

这里有两个不同的判断。agent_node 根据 State 选择提示词，should_continue 根据是否有待执行的请求选择下一站。搜索、提取、回答是提示词引导的预期路径。模型若提前直接回答，图就会结束。step_count 到 5 也会结束，避免循环一直跑下去。

## stream、chunk 和 thread_id 怎么连起来

app 是 graph.compile(...) 返回的图对象。app.stream(initial_state, config) 返回一个 Python 生成器，外层 for 每取一次就继续推进图，拿到节点的一份更新。用 Go 的经验类比，消费的写法像 for update := range updates，这里的 Python 生成器会在迭代时继续执行。

如果第一轮模型请求搜索，chunk 大致是这样的：

```python
{
    "agent": {
        "step_count": 1,
        "final_answer": "",
        "last_tool_call": {
            "name": "search_knowledge_base",
            "args": {"topic": "langgraph"},
        },
    }
}
```

外层的 "agent" 来自注册节点时起的名字，内层是这个节点返回的局部更新。main() 里的循环体只有 pass，所以收到更新后就继续取下一条。节点间传递的数据由 LangGraph 合并到 State，终端上看到的进度来自节点里的 print()。

图跑完后，app.get_state(config).values 读取完整的最新状态。config 提供的是 thread_id="research-demo"。运行时 MemorySaver 用这个 ID 保存一组快照，读取时同一个 ID 找回这一组，默认选最新的。用 Go 类比，可以把它想成按 sessionID 索引的快照历史。用聊天界面类比，一条 Chat 像一个线程，同一条 Chat 里的多个执行步骤可以留下多份快照。这个 demo 的快照存在进程内存里，进程退出后就会消失。

## 跑教程时遇到的两个环境问题

1. 终端里的 Python 路径。 我的 zsh 把 python 设成了 python3 的别名，所以 which python 只显示别名。要看实际解释器，用 python -c 'import sys; print(sys.executable)'。之前的依赖冲突来自 pyenv 里的混装版本，教程自己的 .venv 通过了 pip check。在仓库根目录，用 .venv/bin/python lesson_0_primitives/counter_graph.py 可以明确指定环境。
1. Ollama 客户端、代理和模型服务。 Lesson 2 的 langchain-ollama 是 Python 客户端，示例默认请求 Ollama 的 qwen2.5:7b。我碰到的 socksio 报错发生在导入阶段，临时移除当前命令的代理环境变量后，ChatOllama 已验证可以导入。完整模型流程还需要能连接到模型服务，这次走读没有验证完整的本地模型运行。 Ollama 模型说明
## Lesson 3：先生成计划，再按计划执行

任务是从 API 取用户数据、筛选活跃用户、按注册时间排序、计数并生成报告。Lesson 2 每轮让模型决定下一步，Lesson 3 则先让模型列出整份计划，然后用代码按顺序推进。

```plain text
START → planner → executor ── 还有步骤 ──→ executor
                     │
                     └── 计划跑完 → finalizer → END
```

planner 请求模型返回一个 JSON 数组。每项有 step_number 和 description，代码解析后再补上 status="pending" 和空的 result。如果解析失败，示例会把原任务作为唯一一步继续执行。

executor 每次只做 plan[current_step_index] 这一项。它根据步骤描述里的关键词调用相应的模拟函数，把该步标记为完成、追加一条 execution_log，再将索引加一。条件边检查 current_step_index < len(plan)，有下一项就回到同一个执行节点，否则交给 finalizer。最后由模型读取执行日志、写出总结。用 Go 类比，中间这段就像用索引遍历一个 []PlanStep，每次处理一项后再决定是否继续。

有两个地方需要按源码理解。文件操作、API 请求和数据处理都返回模拟文本，所以「筛选后剩 42 项」是示例写好的结果。源码虽然声明了 needs_replan，图上没有执行失败后回到 planner 的路径。这一课实现的是先计划再顺序执行，重规划还只是预留字段。

## Lesson 4：由主管选择下一位专家

例子把「研究快速排序、写 Python 实现、写教程」交给一个 supervisor。主管读原任务和已有产出的摘要，调用模型得到 RESEARCH、CODE、WRITER 或 DONE。条件边把这几个词映射到具体节点。可以把它类比成 Go 后端里的任务分发器，其中路由标签由模型提出，映射关系由程序定义。

- research 把概念说明写进 research_result。
- code 可以读取已有研究结果，再把模型生成的代码文本写进 code_result。
- writer 可以把研究和代码都放进提示词，产出教程并写进 writer_result。
每个专家完成后，图通常回到主管。主管说 DONE，或者返回代码无法识别的标签时，图就走向 aggregate，由汇总节点把 State 中已有的结果整合为 final_output。研究、写代码、写教程是这道题的一种自然顺序，实际先派谁由主管模型决定。

这里的多个 Agent 是同一张图里用不同提示词扮演不同角色的节点，示例里都使用 qwen2.5:7b，一次派给一个专家。研究节点调用模型生成说明，代码节点返回代码文本。它们没有进行外部检索，也没有运行生成的代码。主管还可能重复派工，因为示例没有按 agents_used 拦截已完成角色。

## Lesson 5：生成、审稿、再修订

最后一课的任务是解释为什么 Python 受初学者欢迎。图里有两个角色：

```plain text
START → generator → critic
           ↑          │
           └── 修订 ──┤
                      └── 满意或到达上限 → END
```

generator 第一次根据任务写出 draft。critic 读取任务和草稿，从清晰度、结构、完整度和写作质量几个方面提出反馈。代码检查模型输出中是否有 VERDICT: SATISFACTORY 这样的文本，再更新 critique 和 is_satisfactory。如果需要修订，图回到 generator，把原任务、上一版草稿和反馈一起发给模型。

源码里的 revision_count 连初稿也计数。所以达到上限 3，实际是最多生成三份草稿，也就是一份初稿加两次修订。如果达到上限时评审仍不满意，程序会输出当前草稿和最后一轮反馈。这里的评审用于决定是否再写一轮。要用它检查代码是否正确，可以把测试结果作为额外的验收信号。

Lesson 3–5 都用 app.invoke(initial_state, config) 跑到结束，再从返回字典读结果。以上执行路径根据源码整理，模型实际生成的计划、分工和评审结论以运行结果为准。

## 如果把它用到我的后端场景

以 Airflow 排障为例，用户问「昨天 daily_etl 为什么失败？」。可以让模型理解 DAG 和时间范围，让代码固定「校验权限 → 查运行 → 找失败任务 → 查日志」的顺序，再让模型根据证据总结。这样，Lesson 0 的固定边和 Lesson 1 的模型决策就能在同一个任务里配合。

Lesson 2 也让我看到了提示词管理和评测是怎么接起来的。代码已经有按阶段选择提示词的雏形。迁移到业务时，我会给查询提示词一个名字并记录版本。如果用户只问「昨天跑得怎么样」，就把这个容易误查 DAG 的问题加入回归用例。保持模型和工具相同，对比新旧提示词是否会先追问，也检查 DAG 明确时是否仍能直接查询。运行记录里保留实际的提示词版本、模型、工具结果和耗时，出了问题才有依据回查。查询权限和写操作审批则由服务端执行。 提示词版本管理 · Agent 评测

教程来源为 JBaczuk 的 LangGraph-Tutorial。本文覆盖 Lesson 0–5。前半部分跟着状态、工具调用和流式更新走，后半部分跟着计划、角色路由和修订反馈走。

