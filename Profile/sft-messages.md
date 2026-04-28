# Export Profile: SFT-Messages

> **Profile ID**: `sft-messages`  
> **Profile Version**: `sft-messages@1.0.0`  
> **目标格式**: OpenAI Chat Completion / Messages Format  
> **适用场景**: 通用指令微调（LLaMA-Factory, Unsloth, Axolotl, Firefly）  
> **主规范版本**: `vibe-archive.task.v0.4.1+`  
> **状态**: Stable  
> **最后更新**: 2026-04-25

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| `sft-messages@1.0.0` | 2026-04-25 | 初始版本，支持 Decision 层驱动的 final_session 提取 |

---

## 1. 输出格式

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful coding assistant."},
    {"role": "user", "content": "给 Search 组件加个防抖，300ms"},
    {"role": "assistant", "content": "好的，我来添加防抖功能..."}
  ],
  "metadata": {
    "task_id": "task_01HZY...",
    "domain": "frontend",
    "languages": ["typescript"],
    "profile_version": "sft-messages@1.0.0"
  }
}
```

---

## 2. 映射规则

| Vibe Archive 字段 | Messages 字段 | 转换逻辑 |
|--------------------|--------------|---------|
| `decision.final_session_id` | `messages[]` 来源 | 只提取被采纳的 session 的 conversation |
| `task.intent` | 首条 `system` 或首条 `user` 前缀 | 作为 system prompt 或注入到首条 user message |
| `sessions[].conversation[].role` | `messages[].role` | 直接映射（`user/assistant/tool/system`） |
| `sessions[].conversation[].content` | `messages[].content` | 直接透传 |
| `sessions[].conversation[].thinking` | ❌ 丢弃 | 不进入 SFT 训练数据（可选保留在 metadata） |
| `sessions[].conversation[].tool_calls` | ❌ 丢弃 | 不进入 SFT 训练数据（可选保留在 metadata） |
| `metadata.domain` | `metadata.domain` | 透传 |
| `metadata.languages` | `metadata.languages` | 透传 |
| **固定输出** | `metadata.profile_version` | 固定值 `sft-messages@1.0.0` |

---

## 3. 实现代码（Python）

```python
def export_sft_messages(task: VibeTask) -> dict:
    messages = []

    # Optional system prompt from task intent
    if task.task.intent:
        messages.append({
            "role": "system",
            "content": f"You are assisting with a coding task: {task.task.intent}"
        })

    final_session = task.get_final_session()
    if not final_session:
        raise ValueError("No decision.final_session_id found")

    for msg in final_session.conversation:
        # Skip thinking blocks and tool calls for SFT
        messages.append({
            "role": msg.role,
            "content": msg.content
        })

    return {
        "messages": messages,
        "metadata": {
            "task_id": task.id,
            "domain": task.metadata.domain if task.metadata else None,
            "languages": task.metadata.languages if task.metadata else None,
            "source": task.source.ai_tool,
            "profile_version": "sft-messages@1.0.0"
        }
    }
```

---

## 4. 边界情况

| 情况 | 处理策略 |
|------|---------|
| 无 `decision` | 回退到 `user_feedback=accept` 的 session；若无则取最后一个 session |
| `tool` 角色消息 | 保留或丢弃取决于训练目标（建议保留用于 function calling 训练） |
| `thinking` 块 | 默认丢弃；若训练推理模型可配置保留为 `reasoning` 字段 |
| 多轮对话过长 | 按 `estimated_tokens` 截断或拆分为多条训练样本 |

---

## 5. 验证

输出文件应为标准 JSONL，每行一个 JSON 对象，符合 OpenAI Fine-Tuning API 格式要求。

---

## 6. 兼容性承诺

- `sft-messages@1.0.x` 只增加 metadata 字段，不修改 messages 结构
- `sft-messages@2.0.0` 若修改核心结构，将提前 30 天在 RFC 中公示
