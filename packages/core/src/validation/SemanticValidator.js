import { TASK_SCHEMA_VERSION, VALID_AI_TOOLS, VALID_CAPTURE_MODES, VALID_ROLES } from "../model/types.js";

export class SemanticValidator {
  validate(task) {
    const errors = [];
    const warnings = [];

    if (!task || typeof task !== "object") {
      return { passed: false, errors: [{ rule: "VA-000", message: "Task must be an object" }], warnings };
    }
    if (task.schema !== TASK_SCHEMA_VERSION) {
      errors.push({ rule: "VA-000", message: `schema must be ${TASK_SCHEMA_VERSION}` });
    }
    if (!task.id) errors.push({ rule: "VA-000", message: "id is required" });
    if (!task.created_at) errors.push({ rule: "VA-000", message: "created_at is required" });
    if (!task.source) errors.push({ rule: "VA-000", message: "source is required" });
    if (!task.task?.intent) errors.push({ rule: "VA-000", message: "task.intent is required" });
    if (!Array.isArray(task.sessions) || task.sessions.length === 0) {
      errors.push({ rule: "VA-000", message: "sessions must contain at least one session" });
    }
    if (task.source) {
      if (!VALID_CAPTURE_MODES.has(task.source.capture_mode)) errors.push({ rule: "VA-000", message: `invalid capture_mode: ${task.source.capture_mode}` });
      if (!VALID_AI_TOOLS.has(task.source.ai_tool)) errors.push({ rule: "VA-000", message: `invalid ai_tool: ${task.source.ai_tool}` });
    }

    this.checkSessionOrder(task, errors);
    this.checkConversationRoles(task, errors);
    this.checkDecisionSession(task, errors);
    this.checkDecisionChanges(task, errors);
    this.checkChangeSourceSession(task, errors);
    this.checkDecisionTimestamp(task, errors);

    return { passed: errors.length === 0, errors, warnings };
  }

  checkSessionOrder(task, errors) {
    if (!Array.isArray(task.sessions)) return;
    const timestamps = task.sessions.map((session) => session.created_at).filter(Boolean);
    if (timestamps.join("\n") !== [...timestamps].sort().join("\n")) {
      errors.push({ rule: "VA-001", message: "sessions are not time-ordered" });
    }
  }

  checkConversationRoles(task, errors) {
    for (const session of task.sessions || []) {
      for (const message of session.conversation || []) {
        if (!VALID_ROLES.has(message.role)) {
          errors.push({ rule: "VA-003", message: `invalid role: ${message.role}` });
        }
      }
    }
  }

  checkDecisionSession(task, errors) {
    if (!task.decision) return;
    const sessionIds = new Set((task.sessions || []).map((session) => session.session_id));
    if (!sessionIds.has(task.decision.final_session_id)) {
      errors.push({ rule: "VA-011", message: `final_session_id not found: ${task.decision.final_session_id}` });
    }
  }

  checkDecisionChanges(task, errors) {
    if (!task.decision || !Array.isArray(task.changes)) return;
    const changeIds = new Set(task.changes.map((change) => change.change_id));
    for (const id of task.decision.final_change_ids || []) {
      if (!changeIds.has(id)) {
        errors.push({ rule: "VA-012", message: `final_change_id not found: ${id}` });
      }
    }
  }

  checkChangeSourceSession(task, errors) {
    if (!Array.isArray(task.changes)) return;
    const sessionIds = new Set((task.sessions || []).map((session) => session.session_id));
    for (const change of task.changes) {
      if (change.source_session_id && !sessionIds.has(change.source_session_id)) {
        errors.push({ rule: "VA-013", message: `source_session_id not found: ${change.source_session_id}` });
      }
    }
  }

  checkDecisionTimestamp(task, errors) {
    if (!task.decision?.decision_timestamp) return;
    const decisionTime = Date.parse(task.decision.decision_timestamp);
    if (Number.isNaN(decisionTime)) {
      errors.push({ rule: "VA-015", message: "invalid decision_timestamp" });
      return;
    }
    for (const session of task.sessions || []) {
      const sessionTime = Date.parse(session.ended_at || session.created_at);
      if (!Number.isNaN(sessionTime) && decisionTime < sessionTime) {
        errors.push({ rule: "VA-015", message: `decision_timestamp earlier than session ${session.session_id}` });
      }
    }
  }
}
