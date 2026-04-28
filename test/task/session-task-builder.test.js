import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CodexParser, SemanticValidator, SessionTaskBuilder, TASK_SCHEMA_VERSION } from "../../packages/core/src/index.js";
import { SqliteArchiveRepository } from "../../packages/core/src/node.js";

test("SessionTaskBuilder creates a minimal VibeTask", async () => {
  const text = await readFile("test/fixtures/codex-session.sample.jsonl", "utf8");
  const parsed = new CodexParser().parseText(text, { sourcePath: "rollout-sample.jsonl" });
  const task = new SessionTaskBuilder().build(parsed);

  assert.equal(task.schema, TASK_SCHEMA_VERSION);
  assert.ok(task.id.startsWith("task_"));
  assert.equal(task.source.ai_tool, "codex");
  assert.equal(task.sessions.length, 1);
  assert.equal(task.task.intent, "给 Search 组件加个防抖，300ms");
  assert.equal(task.metadata.training_ready, true);
});

test("SessionTaskBuilder emits required VibeTask fields and decision fallback", async () => {
  const text = await readFile("test/fixtures/codex-session.sample.jsonl", "utf8");
  const parsed = new CodexParser().parseText(text, { sourcePath: "rollout-required.jsonl" });
  const task = new SessionTaskBuilder().build(parsed);

  assert.equal(task.schema, TASK_SCHEMA_VERSION);
  assert.ok(task.id);
  assert.ok(task.created_at);
  assert.ok(task.updated_at);
  assert.ok(task.source.app);
  assert.ok(task.source.capture_mode);
  assert.ok(task.source.ai_tool);
  assert.ok(task.task.intent);
  assert.equal(task.sessions.length, 1);
  assert.equal(task.sessions[0].session_id, parsed.session.id);
  assert.equal(task.sessions[0].message_count, parsed.messages.length);
  assert.ok(Array.isArray(task.sessions[0].conversation));
  assert.ok(task.context);
  assert.ok(Array.isArray(task.context.file_tree));
  assert.ok(Array.isArray(task.changes));
  assert.equal(task.decision.final_session_id, parsed.session.id);
  assert.equal(task.decision.decision_type, "time_based");
  assert.equal(task.decision.actor, "system");
  assert.equal(task.decision.decision_actor, "system");
  assert.equal(task.metadata.decision_fallback, true);
  assert.equal(task.privacy.paths_masked, true);
  assert.equal(task.privacy.raw_snapshot_enabled, false);
  assert.equal(new SemanticValidator().validate(task).passed, true);
});

test("SessionTaskBuilder extracts changes, patch snippets, languages, and complexity", () => {
  const parsed = new CodexParser().parseText([
    JSON.stringify({ type: "message", actor: "user", content: "Add a TypeScript helper" }),
    JSON.stringify({ type: "message", actor: "assistant", content: "I will update src/helper.ts" }),
    JSON.stringify({
      type: "command",
      command: "apply_patch",
      output: [
        "*** Begin Patch",
        "*** Add File: src/helper.ts",
        "+export const helper = true;",
        "*** Update File: src/index.ts",
        "@@",
        "+export * from './helper';",
        "*** End Patch"
      ].join("\n")
    })
  ].join("\n"), { sourcePath: "rollout-changes.jsonl" });
  const task = new SessionTaskBuilder().build(parsed);

  const helperChange = task.changes.find((change) => change.file_path === "src/helper.ts");
  const indexChange = task.changes.find((change) => change.file_path === "src/index.ts");
  assert.equal(helperChange.change_type, "add");
  assert.equal(helperChange.language, "typescript");
  assert.equal(helperChange.patch.includes("Add File: src/helper.ts"), true);
  assert.equal(indexChange.change_type, "modify");
  assert.equal(task.decision.final_change_ids.length, 2);
  assert.equal(task.metadata.languages.includes("typescript"), true);
  assert.equal(task.metadata.change_count, 2);
  assert.equal(task.metadata.complexity, "medium");
});

test("SessionTaskBuilder output round-trips through SQLite task storage", async () => {
  const text = await readFile("test/fixtures/codex-session.sample.jsonl", "utf8");
  const parsed = new CodexParser().parseText(text, { sourcePath: "rollout-storage-consistency.jsonl" });
  const task = new SessionTaskBuilder().build(parsed);
  const repository = new SqliteArchiveRepository(":memory:");

  repository.upsertParsedSession(parsed, task);
  const stored = repository.getTaskBySessionId(parsed.session.id);

  assert.deepEqual(stored, task);
  assert.equal(repository.listTasks()[0].id, task.id);
  repository.close();
});
