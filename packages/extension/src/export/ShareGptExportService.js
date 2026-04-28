import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ManifestGenerator, ManifestValidator, PROFILE_VERSIONS, ShareGptExporter } from "../../../core/src/index.js";
import { createArchiveRepository } from "../storage/createRepository.js";

export class ShareGptExportService {
  constructor(context, services) {
    this.context = context;
    this.configurationService = services.configurationService;
    this.logger = services.logger;
  }

  async exportToFile(outputPath) {
    const repository = createArchiveRepository(this.configurationService, this.context);
    try {
      const tasks = repository.listTasks({ limit: 10000 });
      if (!tasks.length) {
        return {
          ok: false,
          reason: "empty-archive",
          exported: 0
        };
      }

      const jsonl = new ShareGptExporter().exportJsonl(tasks);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, jsonl, "utf8");

      const manifestPath = join(dirname(outputPath), "sharegpt.manifest.json");
      const manifest = new ManifestGenerator().create({
        filePath: outputPath,
        relativeFilePath: outputPath.split(/[\\/]/).pop(),
        content: jsonl,
        recordCount: tasks.length,
        taskIds: tasks.map((task) => task.id),
        format: "sharegpt",
        profile: "sharegpt",
        profileVersion: profileSemver(PROFILE_VERSIONS.sharegpt),
        sourceTasksCount: tasks.length,
        sourceTools: countSourceTools(tasks)
      });
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

      const verification = await new ManifestValidator().verifyFile(manifest, outputPath);
      if (!verification.passed) {
        throw new Error(`ShareGPT export verification failed: ${verification.errors.map((error) => error.message).join("; ")}`);
      }

      repository.recordExport({
        id: manifest.dataset_id,
        createdAt: manifest.source.generated_at,
        format: "sharegpt",
        filePath: outputPath,
        manifestPath,
        sessionCount: tasks.length,
        messageCount: countExportedMessages(tasks),
        filter: manifest.pipeline.filter_config
      });

      this.logger.info(`ShareGPT export finished. records=${tasks.length}, output=${outputPath}, manifest=${manifestPath}`);
      return {
        ok: true,
        exported: tasks.length,
        outputPath,
        manifestPath,
        datasetId: manifest.dataset_id
      };
    } finally {
      repository.close();
    }
  }
}

function profileSemver(profileVersion) {
  return String(profileVersion || "").split("@").pop();
}

function countSourceTools(tasks) {
  const counts = {};
  for (const task of tasks) {
    const tool = task.source?.ai_tool || "unknown";
    counts[tool] = (counts[tool] || 0) + 1;
  }
  return counts;
}

function countExportedMessages(tasks) {
  return tasks.reduce((total, task) => total + (task.sessions || []).reduce((sessionTotal, session) => sessionTotal + (session.conversation || []).length, 0), 0);
}
