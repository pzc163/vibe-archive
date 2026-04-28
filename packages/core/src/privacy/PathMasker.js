import { homedir } from "node:os";

export class PathMasker {
  constructor(options = {}) {
    this.home = options.home || homedir();
    this.workspaceRoot = options.workspaceRoot;
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
    text = text.replace(/([A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Z0-9_]*=)[^\s"']+/gi, "$1{REDACTED}");
    return text;
  }

  maskObject(value) {
    if (typeof value === "string") return this.mask(value);
    if (Array.isArray(value)) return value.map((item) => this.maskObject(item));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.maskObject(item)]));
    }
    return value;
  }
}

function replaceAll(text, search, replacement) {
  return text.split(search).join(replacement);
}
