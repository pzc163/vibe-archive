# Vibe Archive

Vibe Archive is a local-first archive for AI coding sessions. It helps you scan local Codex history, review sessions inside VS Code, export ShareGPT training data, and keep an Export Manifest beside every dataset.

This Marketplace pre-release is intended for early testing. It is designed to keep source data on your machine and make every export reproducible.

## What It Does

- Scans local Codex session history from `~/.codex` or a custom Codex home.
- Stores parsed sessions in a local Vibe Archive database.
- Shows sessions in the Vibe Archive Activity Bar view.
- Opens a session detail view with task intent, diagnostics, and message previews.
- Imports JSONL or JSON files manually as a fallback path.
- Exports ShareGPT JSONL datasets from archived sessions.
- Writes a `sharegpt.manifest.json` file beside every exported dataset.
- Verifies Manifest checksums, record counts, and ShareGPT profile constraints.
- Purges Vibe Archive local data without deleting Codex source files.

## Privacy Model

Vibe Archive is local-first.

- It does not upload your sessions.
- It does not call a remote AI API.
- It reads Codex session files only after you authorize scanning.
- It masks home/workspace paths and common secret-like values before storage/export.
- It defaults to generated archive data, not raw snapshots.
- `Purge Local Archive` removes Vibe Archive data only. It does not delete `~/.codex` or exported JSONL/Manifest files.

You still control where exported datasets are written. Review exported files before sharing them.

## Getting Started

1. Install the pre-release extension.
2. Open a workspace in VS Code.
3. Open the Vibe Archive Activity Bar view.
4. Run `Vibe Archive: Scan Now`.
5. Approve Codex session scanning when prompted.
6. Open a session from the Sessions view.
7. Run `Vibe Archive: Export ShareGPT Dataset` to create a dataset and Manifest.

The default Codex lookup order is:

```text
vibeArchive.codex.customPath
CODEX_HOME
~/.codex
```

## Commands

| Command | Purpose |
|---|---|
| `Vibe Archive: Scan Now` | Scan recent Codex sessions and import them into the local archive. |
| `Vibe Archive: Refresh Sessions` | Reload the Sessions view from the local archive. |
| `Vibe Archive: Open Session` | Open a selected session detail view. |
| `Vibe Archive: Import JSONL` | Import JSONL/JSON files or directories manually. |
| `Vibe Archive: Export ShareGPT Dataset` | Export archived tasks as ShareGPT JSONL and Manifest. |
| `Vibe Archive: Purge Local Archive` | Delete Vibe Archive local data while preserving Codex source files. |
| `Vibe Archive: Show Log` | Open the extension log output channel. |

## Settings

| Setting | Default | Description |
|---|---:|---|
| `vibeArchive.autoScan` | `false` | Request permission and prepare scanning when the extension activates. |
| `vibeArchive.scanDays` | `30` | Number of recent days to scan from Codex history. |
| `vibeArchive.codex.enabled` | `true` | Enable Codex session discovery. |
| `vibeArchive.codex.customPath` | `""` | Custom Codex home path. Empty uses `CODEX_HOME`, then `~/.codex`. |
| `vibeArchive.databasePath` | `""` | Path to `archive.db`. Empty uses the first workspace folder. |
| `vibeArchive.storageBackend` | `sqlite` | Storage backend. SQLite is default; JSON is the fallback. |
| `vibeArchive.jsonStorePath` | `""` | Path to JSON archive store when using the JSON backend. |
| `vibeArchive.sessionsLimit` | `100` | Maximum number of sessions shown in the Sessions view. |

## Current Pre-Release Limits

- GUI screenshot validation is still in progress.
- Export preview UI is deferred.
- Very large dataset streaming export is deferred.
- Performance benchmarks for 100MB JSONL and 1000+ sessions are deferred.
- Source view and dashboard are deferred.

## CLI Companion

The repository also includes a CLI for repeatable local checks:

```bash
node packages/cli/src/index.js import-codex --root ~/.codex --db ./archive.db --scan-days 7
node packages/cli/src/index.js export --format sharegpt --db ./archive.db --output ./sharegpt.jsonl
node packages/cli/src/index.js manifest verify ./sharegpt.manifest.json --data ./sharegpt.jsonl
```

## Feedback

Report issues at:

https://github.com/pzc163/vibe-archive/issues
