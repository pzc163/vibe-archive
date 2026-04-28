import { readFile } from "node:fs/promises";
import { MANIFEST_VERSION } from "../model/types.js";
import { checksumBuffer } from "./ManifestGenerator.js";

export class ManifestValidator {
  validate(manifest) {
    const errors = [];
    if (!manifest || typeof manifest !== "object") {
      return { passed: false, errors: [{ message: "manifest must be an object" }] };
    }
    if (manifest.manifest_version !== MANIFEST_VERSION) errors.push({ message: `manifest_version must be ${MANIFEST_VERSION}` });
    if (!manifest.dataset_id) errors.push({ message: "dataset_id is required" });
    if (!manifest.source?.schema_version) errors.push({ message: "source.schema_version is required" });
    if (!manifest.source?.profile) errors.push({ message: "source.profile is required" });
    if (!manifest.source?.profile_version) errors.push({ message: "source.profile_version is required" });
    if (!manifest.source?.generator) errors.push({ message: "source.generator is required" });
    if (!manifest.source?.generated_at) errors.push({ message: "source.generated_at is required" });
    if (typeof manifest.content?.record_count !== "number") errors.push({ message: "content.record_count is required" });
    if (!manifest.content?.file_path) errors.push({ message: "content.file_path is required" });
    if (typeof manifest.content?.file_size_bytes !== "number") errors.push({ message: "content.file_size_bytes is required" });
    if (!manifest.content?.checksum?.value) errors.push({ message: "content.checksum.value is required" });
    if (!Array.isArray(manifest.pipeline?.stages)) errors.push({ message: "pipeline.stages is required" });
    return { passed: errors.length === 0, errors };
  }

  async verifyFile(manifest, dataPath) {
    const validation = this.validate(manifest);
    if (!validation.passed) return validation;
    const content = await readFile(dataPath, "utf8");
    const checksum = checksumBuffer(content);
    const recordCount = content.trim() ? content.trim().split(/\r?\n/).length : 0;
    const errors = [];
    if (checksum !== manifest.content.checksum.value) {
      errors.push({ message: "checksum mismatch" });
    }
    if (recordCount !== manifest.content.record_count) {
      errors.push({ message: `record_count mismatch: manifest=${manifest.content.record_count}, actual=${recordCount}` });
    }
    return { passed: errors.length === 0, errors };
  }
}
