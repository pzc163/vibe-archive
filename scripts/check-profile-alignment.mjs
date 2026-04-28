import { readFile } from "node:fs/promises";
import { SHAREGPT_PROFILE_VERSION } from "../packages/core/src/index.js";

const profile = await readFile("Profile/sharegpt.md", "utf8");
if (!profile.includes(SHAREGPT_PROFILE_VERSION)) {
  console.error(`ShareGPT Profile 未包含 ${SHAREGPT_PROFILE_VERSION}`);
  process.exit(1);
}
console.log("OK");
