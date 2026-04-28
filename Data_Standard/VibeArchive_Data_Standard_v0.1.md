# Vibe Archive Data Standard v0.1

## 1. 概述

**Vibe Archive Data Standard v0.1** 是一个面向 AI Coding 场景的任务级中间数据标准。

它的核心目标是：

> 将开发者与 AI 的协作过程结构化为可复用、可检索、可训练的数据资产。

---

## 2. 设计原则

一条记录 ≠ 一条消息  
一条记录 = 一次完整的 AI Coding Task：

开发意图 + 代码上下文 + AI 交互 + 代码变更 + 执行结果 + 质量评价

---

## 3. 顶层结构

```json
{
  "schema": "vibe-archive.task.v0.1",
  "id": "task_01HZY...",
  "created_at": "2026-04-25T10:30:00Z",
  "updated_at": "2026-04-25T10:48:00Z",

  "source": {
    "app": "vscode",
    "extension": "vibe-archive",
    "capture_mode": "manual_paste",
    "ai_tool": "claude-code",
    "model": "claude-3-7-sonnet"
  }
}
```

---

## 4. 最小可用结构（MVP）

```json
{
  "schema": "vibe-archive.task.v0.1",
  "id": "task_xxx",
  "created_at": "2026-04-25T10:30:00Z",
  "source": {
    "app": "vscode",
    "capture_mode": "manual_paste"
  },
  "task": {
    "intent": "用户想完成什么"
  },
  "context": {
    "active_file": "src/index.ts"
  },
  "conversation": [
    {
      "role": "user",
      "content": "..."
    },
    {
      "role": "assistant",
      "content": "..."
    }
  ],
  "changes": [],
  "outcome": {
    "status": "draft"
  }
}
```

---

## 5. 字段定义

### capture_mode
manual_paste | clipboard | own_chat_panel | import | proxy | api

### task.type
feature | bugfix | refactor | test | doc | config | debug | explain | review | unknown

### file role
target | dependency | reference | test | config | unknown

---

## 6. 导出格式

### Chat Messages
```json
{"messages": [...]}
```

### Instruction
```json
{"instruction": "...", "input": "...", "output": "..."}
```

### ShareGPT
```json
{"conversations": [...]}
```

---

## 7. 存储结构

~/.vibe-archive/
  projects/
    my-project/
      tasks/
      exports/

---

## 8. 核心价值

Chat + Context + Diff + Execution + Outcome + Training Conversion

---

## 9. 结论

没有统一训练格式，只有“可转换数据标准”。
