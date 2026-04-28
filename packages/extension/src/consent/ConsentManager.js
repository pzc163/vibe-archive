import * as vscode from "vscode";

const CONSENT_KEY = "vibeArchive.codexConsent";
const CONSENT_GRANTED = "granted";
const CONSENT_DENIED = "denied";

export class ConsentManager {
  constructor(context, logger) {
    this.context = context;
    this.logger = logger;
  }

  isGranted() {
    return this.context.globalState.get(CONSENT_KEY) === CONSENT_GRANTED;
  }

  isDenied() {
    return this.context.globalState.get(CONSENT_KEY) === CONSENT_DENIED;
  }

  hasDecision() {
    return this.isGranted() || this.isDenied();
  }

  async ensureGranted() {
    if (this.isGranted()) return true;

    const selection = await vscode.window.showInformationMessage(
      "Vibe Archive needs permission to read local Codex session files before scanning. Source files stay on this machine.",
      { modal: true },
      "Allow",
      "Not Now"
    );

    if (selection === "Allow") {
      await this.context.globalState.update(CONSENT_KEY, CONSENT_GRANTED);
      this.logger.info("Codex scan consent granted.");
      return true;
    }

    await this.context.globalState.update(CONSENT_KEY, CONSENT_DENIED);
    this.logger.warn("Codex scan consent denied.");
    return false;
  }

  async revoke() {
    await this.context.globalState.update(CONSENT_KEY, CONSENT_DENIED);
    this.logger.warn("Codex scan consent revoked.");
  }
}
