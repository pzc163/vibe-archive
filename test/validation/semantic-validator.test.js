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
