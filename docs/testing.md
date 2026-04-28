# 测试记录

> **日期**：2026-04-27 23:20，中国时区（UTC+8）  
> **执行者**：Codex  
> **阶段**：项目启动 / 首个核心 Pipeline 切片

## 1. 执行结果

| 命令 | 结果 | 说明 |
|---|---|---|
| `npm run compile` | 通过 | 执行 `tsc --noEmit` 与 `node --check` |
| `npm run typecheck` | 通过 | TypeScript 6.0.3 类型检查通过 |
| `npm test` | 通过 | 14 个测试全部通过 |
| `npm run test:integration` | 通过 | 2 个 CLI 集成测试通过 |
| `npm run check:schema-alignment` | 通过 | 主规范包含 `vibe-archive.task.v0.4.1` |
| `npm run check:profile-alignment` | 通过 | ShareGPT Profile 包含 `sharegpt@1.0.0` |
| `npm run check:manifest` | 通过 | Manifest 规范包含 `vibe-archive.manifest.v1.0` |
| `npm run check:cli-help` | 通过 | CLI 帮助输出正常 |
| `npm run package` | 通过（占位） | 当前只输出打包占位提示，未生成 VSIX |

## 2. 覆盖范围

| 模块 | 覆盖点 |
|---|---|
| CodexParser | JSONL 解析、角色映射、非法行容错、诊断记录 |
| CodexParser 真实格式 | `session_meta`、`turn_context`、`response_item`、`event_msg:user_message`、`exec_command_end` |
| 文本清理 | 提取 `## My request for Codex:` 后的真实用户请求，改善 session title 与 task intent |
| CodexScanner | `sessions/YYYY/MM/DD/rollout-*.jsonl` 文件发现与解析 |
| SessionTaskBuilder | session → VibeTask 最小映射 |
| SqliteArchiveRepository | session、message、task、diagnostics、migration 落库与重复 upsert |
| PathMasker | Home / workspace 路径脱敏、敏感环境变量遮盖 |
| SemanticValidator | 样例任务通过、无效 decision session 报 VA-011 |
| ShareGptExporter | user / assistant 角色映射、profile_version |
| ManifestGenerator | Manifest v1.0 必需字段、checksum |
| CLI | validate、export、manifest verify |
| CLI import | `import-codex` 导入临时 Codex home 到 SQLite，`db sessions` 查询，`export --db` 导出 ShareGPT + Manifest |
| CLI DB 详情 | `db sessions --format table` 和 `db show <session-id>` 展示 session、task、diagnostics、message preview |
| Extension TreeView | `SessionsTreeProvider` 使用 SQLite Repository 查询 session |
| Extension Detail | `SessionDetailPanel` 展示 session、task、diagnostics、message preview |

## 3. 未覆盖范围

| 模块 | 状态 |
|---|---|
| VS Code TreeView | 未实现 |
| VS Code 命令注册 | 未实现 |
| CodexScanner | 未实现 |
| Repository | SQLite 主路径已实现；JSON Repository 备选未实现 |
| SQLite 迁移 | 初始迁移记录已实现；后续 schema 变更迁移未实现 |
| 真实 Codex dogfooding | 未执行 |

## 4. 2026-04-28 更新

用户已在本机终端完成依赖安装：

- `typescript@6.0.3`
- `@types/vscode`
- `@vscode/vsce`
- `better-sqlite3`
- `@types/better-sqlite3`

观察：安装过程中 `undici@7.25.0` 提示 Node 版本需要 `>=20.18.1`，当前为 `v20.17.0`。该提示未阻塞当前测试；发布打包前建议升级 Node。

## 5. 2026-04-28 01:04 更新

新增并验证 CLI 数据库闭环：

```bash
node packages/cli/src/index.js import-codex --root <codex-home> --db <archive.db> --scan-days 30
node packages/cli/src/index.js db sessions --db <archive.db> --limit 20
node packages/cli/src/index.js export --format sharegpt --db <archive.db> --output <dataset.jsonl>
node packages/cli/src/index.js manifest verify <manifest.json> --data <dataset.jsonl>
```

该链路已由 `test/cli/cli.integration.test.js` 覆盖：临时 Codex home → SQLite → session 查询 → ShareGPT JSONL → Manifest。

## 6. 2026-04-28 01:09 更新

真实 Codex dogfooding 结果：

```bash
node packages/cli/src/index.js import-codex --root /Users/magicyang/.codex --db /tmp/vibe-archive-real-codex-v2.db --scan-days 7
```

输出：

```json
{
  "imported": 3,
  "failed": 0,
  "messages": 2792,
  "db": "/tmp/vibe-archive-real-codex-v2.db",
  "root": "/Users/magicyang/.codex"
}
```

观察：

- 真实 Codex JSONL 顶层格式为 `session_meta` / `event_msg` / `response_item` / `turn_context`。
- 已适配 `payload.type=message`、`payload.type=function_call`、`payload.type=function_call_output`、`payload.type=exec_command_end`、`payload.type=user_message`。
- `response_item role=user` 多包含上下文注入；当前 parser 优先使用 `event_msg:user_message` 作为真实用户输入，session title 已明显改善。
- 3 个真实 session 均为 `parseStatus=ok`，`parseErrorCount=0`。

## 7. 2026-04-28 01:14 更新

用户在项目根目录 `./archive.db` 重新执行真实导入：

```json
{
  "imported": 3,
  "failed": 0,
  "messages": 2840,
  "db": "./archive.db",
  "root": "/Users/magicyang/.codex"
}
```

新增 `extractUserRequest` / `compactTitle` 文本清理逻辑后：

- `# Context from my IDE setup` 包装会被剥离。
- session title 优先取 `## My request for Codex:` 后的真实请求。
- VibeTask `task.intent` 同步使用清理后的真实请求。
- 当前测试数增加到 14 个，全部通过。

## 8. 2026-04-28 DB 可视化验证

新增命令：

```bash
node packages/cli/src/index.js db sessions --db ./archive.db --limit 3 --format table
node packages/cli/src/index.js db show <session-id> --db ./archive.db --messages 3
```

验证结果：

- 表格列表可显示 `id`、`status`、`messages`、`tools`、`title`。
- `db show` 可显示 session 元数据、VibeTask intent、diagnostics、message preview。
- 当前真实数据中 `parseStatus=ok`、`parseErrorCount=0`。

## 9. 2026-04-28 Extension 只读 UI

新增 VS Code extension 只读 UI：

- `vibeArchive.sessions` TreeView
- `vibeArchive.refreshSessions`
- `vibeArchive.openSession`
- `SessionDetailPanel` Webview
- `vibeArchive.databasePath` 配置项
- `vibeArchive.sessionsLimit` 配置项

验证结果：

- `npm run compile` 通过。
- `npm test` 14 项通过。
- GUI 手工验证待执行。

## 10. 2026-04-28 VSIX Bundling 验证

新增打包命令：

```bash
npm run bundle:extension
npm run package:vsix
```

验证结果：

- `npm run bundle:extension` 通过，生成 `packages/extension/dist/extension.js`。
- `npm run package:vsix` 通过，生成 `dist/vibe-archive-0.1.0-alpha.0.vsix`。
- VSIX 内容包含 `dist/extension.js`、`dist/native/better_sqlite3.node`、`media/vibe-archive-icon.svg`、`media/vibe-archive-marketplace-icon.png`。
- `better-sqlite3` 的 JS 层已随 extension bundle 打包，native binding 以 `dist/native/better_sqlite3.node` 形式随 VSIX 携带。
- `npm run compile` 通过。
- `npm test` 14 项通过。
- `npm run test:integration` 2 项通过。
- `npm run check:schema-alignment` / `check:profile-alignment` / `check:manifest` / `check:cli-help` 均通过。

遗留验证：

- VSIX 安装后的 Extension Development Host / 本机安装手工验证待执行。
- 已补充 `.github/workflows/vsix.yml` 多平台 native binding 构建矩阵，覆盖 `darwin-arm64`、`darwin-x64`、`linux-x64`、`linux-arm64`、`win32-x64`。
- 矩阵仍需在 GitHub Actions 实际运行后确认各平台产物可用。

## 11. 2026-04-28 Marketplace 元信息与平台包验证

新增发布元信息：

- extension id 对齐为 `pzc163.vibe-archive`。
- extension `repository` 指向 `https://github.com/pzc163/vibe-archive.git`。
- root workspace 改名为 `vibe-archive-workspace`，避免与 extension package name 冲突。

新增多平台打包入口：

```bash
node scripts/package-vsix.mjs --target darwin-arm64
```

验证结果：

- `npm run package:vsix` 通过，`vsce` 不再提示 repository 缺失。
- `extension.vsixmanifest` 中 Identity 为 `Publisher="pzc163"`、`Id="vibe-archive"`。
- `node scripts/package-vsix.mjs --target darwin-arm64` 通过，生成 `dist/vibe-archive-0.1.0-alpha.0-darwin-arm64.vsix`。

## 12. 2026-04-28 M6 隐私与脱敏验证

新增验证覆盖：

- `PathMasker` 覆盖 `{HOME}`、`{WORKSPACE}`、`/Users/<name>`、`/home/<name>`、`C:\Users\<name>`。
- 敏感变量覆盖 `TOKEN`、`SECRET`、`KEY`、`PASSWORD`，包含 env assignment、冒号键值、对象字段值。
- 敏感文件覆盖 `.env*`、`*.pem`、`*.key`。
- `CodexParser` 默认在落库前脱敏 message、diagnostics sample、metadata/sourceSpecific、session sourcePath/workspaceRoot。
- `ShareGptExporter` 对整条导出记录做兜底脱敏。
- `SessionTaskBuilder` 输出 `privacy.paths_masked=true`，`raw_snapshot_enabled=false`。

验证命令：

```bash
npm run compile
node --test test/privacy test/parser/codex-parser.test.js test/export/sharegpt-exporter.test.js test/task/session-task-builder.test.js
npm test
npm run test:integration
npm run check:schema-alignment
npm run check:profile-alignment
npm run check:manifest
npm run check:cli-help
npm run package:vsix
```

验证结果：

- `npm run compile` 通过。
- 隐私、parser、exporter、builder 局部 17 项测试通过。
- `npm test` 28 项通过。
- `npm run test:integration` 2 项通过。
- schema/profile/manifest/CLI help 检查全部通过。
- `npm run package:vsix` 通过，生成 `dist/vibe-archive-0.1.0-alpha.0.vsix`。

## 13. 2026-04-28 M7 验证器与一致性检查验证

新增验证能力：

- `SemanticValidator` 覆盖 VA-001 ~ VA-015。
- `VA-001` 覆盖 session 顺序和 conversation timestamp 顺序。
- `VA-002` / `VA-003` / `VA-008` 输出 warning，不阻断 validate。
- `VA-004` / `VA-014` 覆盖 tool call 引用链。
- `VA-005` / `VA-006` / `VA-007` / `VA-009` 覆盖 hash、路径脱敏、质量分、follow-up 链接。
- `VA-010` 集中覆盖 source、task、session、message、tool_call、change、decision、outcome 枚举。
- `VA-011` ~ `VA-015` 保持 decision / change / timestamp 一致性约束。
- 新增 `npm run check:validator-alignment`，检查标准文档、验证器实现、验证器测试均包含 VA-001 ~ VA-015。
- `npm run check:profile-alignment` 扩展到 6 个 Stable Profile。

验证命令：

```bash
npm run compile
node --test test/validation/semantic-validator.test.js test/task/session-task-builder.test.js
npm run check:validator-alignment
npm run check:profile-alignment
npm test
npm run test:integration
npm run check:schema-alignment
npm run check:manifest
npm run check:cli-help
npm run package:vsix
```

验证结果：

- `npm run compile` 通过。
- Validator 局部 7 项测试通过。
- `npm run check:validator-alignment` 通过。
- `npm run check:profile-alignment` 通过。
- `npm test` 29 项通过。
- `npm run test:integration` 2 项通过。
- schema/manifest/CLI help 检查全部通过。
- `npm run package:vsix` 通过，生成 `dist/vibe-archive-0.1.0-alpha.0.vsix`。

## 14. 2026-04-28 M8 导出链路验证

新增验证能力：

- `ShareGptProfileValidator` 校验 ShareGPT JSONL 每行：
  - record 必须是对象。
  - `id` 必须存在。
  - `conversations` 必须是非空数组。
  - `conversations[].from` 只能是 `human` 或 `gpt`。
  - `conversations[].value` 必须是非空字符串。
  - `metadata.profile_version` 必须为 `sharegpt@1.0.0`。
- `ShareGptExporter` 默认在生成记录时执行 Profile 校验，失败即抛错。
- `ManifestValidator.verifyFile()` 在 checksum 与 record_count 之外，对 `source.profile=sharegpt` 的数据文件执行 ShareGPT Profile 校验。
- CLI `export` 写入 JSONL 与 Manifest 后立即自验证，验证失败会中止命令。
- CLI `export --db` 成功后会写入数据库 `exports` 历史记录。

验证命令：

```bash
npm run compile
node --test test/export/sharegpt-exporter.test.js test/manifest/manifest.test.js test/cli/cli.integration.test.js
npm test
npm run test:integration
npm run check:schema-alignment
npm run check:validator-alignment
npm run check:profile-alignment
npm run check:manifest
npm run check:cli-help
npm run package:vsix
```

验证结果：

- `npm run compile` 通过。
- 导出、Manifest、CLI 局部 7 项测试通过。
- `npm test` 31 项通过。
- `npm run test:integration` 2 项通过。
- schema/validator/profile/manifest/CLI help 检查全部通过。
- `npm run package:vsix` 通过，生成 `dist/vibe-archive-0.1.0-alpha.0.vsix`。

## 15. 2026-04-28 M9 插件侧 ShareGPT 导出验证

新增插件导出能力：

- `vibeArchive.exportShareGPT` 不再是占位提示。
- 命令打开 VS Code `showSaveDialog`，默认输出到工作区 `sharegpt.jsonl`。
- `ShareGptExportService` 从当前 archive repository 读取 VibeTask。
- 导出 `sharegpt.jsonl`。
- 同目录生成 `sharegpt.manifest.json`。
- 写入后执行 `ManifestValidator.verifyFile()`，校验 checksum、record_count 和 ShareGPT Profile。
- 成功后写入 repository `exports` 历史记录。
- 空 archive 时给用户 warning，不生成空训练数据。
- 新增 `npm run check:extension-export`，静态验收插件命令已接入保存对话框、导出服务、Manifest verify 和 export history。

验证命令：

```bash
npm run compile
npm run check:extension-export
npm test
npm run test:integration
npm run check:schema-alignment
npm run check:validator-alignment
npm run check:profile-alignment
npm run check:manifest
npm run check:cli-help
npm run package:vsix
```

验证结果：

- `npm run compile` 通过。
- `npm run check:extension-export` 通过。
- `npm test` 31 项通过。
- `npm run test:integration` 2 项通过。
- schema/validator/profile/manifest/CLI help 检查全部通过。
- `npm run package:vsix` 通过，生成 `dist/vibe-archive-0.1.0-alpha.0.vsix`。

## 16. 2026-04-28 M10 清除、隐私控制与真实数据 dogfooding

新增能力：

- Repository 接口新增 `purgeAll()`。
- SQLite Repository 清除：
  - `sessions`
  - `messages`
  - `vibe_tasks`
  - `parse_diagnostics`
  - `exports`
  - `import_offsets`
  - 保留 `schema_migrations`
- JSON Repository 清除等价数据结构，并保留 migrations。
- 插件 `vibeArchive.purgeData` 接入真实清除流程。
- purge 确认文案明确：只删除 Vibe Archive 本地数据，不删除 Codex 源文件，不删除已导出的 JSONL/Manifest 文件。
- 新增 `npm run check:privacy-lifecycle`。
- 新增 `npm run dogfood:codex` / `scripts/dogfood-codex.mjs`，可复跑真实 Codex 数据闭环。
- README 补充 local-first、读取目录、脱敏、导出 Manifest 和清除策略。
- 新增 `RELEASE_NOTES.md` 作为 `0.1.0-alpha` 内测说明。

真实 dogfooding 命令：

```bash
node scripts/dogfood-codex.mjs \
  --root /Users/magicyang/.codex \
  --db /tmp/vibe-archive-m10-dogfood-fixed/archive.db \
  --output /tmp/vibe-archive-m10-dogfood-fixed/sharegpt.jsonl \
  --scan-days 7 \
  --purge-after
```

真实 dogfooding 结果：

- `importedSessions`: 3
- `failedSessions`: 0
- `messages`: 4362
- `exportedRecords`: 3
- `manifestVerified`: true
- `privacyLeakCheck.passed`: true
- purge 前：`sessions=3`、`tasks=3`、`exports=0`
- purge 统计：`sessions=3`、`messages=4362`、`tasks=3`、`diagnostics=3`、`exports=0`、`importOffsets=0`
- purge 后：`sessions=0`、`tasks=0`、`exports=0`
- `sourceRootStillExists`: true

验证命令：

```bash
npm run compile
npm test
npm run test:integration
npm run check:schema-alignment
npm run check:validator-alignment
npm run check:profile-alignment
npm run check:manifest
npm run check:cli-help
npm run check:extension-export
npm run check:privacy-lifecycle
npm run package:vsix
```

验证结果：

- `npm run compile` 通过。
- `npm test` 31 项通过。
- `npm run test:integration` 2 项通过。
- schema/validator/profile/manifest/CLI help/extension export/privacy lifecycle 检查全部通过。
- `npm run package:vsix` 通过，生成 `dist/vibe-archive-0.1.0-alpha.0.vsix`。

额外发现与修复：

- 初次真实 dogfooding 发现 `.env*` / `*.pem` / `*.key` 脱敏正则在真实超长 tool output 上出现严重回溯。
- 已改为线性 token 扫描，修复后同样真实数据 7 天扫描在数秒内完成。

## 17. 2026-04-28 M8 手动导入、CI 完整化与 QA 刷新

新增能力：

- 插件 `vibeArchive.importJsonl` 已接入真实手动导入链路。
- 支持选择 JSON/JSONL 文件或目录。
- 支持目录递归发现 `.jsonl` / `.json`。
- 导入前展示文件数、估计行数和总字节数。
- 支持 Codex / Generic 来源选择。
- Codex 来源复用 `CodexParser` 与 `SessionTaskBuilder`。
- Generic 来源使用 `generic-jsonl-v1` parserVersion，并保留 parse diagnostics。
- 导入完成后刷新 Sessions TreeView。
- 新增 `npm run check:manual-import` 静态验收，检查命令入口、预览、导入、TreeView 刷新和 service 关键链路。
- GitHub Actions VSIX workflow 已补齐 validator/manual-import/extension-export/privacy-lifecycle 检查。
- `docs/mvp-qa.md` 已刷新为 M0-M10 alpha QA checklist。
- `plan.md` 已作为项目管理事实来源，集中标注 Done 与 Deferred。

验证命令：

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

验证结果：

- `npm run compile` 通过。
- `npm test` 31 项通过。
- `npm run test:integration` 2 项通过。
- schema/validator/profile/manifest/CLI help/manual-import/extension export/privacy lifecycle 检查全部通过。
- `npm run package:vsix` 通过，生成 `dist/vibe-archive-0.1.0-alpha.0.vsix`。

GUI 手工验收状态：

- QA checklist 已在 `docs/mvp-qa.md` 中补齐。
- 手动导入、TreeView、详情页、导出、Manifest verify、purge 的人工验收步骤已列出。
- 实际 Extension Development Host 截图/录屏记录尚未执行，已在 `plan.md` 标记为 Deferred。

## 18. 2026-04-28 远端 CI 修复验证

远端失败现象：

```text
Error: Cannot find module '/home/runner/work/vibe-archive/vibe-archive/test'
```

原因：

- GitHub Actions 使用 Node 22。
- `node --test test` 在该环境中把 `test` 当作可加载模块路径处理。
- 本机 Node 20 可运行该写法，但该行为不能作为跨版本 CI 契约。

修复：

- 新增 `scripts/run-tests.mjs`。
- 脚本递归收集 `.test.js` 文件，去重、排序后将明确文件列表传给 `node --test`。
- `npm test` 改为 `node scripts/run-tests.mjs test`。
- `npm run test:integration` 改为 `node scripts/run-tests.mjs test/cli`。

本地验证命令：

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

验证结果：

- `npm run compile` 通过。
- `npm test` 31 项通过。
- `npm run test:integration` 2 项通过。
- schema/validator/profile/manifest/CLI help/manual-import/extension export/privacy lifecycle 检查全部通过。
- `npm run package:vsix` 通过。
