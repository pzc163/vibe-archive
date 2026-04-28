import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CodexParser,
  JsonArchiveRepository,
  SessionTaskBuilder
} from "../../packages/core/src/index.js";
import { SqliteArchiveRepository } from "../../packages/core/src/node.js";

test("SqliteArchiveRepository stores parsed sessions, messages, tasks, and migrations", async () => {
  const text = await readFile("test/fixtures/codex-session.sample.jsonl", "utf8");
  const parsed = new CodexParser().parseText(text, { sourcePath: "rollout-sample.jsonl" });
  const task = new SessionTaskBuilder().build(parsed);
  const repository = new SqliteArchiveRepository(":memory:");

  repository.upsertParsedSession(parsed, task);
  repository.upsertParsedSession(parsed, task);

  const sessions = repository.listSessions();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, parsed.session.id);

  const messages = repository.getMessages(parsed.session.id);
  assert.equal(messages.length, 3);

  const storedTask = repository.getTaskBySessionId(parsed.session.id);
  assert.equal(storedTask.id, task.id);

  const tasks = repository.listTasks();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, task.id);

  const migrations = repository.listMigrations();
  assert.equal(migrations.some((migration) => migration.id === "v0.4.1-init"), true);
  assert.equal(migrations.some((migration) => migration.id === "v0.4.1-indexes"), true);

  const diagnostics = repository.getLatestDiagnostics(parsed.session.id);
  assert.equal(diagnostics.failedLines, 0);

  repository.upsertImportOffset({
    sourcePath: parsed.session.sourcePath,
    source: "codex",
    offset: 120,
    fileSize: 240,
    fileMtime: parsed.session.sourceFileMtime,
    pendingBuffer: "half",
    updatedAt: "2026-04-28T00:00:00.000Z"
  });
  assert.equal(repository.getImportOffset(parsed.session.sourcePath).pendingBuffer, "half");
  assert.equal(repository.listImportOffsets().length, 1);

  repository.recordExport({
    id: "export_1",
    format: "sharegpt",
    filePath: "/tmp/sharegpt.jsonl",
    manifestPath: "/tmp/sharegpt.manifest.json",
    sessionCount: 1,
    messageCount: 3,
    filter: { source: "codex" }
  });
  const exports = repository.listExports();
  assert.equal(exports.length, 1);
  assert.equal(exports[0].format, "sharegpt");
  assert.equal(exports[0].filter.source, "codex");

  const indexes = repository.db.prepare("PRAGMA index_list('messages')").all();
  assert.equal(indexes.some((index) => index.name === "idx_messages_session_sequence"), true);

  const purged = repository.purgeAll();
  assert.equal(purged.sessions, 1);
  assert.equal(purged.messages, 3);
  assert.equal(purged.tasks, 1);
  assert.equal(purged.diagnostics, 2);
  assert.equal(purged.exports, 1);
  assert.equal(purged.importOffsets, 1);
  assert.equal(repository.listSessions().length, 0);
  assert.equal(repository.listTasks().length, 0);
  assert.equal(repository.listExports().length, 0);
  assert.equal(repository.listImportOffsets().length, 0);
  assert.equal(repository.listMigrations().length > 0, true);

  repository.close();
});

test("JsonArchiveRepository stores sessions, offsets, exports, and migrations", async () => {
  const text = await readFile("test/fixtures/codex-session.sample.jsonl", "utf8");
  const parsed = new CodexParser().parseText(text, { sourcePath: "rollout-json-repo.jsonl" });
  const task = new SessionTaskBuilder().build(parsed);
  const dir = await mkdtemp(join(tmpdir(), "vibe-json-repo-"));
  const repository = new JsonArchiveRepository(join(dir, "archive.json"));

  repository.upsertParsedSession(parsed, task);
  repository.upsertParsedSession(parsed, task);

  assert.equal(repository.listSessions().length, 1);
  assert.equal(repository.getMessages(parsed.session.id).length, 3);
  assert.equal(repository.getTaskBySessionId(parsed.session.id).id, task.id);
  assert.equal(repository.getLatestDiagnostics(parsed.session.id).failedLines, 0);

  repository.upsertImportOffset({
    sourcePath: parsed.session.sourcePath,
    source: "codex",
    offset: 12,
    fileSize: 20,
    pendingBuffer: "",
    updatedAt: "2026-04-28T00:00:00.000Z"
  });
  assert.equal(repository.getImportOffset(parsed.session.sourcePath).offset, 12);

  repository.recordExport({
    id: "json_export_1",
    format: "sharegpt",
    filePath: "/tmp/sharegpt.jsonl",
    sessionCount: 1,
    messageCount: 3
  });
  assert.equal(repository.listExports()[0].id, "json_export_1");
  assert.equal(repository.listMigrations().some((migration) => migration.id === "json-v0.4.1-init"), true);

  const purged = repository.purgeAll();
  assert.equal(purged.sessions, 1);
  assert.equal(purged.messages, 3);
  assert.equal(purged.tasks, 1);
  assert.equal(purged.diagnostics, 1);
  assert.equal(purged.exports, 1);
  assert.equal(purged.importOffsets, 1);
  assert.equal(repository.listSessions().length, 0);
  assert.equal(repository.listTasks().length, 0);
  assert.equal(repository.listExports().length, 0);
  assert.equal(repository.listImportOffsets().length, 0);
  assert.equal(repository.listMigrations().some((migration) => migration.id === "json-v0.4.1-init"), true);
});
