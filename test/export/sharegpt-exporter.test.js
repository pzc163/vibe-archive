import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SHAREGPT_PROFILE_VERSION, ShareGptExporter } from "../../packages/core/src/index.js";

test("ShareGptExporter exports ShareGPT JSONL", async () => {
  const task = JSON.parse(await readFile("test/fixtures/task.sample.json", "utf8"));
  const exporter = new ShareGptExporter();
  const record = exporter.exportTask(task);

  assert.equal(record.id, "task_sample");
  assert.equal(record.conversations[0].from, "human");
  assert.equal(record.conversations[1].from, "gpt");
  assert.equal(record.metadata.profile_version, SHAREGPT_PROFILE_VERSION);
});
