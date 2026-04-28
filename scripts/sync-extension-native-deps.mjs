import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = resolve("node_modules/better-sqlite3/build/Release/better_sqlite3.node");
const target = resolve("packages/extension/dist/native/better_sqlite3.node");

await mkdir(dirname(target), { recursive: true });
await cp(source, target, { force: true });
console.log("Synced better_sqlite3.node -> packages/extension/dist/native/better_sqlite3.node");
