import { readdir, readFile, stat, watch } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { CodexParser } from "../parser/CodexParser.js";
import { SourceScanner } from "./SourceScanner.js";

export class CodexScanner extends SourceScanner {
  constructor(options = {}) {
    super();
    this.root = resolve(options.root || process.env.CODEX_HOME || join(homedir(), ".codex"));
    this.scanDays = Number(options.scanDays || 30);
    this.parser = options.parser || new CodexParser();
    this.offsetStore = options.offsetStore;
    this.watcherAbortController = undefined;
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

  async scan(options = {}) {
    const files = await this.discoverFiles();
    const results = [];
    for (const file of files) {
      const decision = this.offsetStore && options.incremental !== false
        ? await this.prepareIncrementalFile(file)
        : { shouldParse: true, text: await readFile(file.path, "utf8") };
      if (!decision.shouldParse) continue;
      results.push(this.parser.parseText(decision.text, {
        sourcePath: file.path,
        fileMtime: file.mtime,
        fileSize: file.size
      }));
    }
    return results;
  }

  async prepareIncrementalFile(file) {
    const previous = this.offsetStore.getImportOffset(file.path);
    if (previous && previous.fileSize === file.size && previous.fileMtime === file.mtime && !previous.pendingBuffer) {
      return { shouldParse: false, reason: "unchanged" };
    }

    const text = await readFile(file.path, "utf8");
    const complete = splitCompleteJsonl(text);
    const reset = previous && file.size < previous.offset;
    const changed = !previous || reset || file.size > previous.offset || previous.fileMtime !== file.mtime || previous.pendingBuffer;
    if (!changed) {
      return { shouldParse: false, reason: "unchanged" };
    }

    const nextOffset = Buffer.byteLength(complete.completeText, "utf8");
    this.offsetStore.upsertImportOffset({
      sourcePath: file.path,
      source: "codex",
      offset: nextOffset,
      fileSize: file.size,
      fileMtime: file.mtime,
      pendingBuffer: complete.pendingBuffer,
      updatedAt: new Date().toISOString()
    });

    if (previous && nextOffset <= previous.offset && complete.pendingBuffer) {
      return { shouldParse: false, reason: "pending-only" };
    }

    if (!complete.completeText.trim()) {
      return { shouldParse: false, reason: "pending-only" };
    }

    return {
      shouldParse: true,
      text: complete.completeText,
      pendingBuffer: complete.pendingBuffer,
      reset
    };
  }

  watch(onChange) {
    const sessionsRoot = join(this.root, "sessions");
    this.watcherAbortController = new AbortController();
    const signal = this.watcherAbortController.signal;
    queueMicrotask(async () => {
      try {
        for await (const event of watch(sessionsRoot, { recursive: true, signal })) {
          if (event.filename && /rollout-.*\.jsonl$/i.test(String(event.filename))) {
            onChange?.(event);
          }
        }
      } catch (error) {
        if (error?.name !== "AbortError" && error?.code !== "ENOENT") throw error;
      }
    });
    return this;
  }

  dispose() {
    this.watcherAbortController?.abort();
    this.watcherAbortController = undefined;
  }
}

function splitCompleteJsonl(text) {
  if (!text || text.endsWith("\n")) {
    return { completeText: text || "", pendingBuffer: "" };
  }
  const index = text.lastIndexOf("\n");
  if (index < 0) {
    return { completeText: "", pendingBuffer: text };
  }
  return {
    completeText: text.slice(0, index + 1),
    pendingBuffer: text.slice(index + 1)
  };
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
