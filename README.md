# Vibe Archive

> **当前工程状态**：项目已启动为 VS Code Extension + CLI 双入口 workspace。当前可运行切片位于 `packages/core`、`packages/cli` 与 `packages/extension`，支持 Codex JSONL 样例解析、Codex session 文件扫描、VibeTask 生成、SQLite Repository、SemanticValidator、ShareGPT 导出、Export Manifest v1.0 生成、CLI 校验与 VSIX 打包。下面的 Python 参考实现内容保留为标准落地参考，不再代表当前主工程目录。

## 当前可运行命令

```bash
npm run compile
npm run typecheck
npm test
npm run test:integration
npm run check:schema-alignment
npm run check:profile-alignment
npm run check:manifest
npm run check:cli-help
npm run bundle:extension
npm run package:vsix
```

CLI 示例：

```bash
node packages/cli/src/index.js validate test/fixtures/task.sample.json
node packages/cli/src/index.js import-codex --root ~/.codex --db ./archive.db --scan-days 30
node packages/cli/src/index.js db sessions --db ./archive.db --limit 20
node packages/cli/src/index.js export --format sharegpt --input test/fixtures/task.sample.json --output /tmp/sharegpt.jsonl
node packages/cli/src/index.js export --format sharegpt --db ./archive.db --output /tmp/sharegpt-from-db.jsonl
node packages/cli/src/index.js manifest verify /tmp/sharegpt.manifest.json --data /tmp/sharegpt.jsonl
```

开发计划见 `plan.md`，首轮 QA 见 `docs/mvp-qa.md`，测试记录见 `docs/testing.md`。

## VS Code Extension 手动验证

当前 extension 已接入只读会话列表与详情页。它默认读取当前工作区根目录的 `archive.db`，也可以在 VS Code 设置中配置 `vibeArchive.databasePath`。

extension 运行入口为 `packages/extension/dist/extension.js`。打包时通过 esbuild 将 core 与 `better-sqlite3` 的 JS 层打入 bundle，并把 native binding 复制到：

```text
packages/extension/dist/native/better_sqlite3.node
```

插件 Activity Bar 图标位于：

```text
packages/extension/media/vibe-archive-icon.svg
```

Marketplace 品牌 PNG 图标位于：

```text
packages/extension/media/vibe-archive-marketplace-icon.png
```

验证步骤：

```bash
cd "/Users/magicyang/Project/Vibe Archive"
node packages/cli/src/index.js import-codex --root ~/.codex --db ./archive.db --scan-days 7
npm run package:vsix
```

然后在 VS Code 中打开 `packages/extension` 作为 Extension Development Host 的扩展目录，启动调试后：

1. 打开 Activity Bar 的 `Vibe Archive`。
2. 查看 `Sessions` TreeView。
3. 点击某个 session。
4. 确认详情 Webview 展示 Task、Diagnostics 和 Messages 预览。

当前本机 VSIX 产物位于：

```text
dist/vibe-archive-0.1.0-alpha.0.vsix
dist/vibe-archive-0.1.0-alpha.0-darwin-arm64.vsix
```

当前发布配置：

```text
extension id: pzc163.vibe-archive
repository: https://github.com/pzc163/vibe-archive.git
```

多平台 VSIX 构建矩阵位于 `.github/workflows/vsix.yml`，覆盖 `darwin-arm64`、`darwin-x64`、`linux-x64`、`linux-arm64`、`win32-x64`。当前限制：矩阵已配置，仍需在 GitHub Actions 实际运行后确认各平台 native binding 产物可用。

---

# Vibe Archive Reference Implementation

> **Version**: `v0.4.1-ref`  
> **Language**: Python 3.10+  
> **目标**: 端到端演示 Vibe Archive 标准的完整工作流  
> **包含**: Codex/Claude 解析器 → VibeTask 模型 → 验证器 → 6 种 Profile 导出器 → CLI

---

## 项目结构

```
vibe-archive/
├── README.md
├── pyproject.toml
├── requirements.txt
├── examples/
│   ├── codex_session.jsonl       # 示例输入：Codex 原始会话
│   └── claude_session.jsonl      # 示例输入：Claude Code 原始会话
├── vibe_archive/
│   ├── __init__.py
│   ├── models.py                 # Pydantic 模型（完整 v0.4.1）
│   ├── validators.py             # 语义验证器（VA-001 ~ VA-015）
│   ├── parsers/
│   │   ├── __init__.py
│   │   ├── base.py               # 解析器基类
│   │   ├── codex_parser.py       # Codex JSONL 解析器
│   │   └── claude_parser.py      # Claude Code JSONL 解析器
│   ├── exporters/
│   │   ├── __init__.py
│   │   ├── base.py               # 导出器基类
│   │   ├── sft_messages.py       # SFT-Messages 导出器
│   │   ├── alpaca.py             # Alpaca 导出器
│   │   ├── sharegpt.py           # ShareGPT 导出器
│   │   ├── dpo.py                # DPO 导出器
│   │   ├── diff_edit.py          # Diff-Edit 导出器
│   │   └── agent_trajectory.py   # Agent-Trajectory 导出器
│   └── cli.py                    # CLI 入口
└── tests/
    ├── test_models.py
    ├── test_validators.py
    └── test_exporters.py
```

---

## 快速开始

```bash
# 安装
pip install -e .

# 解析 Codex 会话并导出为 DPO
vibe-archive parse ~/.codex/sessions/2026/04/25/rollout-*.jsonl   --parser codex   --export dpo   --output ./training_data/dpo.jsonl

# 验证 VibeTask JSON 文件
vibe-archive validate ./tasks/task_001.json

# 批量导出所有 Profiles
vibe-archive batch-export ./tasks/ --output-dir ./training_data/
```

---

## 核心代码

### 3.1 模型层（models.py）

```python
"""Vibe Archive v0.4.1 Pydantic Models — Reference Implementation"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime

# ============== Enums ==============
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

# ============== Core ==============
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

# ============== Extended ==============
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

# ============== Decision ==============
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

# ============== Enterprise ==============
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

# ============== Root ==============
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
```

### 3.2 验证器（validators.py）

```python
"""Vibe Archive Semantic Validator — Reference Implementation"""

from typing import List, Dict, Any
from datetime import datetime
import re
from .models import VibeTask

class ValidationResult:
    def __init__(self):
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []
        self.passed = True

class VibeValidator:
    def validate(self, task: VibeTask) -> ValidationResult:
        result = ValidationResult()

        self._check_session_order(task, result)
        self._check_final_session(task, result)
        self._check_tool_call_links(task, result)
        self._check_hash_format(task, result)
        self._check_path_masking(task, result)
        self._check_quality_score(task, result)
        self._check_training_ready(task, result)
        self._check_follow_up_link(task, result)
        self._check_decision_session_exists(task, result)
        self._check_decision_changes_exist(task, result)
        self._check_change_source_session_exists(task, result)
        self._check_change_source_tool_call_exists(task, result)
        self._check_decision_timestamp_order(task, result)

        result.passed = len(result.errors) == 0
        return result

    def _check_session_order(self, task: VibeTask, result: ValidationResult):
        timestamps = [s.created_at for s in task.sessions]
        if timestamps != sorted(timestamps):
            result.errors.append({"rule": "VA-001", "message": "Sessions are not time-ordered"})

        for session in task.sessions:
            msg_ts = [m.timestamp for m in session.conversation]
            if msg_ts != sorted(msg_ts):
                result.errors.append({"rule": "VA-001", "message": f"Session {session.session_id} messages not ordered"})

    def _check_final_session(self, task: VibeTask, result: ValidationResult):
        if task.outcome and task.outcome.status == "completed":
            has_accept = any(s.user_feedback == "accept" for s in task.sessions)
            has_decision = task.decision is not None
            if not has_accept and not has_decision:
                result.warnings.append({"rule": "VA-002", "message": "Completed task has no accepted session or decision"})

    def _check_tool_call_links(self, task: VibeTask, result: ValidationResult):
        for session in task.sessions:
            tool_ids = set()
            for msg in session.conversation:
                if msg.tool_calls:
                    for tc in msg.tool_calls:
                        tool_ids.add(tc.id)
                if msg.role == "tool" and msg.tool_call_id:
                    if msg.tool_call_id not in tool_ids:
                        result.errors.append({"rule": "VA-004", "message": f"Orphan tool_call_id: {msg.tool_call_id}"})

    def _check_hash_format(self, task: VibeTask, result: ValidationResult):
        if task.changes:
            for change in task.changes:
                for hash_field in [change.before_hash, change.after_hash]:
                    if hash_field and not re.match(r'^sha256:[a-f0-9]{64}$', hash_field):
                        result.errors.append({"rule": "VA-005", "message": f"Invalid hash: {hash_field}"})

    def _check_path_masking(self, task: VibeTask, result: ValidationResult):
        if task.privacy and task.privacy.paths_masked:
            abs_pattern = re.compile(r'^(?:/Users/|/home/|C:\\Users\\)')
            if task.context and task.context.workspace_root and abs_pattern.search(task.context.workspace_root):
                result.errors.append({"rule": "VA-006", "message": "Unmasked absolute path in workspace_root"})

    def _check_quality_score(self, task: VibeTask, result: ValidationResult):
        if task.outcome and task.outcome.quality_score is not None:
            if not (0.0 <= task.outcome.quality_score <= 1.0):
                result.errors.append({"rule": "VA-007", "message": "quality_score out of range"})

    def _check_training_ready(self, task: VibeTask, result: ValidationResult):
        if task.metadata and task.metadata.training_ready:
            checks = [
                task.metadata.has_code_output,
                task.outcome and task.outcome.status == "completed",
                task.metadata.message_count and task.metadata.message_count >= 2
            ]
            if not all(checks):
                result.warnings.append({"rule": "VA-008", "message": "training_ready but gate conditions not met"})

    def _check_follow_up_link(self, task: VibeTask, result: ValidationResult):
        if task.outcome and task.outcome.follow_up_required:
            if not task.outcome.follow_up_task_id:
                result.errors.append({"rule": "VA-009", "message": "follow_up_required but no follow_up_task_id"})

    def _check_decision_session_exists(self, task: VibeTask, result: ValidationResult):
        if task.decision:
            session_ids = {s.session_id for s in task.sessions}
            if task.decision.final_session_id not in session_ids:
                result.errors.append({"rule": "VA-011", "message": f"final_session_id not found: {task.decision.final_session_id}"})

    def _check_decision_changes_exist(self, task: VibeTask, result: ValidationResult):
        if task.decision and task.changes:
            change_ids = {c.change_id for c in task.changes}
            for cid in task.decision.final_change_ids:
                if cid not in change_ids:
                    result.errors.append({"rule": "VA-012", "message": f"final_change_id not found: {cid}"})

    def _check_change_source_session_exists(self, task: VibeTask, result: ValidationResult):
        if task.changes:
            session_ids = {s.session_id for s in task.sessions}
            for change in task.changes:
                if change.source_session_id and change.source_session_id not in session_ids:
                    result.errors.append({"rule": "VA-013", "message": f"source_session_id not found: {change.source_session_id}"})

    def _check_change_source_tool_call_exists(self, task: VibeTask, result: ValidationResult):
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
                            result.errors.append({"rule": "VA-014", "message": f"source_tool_call_id not found: {change.source_tool_call_id}"})

    def _check_decision_timestamp_order(self, task: VibeTask, result: ValidationResult):
        if task.decision:
            try:
                decision_ts = datetime.fromisoformat(task.decision.decision_timestamp.replace("Z", "+00:00"))
                for session in task.sessions:
                    session_end = session.ended_at or session.created_at
                    session_ts = datetime.fromisoformat(session_end.replace("Z", "+00:00"))
                    if decision_ts < session_ts:
                        result.errors.append({"rule": "VA-015", "message": f"decision_timestamp earlier than session {session.session_id}"})
            except ValueError:
                result.errors.append({"rule": "VA-015", "message": "Invalid decision_timestamp format"})
```

### 3.3 解析器（parsers/codex_parser.py）

```python
"""Codex JSONL Parser — Reference Implementation"""

import json
from pathlib import Path
from typing import List, Optional
from ..models import VibeTask, Session, Message, ToolCall, Source, TaskIntent

class CodexParser:
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)

    def parse(self) -> VibeTask:
        messages = []
        with open(self.file_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                event = json.loads(line)
                msg = self._convert_event(event)
                if msg:
                    messages.append(msg)

        session = Session(
            session_id=f"sess_codex_{self.file_path.stem}",
            ai_tool="codex",
            created_at=messages[0].timestamp if messages else "",
            conversation=messages
        )

        return VibeTask(
            id=f"task_{self.file_path.stem}",
            created_at=session.created_at,
            source=Source(
                app="vscode",
                capture_mode="auto_scan",
                ai_tool="codex"
            ),
            task=TaskIntent(intent="Auto-imported from Codex session"),
            sessions=[session]
        )

    def _convert_event(self, event: dict) -> Optional[Message]:
        event_type = event.get("type")

        if event_type == "message":
            return Message(
                role="user" if event.get("actor") == "user" else "assistant",
                content=event.get("content", ""),
                timestamp=event.get("timestamp", "")
            )
        elif event_type == "command":
            return Message(
                role="tool",
                content=event.get("output", ""),
                name=event.get("command", ""),
                timestamp=event.get("timestamp", "")
            )
        return None
```

### 3.4 导出器（exporters/dpo.py）

```python
"""DPO Exporter — Reference Implementation"""

from typing import Optional, Dict, Any
from ..models import VibeTask

PROFILE_VERSION = "dpo@1.0.0"

def export(task: VibeTask) -> Optional[Dict[str, Any]]:
    if not task.decision:
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
            "profile_version": PROFILE_VERSION
        }
    }
```

### 3.5 CLI（cli.py）

```python
"""Vibe Archive CLI — Reference Implementation"""

import argparse
import json
import sys
from pathlib import Path

from ..models import VibeTask
from ..validators import VibeValidator
from ..parsers.codex_parser import CodexParser
from ..exporters import dpo, sft_messages, diff_edit

EXPORTERS = {
    "dpo": dpo,
    "sft-messages": sft_messages,
    "diff-edit": diff_edit,
}

def main():
    parser = argparse.ArgumentParser(description="Vibe Archive Reference Implementation")
    subparsers = parser.add_subparsers(dest="command")

    # Parse command
    parse_parser = subparsers.add_parser("parse", help="Parse AI tool session into VibeTask")
    parse_parser.add_argument("input", help="Input JSONL file path")
    parse_parser.add_argument("--parser", choices=["codex", "claude"], default="codex")
    parse_parser.add_argument("--output", "-o", help="Output JSON file path")
    parse_parser.add_argument("--export", choices=list(EXPORTERS.keys()), help="Export to training format")

    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate VibeTask JSON")
    validate_parser.add_argument("input", help="Input JSON file path")

    # Batch export command
    batch_parser = subparsers.add_parser("batch-export", help="Batch export tasks to training data")
    batch_parser.add_argument("input_dir", help="Directory containing VibeTask JSON files")
    batch_parser.add_argument("--output-dir", "-o", required=True, help="Output directory")
    batch_parser.add_argument("--format", choices=list(EXPORTERS.keys()), required=True)

    args = parser.parse_args()

    if args.command == "parse":
        if args.parser == "codex":
            task = CodexParser(args.input).parse()
        else:
            raise NotImplementedError(f"Parser {args.parser} not implemented")

        if args.export:
            exporter = EXPORTERS[args.export]
            result = exporter.export(task)
            output = json.dumps(result, ensure_ascii=False, indent=2)
        else:
            output = task.model_dump_json(indent=2)

        if args.output:
            Path(args.output).write_text(output)
            print(f"Saved to {args.output}")
        else:
            print(output)

    elif args.command == "validate":
        task_json = Path(args.input).read_text()
        task = VibeTask.model_validate_json(task_json)
        validator = VibeValidator()
        result = validator.validate(task)

        print(f"Validation: {'PASSED' if result.passed else 'FAILED'}")
        if result.errors:
            print(f"Errors ({len(result.errors)}):")
            for e in result.errors:
                print(f"  [{e['rule']}] {e['message']}")
        if result.warnings:
            print(f"Warnings ({len(result.warnings)}):")
            for w in result.warnings:
                print(f"  [{w['rule']}] {w['message']}")

        sys.exit(0 if result.passed else 1)

    elif args.command == "batch-export":
        input_dir = Path(args.input_dir)
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        exporter = EXPORTERS[args.format]
        results = []

        for task_file in input_dir.glob("*.json"):
            task = VibeTask.model_validate_json(task_file.read_text())
            result = exporter.export(task)
            if result:
                results.append(result)

        output_file = output_dir / f"{args.format}.jsonl"
        with open(output_file, 'w') as f:
            for r in results:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

        print(f"Exported {len(results)} tasks to {output_file}")

if __name__ == "__main__":
    main()
```

---

## 安装与运行

```bash
# 1. 安装依赖
pip install pydantic

# 2. 运行示例
python -m vibe_archive.cli parse examples/codex_session.jsonl --export dpo

# 3. 验证
python -m vibe_archive.cli validate examples/task_example.json

# 4. 批量导出
python -m vibe_archive.cli batch-export ./tasks/ --output-dir ./training/ --format dpo
```

---

## 测试

```bash
pytest tests/
```

---

## 扩展指南

### 添加新的 Parser

```python
from vibe_archive.parsers.base import BaseParser

class KimiParser(BaseParser):
    def parse(self, file_path: str) -> VibeTask:
        # 实现解析逻辑
        pass
```

### 添加新的 Exporter

```python
from vibe_archive.exporters.base import BaseExporter

class MyExporter(BaseExporter):
    profile_version = "my-format@1.0.0"

    def export(self, task: VibeTask) -> dict:
        # 实现导出逻辑
        pass
```

---

*Reference Implementation for Vibe Archive Data Standard v0.4.1*
