import * as vscode from "vscode";
import { ConfigurationService } from "./config/ConfigurationService.js";
import { SessionsTreeProvider } from "./views/SessionsTreeProvider.js";
import { SessionDetailPanel } from "./webview/SessionDetailPanel.js";

export function activate(context) {
  const configurationService = new ConfigurationService();
  const sessionsTreeProvider = new SessionsTreeProvider(configurationService, context);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("vibeArchive.sessions", sessionsTreeProvider),
    vscode.commands.registerCommand("vibeArchive.refreshSessions", () => sessionsTreeProvider.refresh()),
    vscode.commands.registerCommand("vibeArchive.openSession", (sessionIdOrItem) => {
      const sessionId = typeof sessionIdOrItem === "string" ? sessionIdOrItem : sessionIdOrItem?.session?.id;
      if (!sessionId) {
        vscode.window.showWarningMessage("No Vibe Archive session selected.");
        return;
      }
      SessionDetailPanel.open(context, configurationService, sessionId);
    })
  );
}

export function deactivate() {}
