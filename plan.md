# Vibe Archive 项目开发计划

> **生成时间**：2026-04-27 22:57，中国时区（UTC+8）  
> **执行者**：Codex  
> **计划状态**：可落地执行版  
> **目标版本**：MVP / Phase 1  
> **主要依据**：`PRD/Vibe_Archive_PRD_v2.1.md`、`Data_Standard/Vibe_Archive_Data_Standard_v0.4.1.md`、`RFC/0001-decision-layer.md`、`RFC/0002-change-trace.md`、`Profile/*.md`、`ARCHITECTURE/Vibe_Archive_Export_Manifest_v1.0.md`、`ARCHITECTURE/ARCHITECTURE.md`、`DEVELOPMENT.md`、`README.md`

---

## 1. 结论

当前文档已经足够支撑项目开工。

现有文档覆盖了产品范围、MVP 验收闭环、数据标准、Decision 层、Change 溯源、6 个导出 Profile、参考实现骨架和阶段路线图。剩余不确定性主要是工程选型验证和真实 Codex JSONL 样本适配，不阻塞启动开发。

本计划建议先落地 **VS Code Extension + CLI 双入口 MVP**，目标是在 2-3 周内完成：

1. 本地 Codex 会话自动归档。
2. Codex JSONL 宽松解析。
3. 一个 session 生成一个简化 VibeTask。
4. 本地存储与解析诊断。
5. TreeView 会话列表与详情页。
6. ShareGPT 导出。
7. Export Manifest v1.0。
8. CLI `validate` / `export` 命令。
9. 首次授权、路径脱敏、一键清除。

---

## 2. 当前文档资产

| 层级 | 文件 | 用途 | 开发可用性 |
|---|---|---|---|
| 产品需求 | `PRD/Vibe_Archive_PRD_v2.1.md` | 定义 MVP 范围、用户故事、模块、路线图、验收标准 | 可直接执行 |
| 数据标准 | `Data_Standard/Vibe_Archive_Data_Standard_v0.4.1.md` | 定义 Vibe Archive Task 标准、字段、验证规则、示例 | 可直接执行 |
| RFC | `RFC/0001-decision-layer.md` | 定义最终 session / change 选择机制 | 可直接执行 |
| RFC | `RFC/0002-change-trace.md` | 定义 change 与 session / tool_call 的溯源关系 | 可直接执行 |
| Profile | `Profile/sft-messages.md` | OpenAI messages / SFT 导出规则 | Phase 2 执行 |
| Profile | `Profile/alpaca.md` | Alpaca 导出规则 | Phase 2 执行 |
| Profile | `Profile/sharegpt.md` | ShareGPT 导出规则 | MVP 执行 |
| Profile | `Profile/dpo.md` | DPO 导出规则 | Phase 4 执行 |
| Profile | `Profile/diff-edit.md` | Diff-Edit 导出规则 | Phase 3 执行 |
| Profile | `Profile/agent-trajectory.md` | Agent 轨迹导出规则 | Phase 3 执行 |
| Export Manifest | `ARCHITECTURE/Vibe_Archive_Export_Manifest_v1.0.md` | 导出数据集的可追溯、可复现、可审计说明书 | MVP 执行 |
| 架构文档 | `ARCHITECTURE/ARCHITECTURE.md` | Pipeline、Manifest、存储、模式切换等架构约束 | 可直接执行 |
| 开发文档 | `DEVELOPMENT.md` | 工程目录、迁移、Manifest 生成、开发规范 | 可直接执行 |
| 参考实现 | `README.md` | Python 参考实现骨架和核心逻辑 | 可作为实现参考 |

---

## 3. MVP 产品边界

### 3.1 MVP 要做

| 模块 | MVP 内容 |
|---|---|
| 插件平台 | VS Code Desktop Extension |
| 数据源 | Codex 本地 session JSONL |
| 自动扫描 | `CODEX_HOME/sessions/**/*.jsonl`，默认回退 `~/.codex/sessions/**/*.jsonl` |
| 手动导入 | 用户选择 JSONL 文件或目录 |
| 解析模型 | Raw JSONL → UnifiedSession / UnifiedMessage / CodeEvidence |
| 任务模型 | 一个 session 生成一个简化 VibeTask |
| 存储 | Repository 抽象，优先 SQLite，可回退 JSON 存储 |
| UI | Activity Bar、Sessions TreeView、简版详情 Webview |
| 导出 | ShareGPT JSONL，由 VibeTask 派生 |
| Manifest | 每次导出同目录生成 Export Manifest v1.0 |
| CLI | 提供 `validate` 和 `export --format sharegpt`，复用核心模块 |
| 隐私 | 首次授权、路径脱敏、raw 快照默认关闭、一键清除 |
| 诊断 | 解析成功行、失败行、未知字段样例、错误样例 |

### 3.2 MVP 不做

| 不做项 | 原因 |
|---|---|
| Claude Code 自动扫描 | Phase 2 范围 |
| Kimi Code 自动扫描 | Phase 3 范围 |
| 自动高质量 DPO | 需要明确 chosen / rejected 标注 |
| LLM 任务切分和摘要 | MVP 不依赖 LLM |
| 团队同步和云端能力 | Phase 5 独立设计 |
| 完整全文搜索 | Phase 2 范围 |
| 真实 diff 强归因 | MVP 只记录能从 transcript 或工具调用提取的证据 |

---

## 4. 技术架构

### 4.1 技术栈

| 层 | 选择 |
|---|---|
| 插件运行时 | VS Code Extension API |
| 语言 | TypeScript |
| 构建 | esbuild |
| 测试 | vitest 或 node:test，VS Code 扩展集成测试按后续脚手架确定 |
| 存储主方案 | SQLite Repository |
| 存储备选 | JSON Repository |
| CLI | Node.js CLI，与插件共享 core 包 |
| UI | TreeView + Webview |
| 数据格式 | Vibe Archive Task v0.4.1 的 TypeScript 子集 |

### 4.2 数据流水线

```text
Codex JSONL 文件
  ↓
CodexScanner
  ↓
CodexParser
  ↓
UnifiedSession / UnifiedMessage / CodeEvidence
  ↓
SessionTaskBuilder
  ↓
VibeTask
  ↓
ArchiveRepository
  ↓
TreeView / Webview / CLI / ShareGptExporter / ManifestGenerator
```

### 4.3 关键约束

1. Parser 只做忠实解析，不拼装训练格式。
2. Task Builder 负责从统一会话模型生成 VibeTask。
3. Exporter 只接收 VibeTask，不直接读取原始 transcript。
4. 原始 Codex 文件只读，不修改。
5. 未授权前不启动扫描。
6. 路径和导出内容默认脱敏。
7. 单行 JSON 失败不影响同文件其他行。
8. 增量读取必须处理半行写入。
9. CLI、Exporter、Validator、PathMasker、ManifestGenerator 必须可独立 import，不能依赖 VS Code API。
10. 标准文档、TypeScript 类型、JSON Schema、Exporter 输出必须建立一致性检查。

---

## 5. 工程形态

MVP 采用插件和 CLI 双入口、核心能力共享的结构。插件解决用户体验，CLI 解决标准验证、CI 自动化和跨环境复现。

```text
packages/
  core/                 # 无 VS Code API 依赖
    src/
      model/
      parser/
      task/
      storage/
      privacy/
      validation/
      export/
      manifest/
  extension/            # VS Code Extension 入口
    src/
      extension.ts
      views/
      webview/
      consent/
      scanner/
  cli/                  # 命令行入口
    src/
      index.ts
      commands/
```

共享边界：

| 模块 | 所属包 | 依赖约束 |
|---|---|---|
| VibeTask 类型 | `packages/core` | 不依赖 VS Code |
| CodexParser | `packages/core` | 不依赖 VS Code |
| SessionTaskBuilder | `packages/core` | 不依赖 VS Code |
| SemanticValidator | `packages/core` | 不依赖 VS Code |
| PathMasker | `packages/core` | 不依赖 VS Code |
| ShareGptExporter | `packages/core` | 不依赖 VS Code |
| ManifestGenerator | `packages/core` | 不依赖 VS Code |
| CodexScanner | `packages/extension` | 可依赖 VS Code 配置和 globalStorage |
| TreeView / Webview | `packages/extension` | 可依赖 VS Code API |
| CLI commands | `packages/cli` | 只依赖 core 和 Node.js fs/path |

---

## 6. 标准一致性纪律

### 6.1 一致性检查项

| 检查项 | 时机 | 工具或方式 |
|---|---|---|
| TypeScript 类型 vs v0.4.1 字段表 | 每次 PR | Review Checklist |
| TypeScript 类型 vs JSON Schema | 每次构建 | `typescript-json-schema` 或同类工具生成并对比 |
| SemanticValidator vs VA-001 ~ VA-015 | 每次测试 | validator 单测覆盖规则 ID |
| Exporter 输出 vs Profile 规范 | 每次测试 | 单测断言 `profile_version`、必需字段、角色映射 |
| Manifest 输出 vs Manifest v1.0 Schema | 每次导出与测试 | JSON Schema 校验 |
| CLI `--help` vs 开发文档 | 每次发布 | 快照测试或人工发布清单 |

### 6.2 CI 检查命令

```bash
npm run check:schema-alignment
npm run check:profile-alignment
npm run check:manifest
npm run check:cli-help
```

### 6.3 对齐原则

1. 代码新增 VibeTask 字段时，必须同步更新类型、Schema、Validator 测试和文档引用。
2. 标准文档新增枚举值时，必须同步更新 TypeScript union、JSON Schema 和测试 fixture。
3. Profile 输出结构变化时，必须更新对应 Exporter、Manifest 生成逻辑和 Profile 单测。
4. CLI 与插件不得各自实现一套 Parser / Exporter / Validator。

---

## 7. 性能约束

| 场景 | 约束 | 实现策略 |
|---|---|---|
| TreeView 首屏加载 | <= 100ms | 分页查询，默认 `LIMIT 100`，按时间倒序 |
| 会话详情打开 | <= 300ms | 消息分页或分段渲染，长工具输出折叠 |
| 全量扫描 | 1000 files / min 作为目标基准 | 批量调度，解析工作可迁移到 Worker Thread |
| 大 JSONL 文件 | 单文件 100MB 不崩溃 | 流式读取，按行解析，不一次性读入内存 |
| 大数据集导出 | 进程内存 <= 200MB | generator + stream pipeline，JSONL 流式写入 |
| DB 查询 | 常用查询单次 <= 50ms | sessions、tasks、messages 建索引 |
| 导出 Manifest | 与数据文件 checksum 一致 | 写完 JSONL 后计算 checksum，再生成 manifest |

性能测试至少覆盖：

1. 1000 个 session 的列表查询。
2. 100MB JSONL 的流式解析。
3. 1 万条 message 的 ShareGPT 流式导出。
4. TreeView 首屏查询的索引命中。

---

## 8. 目标目录结构

```text
vibe-archive/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── esbuild.js
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── parser/
│   │       ├── model/
│   │       ├── task/
│   │       ├── storage/
│   │       ├── privacy/
│   │       ├── validation/
│   │       ├── export/
│   │       ├── manifest/
│   │       └── diagnostics/
│   ├── extension/
│   │   └── src/
│   │       ├── extension.ts
│   │       ├── config/
│   │       ├── consent/
│   │       ├── scanner/
│   │       ├── views/
│   │       └── webview/
│   └── cli/
│       └── src/
│           ├── index.ts
│           └── commands/
├── test/
│   ├── fixtures/
│   │   ├── codex-session.sample.jsonl
│   │   └── task.sample.json
│   ├── parser/
│   ├── task/
│   ├── export/
│   ├── manifest/
│   ├── validation/
│   ├── privacy/
│   └── storage/
└── docs/
    └── mvp-qa.md
```

---

## 9. 核心数据模型落地

### 9.1 UnifiedSession

MVP 使用 PRD v2.1 中的 `UnifiedSession`，最小必需字段：

| 字段 | 要求 |
|---|---|
| `id` | 插件生成的稳定 ID |
| `source` | MVP 固定为 `codex` 或 `manual` |
| `nativeSessionId` | 从文件名或原始记录提取 |
| `sourcePath` | 原文件路径，存储前按配置脱敏 |
| `parserVersion` | MVP 使用 `codex-v1` |
| `createdAt` | 优先消息时间，缺失时用文件 mtime |
| `updatedAt` | 优先最后消息时间，缺失时用文件 mtime |
| `messageCount` | 成功解析消息数量 |
| `toolCallCount` | 成功识别的工具调用数量 |
| `parseStatus` | `ok` / `partial` / `failed` |
| `parseErrorCount` | 失败行数量 |

### 9.2 UnifiedMessage

MVP 只保证以下字段稳定：

| 字段 | 要求 |
|---|---|
| `id` | session 内稳定 ID |
| `sessionId` | 关联 UnifiedSession |
| `sequence` | 文件内顺序 |
| `role` | `system` / `user` / `assistant` / `tool` |
| `content` | 文本内容，缺失时为空字符串 |
| `timestamp` | 原始时间或推断时间 |
| `rawType` | 原始 JSON 的类型字段 |
| `toolName` | 能识别时填充 |
| `toolInput` | 能识别时填充 |
| `toolResult` | 能识别时填充，详情页默认摘要展示 |
| `referencedFiles` | 从文本、工具参数、命令中提取 |
| `changedFiles` | 从 file_edit / file_write 类工具中提取 |

### 9.3 VibeTask

MVP 采用 v0.4.1 的简化映射：

| VibeTask 字段 | MVP 来源 |
|---|---|
| `schema` | 固定 `vibe-archive.task.v0.4.1` |
| `id` | `task_${session.id}` |
| `created_at` | session createdAt |
| `updated_at` | session updatedAt |
| `source.ai_tool` | `codex` |
| `source.capture_mode` | `auto_scan` 或 `import` |
| `task.intent` | 首条 user 消息，缺失时使用文件名 |
| `sessions` | 当前 session 转换结果 |
| `context` | MVP 仅填 workspace、引用文件、变更文件等可证据化字段 |
| `changes` | 能从工具调用明确提取时写入，否则为空 |
| `decision` | MVP 可缺省；导出时按 Profile 规则回退到最后 session |
| `outcome` | 无真实证据时不填测试通过 |
| `metadata` | messageCount、toolCallCount、languages、trainingReady 等 |
| `privacy` | pathsMasked、excludedPatterns、retentionPolicy |

---

## 10. 里程碑拆分

### 10.0 当前执行状态（事实来源）

> 更新：2026-04-28 15:40，中国时区（UTC+8）  
> 原则：`Done` 表示代码、自动化检查或 dogfooding 已完成；`Deferred` 表示明确延期到 Phase 1.1 或 Phase 2。

| 里程碑 | 状态 | 当前事实 |
|---|---|---|
| M0 工程脚手架与运行闭环 | Done | workspace、core/cli/extension、compile/test/package、Activity Bar、日志、配置均已实现 |
| M1 授权、配置与路径探测 | Done | `ConsentManager`、globalState、Codex 路径探测、remote 提示和配置项已实现 |
| M1.5 CLI 核心命令 | Done | `validate`、`export --format sharegpt`、`manifest validate`、`manifest verify` 已实现；Schema 深度校验延期 |
| M2 Codex Scanner | Done | glob、watch、offset、pending buffer、truncate/rotate、真实 Codex dogfooding 已通过 |
| M3 Codex Parser 与诊断 | Done | Parser interface、真实 Codex payload、unknown metadata、路径/工具提取和诊断已实现 |
| M4 存储层 | Done | SQLite、JSON fallback、migration、indexes、exports、offsets、purge 已实现 |
| M5 SessionTaskBuilder | Done | VibeTask、intent、metadata、changes、decision fallback、落库一致性已实现 |
| M6 隐私与脱敏 | Done | parser/exporter 脱敏、raw 默认关闭、路径/env/敏感文件脱敏和真实数据性能修复已完成 |
| M7 TreeView 与详情页 | Done / Deferred | TreeView、详情页、诊断展示已实现；来源视图和 GUI 截图记录延期 |
| M8 手动导入 | Done | `vibeArchive.importJsonl` 已接入文件/目录选择、预览、Codex/Generic 选择、递归导入和诊断保留 |
| M9 ShareGPT 导出 | Done / Deferred | CLI/插件导出、Manifest、自校验、历史记录已实现；导出预览与流式导出延期 |
| M10 清除、Dogfooding 与 MVP 打包 | Done | purge、README、QA、release note、VSIX、真实 7 天 Codex dogfooding 均已完成 |

Deferred 明细：

- Deferred: CLI validate 的完整 JSON Schema/Ajv 校验，Phase 1.1 补齐。
- Deferred: M7 来源视图与 GUI 截图/录屏记录，Phase 1.1 补齐。
- Deferred: M9 导出预览 UI，Phase 1.1 补齐。
- Deferred: M9 流式导出，Phase 1.1 补齐。
- Deferred: 100MB JSONL / 1000 session / 1 万 message 性能基准，Phase 1.1 补齐。
- Deferred: `Vibe Archive: Open Dashboard`，归入 Phase 2。

### 10.1 M0：工程脚手架与运行闭环

目标：插件可以在 Extension Development Host 中启动。

任务：

| 编号 | 任务 | 产出 |
|---|---|---|
| M0-01 | 创建 TypeScript workspace 脚手架 | 根 `package.json`、`pnpm-workspace.yaml` |
| M0-02 | 创建 core / extension / cli 三包 | `packages/core`、`packages/extension`、`packages/cli` |
| M0-03 | 配置 esbuild、TypeScript、测试命令 | `npm run compile`、`npm test` |
| M0-04 | 注册 Activity Bar、TreeView、基础命令 | `vibeArchive.scanNow` 等命令可见 |
| M0-05 | 建立配置读取服务 | `ConfigurationService` |
| M0-06 | 建立日志输出通道 | `Vibe Archive` output channel |

验收：

```bash
npm install
npm run compile
npm test
```

VS Code 中能打开 Extension Development Host，并看到 Vibe Archive Activity Bar。

### 10.2 M1：授权、配置与路径探测

目标：未授权不扫描，授权后能定位 Codex 目录。

任务：

| 编号 | 任务 | 产出 |
|---|---|---|
| M1-01 | 实现首次授权弹窗 | `ConsentManager` |
| M1-02 | 存储授权状态 | extension globalState |
| M1-03 | 实现 Codex 路径探测 | `CODEX_HOME` 优先，其次 `~/.codex` |
| M1-04 | 实现 remote 环境检测 | 远程环境提示 |
| M1-05 | 实现配置项 | `autoScan`、`scanDays`、`codex.enabled`、`codex.customPath` |

验收：

| 场景 | 预期 |
|---|---|
| 首次启动 | 展示授权说明 |
| 用户拒绝 | 不扫描任何目录 |
| 用户授权 | 可以执行 scan now |
| 设置自定义路径 | 扫描自定义 Codex 目录 |

### 10.3 M1.5：CLI 核心命令

目标：让标准验证、导出和 CI 自动化不依赖 VS Code 插件进程。

任务：

| 编号 | 任务 | 产出 |
|---|---|---|
| M1.5-01 | 初始化 `packages/cli/` 包 | `package.json`、`tsconfig.json`、`src/index.ts` |
| M1.5-02 | 实现 `vibe-archive validate <file>` | 调用 `SemanticValidator` 和 Schema 校验 |
| M1.5-03 | 实现 `vibe-archive export --format sharegpt` | 复用 `ShareGptExporter` 和 `ManifestGenerator` |
| M1.5-04 | 实现 `vibe-archive manifest validate <file>` | 校验 Export Manifest v1.0 |
| M1.5-05 | 实现 `vibe-archive manifest verify <manifest> --data <file>` | 校验 checksum 和记录数 |
| M1.5-06 | CLI 与插件共享 core 模块 | `packages/core` 被 extension 和 cli 同时 import |

验收：

```bash
npx @vibe-archive/cli validate test/fixtures/task.sample.json
npx @vibe-archive/cli export --format sharegpt --input test/fixtures/task.sample.json --output /tmp/sharegpt.jsonl
npx @vibe-archive/cli manifest validate /tmp/sharegpt.manifest.json
```

最低要求：`Validator`、`Exporter`、`PathMasker`、`ManifestGenerator` 均不依赖 VS Code API。

### 10.4 M2：Codex Scanner

目标：找到最近 N 天 Codex JSONL 文件，并支持增量读取。

任务：

| 编号 | 任务 | 产出 |
|---|---|---|
| M2-01 | 实现 `SourceScanner` 接口 | `scan()`、`watch()`、`dispose()` |
| M2-02 | 实现 Codex glob 扫描 | `sessions/YYYY/MM/DD/rollout-*.jsonl` |
| M2-03 | 实现文件监听 | 新文件与文件变化触发增量导入 |
| M2-04 | 实现 offset 状态 | `import_offsets` 或 JSON 状态 |
| M2-05 | 实现 pending buffer | 支持半行写入 |
| M2-06 | 实现 truncate / rotate 处理 | 文件变小重置 offset |

验收：

| 场景 | 预期 |
|---|---|
| 首次扫描 | 能发现最近 30 天 JSONL |
| 文件追加完整行 | 只解析新增行 |
| 文件追加半行 | 不推进 offset，等待下一次补全 |
| 文件单行错误 | 记录诊断，不中断其他行 |

### 10.5 M3：Codex Parser 与诊断

目标：宽松解析真实或样本 Codex JSONL，生成统一会话模型。

任务：

| 编号 | 任务 | 产出 |
|---|---|---|
| M3-01 | 定义 `Parser` 接口 | `parseFile()`、`parseLine()` |
| M3-02 | 实现 `CodexParser` | 原始 JSONL 到 UnifiedSession |
| M3-03 | 实现角色映射 | user / assistant / tool / system |
| M3-04 | 实现时间戳回退 | 原始时间 → 文件 mtime → 导入时间 |
| M3-05 | 实现工具调用提取 | command、file_read、file_write、file_edit 等 |
| M3-06 | 实现路径提取 | referencedFiles、changedFiles |
| M3-07 | 实现解析诊断 | totalLines、parsedLines、failedLines、errorSamples |

验收：

```bash
npm test -- CodexParser
```

至少覆盖：

1. 标准 user / assistant 消息。
2. 工具调用消息。
3. 空行。
4. 非法 JSON 行。
5. 缺失时间戳。
6. 未知字段保留在 metadata。

### 10.6 M4：存储层

目标：解析结果能稳定落库，并支持 UI 查询。

任务：

| 编号 | 任务 | 产出 |
|---|---|---|
| M4-01 | 定义 `ArchiveRepository` 接口 | sessions、messages、tasks、diagnostics、exports |
| M4-02 | 验证 SQLite 打包链路 | `better-sqlite3` 或备选方案 |
| M4-03 | 实现 schema 初始化 | 可重复执行 |
| M4-04 | 实现 upsert session | source + nativeSessionId 唯一 |
| M4-05 | 实现 message 批量写入 | sessionId + sequence 唯一 |
| M4-06 | 实现 diagnostics 写入 | 解析失败可查询 |
| M4-07 | 实现 JSON Repository 备选 | SQLite 阻塞时可替换 |
| M4-08 | 初始化数据库索引 | `sessions(source, created_at)`、`vibe_tasks(source, created_at)`、`messages(session_id, sequence)` |
| M4-09 | 实现数据库迁移框架 | `packages/core/src/storage/migrations/` |
| M4-10 | 实现空迁移验证 | `v0.4.1-init` 或 `v0.4.0-to-v0.4.1` 空迁移 |

验收：

```bash
npm test -- ArchiveRepository
```

数据库 schema 可重复初始化，迁移可重复执行，重复导入同一 session 不产生重复记录。1000 个 session 的按时间倒序查询应命中索引。

### 10.7 M5：SessionTaskBuilder

目标：每个成功导入 session 生成一个简化 VibeTask。

任务：

| 编号 | 任务 | 产出 |
|---|---|---|
| M5-01 | 定义 VibeTask TypeScript 类型 | 对齐 v0.4.1 必需字段 |
| M5-02 | 实现 `SessionTaskBuilder` | 一个 session → 一个 VibeTask |
| M5-03 | 实现 intent 提取 | 首条 user 消息优先 |
| M5-04 | 实现 metadata 统计 | messageCount、toolCallCount、languages |
| M5-05 | 实现 change 初步提取 | 仅来自明确 file_edit / file_write 工具 |
| M5-06 | 实现 decision 回退策略标记 | 无 decision 时不伪造，仅供导出器 fallback |
| M5-07 | 实现 VibeTask 落库 | `vibe_tasks.task_json` |

验收：

```bash
npm test -- SessionTaskBuilder
```

每个成功导入 session 至少生成：

1. `schema`
2. `id`
3. `created_at`
4. `source`
5. `task.intent`
6. `sessions`
7. `metadata`
8. `privacy`

### 10.8 M6：隐私与脱敏

目标：默认避免导出未脱敏绝对路径。

任务：

| 编号 | 任务 | 产出 |
|---|---|---|
| M6-01 | 实现 `PathMasker` | `{HOME}`、`{WORKSPACE}` 替换 |
| M6-02 | 实现敏感环境变量遮盖 | TOKEN、SECRET、KEY、PASSWORD |
| M6-03 | 实现敏感文件 pattern | `.env*`、`*.pem`、`*.key` 等 |
| M6-04 | 接入 Parser 和 Exporter | 存储和导出前应用 |
| M6-05 | 实现 raw 快照开关 | 默认关闭 |

验收：

```bash
npm test -- PathMasker
```

导出样本中不得出现未脱敏的 `/Users/<name>`、`/home/<name>`、`C:\Users\<name>`。

### 10.9 M7：TreeView 与详情页

目标：用户能在 VS Code 中浏览归档会话。

任务：

| 编号 | 任务 | 产出 |
|---|---|---|
| M7-01 | 实现 `SessionsTreeProvider` | 按时间分页展示 session，默认 `LIMIT 100` |
| M7-02 | 实现 TreeItem 状态 | source、时间、parseStatus |
| M7-03 | 实现手动刷新 | `vibeArchive.scanNow` |
| M7-04 | 实现详情 Webview | 消息列表、工具调用摘要、任务摘要 |
| M7-05 | 展示诊断信息 | failedLines、errorSamples |
| M7-06 | 实现来源视图 | Codex enabled、路径、最近扫描时间 |

验收：

| 场景 | 预期 |
|---|---|
| 有导入数据 | TreeView 显示 session |
| 点击 session | 打开详情页 |
| 有工具调用 | 详情页显示摘要，不默认展开长输出 |
| 有解析错误 | 详情页显示诊断 |

### 10.10 M8：手动导入

目标：用户可以导入 JSONL 文件或目录作为兜底。

任务：

| 编号 | 状态 | 任务 | 产出 |
|---|---|---|---|
| M8-01 | Done | 实现 `vibeArchive.importJsonl` 命令 | 文件选择 |
| M8-02 | Done | 支持目录递归扫描 | `.jsonl`、`.json` |
| M8-03 | Done | 导入前预览 | 文件数、估计行数 |
| M8-04 | Done | 选择来源类型 | Codex / Generic |
| M8-05 | Done | 失败保留诊断 | 不写入主库或标记 failed |

验收：

代码链路与静态验收已完成：用户选择 sample JSONL 后，导入结果刷新 TreeView。实际 GUI 截图/录屏记录标记为 Deferred，见 `10.0 当前执行状态` 和 `21. 完成判定`。

### 10.11 M9：ShareGPT 导出

目标：从 VibeTask 导出 ShareGPT JSONL。

任务：

| 编号 | 任务 | 产出 |
|---|---|---|
| M9-01 | 定义 `Exporter` 接口 | `export(tasks, options)` |
| M9-02 | 实现 `ShareGptExporter` | 对齐 `Profile/sharegpt.md` |
| M9-03 | 实现 session 选择 | decision.final_session_id → accepted → 最后 session |
| M9-04 | 实现角色映射 | user → human，assistant → gpt |
| M9-05 | 实现 tool 消息策略 | 默认不导出正文，metadata 记录统计 |
| M9-06 | 实现导出预览 | 任务数、消息数、估算字符数、敏感风险 |
| M9-07 | 实现文件保存 | 用户选择输出路径 |
| M9-08 | 记录导出历史 | format、filePath、counts、filter |
| M9-09 | 生成 Export Manifest v1.0 | 与 JSONL 同目录输出 `sharegpt.manifest.json` |
| M9-10 | 实现流式导出 | generator + stream pipeline，不一次性加载全部任务 |
| M9-11 | Manifest checksum | JSONL 写入完成后计算 checksum 并写入 manifest |

验收：

```bash
npm test -- ShareGptExporter
```

导出文件为 JSONL，每行一个对象，至少包含：

1. `id`
2. `conversations`
3. `metadata.profile_version = "sharegpt@1.0.0"`

同目录必须生成 `sharegpt.manifest.json`，并符合 `ARCHITECTURE/Vibe_Archive_Export_Manifest_v1.0.md`。CLI `manifest verify` 能验证 manifest 与 JSONL 的 checksum、记录数和格式一致。

### 10.12 M10：一键清除、Dogfooding 与 MVP 打包

目标：形成可内测交付包。

任务：

| 编号 | 任务 | 产出 |
|---|---|---|
| M10-01 | 实现 `vibeArchive.purgeData` | 删除插件生成数据 |
| M10-02 | 明确不删除源工具文件 | 文案和实现双重保证 |
| M10-03 | 编写 README MVP 使用说明 | 本地数据、读取目录、导出说明 |
| M10-04 | 编写 `docs/mvp-qa.md` | 内测验收步骤 |
| M10-05 | 打包 VSIX | 内测包 |
| M10-06 | macOS arm64 验证 | 本机验证记录 |
| M10-07 | 真实 Codex 数据 dogfooding | 用开发者本人 7 天 Codex 历史数据跑通扫描、解析、归档、导出、清除 |
| M10-08 | 生成 alpha release note | `0.1.0-alpha` 发布说明 |

验收：

1. 清除后 TreeView 为空。
2. 清除后数据库、diagnostics、raw、exports 记录被删除。
3. Codex 原始 session 文件仍存在。
4. 本地 VS Code Extension Development Host 运行通过。
5. 至少处理 100 条真实 Codex 消息，整体 parseStatus 为 `ok` 或 `partial`，不得出现整文件 `failed`。

---

## 11. 测试计划

### 11.1 单元测试

| 模块 | 必测内容 |
|---|---|
| `CodexParser` | JSONL 解析、角色映射、错误行跳过、未知字段、时间戳回退 |
| `CodexScanner` | glob、offset、pending buffer、truncate |
| `SessionTaskBuilder` | intent 提取、VibeTask 必需字段、metadata 统计 |
| `PathMasker` | Home 路径、workspace 路径、Windows 路径、环境变量 |
| `ShareGptExporter` | 角色映射、decision fallback、metadata、tool 消息策略 |
| `ManifestGenerator` | manifest_version、dataset_id、checksum、record_count、pipeline |
| `SemanticValidator` | VA-001 ~ VA-015 规则 ID 和失败输出 |
| CLI commands | `validate`、`export`、`manifest validate`、`manifest verify` |
| `ArchiveRepository` | schema 初始化、upsert、重复导入、级联删除 |

### 11.2 集成测试

| 场景 | 输入 | 预期 |
|---|---|---|
| sample 导入 | `test/fixtures/codex-session.sample.jsonl` | 生成 session、messages、VibeTask |
| 单行失败 | 混入非法 JSON 行 | parseStatus 为 partial，诊断可查 |
| 增量追加 | 先导入半文件，再追加 | 只解析新增完整行 |
| 导出 | 已导入任务 | 生成 ShareGPT JSONL 和 Manifest |
| CLI validate | `task.sample.json` | 返回成功或结构化错误 |
| CLI export | `task.sample.json` | 生成 JSONL 和 Manifest |
| 清除 | 已有数据库和导出历史 | 插件生成数据被删除 |

### 11.3 性能测试

| 场景 | 输入 | 预期 |
|---|---|---|
| TreeView 查询 | 1000 个 session | 首屏查询 <= 100ms |
| 大文件解析 | 100MB JSONL | 不 OOM，诊断完整 |
| 大数据导出 | 1 万条 message | 内存 <= 200MB，流式写入 |
| DB 查询 | 常用列表和详情查询 | 单次 <= 50ms |

### 11.4 Dogfooding

| 场景 | 输入 | 预期 |
|---|---|---|
| 真实 Codex 数据 | 开发者本人最近 7 天 session | 扫描、解析、归档、导出、清除完整跑通 |
| 真实消息量 | 至少 100 条消息 | parseStatus 为 `ok` 或 `partial`，无整文件 `failed` |
| 真实导出 | dogfooding 数据导出 ShareGPT | JSONL + Manifest 均可校验 |

### 11.5 手工 QA

| 编号 | 步骤 | 预期 |
|---|---|---|
| QA-01 | 首次启动插件 | 展示授权弹窗 |
| QA-02 | 拒绝授权后点击扫描 | 不扫描并提示需要授权 |
| QA-03 | 授权后扫描 Codex 目录 | TreeView 出现 session |
| QA-04 | 打开 session | 看到 user / assistant / tool 摘要 |
| QA-05 | 导出 ShareGPT | 生成 JSONL 文件 |
| QA-06 | 检查 Manifest | 生成 `sharegpt.manifest.json`，CLI verify 通过 |
| QA-07 | 检查导出内容 | 无未脱敏绝对路径 |
| QA-08 | 执行一键清除 | 插件数据清空，源文件保留 |

---

## 12. 验收标准

### 12.1 功能验收

| 标准 | 要求 |
|---|---|
| 授权 | 未授权前不扫描任何源目录 |
| 扫描 | 能导入最近 30 天 Codex JSONL |
| 增量 | 文件追加后能解析新增完整行 |
| 半行 | 半行写入不推进 offset |
| 解析 | 单行失败不影响同文件其他行 |
| 任务 | 每个成功 session 生成一个 VibeTask |
| UI | TreeView 展示会话并打开详情 |
| 导出 | 至少一个 VibeTask 成功导出 ShareGPT |
| Manifest | 每个导出目录包含 `sharegpt.manifest.json`，符合 Manifest v1.0 |
| CLI | `validate`、`export --format sharegpt`、`manifest verify` 可运行 |
| 真实数据 | 能处理至少 100 条真实 Codex 消息，无整文件 failed |
| 清除 | 一键清除删除插件数据但不删除源文件 |

### 12.2 工程验收

| 标准 | 要求 |
|---|---|
| 类型检查 | `npm run compile` 通过 |
| 测试 | parser、builder、exporter、privacy、repository 单测通过 |
| 打包 | VSIX 或本地开发宿主可运行 |
| 存储 | schema 可重复初始化 |
| 迁移 | migration 表存在，空迁移可重复执行 |
| 性能 | TreeView 首屏、DB 查询、大文件导出达到性能约束 |
| CI | lint、type-check、unit、integration、VSIX build 可在 GitHub Actions 跑通 |
| 边界 | Repository 可替换，Exporter 不直接读取 transcript |
| 标准一致性 | schema/profile/manifest/cli-help 检查命令通过 |

### 12.3 隐私验收

| 标准 | 要求 |
|---|---|
| Local-first | README 明确不上传云端 |
| 读取目录 | README 明确列出 Codex 读取路径 |
| 路径脱敏 | 导出默认不包含未脱敏绝对路径 |
| raw 快照 | 默认关闭 |
| 清除 | 不删除 Codex 原始文件 |

---

## 13. 发布策略与 CI/CD

### 13.1 版本阶段

| 版本 | 目标 | 渠道 |
|---|---|---|
| `0.1.0-alpha` | 内部团队测试 | GitHub Release + VSIX 附件 |
| `0.1.0-beta` | Deep-Think 社区内测 | VS Code Marketplace pre-release |
| `0.2.0` | 公开 MVP | VS Code Marketplace + Open VSX |

### 13.2 GitHub Actions

CI 至少包含：

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run compile
      - run: npm test
      - run: npm run test:integration
      - run: npm run check:schema-alignment
      - run: npm run check:profile-alignment
      - run: npm run check:manifest
      - run: npm run check:cli-help
      - run: npm run package
```

发布前检查：

1. VSIX artifact 可安装。
2. CLI `--help` 输出与 `DEVELOPMENT.md` 一致。
3. `sharegpt.manifest.json` 示例通过 `manifest validate` 和 `manifest verify`。
4. alpha release note 包含已知限制和数据读取目录说明。

---

## 14. 开发顺序建议

| 顺序 | 里程碑 | 理由 |
|---:|---|---|
| 1 | M0 工程脚手架 | 先建立可运行插件骨架 |
| 2 | M1 授权与路径探测 | 防止后续 scanner 绕过授权 |
| 3 | M1.5 CLI 骨架 | 提前保证 core 可独立运行 |
| 4 | M3 Parser | 用 fixture 锁定数据模型 |
| 5 | M4 Repository | 让解析结果可持久化 |
| 6 | M5 TaskBuilder | 建立 IR 中间层 |
| 7 | M9 ShareGPT + Manifest 导出 | 尽早验证训练数据产品闭环 |
| 8 | M2 Scanner 增量能力 | 在核心模型稳定后接真实文件系统 |
| 9 | M7 UI | 数据闭环稳定后做展示 |
| 10 | M8 手动导入 | 作为真实样本调试入口 |
| 11 | M6 隐私加固 | 贯穿实现，最终集中补齐验收 |
| 12 | M10 Dogfooding、打包与清除 | 内测前收尾 |

说明：M2 和 M3 可以并行，但如果只有一个开发者，建议先用 fixture 完成 Parser，再接入真实 Scanner，调试成本更低。

---

## 15. 近期执行清单

### 第 1 天

- [x] 创建 TypeScript workspace 脚手架。
- [x] 创建 `packages/core`、`packages/extension`、`packages/cli`。
- [x] 配置 `npm run compile`、`npm test`、`npm run package`。
- [x] 注册基础命令和 Activity Bar。
- [x] 创建 `test/fixtures/codex-session.sample.jsonl`。
- [x] 创建 `test/fixtures/task.sample.json`。
- [x] 定义 `UnifiedSession`、`UnifiedMessage`、`VibeTask` 类型。

### 第 2-3 天

- [x] 实现 `CodexParser`。
- [x] 实现 `ParseDiagnosticsService`。
- [x] 实现 `SemanticValidator` 基础框架。
- [x] 补齐 parser 单测。
- [x] 实现 `PathMasker`。
- [x] 补齐 privacy 单测。
- [x] 实现 CLI `validate` 命令。

### 第 4-5 天

- [x] 实现 `ArchiveRepository` 接口。
- [x] 验证 SQLite 打包。
- [x] 实现 SQLite 或 JSON Repository。
- [x] 实现数据库索引和迁移框架。
- [x] 实现 `SessionTaskBuilder`。
- [x] 补齐 builder 和 repository 单测。

### 第 6-7 天

- [x] 实现 `ShareGptExporter`。
- [x] 实现 `ManifestGenerator`。
- [ ] Deferred: 实现导出预览。
- [x] 实现导出命令。
- [x] 实现 CLI `export` 和 `manifest verify`。
- [x] 补齐 exporter 单测。

### 第 2 周

- [x] 实现授权流程。
- [x] 实现 Codex 路径探测。
- [x] 实现 CodexScanner 全量扫描。
- [x] 实现 offset 增量读取。
- [x] 实现 pending buffer。
- [x] 接入 TreeView。
- [x] 实现详情 Webview。
- [ ] Deferred: 增加 TreeView 分页查询和 DB 索引性能测试。

### 第 3 周

- [x] 实现手动导入。
- [x] 实现一键清除。
- [x] 补齐 README MVP 使用说明。
- [x] 编写 `docs/mvp-qa.md`。
- [x] 本机真实 Codex 目录测试。
- [x] 用最近 7 天真实 Codex 数据完成 dogfooding。
- [x] 配置 GitHub Actions CI。
- [x] 打包内测 VSIX。

---

## 16. 风险与预案

| 风险 | 影响 | 预案 | 触发条件 |
|---|---|---|---|
| Codex JSONL 字段变化 | Parser 无法稳定映射 | 1. 保留 `rawType` 和 `sourceSpecific` metadata<br>2. 未知字段进入 `metadata._unknownFields`<br>3. 诊断面板展示未知字段样例<br>4. 7 天内发补丁升级 Parser | 单文件未知字段类型 > 3 个，或 failedLines > 5% |
| SQLite native 打包失败 | MVP 不能稳定发布 | 1. Repository 抽象<br>2. 立即切换 JSON Repository<br>3. JSON Repository 路径使用 extension globalStorage 下 `json-store/` | CI 构建失败，或 VSIX 安装后 native module 加载失败 |
| 半行写入导致重复或丢行 | 导入数据不可靠 | 1. pending buffer 与 offset 只在完整行处理后推进<br>2. 重复检测使用 `sourcePath + nativeSessionId + sequence` 唯一约束<br>3. 诊断报告重复率 | 诊断报告重复率 > 1% |
| 真实 session 超大 | UI 卡顿或导出过大 | 1. 详情页分页<br>2. 长工具输出折叠<br>3. 导出前显示估算字符数<br>4. JSONL 流式导出 | 单 session message > 1000，或 tool output > 1MB |
| 大数据量导致查询慢 | TreeView 卡顿 | 1. 建索引<br>2. 默认 `LIMIT 100`<br>3. 性能测试纳入 CI 或 nightly | TreeView 首屏查询 > 100ms |
| Manifest 与数据不一致 | 下游无法追溯 | 1. 写完 JSONL 后计算 checksum<br>2. CLI `manifest verify` 作为导出后校验<br>3. 导出历史记录 manifest 路径 | checksum mismatch 或 record_count mismatch |
| 路径泄露 | 隐私问题 | 1. 存储和导出都经过 PathMasker<br>2. 测试覆盖绝对路径<br>3. 导出前敏感风险预览 | 导出样本出现 `/Users/`、`/home/`、`C:\Users\` |
| Exporter 绕过 IR | 架构耦合 | 1. Exporter 接口类型只接收 VibeTask<br>2. CLI 和插件复用同一 Exporter<br>3. 测试禁止 raw transcript 输入 | Exporter import parser/scanner 或 VS Code API |
| CLI 与插件逻辑分叉 | 标准属性削弱 | 1. core 包单一实现<br>2. CLI 和插件集成测试使用同一 fixture<br>3. workspace 依赖约束 | CLI 导出与插件导出同输入不同输出 |
| Remote SSH / WSL 目录不一致 | 用户找不到本地 Codex 数据 | 检测 `vscode.env.remoteName` 并提示当前读取远程文件系统 | `remoteName` 非空 |

---

## 17. Phase 2-5 后续计划

### Phase 2：Claude Code + 搜索 + Task IR v1

目标：支持第二数据源和基础检索。

主要任务：

- Claude Code 路径探测与 parser。
- `history.jsonl` 索引辅助。
- EvidenceSource + confidence 模型。
- OpenAI messages 导出。
- Alpaca / Instruction 导出。
- 基础关键词搜索。
- 来源、项目、时间筛选。
- Dashboard 初版。

### Phase 3：Kimi Code + Coding 专用导出

目标：完成多源归档和 coding 专用训练格式。

主要任务：

- Kimi Code 路径探测和 parser。
- `context.jsonl`、`wire.jsonl`、`state.json` 结构适配。
- 启发式任务切分。
- Context-aware 导出。
- Diff-Edit 导出。
- Execution-aware 导出。
- Agent-Trajectory 导出。

### Phase 4：训练数据质量层

目标：从能导出提升到可筛选、可标注、可训练前处理。

主要任务：

- 标签系统。
- 手动评分。
- 质量启发式评分。
- chosen / rejected 标注。
- DPO 导出。
- 去重和短样本过滤。
- 敏感内容导出前扫描。

### Phase 5：团队版探索

目标：独立设计团队知识库能力。

主要任务：

- 端到端加密。
- 成员授权和撤销。
- 项目级权限。
- 导出审计。
- 组织数据保留策略。
- 企业合规文档。

---

## 18. 开工前需要确认的事项

以下事项不阻塞开工，但建议在 M0-M1 期间确认：

| 事项 | 当前建议 |
|---|---|
| SQLite 驱动 | 先验证 `better-sqlite3`，失败则切 JSON Repository |
| 包管理器 | 建议使用 pnpm workspace；若团队偏好 npm workspace，也可替换 |
| 最小 VS Code 版本 | 先使用当前稳定 VS Code Extension API 默认版本 |
| package publisher | 暂用 `pzc163`，发布前确认 Marketplace publisher 是否已创建 |
| CLI 包名 | 暂用 `@vibe-archive/cli` |
| 插件 display name | `Vibe Archive` |
| 命令前缀 | `vibeArchive.*` |
| 是否保存 raw 快照 | 默认关闭 |
| MVP 是否只支持 macOS | MVP 验证 macOS arm64，代码结构保留跨平台路径 |

---

## 19. 最小可交付定义

MVP 最小可交付物包含：

1. 可运行 VS Code 插件。
2. 能授权并扫描 Codex 本地 JSONL。
3. 能解析并持久化会话。
4. 能从 session 生成 VibeTask。
5. 能在 TreeView 和详情页浏览。
6. 能导出 ShareGPT JSONL。
7. 每次导出生成 Export Manifest v1.0。
8. CLI 能执行 `validate`、`export --format sharegpt`、`manifest verify`。
9. 能一键清除插件本地数据。
10. 有 parser、builder、exporter、manifest、validator、privacy 的单元测试。
11. 有 GitHub Actions CI。
12. 有 `docs/mvp-qa.md` 记录内测步骤。
13. README 说明 Local-first、读取目录、导出、Manifest 和清除策略。

---

## 20. 立即可执行命令草案

项目脚手架完成后应提供以下命令：

```bash
npm install
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
npm run package
```

CLI 应提供：

```bash
npx @vibe-archive/cli validate test/fixtures/task.sample.json
npx @vibe-archive/cli export --format sharegpt --input test/fixtures/task.sample.json --output ./training/sharegpt.jsonl
npx @vibe-archive/cli manifest validate ./training/sharegpt.manifest.json
npx @vibe-archive/cli manifest verify ./training/sharegpt.manifest.json --data ./training/sharegpt.jsonl
```

VS Code 命令面板应提供：

```text
Vibe Archive: Scan Now
Vibe Archive: Import JSONL
Vibe Archive: Export ShareGPT Dataset
Vibe Archive: Purge Local Archive
Deferred: Vibe Archive: Open Dashboard
```

---

## 21. 完成判定

当以下条件全部满足时，Phase 1 可以标记为完成：

- [ ] Deferred: 本地 Extension Development Host 启动成功（需人工 GUI 截图/录屏验收）。
- [x] 首次授权流程生效。
- [x] Codex 默认路径和自定义路径均可扫描。
- [x] 最近 30 天 JSONL 可导入。
- [x] 增量追加和半行写入处理通过测试。
- [x] 单行解析失败可诊断。
- [x] 每个 session 生成一个 VibeTask。
- [x] TreeView 和详情页可用（代码与静态验收通过；截图记录 Deferred）。
- [x] ShareGPT 导出由 VibeTask 派生。
- [x] ShareGPT 导出同时生成 Manifest v1.0。
- [x] CLI `validate`、`export`、`manifest validate`、`manifest verify` 可用。
- [x] schema/profile/manifest/cli-help 一致性检查通过。
- [ ] Deferred: 100MB JSONL、1000 session、1 万 message 导出性能测试通过。
- [x] 最近 7 天真实 Codex 数据 dogfooding 通过。
- [ ] Deferred: GitHub Actions CI 通过并产出 VSIX artifact（workflow 已配置，需 push 后以远端结果为准）。
- [x] 导出默认脱敏。
- [x] 一键清除有效且不删除源文件。
- [x] MVP 测试和内测文档齐全。
