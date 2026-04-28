import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexScanner } from "../../packages/core/src/index.js";

test("CodexScanner discovers and parses rollout JSONL files", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-home-"));
  const dayDir = join(root, "sessions", "2026", "04", "25");
  await mkdir(dayDir, { recursive: true });
  await writeFile(join(dayDir, "rollout-sample.jsonl"), [
    JSON.stringify({ type: "message", timestamp: "2026-04-25T10:30:00Z", actor: "user", content: "hello" }),
    JSON.stringify({ type: "message", timestamp: "2026-04-25T10:30:01Z", actor: "assistant", content: "hi" })
  ].join("\n"), "utf8");
  await writeFile(join(dayDir, "notes.jsonl"), "{}", "utf8");

  const scanner = new CodexScanner({ root, scanDays: 3650 });
  const files = await scanner.discoverFiles();
  const results = await scanner.scan();

  assert.equal(files.length, 1);
  assert.equal(results.length, 1);
  assert.equal(results[0].messages.length, 2);
  assert.equal(results[0].session.parseStatus, "ok");
});
