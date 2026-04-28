# Vibe Archive Data Standard v0.2

> **Schema ID**: `vibe-archive.task.v0.2`  
> **发布日期**: 2026-04-25  
> **状态**: Draft → Candidate  
> **兼容版本**: `v0.1`（可通过迁移脚本升级）  
> **规范地址**: `https://vibe-archive.dev/schema/task/v0.2.json`

---

## 1. 概述

**Vibe Archive Data Standard v0.2** 是面向 AI Coding 场景的任务级中间数据标准。它将开发者与 AI 的协作过程结构化为**可复用、可检索、可训练**的数据资产。

### 1.1 核心定义

> **一条记录 ≠ 一条消息**  
> **一条记录 = 一次完整的 AI Coding Task**

一个 Task 包含：开发意图 → 代码上下文 → AI 交互（可能多轮、多工具） → 代码变更 → 执行验证 → 质量评价。

### 1.2 设计原则

1. **任务闭环**：记录从意图产生到代码落地/否决的完整生命周期
2. **多 Session 聚合**：支持同一 Task 下多次 AI 工具尝试（Copilot → Claude → 手动修改）
3. **上下文原生**：保留文件树、Git 状态、依赖版本，而不只是文本对话
4. **训练就绪**：原生兼容 OpenAI Messages / ShareGPT / Alpaca / DPO 等下游训练格式
5. **隐私内建**：路径脱敏、敏感内容检测、保留策略在 schema 层定义

---

## 2. 顶层结构

```json
{
  "$schema": "https://vibe-archive.dev/schema/task/v0.2.json",
  "schema": "vibe-archive.task.v0.2",
  "id": "task_01HZY8K2JQV8W4R9T1M3N5P7",
  "created_at": "2026-04-25T10:30:00Z",
  "updated_at": "2026-04-25T10:48:00Z",

  "source": { ... },
  "task": { ... },
  "context": { ... },
  "sessions": [ ... ],
  "changes": [ ... ],
  "outcome": { ... },
  "metadata": { ... },
  "privacy": { ... }
}
```

---

## 3. 字段定义

### 3.1 元信息字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `schema` | `string` | ✅ | 固定值 `vibe-archive.task.v0.2` |
| `id` | `string` (ULID/UUID) | ✅ | 全局唯一标识符 |
| `created_at` | `string` (ISO 8601) | ✅ | Task 首次创建时间 |
| `updated_at` | `string` (ISO 8601) | ✅ | 最后更新时间 |

---

### 3.2 `source` — 数据来源

记录数据是如何被捕获的，用于追溯和质量分析。

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
| `app` | `string` | ✅ | `vscode`, `cursor`, `trae`, `jetbrains`, `terminal` |
| `extension` | `string` | ✅ | 捕获插件名称 |
| `extension_version` | `string` | ❌ | 插件版本 |
| `capture_mode` | `string` | ✅ | `auto_scan`, `manual_paste`, `clipboard`, `own_chat_panel`, `import`, `proxy`, `api` |
| `ai_tool` | `string` | ✅ | `github-copilot`, `claude-code`, `codex`, `kimi-code`, `cursor-chat`, `trae-chat`, `custom` |
| `model` | `string` | ❌ | 模型标识，如 `claude-3-7-sonnet`, `gpt-4o` |
| `model_version` | `string` | ❌ | 模型具体版本号 |
| `os` | `string` | ❌ | `darwin`, `linux`, `win32` |
| `shell` | `string` | ❌ | `zsh`, `bash`, `fish`, `powershell`, `cmd` |

---

### 3.3 `task` — 任务意图

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
| `type` | `string` | ✅ | `feature`, `bugfix`, `refactor`, `test`, `doc`, `config`, `debug`, `explain`, `review`, `chore`, `unknown` |
| `intent` | `string` | ✅ | 开发者原始意图的自然语言描述 |
| `parent_task_id` | `string` | ❌ | 父任务 ID，支持子任务拆分 |
| `related_tasks` | `string[]` | ❌ | 关联任务 ID 数组 |

---

### 3.4 `context` — 代码上下文快照

捕获对话发生时的完整工程上下文。

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
    {
      "path": "src/components/Search.tsx",
      "language": "typescriptreact",
      "role": "target"
    },
    {
      "path": "src/hooks/useDebounce.ts",
      "language": "typescript",
      "role": "target"
    },
    {
      "path": "src/api/search.ts",
      "language": "typescript",
      "role": "dependency"
    }
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

#### `context` 字段表

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_root` | `string` | ✅ | 工作区根路径（已脱敏） |
| `active_file` | `object` | ❌ | 当前激活文件详情 |
| `active_file.path` | `string` | ✅ | 文件相对路径 |
| `active_file.language` | `string` | ✅ | VS Code Language ID |
| `active_file.cursor_position` | `object` | ❌ | `{line, character}` |
| `active_file.selected_text` | `string` | ❌ | 用户选中的代码片段 |
| `active_file.viewport_range` | `object` | ❌ | 屏幕可见区域 `{start, end}` |
| `file_tree` | `array` | ❌ | 相关文件列表 |
| `file_tree[].path` | `string` | ✅ | 文件路径 |
| `file_tree[].language` | `string` | ✅ | 语言标识 |
| `file_tree[].role` | `string` | ✅ | `target`, `dependency`, `reference`, `test`, `config`, `unknown` |
| `git_state` | `object` | ❌ | Git 状态快照 |
| `git_state.branch` | `string` | ❌ | 当前分支 |
| `git_state.last_commit` | `string` | ❌ | 最近 commit hash（前7位） |
| `git_state.dirty_files` | `string[]` | ❌ | 未提交文件列表 |
| `dependencies` | `object` | ❌ | 关键依赖版本映射 |
| `environment` | `object` | ❌ | 运行时环境信息 |

---

### 3.5 `sessions` — AI 交互会话数组

一个 Task 可由多个 Session 组成，记录开发者的多次尝试。

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
        "thinking": "用户需要在 Search 组件中添加防抖。当前组件使用了 useState 管理 query，每次输入都会触发重新渲染。我应该建议用 useRef + setTimeout 实现...",
        "tool_calls": [
          {
            "id": "call_001",
            "type": "file_write",
            "name": "write_file",
            "arguments": {
              "path": "src/hooks/useDebounce.ts",
              "content": "import { useState, useEffect } from 'react';..."
            },
            "result": {
              "success": true,
              "path": "src/hooks/useDebounce.ts"
            }
          }
        ],
        "timestamp": "2026-04-25T10:30:08Z"
      },
      {
        "role": "user",
        "content": "用 useRef 而不是 useState 来实现",
        "timestamp": "2026-04-25T10:35:00Z"
      },
      {
        "role": "assistant",
        "content": "好的，改用 useRef 实现...",
        "timestamp": "2026-04-25T10:35:12Z"
      }
    ]
  }
]
```

#### Session 字段表

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `session_id` | `string` | ✅ | 原始插件的 session 标识 |
| `ai_tool` | `string` | ✅ | 同 `source.ai_tool` |
| `model` | `string` | ❌ | 使用的模型 |
| `created_at` | `string` | ✅ | Session 开始时间 |
| `ended_at` | `string` | ❌ | Session 结束时间 |
| `user_feedback` | `string` | ❌ | `accept`, `reject`, `modify`, `partial` |
| `conversation` | `array` | ✅ | 消息数组 |

#### Message 字段表

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `role` | `string` | ✅ | `system`, `user`, `assistant`, `tool` |
| `content` | `string` | ✅ | 消息内容 |
| `thinking` | `string` | ❌ | AI 的思维链/推理过程（Claude thinking 块等） |
| `tool_calls` | `array` | ❌ | AI 调用的工具列表 |
| `timestamp` | `string` | ✅ | ISO 8601 |
| `name` | `string` | ❌ | `role=tool` 时的工具名称 |
| `tool_call_id` | `string` | ❌ | 关联 tool_call 的 ID |

#### Tool Call 字段表

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 工具调用唯一 ID |
| `type` | `string` | ✅ | `file_read`, `file_write`, `file_edit`, `bash`, `lsp_query`, `search`, `custom` |
| `name` | `string` | ✅ | 工具名称 |
| `arguments` | `object` | ✅ | 工具参数 |
| `result` | `any` | ❌ | 工具执行结果 |

---

### 3.6 `changes` — 代码变更记录

精确记录 Task 导致的代码 diff，是 Coding 数据的核心价值。

```json
[
  {
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
    "user_edit_reason": "改用 useRef 替代 useState",
    "test_coverage": {
      "before": 0,
      "after": 4
    }
  }
]
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file_path` | `string` | ✅ | 文件路径（脱敏后） |
| `language` | `string` | ✅ | 语言标识 |
| `role` | `string` | ✅ | `target`, `dependency`, `test`, `config` |
| `diff_format` | `string` | ✅ | `unified`, `git-diff`, `json-patch` |
| `patch` | `string` | ✅ | 标准 diff 文本 |
| `before_hash` | `string` | ❌ | 变更前文件 SHA256 |
| `after_hash` | `string` | ❌ | 变更后文件 SHA256 |
| `change_type` | `string` | ✅ | `add`, `modify`, `delete`, `rename` |
| `ai_generated` | `boolean` | ✅ | 是否由 AI 生成 |
| `user_modified` | `boolean` | ✅ | 用户是否在 AI 基础上修改 |
| `user_edit_reason` | `string` | ❌ | 用户修改原因（手动填写或推断） |
| `test_coverage` | `object` | ❌ | 测试覆盖变化 `{before, after}` |

---

### 3.7 `outcome` — 任务结果与质量评价

```json
{
  "status": "completed",
  "user_feedback": "accept",
  "quality_score": 0.91,
  "resolution_type": "ai_solved",
  "execution_result": {
    "type": "test_passed",
    "details": "useDebounce hook: 4/4 tests passed",
    "command": "npm test useDebounce",
    "exit_code": 0,
    "stdout": "...",
    "stderr": ""
  },
  "follow_up_required": false,
  "follow_up_task_id": null,
  "review_notes": ""
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `status` | `string` | ✅ | `draft`, `in_progress`, `completed`, `abandoned`, `blocked` |
| `user_feedback` | `string` | ❌ | `accept`, `reject`, `modify`, `partial` |
| `quality_score` | `number` | ❌ | 0.0 - 1.0，综合评分 |
| `resolution_type` | `string` | ❌ | `ai_solved`, `user_solved`, `ai_assisted`, `abandoned`, `escalated` |
| `execution_result` | `object` | ❌ | 代码执行验证结果 |
| `execution_result.type` | `string` | ✅ | `test_passed`, `test_failed`, `runtime_error`, `lint_error`, `type_error`, `build_error`, `no_execution`, `skipped` |
| `execution_result.details` | `string` | ❌ | 结果描述 |
| `execution_result.command` | `string` | ❌ | 执行的命令 |
| `execution_result.exit_code` | `integer` | ❌ | 退出码 |
| `follow_up_required` | `boolean` | ❌ | 是否需要后续 Task |
| `follow_up_task_id` | `string` | ❌ | 关联后续 Task ID |
| `review_notes` | `string` | ❌ | Code Review 备注 |

---

### 3.8 `metadata` — 检索与训练元数据

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

### 3.9 `privacy` — 隐私与脱敏标记

```json
{
  "paths_masked": true,
  "sensitive_content_detected": false,
  "excluded_patterns": ["**/.env*", "**/secrets.*", "**/*.key", "**/*.pem"],
  "retention_policy": "keep_forever",
  "data_owner": "user_local",
  "encryption_at_rest": false
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `paths_masked` | `boolean` | ✅ | 绝对路径是否已脱敏 |
| `sensitive_content_detected` | `boolean` | ✅ | 是否检测到敏感内容 |
| `excluded_patterns` | `string[]` | ❌ | 排除的文件模式 |
| `retention_policy` | `string` | ❌ | `keep_forever`, `auto_purge_30d`, `auto_purge_90d` |
| `data_owner` | `string` | ❌ | `user_local`, `team_shared`, `enterprise` |
| `encryption_at_rest` | `boolean` | ❌ | 是否静态加密 |

---

## 4. 完整 JSON Schema 定义

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://vibe-archive.dev/schema/task/v0.2.json",
  "title": "Vibe Archive Task Record v0.2",
  "type": "object",
  "required": ["schema", "id", "created_at", "updated_at", "source", "task", "sessions"],
  "properties": {
    "schema": {
      "type": "string",
      "const": "vibe-archive.task.v0.2",
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
      "required": ["type", "intent"],
      "properties": {
        "type": { "type": "string", "enum": ["feature", "bugfix", "refactor", "test", "doc", "config", "debug", "explain", "review", "chore", "unknown"] },
        "intent": { "type": "string", "minLength": 1 },
        "parent_task_id": { "type": ["string", "null"] },
        "related_tasks": { "type": "array", "items": { "type": "string" } }
      }
    },
    "context": {
      "type": "object",
      "required": ["workspace_root"],
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
        "required": ["file_path", "language", "role", "diff_format", "patch", "change_type", "ai_generated", "user_modified"],
        "properties": {
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
          }
        }
      }
    },
    "outcome": {
      "type": "object",
      "required": ["status"],
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
        "encryption_at_rest": { "type": "boolean" }
      }
    }
  }
}
```

---

## 5. 下游训练格式映射

Vibe Archive v0.2 作为**中间数据标准**，可通过标准化脚本导出为多种训练格式。

### 5.1 OpenAI Messages 格式（SFT 默认）

```python
def export_openai_messages(task):
    messages = []
    # 使用 task.intent 作为 system prompt 或首条 user message 的上下文
    for session in task["sessions"]:
        for msg in session["conversation"]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
    return {"messages": messages, "metadata": task["metadata"]}
```

### 5.2 ShareGPT 格式

```python
def export_sharegpt(task):
    conversations = []
    for session in task["sessions"]:
        for msg in session["conversation"]:
            conversations.append({
                "from": "human" if msg["role"] == "user" else "gpt" if msg["role"] == "assistant" else msg["role"],
                "value": msg["content"]
            })
    return {
        "id": task["id"],
        "conversations": conversations,
        "metadata": task["metadata"]
    }
```

### 5.3 Alpaca / Instruction 格式

适用于单轮代码指令微调：

```python
def export_alpaca(task):
    # 取第一个 user message 作为 instruction
    first_user = next(m for m in task["sessions"][0]["conversation"] if m["role"] == "user")
    first_assistant = next(m for m in task["sessions"][0]["conversation"] if m["role"] == "assistant")
    return {
        "instruction": task["task"]["intent"],
        "input": first_user["content"],
        "output": first_assistant["content"],
        "metadata": task["metadata"]
    }
```

### 5.4 DPO (Direct Preference Optimization) 格式

```python
def export_dpo(task):
    # 同一 Task 下，user_feedback=accept 的 session 为 chosen
    # user_feedback=reject/modify 或早期版本为 rejected
    sessions = task["sessions"]
    chosen_session = next(s for s in sessions if s.get("user_feedback") == "accept")
    rejected_session = next(s for s in sessions if s.get("user_feedback") in ["reject", "modify", "partial"], None)

    prompt = task["task"]["intent"]
    chosen = "\n\n".join(m["content"] for m in chosen_session["conversation"] if m["role"] == "assistant")
    rejected = "\n\n".join(m["content"] for m in rejected_session["conversation"] if m["role"] == "assistant") if rejected_session else None

    return {
        "prompt": prompt,
        "chosen": chosen,
        "rejected": rejected,
        "context": {
            "source": task["source"]["ai_tool"],
            "domain": task["metadata"]["domain"],
            "languages": task["metadata"]["languages"]
        }
    }
```

---

## 6. 存储结构规范

```
~/.vibe-archive/
├── config.json                 # 用户配置、插件版本、schema 版本
├── database/
│   └── vibe-archive.db         # SQLite 主数据库
├── backups/
│   ├── codex/
│   │   └── YYYY/MM/DD/*.jsonl
│   ├── claude-code/
│   │   └── {project-hash}/*.jsonl
│   └── kimi-code/
│       └── *.jsonl
├── exports/
│   ├── sharegpt/
│   │   └── YYYY-MM-DD_export.jsonl
│   ├── openai/
│   │   └── YYYY-MM-DD_export.jsonl
│   ├── dpo/
│   │   └── YYYY-MM-DD_export.jsonl
│   └── manifest.json           # 导出记录索引
└── schema/
    └── task.v0.2.json          # 本 Schema 文件本地副本
```

---

## 7. 版本与迁移

### 7.1 版本策略

- **主版本号** (`v1.x`, `v2.x`)：破坏性变更，不向后兼容
- **次版本号** (`v0.2`)：新增字段，向后兼容（v0.1 数据可通过迁移脚本升级）
- **修订号** (`v0.2.1`)：文档修正、Schema 描述更新

### 7.2 v0.1 → v0.2 迁移映射

| v0.1 字段 | v0.2 映射 | 说明 |
|-----------|-----------|------|
| `conversation` | `sessions[0].conversation` | 单 Session 迁移 |
| `context.active_file` | `context.active_file.path` | 结构扁平化 |
| `outcome.status` | `outcome.status` | 枚举值扩展 |
| `source.capture_mode` | `source.capture_mode` | 枚举值扩展 |
| — | `sessions[].thinking` | 新增 |
| — | `sessions[].tool_calls` | 新增 |
| — | `changes[].before_hash` | 新增 |
| — | `changes[].user_edit_reason` | 新增 |
| — | `outcome.execution_result` | 新增 |
| — | `metadata.training_ready` | 新增 |
| — | `privacy` | 新增对象 |

---

## 8. 示例：完整 Task 记录

```json
{
  "$schema": "https://vibe-archive.dev/schema/task/v0.2.json",
  "schema": "vibe-archive.task.v0.2",
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
      "test_coverage": {"before": 0, "after": 4}
    },
    {
      "file_path": "src/components/Search.tsx",
      "language": "typescriptreact",
      "role": "target",
      "diff_format": "unified",
      "patch": "@@ -1,5 +1,6 @@\n import { useState } from 'react';\n+import { useDebounce } from '../hooks/useDebounce';\n \n export function Search() {\n   const [query, setQuery] = useState('');\n+  const debouncedQuery = useDebounce(query, 300);\n   // ...",
      "change_type": "modify",
      "ai_generated": true,
      "user_modified": false
    }
  ],

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
    "encryption_at_rest": false
  }
}
```

---

*文档结束 — Vibe Archive Data Standard v0.2*
