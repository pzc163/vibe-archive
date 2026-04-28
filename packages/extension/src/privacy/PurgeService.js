import { createArchiveRepository } from "../storage/createRepository.js";

export class PurgeService {
  constructor(context, services) {
    this.context = context;
    this.configurationService = services.configurationService;
    this.logger = services.logger;
  }

  purgeAll() {
    const repository = createArchiveRepository(this.configurationService, this.context);
    try {
      const result = repository.purgeAll();
      this.logger.info(`Purge finished. sessions=${result.sessions}, messages=${result.messages}, tasks=${result.tasks}, diagnostics=${result.diagnostics}, exports=${result.exports}, importOffsets=${result.importOffsets}`);
      return result;
    } finally {
      repository.close();
    }
  }
}
