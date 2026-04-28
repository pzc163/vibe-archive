# Export Profile: ShareGPT

> **Profile ID**: `sharegpt`  
> **Profile Version**: `sharegpt@1.0.0`  
> **目标格式**: ShareGPT Conversation Format  
> **适用场景**: 社区开源模型训练（Vicuna, WizardLM, Koala）  
> **主规范版本**: `vibe-archive.task.v0.4.1+`  
> **状态**: Stable  
> **最后更新**: 2026-04-25

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| `sharegpt@1.0.0` | 2026-04-25 | 初始版本，支持 Decision 层驱动的 final_session 提取 |

---

## 1. 输出格式

```json
{
  "id": "task_01HZY...",
  "conversations": [
    {"from": "human", "value": "给 Search 组件加个防抖，300ms"},
    {"from": "gpt", "value": "我来为 Search 组件添加防抖功能..."},
    {"from": "human", "value": "用 useRef 而不是 useState"},
    {"from": "gpt", "value": "好的，改用 useRef 实现..."}
  ],
  "metadata": {
    "domain": "frontend",
    "languages": ["typescript"],
    "profile_version": "sharegpt@1.0.0"
  }
}
```

---

## 2. 映射规则

| Vibe Archive 字段 | ShareGPT 字段 | 转换逻辑 |
|--------------------|--------------|---------|
| `id` | `id` | 直接使用 Task ID |
| `decision.final_session_id` 的 conversation | `conversations[]` | 只提取被采纳的 session |
| `user` -> `human`, `assistant` -> `gpt` | `from` | 角色名转换 |
| `content` | `value` | 直接透传 |
| `system` | ❌ 丢弃或合并 | ShareGPT 通常无 system 角色 |
| **固定输出** | `metadata.profile_version` | 固定值 `sharegpt@1.0.0` |

---

## 3. 实现代码（Python）

```python
def export_sharegpt(task: VibeTask) -> dict:
    final_session = task.get_final_session()
    if not final_session:
        raise ValueError("No final session found")

    conversations = []
    for msg in final_session.conversation:
        if msg.role == "system":
            continue  # Skip system messages for ShareGPT
        role_map = {"user": "human", "assistant": "gpt", "tool": "gpt"}
        conversations.append({
            "from": role_map.get(msg.role, msg.role),
            "value": msg.content
        })

    return {
        "id": task.id,
        "conversations": conversations,
        "metadata": {
            "domain": task.metadata.domain if task.metadata else None,
            "languages": task.metadata.languages if task.metadata else None,
            "profile_version": "sharegpt@1.0.0"
        }
    }
```

---

## 4. 边界情况

| 情况 | 处理策略 |
|------|---------|
| `system` 消息 | 默认丢弃；若需保留可合并到首条 human message |
| `tool` 消息 | 映射为 `gpt` 角色，内容透传 |
| 无 `decision` | 回退到 `user_feedback=accept` 或最后一个 session |

---

## 5. 验证

输出文件应为标准 JSONL，每行一个 JSON 对象，符合 ShareGPT 格式规范。

---

## 6. 兼容性承诺

- `sharegpt@1.0.x` 只增加 metadata 字段，不修改 conversations 结构
- `sharegpt@2.0.0` 若修改核心结构，将提前 30 天在 RFC 中公示
