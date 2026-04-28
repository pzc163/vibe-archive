# Vibe Archive Data Standard v0.4.1

> **Schema ID**: `vibe-archive.task.v0.4.1`  
> **发布日期**: 2026-04-25  
> **状态**: Candidate (Open Standard Ready)  
> **目标**: 开放、可验证、可扩展的 AI Coding 数据标准  
> **规范地址**: `https://vibe-archive.dev/schema/task/v0.4.1.json`

---

## 目录

1. [概述](#1-概述)
2. [标准分层架构](#2-标准分层架构)
3. [Core 层规范](#3-core-层规范)
4. [Extended 层规范](#4-extended-层规范)
5. [Enterprise 层规范](#5-enterprise-层规范)
6. [Decision 层规范](#6-decision-层规范)
7. [完整 JSON Schema](#7-完整-json-schema)
8. [多语言 SDK](#8-多语言-sdk)
9. [Export Profiles 接口定义](#9-export-profiles-接口定义)
10. [验证规则](#10-验证规则)
11. [完整示例](#11-完整示例)
12. [版本与迁移](#12-版本与迁移)

---

## 1. 概述

**Vibe Archive Data Standard v0.4.1** 定义了 AI 辅助软件开发场景下的任务级数据模型。它将开发者与 AI 的协作过程结构化为**可复用、可检索、可训练**的数据资产。

### 1.1 核心定义

> **一条记录 ≠ 一条消息**  
> **一条记录 = 一次完整的 AI Coding Task**

一个 Task 包含：开发意图 → 代码上下文 → AI 交互（可能多轮、多工具、多 Session） → 代码变更 → 执行验证 → **决策闭环** → 质量评价。

### 1.2 设计原则

1. **任务闭环**：记录从意图产生到代码落地/否决的完整生命周期
2. **多 Session 聚合**：支持同一 Task 下多次 AI 工具尝试（Copilot → Claude → 手动修改）
3. **上下文原生**：保留文件树、Git 状态、依赖版本、光标位置，而不只是文本对话
4. **变更可追溯**：每条代码变更精确关联到产生它的 Session 和 Tool Call
5. **决策显式化**：明确记录最终采纳哪个 Session、哪些 Change、由谁决策、基于什么依据
6. **训练就绪**：原生兼容 OpenAI Messages / ShareGPT / Alpaca / DPO / Agent Trajectory 等下游训练格式
7. **隐私内建**：路径脱敏、敏感内容检测、审计日志、保留策略在 Schema 层定义
8. **分层扩展**：Core 保证最小互操作，Extended 承载 Coding 核心价值，Enterprise 满足合规治理，Decision 明确闭环

---

## 2. 标准分层架构

| 层级 | 定位 | 适用场景 | 核心能力 |
|------|------|---------|---------|
| **Core** | 最小互操作集 | 跨工具数据交换、基础存储 | 会话捕获、消息记录 |
| **Extended** | Coding 场景价值层 | 上下文关联、Diff 记录、质量评价 | 代码上下文、变更溯源、执行验证 |
| **Decision** | 决策闭环层 | DPO、Diff-Edit、Agent 训练 | 最终选择、变更采纳、决策依据 |
| **Enterprise** | 隐私合规治理层 | 企业审计、数据治理、安全合规 | 脱敏、审计、保留策略 |

**兼容性规则**：
- 所有字段均为可选（除 Core required 外），缺失字段视为 `null` 或默认值
- 解析器必须**忽略未知字段**（forward compatibility）
- 序列化器必须**保留未知字段**（round-trip safety）

---

## 3. Core 层规范

### 3.1 顶层结构

```json
{
  "schema": "vibe-archive.task.v0.4.1",
  "id": "task_01HZY8K2JQV8W4R9T1M3N5P7",
  "created_at": "2026-04-25T10:30:00Z",
  "updated_at": "2026-04-25T10:48:00Z",
  "source": { ... },
  "task": { ... },
  "sessions": [ ... ]
}
```

### 3.2 字段定义

#### `source` — 数据来源

```json
{
  "app": "vscode",
  "extension": "vibe-archive",
  "extension_version": "0.2.1",
  "capture_mode": "auto_scan",
  "ai_tool": "claude-code",
  "model": "claude-3-7-sonnet",
  "model_version": "20250219",
  "os": "darwin",
  "shell": "zsh"
}
```

| 字段 | 类型 | 必需 | 枚举/说明 |
|------|------|------|-----------|
| `app` | `string` | ✅ | `vscode`, `cursor`, `trae`, `jetbrains`, `terminal`, `unknown` |
| `extension` | `string` | ❌ | 捕获插件名称 |
| `extension_version` | `string` | ❌ | 插件版本 |
| `capture_mode` | `string` | ✅ | `auto_scan`, `manual_paste`, `clipboard`, `own_chat_panel`, `import`, `proxy`, `api` |
| `ai_tool` | `string` | ✅ | `github-copilot`, `claude-code`, `codex`, `kimi-code`, `cursor-chat`, `trae-chat`, `custom` |
| `model` | `string` | ❌ | 模型标识 |
| `model_version` | `string` | ❌ | 模型具体版本号 |
| `os` | `string` | ❌ | `darwin`, `linux`, `win32`, `unknown` |
| `shell` | `string` | ❌ | `zsh`, `bash`, `fish`, `powershell`, `cmd`, `unknown` |

#### `task` — 任务意图

```json
{
  "type": "feature",
  "intent": "为搜索组件添加防抖功能，避免频繁请求 API",
  "parent_task_id": null,
  "related_tasks": ["task_01HZY..."]
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | `string` | ❌ | `feature`, `bugfix`, `refactor`, `test`, `doc`, `config`, `debug`, `explain`, `review`, `chore`, `unknown` |
| `intent` | `string` | ✅ | 开发者原始意图的自然语言描述 |
| `parent_task_id` | `string \| null` | ❌ | 父任务 ID |
| `related_tasks` | `string[]` | ❌ | 关联任务 ID 数组 |

#### `sessions` — AI 交互会话数组

```json
[
  {
    "session_id": "sess_claude_abc123",
    "ai_tool": "claude-code",
    "model": "claude-3-7-sonnet",
    "created_at": "2026-04-25T10:30:00Z",
    "ended_at": "2026-04-25T10:35:00Z",
    "user_feedback": "partial",
    "conversation": [
      {
        "role": "user",
        "content": "给 Search 组件加个防抖，300ms",
        "timestamp": "2026-04-25T10:30:00Z"
      },
      {
        "role": "assistant",
        "content": "我来为 Search 组件添加防抖功能...",
        "thinking": "用户需要在 Search 组件中添加防抖...",
        "tool_calls": [
          {
            "id": "call_001",
            "type": "file_write",
            "name": "write_file",
            "arguments": {"path": "src/hooks/useDebounce.ts", "content": "..."},
            "result": {"success": true}
          }
        ],
        "timestamp": "2026-04-25T10:30:08Z"
      }
    ]
  }
]
```

##### Session 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `session_id` | `string` | ✅ | 原始插件的 session 标识 |
| `ai_tool` | `string` | ✅ | 同 `source.ai_tool` |
| `model` | `string` | ❌ | 使用的模型 |
| `created_at` | `string` (ISO 8601) | ✅ | Session 开始时间 |
| `ended_at` | `string` (ISO 8601) | ❌ | Session 结束时间 |
| `user_feedback` | `string \| null` | ❌ | `accept`, `reject`, `modify`, `partial` |
| `conversation` | `Message[]` | ✅ | 消息数组 |

##### Message 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `role` | `string` | ✅ | `system`, `user`, `assistant`, `tool` |
| `content` | `string` | ✅ | 消息内容 |
| `thinking` | `string` | ❌ | AI 思维链/推理过程（Claude thinking 块等） |
| `tool_calls` | `ToolCall[]` | ❌ | AI 调用的工具列表 |
| `timestamp` | `string` (ISO 8601) | ✅ | 消息时间戳 |
| `name` | `string` | ❌ | `role=tool` 时的工具名称 |
| `tool_call_id` | `string` | ❌ | 关联 tool_call 的 ID |

##### Tool Call 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 工具调用唯一 ID |
| `type` | `string` | ✅ | `file_read`, `file_write`, `file_edit`, `bash`, `lsp_query`, `search`, `custom` |
| `name` | `string` | ✅ | 工具名称 |
| `arguments` | `object` | ✅ | 工具参数 |
| `result` | `any` | ❌ | 工具执行结果 |

---

## 4. Extended 层规范

### 4.1 `context` — 代码上下文快照

```json
{
  "workspace_root": "{HOME}/projects/ecommerce-app",
  "active_file": {
    "path": "src/components/Search.tsx",
    "language": "typescriptreact",
    "cursor_position": {"line": 42, "character": 12},
    "selected_text": "const [query, setQuery] = useState('')",
    "viewport_range": {"start": 30, "end": 55}
  },
  "file_tree": [
    {"path": "src/components/Search.tsx", "language": "typescriptreact", "role": "target"},
    {"path": "src/hooks/useDebounce.ts", "language": "typescript", "role": "target"},
    {"path": "src/api/search.ts", "language": "typescript", "role": "dependency"}
  ],
  "git_state": {
    "branch": "feature/search-debounce",
    "last_commit": "a1b2c3d",
    "dirty_files": ["src/components/Search.tsx"]
  },
  "dependencies": {
    "react": "^18.2.0",
    "lodash": "^4.17.21"
  },
  "environment": {
    "node_version": "20.12.0",
    "package_manager": "pnpm"
  }
}
```

#### Context 字段表

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_root` | `string` | ❌ | 工作区根路径（已脱敏） |
| `active_file` | `object` | ❌ | 当前激活文件详情 |
| `active_file.path` | `string` | ✅ | 文件相对路径 |
| `active_file.language` | `string` | ✅ | VS Code Language ID |
| `active_file.cursor_position` | `object` | ❌ | `{line, character}` |
| `active_file.selected_text` | `string` | ❌ | 用户选中的代码片段 |
| `active_file.viewport_range` | `object` | ❌ | 屏幕可见区域 `{start, end}` |
| `file_tree` | `FileNode[]` | ❌ | 相关文件列表 |
| `file_tree[].path` | `string` | ✅ | 文件路径 |
| `file_tree[].language` | `string` | ✅ | 语言标识 |
| `file_tree[].role` | `string` | ✅ | `target`, `dependency`, `reference`, `test`, `config`, `unknown` |
| `git_state` | `object` | ❌ | Git 状态快照 |
| `git_state.branch` | `string` | ❌ | 当前分支 |
| `git_state.last_commit` | `string` | ❌ | 最近 commit hash（前7位） |
| `git_state.dirty_files` | `string[]` | ❌ | 未提交文件列表 |
| `dependencies` | `object` | ❌ | 关键依赖版本映射（`{name: version}`） |
| `environment` | `object` | ❌ | 运行时环境 |
| `environment.node_version` | `string` | ❌ | Node.js 版本等 |
| `environment.package_manager` | `string` | ❌ | `npm`, `yarn`, `pnpm`, `bun`, `pip`, `poetry`, `cargo`, `unknown` |

### 4.2 `changes` — 代码变更记录（含溯源）

精确记录 Task 导致的代码 Diff，并**精确溯源到产生它的 Session 和 Tool Call**。

```json
[
  {
    "change_id": "chg_001",
    "file_path": "src/hooks/useDebounce.ts",
    "language": "typescript",
    "role": "target",
    "diff_format": "unified",
    "patch": "@@ -0,0 +1,18 @@\n+import { useRef, useEffect } from 'react';...",
    "before_hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "after_hash": "sha256:7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730",
    "change_type": "add",
    "ai_generated": true,
    "user_modified": true,
    "user_edit_reason": "改用 useRef 替代 useState 以避免 re-render",
    "test_coverage": {"before": 0, "after": 4},
    "source_session_id": "sess_claude_abc123",
    "source_tool_call_id": "call_002",
    "source_message_id": "msg_004"
  }
]
```

#### Changes 字段表

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `change_id` | `string` | ✅ | 变更唯一 ID（在 Task 内唯一） |
| `file_path` | `string` | ✅ | 文件路径（脱敏后） |
| `language` | `string` | ✅ | 语言标识 |
| `role` | `string` | ✅ | `target`, `dependency`, `test`, `config`, `unknown` |
| `diff_format` | `string` | ✅ | `unified`, `git-diff`, `json-patch` |
| `patch` | `string` | ✅ | 标准 diff 文本 |
| `before_hash` | `string` | ❌ | 变更前文件 SHA256（`sha256:...`） |
| `after_hash` | `string` | ❌ | 变更后文件 SHA256 |
| `change_type` | `string` | ✅ | `add`, `modify`, `delete`, `rename` |
| `ai_generated` | `boolean` | ✅ | 是否由 AI 生成 |
| `user_modified` | `boolean` | ✅ | 用户是否在 AI 基础上修改 |
| `user_edit_reason` | `string` | ❌ | 用户修改原因 |
| `test_coverage` | `object` | ❌ | 测试覆盖变化 `{before, after}` |
| `source_session_id` | `string` | ❌ | 产生此变更的 Session ID |
| `source_tool_call_id` | `string` | ❌ | 产生此变更的 Tool Call ID |
| `source_message_id` | `string` | ❌ | 产生此变更的 Message ID |

### 4.3 `outcome` — 任务结果与质量评价

```json
{
  "status": "completed",
  "user_feedback": "accept",
  "quality_score": 0.91,
  "resolution_type": "ai_assisted",
  "execution_result": {
    "type": "test_passed",
    "details": "useDebounce hook: 4/4 tests passed",
    "command": "pnpm test useDebounce",
    "exit_code": 0,
    "stdout": "PASS src/hooks/useDebounce.test.ts\n  useDebounce\n    ✓ should delay value update (45ms)",
    "stderr": ""
  },
  "follow_up_required": false,
  "follow_up_task_id": null,
  "review_notes": ""
}
```

#### Outcome 字段表

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `status` | `string` | ❌ | `draft`, `in_progress`, `completed`, `abandoned`, `blocked` |
| `user_feedback` | `string \| null` | ❌ | `accept`, `reject`, `modify`, `partial` |
| `quality_score` | `number` | ❌ | 0.0 - 1.0，综合评分 |
| `resolution_type` | `string` | ❌ | `ai_solved`, `user_solved`, `ai_assisted`, `abandoned`, `escalated` |
| `execution_result` | `object` | ❌ | 代码执行验证结果 |
| `execution_result.type` | `string` | ✅ | `test_passed`, `test_failed`, `runtime_error`, `lint_error`, `type_error`, `build_error`, `no_execution`, `skipped` |
| `execution_result.details` | `string` | ❌ | 结果描述 |
| `execution_result.command` | `string` | ❌ | 执行的命令 |
| `execution_result.exit_code` | `integer` | ❌ | 退出码 |
| `execution_result.stdout` | `string` | ❌ | 标准输出 |
| `execution_result.stderr` | `string` | ❌ | 标准错误 |
| `follow_up_required` | `boolean` | ❌ | 是否需要后续 Task |
| `follow_up_task_id` | `string \| null` | ❌ | 关联后续 Task ID |
| `review_notes` | `string` | ❌ | Code Review 备注 |

### 4.4 `metadata` — 检索与训练元数据

```json
{
  "tags": ["react", "hooks", "debounce", "performance", "typescript"],
  "domain": "frontend",
  "complexity": "simple",
  "session_duration_sec": 480,
  "message_count": 4,
  "total_tool_calls": 2,
  "has_code_output": true,
  "has_tool_usage": true,
  "has_thinking_block": true,
  "has_user_modification": true,
  "languages": ["typescript", "typescriptreact"],
  "training_ready": true,
  "estimated_tokens": 2400
}
```

#### Metadata 字段表

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `tags` | `string[]` | ❌ | 自动/手动标签 |
| `domain` | `string` | ❌ | `frontend`, `backend`, `devops`, `mobile`, `ai/ml`, `data`, `infra`, `unknown` |
| `complexity` | `string` | ❌ | `simple`, `medium`, `complex`, `architecture` |
| `session_duration_sec` | `integer` | ❌ | Task 总耗时（秒） |
| `message_count` | `integer` | ❌ | 总消息数 |
| `total_tool_calls` | `integer` | ❌ | 工具调用总数 |
| `has_code_output` | `boolean` | ❌ | 是否包含代码输出 |
| `has_tool_usage` | `boolean` | ❌ | 是否使用工具 |
| `has_thinking_block` | `boolean` | ❌ | 是否包含思维链 |
| `has_user_modification` | `boolean` | ❌ | 用户是否修改过 AI 代码 |
| `languages` | `string[]` | ❌ | 涉及编程语言列表 |
| `training_ready` | `boolean` | ❌ | 是否通过质量门槛，可用于训练 |
| `estimated_tokens` | `integer` | ❌ | 估算 Token 数 |

---

## 5. Enterprise 层规范

### 5.1 `privacy` — 隐私与脱敏

```json
{
  "paths_masked": true,
  "sensitive_content_detected": false,
  "excluded_patterns": ["**/.env*", "**/secrets.*", "**/*.key", "**/*.pem"],
  "retention_policy": "keep_forever",
  "data_owner": "user_local",
  "encryption_at_rest": false,
  "data_classification": "internal"
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `paths_masked` | `boolean` | ❌ | 绝对路径是否已脱敏 |
| `sensitive_content_detected` | `boolean` | ❌ | 是否检测到敏感内容 |
| `excluded_patterns` | `string[]` | ❌ | 排除的文件模式 |
| `retention_policy` | `string` | ❌ | `keep_forever`, `auto_purge_30d`, `auto_purge_90d` |
| `data_owner` | `string` | ❌ | `user_local`, `team_shared`, `enterprise` |
| `encryption_at_rest` | `boolean` | ❌ | 是否静态加密 |
| `data_classification` | `string` | ❌ | `public`, `internal`, `confidential`, `restricted` |

### 5.2 `governance` — 审计与治理

```json
{
  "collected_by": "vibe-archive-vscode-ext@0.2.1",
  "collection_time": "2026-04-25T10:30:00Z",
  "user_consent": "explicit_opt_in",
  "team_id": null,
  "project_id": "ecommerce-app",
  "data_steward": "dev-team-lead@company.com",
  "audit_log": [
    {
      "action": "auto_scan",
      "timestamp": "2026-04-25T10:30:00Z",
      "actor": "system",
      "source_file": "~/.claude/projects/abc/sess.jsonl"
    },
    {
      "action": "export_training_data",
      "timestamp": "2026-04-25T11:00:00Z",
      "actor": "user",
      "format": "dpo",
      "exported_by": "user",
      "destination": "local_disk"
    }
  ]
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `collected_by` | `string` | ❌ | 采集工具标识 |
| `collection_time` | `string` (ISO 8601) | ❌ | 首次采集时间 |
| `user_consent` | `string` | ❌ | `explicit_opt_in`, `implicit`, `enterprise_policy`, `none` |
| `team_id` | `string \| null` | ❌ | 团队标识 |
| `project_id` | `string \| null` | ❌ | 项目标识 |
| `data_steward` | `string` | ❌ | 数据责任人 |
| `audit_log` | `AuditEvent[]` | ❌ | 审计日志数组 |

#### Audit Event 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `action` | `string` | ✅ | 动作类型 |
| `timestamp` | `string` | ✅ | 动作时间 |
| `actor` | `string` | ✅ | `system`, `user`, `admin`, `policy` |
| `source_file` | `string` | ❌ | 源文件（采集时） |
| `format` | `string` | ❌ | 导出格式（导出时） |
| `exported_by` | `string` | ❌ | 导出者身份 |
| `destination` | `string` | ❌ | 导出目的地 |
| `fields_removed` | `string[]` | ❌ | 脱敏字段列表 |

---

## 6. Decision 层规范

Decision 层是 v0.4.1 新增的核心层，用于**显式记录多 Session 场景下的最终决策闭环**。它回答了三个关键问题：

1. **最终采纳了哪个 Session 的结果？**
2. **最终采纳了哪些 Change？**
3. **决策是由谁、在什么时候、基于什么依据做出的？**

### 6.1 `decision` — 决策对象

```json
{
  "final_session_id": "sess_claude_abc123",
  "final_change_ids": ["chg_001", "chg_002"],
  "selection_reason": "用户手动确认，且 4/4 单元测试通过",
  "decision_type": "human_select",
  "decision_timestamp": "2026-04-25T10:48:00Z",
  "decision_actor": "user",
  "auto_score_at_decision": 0.91,
  "overridden": false,
  "override_reason": null
}
```

### 6.2 字段定义

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `final_session_id` | `string` | ✅ | 最终被采纳的 Session ID |
| `final_change_ids` | `string[]` | ✅ | 最终被采纳的 Change ID 列表（必须存在于 `changes[]`） |
| `selection_reason` | `string` | ❌ | 选择原因/依据（自然语言描述） |
| `decision_type` | `string` | ✅ | `human_select`, `auto_score`, `test_result`, `hybrid`, `time_based` |
| `decision_timestamp` | `string` (ISO 8601) | ✅ | 决策时间 |
| `decision_actor` | `string` | ✅ | `user`, `system`, `reviewer`, `ci_pipeline`, `auto_grader` |
| `auto_score_at_decision` | `number` | ❌ | 决策时的自动评分（0-1） |
| `overridden` | `boolean` | ❌ | 是否被后续覆盖 |
| `override_reason` | `string \| null` | ❌ | 覆盖原因（若 `overridden=true`） |

### 6.3 Decision Type 说明

| 类型 | 场景 | 示例 |
|------|------|------|
| `human_select` | 用户手动选择一个 Session 的结果 | 用户在 Vibe Archive 面板中点击"采纳此方案" |
| `auto_score` | 系统基于 quality_score 自动选择最高分 Session | 插件配置自动采纳 score > 0.9 的结果 |
| `test_result` | CI/CD 或本地测试通过自动采纳 | `npm test` 全绿后自动标记 |
| `hybrid` | 系统推荐 + 用户确认 | 插件推荐最佳方案，用户一键确认 |
| `time_based` | 默认采纳最后一个 Session（兜底策略） | 无明确反馈时采纳最终尝试 |

### 6.4 与 Outcome 的关系

- `outcome` 描述**任务最终结果**（是否完成、测试是否通过、质量评分）
- `decision` 描述**选择过程**（从多个 Session 中选了哪个、为什么选）
- **DPO 训练**：`chosen` = `decision.final_session_id` 对应的 session；`rejected` = 其他 session
- **Diff-Edit 训练**：只提取 `decision.final_change_ids` 对应的 changes 作为正样本

---

## 7. 完整 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://vibe-archive.dev/schema/task/v0.4.1.json",
  "title": "Vibe Archive Task Record v0.4.1",
  "type": "object",
  "required": ["schema", "id", "created_at", "source", "task", "sessions"],
  "properties": {
    "schema": {
      "type": "string",
      "const": "vibe-archive.task.v0.4.1",
      "description": "Schema 版本标识"
    },
    "id": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9_-]+$",
      "description": "全局唯一 Task ID"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 创建时间"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 更新时间"
    },
    "source": {
      "type": "object",
      "required": ["app", "capture_mode", "ai_tool"],
      "properties": {
        "app": { "type": "string", "enum": ["vscode", "cursor", "trae", "jetbrains", "terminal", "unknown"] },
        "extension": { "type": "string" },
        "extension_version": { "type": "string" },
        "capture_mode": { "type": "string", "enum": ["auto_scan", "manual_paste", "clipboard", "own_chat_panel", "import", "proxy", "api"] },
        "ai_tool": { "type": "string", "enum": ["github-copilot", "claude-code", "codex", "kimi-code", "cursor-chat", "trae-chat", "custom"] },
        "model": { "type": "string" },
        "model_version": { "type": "string" },
        "os": { "type": "string", "enum": ["darwin", "linux", "win32", "unknown"] },
        "shell": { "type": "string", "enum": ["zsh", "bash", "fish", "powershell", "cmd", "unknown"] }
      }
    },
    "task": {
      "type": "object",
      "required": ["intent"],
      "properties": {
        "type": { "type": "string", "enum": ["feature", "bugfix", "refactor", "test", "doc", "config", "debug", "explain", "review", "chore", "unknown"] },
        "intent": { "type": "string", "minLength": 1 },
        "parent_task_id": { "type": ["string", "null"] },
        "related_tasks": { "type": "array", "items": { "type": "string" } }
      }
    },
    "context": {
      "type": "object",
      "properties": {
        "workspace_root": { "type": "string" },
        "active_file": {
          "type": "object",
          "properties": {
            "path": { "type": "string" },
            "language": { "type": "string" },
            "cursor_position": {
              "type": "object",
              "properties": {
                "line": { "type": "integer", "minimum": 0 },
                "character": { "type": "integer", "minimum": 0 }
              }
            },
            "selected_text": { "type": "string" },
            "viewport_range": {
              "type": "object",
              "properties": {
                "start": { "type": "integer", "minimum": 0 },
                "end": { "type": "integer", "minimum": 0 }
              }
            }
          }
        },
        "file_tree": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["path", "language", "role"],
            "properties": {
              "path": { "type": "string" },
              "language": { "type": "string" },
              "role": { "type": "string", "enum": ["target", "dependency", "reference", "test", "config", "unknown"] }
            }
          }
        },
        "git_state": {
          "type": "object",
          "properties": {
            "branch": { "type": "string" },
            "last_commit": { "type": "string" },
            "dirty_files": { "type": "array", "items": { "type": "string" } }
          }
        },
        "dependencies": { "type": "object", "additionalProperties": { "type": "string" } },
        "environment": {
          "type": "object",
          "properties": {
            "node_version": { "type": "string" },
            "package_manager": { "type": "string", "enum": ["npm", "yarn", "pnpm", "bun", "pip", "poetry", "cargo", "unknown"] }
          }
        }
      }
    },
    "sessions": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["session_id", "ai_tool", "created_at", "conversation"],
        "properties": {
          "session_id": { "type": "string" },
          "ai_tool": { "type": "string" },
          "model": { "type": "string" },
          "created_at": { "type": "string", "format": "date-time" },
          "ended_at": { "type": "string", "format": "date-time" },
          "user_feedback": { "type": "string", "enum": ["accept", "reject", "modify", "partial", null] },
          "conversation": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["role", "content", "timestamp"],
              "properties": {
                "role": { "type": "string", "enum": ["system", "user", "assistant", "tool"] },
                "content": { "type": "string" },
                "thinking": { "type": "string" },
                "tool_calls": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["id", "type", "name", "arguments"],
                    "properties": {
                      "id": { "type": "string" },
                      "type": { "type": "string", "enum": ["file_read", "file_write", "file_edit", "bash", "lsp_query", "search", "custom"] },
                      "name": { "type": "string" },
                      "arguments": { "type": "object" },
                      "result": {}
                    }
                  }
                },
                "timestamp": { "type": "string", "format": "date-time" },
                "name": { "type": "string" },
                "tool_call_id": { "type": "string" }
              }
            }
          }
        }
      }
    },
    "changes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["change_id", "file_path", "language", "role", "diff_format", "patch", "change_type", "ai_generated", "user_modified"],
        "properties": {
          "change_id": { "type": "string", "description": "Unique change ID within the task" },
          "file_path": { "type": "string" },
          "language": { "type": "string" },
          "role": { "type": "string", "enum": ["target", "dependency", "test", "config", "unknown"] },
          "diff_format": { "type": "string", "enum": ["unified", "git-diff", "json-patch"] },
          "patch": { "type": "string" },
          "before_hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
          "after_hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
          "change_type": { "type": "string", "enum": ["add", "modify", "delete", "rename"] },
          "ai_generated": { "type": "boolean" },
          "user_modified": { "type": "boolean" },
          "user_edit_reason": { "type": "string" },
          "test_coverage": {
            "type": "object",
            "properties": {
              "before": { "type": "integer", "minimum": 0 },
              "after": { "type": "integer", "minimum": 0 }
            }
          },
          "source_session_id": { "type": "string", "description": "Session ID that produced this change" },
          "source_tool_call_id": { "type": "string", "description": "Tool Call ID that produced this change" },
          "source_message_id": { "type": "string", "description": "Message ID that produced this change" }
        }
      }
    },
    "decision": {
      "type": "object",
      "required": ["final_session_id", "final_change_ids", "decision_type", "decision_timestamp", "decision_actor"],
      "properties": {
        "final_session_id": { "type": "string", "description": "Adopted session ID" },
        "final_change_ids": { "type": "array", "items": { "type": "string" }, "description": "Adopted change IDs" },
        "selection_reason": { "type": "string" },
        "decision_type": { "type": "string", "enum": ["human_select", "auto_score", "test_result", "hybrid", "time_based"] },
        "decision_timestamp": { "type": "string", "format": "date-time" },
        "decision_actor": { "type": "string", "enum": ["user", "system", "reviewer", "ci_pipeline", "auto_grader"] },
        "auto_score_at_decision": { "type": "number", "minimum": 0, "maximum": 1 },
        "overridden": { "type": "boolean" },
        "override_reason": { "type": ["string", "null"] }
      }
    },
    "outcome": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "enum": ["draft", "in_progress", "completed", "abandoned", "blocked"] },
        "user_feedback": { "type": "string", "enum": ["accept", "reject", "modify", "partial", null] },
        "quality_score": { "type": "number", "minimum": 0, "maximum": 1 },
        "resolution_type": { "type": "string", "enum": ["ai_solved", "user_solved", "ai_assisted", "abandoned", "escalated"] },
        "execution_result": {
          "type": "object",
          "required": ["type"],
          "properties": {
            "type": { "type": "string", "enum": ["test_passed", "test_failed", "runtime_error", "lint_error", "type_error", "build_error", "no_execution", "skipped"] },
            "details": { "type": "string" },
            "command": { "type": "string" },
            "exit_code": { "type": "integer" },
            "stdout": { "type": "string" },
            "stderr": { "type": "string" }
          }
        },
        "follow_up_required": { "type": "boolean" },
        "follow_up_task_id": { "type": ["string", "null"] },
        "review_notes": { "type": "string" }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "tags": { "type": "array", "items": { "type": "string" } },
        "domain": { "type": "string", "enum": ["frontend", "backend", "devops", "mobile", "ai/ml", "data", "infra", "unknown"] },
        "complexity": { "type": "string", "enum": ["simple", "medium", "complex", "architecture"] },
        "session_duration_sec": { "type": "integer", "minimum": 0 },
        "message_count": { "type": "integer", "minimum": 0 },
        "total_tool_calls": { "type": "integer", "minimum": 0 },
        "has_code_output": { "type": "boolean" },
        "has_tool_usage": { "type": "boolean" },
        "has_thinking_block": { "type": "boolean" },
        "has_user_modification": { "type": "boolean" },
        "languages": { "type": "array", "items": { "type": "string" } },
        "training_ready": { "type": "boolean" },
        "estimated_tokens": { "type": "integer", "minimum": 0 }
      }
    },
    "privacy": {
      "type": "object",
      "properties": {
        "paths_masked": { "type": "boolean" },
        "sensitive_content_detected": { "type": "boolean" },
        "excluded_patterns": { "type": "array", "items": { "type": "string" } },
        "retention_policy": { "type": "string", "enum": ["keep_forever", "auto_purge_30d", "auto_purge_90d"] },
        "data_owner": { "type": "string", "enum": ["user_local", "team_shared", "enterprise"] },
        "encryption_at_rest": { "type": "boolean" },
        "data_classification": { "type": "string", "enum": ["public", "internal", "confidential", "restricted"] }
      }
    },
    "governance": {
      "type": "object",
      "properties": {
        "collected_by": { "type": "string" },
        "collection_time": { "type": "string", "format": "date-time" },
        "user_consent": { "type": "string", "enum": ["explicit_opt_in", "implicit", "enterprise_policy", "none"] },
        "team_id": { "type": ["string", "null"] },
        "project_id": { "type": ["string", "null"] },
        "data_steward": { "type": "string" },
        "audit_log": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["action", "timestamp", "actor"],
            "properties": {
              "action": { "type": "string" },
              "timestamp": { "type": "string", "format": "date-time" },
              "actor": { "type": "string", "enum": ["system", "user", "admin", "policy"] },
              "source_file": { "type": "string" },
              "format": { "type": "string" },
              "exported_by": { "type": "string" },
              "destination": { "type": "string" },
              "fields_removed": { "type": "array", "items": { "type": "string" } }
            }
          }
        }
      }
    }
  }
}
```

---

## 8. 多语言 SDK

### 8.1 TypeScript SDK（含 Decision 层）

```typescript
// types.ts

export type VibeApp = "vscode" | "cursor" | "trae" | "jetbrains" | "terminal" | "unknown";
export type CaptureMode = "auto_scan" | "manual_paste" | "clipboard" | "own_chat_panel" | "import" | "proxy" | "api";
export type AiTool = "github-copilot" | "claude-code" | "codex" | "kimi-code" | "cursor-chat" | "trae-chat" | "custom";
export type TaskType = "feature" | "bugfix" | "refactor" | "test" | "doc" | "config" | "debug" | "explain" | "review" | "chore" | "unknown";
export type FileRole = "target" | "dependency" | "reference" | "test" | "config" | "unknown";
export type ToolType = "file_read" | "file_write" | "file_edit" | "bash" | "lsp_query" | "search" | "custom";
export type ChangeType = "add" | "modify" | "delete" | "rename";
export type DiffFormat = "unified" | "git-diff" | "json-patch";
export type OutcomeStatus = "draft" | "in_progress" | "completed" | "abandoned" | "blocked";
export type ExecutionType = "test_passed" | "test_failed" | "runtime_error" | "lint_error" | "type_error" | "build_error" | "no_execution" | "skipped";
export type Domain = "frontend" | "backend" | "devops" | "mobile" | "ai/ml" | "data" | "infra" | "unknown";
export type Complexity = "simple" | "medium" | "complex" | "architecture";
export type RetentionPolicy = "keep_forever" | "auto_purge_30d" | "auto_purge_90d";
export type DataOwner = "user_local" | "team_shared" | "enterprise";
export type DataClassification = "public" | "internal" | "confidential" | "restricted";
export type UserConsent = "explicit_opt_in" | "implicit" | "enterprise_policy" | "none";
export type AuditActor = "system" | "user" | "admin" | "policy";
export type DecisionType = "human_select" | "auto_score" | "test_result" | "hybrid" | "time_based";
export type DecisionActor = "user" | "system" | "reviewer" | "ci_pipeline" | "auto_grader";

// Core
export interface VibeTask {
  schema: "vibe-archive.task.v0.4.1";
  id: string;
  created_at: string;
  updated_at?: string;
  source: Source;
  task: TaskIntent;
  sessions: Session[];
  // Extended
  context?: CodeContext;
  changes?: CodeChange[];
  outcome?: Outcome;
  metadata?: Metadata;
  // Decision
  decision?: Decision;
  // Enterprise
  privacy?: Privacy;
  governance?: Governance;
}

export interface Source {
  app: VibeApp;
  extension?: string;
  extension_version?: string;
  capture_mode: CaptureMode;
  ai_tool: AiTool;
  model?: string;
  model_version?: string;
  os?: string;
  shell?: string;
}

export interface TaskIntent {
  type?: TaskType;
  intent: string;
  parent_task_id?: string | null;
  related_tasks?: string[];
}

export interface Session {
  session_id: string;
  ai_tool: string;
  model?: string;
  created_at: string;
  ended_at?: string;
  user_feedback?: "accept" | "reject" | "modify" | "partial" | null;
  conversation: Message[];
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  thinking?: string;
  tool_calls?: ToolCall[];
  timestamp: string;
  name?: string;
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: ToolType;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

// Extended
export interface CodeContext {
  workspace_root?: string;
  active_file?: ActiveFile;
  file_tree?: FileNode[];
  git_state?: GitState;
  dependencies?: Record<string, string>;
  environment?: Environment;
}

export interface ActiveFile {
  path: string;
  language: string;
  cursor_position?: { line: number; character: number };
  selected_text?: string;
  viewport_range?: { start: number; end: number };
}

export interface FileNode {
  path: string;
  language: string;
  role: FileRole;
}

export interface GitState {
  branch?: string;
  last_commit?: string;
  dirty_files?: string[];
}

export interface Environment {
  node_version?: string;
  package_manager?: string;
}

export interface CodeChange {
  change_id: string;
  file_path: string;
  language: string;
  role: FileRole;
  diff_format: DiffFormat;
  patch: string;
  before_hash?: string;
  after_hash?: string;
  change_type: ChangeType;
  ai_generated: boolean;
  user_modified: boolean;
  user_edit_reason?: string;
  test_coverage?: { before: number; after: number };
  source_session_id?: string;
  source_tool_call_id?: string;
  source_message_id?: string;
}

export interface Outcome {
  status: OutcomeStatus;
  user_feedback?: "accept" | "reject" | "modify" | "partial" | null;
  quality_score?: number;
  resolution_type?: "ai_solved" | "user_solved" | "ai_assisted" | "abandoned" | "escalated";
  execution_result?: ExecutionResult;
  follow_up_required?: boolean;
  follow_up_task_id?: string | null;
  review_notes?: string;
}

export interface ExecutionResult {
  type: ExecutionType;
  details?: string;
  command?: string;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
}

export interface Metadata {
  tags?: string[];
  domain?: Domain;
  complexity?: Complexity;
  session_duration_sec?: number;
  message_count?: number;
  total_tool_calls?: number;
  has_code_output?: boolean;
  has_tool_usage?: boolean;
  has_thinking_block?: boolean;
  has_user_modification?: boolean;
  languages?: string[];
  training_ready?: boolean;
  estimated_tokens?: number;
}

// Decision
export interface Decision {
  final_session_id: string;
  final_change_ids: string[];
  selection_reason?: string;
  decision_type: DecisionType;
  decision_timestamp: string;
  decision_actor: DecisionActor;
  auto_score_at_decision?: number;
  overridden?: boolean;
  override_reason?: string | null;
}

// Enterprise
export interface Privacy {
  paths_masked?: boolean;
  sensitive_content_detected?: boolean;
  excluded_patterns?: string[];
  retention_policy?: RetentionPolicy;
  data_owner?: DataOwner;
  encryption_at_rest?: boolean;
  data_classification?: DataClassification;
}

export interface Governance {
  collected_by?: string;
  collection_time?: string;
  user_consent?: UserConsent;
  team_id?: string | null;
  project_id?: string | null;
  data_steward?: string;
  audit_log?: AuditEvent[];
}

export interface AuditEvent {
  action: string;
  timestamp: string;
  actor: AuditActor;
  source_file?: string;
  format?: string;
  exported_by?: string;
  destination?: string;
  fields_removed?: string[];
}
```

### 8.2 Python SDK（Pydantic v2，含 Decision 层）

```python
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime

# Enums
VibeApp = Literal["vscode", "cursor", "trae", "jetbrains", "terminal", "unknown"]
CaptureMode = Literal["auto_scan", "manual_paste", "clipboard", "own_chat_panel", "import", "proxy", "api"]
AiTool = Literal["github-copilot", "claude-code", "codex", "kimi-code", "cursor-chat", "trae-chat", "custom"]
TaskType = Literal["feature", "bugfix", "refactor", "test", "doc", "config", "debug", "explain", "review", "chore", "unknown"]
FileRole = Literal["target", "dependency", "reference", "test", "config", "unknown"]
ToolType = Literal["file_read", "file_write", "file_edit", "bash", "lsp_query", "search", "custom"]
ChangeType = Literal["add", "modify", "delete", "rename"]
DiffFormat = Literal["unified", "git-diff", "json-patch"]
OutcomeStatus = Literal["draft", "in_progress", "completed", "abandoned", "blocked"]
ExecutionType = Literal["test_passed", "test_failed", "runtime_error", "lint_error", "type_error", "build_error", "no_execution", "skipped"]
Domain = Literal["frontend", "backend", "devops", "mobile", "ai/ml", "data", "infra", "unknown"]
Complexity = Literal["simple", "medium", "complex", "architecture"]
RetentionPolicy = Literal["keep_forever", "auto_purge_30d", "auto_purge_90d"]
DataOwner = Literal["user_local", "team_shared", "enterprise"]
DataClassification = Literal["public", "internal", "confidential", "restricted"]
UserConsent = Literal["explicit_opt_in", "implicit", "enterprise_policy", "none"]
AuditActor = Literal["system", "user", "admin", "policy"]
DecisionType = Literal["human_select", "auto_score", "test_result", "hybrid", "time_based"]
DecisionActor = Literal["user", "system", "reviewer", "ci_pipeline", "auto_grader"]

# Core
class ToolCall(BaseModel):
    id: str
    type: ToolType
    name: str
    arguments: Dict[str, Any]
    result: Optional[Any] = None

class Message(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    thinking: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None
    timestamp: str
    name: Optional[str] = None
    tool_call_id: Optional[str] = None

class Session(BaseModel):
    session_id: str
    ai_tool: str
    model: Optional[str] = None
    created_at: str
    ended_at: Optional[str] = None
    user_feedback: Optional[Literal["accept", "reject", "modify", "partial"]] = None
    conversation: List[Message]

class Source(BaseModel):
    app: VibeApp
    extension: Optional[str] = None
    extension_version: Optional[str] = None
    capture_mode: CaptureMode
    ai_tool: AiTool
    model: Optional[str] = None
    model_version: Optional[str] = None
    os: Optional[str] = None
    shell: Optional[str] = None

class TaskIntent(BaseModel):
    type: Optional[TaskType] = None
    intent: str
    parent_task_id: Optional[str] = None
    related_tasks: Optional[List[str]] = None

# Extended
class ActiveFile(BaseModel):
    path: str
    language: str
    cursor_position: Optional[Dict[str, int]] = None
    selected_text: Optional[str] = None
    viewport_range: Optional[Dict[str, int]] = None

class FileNode(BaseModel):
    path: str
    language: str
    role: FileRole

class GitState(BaseModel):
    branch: Optional[str] = None
    last_commit: Optional[str] = None
    dirty_files: Optional[List[str]] = None

class Environment(BaseModel):
    node_version: Optional[str] = None
    package_manager: Optional[str] = None

class CodeContext(BaseModel):
    workspace_root: Optional[str] = None
    active_file: Optional[ActiveFile] = None
    file_tree: Optional[List[FileNode]] = None
    git_state: Optional[GitState] = None
    dependencies: Optional[Dict[str, str]] = None
    environment: Optional[Environment] = None

class CodeChange(BaseModel):
    change_id: str
    file_path: str
    language: str
    role: FileRole
    diff_format: DiffFormat
    patch: str
    before_hash: Optional[str] = None
    after_hash: Optional[str] = None
    change_type: ChangeType
    ai_generated: bool
    user_modified: bool
    user_edit_reason: Optional[str] = None
    test_coverage: Optional[Dict[str, int]] = None
    source_session_id: Optional[str] = None
    source_tool_call_id: Optional[str] = None
    source_message_id: Optional[str] = None

class ExecutionResult(BaseModel):
    type: ExecutionType
    details: Optional[str] = None
    command: Optional[str] = None
    exit_code: Optional[int] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None

class Outcome(BaseModel):
    status: OutcomeStatus
    user_feedback: Optional[Literal["accept", "reject", "modify", "partial"]] = None
    quality_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    resolution_type: Optional[Literal["ai_solved", "user_solved", "ai_assisted", "abandoned", "escalated"]] = None
    execution_result: Optional[ExecutionResult] = None
    follow_up_required: Optional[bool] = None
    follow_up_task_id: Optional[str] = None
    review_notes: Optional[str] = None

class Metadata(BaseModel):
    tags: Optional[List[str]] = None
    domain: Optional[Domain] = None
    complexity: Optional[Complexity] = None
    session_duration_sec: Optional[int] = None
    message_count: Optional[int] = None
    total_tool_calls: Optional[int] = None
    has_code_output: Optional[bool] = None
    has_tool_usage: Optional[bool] = None
    has_thinking_block: Optional[bool] = None
    has_user_modification: Optional[bool] = None
    languages: Optional[List[str]] = None
    training_ready: Optional[bool] = None
    estimated_tokens: Optional[int] = None

# Decision
class Decision(BaseModel):
    final_session_id: str
    final_change_ids: List[str]
    selection_reason: Optional[str] = None
    decision_type: DecisionType
    decision_timestamp: str
    decision_actor: DecisionActor
    auto_score_at_decision: Optional[float] = Field(None, ge=0.0, le=1.0)
    overridden: Optional[bool] = None
    override_reason: Optional[str] = None

# Enterprise
class Privacy(BaseModel):
    paths_masked: Optional[bool] = None
    sensitive_content_detected: Optional[bool] = None
    excluded_patterns: Optional[List[str]] = None
    retention_policy: Optional[RetentionPolicy] = None
    data_owner: Optional[DataOwner] = None
    encryption_at_rest: Optional[bool] = None
    data_classification: Optional[DataClassification] = None

class AuditEvent(BaseModel):
    action: str
    timestamp: str
    actor: AuditActor
    source_file: Optional[str] = None
    format: Optional[str] = None
    exported_by: Optional[str] = None
    destination: Optional[str] = None
    fields_removed: Optional[List[str]] = None

class Governance(BaseModel):
    collected_by: Optional[str] = None
    collection_time: Optional[str] = None
    user_consent: Optional[UserConsent] = None
    team_id: Optional[str] = None
    project_id: Optional[str] = None
    data_steward: Optional[str] = None
    audit_log: Optional[List[AuditEvent]] = None

# Root
class VibeTask(BaseModel):
    schema: Literal["vibe-archive.task.v0.4.1"] = "vibe-archive.task.v0.4.1"
    id: str = Field(..., pattern=r"^[a-zA-Z0-9_-]+$")
    created_at: str
    updated_at: Optional[str] = None
    source: Source
    task: TaskIntent
    sessions: List[Session]
    context: Optional[CodeContext] = None
    changes: Optional[List[CodeChange]] = None
    decision: Optional[Decision] = None
    outcome: Optional[Outcome] = None
    metadata: Optional[Metadata] = None
    privacy: Optional[Privacy] = None
    governance: Optional[Governance] = None

    def get_final_session(self) -> Optional[Session]:
        if not self.decision:
            return None
        for s in self.sessions:
            if s.session_id == self.decision.final_session_id:
                return s
        return None

    def get_final_changes(self) -> List[CodeChange]:
        if not self.decision or not self.changes:
            return []
        final_ids = set(self.decision.final_change_ids)
        return [c for c in self.changes if c.change_id in final_ids]

    def to_openai_messages(self) -> Dict[str, Any]:
        messages = []
        final_session = self.get_final_session()
        if final_session:
            for msg in final_session.conversation:
                messages.append({"role": msg.role, "content": msg.content})
        return {"messages": messages, "metadata": self.metadata.model_dump() if self.metadata else {}}

    def to_dpo(self) -> Optional[Dict[str, Any]]:
        if not self.decision:
            return None
        chosen_session = self.get_final_session()
        rejected_sessions = [s for s in self.sessions if s.session_id != self.decision.final_session_id]
        if not chosen_session:
            return None
        chosen = "\n\n".join(m.content for m in chosen_session.conversation if m.role == "assistant")
        rejected = None
        if rejected_sessions:
            rejected = "\n\n".join(m.content for m in rejected_sessions[0].conversation if m.role == "assistant")
        return {
            "prompt": self.task.intent,
            "chosen": chosen,
            "rejected": rejected,
            "context": {
                "source": self.source.ai_tool,
                "domain": self.metadata.domain if self.metadata else None,
                "languages": self.metadata.languages if self.metadata else None
            }
        }
```

---

## 9. Export Profiles 接口定义

Vibe Archive v0.4.1 作为**中间数据标准**，通过标准化脚本导出为多种下游训练格式。

**Export Profiles 已从主规范剥离，具体转换器实现见 `Profile/` 目录下的独立规范文件。**

主规范仅保留接口定义和映射概览：

| Profile | 目标场景 | 核心映射逻辑 | 必需字段 | 规范文件 |
|---------|---------|-------------|---------|---------|
| **SFT-Messages** | 通用指令微调（LLaMA-Factory, Unsloth, Axolotl） | `decision.final_session_id` 对应的 session 的 conversation 扁平化为 `messages[]` | `decision`, `sessions` | `Profile/sft-messages.md` |
| **Alpaca** | 单轮代码指令微调 | `task.intent` -> `instruction`；首条 user message -> `input`；最终 accepted assistant 回复 -> `output` | `task.intent`, `decision` | `Profile/alpaca.md` |
| **ShareGPT** | 社区开源生态（Vicuna, WizardLM） | 最终 session 的消息映射为 `conversations[]` | `decision`, `sessions` | `Profile/sharegpt.md` |
| **DPO** | 偏好对齐（Direct Preference Optimization） | `decision.final_session_id` 为 `chosen`；其他 session 为 `rejected`；`task.intent` 为 `prompt` | `task.intent`, `decision`, `sessions` | `Profile/dpo.md` |
| **Diff-Edit** | 代码编辑模型（Codex, AlphaCodium, CodeT5） | 提取 `decision.final_change_ids` 对应的 changes，构建 `instruction + before_code -> after_code` | `decision`, `changes` | `Profile/diff-edit.md` |
| **Agent-Trajectory** | Agent 轨迹训练（OpenHands, Devin, SWE-agent） | 保留最终 session 的完整 `tool_calls` + `thinking` 链；`outcome.execution_result` 作为环境反馈 | `decision`, `sessions`, `outcome` | `Profile/agent-trajectory.md` |

---

## 10. 验证规则

### 10.1 结构验证（JSON Schema）
使用标准 JSON Schema validator（如 Ajv、jsonschema）进行基础校验。

```bash
npm install ajv
```

```js
import Ajv from "ajv";
import schema from "./schema.json";

const ajv = new Ajv({ strict: true });
const validate = ajv.compile(schema);

const valid = validate(data);
if (!valid) {
  console.error(validate.errors);
  process.exit(1);
}
```

### 10.2 语义验证规则

| 规则 ID | 名称 | 验证逻辑 | 错误级别 |
|---------|------|---------|---------|
| `VA-001` | `session_order` | `sessions` 必须按 `created_at` 升序排列；同一 `session` 内 `conversation` 必须按 `timestamp` 升序排列 | Error |
| `VA-002` | `final_session` | 若 `outcome.status == "completed"`，则必须存在至少一个 `user_feedback == "accept"` 的 session 或有效的 `decision` | Warning |
| `VA-003` | `diff_integrity` | 若提供 `before_hash` 与 `after_hash`，`patch` 必须可解析为合法 diff（语法检查） | Warning |
| `VA-004` | `tool_call_link` | `message.tool_calls[].id` 必须在同 session 后续 message 中有对应的 `tool_call_id` | Error |
| `VA-005` | `hash_format` | `before_hash` / `after_hash` 若存在，必须符合 `sha256:[a-f0-9]{64}` 格式 | Error |
| `VA-006` | `path_masking` | 若 `privacy.paths_masked == true`，所有 `file_path` / `workspace_root` 不得包含绝对用户目录 | Error |
| `VA-007` | `quality_score_range` | `outcome.quality_score` 若存在，必须在 `[0.0, 1.0]` 范围内 | Error |
| `VA-008` | `training_ready_gate` | 若 `metadata.training_ready == true`，则必须满足：`has_code_output == true` 且 `outcome.status == "completed"` 且 `message_count >= 2` | Warning |
| `VA-009` | `follow_up_link` | 若 `outcome.follow_up_required == true`，则 `follow_up_task_id` 必须非空且符合 ID 格式 | Error |
| `VA-010` | `enum_consistency` | 所有枚举字段值必须在规范定义的枚举集合内 | Error |
| `VA-011` | `decision_session_exists` | `decision.final_session_id` 必须存在于 `sessions[].session_id` 中 | Error |
| `VA-012` | `decision_changes_exist` | `decision.final_change_ids` 的每个 ID 必须存在于 `changes[].change_id` 中 | Error |
| `VA-013` | `change_source_session_exists` | `changes[].source_session_id` 若存在，必须匹配某个 `sessions[].session_id` | Error |
| `VA-014` | `change_source_tool_call_exists` | `changes[].source_tool_call_id` 若存在，必须在对应 session 的 conversation tool_calls 中找到 | Error |
| `VA-015` | `decision_timestamp_order` | `decision.decision_timestamp` 必须晚于所有 session 的 `ended_at`（或 `created_at`） | Error |

### 10.3 验证器实现参考（Python）

```python
from typing import List, Dict, Any
from datetime import datetime
import re

class VibeValidator:
    def __init__(self):
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []

    def validate(self, task: VibeTask) -> bool:
        self.errors.clear()
        self.warnings.clear()

        self._check_session_order(task)
        self._check_final_session(task)
        self._check_tool_call_links(task)
        self._check_hash_format(task)
        self._check_path_masking(task)
        self._check_quality_score(task)
        self._check_training_ready(task)
        self._check_follow_up_link(task)
        self._check_decision_session_exists(task)
        self._check_decision_changes_exist(task)
        self._check_change_source_session_exists(task)
        self._check_change_source_tool_call_exists(task)
        self._check_decision_timestamp_order(task)

        return len(self.errors) == 0

    def _check_session_order(self, task: VibeTask):
        timestamps = [s.created_at for s in task.sessions]
        if timestamps != sorted(timestamps):
            self.errors.append({"rule": "VA-001", "message": "Sessions are not time-ordered"})

        for session in task.sessions:
            msg_ts = [m.timestamp for m in session.conversation]
            if msg_ts != sorted(msg_ts):
                self.errors.append({"rule": "VA-001", "message": f"Session {session.session_id} messages are not time-ordered"})

    def _check_final_session(self, task: VibeTask):
        if task.outcome and task.outcome.status == "completed":
            has_accept = any(s.user_feedback == "accept" for s in task.sessions)
            has_decision = task.decision is not None
            if not has_accept and not has_decision:
                self.warnings.append({"rule": "VA-002", "message": "Completed task has no accepted session or decision"})

    def _check_tool_call_links(self, task: VibeTask):
        for session in task.sessions:
            tool_ids = set()
            for msg in session.conversation:
                if msg.tool_calls:
                    for tc in msg.tool_calls:
                        tool_ids.add(tc.id)
                if msg.role == "tool" and msg.tool_call_id:
                    if msg.tool_call_id not in tool_ids:
                        self.errors.append({"rule": "VA-004", "message": f"Orphan tool_call_id: {msg.tool_call_id}"})

    def _check_hash_format(self, task: VibeTask):
        if task.changes:
            for change in task.changes:
                for hash_field in [change.before_hash, change.after_hash]:
                    if hash_field and not re.match(r'^sha256:[a-f0-9]{64}$', hash_field):
                        self.errors.append({"rule": "VA-005", "message": f"Invalid hash format: {hash_field}"})

    def _check_path_masking(self, task: VibeTask):
        if task.privacy and task.privacy.paths_masked:
            abs_pattern = re.compile(r'^(?:/Users/|/home/|C:\\Users\\)')
            if task.context and task.context.workspace_root and abs_pattern.search(task.context.workspace_root):
                self.errors.append({"rule": "VA-006", "message": "workspace_root contains unmasked absolute path"})

    def _check_quality_score(self, task: VibeTask):
        if task.outcome and task.outcome.quality_score is not None:
            if not (0.0 <= task.outcome.quality_score <= 1.0):
                self.errors.append({"rule": "VA-007", "message": "quality_score out of range [0.0, 1.0]"})

    def _check_training_ready(self, task: VibeTask):
        if task.metadata and task.metadata.training_ready:
            checks = [
                task.metadata.has_code_output,
                task.outcome and task.outcome.status == "completed",
                task.metadata.message_count and task.metadata.message_count >= 2
            ]
            if not all(checks):
                self.warnings.append({"rule": "VA-008", "message": "training_ready=true but gate conditions not met"})

    def _check_follow_up_link(self, task: VibeTask):
        if task.outcome and task.outcome.follow_up_required:
            if not task.outcome.follow_up_task_id:
                self.errors.append({"rule": "VA-009", "message": "follow_up_required=true but follow_up_task_id is empty"})

    def _check_decision_session_exists(self, task: VibeTask):
        if task.decision:
            session_ids = {s.session_id for s in task.sessions}
            if task.decision.final_session_id not in session_ids:
                self.errors.append({"rule": "VA-011", "message": f"decision.final_session_id not found in sessions: {task.decision.final_session_id}"})

    def _check_decision_changes_exist(self, task: VibeTask):
        if task.decision and task.changes:
            change_ids = {c.change_id for c in task.changes}
            for cid in task.decision.final_change_ids:
                if cid not in change_ids:
                    self.errors.append({"rule": "VA-012", "message": f"decision.final_change_id not found in changes: {cid}"})

    def _check_change_source_session_exists(self, task: VibeTask):
        if task.changes:
            session_ids = {s.session_id for s in task.sessions}
            for change in task.changes:
                if change.source_session_id and change.source_session_id not in session_ids:
                    self.errors.append({"rule": "VA-013", "message": f"change.source_session_id not found: {change.source_session_id}"})

    def _check_change_source_tool_call_exists(self, task: VibeTask):
        if task.changes:
            for change in task.changes:
                if change.source_session_id and change.source_tool_call_id:
                    session = next((s for s in task.sessions if s.session_id == change.source_session_id), None)
                    if session:
                        tool_ids = set()
                        for msg in session.conversation:
                            if msg.tool_calls:
                                for tc in msg.tool_calls:
                                    tool_ids.add(tc.id)
                        if change.source_tool_call_id not in tool_ids:
                            self.errors.append({"rule": "VA-014", "message": f"change.source_tool_call_id not found in session: {change.source_tool_call_id}"})

    def _check_decision_timestamp_order(self, task: VibeTask):
        if task.decision:
            decision_ts = datetime.fromisoformat(task.decision.decision_timestamp.replace("Z", "+00:00"))
            for session in task.sessions:
                session_end = session.ended_at or session.created_at
                session_ts = datetime.fromisoformat(session_end.replace("Z", "+00:00"))
                if decision_ts < session_ts:
                    self.errors.append({"rule": "VA-015", "message": f"decision_timestamp earlier than session {session.session_id} end time"})
```

---

## 11. 完整示例

```json
{
  "$schema": "https://vibe-archive.dev/schema/task/v0.4.1.json",
  "schema": "vibe-archive.task.v0.4.1",
  "id": "task_01HZY8K2JQV8W4R9T1M3N5P7",
  "created_at": "2026-04-25T10:30:00Z",
  "updated_at": "2026-04-25T10:48:00Z",

  "source": {
    "app": "vscode",
    "extension": "vibe-archive",
    "extension_version": "0.2.1",
    "capture_mode": "auto_scan",
    "ai_tool": "claude-code",
    "model": "claude-3-7-sonnet",
    "model_version": "20250219",
    "os": "darwin",
    "shell": "zsh"
  },

  "task": {
    "type": "feature",
    "intent": "为搜索组件添加防抖功能，避免频繁请求 API",
    "parent_task_id": null,
    "related_tasks": []
  },

  "context": {
    "workspace_root": "{HOME}/projects/ecommerce-app",
    "active_file": {
      "path": "src/components/Search.tsx",
      "language": "typescriptreact",
      "cursor_position": {"line": 42, "character": 12},
      "selected_text": "const [query, setQuery] = useState('')",
      "viewport_range": {"start": 30, "end": 55}
    },
    "file_tree": [
      {"path": "src/components/Search.tsx", "language": "typescriptreact", "role": "target"},
      {"path": "src/hooks/useDebounce.ts", "language": "typescript", "role": "target"},
      {"path": "src/api/search.ts", "language": "typescript", "role": "dependency"},
      {"path": "package.json", "language": "json", "role": "config"}
    ],
    "git_state": {
      "branch": "feature/search-debounce",
      "last_commit": "a1b2c3d",
      "dirty_files": ["src/components/Search.tsx"]
    },
    "dependencies": {
      "react": "^18.2.0",
      "lodash": "^4.17.21"
    },
    "environment": {
      "node_version": "20.12.0",
      "package_manager": "pnpm"
    }
  },

  "sessions": [
    {
      "session_id": "sess_claude_abc123",
      "ai_tool": "claude-code",
      "model": "claude-3-7-sonnet",
      "created_at": "2026-04-25T10:30:00Z",
      "ended_at": "2026-04-25T10:35:00Z",
      "user_feedback": "partial",
      "conversation": [
        {
          "role": "user",
          "content": "给 Search 组件加个防抖，300ms",
          "timestamp": "2026-04-25T10:30:00Z"
        },
        {
          "role": "assistant",
          "content": "我来为 Search 组件添加防抖功能。首先创建 `useDebounce` hook，然后在 Search 组件中引入使用。",
          "thinking": "用户需要在 Search 组件中添加防抖。当前组件使用了 useState 管理 query，每次输入都会触发重新渲染。我应该建议用 useRef + setTimeout 实现，避免闭包问题。",
          "tool_calls": [
            {
              "id": "call_001",
              "type": "file_write",
              "name": "write_file",
              "arguments": {
                "path": "src/hooks/useDebounce.ts",
                "content": "import { useState, useEffect } from 'react';\n\nexport function useDebounce<T>(value: T, delay: number): T {\n  const [debouncedValue, setDebouncedValue] = useState(value);\n  useEffect(() => {\n    const timer = setTimeout(() => setDebouncedValue(value), delay);\n    return () => clearTimeout(timer);\n  }, [value, delay]);\n  return debouncedValue;\n}"
              },
              "result": {"success": true, "path": "src/hooks/useDebounce.ts"}
            }
          ],
          "timestamp": "2026-04-25T10:30:08Z"
        },
        {
          "role": "user",
          "content": "用 useRef 而不是 useState 来实现，避免多余的 re-render",
          "timestamp": "2026-04-25T10:35:00Z"
        },
        {
          "role": "assistant",
          "content": "好的，改用 useRef 实现。这样可以避免组件在防抖期间不必要的 re-render。",
          "thinking": "用户指出 useState 会导致 re-render，这是正确的。改用 useRef + useCallback 组合更合适。",
          "tool_calls": [
            {
              "id": "call_002",
              "type": "file_write",
              "name": "write_file",
              "arguments": {
                "path": "src/hooks/useDebounce.ts",
                "content": "import { useRef, useCallback } from 'react';\n\nexport function useDebounce<T>(value: T, delay: number): T {\n  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();\n  const debouncedRef = useRef(value);\n  // ..."
              },
              "result": {"success": true, "path": "src/hooks/useDebounce.ts"}
            }
          ],
          "timestamp": "2026-04-25T10:35:12Z"
        }
      ]
    }
  ],

  "changes": [
    {
      "change_id": "chg_001",
      "file_path": "src/hooks/useDebounce.ts",
      "language": "typescript",
      "role": "target",
      "diff_format": "unified",
      "patch": "@@ -0,0 +1,18 @@\n+import { useRef, useCallback } from 'react';\n+\n+export function useDebounce<T>(value: T, delay: number): T {\n+  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();\n+  const debouncedRef = useRef(value);\n+\n+  useEffect(() => {\n+    timeoutRef.current = setTimeout(() => {\n+      debouncedRef.current = value;\n+    }, delay);\n+    return () => clearTimeout(timeoutRef.current);\n+  }, [value, delay]);\n+\n+  return debouncedRef.current;\n+}",
      "before_hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "after_hash": "sha256:7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730",
      "change_type": "add",
      "ai_generated": true,
      "user_modified": true,
      "user_edit_reason": "用户要求改用 useRef 替代 useState 以避免 re-render",
      "test_coverage": {"before": 0, "after": 4},
      "source_session_id": "sess_claude_abc123",
      "source_tool_call_id": "call_002",
      "source_message_id": "msg_004"
    },
    {
      "change_id": "chg_002",
      "file_path": "src/components/Search.tsx",
      "language": "typescriptreact",
      "role": "target",
      "diff_format": "unified",
      "patch": "@@ -1,5 +1,6 @@\n import { useState } from 'react';\n+import { useDebounce } from '../hooks/useDebounce';\n \n export function Search() {\n   const [query, setQuery] = useState('');\n+  const debouncedQuery = useDebounce(query, 300);\n   // ...",
      "change_type": "modify",
      "ai_generated": true,
      "user_modified": false,
      "source_session_id": "sess_claude_abc123",
      "source_tool_call_id": "call_002",
      "source_message_id": "msg_004"
    }
  ],

  "decision": {
    "final_session_id": "sess_claude_abc123",
    "final_change_ids": ["chg_001", "chg_002"],
    "selection_reason": "用户手动确认，且 4/4 单元测试通过",
    "decision_type": "human_select",
    "decision_timestamp": "2026-04-25T10:48:00Z",
    "decision_actor": "user",
    "auto_score_at_decision": 0.91,
    "overridden": false,
    "override_reason": null
  },

  "outcome": {
    "status": "completed",
    "user_feedback": "accept",
    "quality_score": 0.91,
    "resolution_type": "ai_assisted",
    "execution_result": {
      "type": "test_passed",
      "details": "useDebounce hook: 4/4 tests passed",
      "command": "pnpm test useDebounce",
      "exit_code": 0,
      "stdout": "PASS src/hooks/useDebounce.test.ts\n  useDebounce\n    ✓ should delay value update (45ms)\n    ✓ should cancel timeout on unmount (12ms)\n    ✓ should handle rapid changes (23ms)\n    ✓ should use useRef internally (8ms)",
      "stderr": ""
    },
    "follow_up_required": false,
    "follow_up_task_id": null,
    "review_notes": ""
  },

  "metadata": {
    "tags": ["react", "hooks", "debounce", "performance", "typescript", "useRef"],
    "domain": "frontend",
    "complexity": "simple",
    "session_duration_sec": 480,
    "message_count": 4,
    "total_tool_calls": 2,
    "has_code_output": true,
    "has_tool_usage": true,
    "has_thinking_block": true,
    "has_user_modification": true,
    "languages": ["typescript", "typescriptreact"],
    "training_ready": true,
    "estimated_tokens": 2400
  },

  "privacy": {
    "paths_masked": true,
    "sensitive_content_detected": false,
    "excluded_patterns": ["**/.env*", "**/secrets.*", "**/*.key"],
    "retention_policy": "keep_forever",
    "data_owner": "user_local",
    "encryption_at_rest": false,
    "data_classification": "internal"
  },

  "governance": {
    "collected_by": "vibe-archive-vscode-ext@0.2.1",
    "collection_time": "2026-04-25T10:30:00Z",
    "user_consent": "explicit_opt_in",
    "team_id": null,
    "project_id": "ecommerce-app",
    "data_steward": "dev-team-lead@company.com",
    "audit_log": [
      {
        "action": "auto_scan",
        "timestamp": "2026-04-25T10:30:00Z",
        "actor": "system",
        "source_file": "~/.claude/projects/abc/sess.jsonl"
      },
      {
        "action": "export_training_data",
        "timestamp": "2026-04-25T11:00:00Z",
        "actor": "user",
        "format": "dpo",
        "exported_by": "user",
        "destination": "local_disk"
      }
    ]
  }
}
```

---

## 12. 版本与迁移

### 12.1 版本策略

- **主版本号** (`v1.x`, `v2.x`)：破坏性变更，不向后兼容
- **次版本号** (`v0.4.1`)：新增字段，向后兼容（v0.1/v0.2/v0.4 数据可通过迁移脚本升级）
- **修订号** (`v0.4.2`)：文档修正、Schema 描述更新、枚举值扩展

### 12.2 迁移路径

| 从版本 | 迁移方式 | 关键变更 |
|--------|---------|---------|
| v0.1 | 自动升级脚本 | `conversation` -> `sessions[0].conversation`；新增 `context` / `changes` / `decision` / `privacy` / `governance` |
| v0.2 | 自动升级脚本 | 需补 `changes[].change_id`（自动生成）；`decision` 对象需从 `outcome` 推断生成 |
| v0.4 | 自动升级脚本 | 新增 `decision` 层；`changes` 增加 `change_id` / `source_session_id` / `source_tool_call_id`；`governance` 增加 `audit_log` |

### 12.3 向前兼容承诺

- v0.4.1 解析器必须**忽略未知字段**（Forward Compatible）
- v0.4.1 序列化器必须**保留未知字段**（Round-trip Safe）
- 任何新增必填字段的提案必须进入 **v1.0 讨论**，不得在 v0.x 中引入破坏性变更

---

*文档结束 - Vibe Archive Data Standard v0.4.1*  
*规范地址: https://vibe-archive.dev/schema/task/v0.4.1.json*
