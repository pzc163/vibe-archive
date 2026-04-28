import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ArchiveRepository } from "./ArchiveRepository.js";

const JSON_MIGRATION_ID = "json-v0.4.1-init";

export class JsonArchiveRepository extends ArchiveRepository {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.state = undefined;
  }

  initialize() {
    if (this.state) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    if (existsSync(this.filePath)) {
      this.state = JSON.parse(readFileSync(this.filePath, "utf8"));
    } else {
      this.state = createEmptyState();
      this.flush();
    }
    if (!this.state.migrations.some((migration) => migration.id === JSON_MIGRATION_ID)) {
      this.state.migrations.push({ id: JSON_MIGRATION_ID, applied_at: new Date().toISOString() });
      this.flush();
    }
  }

  upsertParsedSession(parsed, task) {
    this.initialize();
    this.state.sessions = this.state.sessions.filter((session) => !(session.source === parsed.session.source && session.nativeSessionId === parsed.session.nativeSessionId));
    this.state.sessions.push(parsed.session);
    this.state.messagesBySession[parsed.session.id] = parsed.messages;
    this.state.diagnostics = this.state.diagnostics.filter((diagnostic) => diagnostic.sessionId !== parsed.session.id);
    this.state.diagnostics.push(parsed.diagnostics);
    if (task) {
      this.state.tasksBySession[parsed.session.id] = task;
      this.state.tasks = this.state.tasks.filter((item) => item.id !== task.id);
      this.state.tasks.push(task);
    }
    this.flush();
  }

  listSessions(options = {}) {
    this.initialize();
    return paginate([...this.state.sessions].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), options, 100, 500);
  }

  getSession(id) {
    this.initialize();
    return this.state.sessions.find((session) => session.id === id);
  }

  getMessages(sessionId) {
    this.initialize();
    return this.state.messagesBySession[sessionId] || [];
  }

  getTaskBySessionId(sessionId) {
    this.initialize();
    return this.state.tasksBySession[sessionId];
  }

  getLatestDiagnostics(sessionId) {
    this.initialize();
    return [...this.state.diagnostics]
      .filter((diagnostic) => diagnostic.sessionId === sessionId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  }

  listTasks(options = {}) {
    this.initialize();
    return paginate([...this.state.tasks].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))), options, 1000, 10000);
  }

  recordExport(record) {
    this.initialize();
    this.state.exports = this.state.exports.filter((item) => item.id !== record.id);
    this.state.exports.push({
      ...record,
      createdAt: record.createdAt || new Date().toISOString(),
      filter: record.filter || {}
    });
    this.flush();
  }

  listExports(options = {}) {
    this.initialize();
    return paginate([...this.state.exports].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), options, 100, 1000);
  }

  getImportOffset(sourcePath) {
    this.initialize();
    return this.state.importOffsets[sourcePath];
  }

  upsertImportOffset(offset) {
    this.initialize();
    this.state.importOffsets[offset.sourcePath] = {
      ...offset,
      source: offset.source || "codex",
      offset: Number(offset.offset || 0),
      fileSize: Number(offset.fileSize || 0),
      pendingBuffer: offset.pendingBuffer || "",
      updatedAt: offset.updatedAt || new Date().toISOString()
    };
    this.flush();
  }

  listImportOffsets() {
    this.initialize();
    return Object.values(this.state.importOffsets).sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  }

  purgeAll() {
    this.initialize();
    const before = {
      sessions: this.state.sessions.length,
      messages: Object.values(this.state.messagesBySession).reduce((total, messages) => total + messages.length, 0),
      tasks: this.state.tasks.length,
      diagnostics: this.state.diagnostics.length,
      exports: this.state.exports.length,
      importOffsets: Object.keys(this.state.importOffsets).length
    };
    const migrations = this.state.migrations;
    this.state = {
      ...createEmptyState(),
      migrations
    };
    this.flush();
    return before;
  }

  listMigrations() {
    this.initialize();
    return this.state.migrations;
  }

  flush() {
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2) + "\n", "utf8");
  }
}

function createEmptyState() {
  return {
    version: 1,
    migrations: [{ id: JSON_MIGRATION_ID, applied_at: new Date().toISOString() }],
    sessions: [],
    messagesBySession: {},
    tasks: [],
    tasksBySession: {},
    diagnostics: [],
    exports: [],
    importOffsets: {}
  };
}

function paginate(items, options, defaultLimit, maxLimit) {
  const limit = Math.min(Number(options.limit || defaultLimit), maxLimit);
  const offset = Number(options.offset || 0);
  return items.slice(offset, offset + limit);
}
