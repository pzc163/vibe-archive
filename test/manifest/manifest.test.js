import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("ManifestValidator verifies ShareGPT JSONL profile constraints", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vibe-manifest-sharegpt-"));
  const dataPath = join(dir, "sharegpt.jsonl");
  const content = JSON.stringify({
    id: "task_sample",
    conversations: [{ from: "human", value: "hello" }, { from: "gpt", value: "hi" }],
    metadata: { profile_version: "sharegpt@1.0.0" }
  }) + "\n";
  await writeFile(dataPath, content, "utf8");
  const manifest = new ManifestGenerator().create({
    filePath: dataPath,
    relativeFilePath: "sharegpt.jsonl",
    content,
    recordCount: 1,
    taskIds: ["task_sample"],
    profile: "sharegpt",
    profileVersion: "1.0.0"
  });

  assert.equal((await new ManifestValidator().verifyFile(manifest, dataPath)).passed, true);

  const invalidPath = join(dir, "invalid.jsonl");
  const invalidContent = JSON.stringify({
    id: "task_bad",
    conversations: [{ from: "system", value: "hidden" }],
    metadata: { profile_version: "sharegpt@1.0.0" }
  }) + "\n";
  await writeFile(invalidPath, invalidContent, "utf8");
  const invalidManifest = new ManifestGenerator().create({
    filePath: invalidPath,
    relativeFilePath: "invalid.jsonl",
    content: invalidContent,
    recordCount: 1,
    taskIds: ["task_bad"],
    profile: "sharegpt",
    profileVersion: "1.0.0"
  });
  const invalidResult = await new ManifestValidator().verifyFile(invalidManifest, invalidPath);

  assert.equal(invalidResult.passed, false);
  assert.equal(invalidResult.errors.some((error) => error.message.includes("sharegpt profile mismatch")), true);
});
