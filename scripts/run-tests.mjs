import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const roots = process.argv.slice(2);

if (roots.length === 0) {
  console.error("Usage: node scripts/run-tests.mjs <test-dir-or-file> [...]");
  process.exit(1);
}

const testFiles = [];

function collectTests(target) {
  if (!fs.existsSync(target)) {
    throw new Error(`Test target does not exist: ${target}`);
  }

  const stat = fs.statSync(target);

  if (stat.isFile()) {
    if (target.endsWith(".test.js")) {
      testFiles.push(path.resolve(target));
    }
    return;
  }

  if (!stat.isDirectory()) {
    return;
  }

  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    collectTests(path.join(target, entry.name));
  }
}

try {
  for (const root of roots) {
    collectTests(root);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const sortedFiles = [...new Set(testFiles)].sort();

if (sortedFiles.length === 0) {
  console.error(`No .test.js files found under: ${roots.join(", ")}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...sortedFiles], {
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
