# Export Profile: Alpaca

> **Profile ID**: `alpaca`  
> **Profile Version**: `alpaca@1.0.0`  
> **目标格式**: Alpaca / Code-Alpaca Instruction Format  
> **适用场景**: 单轮代码指令微调（简单函数生成、LeetCode 题解）  
> **主规范版本**: `vibe-archive.task.v0.4.1+`  
> **状态**: Stable  
> **最后更新**: 2026-04-25

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| `alpaca@1.0.0` | 2026-04-25 | 初始版本，支持 Decision 层驱动的 final_session 提取 |

---

## 1. 输出格式

```json
{
  "instruction": "为 React 搜索组件添加防抖功能",
  "input": "给 Search 组件加个防抖，300ms",
  "output": "```typescript\nexport function useDebounce(...) {}\n```",
  "metadata": {
    "task_id": "task_01HZY...",
    "domain": "frontend",
    "profile_version": "alpaca@1.0.0"
  }
}
```

---

## 2. 映射规则

| Vibe Archive 字段 | Alpaca 字段 | 转换逻辑 |
|--------------------|------------|---------|
| `task.intent` | `instruction` | 直接使用 |
| `decision.final_session_id` 对应的首条 user message | `input` | 用户原始请求 |
| `decision.final_session_id` 对应的最终 assistant message | `output` | AI 最终回复（含代码块） |
| `metadata.domain` | `metadata.domain` | 透传 |
| `metadata.complexity` | `metadata.complexity` | 透传 |
| **固定输出** | `metadata.profile_version` | 固定值 `alpaca@1.0.0` |

---

## 3. 实现代码（Python）

```python
def export_alpaca(task: VibeTask) -> dict:
    final_session = task.get_final_session()
    if not final_session:
        raise ValueError("No final session found")

    user_msgs = [m for m in final_session.conversation if m.role == "user"]
    assistant_msgs = [m for m in final_session.conversation if m.role == "assistant"]

    if not user_msgs or not assistant_msgs:
        raise ValueError("Missing user or assistant messages")

    return {
        "instruction": task.task.intent,
        "input": user_msgs[0].content,
        "output": assistant_msgs[-1].content,
        "metadata": {
            "task_id": task.id,
            "domain": task.metadata.domain if task.metadata else None,
            "complexity": task.metadata.complexity if task.metadata else None,
            "profile_version": "alpaca@1.0.0"
        }
    }
```

---

## 4. 边界情况

| 情况 | 处理策略 |
|------|---------|
| 多轮对话 | 只取首条 user 和最后一条 assistant，忽略中间轮次 |
| 无 `decision` | 回退到 `user_feedback=accept` 或最后一个 session |
| Assistant 回复包含 tool_calls | 提取 `content` 字段，忽略 tool 调用细节 |

---

## 5. 验证

输出文件应为标准 JSONL，每行一个 JSON 对象，符合 Alpaca 数据集格式。

---

## 6. 兼容性承诺

- `alpaca@1.0.x` 只增加 metadata 字段，不修改 instruction/input/output 结构
- `alpaca@2.0.0` 若修改核心结构，将提前 30 天在 RFC 中公示
