# Export Profile: Agent-Trajectory

> **Profile ID**: `agent-trajectory`  
> **Profile Version**: `agent-trajectory@1.0.0`  
> **目标格式**: Agent Trajectory with Tool Calls and Environment Feedback  
> **适用场景**: Agent 模型训练（OpenHands, Devin, SWE-agent, AutoGPT）  
> **主规范版本**: `vibe-archive.task.v0.4.1+`  
> **状态**: Stable  
> **最后更新**: 2026-04-25

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| `agent-trajectory@1.0.0` | 2026-04-25 | 初始版本，基于 Decision 层保留完整工具调用轨迹 |

---

## 1. 输出格式

```json
{
  "trajectory": [
    {
      "step": 0,
      "role": "user",
      "content": "给 Search 组件加个防抖，300ms",
      "timestamp": "2026-04-25T10:30:00Z"
    },
    {
      "step": 1,
      "role": "assistant",
      "content": "我来为 Search 组件添加防抖功能...",
      "thinking": "用户需要在 Search 组件中添加防抖...",
      "actions": [
        {
          "type": "file_write",
          "name": "write_file",
          "arguments": {"path": "src/hooks/useDebounce.ts", "content": "..."},
          "result": {"success": true}
        }
      ],
      "timestamp": "2026-04-25T10:30:08Z"
    }
  ],
  "outcome": {
    "success": true,
    "test_result": "4/4 passed",
    "exit_code": 0
  },
  "reward": 1.0,
  "metadata": {
    "task_id": "task_01HZY...",
    "total_steps": 4,
    "total_actions": 2,
    "has_user_correction": true,
    "profile_version": "agent-trajectory@1.0.0"
  }
}
```

---

## 2. 映射规则

| Vibe Archive 字段 | Agent Trajectory 字段 | 转换逻辑 |
|--------------------|----------------------|---------|
| `decision.final_session_id` 的 conversation | `trajectory[]` | 只提取被采纳的 session，保留完整结构 |
| `thinking` | `trajectory[].thinking` | 保留思维链 |
| `tool_calls` | `trajectory[].actions[]` | 保留工具调用及结果 |
| `outcome.execution_result` | `outcome` | 环境反馈（测试通过/失败） |
| `outcome.quality_score` | `reward` | 映射为奖励信号 |
| `metadata.has_user_modification` | `metadata.has_user_correction` | 是否有用户纠正 |
| **固定输出** | `metadata.profile_version` | 固定值 `agent-trajectory@1.0.0` |

---

## 3. 实现代码（Python）

```python
def export_agent_trajectory(task: VibeTask) -> dict:
    final_session = task.get_final_session()
    if not final_session:
        raise ValueError("No final session found")

    trajectory = []
    for i, msg in enumerate(final_session.conversation):
        step = {
            "step": i,
            "role": msg.role,
            "content": msg.content,
            "thinking": msg.thinking,
            "timestamp": msg.timestamp
        }
        if msg.tool_calls:
            step["actions"] = [
                {
                    "type": tc.type,
                    "name": tc.name,
                    "arguments": tc.arguments,
                    "result": tc.result
                }
                for tc in msg.tool_calls
            ]
        trajectory.append(step)

    # Calculate reward from outcome
    reward = 0.0
    if task.outcome:
        if task.outcome.execution_result and task.outcome.execution_result.type == "test_passed":
            reward = 1.0
        elif task.outcome.quality_score:
            reward = task.outcome.quality_score

    return {
        "trajectory": trajectory,
        "outcome": {
            "success": task.outcome.status == "completed" if task.outcome else False,
            "test_result": task.outcome.execution_result.details if task.outcome and task.outcome.execution_result else None,
            "exit_code": task.outcome.execution_result.exit_code if task.outcome and task.outcome.execution_result else None
        },
        "reward": reward,
        "metadata": {
            "task_id": task.id,
            "total_steps": len(trajectory),
            "total_actions": sum(1 for msg in final_session.conversation if msg.tool_calls),
            "has_user_correction": task.metadata.has_user_modification if task.metadata else False,
            "profile_version": "agent-trajectory@1.0.0"
        }
    }
```

---

## 4. 边界情况

| 情况 | 处理策略 |
|------|---------|
| 无 `decision` | 回退到 `user_feedback=accept` 或最后一个 session |
| 无 `tool_calls` | 生成纯对话轨迹（适用于 Chat-based Agent） |
| 无 `outcome.execution_result` | `reward` 回退到 `quality_score` 或默认 0.5 |
| 多 Session | 只保留最终采纳的 session 的轨迹 |

---

## 5. 验证

- `trajectory` 必须按时间顺序排列
- `actions` 中的 `result` 必须存在（用于环境反馈训练）
- `reward` 必须在 `[0.0, 1.0]` 范围内

---

## 6. 扩展：多尝试轨迹

对于需要学习"试错"的 Agent，可导出被拒绝 session 的轨迹作为负样本：

```python
# Positive trajectory
positive = export_agent_trajectory(task)

# Negative trajectory from rejected session
rejected = [s for s in task.sessions if s.session_id != task.decision.final_session_id]
if rejected:
    negative = export_agent_trajectory_from_session(rejected[0])
    negative["reward"] = -1.0  # Negative reward
```

---

## 7. 兼容性承诺

- `agent-trajectory@1.0.x` 只增加 metadata 字段，不修改 trajectory 结构
- `agent-trajectory@2.0.0` 若修改核心结构，将提前 30 天在 RFC 中公示
