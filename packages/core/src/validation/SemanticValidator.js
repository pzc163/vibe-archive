import {
  TASK_SCHEMA_VERSION,
  VALID_AI_TOOLS,
  VALID_CAPTURE_MODES,
  VALID_CHANGE_ROLES,
  VALID_CHANGE_TYPES,
  VALID_DECISION_ACTORS,
  VALID_DECISION_TYPES,
  VALID_DIFF_FORMATS,
  VALID_EXECUTION_TYPES,
  VALID_FILE_ROLES,
  VALID_OUTCOME_STATUSES,
  VALID_RESOLUTION_TYPES,
  VALID_ROLES,
  VALID_SOURCE_APPS,
  VALID_TASK_TYPES,
  VALID_TOOL_TYPES,
  VALID_USER_FEEDBACK
} from "../model/types.js";

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ABSOLUTE_USER_PATH_PATTERN = /(?:^|[\s"'`([{])(?:\/Users\/[^/\s"'`)\]}]+|\/home\/[^/\s"'`)\]}]+|[A-Za-z]:\\Users\\[^\\\s"'`)\]}]+)/;
const TASK_ID_PATTERN = /^task_[A-Za-z0-9_-]+$/;

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
      if (!VALID_CAPTURE_MODES.has(task.source.capture_mode)) errors.push({ rule: "VA-010", message: `invalid capture_mode: ${task.source.capture_mode}` });
      if (!VALID_AI_TOOLS.has(task.source.ai_tool)) errors.push({ rule: "VA-010", message: `invalid ai_tool: ${task.source.ai_tool}` });
    }

    this.checkSessionOrder(task, errors);
    this.checkFinalSession(task, warnings);
    this.checkConversationRoles(task, errors);
    this.checkDiffIntegrity(task, warnings);
    this.checkToolCallLinks(task, errors);
    this.checkHashFormat(task, errors);
    this.checkPathMasking(task, errors);
    this.checkQualityScore(task, errors);
    this.checkTrainingReady(task, warnings);
    this.checkFollowUpLink(task, errors);
    this.checkEnumConsistency(task, errors);
    this.checkDecisionSession(task, errors);
    this.checkDecisionChanges(task, errors);
    this.checkChangeSourceSession(task, errors);
    this.checkChangeSourceToolCall(task, errors);
    this.checkDecisionTimestamp(task, errors);

    return { passed: errors.length === 0, errors, warnings };
  }

  checkSessionOrder(task, errors) {
    if (!Array.isArray(task.sessions)) return;
    const timestamps = task.sessions.map((session) => session.created_at).filter(Boolean);
    if (timestamps.join("\n") !== [...timestamps].sort().join("\n")) {
      errors.push({ rule: "VA-001", message: "sessions are not time-ordered" });
    }
    for (const session of task.sessions) {
      const messageTimes = (session.conversation || []).map((message) => message.timestamp).filter(Boolean);
      if (messageTimes.join("\n") !== [...messageTimes].sort().join("\n")) {
        errors.push({ rule: "VA-001", message: `conversation is not time-ordered in session ${session.session_id}` });
      }
    }
  }

  checkFinalSession(task, warnings) {
    if (task.outcome?.status !== "completed") return;
    const hasAcceptedSession = (task.sessions || []).some((session) => session.user_feedback === "accept");
    const hasDecision = Boolean(task.decision?.final_session_id);
    if (!hasAcceptedSession && !hasDecision) {
      warnings.push({ rule: "VA-002", message: "completed task has no accepted session or valid decision" });
    }
  }

  checkConversationRoles(task, errors) {
    for (const session of task.sessions || []) {
      for (const message of session.conversation || []) {
        if (!VALID_ROLES.has(message.role)) {
          errors.push({ rule: "VA-010", message: `invalid role: ${message.role}` });
        }
      }
    }
  }

  checkDiffIntegrity(task, warnings) {
    for (const change of task.changes || []) {
      if (!change.before_hash || !change.after_hash || !change.patch) continue;
      if (!isValidPatch(change.patch, change.diff_format)) {
        warnings.push({ rule: "VA-003", message: `patch is not parseable for change ${change.change_id}` });
      }
    }
  }

  checkToolCallLinks(task, errors) {
    for (const session of task.sessions || []) {
      const pendingToolCalls = new Set();
      for (const message of session.conversation || []) {
        if (message.role === "tool" && message.tool_call_id && !pendingToolCalls.has(message.tool_call_id)) {
          errors.push({ rule: "VA-004", message: `orphan tool_call_id: ${message.tool_call_id}` });
        }
        for (const toolCall of message.tool_calls || []) {
          if (toolCall?.id) pendingToolCalls.add(toolCall.id);
        }
      }
    }
  }

  checkHashFormat(task, errors) {
    for (const change of task.changes || []) {
      for (const field of ["before_hash", "after_hash"]) {
        if (change[field] && !SHA256_PATTERN.test(change[field])) {
          errors.push({ rule: "VA-005", message: `invalid ${field}: ${change[field]}` });
        }
      }
    }
  }

  checkPathMasking(task, errors) {
    if (!task.privacy?.paths_masked) return;
    const candidates = [
      ["context.workspace_root", task.context?.workspace_root],
      ...(task.context?.file_tree || []).map((item, index) => [`context.file_tree[${index}].path`, item.path]),
      ...(task.changes || []).map((change, index) => [`changes[${index}].file_path`, change.file_path])
    ];
    for (const [path, value] of candidates) {
      if (typeof value === "string" && ABSOLUTE_USER_PATH_PATTERN.test(value)) {
        errors.push({ rule: "VA-006", message: `${path} contains unmasked absolute user path` });
      }
    }
  }

  checkQualityScore(task, errors) {
    if (task.outcome?.quality_score == null) return;
    const score = task.outcome.quality_score;
    if (typeof score !== "number" || score < 0 || score > 1) {
      errors.push({ rule: "VA-007", message: "outcome.quality_score out of range [0.0, 1.0]" });
    }
  }

  checkTrainingReady(task, warnings) {
    if (!task.metadata?.training_ready) return;
    const checks = [
      task.metadata.has_code_output === true,
      task.outcome?.status === "completed",
      Number(task.metadata.message_count || 0) >= 2
    ];
    if (!checks.every(Boolean)) {
      warnings.push({ rule: "VA-008", message: "training_ready=true but gate conditions are not met" });
    }
  }

  checkFollowUpLink(task, errors) {
    if (!task.outcome?.follow_up_required) return;
    if (!task.outcome.follow_up_task_id || !TASK_ID_PATTERN.test(task.outcome.follow_up_task_id)) {
      errors.push({ rule: "VA-009", message: "follow_up_required=true but follow_up_task_id is missing or invalid" });
    }
  }

  checkEnumConsistency(task, errors) {
    checkEnum(errors, "VA-010", "source.app", task.source?.app, VALID_SOURCE_APPS);
    checkEnum(errors, "VA-010", "source.capture_mode", task.source?.capture_mode, VALID_CAPTURE_MODES);
    checkEnum(errors, "VA-010", "source.ai_tool", task.source?.ai_tool, VALID_AI_TOOLS);
    checkEnum(errors, "VA-010", "task.type", task.task?.type, VALID_TASK_TYPES);
    for (const [index, item] of (task.context?.file_tree || []).entries()) {
      checkEnum(errors, "VA-010", `context.file_tree[${index}].role`, item.role, VALID_FILE_ROLES);
    }
    for (const [sessionIndex, session] of (task.sessions || []).entries()) {
      checkEnum(errors, "VA-010", `sessions[${sessionIndex}].ai_tool`, session.ai_tool, VALID_AI_TOOLS);
      checkEnum(errors, "VA-010", `sessions[${sessionIndex}].user_feedback`, session.user_feedback, VALID_USER_FEEDBACK);
      for (const [messageIndex, message] of (session.conversation || []).entries()) {
        checkEnum(errors, "VA-010", `sessions[${sessionIndex}].conversation[${messageIndex}].role`, message.role, VALID_ROLES);
        for (const [toolIndex, toolCall] of (message.tool_calls || []).entries()) {
          checkEnum(errors, "VA-010", `sessions[${sessionIndex}].conversation[${messageIndex}].tool_calls[${toolIndex}].type`, toolCall.type, VALID_TOOL_TYPES);
        }
      }
    }
    for (const [index, change] of (task.changes || []).entries()) {
      checkEnum(errors, "VA-010", `changes[${index}].role`, change.role, VALID_CHANGE_ROLES);
      checkEnum(errors, "VA-010", `changes[${index}].diff_format`, change.diff_format, VALID_DIFF_FORMATS);
      checkEnum(errors, "VA-010", `changes[${index}].change_type`, change.change_type, VALID_CHANGE_TYPES);
    }
    if (task.decision) {
      checkEnum(errors, "VA-010", "decision.decision_type", task.decision.decision_type, VALID_DECISION_TYPES);
      checkEnum(errors, "VA-010", "decision.decision_actor", task.decision.decision_actor ?? task.decision.actor, VALID_DECISION_ACTORS);
    }
    if (task.outcome) {
      checkEnum(errors, "VA-010", "outcome.status", task.outcome.status, VALID_OUTCOME_STATUSES);
      checkEnum(errors, "VA-010", "outcome.user_feedback", task.outcome.user_feedback, VALID_USER_FEEDBACK);
      checkEnum(errors, "VA-010", "outcome.resolution_type", task.outcome.resolution_type, VALID_RESOLUTION_TYPES);
      checkEnum(errors, "VA-010", "outcome.execution_result.type", task.outcome.execution_result?.type, VALID_EXECUTION_TYPES);
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

  checkChangeSourceToolCall(task, errors) {
    if (!Array.isArray(task.changes)) return;
    const sessions = new Map((task.sessions || []).map((session) => [session.session_id, session]));
    for (const change of task.changes) {
      if (!change.source_session_id || !change.source_tool_call_id) continue;
      const session = sessions.get(change.source_session_id);
      if (!session) continue;
      const toolCallIds = new Set((session.conversation || []).flatMap((message) => (message.tool_calls || []).map((toolCall) => toolCall.id)));
      if (!toolCallIds.has(change.source_tool_call_id)) {
        errors.push({ rule: "VA-014", message: `source_tool_call_id not found: ${change.source_tool_call_id}` });
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

function checkEnum(errors, rule, field, value, validValues) {
  if (value === undefined) return;
  if (!validValues.has(value)) {
    errors.push({ rule, message: `invalid ${field}: ${value}` });
  }
}

function isValidPatch(patch, diffFormat = "unified") {
  const text = String(patch || "");
  if (!text.trim()) return false;
  if (diffFormat === "json-patch") {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) && parsed.every((operation) => operation && typeof operation.op === "string" && typeof operation.path === "string");
    } catch {
      return false;
    }
  }
  if (diffFormat === "git-diff") {
    return /^diff --git /m.test(text) && /^@@ /m.test(text);
  }
  return /^@@ /m.test(text) || /^\*\*\* (?:Update|Add|Delete) File: /m.test(text) || /^[+-]/m.test(text);
}
