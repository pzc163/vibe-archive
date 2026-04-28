# Changelog

## 0.1.0

Initial Marketplace pre-release.

### Added

- VS Code Activity Bar container and Sessions TreeView.
- Codex path detection with `vibeArchive.codex.customPath`, `CODEX_HOME`, and `~/.codex`.
- First-run consent before Codex session scanning.
- Incremental Codex JSONL scanning with offset tracking, pending-line handling, and truncate/rotate reset.
- Parser support for current Codex session payloads.
- Local SQLite archive storage with JSON storage fallback.
- Database migrations, indexes, import offsets, and export history.
- Session detail Webview with task intent, diagnostics, and message preview.
- Manual JSONL/JSON import from files or directories.
- ShareGPT JSONL export from archived VibeTasks.
- Export Manifest v1.0 generation and verification.
- ShareGPT profile validation during export and manifest verification.
- Default privacy masking for home/workspace paths, secret-like values, `.env*`, `*.pem`, and `*.key`.
- Local archive purge command that preserves Codex source files and exported datasets.
- VSIX bundling with native `better-sqlite3` binding.
- Multi-platform VSIX CI packaging.

### Known Limits

- GUI screenshot validation is still pending.
- Export preview UI is deferred.
- Streaming export for very large datasets is deferred.
- Performance benchmarks for 100MB JSONL and 1000+ sessions are deferred.
