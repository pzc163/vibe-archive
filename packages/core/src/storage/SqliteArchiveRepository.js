import Database from "better-sqlite3";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { ArchiveRepository } from "./ArchiveRepository.js";
import { SQLITE_MIGRATIONS } from "./migrations/index.js";

export class SqliteArchiveRepository extends ArchiveRepository {
  constructor(dbPath = ":memory:", options = {}) {
    super();
    this.dbPath = dbPath;
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath, options.nativeBinding ? { nativeBinding: options.nativeBinding } : undefined);
    this.db.pragma("foreign_keys = ON");
  }

  initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    for (const migration of SQLITE_MIGRATIONS) {
      const exists = this.db.prepare("SELECT id FROM schema_migrations WHERE id = ?").get(migration.id);
      if (exists) continue;
      this.db.exec(migration.up);
      this.db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(migration.id, new Date().toISOString());
    }
  }

  upsertParsedSession(parsed, task) {
    this.initialize();
    const transaction = this.db.transaction(() => {
      this.upsertSession(parsed.session);
      this.replaceMessages(parsed.session.id, parsed.messages);
      this.insertDiagnostics(parsed.diagnostics);
      if (task) this.upsertTask(parsed.session.id, task);
    });
    transaction();
  }

  upsertSession(session) {
    this.db.prepare(`
      INSERT INTO sessions (
        id, source, native_session_id, source_path, source_file_mtime, source_file_size,
        parser_version, title, workspace_root, created_at, updated_at, imported_at,
        message_count, tool_call_count, changed_file_count, parse_status, parse_error_count,
        tags_json, quality_score
      ) VALUES (
        @id, @source, @nativeSessionId, @sourcePath, @sourceFileMtime, @sourceFileSize,
        @parserVersion, @title, @workspaceRoot, @createdAt, @updatedAt, @importedAt,
        @messageCount, @toolCallCount, @changedFileCount, @parseStatus, @parseErrorCount,
        @tagsJson, @qualityScore
      )
      ON CONFLICT(source, native_session_id) DO UPDATE SET
        source_path = excluded.source_path,
        source_file_mtime = excluded.source_file_mtime,
        source_file_size = excluded.source_file_size,
        parser_version = excluded.parser_version,
        title = excluded.title,
        workspace_root = excluded.workspace_root,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        imported_at = excluded.imported_at,
        message_count = excluded.message_count,
        tool_call_count = excluded.tool_call_count,
        changed_file_count = excluded.changed_file_count,
        parse_status = excluded.parse_status,
        parse_error_count = excluded.parse_error_count,
        tags_json = excluded.tags_json,
        quality_score = excluded.quality_score
    `).run({
      ...session,
      tagsJson: JSON.stringify(session.tags || []),
      qualityScore: session.qualityScore ?? null
    });
  }

  replaceMessages(sessionId, messages) {
    this.db.prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
    const statement = this.db.prepare(`
      INSERT INTO messages (
        id, session_id, sequence, role, content, timestamp, raw_type, raw_json_ref,
        tool_name, tool_input_json, tool_result_json, referenced_files_json,
        changed_files_json, metadata_json
      ) VALUES (
        @id, @sessionId, @sequence, @role, @content, @timestamp, @rawType, @rawJsonRef,
        @toolName, @toolInputJson, @toolResultJson, @referencedFilesJson,
        @changedFilesJson, @metadataJson
      )
    `);
    for (const message of messages) {
      statement.run({
        ...message,
        rawJsonRef: message.rawJsonRef ?? null,
        toolName: message.toolName ?? null,
        toolInputJson: JSON.stringify(message.toolInput ?? null),
        toolResultJson: JSON.stringify(message.toolResult ?? null),
        referencedFilesJson: JSON.stringify(message.referencedFiles || []),
        changedFilesJson: JSON.stringify(message.changedFiles || []),
        metadataJson: JSON.stringify(message.metadata || {})
      });
    }
  }

  insertDiagnostics(diagnostics) {
    this.db.prepare(`
      INSERT INTO parse_diagnostics (
        session_id, source_path, parser_version, total_lines, parsed_lines,
        failed_lines, error_samples_json, unknown_field_samples_json, created_at
      ) VALUES (
        @sessionId, @sourcePath, @parserVersion, @totalLines, @parsedLines,
        @failedLines, @errorSamplesJson, @unknownFieldSamplesJson, @createdAt
      )
    `).run({
      ...diagnostics,
      errorSamplesJson: JSON.stringify(diagnostics.errorSamples || []),
      unknownFieldSamplesJson: JSON.stringify(diagnostics.unknownFieldSamples || [])
    });
  }

  upsertTask(sessionId, task) {
    const language = Array.isArray(task.metadata?.languages) ? task.metadata.languages[0] : undefined;
    this.db.prepare(`
      INSERT INTO vibe_tasks (
        id, schema_version, source, session_id, intent_summary, intent_type,
        language, task_json, privacy_json, labels_json, created_at, updated_at
      ) VALUES (
        @id, @schemaVersion, @source, @sessionId, @intentSummary, @intentType,
        @language, @taskJson, @privacyJson, @labelsJson, @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        task_json = excluded.task_json,
        privacy_json = excluded.privacy_json,
        labels_json = excluded.labels_json,
        updated_at = excluded.updated_at
    `).run({
      id: task.id,
      schemaVersion: task.schema,
      source: task.source?.ai_tool || "unknown",
      sessionId,
      intentSummary: task.task?.intent || "",
      intentType: task.task?.type || null,
      language: language || null,
      taskJson: JSON.stringify(task),
      privacyJson: JSON.stringify(task.privacy || {}),
      labelsJson: JSON.stringify(task.metadata?.tags || []),
      createdAt: task.created_at,
      updatedAt: task.updated_at || task.created_at
    });
  }

  listSessions(options = {}) {
    this.initialize();
    const limit = Math.min(Number(options.limit || 100), 500);
    const offset = Number(options.offset || 0);
    return this.db.prepare(`
      SELECT * FROM sessions
      ORDER BY datetime(created_at) DESC, rowid DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset).map(mapSessionRow);
  }

  getSession(id) {
    this.initialize();
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
    return row ? mapSessionRow(row) : undefined;
  }

  getMessages(sessionId) {
    this.initialize();
    return this.db.prepare(`
      SELECT * FROM messages
      WHERE session_id = ?
      ORDER BY sequence ASC
    `).all(sessionId).map(mapMessageRow);
  }

  getTaskBySessionId(sessionId) {
    this.initialize();
    const row = this.db.prepare("SELECT task_json FROM vibe_tasks WHERE session_id = ?").get(sessionId);
    return row ? JSON.parse(row.task_json) : undefined;
  }

  getLatestDiagnostics(sessionId) {
    this.initialize();
    const row = this.db.prepare(`
      SELECT * FROM parse_diagnostics
      WHERE session_id = ?
      ORDER BY datetime(created_at) DESC, rowid DESC
      LIMIT 1
    `).get(sessionId);
    return row ? mapDiagnosticsRow(row) : undefined;
  }

  listTasks(options = {}) {
    this.initialize();
    const limit = Math.min(Number(options.limit || 1000), 10000);
    const offset = Number(options.offset || 0);
    return this.db.prepare(`
      SELECT task_json FROM vibe_tasks
      ORDER BY datetime(created_at) DESC, rowid DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset).map((row) => JSON.parse(row.task_json));
  }

  recordExport(record) {
    this.initialize();
    this.db.prepare(`
      INSERT INTO exports (
        id, created_at, format, file_path, manifest_path, session_count, message_count, filter_json
      ) VALUES (
        @id, @createdAt, @format, @filePath, @manifestPath, @sessionCount, @messageCount, @filterJson
      )
      ON CONFLICT(id) DO UPDATE SET
        created_at = excluded.created_at,
        format = excluded.format,
        file_path = excluded.file_path,
        manifest_path = excluded.manifest_path,
        session_count = excluded.session_count,
        message_count = excluded.message_count,
        filter_json = excluded.filter_json
    `).run({
      id: record.id,
      createdAt: record.createdAt || new Date().toISOString(),
      format: record.format,
      filePath: record.filePath,
      manifestPath: record.manifestPath || null,
      sessionCount: Number(record.sessionCount || 0),
      messageCount: Number(record.messageCount || 0),
      filterJson: JSON.stringify(record.filter || {})
    });
  }

  listExports(options = {}) {
    this.initialize();
    const limit = Math.min(Number(options.limit || 100), 1000);
    const offset = Number(options.offset || 0);
    return this.db.prepare(`
      SELECT * FROM exports
      ORDER BY datetime(created_at) DESC, rowid DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset).map(mapExportRow);
  }

  listMigrations() {
    this.initialize();
    return this.db.prepare("SELECT * FROM schema_migrations ORDER BY applied_at ASC").all();
  }

  getImportOffset(sourcePath) {
    this.initialize();
    const row = this.db.prepare("SELECT * FROM import_offsets WHERE source_path = ?").get(sourcePath);
    return row ? mapImportOffsetRow(row) : undefined;
  }

  upsertImportOffset(offset) {
    this.initialize();
    this.db.prepare(`
      INSERT INTO import_offsets (
        source_path, source, offset, file_size, file_mtime, pending_buffer, updated_at
      ) VALUES (
        @sourcePath, @source, @offset, @fileSize, @fileMtime, @pendingBuffer, @updatedAt
      )
      ON CONFLICT(source_path) DO UPDATE SET
        source = excluded.source,
        offset = excluded.offset,
        file_size = excluded.file_size,
        file_mtime = excluded.file_mtime,
        pending_buffer = excluded.pending_buffer,
        updated_at = excluded.updated_at
    `).run({
      sourcePath: offset.sourcePath,
      source: offset.source || "codex",
      offset: Number(offset.offset || 0),
      fileSize: Number(offset.fileSize || 0),
      fileMtime: offset.fileMtime || null,
      pendingBuffer: offset.pendingBuffer || "",
      updatedAt: offset.updatedAt || new Date().toISOString()
    });
  }

  listImportOffsets() {
    this.initialize();
    return this.db.prepare("SELECT * FROM import_offsets ORDER BY source_path ASC").all().map(mapImportOffsetRow);
  }

  purgeAll() {
    this.initialize();
    const before = {
      sessions: this.db.prepare("SELECT COUNT(*) AS count FROM sessions").get().count,
      messages: this.db.prepare("SELECT COUNT(*) AS count FROM messages").get().count,
      tasks: this.db.prepare("SELECT COUNT(*) AS count FROM vibe_tasks").get().count,
      diagnostics: this.db.prepare("SELECT COUNT(*) AS count FROM parse_diagnostics").get().count,
      exports: this.db.prepare("SELECT COUNT(*) AS count FROM exports").get().count,
      importOffsets: this.db.prepare("SELECT COUNT(*) AS count FROM import_offsets").get().count
    };
    const transaction = this.db.transaction(() => {
      this.db.prepare("DELETE FROM messages").run();
      this.db.prepare("DELETE FROM vibe_tasks").run();
      this.db.prepare("DELETE FROM parse_diagnostics").run();
      this.db.prepare("DELETE FROM exports").run();
      this.db.prepare("DELETE FROM import_offsets").run();
      this.db.prepare("DELETE FROM sessions").run();
    });
    transaction();
    return before;
  }

  close() {
    this.db.close();
  }
}

function mapSessionRow(row) {
  return {
    id: row.id,
    source: row.source,
    nativeSessionId: row.native_session_id,
    sourcePath: row.source_path,
    sourceFileMtime: row.source_file_mtime,
    sourceFileSize: row.source_file_size,
    parserVersion: row.parser_version,
    title: row.title,
    workspaceRoot: row.workspace_root,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    importedAt: row.imported_at,
    messageCount: row.message_count,
    toolCallCount: row.tool_call_count,
    changedFileCount: row.changed_file_count,
    parseStatus: row.parse_status,
    parseErrorCount: row.parse_error_count,
    tags: JSON.parse(row.tags_json || "[]"),
    qualityScore: row.quality_score
  };
}

function mapMessageRow(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    sequence: row.sequence,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
    rawType: row.raw_type,
    rawJsonRef: row.raw_json_ref,
    toolName: row.tool_name,
    toolInput: JSON.parse(row.tool_input_json || "null"),
    toolResult: JSON.parse(row.tool_result_json || "null"),
    referencedFiles: JSON.parse(row.referenced_files_json || "[]"),
    changedFiles: JSON.parse(row.changed_files_json || "[]"),
    metadata: JSON.parse(row.metadata_json || "{}")
  };
}

function mapDiagnosticsRow(row) {
  return {
    sessionId: row.session_id,
    sourcePath: row.source_path,
    parserVersion: row.parser_version,
    totalLines: row.total_lines,
    parsedLines: row.parsed_lines,
    failedLines: row.failed_lines,
    errorSamples: JSON.parse(row.error_samples_json || "[]"),
    unknownFieldSamples: JSON.parse(row.unknown_field_samples_json || "[]"),
    createdAt: row.created_at
  };
}

function mapImportOffsetRow(row) {
  return {
    sourcePath: row.source_path,
    source: row.source,
    offset: row.offset,
    fileSize: row.file_size,
    fileMtime: row.file_mtime,
    pendingBuffer: row.pending_buffer || "",
    updatedAt: row.updated_at
  };
}

function mapExportRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    format: row.format,
    filePath: row.file_path,
    manifestPath: row.manifest_path,
    sessionCount: row.session_count,
    messageCount: row.message_count,
    filter: JSON.parse(row.filter_json || "{}")
  };
}
