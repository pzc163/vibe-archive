# Vibe Archive 0.1.0 Pre-Release

> 日期：2026-04-28 14:55，中国时区（UTC+8）  
> 执行者：Codex

## 目标

`0.1.0` 是 Vibe Archive 的首个 Marketplace pre-release 内测版本，目标是验证从 Codex 本地 session 到 VibeTask、ShareGPT JSONL、Export Manifest v1.0 的完整本地闭环。

## 已包含

- VS Code Extension + CLI 双入口。
- 首次授权与 Codex 路径探测：`vibeArchive.codex.customPath` → `CODEX_HOME` → `~/.codex`。
- Codex JSONL 增量扫描，支持 offset、pending buffer、文件截断/轮转重置。
- Codex parser 适配当前真实 Codex payload 格式。
- SQLite 默认存储，JSON Repository 作为 native SQLite fallback。
- 数据库 migration、索引、导出历史记录。
- VibeTask builder，包含 decision fallback、change 初步提取、落库一致性验证。
- 隐私脱敏：home/workspace 路径、敏感 env、`.env*`、`*.pem`、`*.key`。
- SemanticValidator 覆盖 VA-001 ~ VA-015。
- ShareGPT exporter + ShareGPT Profile 校验。
- Export Manifest v1.0 生成与校验。
- 插件侧 `Scan Now`、Session TreeView、Session Detail Webview。
- 插件侧 `Export ShareGPT Dataset`，导出 JSONL + Manifest 并自验证。
- 插件侧 `Purge Local Archive`，只清除 Vibe Archive 本地数据，不删除 Codex 源文件或已导出的 JSONL/Manifest。
- VSIX bundling，包含 extension bundle、Marketplace PNG 图标、Activity Bar SVG 图标和 `better_sqlite3.node` native binding。

## 内测注意

- 目前 VSIX 已在本机打包通过，GitHub Actions 多平台 native binding 矩阵仍需在远程 CI 实际运行确认。
- Manual JSONL import 已接入真实导入链路，支持文件/目录选择、预览、Codex/Generic 来源选择和 TreeView 刷新。
- `Purge Local Archive` 不删除外部导出文件，内测者需自行管理导出的 JSONL/Manifest 文件。

## 验证命令

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
