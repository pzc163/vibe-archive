import * as vscode from "vscode";
import { join } from "node:path";
import { SessionDetailPanel } from "../webview/SessionDetailPanel.js";

export function registerCommands(context, services) {
  const { codexImportService, codexPathService, configurationService, consentManager, logger, manualImportService, purgeService, sessionsTreeProvider, shareGptExportService } = services;
  return [
    vscode.commands.registerCommand("vibeArchive.refreshSessions", () => {
      logger.info("Refresh sessions requested.");
      sessionsTreeProvider.refresh();
    }),
    vscode.commands.registerCommand("vibeArchive.openSession", (sessionIdOrItem) => {
      const sessionId = typeof sessionIdOrItem === "string" ? sessionIdOrItem : sessionIdOrItem?.session?.id;
      if (!sessionId) {
        logger.warn("Open session requested without a selected session.");
        vscode.window.showWarningMessage("No Vibe Archive session selected.");
        return;
      }
      logger.info(`Open session requested: ${sessionId}`);
      SessionDetailPanel.open(context, configurationService, sessionId);
    }),
    vscode.commands.registerCommand("vibeArchive.scanNow", async () => {
      logger.info("Scan now command invoked.");
      if (!configurationService.isCodexEnabled()) {
        logger.warn("Codex scanning is disabled by configuration.");
        vscode.window.showWarningMessage("Codex scanning is disabled. Enable vibeArchive.codex.enabled to scan Codex sessions.");
        return;
      }

      const granted = await consentManager.ensureGranted();
      if (!granted) {
        vscode.window.showWarningMessage("Vibe Archive cannot scan Codex sessions until permission is granted.");
        return;
      }

      const resolved = codexPathService.resolveCodexRoot();
      logger.info(`Codex path resolved from ${resolved.source}: ${resolved.path || "(none)"}`);
      if (!resolved.exists) {
        vscode.window.showWarningMessage(`Codex session root was not found: ${resolved.path}`);
        return;
      }

      const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Scanning Codex sessions",
        cancellable: false
      }, () => codexImportService.importNow());

      if (!result.ok) {
        vscode.window.showWarningMessage(`Codex scan skipped: ${result.reason}`);
        return;
      }

      vscode.window.showInformationMessage(`Imported ${result.imported} Codex session(s), ${result.messages} message(s), ${result.failed} failed.`);
      sessionsTreeProvider.refresh();
    }),
    vscode.commands.registerCommand("vibeArchive.importJsonl", async () => {
      logger.info("Import JSONL command invoked.");
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: true,
        filters: {
          "JSON / JSONL": ["json", "jsonl"]
        },
        openLabel: "Import"
      });
      if (!selected?.length) {
        logger.info("Manual import cancelled by user.");
        return;
      }

      const paths = selected.map((uri) => uri.fsPath);
      const preview = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Preparing manual import",
        cancellable: false
      }, () => manualImportService.preview(paths));

      if (!preview.fileCount) {
        vscode.window.showWarningMessage("No .jsonl or .json files were found in the selected path.");
        return;
      }

      const sourcePick = await vscode.window.showQuickPick([
        { label: "Codex", value: "codex", description: "Parse as Codex JSONL" },
        { label: "Generic", value: "generic", description: "Parse with the generic JSONL fallback" }
      ], {
        title: `Import ${preview.fileCount} file(s), about ${preview.estimatedLines} line(s)`,
        placeHolder: "Choose the source type"
      });
      if (!sourcePick) {
        logger.info("Manual import source selection cancelled by user.");
        return;
      }

      const confirmation = await vscode.window.showInformationMessage(
        `Import ${preview.fileCount} file(s), about ${preview.estimatedLines} line(s), as ${sourcePick.label}?`,
        { modal: true },
        "Import"
      );
      if (confirmation !== "Import") {
        logger.info("Manual import confirmation cancelled by user.");
        return;
      }

      const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Importing JSONL",
        cancellable: false
      }, () => manualImportService.importFiles(paths, { source: sourcePick.value }));

      sessionsTreeProvider.refresh();
      vscode.window.showInformationMessage(`Imported ${result.imported} file(s), ${result.messages} message(s), ${result.failed} failed.`);
    }),
    vscode.commands.registerCommand("vibeArchive.exportShareGPT", async () => {
      logger.info("Export ShareGPT command invoked.");
      const defaultUri = vscode.Uri.file(defaultShareGptOutputPath());
      const selected = await vscode.window.showSaveDialog({
        defaultUri,
        filters: {
          "JSON Lines": ["jsonl"]
        },
        saveLabel: "Export ShareGPT"
      });
      if (!selected) {
        logger.info("ShareGPT export cancelled by user.");
        return;
      }

      const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Exporting ShareGPT dataset",
        cancellable: false
      }, () => shareGptExportService.exportToFile(selected.fsPath));

      if (!result.ok) {
        if (result.reason === "empty-archive") {
          vscode.window.showWarningMessage("No Vibe Archive tasks found. Scan or import sessions before exporting ShareGPT.");
          return;
        }
        vscode.window.showWarningMessage(`ShareGPT export skipped: ${result.reason || "unknown reason"}`);
        return;
      }

      vscode.window.showInformationMessage(`Exported ${result.exported} ShareGPT record(s). Manifest: ${result.manifestPath}`);
    }),
    vscode.commands.registerCommand("vibeArchive.purgeData", async () => {
      logger.info("Purge data command invoked.");
      const confirmation = await vscode.window.showWarningMessage(
        "This deletes only Vibe Archive local data: archived sessions, parsed messages, tasks, diagnostics, export history, and scan offsets. It will not delete Codex source files or exported JSONL/Manifest files.",
        { modal: true },
        "Purge Vibe Archive Data"
      );
      if (confirmation !== "Purge Vibe Archive Data") {
        logger.info("Purge data cancelled by user.");
        return;
      }

      const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Purging Vibe Archive data",
        cancellable: false
      }, () => Promise.resolve(purgeService.purgeAll()));

      sessionsTreeProvider.refresh();
      vscode.window.showInformationMessage(`Purged ${result.sessions} session(s), ${result.messages} message(s), ${result.tasks} task(s), ${result.diagnostics} diagnostic record(s), ${result.exports} export record(s). Source tool files were not touched.`);
    }),
    vscode.commands.registerCommand("vibeArchive.showLog", () => {
      logger.info("Show log command invoked.");
      logger.show();
    })
  ];
}

function defaultShareGptOutputPath() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
  return join(workspaceFolder, "sharegpt.jsonl");
}
