import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SemanticValidator } from "../../packages/core/src/index.js";

test("SemanticValidator accepts sample task", async () => {
  const task = JSON.parse(await readFile("test/fixtures/task.sample.json", "utf8"));
  const result = new SemanticValidator().validate(task);

  assert.equal(result.passed, true);
});

test("SemanticValidator catches invalid decision session", async () => {
  const task = JSON.parse(await readFile("test/fixtures/task.sample.json", "utf8"));
  task.decision = {
    final_session_id: "missing",
    final_change_ids: [],
    decision_type: "human_select",
    decision_timestamp: "2026-04-25T10:32:00Z",
    decision_actor: "user"
  };
  const result = new SemanticValidator().validate(task);

  assert.equal(result.passed, false);
  assert.equal(result.errors.some((error) => error.rule === "VA-011"), true);
});

test("SemanticValidator covers VA-001 through VA-015 semantic rules", async () => {
  const base = JSON.parse(await readFile("test/fixtures/task.sample.json", "utf8"));
  const validator = new SemanticValidator();

  assertRule(validator.validate(mutate(base, (task) => {
    task.sessions[0].conversation.reverse();
  })), "errors", "VA-001");

  assertRule(validator.validate(mutate(base, (task) => {
    task.outcome = { status: "completed" };
    task.sessions[0].user_feedback = "partial";
    delete task.decision;
  })), "warnings", "VA-002");

  assertRule(validator.validate(mutate(base, (task) => {
    task.changes = [{
      change_id: "chg_bad_patch",
      file_path: "src/app.ts",
      language: "typescript",
      role: "target",
      diff_format: "unified",
      patch: "not a diff",
      before_hash: goodHash("1"),
      after_hash: goodHash("2"),
      change_type: "modify",
      ai_generated: true,
      user_modified: false,
      source_session_id: "sess_sample"
    }];
  })), "warnings", "VA-003");

  assertRule(validator.validate(mutate(base, (task) => {
    task.sessions[0].conversation.push({
      role: "tool",
      content: "output",
      timestamp: "2026-04-25T10:30:09Z",
      tool_call_id: "missing_call"
    });
  })), "errors", "VA-004");

  assertRule(validator.validate(mutate(base, (task) => {
    task.changes = [{
      change_id: "chg_bad_hash",
      file_path: "src/app.ts",
      language: "typescript",
      role: "target",
      diff_format: "unified",
      patch: "@@ -1 +1 @@\n-a\n+b",
      before_hash: "sha256:nope",
      change_type: "modify",
      ai_generated: true,
      user_modified: false,
      source_session_id: "sess_sample"
    }];
  })), "errors", "VA-005");

  assertRule(validator.validate(mutate(base, (task) => {
    task.context = { workspace_root: "/Users/alice/project", file_tree: [{ path: "src/app.ts", role: "target" }] };
    task.privacy = { paths_masked: true };
  })), "errors", "VA-006");

  assertRule(validator.validate(mutate(base, (task) => {
    task.outcome = { quality_score: 1.5 };
  })), "errors", "VA-007");

  assertRule(validator.validate(mutate(base, (task) => {
    task.metadata.training_ready = true;
    task.metadata.has_code_output = false;
    task.outcome = { status: "draft" };
  })), "warnings", "VA-008");

  assertRule(validator.validate(mutate(base, (task) => {
    task.outcome = { follow_up_required: true, follow_up_task_id: "bad-id" };
  })), "errors", "VA-009");

  assertRule(validator.validate(mutate(base, (task) => {
    task.task.type = "not-a-task-type";
  })), "errors", "VA-010");

  assertRule(validator.validate(mutate(base, (task) => {
    task.decision = {
      final_session_id: "missing",
      final_change_ids: [],
      decision_type: "human_select",
      decision_timestamp: "2026-04-25T10:32:00Z",
      decision_actor: "user"
    };
  })), "errors", "VA-011");

  assertRule(validator.validate(mutate(base, (task) => {
    task.changes = [];
    task.decision = {
      final_session_id: "sess_sample",
      final_change_ids: ["missing_change"],
      decision_type: "human_select",
      decision_timestamp: "2026-04-25T10:32:00Z",
      decision_actor: "user"
    };
  })), "errors", "VA-012");

  assertRule(validator.validate(mutate(base, (task) => {
    task.changes = [{
      change_id: "chg_missing_session",
      file_path: "src/app.ts",
      language: "typescript",
      role: "target",
      diff_format: "unified",
      patch: "@@ -1 +1 @@\n-a\n+b",
      change_type: "modify",
      ai_generated: true,
      user_modified: false,
      source_session_id: "missing_session"
    }];
  })), "errors", "VA-013");

  assertRule(validator.validate(mutate(base, (task) => {
    task.sessions[0].conversation[1].tool_calls = [{ id: "call_existing", type: "file_edit", name: "edit", arguments: {} }];
    task.changes = [{
      change_id: "chg_missing_tool",
      file_path: "src/app.ts",
      language: "typescript",
      role: "target",
      diff_format: "unified",
      patch: "@@ -1 +1 @@\n-a\n+b",
      change_type: "modify",
      ai_generated: true,
      user_modified: false,
      source_session_id: "sess_sample",
      source_tool_call_id: "call_missing"
    }];
  })), "errors", "VA-014");

  assertRule(validator.validate(mutate(base, (task) => {
    task.decision = {
      final_session_id: "sess_sample",
      final_change_ids: [],
      decision_type: "human_select",
      decision_timestamp: "2026-04-25T10:29:00Z",
      decision_actor: "user"
    };
  })), "errors", "VA-015");
});

function mutate(value, mutator) {
  const copy = JSON.parse(JSON.stringify(value));
  mutator(copy);
  return copy;
}

function assertRule(result, bucket, rule) {
  assert.equal(result[bucket].some((item) => item.rule === rule), true, `${rule} missing from ${bucket}: ${JSON.stringify(result)}`);
}

function goodHash(seed) {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}
