import test from "node:test";
import assert from "node:assert/strict";
import { PathMasker } from "../../packages/core/src/index.js";

test("PathMasker masks home and workspace paths", () => {
  const masker = new PathMasker({ home: "/Users/alice", workspaceRoot: "/Users/alice/project" });
  const text = masker.mask("/Users/alice/project/src/App.tsx TOKEN=abc123");

  assert.equal(text, "{WORKSPACE}/src/App.tsx TOKEN={REDACTED}");
});
