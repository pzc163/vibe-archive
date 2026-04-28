import * as vscode from "vscode";
import { CodexImportService } from "./codex/CodexImportService.js";
import { CodexPathService } from "./codex/CodexPathService.js";
import { registerCommands } from "./commands/registerCommands.js";
import { ConfigurationService } from "./config/ConfigurationService.js";
import { ConsentManager } from "./consent/ConsentManager.js";
import { ShareGptExportService } from "./export/ShareGptExportService.js";
import { ManualImportService } from "./import/ManualImportService.js";
import { LoggerService } from "./logging/LoggerService.js";
import { PurgeService } from "./privacy/PurgeService.js";
import { SessionsTreeProvider } from "./views/SessionsTreeProvider.js";

export async function activate(context) {
  const outputChannel = vscode.window.createOutputChannel("Vibe Archive");
  const logger = new LoggerService(outputChannel);
  const configurationService = new ConfigurationService();
  const consentManager = new ConsentManager(context, logger);
  const codexPathService = new CodexPathService(configurationService, logger);
  const codexImportService = new CodexImportService(context, {
    codexPathService,
    configurationService,
    logger
  });
  const shareGptExportService = new ShareGptExportService(context, {
    configurationService,
    logger
  });
  const manualImportService = new ManualImportService(context, {
    configurationService,
    logger
  });
  const purgeService = new PurgeService(context, {
    configurationService,
    logger
  });
  const sessionsTreeProvider = new SessionsTreeProvider(configurationService, context);
  logger.info("Vibe Archive extension activated.");
  codexPathService.warnIfRemote();

  if (configurationService.isCodexEnabled() && !consentManager.hasDecision()) {
    const granted = await consentManager.ensureGranted();
    if (granted && configurationService.getAutoScan()) {
      context.subscriptions.push(codexImportService.startWatching(() => sessionsTreeProvider.refresh()));
    }
  } else if (configurationService.isCodexEnabled() && configurationService.getAutoScan()) {
    const granted = await consentManager.ensureGranted();
    if (granted) {
      context.subscriptions.push(codexImportService.startWatching(() => sessionsTreeProvider.refresh()));
    }
  }

  context.subscriptions.push(
    outputChannel,
    vscode.window.registerTreeDataProvider("vibeArchive.sessions", sessionsTreeProvider),
    ...registerCommands(context, {
      codexPathService,
      codexImportService,
      shareGptExportService,
      manualImportService,
      purgeService,
      configurationService,
      consentManager,
      logger,
      sessionsTreeProvider
    })
  );
}

export function deactivate() {}
