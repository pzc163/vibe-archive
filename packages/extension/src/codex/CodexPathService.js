import * as vscode from "vscode";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, normalize } from "node:path";

export class CodexPathService {
  constructor(configurationService, logger) {
    this.configurationService = configurationService;
    this.logger = logger;
  }

  resolveCodexRoot() {
    if (!this.configurationService.isCodexEnabled()) {
      return {
        enabled: false,
        source: "disabled",
        path: "",
        exists: false
      };
    }

    const configured = this.configurationService.getCodexCustomPath();
    const envPath = process.env.CODEX_HOME;
    const fallback = join(homedir(), ".codex");
    const rawPath = configured || envPath || fallback;
    const resolvedPath = expandHome(rawPath);
    const exists = isDirectory(resolvedPath);
    const source = configured ? "customPath" : envPath ? "CODEX_HOME" : "default";

    return {
      enabled: true,
      source,
      path: resolvedPath,
      exists
    };
  }

  getRemoteEnvironment() {
    const remoteName = vscode.env.remoteName || "";
    const workspaceSchemes = new Set((vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.scheme));
    return {
      isRemote: Boolean(remoteName) || [...workspaceSchemes].some((scheme) => scheme !== "file"),
      remoteName,
      workspaceSchemes: [...workspaceSchemes]
    };
  }

  warnIfRemote() {
    const remote = this.getRemoteEnvironment();
    if (!remote.isRemote) return false;
    const label = remote.remoteName || remote.workspaceSchemes.join(", ");
    this.logger.warn(`Remote environment detected: ${label}`);
    vscode.window.showWarningMessage(
      `Vibe Archive is running in a remote environment (${label}). Codex path detection will use the remote filesystem.`
    );
    return true;
  }
}

function expandHome(value) {
  const text = String(value || "").trim();
  if (text === "~") return homedir();
  if (text.startsWith("~/")) return normalize(join(homedir(), text.slice(2)));
  return normalize(text);
}

function isDirectory(path) {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}
