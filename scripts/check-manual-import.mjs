import { readFile } from "node:fs/promises";

const commandSource = await readFile("packages/extension/src/commands/registerCommands.js", "utf8");
const serviceSource = await readFile("packages/extension/src/import/ManualImportService.js", "utf8");
const packageJson = JSON.parse(await readFile("packages/extension/package.json", "utf8"));

const failures = [];

if (!packageJson.activationEvents.includes("onCommand:vibeArchive.importJsonl")) {
  failures.push("extension activationEvents 缺少 vibeArchive.importJsonl");
}
if (!packageJson.contributes.commands.some((command) => command.command === "vibeArchive.importJsonl")) {
  failures.push("extension contributes.commands 缺少 vibeArchive.importJsonl");
}
for (const token of ["showOpenDialog", "showQuickPick", "manualImportService.preview", "manualImportService.importFiles", "sessionsTreeProvider.refresh"]) {
  if (!commandSource.includes(token)) {
    failures.push(`vibeArchive.importJsonl 命令缺少 ${token}`);
  }
}
for (const token of ["discoverImportFiles", "CodexParser", "SessionTaskBuilder", "upsertParsedSession", "parseStatus === \"failed\""]) {
  if (!serviceSource.includes(token)) {
    failures.push(`ManualImportService 缺少 ${token}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("OK");
