import { homedir } from "node:os";

export class PathMasker {
  constructor(options = {}) {
    this.home = options.home || homedir();
    this.workspaceRoot = options.workspaceRoot;
    this.sensitiveEnvKeys = options.sensitiveEnvKeys || ["TOKEN", "SECRET", "KEY", "PASSWORD"];
  }

  mask(value) {
    if (value == null) return value;
    let text = String(value);
    if (this.workspaceRoot) {
      text = replaceAll(text, this.workspaceRoot, "{WORKSPACE}");
    }
    if (this.home) {
      text = replaceAll(text, this.home, "{HOME}");
    }
    text = text.replace(/\/Users\/[^/\s"']+/g, "{HOME}");
    text = text.replace(/\/home\/[^/\s"']+/g, "{HOME}");
    text = text.replace(/[A-Za-z]:\\Users\\[^\\\s"']+/g, "{HOME}");
    text = redactSensitiveAssignments(text, this.sensitiveEnvKeys);
    text = redactSensitiveFileTokens(text);
    return text;
  }

  maskObject(value, parentKey = "") {
    if (isSensitiveKey(parentKey, this.sensitiveEnvKeys)) return "{REDACTED}";
    if (typeof value === "string") return this.mask(value);
    if (Array.isArray(value)) return value.map((item) => this.maskObject(item, parentKey));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.maskObject(item, key)]));
    }
    return value;
  }
}

function replaceAll(text, search, replacement) {
  return text.split(search).join(replacement);
}

function redactSensitiveAssignments(text, keys) {
  const keyword = keys.map(escapeRegExp).join("|");
  const envPattern = new RegExp(`(\\b(?:export\\s+)?[A-Z0-9_]*(?:${keyword})[A-Z0-9_]*\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s"'\\\`]+)`, "gi");
  const kvPattern = new RegExp(`(["']?[A-Z0-9_.-]*(?:${keyword})[A-Z0-9_.-]*["']?\\s*:\\s*)(?:"[^"]*"|'[^']*'|[^\\s,}]+)`, "gi");
  return text
    .replace(envPattern, "$1{REDACTED}")
    .replace(kvPattern, "$1{REDACTED}");
}

function redactSensitiveFileTokens(text) {
  return text.replace(/[^\s"'`:,;{}()[\]]+/g, (token) => isSensitiveFileToken(token) ? "{SENSITIVE_FILE}" : token);
}

function isSensitiveFileToken(token) {
  const normalized = String(token).replace(/\\/g, "/");
  const basename = normalized.split("/").pop() || normalized;
  return /^\.env(?:\.|$)/i.test(basename) || /\.(?:pem|key)$/i.test(basename);
}

function isSensitiveKey(key, keys) {
  if (!key) return false;
  const value = String(key);
  if (/(token|secret|password)/i.test(value)) return true;
  if (/^key$/i.test(value)) return true;
  if (/(^|[_.-])key($|[_.-])/i.test(value)) return true;
  return /Key$/.test(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
