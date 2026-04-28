import { readFile } from "node:fs/promises";
import { MANIFEST_VERSION } from "../packages/core/src/index.js";

const manifestSpec = await readFile("ARCHITECTURE/Vibe_Archive_Export_Manifest_v1.0.md", "utf8");
if (!manifestSpec.includes(MANIFEST_VERSION)) {
  console.error(`Manifest 规范未包含 ${MANIFEST_VERSION}`);
  process.exit(1);
}
console.log("OK");
