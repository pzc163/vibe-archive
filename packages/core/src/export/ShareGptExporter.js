import { SHAREGPT_PROFILE_VERSION } from "../model/types.js";
import { PathMasker } from "../privacy/PathMasker.js";
import { ShareGptProfileValidator } from "./ShareGptProfileValidator.js";

export class ShareGptExporter {
  constructor(options = {}) {
    this.pathMasker = options.pathMasker || new PathMasker(options.privacy || {});
    this.includeToolMessages = Boolean(options.includeToolMessages);
    this.validateOutput = options.validateOutput !== false;
    this.profileValidator = options.profileValidator || new ShareGptProfileValidator();
  }

  exportTask(task) {
    const session = selectSession(task);
    if (!session) {
      throw new Error(`Task ${task.id || "<unknown>"} has no exportable session`);
    }

    const conversations = [];
    for (const message of session.conversation || []) {
      if (message.role === "system") continue;
      if (message.role === "tool" && !this.includeToolMessages) continue;
      const from = message.role === "user" ? "human" : "gpt";
      conversations.push({
        from,
        value: this.pathMasker.mask(message.content || "")
      });
    }

    const record = this.pathMasker.maskObject({
      id: task.id,
      conversations,
      metadata: {
        source: task.source?.ai_tool,
        domain: task.metadata?.domain,
        languages: task.metadata?.languages || [],
        message_count: conversations.length,
        profile_version: SHAREGPT_PROFILE_VERSION
      }
    });
    if (this.validateOutput) {
      const result = this.profileValidator.validateRecord(record);
      if (!result.passed) {
        throw new Error(`ShareGPT profile validation failed for task ${task.id}: ${result.errors.map((error) => error.message).join("; ")}`);
      }
    }
    return record;
  }

  exportJsonl(tasks) {
    return tasks.map((task) => JSON.stringify(this.exportTask(task))).join("\n") + (tasks.length ? "\n" : "");
  }
}

export function selectSession(task) {
  if (!task?.sessions?.length) return undefined;
  if (task.decision?.final_session_id) {
    const finalSession = task.sessions.find((session) => session.session_id === task.decision.final_session_id);
    if (finalSession) return finalSession;
  }
  const accepted = task.sessions.find((session) => session.user_feedback === "accept");
  return accepted || task.sessions[task.sessions.length - 1];
}
