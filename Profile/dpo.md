# Export Profile: DPO

> **Profile ID**: `dpo`  
> **Profile Version**: `dpo@1.0.0`  
> **目标格式**: Direct Preference Optimization (DPO)  
> **适用场景**: 偏好对齐训练、RLHF 替代方案  
> **主规范版本**: `vibe-archive.task.v0.4.1+`  
> **状态**: Stable  
> **最后更新**: 2026-04-25

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| `dpo@1.0.0` | 2026-04-25 | 初始版本，基于 Decision 层精确构建 chosen/rejected 对 |

---

## 1. 输出格式

```json
{
  "prompt": "为搜索组件添加防抖功能，避免频繁请求 API",
  "chosen": "好的，改用 useRef 实现。这样可以避免组件在防抖期间不必要的 re-render。",
  "rejected": "我来为 Search 组件添加防抖功能。首先创建 useDebounce hook...（useState 版本）",
  "context": {
    "source": "claude-code",
    "domain": "frontend",
    "languages": ["typescript"],
    "has_user_modification": true,
    "decision_type": "human_select",
    "profile_version": "dpo@1.0.0"
  }
}
```

---

## 2. 映射规则

| Vibe Archive 字段 | DPO 字段 | 转换逻辑 |
|--------------------|---------|---------|
| `task.intent` | `prompt` | 作为输入指令 |
| `decision.final_session_id` 的 assistant 回复 | `chosen` | 被采纳的方案 |
| 其他 session 的 assistant 回复（首选 rejected） | `rejected` | 被拒绝的方案 |
| `source.ai_tool` | `context.source` | 透传 |
| `metadata.domain` | `context.domain` | 透传 |
| `metadata.has_user_modification` | `context.has_user_modification` | 透传 |
| `decision.decision_type` | `context.decision_type` | 透传 |
| **固定输出** | `context.profile_version` | 固定值 `dpo@1.0.0` |

---

## 3. 实现代码（Python）

```python
def export_dpo(task: VibeTask) -> Optional[dict]:
    if not task.decision:
        # Fallback: use user_feedback if no explicit decision
        accepted = [s for s in task.sessions if s.user_feedback == "accept"]
        rejected = [s for s in task.sessions if s.user_feedback in ("reject", "modify", "partial")]
        if not accepted:
            return None
        chosen_session = accepted[0]
        rejected_session = rejected[0] if rejected else None
    else:
        chosen_session = task.get_final_session()
        rejected_sessions = [s for s in task.sessions if s.session_id != task.decision.final_session_id]
        rejected_session = rejected_sessions[0] if rejected_sessions else None

    if not chosen_session:
        return None

    chosen = "\n\n".join(m.content for m in chosen_session.conversation if m.role == "assistant")
    rejected = None
    if rejected_session:
        rejected = "\n\n".join(m.content for m in rejected_session.conversation if m.role == "assistant")

    return {
        "prompt": task.task.intent,
        "chosen": chosen,
        "rejected": rejected,
        "context": {
            "source": task.source.ai_tool,
            "domain": task.metadata.domain if task.metadata else None,
            "languages": task.metadata.languages if task.metadata else None,
            "has_user_modification": task.metadata.has_user_modification if task.metadata else None,
            "decision_type": task.decision.decision_type if task.decision else None,
            "profile_version": "dpo@1.0.0"
        }
    }
```

---

## 4. 边界情况

| 情况 | 处理策略 |
|------|---------|
| 无 `decision` 且只有一个 session | 无法构建 DPO 对，跳过该 Task |
| 无 rejected session | `rejected` 为 `null`，该样本仅用于 SFT |
| 多个 rejected sessions | 取第一个，或取 quality_score 最低的 |
| `chosen` 为空 | 跳过该 Task |

---

## 5. 验证

- `chosen` 和 `rejected` 必须来自同一 `prompt`
- `chosen` 不能为空字符串
- 建议 `chosen` 与 `rejected` 长度差异不超过 50%

---

## 6. 扩展：多偏好对

若一个 Task 有多个 rejected sessions，可生成多个 DPO 样本：

```python
dpo_samples = []
for rejected in rejected_sessions:
    dpo_samples.append({
        "prompt": task.task.intent,
        "chosen": chosen,
        "rejected": extract_assistant_text(rejected),
        "context": {
            "profile_version": "dpo@1.0.0"
        }
    })
```

---

## 7. 兼容性承诺

- `dpo@1.0.x` 只增加 context 字段，不修改 prompt/chosen/rejected 结构
- `dpo@2.0.0` 若修改核心结构，将提前 30 天在 RFC 中公示
