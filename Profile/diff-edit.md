# Export Profile: Diff-Edit

> **Profile ID**: `diff-edit`  
> **Profile Version**: `diff-edit@1.0.0`  
> **目标格式**: Code Edit Pair (Before -> After)  
> **适用场景**: 代码编辑模型训练（Codex, AlphaCodium, CodeT5, CodeRL）  
> **主规范版本**: `vibe-archive.task.v0.4.1+`  
> **状态**: Stable  
> **最后更新**: 2026-04-25

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| `diff-edit@1.0.0` | 2026-04-25 | 初始版本，基于 Decision 层的 final_change_ids 精确提取 |

---

## 1. 输出格式

```json
{
  "instruction": "为搜索组件添加防抖功能，避免频繁请求 API",
  "input_prefix": "请修改以下代码，添加防抖功能：",
  "before_code": "import { useState } from 'react';\n\nexport function Search() {\n  const [query, setQuery] = useState('');\n  // ...\n}",
  "after_code": "import { useState } from 'react';\nimport { useDebounce } from '../hooks/useDebounce';\n\nexport function Search() {\n  const [query, setQuery] = useState('');\n  const debouncedQuery = useDebounce(query, 300);\n  // ...\n}",
  "metadata": {
    "task_id": "task_01HZY...",
    "change_id": "chg_002",
    "language": "typescriptreact",
    "source_session_id": "sess_claude_abc123",
    "source_tool_call_id": "call_002",
    "profile_version": "diff-edit@1.0.0"
  }
}
```

---

## 2. 映射规则

| Vibe Archive 字段 | Diff-Edit 字段 | 转换逻辑 |
|--------------------|---------------|---------|
| `task.intent` | `instruction` | 编辑指令 |
| `changes[].patch` | `before_code` / `after_code` | 解析 unified diff 为 before/after |
| `changes[].change_id` | `metadata.change_id` | 溯源 |
| `changes[].source_session_id` | `metadata.source_session_id` | 溯源 |
| `changes[].source_tool_call_id` | `metadata.source_tool_call_id` | 溯源 |
| `changes[].language` | `metadata.language` | 语言标识 |
| **固定输出** | `metadata.profile_version` | 固定值 `diff-edit@1.0.0` |

---

## 3. 实现代码（Python）

```python
import re
from typing import Optional, Tuple

def parse_unified_diff(patch: str) -> Tuple[str, str]:
    """Parse unified diff into before_code and after_code"""
    before_lines = []
    after_lines = []

    for line in patch.split("\n"):
        if line.startswith("+") and not line.startswith("+++"):
            after_lines.append(line[1:])
        elif line.startswith("-") and not line.startswith("---"):
            before_lines.append(line[1:])
        elif not line.startswith("@") and not line.startswith("---") and not line.startswith("+++"):
            before_lines.append(line)
            after_lines.append(line)

    return "\n".join(before_lines), "\n".join(after_lines)

def export_diff_edit(task: VibeTask) -> List[dict]:
    if not task.decision or not task.changes:
        return []

    results = []
    final_changes = task.get_final_changes()

    for change in final_changes:
        if change.diff_format != "unified":
            continue  # Only support unified diff for now

        before_code, after_code = parse_unified_diff(change.patch)

        results.append({
            "instruction": task.task.intent,
            "input_prefix": f"请修改以下 {change.language} 代码：",
            "before_code": before_code,
            "after_code": after_code,
            "metadata": {
                "task_id": task.id,
                "change_id": change.change_id,
                "language": change.language,
                "source_session_id": change.source_session_id,
                "source_tool_call_id": change.source_tool_call_id,
                "ai_generated": change.ai_generated,
                "user_modified": change.user_modified,
                "profile_version": "diff-edit@1.0.0"
            }
        })

    return results
```

---

## 4. 边界情况

| 情况 | 处理策略 |
|------|---------|
| `diff_format` 不是 `unified` | 跳过或尝试转换 |
| `patch` 无法解析 | 跳过该 change，记录警告 |
| 文件为 `add` 类型（无 before） | `before_code` 为空字符串 |
| 文件为 `delete` 类型 | `after_code` 为空字符串 |
| 多文件修改 | 生成多条训练样本 |

---

## 5. 验证

- `before_code` 和 `after_code` 必须能通过标准 diff 库还原为原始 patch
- 建议保留原始 `patch` 在 metadata 中用于校验

---

## 6. 扩展：增量编辑

对于增量编辑模型（如 CodeLlama-Instruct），可添加 `context_code` 字段：

```json
{
  "instruction": "...",
  "context_code": "// 文件其余部分...",
  "before_code": "...",
  "after_code": "...",
  "metadata": {
    "profile_version": "diff-edit@1.0.0"
  }
}
```

---

## 7. 兼容性承诺

- `diff-edit@1.0.x` 只增加 metadata 字段，不修改 before/after 结构
- `diff-edit@2.0.0` 若修改核心结构，将提前 30 天在 RFC 中公示
