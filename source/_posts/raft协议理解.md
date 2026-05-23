---
title: raft协议理解
date: 2025-09-22
tags:
categories:
---

<!-- more -->

## Raft 共识算法通俗理解

> 分布式系统的核心问题之一是「一致性」——当多个节点协同工作时，如何在出现网络延迟、节点宕机甚至分区时，依然保证它们的数据一致？

---

## 🌱 核心概念

### 1. 节点角色（Node Roles）

在任意时刻，集群中的每个节点都处于以下三种角色之一：

- Follower（跟随者）：被动响应，接收心跳或投票请求；
- Candidate（候选者）：当选举超时后发起选举；
- Leader（领导者）：处理客户端请求并同步日志。
> 在一个健康的集群中，通常只有一个 Leader，其余节点为 Follower。

---

### 2. 任期（Term）

Raft 将时间划分为一系列连续的 任期（Term），每个任期内最多只有一个 Leader。

- 每次选举新 Leader，Term 都会递增。
- 如果节点收到 RPC 消息中包含更高的 Term，它会立即更新 Term 并变为 Follower。
- Term 就像逻辑时钟，用来判断谁的日志更新。
---

### 3. 节点通信（RPC）

节点之间通过 RPC（Remote Procedure Call） 通信。

主要有两种 RPC 类型：

---

## ⚙️ 协议流程

### 1. 初始状态

- 所有节点启动时默认为 Follower；
- Follower 只会被动响应，不主动通信；
- 如果在一定时间内没收到 Leader 心跳，则发起选举。
---

### 2. 选举阶段（Leader Election）

1. 每个 Follower 设置一个 随机选举超时（Election Timeout）；
1. 超时未收到心跳时，转为 Candidate；
1. Candidate：
1. 若获得 多数票 → 成为新的 Leader；
1. 若平票或冲突 → 超时后重新发起选举。
---

### 3. 心跳机制（Heartbeat）

- Leader 当选后，定期发送心跳（空的 AppendEntries RPC）；
- Follower 收到心跳则重置超时并保持 Follower 状态；
- 若心跳中断，Follower 会重新进入选举阶段。
---

### 4. 日志复制（Log Replication）

1. 客户端将写操作请求发送给 Leader；
1. Leader 将其封装为 Log Entry 追加到本地；
1. Leader 将日志复制到各个 Follower；
1. 超过半数节点确认写入 → Leader 标记该日志为 Committed；
1. Leader 将日志应用到状态机（state machine）并返回结果给客户端。
```plain text
Client → Leader → Follower(复制日志)
        ↓
     commit 确认半数
        ↓
   Apply to state machine


```

### 5. 脑裂与恢复

网络分区可能导致多个 Leader 出现（脑裂），但不会造成数据不一致：

- Term 较小的 Leader 无法获得多数派确认，因此日志不会提交；
- 当网络恢复时，Term 较小的节点会发现更高的 Term；
- 它会自动降级为 Follower；
- 最终，集群重新收敛为一个 Leader。
## 📚 延伸阅读

- 动画理解：raft协议
- raft协议原文：raft协议论文

