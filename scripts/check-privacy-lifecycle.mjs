import { readFile } from "node:fs/promises";

const repositoryInterface = await readFile("packages/core/src/storage/ArchiveRepository.js", "utf8");
const sqliteRepository = await readFile("packages/core/src/storage/SqliteArchiveRepository.js", "utf8");
const jsonRepository = await readFile("packages/core/src/storage/JsonArchiveRepository.js", "utf8");
const commandSource = await readFile("packages/extension/src/commands/registerCommands.js", "utf8");
const purgeService = await readFile("packages/extension/src/privacy/PurgeService.js", "utf8");

const failures = [];

for (const [name, source] of [
  ["ArchiveRepository", repositoryInterface],
  ["SqliteArchiveRepository", sqliteRepository],
  ["JsonArchiveRepository", jsonRepository],
  ["PurgeService", purgeService]
]) {
  if (!source.includes("purgeAll")) {
    failures.push(`${name} 缺少 purgeAll`);
  }
}

for (const token of ["showWarningMessage", "It will not delete Codex source files", "purgeService.purgeAll", "sessionsTreeProvider.refresh"]) {
  if (!commandSource.includes(token)) {
    failures.push(`vibeArchive.purgeData 缺少 ${token}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("OK");
