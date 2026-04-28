import { TASK_SCHEMA_VERSION, createId } from "../model/types.js";
import { extractUserRequest } from "../model/text.js";

export class SessionTaskBuilder {
  build({ session, messages }) {
    const createdAt = session.createdAt || new Date().toISOString();
    const updatedAt = session.updatedAt || createdAt;
    const firstUser = messages.find((message) => message.role === "user" && message.content.trim());
    const intent = extractUserRequest(firstUser?.content || session.title || "");
    const conversation = messages.map((message) => ({
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      name: message.toolName,
      tool_call_id: message.metadata?.toolCallId
    }));
    const languages = inferLanguages(messages);

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
          conversation
        }
      ],
      context: {
        workspace_root: session.workspaceRoot,
        file_tree: buildFileTree(messages)
      },
      changes: buildChanges(session, messages),
      metadata: {
        tags: session.tags || [],
        domain: inferDomain(languages),
        message_count: session.messageCount,
        total_tool_calls: session.toolCallCount,
        has_code_output: languages.length > 0,
        has_tool_usage: session.toolCallCount > 0,
        has_user_modification: session.changedFileCount > 0,
        languages,
        training_ready: conversation.some((message) => message.role === "user") && conversation.some((message) => message.role === "assistant")
      },
      privacy: {
        paths_masked: false,
        excluded_patterns: []
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
  const paths = Array.from(new Set(messages.flatMap((message) => [...(message.referencedFiles || []), ...(message.changedFiles || [])])));
  return paths.map((path) => ({
    path,
    language: languageFromPath(path) || "unknown",
    role: messages.some((message) => (message.changedFiles || []).includes(path)) ? "target" : "reference"
  }));
}

function buildChanges(session, messages) {
  const changes = [];
  for (const message of messages) {
    for (const filePath of message.changedFiles || []) {
      changes.push({
        change_id: createId("chg", `${message.sequence}_${filePath}`),
        file_path: filePath,
        language: languageFromPath(filePath) || "unknown",
        role: "target",
        diff_format: "unified",
        patch: "",
        change_type: "modify",
        ai_generated: true,
        user_modified: false,
        source_session_id: session.id,
        source_message_id: message.id
      });
    }
  }
  return changes;
}
