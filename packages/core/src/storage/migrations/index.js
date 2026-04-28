export const SQLITE_MIGRATIONS = [
  {
    id: "v0.4.1-init",
    description: "Initial Vibe Archive v0.4.1 storage schema",
    up: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL,
        native_session_id TEXT NOT NULL,
        source_path TEXT NOT NULL,
        source_file_mtime TEXT,
        source_file_size INTEGER,
        parser_version TEXT NOT NULL,
        title TEXT,
        workspace_root TEXT,
        created_at TEXT,
        updated_at TEXT,
        imported_at TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        tool_call_count INTEGER DEFAULT 0,
        changed_file_count INTEGER DEFAULT 0,
        parse_status TEXT NOT NULL,
        parse_error_count INTEGER DEFAULT 0,
        tags_json TEXT DEFAULT '[]',
        quality_score REAL,
        UNIQUE(source, native_session_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        session_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT,
        raw_type TEXT,
        raw_json_ref TEXT,
        tool_name TEXT,
        tool_input_json TEXT,
        tool_result_json TEXT,
        referenced_files_json TEXT DEFAULT '[]',
        changed_files_json TEXT DEFAULT '[]',
        metadata_json TEXT DEFAULT '{}',
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        UNIQUE(session_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS vibe_tasks (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        schema_version TEXT NOT NULL,
        source TEXT NOT NULL,
        session_id TEXT NOT NULL,
        intent_summary TEXT NOT NULL,
        intent_type TEXT,
        language TEXT,
        task_json TEXT NOT NULL,
        privacy_json TEXT NOT NULL,
        labels_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS parse_diagnostics (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        source_path TEXT NOT NULL,
        parser_version TEXT NOT NULL,
        total_lines INTEGER DEFAULT 0,
        parsed_lines INTEGER DEFAULT 0,
        failed_lines INTEGER DEFAULT 0,
        error_samples_json TEXT DEFAULT '[]',
        unknown_field_samples_json TEXT DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS exports (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        format TEXT NOT NULL,
        file_path TEXT NOT NULL,
        manifest_path TEXT,
        session_count INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        filter_json TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS import_offsets (
        source_path TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        offset INTEGER DEFAULT 0,
        file_size INTEGER DEFAULT 0,
        file_mtime TEXT,
        pending_buffer TEXT DEFAULT '',
        updated_at TEXT NOT NULL
      );
    `
  },
  {
    id: "v0.4.1-indexes",
    description: "Initial query indexes",
    up: `
      CREATE INDEX IF NOT EXISTS idx_sessions_source_created_at ON sessions(source, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_vibe_tasks_source_created_at ON vibe_tasks(source, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_session_sequence ON messages(session_id, sequence);
    `
  }
];
