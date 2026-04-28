import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { CodexParser, SessionTaskBuilder } from "../../../core/src/index.js";
import { createArchiveRepository } from "../storage/createRepository.js";

export class ManualImportService {
  constructor(context, services) {
    this.context = context;
    this.configurationService = services.configurationService;
    this.logger = services.logger;
  }

  async preview(paths) {
    const files = await discoverImportFiles(paths);
    let estimatedLines = 0;
    let totalBytes = 0;
    for (const file of files) {
      const content = await readFile(file.path, "utf8");
      estimatedLines += countLines(content);
      totalBytes += Buffer.byteLength(content, "utf8");
    }
    return {
      files,
      fileCount: files.length,
      estimatedLines,
      totalBytes
    };
  }

  async importFiles(paths, options = {}) {
    const files = await discoverImportFiles(paths);
    const repository = createArchiveRepository(this.configurationService, this.context);
    const parser = new CodexParser();
    const builder = new SessionTaskBuilder();
    const source = options.source === "codex" ? "codex" : "manual";
    let imported = 0;
    let failed = 0;
    let messages = 0;

    try {
      for (const file of files) {
        const content = await readFile(file.path, "utf8");
        const parsed = parser.parseText(normalizeImportText(content, file.path), {
          sourcePath: file.path,
          fileMtime: file.mtime,
          fileSize: file.size
        });
        parsed.session.source = source;
        parsed.session.parserVersion = source === "codex" ? parsed.session.parserVersion : "generic-jsonl-v1";
        parsed.messages = parsed.messages.map((message) => ({
          ...message,
          sessionId: parsed.session.id
        }));
        parsed.diagnostics.parserVersion = parsed.session.parserVersion;

        const task = parsed.session.parseStatus === "failed" ? undefined : builder.build(parsed);
        repository.upsertParsedSession(parsed, task);
        imported += 1;
        messages += parsed.messages.length;
        if (parsed.session.parseStatus === "failed") failed += 1;
      }
      this.logger.info(`Manual import finished. files=${files.length}, imported=${imported}, failed=${failed}, messages=${messages}, source=${source}`);
      return {
        ok: true,
        files: files.length,
        imported,
        failed,
        messages,
        source
      };
    } finally {
      repository.close();
    }
  }
}

export async function discoverImportFiles(paths) {
  const files = [];
  for (const path of paths || []) {
    await visitPath(path, files);
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function visitPath(path, files) {
  const fileStat = await stat(path);
  if (fileStat.isDirectory()) {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      await visitPath(join(path, entry.name), files);
    }
    return;
  }
  if (!fileStat.isFile()) return;
  if (![".jsonl", ".json"].includes(extname(path).toLowerCase())) return;
  files.push({
    path,
    mtime: fileStat.mtime.toISOString(),
    size: fileStat.size
  });
}

function normalizeImportText(content, filePath) {
  if (extname(filePath).toLowerCase() !== ".json") return content;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => JSON.stringify(item)).join("\n") + "\n";
    }
    return JSON.stringify(parsed) + "\n";
  } catch {
    return content;
  }
}

function countLines(content) {
  if (!content) return 0;
  return content.endsWith("\n") ? content.split(/\r?\n/).length - 1 : content.split(/\r?\n/).length;
}
