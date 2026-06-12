# Label Studio i18n（精简版）

> 本目录只保留**实际执行需要**的脚本与说明。  
> 运行时代码在 `apps/labelstudio/src/i18n/`；locale JSON 在 `web/locales/`。

## 五个 yarn 命令（package.json）

| 命令 | 脚本 | 作用 |
|------|------|------|
| `yarn i18n:instrument` | `fix-instrument.cjs` | 试点接入：**instrument → 强制 Agent 审 → check → extract** |
| `yarn i18n:agent-review` | `run-agent-review.mjs` | 仅 **Agent 审源码 → check → extract**（不重复 instrument） |
| `yarn i18n:extract` | `fix-extract.cjs` | 日常：**快照 → extract → migrate → backfill** |
| `yarn i18n:backfill` | `backfill-mt.cjs` | 单独机翻（补空 / `--stale` / `--force`） |
| `yarn i18n:check` | `check-quality.cjs` | 门禁：`defaultValue`、namespace、`en` 非空、三元漏翻、`<Trans>` 索引、UI 属性/JSX 裸英文、模块级 `title`/`menuItem`、模块顶层 hook、相对 import 路径、`i18next.t` 缺 ns |

**不要**把 5 条命令从头顺序跑一遍——`instrument` / `agent-review` / `extract` 内部已嵌套后续步骤。

## 命令嵌套关系

```text
yarn i18n:instrument
  ├─ i18next-cli instrument + 后处理（namespace / defaultValue / prefix-keys）
  └─ yarn i18n:agent-review（强制）
        ├─ Cursor Agent 修源码
        ├─ yarn i18n:check
        └─ yarn i18n:extract（fix-extract）
              ├─ 快照 locales
              ├─ i18next-cli extract --sync-primary（sort: true，按 key 字母序重排）
              ├─ migrate-renamed-keys（rename key 保留 zh/zh_tw）
              └─ backfill（新 key 补空 + 同 key en value 变更重译）

yarn i18n:extract          # 同上 fix-extract，无 Agent 审
yarn i18n:agent-review     # Agent 审 + check + fix-extract，无 instrument
yarn i18n:backfill         # 仅 Coze 机翻，不改源码
yarn i18n:check            # 仅校验，不改文件
```

## 什么时候用哪条

| 场景 | 命令 |
|------|------|
| **新页面试点**（首次包 `t()`） | `yarn i18n:instrument -- --scope=pages/Home` 或改源码后直接 `yarn i18n:instrument`（auto-detect） |
| instrument 已跑，只重审 | `yarn i18n:agent-review`（从 git 变更 auto-detect）或 `--scope=pages/Home` |
| 日常改文案 / 新 key（手写 `t()`） | `yarn i18n:extract`（读 `i18n/config.json`） |
| 单独补翻 / 全量重译 | `yarn i18n:backfill --namespace=labelstudio --targets=zh,zh_tw` |
| 提交前 / CI | `yarn i18n:check` |

### 防止 instrument 误伤

`i18next-cli instrument` **没有 scope 参数**，会扫全仓库；`--scope=pages/X` 只限制后处理 / prefix-keys，**不限制** instrument 改哪些文件。

| 层级 | 机制 |
|------|------|
| 预防 | `extract.ignore` 排除 `HeidiTips/content.ts` 等数据文件 |
| 后处理 | instrument 后按 **git diff** 对所有改动文件跑 false-positive 还原 |
| 门禁 | `yarn i18n:check`（`--no-agent-review` 时也会在 instrument 末尾自动跑 **git 变更 modules** 的 check） |
| 补救 | `yarn i18n:instrument -- --fix-only` |

**之前 check 没拦住的原因：** (1) `--no-agent-review` 旧流程不跑 check；(2) 只 check 了 `pages/ExportPage` scope，误伤文件不在扫描范围；(3) 部分 pattern 缺失（如 `action=` 的 API 名，已加 `api-action-i18n`）。

**单页 i18n 推荐：** instrument → 看末尾 check 结果 → locale **手动 merge** 或谨慎 extract → 提交前 `yarn i18n:check`（全 modules 或 git 变更 modules）。

### 单一配置（`i18n/config.json`）

extract / check / namespace 推断均读此文件，**提交到 git**：

```json
{
  "initialModule": "pages/Home",
  "namespaces": [
    {
      "namespace": "labelstudio",
      "pathPrefix": "pages/",
      "root": "apps/labelstudio/src/pages",
      "modules": ["Home", "Projects", "Settings"]
    },
    {
      "namespace": "components",
      "pathPrefix": "components/",
      "root": "apps/labelstudio/src/components",
      "modules": ["Menubar"]
    },
    {
      "namespace": "app-common",
      "pathPrefix": "libs/app-common/",
      "root": "libs/app-common",
      "modules": ["*"]
    }
  ]
}
```

- **`namespaces`**：**唯一配置源**；每项定义 namespace、路径前缀、源码根目录、已接入子模块
- **`modules`（子数组）**：该 namespace 下已接入的子目录，如 `Home` → `pages/Home`；lib 用 `"*"` 表示整个 `root`
- **自动推导**：module id（`pages/Home`）、源码 glob（`root/Home/**/*.tsx`）、`useTranslation` namespace 均从 `namespaces` 推出，无需另写
- **`initialModule`**：兜底 module id（默认 `pages/Home`）
- **优先级**：`I18N_EXTRACT_SCOPE`（临时覆盖）> 推导出的全部 module id > `initialModule`
- **自动追加**：`instrument` / `agent-review` 成功后把新 module 写入对应 namespace 的 `modules` 数组

### auto-detect scope（`instrument` / `agent-review`）

未传 `--scope` 时，从 **git 变更**推断 scope（含未跟踪文件）：

- `pages/X`、`components/X`（labelstudio app）
- `libs/app-common` → module id `libs/app-common`
- `libs/datamanager/src/components/Filters/...` → `libs/datamanager/components/Filters`（按子目录匹配 config modules，**不是**笼统的 `libs/datamanager`）

```bash
yarn i18n:agent-review          # 审你刚改的几个页面 / datamanager 子目录
yarn i18n:instrument            # instrument 同样 auto-detect
yarn i18n:instrument -- --scope=libs/app-common   # 共享库（快捷键帮助等）
# datamanager shorthand（自动归一化到 libs/datamanager/components/...）：
yarn i18n:agent-review -- --scope=components/Filters,components/DataManager
# datamanager 全量子 module：
yarn i18n:agent-review -- --scope=libs/datamanager
```

- **check 范围**：仅扫推断出的 module（git auto-detect 时）
- **extract 范围**：始终用 `config.json` 全部 modules（**不会**因 auto-detect 误删其它 key）
- **显式 `--scope=pages/X`**：check 合并 config 全部 modules
- **推断失败**（无上述目录改动）：报错，需显式传 `--scope`
- **agent-review 默认模型**：`default`（`composer-2.5` 偶发秒失败时可显式 `--model=default`）

`yarn i18n:extract` / `yarn i18n:check` 单独跑时仍读 `config.json` modules（不受 auto-detect 影响）。

临时覆盖（单次任务）：

```bash
I18N_EXTRACT_SCOPE=pages/Home,components/VersionNotifier yarn i18n:extract
```

## 关键规范

- 每个 `t()` / `i18next.t()` / `translate()` 必须带 `{ defaultValue: "..." }`
- `pages/**` → `useTranslation("labelstudio")`；`components/**` → `useTranslation("components")`；`libs/app-common/**` → `useTranslation("app-common")`
- key 用路径前缀（如 `pages.Home.HomePage.welcome`、`appCommon.pages.AccountSettings...`），`keySeparator: false`
- `removeUnusedKeys: true`：源码里扫不到的 key 会在 extract 时被删（勿缩小 `config.json` modules）
- **动态 key**（`datamanager.actions.*` / `datamanager.columns.*`）不在 `t('…')` 字面量里，extract 会先删、再由 seed 写回；`fix-extract` 还会在 extract 后从快照 **restore-protected-keys** 恢复 zh 译文，且 extract 非零退出时仍跑 seed（防呆）
- `--scope=pages/X` **不会**缩小 extract 扫描范围（仍合并 config 全部 modules）；单页新 key 建议 extract 后 diff 检查，或只手动 merge JSON
- extract 的 `sort: true`：每次按 **key 字母序重排**，不是追加在文件末尾
- **不要手改** `web/locales/*.json`（由 extract 生成；机翻由 backfill 写）

路径 → namespace 由 `namespaces[].pathPrefix` 自动推导，无需单独维护。

## 环境变量

| 变量 | 位置 | 用途 |
|------|------|------|
| `CURSOR_API_KEY` | 仓库根 `.env.local` | Agent 审（`instrument` / `agent-review`） |
| `COZE_API_KEY` | `web/.env` | 机翻（extract 内 backfill、单独 `i18n:backfill`）；**优先于 shell 环境变量** |
| `COZE_WORKFLOW_ID` | `web/.env` | 可选；同上，`web/.env` 覆盖 shell |
| `I18N_EXTRACT_SCOPE` | 命令行环境 | 临时覆盖；默认同 `i18n/config.json` modules |

## 常用参数

### instrument

```bash
yarn i18n:instrument -- --dry-run              # 预览，不审、不写
yarn i18n:instrument -- --scope=pages/Home
yarn i18n:instrument -- --no-agent-review      # 跳过 Agent 审（不推荐）
yarn i18n:instrument -- --no-extract           # 审过但不 extract
yarn i18n:instrument -- --no-backfill          # extract 但跳过机翻
yarn i18n:instrument -- --fix-only             # 只后处理，不跑 i18next-cli instrument
```

### Data Manager Actions（后端 API 菜单）

批量操作（Delete Tasks、Delete Annotations 等）由 Python `data_manager/actions/*.py` 注册；前端 `ActionsButton` + `dm-action-i18n.js` 映射为 `datamanager.actions.{actionId}.title|dialogText|form.*`。extract 扫不到动态 key，由 `seed-dm-action-keys.cjs` 从 `i18n/dm-actions.registry.json` 写入 locale。

```bash
yarn i18n:extract   # 含 seed-dm-action-keys
yarn i18n:backfill -- --namespace=datamanager --targets=zh,zh_tw
node i18n/seed-dm-action-keys.cjs   # 仅更新 registry 后单独跑
```

### Data Manager Columns（后端 API 列头）

系统列（ID、Completed、Annotations 等）由 Python `data_manager/functions.py` 注册；前端 `dm-column-i18n.js` 映射为 `datamanager.columns.{columnId}.title|help`。extract 扫不到动态 key，由 `seed-dm-column-keys.cjs` 从 `i18n/dm-columns.registry.json` 写入 locale。

```bash
yarn i18n:extract   # 含 seed-dm-column-keys
yarn i18n:backfill -- --namespace=datamanager --targets=zh,zh_tw
node i18n/seed-dm-column-keys.cjs   # 仅更新 registry 后单独跑
```

### HeidiTips（数据驱动 tip 文案）

tip 正文来自 `/heidi-tips` 或 `content.ts`，在 `HeidiTip.tsx` 渲染时用 `useTranslation("heidi-tips")` + `t(key, { defaultValue })`；key 形如 `heidiTips.{collection}.{treatment}.title`。

**`content.ts` 不要 instrument**：保持纯英文字面量；`i18next.config.ts` 的 `extract.ignore` 已排除该文件；`seed-heidi-keys.cjs` 会解析 content.ts 写入 `heidi-tips.json`。

独立 namespace `heidi-tips.json`，在 `i18next.config.ts` 的 `ignoreNamespaces` 中注册，**extract 不会删改此文件**。

```bash
yarn i18n:instrument -- --scope=components/HeidiTips --no-agent-review
yarn i18n:extract   # 含 seed-heidi-keys（从 content.ts + liveContent.json 同步 en）
yarn i18n:backfill -- --namespace=heidi-tips --targets=zh,zh_tw   # 新 key 或 en 变更后补译
```

`seed-heidi-keys.cjs` 从 `content.ts` + `liveContent.json` 写入 `locales/{lang}/heidi-tips.json`（en 同步英文，zh/zh_tw 仅补缺失 key）。extract 内 backfill 会对 `heidi-tips` 做 stale 检测（seed 更新 en 后重译）。

### extract

```bash
yarn i18n:extract
yarn i18n:extract -- --no-backfill
yarn i18n:extract -- --no-migrate-keys
yarn i18n:extract -- --dry-run   # 预览 diff，不写盘
```

**为何会删 datamanager seed key？**  
`i18next.config.ts` 里 `removeUnusedKeys: true`。Actions/Columns 文案是运行时拼出来的 key（`datamanager.actions.{id}.title`），extract 静态扫描找不到，就会当「未使用」删掉。  
正常流水线：`extract 删 → restore-protected-keys 从快照恢复译文 → seed 从 registry 写 en`。  
若只跑裸 `i18next-cli extract`、或 extract 报错中断且未跑 seed，就会真的丢 key/译文。

**防呆（`fix-extract.cjs`）：**

1. extract 前写 `.quality-reports/i18n-pre-extract-snapshot.json`
2. extract 非零退出仍继续 `restore-protected-keys` + seed
3. 末尾校验 `datamanager.actions.*` / `datamanager.columns.*` 不得少于快照

单独补救 seed：`node i18n/seed-dm-action-keys.cjs && node i18n/seed-dm-column-keys.cjs`

### backfill

```bash
yarn i18n:backfill --namespace=labelstudio --targets=zh,zh_tw
yarn i18n:backfill -- --stale --dry-run        # 预览「同 key en value 变更」重译
yarn i18n:backfill -- --force                  # 整 namespace 强制重译
# Coze 输出条数不匹配时：默认每批重试 3 次，仍失败则自动拆半批；可调 --max-retries=5 --batch-size=15
# Coze 配额不足时：不重试、不拆批；写入 .quality-reports/i18n-coze-quota-blocked，后续 extract/backfill 自动跳过
# 配额恢复后：rm .quality-reports/i18n-coze-quota-blocked  或  I18N_BACKFILL_FORCE=1 yarn i18n:backfill
```

## locale 变更说明

### rename key（en value 不变）

extract 会删旧 key、新 key 在 zh/zh_tw 常为 `""`。`fix-extract` 在 extract 前写快照  
`web/.quality-reports/i18n-pre-extract-snapshot.json`，自动把旧译文迁到新 key（1:1 同 en value）。

### 只改 defaultValue（key 不变）

extract 更新 en；`fix-extract` 内 backfill 对比快照，重译变更的 zh/zh_tw。  
单独补跑：`yarn i18n:backfill -- --stale`。

### 新 key

zh/zh_tw 为空 → extract 内 backfill 自动机翻（需 `COZE_API_KEY`）。

## 目录说明

| 文件 | 用途 |
|------|------|
| `BEST-PRACTICES.md` | 时机表、风险点、团队协作 |
| `fix-instrument.cjs` | instrument + 强制 agent-review |
| `run-agent-review.mjs` | Cursor Agent 审 + check + extract |
| `agent-review-prompt.txt` | Agent 审提示词（`{{scope}}` / `{{srcDir}}` / `{{diff}}`） |
| `fix-extract.cjs` | extract 一站式编排 |
| `migrate-renamed-keys.cjs` | rename key 译文迁移（fix-extract 调用） |
| `config.json` | **配置数据**：namespaces（唯一源，git 跟踪） |
| `config.cjs` | 配置读写 + module 推导 + git auto-detect（唯一逻辑入口） |
| `locale-git.cjs` | 快照 / git 对比工具 |
| `backfill-mt.cjs` | Coze 机翻 |
| `check-quality.cjs` | 强门禁 |
| `prefix-keys.cjs` | instrument 内 key 前缀 |
| `mt.config.cjs` | 机翻配置 |
| `coze-prompt.txt` | Coze 提示词 |

## 快速排错

| 现象 | 处理 |
|------|------|
| 缺少 `CURSOR_API_KEY` | 复制 `.env.local.example` → `.env.local` |
| 缺少 `COZE_API_KEY` | extract 仍完成；稍后 `yarn i18n:backfill` |
| `require-defaultValue` | 源码补 `defaultValue` 或 `yarn i18n:instrument -- --fix-only` |
| `mixed-ternary-i18n` | 三元两侧都要 `t()`；含 `? undefined : "..."` |
| `bare-ui-attribute` / `bare-ui-attribute-expr` | `title` / `aria-label` / `label` / `term` 等改为 `t(..., { defaultValue })` |
| `bare-module-ui-property` | `Component.title` / `Component.menuItem` 改为 `i18next.t(..., { defaultValue })` |
| `merged-import-line` | `;import` 拆成独立行：`yarn i18n:instrument -- --fix-only --scope=pages/Settings` |
| `bare-jsx-text` | `<p>` / `<span>` 裸英文改为 `t()` 或 `<Trans>`（多段+链接场景） |
| `trans-tag-mismatch` | `<Trans>` 的 `<0>` 与 `components` 索引对齐 |
| `en-empty-value` | 补英文 `defaultValue` 后 `yarn i18n:extract` |
| `module-level-hook-i18n` | 模块顶层调用的工厂函数（如 `[...DateFields()]`）内改用 `i18next.t()`，不要用 `useTranslation` |
| `unresolved-import` | 修正相对 import 层级（如 `TableHead` → `../../../../utils/dm-column-i18n`） |
| `require-i18next-ns` | `i18next.t('appCommon.*' / 'datamanager.*')` 必须带 `{ ns: "app-common" / "datamanager" }`；可跑 `node i18n/fix-i18next-ns.cjs`。组件内 `t()` 经 `useTranslation(ns)` 继承的不算 |
| `api-action-i18n` | `action: "addMLBackend"` 或三元里的 API 方法名勿包 t() |
| `storage-key-i18n` | localStorage / sessionStorage key 勿包 t() |
| `tailwind-class-i18n` | Tailwind class 字符串勿包 t() |
| `changeLanguage-instrument` | 删除 `i18n.changeLanguage(...);` 误插入 |
| `broken-instrument-trans` | 乱码 `<Trans i18nKey="1NavigateTo...">` |
| `heidi-content-no-i18n` | `HeidiTips/content.ts` 禁止 i18next.t() |
| rename 后 zh 变空 | 重跑 `yarn i18n:extract`（会重新快照+migrate）；或补救 `yarn i18n:extract -- --migrate-only`（见下） |

## check 扩展后应挂在哪（规划）

扩展项：zh/zh_tw 非空、占位符与 en 一致。check 宜拆两层，挂在**写完 locale 之后**：

| 层级 | 校验内容 | 应挂在 |
|------|----------|--------|
| **源码层** | `defaultValue`、namespace、`en` 非空 | `agent-review` 里 **extract 之前**（现有）；单独 `yarn i18n:check` |
| **译文层** | zh/zh_tw 非空、占位符与 en 一致 | **backfill 之后** |

**译文层 check 建议默认开启的位置：**

1. **`yarn i18n:backfill` 末尾** — 主入口；backfill 是直接写 zh/zh_tw 的命令，放这里最直接。
2. **`yarn i18n:extract` 末尾** — extract 内嵌 backfill，日常改文案走这条；在 backfill 完成后跑全文案 check（`--no-check` 可跳过）。
3. **`instrument` / `agent-review` 链路末尾** — extract 完成后追加一次全文案 check；**保留** extract 前的源码层 check 给 Agent 迭代，不要替换。
4. **补救** — 仅当上次 extract 跳过了 migrate（`--no-migrate-keys`）且快照还在时：`yarn i18n:extract -- --migrate-only`（见下「migrate-only 是什么」）

### migrate-only 是什么？

`yarn i18n:extract -- --migrate-only` **只跑 rename 译文迁移**，不重新 extract、不 backfill。

正常 `extract` 流程：extract 前写快照 → i18next-cli 扫源码更新 en → **若 key 改名但 en 文案不变**，把 zh/zh_tw 从旧 key 拷到新 key（`migrate-renamed-keys.cjs`）。

`--migrate-only` 用于补救：上次 extract 用了 `--no-migrate-keys` 跳过了迁移，但 `.quality-reports/i18n-pre-extract-snapshot.json` 还在时，单独重跑迁移步骤。

**与 locale 文件搬家无关。** 若 `appCommon.*` / `datamanager.*` 误落在 `labelstudio.json`，用 `node i18n/migrate-locale-ns.cjs`（一次性补救）。

**`fix-i18next-ns` 挂载（均在 extract 之前，不是 extract 之后）：**

| 命令 | 何时跑 |
|------|--------|
| `yarn i18n:instrument` | 后处理里 prefix-keys 之后（agent-review → extract 之前） |
| `yarn i18n:extract` | 快照之后、i18next-cli extract 之前 |
| 单独 | `node i18n/fix-i18next-ns.cjs` |

**不应跑译文层 check 的情况：**

- `--no-backfill` 的 extract（zh 故意为空，等单独 backfill）
- `--dry-run`
- 无 `COZE_API_KEY` 导致 backfill 跳过（extract 会 warn 并退出；此时只跑源码层 check）

**推荐实现形态：**

```text
check --mode=source   # 默认：源码 + en（Agent 审、提交前）
check --mode=locales  # zh/zh_tw 非空 + 占位符
check --mode=full     # 两层都跑

fix-extract 末尾:  check --mode=full（除非 --no-backfill / --no-check）
backfill 末尾:      check --mode=locales（除非 --no-check）
agent-review:       check --mode=source → extract → check --mode=full
```

单独 `yarn i18n:check` 建议默认 `--mode=full`，作为提交前/CI 总闸。
| key 被误删 / `labelstudio.json` 变 `{}` | 勿缩小 `config.json` modules；extract 须覆盖所有已接入目录 |

## 已知限制

- `i18n:check` 不验证 zh/zh_tw 译文质量（仅源码 + en）
- `check` 源码范围与 `config.json` modules 同步（可用 `I18N_EXTRACT_SCOPE` 临时覆盖）
- Agent 审依赖 `@cursor/sdk` 与网络

## 进一步阅读

- [`BEST-PRACTICES.md`](./BEST-PRACTICES.md)
- [`.cursor/rules/i18n.mdc`](../../.cursor/rules/i18n.mdc)
