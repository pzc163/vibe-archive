export class ArchiveRepository {
  initialize() {
    throw new Error("initialize() not implemented");
  }

  upsertParsedSession(_parsed, _task) {
    throw new Error("upsertParsedSession() not implemented");
  }

  listSessions(_options = {}) {
    throw new Error("listSessions() not implemented");
  }

  getSession(_id) {
    throw new Error("getSession() not implemented");
  }

  getMessages(_sessionId) {
    throw new Error("getMessages() not implemented");
  }

  getTaskBySessionId(_sessionId) {
    throw new Error("getTaskBySessionId() not implemented");
  }

  getLatestDiagnostics(_sessionId) {
    throw new Error("getLatestDiagnostics() not implemented");
  }

  listTasks(_options = {}) {
    throw new Error("listTasks() not implemented");
  }

  recordExport(_record) {
    throw new Error("recordExport() not implemented");
  }

  listExports(_options = {}) {
    throw new Error("listExports() not implemented");
  }

  getImportOffset(_sourcePath) {
    throw new Error("getImportOffset() not implemented");
  }

  upsertImportOffset(_offset) {
    throw new Error("upsertImportOffset() not implemented");
  }

  listImportOffsets() {
    throw new Error("listImportOffsets() not implemented");
  }

  purgeAll() {
    throw new Error("purgeAll() not implemented");
  }

  listMigrations() {
    throw new Error("listMigrations() not implemented");
  }

  close() {}
}
