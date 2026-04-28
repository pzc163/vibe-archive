export const TASK_SCHEMA_VERSION = "vibe-archive.task.v0.4.1";
export const SHAREGPT_PROFILE_VERSION = "sharegpt@1.0.0";
export const MANIFEST_VERSION = "vibe-archive.manifest.v1.0";
export const MANIFEST_SCHEMA_URL = "https://vibe-archive.dev/schema/manifest/v1.0.json";

export const VALID_ROLES = new Set(["system", "user", "assistant", "tool"]);
export const VALID_CAPTURE_MODES = new Set(["auto_scan", "manual_paste", "clipboard", "own_chat_panel", "import", "proxy", "api"]);
export const VALID_AI_TOOLS = new Set(["github-copilot", "claude-code", "codex", "kimi-code", "cursor-chat", "trae-chat", "custom"]);

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
