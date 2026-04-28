import test from "node:test";
import assert from "node:assert/strict";
import { compactTitle, extractUserRequest } from "../../packages/core/src/index.js";

test("extractUserRequest strips IDE context wrapper", () => {
  const content = [
    "# Context from my IDE setup:",
    "",
    "## Active file: README.md",
    "",
    "## Open tabs:",
    "- README.md: README.md",
    "",
    "## My request for Codex:",
    "继续完成下一步"
  ].join("\n");

  assert.equal(extractUserRequest(content), "继续完成下一步");
  assert.equal(compactTitle(content), "继续完成下一步");
});
