import { CodexScanner, SessionTaskBuilder } from "../../../core/src/index.js";
import { createArchiveRepository } from "../storage/createRepository.js";

export class CodexImportService {
  constructor(context, services) {
    this.context = context;
    this.codexPathService = services.codexPathService;
    this.configurationService = services.configurationService;
    this.logger = services.logger;
    this.watchScanner = undefined;
    this.watchTimer = undefined;
  }

  async importNow() {
    const resolved = this.codexPathService.resolveCodexRoot();
    if (!resolved.enabled) {
      return {
        ok: false,
        reason: "disabled",
        root: ""
      };
    }
    if (!resolved.exists) {
      return {
        ok: false,
        reason: "missing-root",
        root: resolved.path
      };
    }

    const repository = createArchiveRepository(this.configurationService, this.context);
    try {
      const scanner = new CodexScanner({
        root: resolved.path,
        scanDays: this.configurationService.getScanDays(),
        offsetStore: repository
      });
      const taskBuilder = new SessionTaskBuilder();
      const parsedSessions = await scanner.scan({ incremental: true });

      let imported = 0;
      let failed = 0;
      let messages = 0;
      for (const parsed of parsedSessions) {
        const task = taskBuilder.build(parsed);
        repository.upsertParsedSession(parsed, task);
        imported += 1;
        messages += parsed.messages.length;
        if (parsed.session.parseStatus === "failed") failed += 1;
      }

      this.logger.info(`Codex import finished. imported=${imported}, failed=${failed}, messages=${messages}, root=${resolved.path}`);
      return {
        ok: true,
        imported,
        failed,
        messages,
        root: resolved.path
      };
    } finally {
      repository.close();
    }
  }

  startWatching(onImported) {
    const resolved = this.codexPathService.resolveCodexRoot();
    if (!resolved.enabled || !resolved.exists) {
      this.logger.warn(`Codex watcher not started. enabled=${resolved.enabled}, exists=${resolved.exists}, root=${resolved.path || ""}`);
      return { dispose() {} };
    }

    this.watchScanner = new CodexScanner({
      root: resolved.path,
      scanDays: this.configurationService.getScanDays()
    });
    this.watchScanner.watch(() => {
      clearTimeout(this.watchTimer);
      this.watchTimer = setTimeout(async () => {
        try {
          const result = await this.importNow();
          if (result.ok) onImported?.(result);
        } catch (error) {
          this.logger.error("Codex watcher import failed.", error);
        }
      }, 500);
    });
    this.logger.info(`Codex watcher started: ${resolved.path}`);

    return {
      dispose: () => {
        clearTimeout(this.watchTimer);
        this.watchScanner?.dispose();
        this.watchScanner = undefined;
        this.logger.info("Codex watcher stopped.");
      }
    };
  }
}
