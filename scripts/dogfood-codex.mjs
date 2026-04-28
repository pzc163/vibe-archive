import { existsSync } from "node:fs";
import {
  CodexScanner,
  ManifestGenerator,
  ManifestValidator,
  PROFILE_VERSIONS,
  SessionTaskBuilder,
  ShareGptExporter
} from "../packages/core/src/index.js";
import { SqliteArchiveRepository } from "../packages/core/src/node.js";
import { dirname, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const root = readOption("--root") || `${process.env.HOME}/.codex`;
const dbPath = readOption("--db") || "/tmp/vibe-archive-dogfood/archive.db";
const output = readOption("--output") || "/tmp/vibe-archive-dogfood/sharegpt.jsonl";
const scanDays = Number(readOption("--scan-days") || 7);
const purgeAfter = args.includes("--purge-after");

if (!existsSync(root)) {
  throw new Error(`Codex root not found: ${root}`);
}

await mkdir(dirname(dbPath), { recursive: true });
await mkdir(dirname(output), { recursive: true });

const repository = new SqliteArchiveRepository(dbPath);
try {
  const parsedSessions = await new CodexScanner({ root, scanDays }).scan();
  const builder = new SessionTaskBuilder();
  let messages = 0;
  let failed = 0;
  for (const parsed of parsedSessions) {
    const task = builder.build(parsed);
    repository.upsertParsedSession(parsed, task);
    messages += parsed.messages.length;
    if (parsed.session.parseStatus === "failed") failed += 1;
  }

  const tasks = repository.listTasks({ limit: 10000 });
  const jsonl = new ShareGptExporter().exportJsonl(tasks);
  await writeFile(output, jsonl, "utf8");

  const manifest = new ManifestGenerator().create({
    filePath: output,
    relativeFilePath: output.split(/[\\/]/).pop(),
    content: jsonl,
    recordCount: tasks.length,
    taskIds: tasks.map((task) => task.id),
    format: "sharegpt",
    profile: "sharegpt",
    profileVersion: profileSemver(PROFILE_VERSIONS.sharegpt),
    sourceTasksCount: tasks.length,
    sourceTools: countSourceTools(tasks)
  });
  const manifestPath = join(dirname(output), "sharegpt.manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  const verification = await new ManifestValidator().verifyFile(manifest, output);
  const leakCheck = checkPrivacyLeaks(`${jsonl}\n${JSON.stringify(manifest)}`);
  const beforePurge = {
    sessions: repository.listSessions({ limit: 10000 }).length,
    tasks: repository.listTasks({ limit: 10000 }).length,
    exports: repository.listExports({ limit: 10000 }).length
  };

  let purged;
  if (purgeAfter) {
    purged = repository.purgeAll();
  }

  console.log(JSON.stringify({
    root,
    dbPath,
    output,
    manifestPath,
    scanDays,
    importedSessions: parsedSessions.length,
    failedSessions: failed,
    messages,
    exportedRecords: tasks.length,
    manifestVerified: verification.passed,
    manifestErrors: verification.errors,
    privacyLeakCheck: leakCheck,
    beforePurge,
    purged,
    afterPurge: purgeAfter ? {
      sessions: repository.listSessions({ limit: 10000 }).length,
      tasks: repository.listTasks({ limit: 10000 }).length,
      exports: repository.listExports({ limit: 10000 }).length
    } : undefined,
    sourceRootStillExists: existsSync(root)
  }, null, 2));
} finally {
  repository.close();
}

function readOption(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function profileSemver(profileVersion) {
  return String(profileVersion || "").split("@").pop();
}

function countSourceTools(tasks) {
  const counts = {};
  for (const task of tasks) {
    const tool = task.source?.ai_tool || "unknown";
    counts[tool] = (counts[tool] || 0) + 1;
  }
  return counts;
}

function checkPrivacyLeaks(content) {
  const home = process.env.HOME || "";
  const checks = [
    home && content.includes(home),
    /\/Users\/[^/\s"']+/.test(content),
    /\/home\/[^/\s"']+/.test(content),
    /[A-Za-z]:\\Users\\[^\\\s"']+/.test(content)
  ];
  return {
    passed: checks.every((failed) => !failed),
    checkedBytes: Buffer.byteLength(content)
  };
}
