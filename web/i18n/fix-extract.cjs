#!/usr/bin/env node
/**
 * extract 一站式：
 *   1. 快照 locales（extract 前，不依赖 git）
 *   1.5 fix-i18next-ns：app-common / datamanager 的 i18next.t 补 ns
 *   2. i18next-cli extract --sync-primary
 *   2.5 restore-protected-keys：从快照恢复 datamanager.actions/columns.*
 *   3. seed-heidi-keys（HeidiTips → heidi-tips.json）
 *   4. seed-dm-action-keys（后端 Actions 菜单 → datamanager.json）
 *   5. seed-dm-column-keys（后端 Columns 列头 → datamanager.json）
 *   5.5 seed-export-format-keys（Export 格式 API 文案 → labelstudio.json）
 *   6. migrate-renamed-keys：rename key 保留 zh/zh_tw 译文
 *   7. backfill：新 key 补空 + 同 key en value 变更重译（需 COZE_API_KEY）
 */

const path = require("path");
const { execFileSync } = require("child_process");

const mtConfig = require("./mt.config.cjs");
const { WEB_ROOT, readJson, valueChangedKeys } = require("./locale-git.cjs");
const { runBackfill } = require("./backfill-mt.cjs");
const {
  runMigrateRenamedKeys,
  parseMigrateArgs,
  buildLocaleSnapshot,
  writeLocaleSnapshot,
  SNAPSHOT_FILE,
} = require("./migrate-renamed-keys.cjs");
const { formatModulesEnv, dedupe } = require("./config.cjs");
const { runSeedHeidiKeys } = require("./seed-heidi-keys.cjs");
const { runSeedDmActionKeys } = require("./seed-dm-action-keys.cjs");
const { runSeedDmColumnKeys } = require("./seed-dm-column-keys.cjs");
const { runSeedExportFormatKeys } = require("./seed-export-format-keys.cjs");
const { runFixI18nextNs } = require("./fix-i18next-ns.cjs");
const { runRestoreProtectedKeys, verifyProtectedKeys } = require("./restore-protected-locale-keys.cjs");

const MIGRATE_FLAGS = new Set([
  "--dry-run",
  "--namespace=",
  "--namespaces=",
  "--targets=",
]);

function isMigrateArg(arg) {
  if (MIGRATE_FLAGS.has(arg)) return true;
  for (const prefix of ["--namespace=", "--namespaces=", "--targets="]) {
    if (arg.startsWith(prefix)) return true;
  }
  return false;
}

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    migrateOnly: false,
    noMigrateKeys: false,
    noBackfill: false,
    scope: "",
    scopeExplicit: false,
    extractArgs: [],
    migrateArgv: [],
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      opts.dryRun = true;
      opts.migrateArgv.push(arg);
    } else if (arg === "--migrate-only") opts.migrateOnly = true;
    else if (arg === "--no-migrate-keys") opts.noMigrateKeys = true;
    else if (arg === "--no-backfill") opts.noBackfill = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("--scope=")) {
      opts.scope = arg.slice("--scope=".length).trim().replace(/^\/+|\/+$/g, "");
      opts.scopeExplicit = true;
    } else if (isMigrateArg(arg)) opts.migrateArgv.push(arg);
    else opts.extractArgs.push(arg);
  }

  return opts;
}

function showHelp() {
  console.log(`
extract 一站式（web/i18n/fix-extract.cjs）

用法:
  yarn i18n:extract [options]

步骤:
  1. 快照 locales（${path.relative(WEB_ROOT, SNAPSHOT_FILE)}）
  1.5 fix-i18next-ns（i18next.t 补 ns，避免 key 落入 labelstudio.json）
  2. i18next-cli extract --sync-primary
  2.5 restore-protected-keys（extract 前快照 → 恢复 datamanager.actions/columns.* 及 zh 译文）
  3. seed-heidi-keys（HeidiTips → heidi-tips.json）
  4. seed-dm-action-keys（后端 Actions 菜单 → datamanager.json）
  5. seed-dm-column-keys（后端 Columns 列头 → datamanager.json）
  6. migrate-renamed-keys（rename key → 保留 zh/zh_tw）
  7. backfill（新 key 补空 + 同 key en value 变更重译，需 COZE_API_KEY）

选项:
  --dry-run            extract 预览；跳过快照写入、migrate/backfill 写盘
  --migrate-only       只跑 rename 译文迁移
  --no-migrate-keys    跳过 migrate-renamed-keys
  --no-backfill        跳过机翻回填（新 key 与 value 变更均不译）
  --scope=pages/Home   追加 extract 范围（合并 config.json modules，不传给 i18next-cli）
  --namespace=NAME     限定 namespace
  --namespaces=A,B
  --targets=zh,zh_tw
  --help, -h

也可通过环境变量覆盖：
  I18N_EXTRACT_SCOPE=pages/Home yarn i18n:extract
`);
}

function runExtract(opts) {
  const args = ["extract", "--sync-primary", ...opts.extractArgs];
  if (opts.dryRun) args.push("--dry-run");

  const env = { ...process.env };
  if (opts.scopeExplicit) {
    env.I18N_EXTRACT_SCOPE = formatModulesEnv({
      envScope: env.I18N_EXTRACT_SCOPE,
      modules: dedupe(String(opts.scope).split(",")),
      narrow: false,
    });
    console.log(`📍 I18N_EXTRACT_SCOPE=${env.I18N_EXTRACT_SCOPE}\n`);
  }

  console.log(`> i18next-cli ${args.join(" ")}\n`);
  execFileSync("i18next-cli", args, { cwd: WEB_ROOT, stdio: "inherit", env });
}

function runMigrate(opts, beforeSnapshot) {
  const migrateOpts = parseMigrateArgs(opts.migrateArgv);
  migrateOpts.dryRun = opts.dryRun || migrateOpts.dryRun;
  if (beforeSnapshot) migrateOpts.beforeSnapshot = beforeSnapshot;
  runMigrateRenamedKeys(migrateOpts);
}

function collectValueChangedByNamespace(beforeSnapshot) {
  if (!beforeSnapshot) return null;

  const byNs = {};
  let total = 0;

  for (const [ns, langs] of Object.entries(beforeSnapshot)) {
    const oldEn = langs[mtConfig.sourceLang];
    const enPath = path.join(WEB_ROOT, mtConfig.localesDir, mtConfig.sourceLang, `${ns}.json`);
    const newEn = readJson(enPath);
    if (!newEn) continue;

    const changed = valueChangedKeys(oldEn, newEn);
    if (changed && changed.size > 0) {
      byNs[ns] = changed;
      total += changed.size;
    }
  }

  return total > 0 ? byNs : null;
}

async function runBackfillIfNeeded(opts, beforeSnapshot) {
  if (opts.noBackfill || opts.dryRun || opts.migrateOnly) return;

  const staleKeysByNamespace = collectValueChangedByNamespace(beforeSnapshot);
  const staleCount = staleKeysByNamespace
    ? Object.values(staleKeysByNamespace).reduce((n, set) => n + set.size, 0)
    : 0;

  const migrateParse = parseMigrateArgs(opts.migrateArgv);

  console.log("\n🌐 extract 后机翻回填（新 key 补空 + en value 变更重译）");
  if (staleCount > 0) {
    console.log(`   同 key en value 变更: ${staleCount} 个 key`);
  }

  try {
    await runBackfill({
      stale: Boolean(beforeSnapshot),
      beforeSnapshot,
      staleKeysByNamespace: staleKeysByNamespace ?? undefined,
      namespaces: migrateParse.namespaces,
      targets: migrateParse.targets,
    });
  } catch (err) {
    if (err.code === "NO_COZE_KEY" || err.code === "COZE_QUOTA_EXHAUSTED") {
      console.warn(`\n⚠️  ${err.message}`);
      console.warn("   可稍后执行: yarn i18n:backfill");
      if (err.code === "COZE_QUOTA_EXHAUSTED") {
        console.warn("   配额恢复后: rm .quality-reports/i18n-coze-quota-blocked");
      }
      return;
    }
    throw err;
  }
}

function runSeedsAfterExtract(opts) {
  const seed = runSeedHeidiKeys();
  if (seed.langs.length > 0) {
    console.log(
      `\n🌱 seed-heidi-keys：heidi-tips.json（+${seed.added} key，~${seed.updated} en 更新，${seed.langs.join(", ")}）`,
    );
  }

  const dmActions = runSeedDmActionKeys();
  if (dmActions.langs.length > 0) {
    console.log(
      `\n🌱 seed-dm-action-keys：datamanager.json（${dmActions.keyCount} keys，+${dmActions.added}，~${dmActions.updated} en 变更，${dmActions.langs.join(", ")}）`,
    );
  }

  const dmColumns = runSeedDmColumnKeys();
  if (dmColumns.langs.length > 0) {
    console.log(
      `\n🌱 seed-dm-column-keys：datamanager.json（${dmColumns.keyCount} keys，+${dmColumns.added}，~${dmColumns.updated} en 变更，${dmColumns.langs.join(", ")}）`,
    );
  }

  const exportFormats = runSeedExportFormatKeys();
  if (exportFormats.langs.length > 0) {
    console.log(
      `\n🌱 seed-export-format-keys：labelstudio.json（${exportFormats.keyCount} keys，+${exportFormats.added}，~${exportFormats.updated} en 变更，${exportFormats.langs.join(", ")}）`,
    );
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    showHelp();
    process.exit(0);
  }

  let beforeSnapshot = null;

  if (!opts.migrateOnly && !opts.dryRun) {
    const migrateParse = parseMigrateArgs(opts.migrateArgv);
    beforeSnapshot = buildLocaleSnapshot(migrateParse);
    writeLocaleSnapshot(beforeSnapshot);
    console.log(`📸 已快照 locales → ${path.relative(WEB_ROOT, SNAPSHOT_FILE)}\n`);
  }

  if (!opts.migrateOnly) {
    console.log("🔧 fix-i18next-ns（extract 前补 ns）\n");
    runFixI18nextNs({ dryRun: opts.dryRun, quiet: false });
    console.log("");

    let extractFailed = false;
    try {
      runExtract(opts);
    } catch (err) {
      extractFailed = true;
      console.warn("\n⚠️  i18next-cli extract 退出非零；仍继续 restore-protected-keys / seed（防呆）");
      console.warn(`   ${err.message || err}\n`);
    }

    if (!opts.dryRun) {
      if (beforeSnapshot) {
        const { restored } = runRestoreProtectedKeys({ beforeSnapshot, dryRun: false });
        if (restored > 0) {
          console.log(
            `\n🛡️  restore-protected-keys：已从 extract 前快照恢复 ${restored} 条 datamanager.actions/columns.*（含 zh 译文）`,
          );
        }
      }

      runSeedsAfterExtract(opts);

      if (beforeSnapshot) {
        const check = verifyProtectedKeys(beforeSnapshot);
        if (!check.ok) {
          console.error(`\n🚨 防呆检查失败：${check.missing.length} 个受保护 key 仍缺失（datamanager.actions/columns.*）`);
          for (const item of check.missing.slice(0, 10)) {
            console.error(`   [${item.namespace}] ${item.key}`);
          }
          if (check.missing.length > 10) {
            console.error(`   … 以及另外 ${check.missing.length - 10} 个`);
          }
          process.exit(1);
        }
      }
    }

    if (extractFailed && !opts.dryRun) {
      console.warn("\n⚠️  extract 曾失败，但 seed / 受保护 key 已兜底；请检查上方 i18next-cli 报错（ignored files 等）");
    }
  }

  if (!opts.noMigrateKeys) {
    if (!opts.migrateOnly) console.log("");
    runMigrate(opts, beforeSnapshot);
  } else {
    console.log("\n已跳过 migrate-renamed-keys（--no-migrate-keys）");
  }

  await runBackfillIfNeeded(opts, beforeSnapshot);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
