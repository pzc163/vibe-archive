import { readFile } from "node:fs/promises";

export class Parser {
  async parseFile(filePath, options = {}) {
    const text = await readFile(filePath, "utf8");
    return this.parseText(text, { ...options, sourcePath: options.sourcePath || filePath });
  }

  parseText() {
    throw new Error("Parser.parseText() must be implemented by subclasses.");
  }

  parseLine(line, options = {}) {
    const parsed = this.parseText(`${line}\n`, options);
    return parsed.messages[0];
  }
}
