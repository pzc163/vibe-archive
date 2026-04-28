export class SourceScanner {
  async scan() {
    throw new Error("SourceScanner.scan() must be implemented by subclasses.");
  }

  watch() {
    throw new Error("SourceScanner.watch() must be implemented by subclasses.");
  }

  dispose() {}
}
