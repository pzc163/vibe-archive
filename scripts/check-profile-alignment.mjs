import { readFile } from "node:fs/promises";
import { PROFILE_VERSIONS } from "../packages/core/src/index.js";

const failures = [];

for (const [profileName, version] of Object.entries(PROFILE_VERSIONS)) {
  const profile = await readFile(`Profile/${profileName}.md`, "utf8");
  if (!profile.includes(`Profile Version**: \`${version}\``)) {
    failures.push(`Profile/${profileName}.md 缺少 Profile Version ${version}`);
  }
  if (!profile.includes(`profile_version`) || !profile.includes(version)) {
    failures.push(`Profile/${profileName}.md 未在输出规范中包含 ${version}`);
  }
  if (!profile.includes("**状态**: Stable")) {
    failures.push(`Profile/${profileName}.md 状态不是 Stable`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("OK");
