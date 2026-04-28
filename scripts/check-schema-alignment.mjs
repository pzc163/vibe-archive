import { readFile } from "node:fs/promises";
import { TASK_SCHEMA_VERSION } from "../packages/core/src/index.js";

const standard = await readFile("Data_Standard/Vibe_Archive_Data_Standard_v0.4.1.md", "utf8");
if (!standard.includes(TASK_SCHEMA_VERSION)) {
  console.error(`标准文档未包含 ${TASK_SCHEMA_VERSION}`);
  process.exit(1);
}
console.log("OK");
