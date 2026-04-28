# RFC 0001: Decision Layer

> **RFC ID**: `0001-decision-layer`  
> **Status**: Accepted  
> **Author**: Vibe Archive Core Team  
> **Created**: 2026-04-25  
> **Target Version**: `vibe-archive.task.v0.4.1`  
> **Related RFCs**: 0002-change-trace  

---

## 1. 摘要

在 Vibe Archive 数据模型中引入显式的 **Decision 层**，用于记录多 Session 场景下的最终决策闭环，解决 DPO、Diff-Edit、Agent-Trajectory 等训练格式缺乏精确"正样本选择依据"的问题。

## 2. 动机

### 2.1 当前问题

v0.4 及之前的版本中，虽然支持 `sessions` 数组记录多次 AI 尝试，但**没有显式记录最终采纳了哪个 Session 的结果**。这导致：

- **DPO 导出模糊**：`chosen` 只能依赖 `user_feedback=accept` 推断，但用户可能接受后又修改
- **Diff-Edit 不精确**：无法确定哪些 Change 被最终采纳，哪些被废弃
- **Agent 训练缺失环境反馈**：没有明确的"最终动作选择"信号

### 2.2 真实场景

开发者对一个 Task 可能经历：
1. Copilot 生成初版（不满意）
2. Claude Code 生成第二版（部分满意，手动修改）
3. 手动调整代码（最终版）

没有 Decision 层，训练数据只能假设"最后一个 Session 就是对的"，这与事实不符。

## 3. 详细设计

### 3.1 新增字段

```json
{
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
  }
}
```

### 3.2 字段语义

| 字段 | 说明 |
|------|------|
| `final_session_id` | 最终被采纳的 Session ID |
| `final_change_ids` | 最终被采纳的 Change ID 列表 |
| `decision_type` | `human_select` / `auto_score` / `test_result` / `hybrid` / `time_based` |
| `decision_actor` | 谁做的决策：`user` / `system` / `reviewer` / `ci_pipeline` |
| `selection_reason` | 决策依据的自然语言描述 |
| `overridden` | 是否被后续覆盖（支持决策回溯） |

### 3.3 与 Outcome 的关系

- `outcome` = **任务最终结果**（测试是否通过、质量评分）
- `decision` = **选择过程**（从多个 Session 中选了哪个、为什么选）

两者互补，不可互相替代。

### 3.4 验证规则

新增 3 条验证规则：

| 规则 ID | 验证内容 |
|---------|---------|
| `VA-011` | `decision.final_session_id` 必须存在于 `sessions[]` |
| `VA-012` | `decision.final_change_ids` 必须存在于 `changes[]` |
| `VA-015` | `decision.decision_timestamp` 必须晚于所有 Session 结束时间 |

## 4. 替代方案

| 方案 | 否决原因 |
|------|---------|
| 用 `outcome.user_feedback` 推断 | 无法处理"接受后修改"的复杂场景 |
| 在 `metadata` 中增加 `best_session_id` | 语义不够显式，且无法表达决策依据 |
| 每个 Session 增加 `is_final` 布尔值 | 破坏 Session 的对等性，且无法表达多 Change 选择 |

## 5. 实现参考

```python
class VibeTask:
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
```

## 6. 讨论记录

| 日期 | 参与者 | 观点 |
|------|--------|------|
| 2026-04-25 | @magicyang | 提出 Decision 层概念，解决多 Session 选择模糊问题 |
| 2026-04-25 | @core-team | 确认 `decision` 与 `outcome` 分离设计，避免职责混淆 |

## 7. 决议

- [x] **接受（Accept）** — 已合并入 v0.4.1
