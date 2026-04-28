import * as vscode from "vscode";
import { createArchiveRepository } from "../storage/createRepository.js";

export class SessionDetailPanel {
  static open(context, configurationService, sessionId) {
    const repository = createArchiveRepository(configurationService, context);
    let payload;
    try {
      const session = repository.getSession(sessionId);
      if (!session) {
        vscode.window.showWarningMessage(`Session not found: ${sessionId}`);
        return;
      }
      payload = {
        session,
        task: repository.getTaskBySessionId(sessionId),
        diagnostics: repository.getLatestDiagnostics(sessionId),
        messages: repository.getMessages(sessionId).slice(0, 100)
      };
    } finally {
      repository.close();
    }

    const panel = vscode.window.createWebviewPanel(
      "vibeArchive.sessionDetail",
      `Vibe Archive: ${compact(payload.session.title || payload.session.nativeSessionId, 40)}`,
      vscode.ViewColumn.One,
      { enableScripts: false }
    );
    panel.webview.html = renderHtml(payload);
    context.subscriptions.push(panel);
  }
}

function renderHtml({ session, task, diagnostics, messages }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 20px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    h2 { font-size: 15px; margin-top: 24px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 6px; }
    .meta { color: var(--vscode-descriptionForeground); line-height: 1.6; }
    .grid { display: grid; grid-template-columns: 160px 1fr; gap: 6px 12px; }
    .message { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 10px; margin: 8px 0; }
    .role { font-weight: 600; color: var(--vscode-symbolIcon-functionForeground); }
    pre { white-space: pre-wrap; word-break: break-word; margin: 8px 0 0; color: var(--vscode-editor-foreground); }
    code { color: var(--vscode-textPreformat-foreground); }
  </style>
</head>
<body>
  <h1>${escapeHtml(session.title || session.nativeSessionId)}</h1>
  <div class="meta">${escapeHtml(session.workspaceRoot || "")}</div>

  <h2>Task</h2>
  <div class="grid">
    <div>ID</div><div><code>${escapeHtml(task?.id || "")}</code></div>
    <div>Intent</div><div>${escapeHtml(task?.task?.intent || "")}</div>
    <div>Type</div><div>${escapeHtml(task?.task?.type || "")}</div>
    <div>Languages</div><div>${escapeHtml((task?.metadata?.languages || []).join(", "))}</div>
  </div>

  <h2>Diagnostics</h2>
  <div class="grid">
    <div>Status</div><div>${escapeHtml(session.parseStatus)}</div>
    <div>Total lines</div><div>${diagnostics?.totalLines ?? ""}</div>
    <div>Parsed lines</div><div>${diagnostics?.parsedLines ?? ""}</div>
    <div>Failed lines</div><div>${diagnostics?.failedLines ?? ""}</div>
    <div>Messages</div><div>${session.messageCount}</div>
    <div>Tool calls</div><div>${session.toolCallCount}</div>
  </div>

  <h2>Messages</h2>
  ${messages.map(renderMessage).join("")}
</body>
</html>`;
}

function renderMessage(message) {
  return `<div class="message">
    <div><span class="role">${escapeHtml(message.role)}</span> <span class="meta">${escapeHtml(message.rawType || "")} ${escapeHtml(message.timestamp || "")}</span></div>
    <pre>${escapeHtml(compact(message.content || "", 2000))}</pre>
  </div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function compact(value, maxLength) {
  const text = String(value || "").trim();
  return text.length > maxLength ? text.slice(0, maxLength - 1) + "…" : text;
}
