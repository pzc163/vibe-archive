import * as vscode from "vscode";
import { createArchiveRepository } from "../storage/createRepository.js";

export class SessionsTreeProvider {
  constructor(configurationService, context) {
    this.configurationService = configurationService;
    this.context = context;
    this.onDidChangeTreeDataEmitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  }

  refresh() {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(item) {
    return item;
  }

  getChildren(element) {
    if (element) return [];
    let repository;
    try {
      repository = createArchiveRepository(this.configurationService, this.context);
      return repository.listSessions({ limit: this.configurationService.getSessionsLimit() }).map((session) => new SessionTreeItem(session));
    } catch {
      return [new ErrorTreeItem("SQLite storage unavailable")];
    } finally {
      repository?.close();
    }
  }
}

class ErrorTreeItem extends vscode.TreeItem {
  constructor(label) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = "Check extension host logs";
    this.contextValue = "vibeArchive.error";
    this.iconPath = new vscode.ThemeIcon("error");
  }
}

export class SessionTreeItem extends vscode.TreeItem {
  constructor(session) {
    super(compact(session.title || session.nativeSessionId, 80), vscode.TreeItemCollapsibleState.None);
    this.session = session;
    this.id = session.id;
    this.description = `${session.messageCount} msg / ${session.toolCallCount} tool`;
    this.tooltip = [
      session.title,
      session.workspaceRoot,
      `status: ${session.parseStatus}`,
      `messages: ${session.messageCount}`,
      `tools: ${session.toolCallCount}`
    ].filter(Boolean).join("\n");
    this.contextValue = "vibeArchive.session";
    this.command = {
      command: "vibeArchive.openSession",
      title: "Open Session",
      arguments: [session.id]
    };
    this.iconPath = new vscode.ThemeIcon(session.parseStatus === "ok" ? "archive" : "warning");
  }
}

function compact(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? text.slice(0, maxLength - 1) + "…" : text;
}
