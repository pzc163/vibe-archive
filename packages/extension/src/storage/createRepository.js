import * as vscode from "vscode";
import { join } from "node:path";
import { SqliteArchiveRepository } from "../../../core/src/node.js";

export function createArchiveRepository(configurationService, context) {
  const databasePath = configurationService.getDatabasePath();
  const nativeBinding = join(context.extensionPath, "dist", "native", "better_sqlite3.node");
  try {
    return new SqliteArchiveRepository(databasePath, { nativeBinding });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Vibe Archive 无法加载 SQLite 存储：${message}`);
    throw error;
  }
}
