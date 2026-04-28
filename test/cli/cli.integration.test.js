import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("CLI validates and exports sample task", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vibe-archive-"));
  const output = join(dir, "sharegpt.jsonl");

  const validate = spawnSync(process.execPath, ["packages/cli/src/index.js", "validate", "test/fixtures/task.sample.json"], {
    encoding: "utf8"
  });
  assert.equal(validate.status, 0, validate.stderr);

  const exported = spawnSync(process.execPath, [
    "packages/cli/src/index.js",
    "export",
    "--format",
    "sharegpt",
    "--input",
    "test/fixtures/task.sample.json",
    "--output",
    output
  ], { encoding: "utf8" });
  assert.equal(exported.status, 0, exported.stderr);

  const jsonl = await readFile(output, "utf8");
  assert.match(jsonl, /task_sample/);

  const manifest = join(dir, "sharegpt.manifest.json");
  const verify = spawnSync(process.execPath, ["packages/cli/src/index.js", "manifest", "verify", manifest, "--data", output], {
    encoding: "utf8"
  });
  assert.equal(verify.status, 0, verify.stderr);
});

test("CLI imports Codex sessions into SQLite and lists sessions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vibe-archive-import-"));
  const codexRoot = join(dir, "codex-home");
  const sessionDir = join(codexRoot, "sessions", "2026", "04", "25");
  const dbPath = join(dir, "archive.db");
  await mkdir(sessionDir, { recursive: true });
  await writeFile(join(sessionDir, "rollout-import.jsonl"), [
    JSON.stringify({ type: "message", timestamp: "2026-04-25T10:30:00Z", actor: "user", content: "实现导入命令" }),
    JSON.stringify({ type: "message", timestamp: "2026-04-25T10:30:10Z", actor: "assistant", content: "开始实现。" })
  ].join("\n"), "utf8");

  const imported = spawnSync(process.execPath, [
    "packages/cli/src/index.js",
    "import-codex",
    "--root",
    codexRoot,
    "--db",
    dbPath,
    "--scan-days",
    "3650"
  ], { encoding: "utf8" });
  assert.equal(imported.status, 0, imported.stderr);
  assert.match(imported.stdout, /"imported": 1/);

  const listed = spawnSync(process.execPath, [
    "packages/cli/src/index.js",
    "db",
    "sessions",
    "--db",
    dbPath
  ], { encoding: "utf8" });
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /实现导入命令/);

  const table = spawnSync(process.execPath, [
    "packages/cli/src/index.js",
    "db",
    "sessions",
    "--db",
    dbPath,
    "--format",
    "table"
  ], { encoding: "utf8" });
  assert.equal(table.status, 0, table.stderr);
  assert.match(table.stdout, /messages/);

  const sessions = JSON.parse(listed.stdout);
  const shown = spawnSync(process.execPath, [
    "packages/cli/src/index.js",
    "db",
    "show",
    sessions[0].id,
    "--db",
    dbPath,
    "--messages",
    "2"
  ], { encoding: "utf8" });
  assert.equal(shown.status, 0, shown.stderr);
  assert.match(shown.stdout, /diagnostics/);
  assert.match(shown.stdout, /实现导入命令/);

  const output = join(dir, "sharegpt-from-db.jsonl");
  const exported = spawnSync(process.execPath, [
    "packages/cli/src/index.js",
    "export",
    "--format",
    "sharegpt",
    "--db",
    dbPath,
    "--output",
    output
  ], { encoding: "utf8" });
  assert.equal(exported.status, 0, exported.stderr);
  assert.match(await readFile(output, "utf8"), /实现导入命令/);
  assert.match(await readFile(join(dir, "sharegpt.manifest.json"), "utf8"), /vibe-archive.manifest.v1.0/);
});
