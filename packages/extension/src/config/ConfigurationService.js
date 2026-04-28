import * as vscode from "vscode";
import { join } from "node:path";

export class ConfigurationService {
  getDatabasePath() {
    const configured = vscode.workspace.getConfiguration("vibeArchive").get("databasePath");
    if (configured && String(configured).trim()) return String(configured);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return workspaceFolder ? join(workspaceFolder, "archive.db") : "archive.db";
  }

  getSessionsLimit() {
    return Number(vscode.workspace.getConfiguration("vibeArchive").get("sessionsLimit") || 100);
  }
}
