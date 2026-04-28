import { readFile } from "node:fs/promises";

const requiredRules = Array.from({ length: 15 }, (_, index) => `VA-${String(index + 1).padStart(3, "0")}`);
const standard = await readFile("Data_Standard/Vibe_Archive_Data_Standard_v0.4.1.md", "utf8");
const validator = await readFile("packages/core/src/validation/SemanticValidator.js", "utf8");
const tests = await readFile("test/validation/semantic-validator.test.js", "utf8");

const failures = [];

for (const rule of requiredRules) {
  if (!standard.includes(`\`${rule}\``)) {
    failures.push(`标准文档缺少 ${rule}`);
  }
  if (!validator.includes(`"${rule}"`)) {
    failures.push(`SemanticValidator 未实现 ${rule}`);
  }
  if (!tests.includes(`"${rule}"`)) {
    failures.push(`SemanticValidator 测试未覆盖 ${rule}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("OK");
