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

  close() {}
}
