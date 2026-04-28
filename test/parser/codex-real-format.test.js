import test from "node:test";
import assert from "node:assert/strict";
import { CodexParser } from "../../packages/core/src/index.js";

test("CodexParser handles current Codex payload event format", () => {
  const jsonl = [
    JSON.stringify({
      timestamp: "2026-04-25T12:00:00Z",
      type: "session_meta",
      payload: {
        id: "sess_real",
        cwd: "/tmp/project"
      }
    }),
    JSON.stringify({
      timestamp: "2026-04-25T12:00:01Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "developer",
        content: [{ type: "input_text", text: "developer context" }]
      }
    }),
    JSON.stringify({
      timestamp: "2026-04-25T12:00:02Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "large injected context" }]
      }
    }),
    JSON.stringify({
      timestamp: "2026-04-25T12:00:03Z",
      type: "event_msg",
      payload: {
        type: "user_message",
        message: "实现真实格式解析"
      }
    }),
    JSON.stringify({
      timestamp: "2026-04-25T12:00:04Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "我来实现。" }]
      }
    }),
    JSON.stringify({
      timestamp: "2026-04-25T12:00:05Z",
      type: "event_msg",
      payload: {
        type: "exec_command_end",
        command: "npm test",
        stdout: "ok",
        stderr: "",
        exit_code: 0,
        status: "success"
      }
    })
  ].join("\n");

  const parsed = new CodexParser().parseText(jsonl, { sourcePath: "rollout-real.jsonl" });

  assert.equal(parsed.session.workspaceRoot, "/tmp/project");
  assert.equal(parsed.session.title, "实现真实格式解析");
  assert.equal(parsed.session.parseStatus, "ok");
  assert.deepEqual(parsed.messages.map((message) => message.role), ["system", "user", "assistant", "tool"]);
  assert.equal(parsed.messages[1].content, "实现真实格式解析");
});
