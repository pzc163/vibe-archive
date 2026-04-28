# RFC 0002: Change Traceability

> **RFC ID**: `0002-change-trace`  
> **Status**: Accepted  
> **Author**: Vibe Archive Core Team  
> **Created**: 2026-04-25  
> **Target Version**: `vibe-archive.task.v0.4.1`  
> **Related RFCs**: 0001-decision-layer  

---

## 1. 摘要

为 `changes[]` 中的每条变更记录增加**精确溯源字段**（`change_id`, `source_session_id`, `source_tool_call_id`），使代码变更能够精确关联到产生它的 AI 交互上下文。

## 2. 动机

### 2.1 当前问题

v0.4 的 `changes[]` 只有 `patch` 和 `ai_generated` 标记，但：
- **不知道这条 Change 来自哪个 Session**（在多 Session 场景下无法追溯）
- **不知道来自哪个 Tool Call**（无法分析 AI 的哪种操作类型产生了有效代码）
- **无法做精细化训练**：Diff-Edit 模型需要知道"什么指令导致了什么变更"

### 2.2 训练场景需求

- **Diff-Edit 训练**：需要 `instruction + context → before → after`，必须知道 after 是哪个 tool_call 产生的
- **Agent 训练**：需要分析"哪些 tool call 类型（file_write vs file_edit）导致了成功的代码变更"
- **数据审计**：企业需要知道"这段代码是哪个 AI 在哪个时间生成的"

## 3. 详细设计

### 3.1 新增字段

```json
{
  "changes": [
    {
      "change_id": "chg_001",
      "source_session_id": "sess_claude_abc123",
      "source_tool_call_id": "call_002",
      "source_message_id": "msg_004",
      "file_path": "src/hooks/useDebounce.ts",
      "patch": "..."
    }
  ]
}
```

### 3.2 字段语义

| 字段 | 说明 |
|------|------|
| `change_id` | 变更唯一 ID（Task 内唯一） |
| `source_session_id` | 产生此变更的 Session ID |
| `source_tool_call_id` | 产生此变更的 Tool Call ID |
| `source_message_id` | 产生此变更的 Message ID（可选，用于更细粒度追溯） |

### 3.3 验证规则

新增 2 条验证规则：

| 规则 ID | 验证内容 |
|---------|---------|
| `VA-013` | `changes[].source_session_id` 必须匹配某个 `sessions[].session_id` |
| `VA-014` | `changes[].source_tool_call_id` 必须在对应 session 的 conversation 中找到 |

## 4. 替代方案

| 方案 | 否决原因 |
|------|---------|
| 只在 `metadata` 中记录统计信息 | 无法做单条变更的精确追溯 |
| 用数组索引（session[0].tool_calls[1]） | 不稳定，Session 顺序变化后失效 |
| 不记录 source，靠时间戳推断 | 多线程/并发场景下不可靠 |

## 5. 实现参考

```python
# 在 Parser 层自动关联
for session in task.sessions:
    for msg in session.conversation:
        if msg.tool_calls:
            for tc in msg.tool_calls:
                if tc.type in ("file_write", "file_edit"):
                    change = CodeChange(
                        change_id=f"chg_{uuid4().hex[:6]}",
                        source_session_id=session.session_id,
                        source_tool_call_id=tc.id,
                        source_message_id=msg.timestamp,  # 或 msg.id
                        file_path=tc.arguments.get("path"),
                        patch=generate_diff(tc.arguments.get("content"))
                    )
                    task.changes.append(change)
```

## 6. 讨论记录

| 日期 | 参与者 | 观点 |
|------|--------|------|
| 2026-04-25 | @magicyang | 提出 Change 溯源需求，用于 DPO 和 Diff-Edit 精确训练 |
| 2026-04-25 | @core-team | 确认 `change_id` 作为 Task 内唯一标识，支持 Decision 层的 `final_change_ids` 引用 |

## 7. 决议

- [x] **接受（Accept）** — 已合并入 v0.4.1
