import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PathMasker, SHAREGPT_PROFILE_VERSION, ShareGptExporter, ShareGptProfileValidator } from "../../packages/core/src/index.js";

test("ShareGptExporter exports ShareGPT JSONL", async () => {
  const task = JSON.parse(await readFile("test/fixtures/task.sample.json", "utf8"));
  const exporter = new ShareGptExporter();
  const record = exporter.exportTask(task);

  assert.equal(record.id, "task_sample");
  assert.equal(record.conversations[0].from, "human");
  assert.equal(record.conversations[1].from, "gpt");
  assert.equal(record.metadata.profile_version, SHAREGPT_PROFILE_VERSION);
});

test("ShareGptExporter masks private paths and secrets in exported JSONL", () => {
  const task = {
    id: "task_private",
    source: { ai_tool: "codex" },
    metadata: { languages: ["typescript"] },
    sessions: [
      {
        session_id: "session_private",
        user_feedback: "unknown",
        conversation: [
          {
            role: "user",
            content: String.raw`Open /Users/alice/project/src/app.ts and C:\Users\bob\secret.key PASSWORD=abc`
          },
          {
            role: "assistant",
            content: "Read /home/carol/project/.env.local and cert.pem"
          }
        ]
      }
    ]
  };
  const exporter = new ShareGptExporter({
    pathMasker: new PathMasker({ home: "/Users/alice", workspaceRoot: "/Users/alice/project" })
  });

  const jsonl = exporter.exportJsonl([task]);

  assert.equal(jsonl.includes("/Users/alice"), false);
  assert.equal(jsonl.includes("/home/carol"), false);
  assert.equal(jsonl.includes(String.raw`C:\Users\bob`), false);
  assert.equal(jsonl.includes("PASSWORD=abc"), false);
  assert.equal(jsonl.includes(".env.local"), false);
  assert.equal(jsonl.includes("secret.key"), false);
  assert.equal(jsonl.includes("cert.pem"), false);
});

test("ShareGptProfileValidator rejects records outside sharegpt@1.0.0", () => {
  const validator = new ShareGptProfileValidator();
  const result = validator.validateJsonl([
    JSON.stringify({
      id: "task_bad",
      conversations: [{ from: "assistant", value: "" }],
      metadata: { profile_version: "sharegpt@0.9.0" }
    }),
    "{not-json"
  ].join("\n"));

  assert.equal(result.passed, false);
  assert.equal(result.errors.some((error) => error.message.includes("from must be human or gpt")), true);
  assert.equal(result.errors.some((error) => error.message.includes("profile_version")), true);
  assert.equal(result.errors.some((error) => error.message.includes("invalid JSON")), true);
});
