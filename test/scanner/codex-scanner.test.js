import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexScanner } from "../../packages/core/src/index.js";
import { SqliteArchiveRepository } from "../../packages/core/src/node.js";

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

test("CodexScanner skips unchanged files and preserves half-line pending buffer", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-home-incremental-"));
  const dayDir = join(root, "sessions", "2026", "04", "25");
  const filePath = join(dayDir, "rollout-incremental.jsonl");
  await mkdir(dayDir, { recursive: true });
  await writeFile(filePath, [
    JSON.stringify({ type: "message", timestamp: "2026-04-25T10:30:00Z", actor: "user", content: "hello" }),
    JSON.stringify({ type: "message", timestamp: "2026-04-25T10:30:01Z", actor: "assistant", content: "hi" })
  ].join("\n") + "\n", "utf8");

  const repository = new SqliteArchiveRepository(":memory:");
  const scanner = new CodexScanner({ root, scanDays: 3650, offsetStore: repository });

  const first = await scanner.scan();
  const second = await scanner.scan();
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);

  await appendFile(filePath, "{\"type\":\"message\",\"actor\":\"user\",\"content\":\"half", "utf8");
  const halfLine = await scanner.scan();
  const pending = repository.getImportOffset(filePath);
  assert.equal(halfLine.length, 0);
  assert.equal(pending.pendingBuffer.includes("half"), true);

  await appendFile(filePath, " line\"}\n", "utf8");
  const completed = await scanner.scan();
  assert.equal(completed.length, 1);
  assert.equal(completed[0].messages.length, 3);
  assert.equal(repository.getImportOffset(filePath).pendingBuffer, "");

  await writeFile(filePath, JSON.stringify({ type: "message", actor: "user", content: "rotated" }) + "\n", "utf8");
  const rotated = await scanner.scan();
  assert.equal(rotated.length, 1);
  assert.equal(rotated[0].messages.length, 1);

  repository.close();
});
