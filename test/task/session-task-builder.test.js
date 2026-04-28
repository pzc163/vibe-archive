import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CodexParser, SessionTaskBuilder, TASK_SCHEMA_VERSION } from "../../packages/core/src/index.js";

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
