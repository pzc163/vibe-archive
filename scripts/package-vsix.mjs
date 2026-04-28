import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const target = readOption("--target") || process.env.VSCODE_TARGET || "";
const suffix = target ? `-${target}` : "";
const outPath = resolve(`dist/vibe-archive-0.1.0-alpha.0${suffix}.vsix`);
await mkdir(resolve("dist"), { recursive: true });

const args = [
  "../../node_modules/@vscode/vsce/vsce",
  "package",
  "--no-dependencies",
  "--skip-license",
  "--out",
  outPath
];

if (target) {
  args.push("--target", target);
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
