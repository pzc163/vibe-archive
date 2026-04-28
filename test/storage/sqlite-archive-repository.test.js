import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CodexParser,
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

  const diagnostics = repository.getLatestDiagnostics(parsed.session.id);
  assert.equal(diagnostics.failedLines, 0);

  repository.close();
});
