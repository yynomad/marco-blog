---
title: OpenClaw 核心机制
date: 2026-03-17
tags:
categories:
---

<!-- more -->

## 🏗️ OpenClaw 完整架构

```python
~/.openclaw/
├── workspace/              # 工作区
│   ├── AGENTS.md          # Agent 指南
│   ├── SOUL.md            # 行为准则
│   ├── MEMORY.md          # 长期记忆
│   ├── memory/            # 每日/专题记忆 ⭐
│   └── .learnings/        # 学习记录
│
├── skills/                 # 技能插件 ⭐
│   ├── self-improving-agent/
│   ├── github/
│   └── security-check/
│
├── agents/                 # Agent 配置
│   └── main/sessions/     # 会话历史
│
├── credentials/            # 凭证管理 🔐
├── cron/                   # 定时任务 ⏰
└── openclaw.json           # 全局配置
```

---

## 1. Memory 机制

### 📍 位置

```python
~/.openclaw/workspace/memory/
```

### 🎯 作用

让 AI 记住你的偏好、历史对话、重要决策。

### 📁 文件类型

文件 | 作用 | 加载时机

`MEMORY.md` | 长期记忆 | 仅主会话

`memory/YYYY-MM-DD.md` | 每日记忆 | 当天 + 昨天

`memory/topic-xxx.md` | 专题记忆 | 按需加载

### 💡 实际示例

**`memory/git-workflow-preferences.md`**:

```python
# Git 工作流程偏好

## Code Review 流程

**所有代码修改必须通过 Pull Request 流程**

### 操作流程

1. 创建功能分支
   ```bash
   git checkout -b feature/xxx-YYYYMMDD
   ```

2. 提交到分支
   ```bash
   git add .
   git commit -m "feat: xxx"
   git push -u origin feature/xxx
   ```

3. 创建 PR
   - 在 GitHub 创建 Pull Request
   - 等待 Review
   - 批准后合并

### 分支命名

- `feature/xxx-YYYYMMDD` - 新功能
- `fix/xxx-YYYYMMDD` - Bug 修复
- `docs/xxx-YYYYMMDD` - 文档
```

### ✅ 特点

- ✅ **持久化** - 会话重启后依然记得
- ✅ **专题化** - 不同主题分开记录
- ✅ **安全性** - 主会话和非主会话隔离
---

## 2. Skills 机制

### 📍 位置

```python
~/.openclaw/skills/
```

### 🎯 作用

扩展 AI 能力的插件系统。

### 📁 Skill 结构

```python
skills/my-skill/
├── SKILL.md           # 定义（必须）
├── skill_script.py    # 脚本（可选）
└── assets/            # 资源（可选）
```

### 📦 已安装的 Skills

Skill | 功能

`self-improving-agent` | 持续改进

`github` | GitHub 交互

`security-check` | 安全检查

`notion-blog-importer` | Notion 导入

### 🔧 创建自定义 Skill

```python
# 1. 创建目录
mkdir -p ~/.openclaw/skills/my-skill

# 2. 创建 SKILL.md
cat > SKILL.md << 'EOF'
# My Skill

功能描述。

## Usage
openclaw skill my-skill [options]
EOF
```

---

## 3. Agents 机制

### 📍 位置

```python
~/.openclaw/agents/
```

### 🎯 作用

定义 Agent 的行为、模型、配置。

### 📁 结构

```python
agents/main/
├── sessions/          # 会话历史
│   ├── sessions.json
│   └── <id>.jsonl
└── config.json
```

### 🔐 会话隔离

类型 | Memory 加载 | 说明

主会话 | ✅ | 直接对话

子会话 | ❌ | 任务执行

群组会话 | ❌ | 群聊场景

---

## 4. Credentials 机制

### 📍 位置

```python
~/.openclaw/credentials/
```

### 🎯 作用

安全存储 API Keys、Token。

### 🔒 安全机制

- ✅ Git 忽略
- ✅ 权限控制（600）
- ✅ 环境变量支持
### 📄 示例

```python
{
  "channels": {
    "telegram": {
      "botToken": "xxx"
    }
  },
  "integrations": {
    "notion": {
      "apiKey": "ntn_xxx"
    }
  }
}
```

---

## 5. Cron 机制

### 📍 位置

```python
~/.openclaw/cron/
```

### 🎯 作用

定时执行任务。

### ⏰ 调度类型

类型 | 说明 | 示例

`at` | 一次性 | `2026-03-17T10:00:00`

`every` | 周期性 | 每 30 分钟

`cron` | Cron 表达式 | `0 9 * * *`

### 💡 示例

```python
{
  "name": "heartbeat",
  "schedule": {
    "kind": "every",
    "everyMs": 1800000
  },
  "payload": {
    "kind": "systemEvent",
    "text": "心跳检查"
  }
}
```

---

## 6. Workspace 机制

### 📍 位置

```python
~/.openclaw/workspace/
```

### 🎯 作用

项目文件、配置、文档。

### 📁 核心文件

文件 | 作用

`AGENTS.md` | Agent 指南

`SOUL.md` | 行为准则

`TOOLS.md` | 工具配置

`USER.md` | 用户信息

`MEMORY.md` | 长期记忆

`HEARTBEAT.md` | 心跳任务

---

## 🔄 完整工作流程

```python
会话开始
    ↓
1. 加载 workspace/*.md
    ↓
2. 加载 memory/*.md
    ↓
3. 扫描 skills/*/SKILL.md
    ↓
4. 读取 credentials
    ↓
5. 检查 cron 任务
    ↓
准备就绪
    ↓
用户输入 → 匹配 Skills → 参考 Memory → 执行任务
    ↓
更新 memory（如有需要）
```

---

## 💡 Memory vs Skills 对比

特性 | Memory | Skills

**作用** | 记录偏好 | 扩展功能

**格式** | Markdown | SKILL.md + 脚本

**加载** | 自动 | 按需调用

**创建难度** | ⭐ 简单 | ⭐⭐⭐ 中等

---

## 🎯 实际案例：Git 工作流程

### 需求

所有代码修改通过 PR 流程。

### 实现

**1. 创建 Memory 文件**:

```python
cat > ~/.openclaw/workspace/memory/git-workflow-preferences.md << 'EOF'
# Git 工作流程偏好

**所有代码修改必须通过 Pull Request 流程**

1. 创建功能分支 `feature/xxx-YYYYMMDD`
2. 提交到分支
3. 创建 PR
4. 等待 Review
EOF
```

**2. 效果**:

- ✅ AI 自动遵循 PR 流程
- ✅ 不再直接 push 到 main
- ✅ 所有修改经过 Review
---

## 🚀 进阶技巧

### 1. 跨会话通信

```python
# 查看会话
sessions_list

# 读取历史
sessions_history <session-key>

# 发送消息
sessions_send --session <key> --message "xxx"
```

### 2. 子任务委托

```python
sessions_spawn --task "处理 xxx" --runtime "subagent"
```

### 3. 博客自动发布

```python
# 创建脚本
cat > ~/bin/publish-blog.sh << 'EOF'
#!/bin/bash
python3 notion_importer.py \
  --parent-id "xxx" \
  --title "$1" \
  --content "$(cat $2)"
EOF

# 使用
publish-blog.sh "标题" "文件.md"
```

---

## 📊 最佳实践

### Memory 管理

- ✅ 及时记录重要决策
- ✅ 专题分离
- ✅ 定期整理归档
- ✅ 清晰命名
### Skills 使用

- ✅ 只安装需要的
- ✅ 使用轻量级脚本
- ✅ 定期更新
### 安全配置

- ✅ 不硬编码 API Keys
- ✅ 使用环境变量
- ✅ 定期轮换凭证
- ✅ 备份重要文件
---

## ❓ 常见问题

### Q: Memory 文件太多会影响性能吗？

**A**: 轻微影响。建议定期归档旧文件，保持文件精简。

### Q: Skills 可以共享吗？

**A**: 可以，使用 symlink：

```python
ln -s /shared/skills/my-skill ~/.openclaw/skills/my-skill
```

### Q: 如何备份配置？

**A**: 使用 Git：

```python
cd ~/.openclaw/workspace
git init && git add . && git commit -m "Backup"
```

### Q: Memory 和 MEMORY.md 有什么区别？

**A**:

- `MEMORY.md` - 长期记忆，仅主会话加载
- `memory/*.md` - 每日/专题记忆，所有会话加载
---

## 📚 相关资源

资源 | 链接

官方文档 | https://docs.openclaw.ai

GitHub | https://github.com/openclaw/openclaw

ClawHub | https://clawhub.ai

社区 | https://discord.gg/clawd

---

## 🎉 总结

### 六大核心机制

机制 | 作用

**Memory** | 记忆系统

**Skills** | 技能插件

**Agents** | Agent 配置

**Credentials** | 凭证管理

**Cron** | 定时任务

**Workspace** | 工作区

### 下一步

1. 查看你的 `memory/` 目录
1. 创建一个专题记忆
1. 安装一个 Skill
1. 设置定时任务
