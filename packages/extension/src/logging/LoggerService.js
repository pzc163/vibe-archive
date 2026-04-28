export class LoggerService {
  constructor(outputChannel) {
    this.outputChannel = outputChannel;
  }

  info(message) {
    this.append("INFO", message);
  }

  warn(message) {
    this.append("WARN", message);
  }

  error(message, error) {
    const detail = error instanceof Error ? `${error.message}\n${error.stack || ""}` : String(error || "");
    this.append("ERROR", detail ? `${message}\n${detail}` : message);
  }

  show() {
    this.outputChannel.show(true);
  }

  append(level, message) {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] [${level}] ${message}`);
  }
}
