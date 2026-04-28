# Vibe Archive MVP QA

> **日期**：2026-04-28 15:40，中国时区（UTC+8）  
> **执行者**：Codex  
> **范围**：M0-M10 alpha 内测验收

## 1. 自动化验收

| 能力 | 命令 | 当前结果 |
|---|---|---|
| 编译与类型检查 | `npm run compile` | 通过 |
| 单元测试 | `npm test` | 31 项通过 |
| CLI 集成测试 | `npm run test:integration` | 2 项通过 |
| Schema 对齐 | `npm run check:schema-alignment` | 通过 |
| Validator 对齐 | `npm run check:validator-alignment` | 通过 |
| Profile 对齐 | `npm run check:profile-alignment` | 通过 |
| Manifest 对齐 | `npm run check:manifest` | 通过 |
| CLI help | `npm run check:cli-help` | 通过 |
| 插件手动导入入口 | `npm run check:manual-import` | 通过 |
| 插件导出入口 | `npm run check:extension-export` | 通过 |
| 隐私生命周期 | `npm run check:privacy-lifecycle` | 通过 |
| VSIX 打包 | `npm run package:vsix` | 通过，生成 `dist/vibe-archive-0.1.0-alpha.0.vsix` |

完整命令：

```bash
npm run compile
npm test
npm run test:integration
npm run check:schema-alignment
npm run check:validator-alignment
npm run check:profile-alignment
npm run check:manifest
npm run check:cli-help
npm run check:manual-import
npm run check:extension-export
npm run check:privacy-lifecycle
npm run package:vsix
```

## 2. CLI 验收

```bash
node packages/cli/src/index.js validate test/fixtures/task.sample.json
node packages/cli/src/index.js import-codex --root ~/.codex --db /tmp/vibe-archive-cli/archive.db --scan-days 7
node packages/cli/src/index.js db sessions --db /tmp/vibe-archive-cli/archive.db --limit 20
node packages/cli/src/index.js export --format sharegpt --db /tmp/vibe-archive-cli/archive.db --output /tmp/vibe-archive-cli/sharegpt.jsonl
node packages/cli/src/index.js manifest verify /tmp/vibe-archive-cli/sharegpt.manifest.json --data /tmp/vibe-archive-cli/sharegpt.jsonl
```

预期：validate 输出 `OK`；import-codex `failed=0`；export 生成 JSONL 与 `sharegpt.manifest.json`；manifest verify 输出 `OK`。

## 3. 真实 Codex Dogfooding

命令：

```bash
node scripts/dogfood-codex.mjs \
  --root ~/.codex \
  --db /tmp/vibe-archive-m10-dogfood/archive.db \
  --output /tmp/vibe-archive-m10-dogfood/sharegpt.jsonl \
  --scan-days 7 \
  --purge-after
```

最新用户侧结果：

```json
{
  "importedSessions": 3,
  "failedSessions": 0,
  "messages": 4415,
  "exportedRecords": 3,
  "manifestVerified": true,
  "manifestErrors": [],
  "privacyLeakCheck": {
    "passed": true
  },
  "afterPurge": {
    "sessions": 0,
    "tasks": 0,
    "exports": 0
  },
  "sourceRootStillExists": true
}
```

验收结论：真实 Codex 数据扫描、解析、归档、导出、Manifest 校验、隐私检查和清除均通过。

## 4. VS Code Extension 手工验收

准备：

```bash
node packages/cli/src/index.js import-codex --root ~/.codex --db ./archive.db --scan-days 7
npm run compile
npm run package:vsix
```

Extension Development Host 验收步骤：

1. 启动 extension development host。
2. 打开 Activity Bar 的 `Vibe Archive`。
3. 首次启动时确认授权弹窗出现。
4. 拒绝授权后确认不会扫描。
5. 授权后执行 `Vibe Archive: Scan Now`。
6. 确认 `Sessions` TreeView 展示 session。
7. 点击 session，确认详情 Webview 展示 task、diagnostics、message preview。
8. 执行 `Vibe Archive: Import JSONL`，选择 `test/fixtures/codex-session.sample.jsonl`，选择 `Codex`，确认 TreeView 出现导入 session。
9. 执行 `Vibe Archive: Export ShareGPT Dataset`，选择输出 `sharegpt.jsonl`。
10. 确认同目录生成 `sharegpt.manifest.json`。
11. 执行 `node packages/cli/src/index.js manifest verify <manifest> --data <jsonl>`，预期输出 `OK`。
12. 执行 `Vibe Archive: Purge Local Archive`。
13. 确认 TreeView 清空。
14. 确认 `~/.codex` 源目录仍存在。

当前代码侧静态验收：

- `npm run check:manual-import` 通过。
- `npm run check:extension-export` 通过。
- `npm run check:privacy-lifecycle` 通过。

人工 GUI 截图/录屏验收仍需在 VS Code 中执行并附加到内测记录。

## 5. 已知 Deferred 项

| 项目 | 原因 |
|---|---|
| 100MB JSONL / 1000 session / 1 万 message 性能基准 | 需要单独构造 benchmark 数据集 |
| ShareGPT 流式导出 | 当前 alpha 数据量已可用，Phase 1.1 补 generator + stream pipeline |
| 导出预览 UI | 当前导出已自校验，预览交互延期到 Phase 1.1 |
| 来源视图 | TreeView/详情页已可用，来源状态面板延期到 Phase 1.1 |
| Open Dashboard | Dashboard 属于 Phase 2 |
| 远端 GitHub Actions 结果 | workflow 已补齐，需 push 后以 GitHub Actions artifact 为准 |
