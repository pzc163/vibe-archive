import { TASK_SCHEMA_VERSION, createId } from "../model/types.js";
import { extractUserRequest } from "../model/text.js";

export class SessionTaskBuilder {
  build({ session, messages }) {
    const createdAt = session.createdAt || new Date().toISOString();
    const updatedAt = session.updatedAt || createdAt;
    const firstUser = messages.find((message) => message.role === "user" && message.content.trim());
    const intent = extractUserRequest(firstUser?.content || session.title || "");
    const conversation = messages.map((message) => ({
      message_id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      ...(message.toolName ? { name: message.toolName } : {}),
      ...(message.metadata?.toolCallId ? { tool_call_id: message.metadata.toolCallId } : {})
    }));
    const languages = inferLanguages(messages);
    const changes = buildChanges(session, messages);

    return {
      schema: TASK_SCHEMA_VERSION,
      id: createId("task", session.id),
      created_at: createdAt,
      updated_at: updatedAt,
      source: {
        app: "vscode",
        capture_mode: session.source === "manual" ? "import" : "auto_scan",
        ai_tool: session.source === "codex" ? "codex" : "custom"
      },
      task: {
        type: inferTaskType(intent || session.title || ""),
        intent: intent || session.title || `Imported session ${session.nativeSessionId}`
      },
      sessions: [
        {
          session_id: session.id,
          ai_tool: session.source === "codex" ? "codex" : "custom",
          created_at: createdAt,
          ended_at: updatedAt,
          message_count: conversation.length,
          user_feedback: "unknown",
          conversation
        }
      ],
      context: {
        workspace_root: session.workspaceRoot || null,
        file_tree: buildFileTree(messages)
      },
      changes,
      decision: buildDecisionFallback(session, changes, updatedAt),
      metadata: {
        tags: session.tags || [],
        domain: inferDomain(languages),
        complexity: inferComplexity(messages, changes),
        message_count: session.messageCount,
        total_tool_calls: session.toolCallCount,
        change_count: changes.length,
        has_code_output: languages.length > 0,
        has_tool_usage: session.toolCallCount > 0,
        has_user_modification: session.changedFileCount > 0,
        languages,
        decision_fallback: true,
        decision_fallback_reason: "single_session_import",
        training_ready: conversation.some((message) => message.role === "user") && conversation.some((message) => message.role === "assistant")
      },
      privacy: {
        paths_masked: true,
        raw_snapshot_enabled: false,
        excluded_patterns: [".env*", "*.pem", "*.key"]
      }
    };
  }
}

function inferTaskType(text) {
  if (/修复|bug|fix|报错|错误/i.test(text)) return "bugfix";
  if (/重构|refactor/i.test(text)) return "refactor";
  if (/测试|test|spec/i.test(text)) return "test";
  if (/文档|doc|readme/i.test(text)) return "doc";
  if (/解释|explain/i.test(text)) return "explain";
  return "feature";
}

function inferLanguages(messages) {
  const paths = messages.flatMap((message) => [...(message.referencedFiles || []), ...(message.changedFiles || [])]);
  const languages = paths.map(languageFromPath).filter(Boolean);
  return Array.from(new Set(languages));
}

function languageFromPath(path) {
  const ext = String(path).split(".").pop()?.toLowerCase();
  return {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    yml: "yaml",
    yaml: "yaml"
  }[ext || ""];
}

function inferDomain(languages) {
  if (languages.includes("typescript") || languages.includes("javascript") || languages.includes("css")) return "frontend";
  if (languages.includes("python")) return "backend";
  return "unknown";
}

function buildFileTree(messages) {
  const paths = compactFilePaths(messages.flatMap((message) => [...(message.referencedFiles || []), ...(message.changedFiles || [])]));
  return paths.map((path) => ({
    path,
    language: languageFromPath(path) || "unknown",
    role: messages.some((message) => (message.changedFiles || []).includes(path)) ? "target" : "reference"
  }));
}

function buildChanges(session, messages) {
  const changesByPath = new Map();
  for (const message of messages) {
    for (const filePath of compactFilePaths(message.changedFiles || [])) {
      if (changesByPath.has(filePath)) continue;
      changesByPath.set(filePath, {
        change_id: createId("chg", `${message.sequence}_${filePath}`),
        file_path: filePath,
        language: languageFromPath(filePath) || "unknown",
        role: "target",
        diff_format: "unified",
        patch: extractPatchForFile(message.content, filePath),
        change_type: inferChangeType(message.content, filePath),
        ai_generated: true,
        user_modified: false,
        source_session_id: session.id,
        source_message_id: message.id
      });
    }
  }
  return Array.from(changesByPath.values());
}

function buildDecisionFallback(session, changes, updatedAt) {
  return {
    decision_type: "time_based",
    actor: "system",
    decision_actor: "system",
    final_session_id: session.id,
    final_change_ids: changes.map((change) => change.change_id),
    decision_timestamp: updatedAt,
    rationale: "Single imported session selected as export fallback."
  };
}

function inferComplexity(messages, changes) {
  if (changes.length >= 5 || messages.length >= 100) return "complex";
  if (changes.length >= 2 || messages.length >= 20) return "medium";
  return "simple";
}

function inferChangeType(content, filePath) {
  const text = String(content || "");
  if (new RegExp(`^\\*\\*\\* Add File: ${escapeRegExp(filePath)}$`, "m").test(text)) return "add";
  if (new RegExp(`^\\*\\*\\* Delete File: ${escapeRegExp(filePath)}$`, "m").test(text)) return "delete";
  if (/rename/i.test(text)) return "rename";
  return "modify";
}

function extractPatchForFile(content, filePath) {
  const text = String(content || "");
  if (!text.includes(filePath)) return "";
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `*** Update File: ${filePath}` || line.trim() === `*** Add File: ${filePath}` || line.trim() === `*** Delete File: ${filePath}`);
  if (start < 0) return "";
  const end = lines.findIndex((line, index) => index > start && line.startsWith("*** ") && !line.includes(filePath));
  return lines.slice(start, end > start ? end : undefined).join("\n").slice(0, 20000);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactFilePaths(paths) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean).map(String)));
  return uniquePaths.filter((path) => {
    const normalized = normalizeComparablePath(path);
    return !uniquePaths.some((candidate) => {
      if (candidate === path) return false;
      const other = normalizeComparablePath(candidate);
      return other.endsWith(`/${normalized}`) && other.length > normalized.length;
    });
  });
}

function normalizeComparablePath(path) {
  const normalized = String(path).replace(/\\/g, "/").replace(/^\.\//, "");
  if (/^\/[^/]+$/.test(normalized)) return normalized.slice(1);
  return normalized;
}
