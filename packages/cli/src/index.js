#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  CodexScanner,
  ManifestGenerator,
  ManifestValidator,
  PROFILE_VERSIONS,
  SemanticValidator,
  SessionTaskBuilder,
  ShareGptExporter
} from "../../core/src/index.js";
import { SqliteArchiveRepository } from "../../core/src/node.js";

const args = process.argv.slice(2);

async function main() {
  const [command, subcommand] = args;
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (command === "validate") {
    await validateTask(args.slice(1));
    return;
  }
  if (command === "export") {
    await exportDataset(args.slice(1));
    return;
  }
  if (command === "import-codex") {
    await importCodex(args.slice(1));
    return;
  }
  if (command === "db" && subcommand === "sessions") {
    await listDbSessions(args.slice(2));
    return;
  }
  if (command === "db" && subcommand === "show") {
    await showDbSession(args.slice(2));
    return;
  }
  if (command === "manifest" && subcommand === "validate") {
    await validateManifest(args.slice(2));
    return;
  }
  if (command === "manifest" && subcommand === "verify") {
    await verifyManifest(args.slice(2));
    return;
  }
  throw new Error(`Unknown command: ${args.join(" ")}`);
}

function printHelp() {
  console.log(`Vibe Archive CLI

Usage:
  vibe-archive validate <file>
  vibe-archive import-codex --root <codex-home> --db <archive.db> [--scan-days 30]
  vibe-archive db sessions --db <archive.db> [--limit 20] [--format json|table]
  vibe-archive db show <session-id> --db <archive.db> [--messages 10]
  vibe-archive export --format sharegpt --input <task.json> --output <dataset.jsonl>
  vibe-archive export --format sharegpt --db <archive.db> --output <dataset.jsonl>
  vibe-archive manifest validate <manifest.json>
  vibe-archive manifest verify <manifest.json> --data <dataset.jsonl>
`);
}

async function validateTask(argv) {
  const file = argv[0];
  if (!file) throw new Error("validate requires <file>");
  const task = JSON.parse(await readFile(file, "utf8"));
  const result = new SemanticValidator().validate(task);
  printResult(result);
}

async function exportDataset(argv) {
  const format = readOption(argv, "--format") || "sharegpt";
  const input = readOption(argv, "--input");
  const dbPath = readOption(argv, "--db");
  const output = readOption(argv, "--output");
  if (format !== "sharegpt") throw new Error(`Unsupported format: ${format}`);
  if (!output) throw new Error("export requires --output");
  if (!input && !dbPath) throw new Error("export requires --input or --db");
  const tasks = input ? await loadTasksFromFile(input) : loadTasksFromDb(dbPath);
  const jsonl = new ShareGptExporter().exportJsonl(tasks);
  await writeFile(output, jsonl, "utf8");
  const profileVersion = profileSemver(PROFILE_VERSIONS.sharegpt);
  const manifest = new ManifestGenerator().create({
    filePath: output,
    relativeFilePath: output.split("/").pop(),
    content: jsonl,
    recordCount: tasks.length,
    taskIds: tasks.map((task) => task.id),
    format: "sharegpt",
    profile: "sharegpt",
    profileVersion,
    sourceTasksCount: tasks.length,
    sourceTools: countSourceTools(tasks)
  });
  const manifestPath = join(dirname(output), "sharegpt.manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  const verification = await new ManifestValidator().verifyFile(manifest, output);
  if (!verification.passed) {
    throw new Error(`export verification failed: ${verification.errors.map((error) => error.message).join("; ")}`);
  }
  if (dbPath) {
    recordDbExport(dbPath, {
      id: manifest.dataset_id,
      createdAt: manifest.source.generated_at,
      format,
      filePath: output,
      manifestPath,
      sessionCount: tasks.length,
      messageCount: countExportedMessages(tasks),
      filter: manifest.pipeline.filter_config
    });
  }
  console.log(`Exported ${tasks.length} records to ${output}`);
  console.log(`Wrote manifest to ${manifestPath}`);
}

async function loadTasksFromFile(input) {
  const loaded = JSON.parse(await readFile(input, "utf8"));
  return Array.isArray(loaded) ? loaded : [loaded];
}

function loadTasksFromDb(dbPath) {
  const repository = new SqliteArchiveRepository(dbPath);
  const tasks = repository.listTasks({ limit: 10000 });
  repository.close();
  return tasks;
}

async function importCodex(argv) {
  const root = readOption(argv, "--root");
  const dbPath = readOption(argv, "--db") || "archive.db";
  const scanDays = Number(readOption(argv, "--scan-days") || 30);
  const scanner = new CodexScanner({ root, scanDays });
  const repository = new SqliteArchiveRepository(dbPath);
  const taskBuilder = new SessionTaskBuilder();
  const parsedSessions = await scanner.scan();

  let imported = 0;
  let failed = 0;
  let messages = 0;
  for (const parsed of parsedSessions) {
    const task = taskBuilder.build(parsed);
    repository.upsertParsedSession(parsed, task);
    imported += 1;
    messages += parsed.messages.length;
    if (parsed.session.parseStatus === "failed") failed += 1;
  }
  repository.close();
  console.log(JSON.stringify({
    imported,
    failed,
    messages,
    db: dbPath,
    root: scanner.root
  }, null, 2));
}

async function listDbSessions(argv) {
  const dbPath = readOption(argv, "--db") || "archive.db";
  const limit = Number(readOption(argv, "--limit") || 20);
  const format = readOption(argv, "--format") || "json";
  const repository = new SqliteArchiveRepository(dbPath);
  const sessions = repository.listSessions({ limit });
  repository.close();
  if (format === "table") {
    printSessionsTable(sessions);
  } else {
    console.log(JSON.stringify(sessions, null, 2));
  }
}

async function showDbSession(argv) {
  const sessionId = argv.find((item) => !item.startsWith("--"));
  const dbPath = readOption(argv, "--db") || "archive.db";
  const messageLimit = Number(readOption(argv, "--messages") || 10);
  if (!sessionId) throw new Error("db show requires <session-id>");

  const repository = new SqliteArchiveRepository(dbPath);
  const session = repository.getSession(sessionId);
  if (!session) {
    repository.close();
    throw new Error(`Session not found: ${sessionId}`);
  }
  const messages = repository.getMessages(sessionId).slice(0, messageLimit);
  const task = repository.getTaskBySessionId(sessionId);
  const diagnostics = repository.getLatestDiagnostics(sessionId);
  repository.close();

  console.log(JSON.stringify({
    session,
    task: task ? {
      id: task.id,
      intent: task.task?.intent,
      type: task.task?.type,
      languages: task.metadata?.languages || [],
      trainingReady: task.metadata?.training_ready
    } : null,
    diagnostics,
    messages: messages.map((message) => ({
      sequence: message.sequence,
      role: message.role,
      timestamp: message.timestamp,
      rawType: message.rawType,
      toolName: message.toolName,
      contentPreview: preview(message.content, 240)
    }))
  }, null, 2));
}

async function validateManifest(argv) {
  const file = argv[0];
  if (!file) throw new Error("manifest validate requires <manifest.json>");
  const manifest = JSON.parse(await readFile(file, "utf8"));
  printResult(new ManifestValidator().validate(manifest));
}

async function verifyManifest(argv) {
  const file = argv[0];
  const data = readOption(argv, "--data");
  if (!file || !data) throw new Error("manifest verify requires <manifest.json> --data <dataset.jsonl>");
  const manifest = JSON.parse(await readFile(file, "utf8"));
  printResult(await new ManifestValidator().verifyFile(manifest, data));
}

function readOption(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function printResult(result) {
  if (result.passed) {
    console.log("OK");
    if (result.warnings?.length) {
      console.error(JSON.stringify({ warnings: result.warnings }, null, 2));
    }
    return;
  }
  console.error(JSON.stringify({ errors: result.errors, warnings: result.warnings || [] }, null, 2));
  process.exitCode = 1;
}

function countSourceTools(tasks) {
  const counts = {};
  for (const task of tasks) {
    const tool = task.source?.ai_tool || "unknown";
    counts[tool] = (counts[tool] || 0) + 1;
  }
  return counts;
}

function countExportedMessages(tasks) {
  return tasks.reduce((total, task) => total + (task.sessions || []).reduce((sessionTotal, session) => sessionTotal + (session.conversation || []).length, 0), 0);
}

function profileSemver(profileVersion) {
  return String(profileVersion || "").split("@").pop();
}

function recordDbExport(dbPath, record) {
  const repository = new SqliteArchiveRepository(dbPath);
  repository.recordExport(record);
  repository.close();
}

function printSessionsTable(sessions) {
  const rows = sessions.map((session) => ({
    id: session.id,
    status: session.parseStatus,
    messages: session.messageCount,
    tools: session.toolCallCount,
    workspace: session.workspaceRoot || "",
    title: preview(session.title || "", 60)
  }));
  const columns = [
    ["id", 48],
    ["status", 8],
    ["messages", 8],
    ["tools", 6],
    ["title", 60]
  ];
  console.log(columns.map(([name, width]) => pad(name, width)).join("  "));
  console.log(columns.map(([, width]) => "-".repeat(width)).join("  "));
  for (const row of rows) {
    console.log(columns.map(([name, width]) => pad(String(row[name]), width)).join("  "));
  }
}

function pad(value, width) {
  const text = preview(value, width);
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function preview(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? text.slice(0, Math.max(0, maxLength - 1)) + "…" : text;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
