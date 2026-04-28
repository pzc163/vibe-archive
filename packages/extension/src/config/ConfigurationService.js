import * as vscode from "vscode";
import { join } from "node:path";

export class ConfigurationService {
  getDatabasePath() {
    const configured = vscode.workspace.getConfiguration("vibeArchive").get("databasePath");
    if (configured && String(configured).trim()) return String(configured);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return workspaceFolder ? join(workspaceFolder, "archive.db") : "archive.db";
  }

  getJsonStorePath() {
    const configured = vscode.workspace.getConfiguration("vibeArchive").get("jsonStorePath");
    if (configured && String(configured).trim()) return String(configured);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return workspaceFolder ? join(workspaceFolder, "vibe-archive-store.json") : "vibe-archive-store.json";
  }

  getStorageBackend() {
    return String(vscode.workspace.getConfiguration("vibeArchive").get("storageBackend") || "sqlite");
  }

  getSessionsLimit() {
    return Number(vscode.workspace.getConfiguration("vibeArchive").get("sessionsLimit") || 100);
  }

  getAutoScan() {
    return Boolean(vscode.workspace.getConfiguration("vibeArchive").get("autoScan"));
  }

  getScanDays() {
    return Number(vscode.workspace.getConfiguration("vibeArchive").get("scanDays") || 30);
  }

  isCodexEnabled() {
    return vscode.workspace.getConfiguration("vibeArchive").get("codex.enabled") !== false;
  }

  getCodexCustomPath() {
    const configured = vscode.workspace.getConfiguration("vibeArchive").get("codex.customPath");
    return configured && String(configured).trim() ? String(configured).trim() : "";
  }
}
