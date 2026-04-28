import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { CodexParser } from "../parser/CodexParser.js";

export class CodexScanner {
  constructor(options = {}) {
    this.root = resolve(options.root || process.env.CODEX_HOME || join(homedir(), ".codex"));
    this.scanDays = Number(options.scanDays || 30);
    this.parser = options.parser || new CodexParser();
  }

  async discoverFiles() {
    const sessionsRoot = join(this.root, "sessions");
    const cutoff = Date.now() - this.scanDays * 24 * 60 * 60 * 1000;
    const files = [];
    await walk(sessionsRoot, async (filePath, entry) => {
      if (!entry.isFile()) return;
      if (!/^rollout-.*\.jsonl$/i.test(entry.name)) return;
      const fileStat = await stat(filePath);
      if (fileStat.mtimeMs < cutoff) return;
      files.push({
        path: filePath,
        mtime: fileStat.mtime.toISOString(),
        size: fileStat.size
      });
    });
    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  async scan() {
    const files = await this.discoverFiles();
    const results = [];
    for (const file of files) {
      const text = await readFile(file.path, "utf8");
      results.push(this.parser.parseText(text, {
        sourcePath: file.path,
        fileMtime: file.mtime,
        fileSize: file.size
      }));
    }
    return results;
  }
}

async function walk(dir, visitor) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path, visitor);
    } else {
      await visitor(path, entry);
    }
  }
}
