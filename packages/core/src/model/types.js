export const TASK_SCHEMA_VERSION = "vibe-archive.task.v0.4.1";
export const SHAREGPT_PROFILE_VERSION = "sharegpt@1.0.0";
export const PROFILE_VERSIONS = Object.freeze({
  "agent-trajectory": "agent-trajectory@1.0.0",
  alpaca: "alpaca@1.0.0",
  "diff-edit": "diff-edit@1.0.0",
  dpo: "dpo@1.0.0",
  "sft-messages": "sft-messages@1.0.0",
  sharegpt: SHAREGPT_PROFILE_VERSION
});
export const MANIFEST_VERSION = "vibe-archive.manifest.v1.0";
export const MANIFEST_SCHEMA_URL = "https://vibe-archive.dev/schema/manifest/v1.0.json";

export const VALID_ROLES = new Set(["system", "user", "assistant", "tool"]);
export const VALID_CAPTURE_MODES = new Set(["auto_scan", "manual_paste", "clipboard", "own_chat_panel", "import", "proxy", "api"]);
export const VALID_AI_TOOLS = new Set(["github-copilot", "claude-code", "codex", "kimi-code", "cursor-chat", "trae-chat", "custom"]);
export const VALID_SOURCE_APPS = new Set(["vscode", "cursor", "trae", "jetbrains", "terminal", "unknown"]);
export const VALID_TASK_TYPES = new Set(["feature", "bugfix", "refactor", "test", "doc", "config", "debug", "explain", "review", "chore", "unknown"]);
export const VALID_USER_FEEDBACK = new Set(["accept", "reject", "modify", "partial", "unknown", null, undefined]);
export const VALID_TOOL_TYPES = new Set(["file_read", "file_write", "file_edit", "bash", "lsp_query", "search", "custom"]);
export const VALID_FILE_ROLES = new Set(["target", "dependency", "reference", "test", "config", "unknown"]);
export const VALID_CHANGE_ROLES = new Set(["target", "dependency", "test", "config", "unknown"]);
export const VALID_DIFF_FORMATS = new Set(["unified", "git-diff", "json-patch"]);
export const VALID_CHANGE_TYPES = new Set(["add", "modify", "delete", "rename"]);
export const VALID_DECISION_TYPES = new Set(["human_select", "auto_score", "test_result", "hybrid", "time_based"]);
export const VALID_DECISION_ACTORS = new Set(["user", "system", "reviewer", "ci_pipeline", "auto_grader"]);
export const VALID_OUTCOME_STATUSES = new Set(["draft", "in_progress", "completed", "abandoned", "blocked"]);
export const VALID_RESOLUTION_TYPES = new Set(["ai_solved", "user_solved", "ai_assisted", "abandoned", "escalated"]);
export const VALID_EXECUTION_TYPES = new Set(["test_passed", "test_failed", "runtime_error", "lint_error", "type_error", "build_error", "no_execution", "skipped"]);

export function createId(prefix, seed) {
  const normalized = String(seed || Date.now())
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${prefix}_${normalized || Math.random().toString(36).slice(2)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
