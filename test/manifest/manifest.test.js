import test from "node:test";
import assert from "node:assert/strict";
import { ManifestGenerator, ManifestValidator } from "../../packages/core/src/index.js";

test("ManifestGenerator creates a valid Manifest v1.0 object", () => {
  const content = "{\"id\":\"task_sample\"}\n";
  const manifest = new ManifestGenerator().create({
    filePath: "sharegpt.jsonl",
    content,
    recordCount: 1,
    taskIds: ["task_sample"],
    profile: "sharegpt",
    profileVersion: "1.0.0"
  });
  const result = new ManifestValidator().validate(manifest);

  assert.equal(result.passed, true);
  assert.equal(manifest.content.record_count, 1);
  assert.equal(manifest.content.checksum.algorithm, "sha256");
});
