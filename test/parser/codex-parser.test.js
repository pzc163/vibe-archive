import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexParser, extractPaths, Parser } from "../../packages/core/src/index.js";

test("CodexParser parses JSONL and records diagnostics", async () => {
  const text = await readFile("test/fixtures/codex-session.sample.jsonl", "utf8");
  const result = new CodexParser().parseText(text, { sourcePath: "rollout-sample.jsonl" });

  assert.equal(result.session.source, "codex");
  assert.equal(result.session.parseStatus, "ok");
  assert.equal(result.messages.length, 3);
  assert.equal(result.messages[0].role, "user");
  assert.equal(result.messages[2].role, "tool");
  assert.equal(result.diagnostics.failedLines, 0);
});

test("CodexParser tolerates invalid lines", () => {
  const result = new CodexParser().parseText("{\"type\":\"message\",\"actor\":\"user\",\"content\":\"hi\"}\nnot-json\n", {
    sourcePath: "broken.jsonl"
  });

  assert.equal(result.session.parseStatus, "partial");
  assert.equal(result.messages.length, 1);
  assert.equal(result.diagnostics.failedLines, 1);
});

test("CodexParser implements Parser parseFile and parseLine", async () => {
  const parser = new CodexParser();
  assert.equal(parser instanceof Parser, true);
  const root = await mkdtemp(join(tmpdir(), "codex-parser-file-"));
  const file = join(root, "rollout-file.jsonl");
  await writeFile(file, JSON.stringify({ type: "message", actor: "user", content: "from file" }) + "\n", "utf8");

  const parsedFile = await parser.parseFile(file);
  const parsedLine = parser.parseLine(JSON.stringify({ type: "message", actor: "assistant", content: "from line" }), {
    sourcePath: "line.jsonl"
  });

  assert.equal(parsedFile.messages.length, 1);
  assert.equal(parsedFile.messages[0].content, "from file");
  assert.equal(parsedLine.content, "from line");
});

test("CodexParser preserves unknown fields in diagnostics and message metadata", () => {
  const parsed = new CodexParser().parseText(JSON.stringify({
    type: "message",
    actor: "user",
    content: "open src/app.ts",
    experimental_field: true
  }) + "\n", { sourcePath: "unknown.jsonl" });

  assert.deepEqual(parsed.diagnostics.unknownFieldSamples[0].fields, ["experimental_field"]);
  assert.deepEqual(parsed.messages[0].metadata._unknownFields, ["experimental_field"]);
});

test("CodexParser extracts referenced paths and changed files from tools and patches", () => {
  const jsonl = [
    JSON.stringify({
      type: "message",
      actor: "user",
      content: "Please inspect /Users/dev/project/src/app.ts and README.md"
    }),
    JSON.stringify({
      type: "command",
      command: "apply_patch",
      output: [
        "*** Begin Patch",
        "*** Update File: packages/core/src/parser/CodexParser.js",
        "@@",
        "-old",
        "+new",
        "*** End Patch"
      ].join("\n")
    }),
    JSON.stringify({
      type: "tool_call",
      name: "file_write",
      input: { path: "src/generated.ts" },
      output: "wrote src/generated.ts"
    })
  ].join("\n");

  const parsed = new CodexParser().parseText(jsonl, { sourcePath: "paths.jsonl" });
  assert.equal(parsed.messages[0].referencedFiles.includes("{HOME}/project/src/app.ts"), true);
  assert.equal(parsed.messages[0].referencedFiles.includes("README.md"), true);
  assert.equal(parsed.messages[1].changedFiles.includes("packages/core/src/parser/CodexParser.js"), true);
  assert.equal(parsed.messages[2].toolName, "file_write");
  assert.equal(parsed.messages[2].changedFiles.includes("src/generated.ts"), true);
});

test("CodexParser masks private paths, secrets, sensitive files, and source metadata", () => {
  const jsonl = [
    JSON.stringify({
      type: "message",
      actor: "user",
      content: "/Users/alice/project/src/app.ts TOKEN=abc123 .env.local",
      api_key: "secret-value"
    }),
    "{bad-json TOKEN=abc /Users/alice/project/.env.local"
  ].join("\n");

  const parsed = new CodexParser().parseText(jsonl, {
    sourcePath: "/Users/alice/.codex/sessions/rollout-private.jsonl"
  });
  const serialized = JSON.stringify(parsed);

  assert.equal(serialized.includes("/Users/alice"), false);
  assert.equal(serialized.includes("TOKEN=abc123"), false);
  assert.equal(serialized.includes("secret-value"), false);
  assert.equal(serialized.includes(".env.local"), false);
  assert.equal(serialized.includes("{HOME}"), true);
  assert.equal(serialized.includes("{SENSITIVE_FILE}"), true);
  assert.equal(parsed.session.sourcePath, "{HOME}/.codex/sessions/rollout-private.jsonl");
});

test("extractPaths handles unix, relative, and windows style paths", () => {
  const paths = extractPaths(String.raw`See /tmp/project/src/app.ts, ./README.md, and C:\Users\dev\project\config.json`);
  assert.equal(paths.includes("/tmp/project/src/app.ts"), true);
  assert.equal(paths.includes("./README.md"), true);
  assert.equal(paths.includes("C:\\Users\\dev\\project\\config.json"), true);
});
