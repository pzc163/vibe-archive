import { readFile } from "node:fs/promises";

const commandSource = await readFile("packages/extension/src/commands/registerCommands.js", "utf8");
const serviceSource = await readFile("packages/extension/src/export/ShareGptExportService.js", "utf8");
const packageJson = JSON.parse(await readFile("packages/extension/package.json", "utf8"));

const failures = [];

if (!packageJson.activationEvents.includes("onCommand:vibeArchive.exportShareGPT")) {
  failures.push("extension activationEvents 缺少 vibeArchive.exportShareGPT");
}
if (!packageJson.contributes.commands.some((command) => command.command === "vibeArchive.exportShareGPT")) {
  failures.push("extension contributes.commands 缺少 vibeArchive.exportShareGPT");
}
if (!commandSource.includes("showSaveDialog") || !commandSource.includes("shareGptExportService.exportToFile")) {
  failures.push("exportShareGPT 命令未连接保存对话框和 ShareGptExportService");
}
for (const token of ["ShareGptExporter", "ManifestGenerator", "ManifestValidator", "recordExport"]) {
  if (!serviceSource.includes(token)) {
    failures.push(`ShareGptExportService 缺少 ${token}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("OK");
