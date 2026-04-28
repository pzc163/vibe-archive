import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CodexParser } from "../../packages/core/src/index.js";

test("CodexParser parses JSONL and records diagnostics", async () => {
  const text = await readFile("test/fixtures/codex-session.sample.jsonl", "utf8");
  const result = new CodexParser().parseText(text, { sourcePath: "rollout-sample.jsonl" });

  assert.equal(result.session.source, "codex");
  assert.equal(result.session.parseStatus, "ok");
  assert.equal(result.messages.length, 3);
  assert.equal(result.messages[0].role, "user");
  assert.equal(result.messages[2].role, "tool");
  assert.equal(result.diagnostics.failedLines, 0);
});

test("CodexParser tolerates invalid lines", () => {
  const result = new CodexParser().parseText("{\"type\":\"message\",\"actor\":\"user\",\"content\":\"hi\"}\nnot-json\n", {
    sourcePath: "broken.jsonl"
  });

  assert.equal(result.session.parseStatus, "partial");
  assert.equal(result.messages.length, 1);
  assert.equal(result.diagnostics.failedLines, 1);
});
