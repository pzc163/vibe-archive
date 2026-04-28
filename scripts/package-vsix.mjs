import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const target = readOption("--target") || process.env.VSCODE_TARGET || "";
const preRelease = process.argv.includes("--pre-release") || process.env.VSCODE_PRE_RELEASE === "true";
const suffix = target ? `-${target}` : "";
const extensionPackage = JSON.parse(readFileSync(resolve("packages/extension/package.json"), "utf8"));
const outPath = resolve(`dist/vibe-archive-${extensionPackage.version}${suffix}.vsix`);
await mkdir(resolve("dist"), { recursive: true });

const args = [
  "../../node_modules/@vscode/vsce/vsce",
  "package",
  "--no-dependencies",
  "--out",
  outPath
];

if (target) {
  args.push("--target", target);
}

if (preRelease) {
  args.push("--pre-release");
}

const result = spawnSync(
  process.execPath,
  args,
  {
    cwd: resolve("packages/extension"),
    stdio: "inherit"
  }
);

process.exitCode = result.status || 0;

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}
