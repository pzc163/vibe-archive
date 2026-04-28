import * as vscode from "vscode";
import { join } from "node:path";
import { JsonArchiveRepository } from "../../../core/src/index.js";
import { SqliteArchiveRepository } from "../../../core/src/node.js";

export function createArchiveRepository(configurationService, context) {
  if (configurationService.getStorageBackend() === "json") {
    return new JsonArchiveRepository(configurationService.getJsonStorePath());
  }

  const databasePath = configurationService.getDatabasePath();
  const nativeBinding = join(context.extensionPath, "dist", "native", "better_sqlite3.node");
  try {
    return new SqliteArchiveRepository(databasePath, { nativeBinding });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallback = new JsonArchiveRepository(configurationService.getJsonStorePath());
    vscode.window.showWarningMessage(`Vibe Archive could not load SQLite storage and switched to JSON storage: ${message}`);
    return fallback;
  }
}
