# Vibe Archive

Vibe Archive is a local-first AI coding session archive and training dataset export tool.

This alpha extension reads a local `archive.db`, shows archived Codex sessions in the Activity Bar, and opens session details inside VS Code.

## Current Alpha Flow

```bash
node packages/cli/src/index.js import-codex --root ~/.codex --db ./archive.db --scan-days 7
```

Open the workspace in VS Code, configure `vibeArchive.databasePath` if needed, then open the Vibe Archive Activity Bar view.
