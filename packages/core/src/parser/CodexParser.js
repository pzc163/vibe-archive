import { basename } from "node:path";
import { createId } from "../model/types.js";
import { compactTitle } from "../model/text.js";

export const CODEX_PARSER_VERSION = "codex-v1";

export class CodexParser {
  parseText(text, options = {}) {
    const sourcePath = options.sourcePath || "manual-input.jsonl";
    const lines = splitJsonl(text);
    const messages = [];
    const errors = [];
    const unknownFieldSamples = [];
    const importedAt = options.importedAt || new Date().toISOString();
    let sessionMeta;
    let latestTurnContext;

    for (const item of lines) {
      if (!item.line.trim()) {
        continue;
      }
      try {
        const raw = JSON.parse(stripBom(item.line));
        if (raw.type === "session_meta" && raw.payload && typeof raw.payload === "object") {
          sessionMeta = raw.payload;
        }
        if (raw.type === "turn_context" && raw.payload && typeof raw.payload === "object") {
          latestTurnContext = raw.payload;
        }
        const message = this.convertEvent(raw, {
          sequence: messages.length,
          sourcePath,
          importedAt
        });
        if (message) {
          messages.push(message);
        }
        const unknownFields = collectUnknownFields(raw);
        if (unknownFields.length && unknownFieldSamples.length < 20) {
          unknownFieldSamples.push({ line: item.number, fields: unknownFields });
        }
      } catch (error) {
        errors.push({
          line: item.number,
          message: error instanceof Error ? error.message : String(error),
          sample: item.line.slice(0, 500)
        });
      }
    }

    const nativeSessionId = createNativeSessionId(sourcePath);
    const totalLines = lines.filter((item) => item.line.trim()).length;
    const createdAt = messages[0]?.timestamp || options.fileMtime || importedAt;
    const updatedAt = messages[messages.length - 1]?.timestamp || options.fileMtime || importedAt;
    const sessionId = createId("sess_codex", nativeSessionId);
    const workspaceRoot = sessionMeta?.cwd || latestTurnContext?.cwd || inferWorkspaceRoot(messages);

    return {
      session: {
        id: sessionId,
        source: "codex",
        nativeSessionId,
        sourcePath,
        sourceFileMtime: options.fileMtime,
        sourceFileSize: options.fileSize,
        parserVersion: CODEX_PARSER_VERSION,
        title: inferTitle(messages, nativeSessionId),
        workspaceRoot,
        model: latestTurnContext?.model,
        createdAt,
        updatedAt,
        importedAt,
        messageCount: messages.length,
        toolCallCount: messages.filter((message) => message.role === "tool").length,
        changedFileCount: countChangedFiles(messages),
        parseStatus: inferParseStatus({ errors, messages, totalLines }),
        parseErrorCount: errors.length,
        tags: [],
        qualityScore: undefined
      },
      messages: messages.map((message) => ({ ...message, sessionId })),
      diagnostics: {
        sessionId,
        sourcePath,
        parserVersion: CODEX_PARSER_VERSION,
        totalLines,
        parsedLines: messages.length,
        failedLines: errors.length,
        errorSamples: errors.slice(0, 20),
        unknownFieldSamples,
        createdAt: importedAt
      }
    };
  }

  convertEvent(raw, context) {
    const rawType = String(raw.type || raw.kind || "unknown");
    if (raw.payload && typeof raw.payload === "object") {
      const converted = this.convertCodexPayload(raw, raw.payload, context);
      if (converted) return converted;
    }
    const timestamp = String(raw.timestamp || raw.created_at || raw.time || context.importedAt);
    const base = {
      id: createId("msg", `${context.sequence}_${timestamp}_${rawType}`),
      sessionId: "",
      sequence: context.sequence,
      role: "assistant",
      content: "",
      timestamp,
      rawType,
      rawJsonRef: undefined,
      toolName: undefined,
      toolInput: undefined,
      toolResult: undefined,
      referencedFiles: [],
      changedFiles: [],
      metadata: {
        sourceSpecific: raw
      }
    };

    if (rawType === "message") {
      const role = roleFromActor(raw.actor ?? raw.role);
      const content = stringifyContent(raw.content ?? raw.message ?? raw.text ?? "");
      return {
        ...base,
        role,
        content,
        referencedFiles: extractPaths(content),
        changedFiles: []
      };
    }

    if (rawType === "command" || raw.command || rawType === "tool" || rawType === "tool_call") {
      const command = raw.command || raw.name || raw.tool_name || "tool";
      const output = raw.output ?? raw.result ?? raw.content ?? "";
      const toolInput = raw.arguments ?? raw.input ?? raw.params ?? (raw.command ? { command: raw.command } : undefined);
      const content = stringifyContent(output);
      const inputPaths = extractPaths(JSON.stringify(toolInput ?? {}));
      const outputPaths = extractPaths(content);
      const changedFiles = inferChangedFiles(raw, toolInput, content);
      return {
        ...base,
        role: "tool",
        content,
        toolName: String(command),
        toolInput,
        toolResult: output,
        referencedFiles: unique([...inputPaths, ...outputPaths]),
        changedFiles,
        metadata: {
          ...base.metadata,
          command: raw.command,
          exitCode: typeof raw.exit_code === "number" ? raw.exit_code : raw.exitCode
        }
      };
    }

    if (raw.content || raw.text || raw.message) {
      const content = stringifyContent(raw.content ?? raw.text ?? raw.message);
      return {
        ...base,
        role: roleFromActor(raw.actor ?? raw.role),
        content,
        referencedFiles: extractPaths(content)
      };
    }

    return undefined;
  }

  convertCodexPayload(raw, payload, context) {
    const payloadType = String(payload.type || "");
    const timestamp = String(raw.timestamp || payload.timestamp || payload.started_at || payload.completed_at || context.importedAt);
    const base = {
      id: createId("msg", `${context.sequence}_${timestamp}_${raw.type}_${payloadType}_${payload.call_id || ""}`),
      sessionId: "",
      sequence: context.sequence,
      role: "assistant",
      content: "",
      timestamp,
      rawType: `${raw.type}:${payloadType || "unknown"}`,
      rawJsonRef: undefined,
      toolName: undefined,
      toolInput: undefined,
      toolResult: undefined,
      referencedFiles: [],
      changedFiles: [],
      metadata: {
        cwd: payload.cwd,
        command: payload.command,
        exitCode: payload.exit_code,
        model: payload.model,
        callId: payload.call_id,
        sourceSpecific: summarizePayloadForMetadata(payload)
      }
    };

    if (raw.type === "response_item" && payloadType === "message") {
      if (String(payload.role || "").toLowerCase() === "user") {
        return undefined;
      }
      const role = roleFromActor(payload.role);
      const content = contentToText(payload.content);
      if (!content.trim()) return undefined;
      return {
        ...base,
        role,
        content,
        referencedFiles: extractPaths(content)
      };
    }

    if (raw.type === "response_item" && payloadType === "function_call") {
      const args = parseMaybeJson(payload.arguments);
      const content = stringifyContent(args ?? payload.arguments ?? "");
      return {
        ...base,
        role: "tool",
        content,
        toolName: payload.name || "function_call",
        toolInput: args ?? payload.arguments,
        referencedFiles: extractPaths(content),
        changedFiles: inferChangedFiles({ name: payload.name }, args, content)
      };
    }

    if (raw.type === "response_item" && payloadType === "function_call_output") {
      const content = stringifyContent(payload.output ?? "");
      return {
        ...base,
        role: "tool",
        content,
        toolName: "function_call_output",
        toolResult: payload.output,
        referencedFiles: extractPaths(content)
      };
    }

    if (raw.type === "event_msg" && payloadType === "exec_command_end") {
      const content = stringifyContent(payload.formatted_output ?? payload.aggregated_output ?? payload.stdout ?? payload.stderr ?? "");
      return {
        ...base,
        role: "tool",
        content,
        toolName: "exec_command",
        toolInput: { command: payload.command, cwd: payload.cwd },
        toolResult: {
          stdout: payload.stdout,
          stderr: payload.stderr,
          exit_code: payload.exit_code,
          status: payload.status
        },
        referencedFiles: extractPaths(`${payload.command || ""}\n${content}`),
        changedFiles: inferChangedFiles({ command: payload.command }, { command: payload.command }, content)
      };
    }

    if (raw.type === "event_msg" && payloadType === "user_message") {
      const content = stringifyContent(payload.message || "");
      if (!content.trim()) return undefined;
      return {
        ...base,
        role: "user",
        content,
        referencedFiles: extractPaths(content)
      };
    }

    if (raw.type === "event_msg" && payloadType === "agent_message") {
      return undefined;
    }

    return undefined;
  }
}

export function splitJsonl(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line, index) => ({ number: index + 1, line }));
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, "").replace(/\u0000/g, "");
}

function roleFromActor(actor) {
  const value = String(actor || "assistant").toLowerCase();
  if (["user", "human"].includes(value)) return "user";
  if (["developer", "system"].includes(value)) return "system";
  if (["tool", "command"].includes(value)) return "tool";
  return "assistant";
}

function stringifyContent(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value);
}

function contentToText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return stringifyContent(content);
  return content.map((item) => {
    if (typeof item === "string") return item;
    return item.text ?? item.content ?? item.output_text ?? item.input_text ?? "";
  }).filter(Boolean).join("\n");
}

function parseMaybeJson(value) {
  if (value == null || typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function createNativeSessionId(sourcePath) {
  return basename(sourcePath).replace(/\.(jsonl|json)$/i, "") || "manual";
}

function inferTitle(messages, fallback) {
  const firstUser = messages.find((message) => message.role === "user" && message.content.trim());
  return firstUser ? compactTitle(firstUser.content, 80) || fallback : fallback;
}

function inferWorkspaceRoot(messages) {
  for (const message of messages) {
    const cwd = message.metadata?.sourceSpecific?.cwd || message.metadata?.cwd;
    if (cwd) return String(cwd);
  }
  return undefined;
}

function countChangedFiles(messages) {
  return unique(messages.flatMap((message) => message.changedFiles || [])).length;
}

function collectUnknownFields(raw) {
  const known = new Set(["type", "kind", "timestamp", "created_at", "time", "payload", "actor", "role", "content", "message", "text", "command", "output", "result", "name", "tool_name", "arguments", "input", "params", "exit_code", "exitCode", "cwd"]);
  return Object.keys(raw).filter((key) => !known.has(key));
}

function inferParseStatus({ errors, messages, totalLines }) {
  if (errors.length > 0) return messages.length > 0 ? "partial" : "failed";
  if (totalLines > 0 && messages.length === 0) return "partial";
  return "ok";
}

function summarizePayloadForMetadata(payload) {
  const summary = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === "content" && Array.isArray(value)) {
      summary.content = value.map((item) => ({ type: item.type, text_length: typeof item.text === "string" ? item.text.length : undefined }));
    } else if (typeof value === "string" && value.length > 500) {
      summary[key] = `${value.slice(0, 500)}...`;
    } else {
      summary[key] = value;
    }
  }
  return summary;
}

function inferChangedFiles(raw, toolInput, content) {
  const name = String(raw.command || raw.name || raw.tool_name || "").toLowerCase();
  const input = toolInput && typeof toolInput === "object" ? toolInput : {};
  const explicit = [input.path, input.file_path, input.filename, raw.path, raw.file_path].filter(Boolean).map(String);
  const looksLikeEdit = /write|edit|patch|apply|save|modify/.test(name) || explicit.length > 0;
  if (!looksLikeEdit) return [];
  return unique([...explicit, ...extractPaths(content)]);
}

export function extractPaths(value) {
  const text = String(value || "");
  const matches = text.match(/(?:[~./A-Za-z0-9_-]+\/)?[A-Za-z0-9_.-]+\.(?:js|jsx|ts|tsx|py|json|md|css|html|yml|yaml|toml|rs|go|java|php|rb|sh|sql)/g) || [];
  return unique(matches);
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}
