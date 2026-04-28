import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const entryPoint = resolve("packages/extension/src/extension.js");
const outfile = resolve("packages/extension/dist/extension.js");

await mkdir(dirname(outfile), { recursive: true });

await esbuild.build({
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: true,
  sourcesContent: false,
  external: [
    "vscode",
    "bindings"
  ],
  logLevel: "info"
});
