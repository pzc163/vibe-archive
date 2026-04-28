import { SHAREGPT_PROFILE_VERSION } from "../model/types.js";

export class ShareGptProfileValidator {
  validateRecord(record, context = {}) {
    const errors = [];
    const prefix = context.line ? `line ${context.line}: ` : "";

    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return { passed: false, errors: [{ message: `${prefix}record must be an object` }] };
    }
    if (!record.id || typeof record.id !== "string") {
      errors.push({ message: `${prefix}id is required` });
    }
    if (!Array.isArray(record.conversations) || record.conversations.length === 0) {
      errors.push({ message: `${prefix}conversations must be a non-empty array` });
    }
    for (const [index, message] of (record.conversations || []).entries()) {
      if (!["human", "gpt"].includes(message?.from)) {
        errors.push({ message: `${prefix}conversations[${index}].from must be human or gpt` });
      }
      if (typeof message?.value !== "string" || !message.value.trim()) {
        errors.push({ message: `${prefix}conversations[${index}].value must be a non-empty string` });
      }
    }
    if (record.metadata?.profile_version !== SHAREGPT_PROFILE_VERSION) {
      errors.push({ message: `${prefix}metadata.profile_version must be ${SHAREGPT_PROFILE_VERSION}` });
    }

    return { passed: errors.length === 0, errors };
  }

  validateJsonl(content) {
    const errors = [];
    const lines = String(content || "").split(/\r?\n/).filter((line) => line.trim());
    for (const [index, line] of lines.entries()) {
      try {
        const result = this.validateRecord(JSON.parse(line), { line: index + 1 });
        errors.push(...result.errors);
      } catch (error) {
        errors.push({ message: `line ${index + 1}: invalid JSON: ${error instanceof Error ? error.message : String(error)}` });
      }
    }
    return { passed: errors.length === 0, errors };
  }
}
