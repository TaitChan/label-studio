#!/usr/bin/env node
/**
 * extract 后：若 en 仅改名 key、value 不变，把 zh/zh_tw 旧 key 译文迁到新 key。
 * 优先用 fix-extract 在 extract 前的内存/文件快照；无快照时回退 git HEAD。
 */

const fs = require("fs");
const path = require("path");

const mtConfig = require("./mt.config.cjs");
const {
  WEB_ROOT,
  readJson,
  readJsonAtGitRef,
  isTranslatable,
  findRenameMigrations,
} = require("./locale-git.cjs");

const SNAPSHOT_FILE = path.join(WEB_ROOT, ".quality-reports", "i18n-pre-extract-snapshot.json");

const DEFAULT_OPTS = {
  dryRun: false,
  namespaces: null,
  localesDir: mtConfig.localesDir,
  sourceLang: mtConfig.sourceLang,
  targets: [...(mtConfig.defaultTargets || ["zh", "zh_tw"])],
  beforeSnapshot: null,
};

function parseMigrateArgs(argv) {
  const opts = { ...DEFAULT_OPTS };

  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("--namespace=")) {
      opts.namespaces = arg
        .slice("--namespace=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--namespaces=")) {
      opts.namespaces = arg
        .slice("--namespaces=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--targets=")) {
      opts.targets = arg
        .slice("--targets=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  return opts;
}

function showHelp() {
  console.log(`
rename key 后保留 zh/zh_tw 译文

用法:
  yarn i18n:extract [options]              # 自动：快照 → extract → migrate

选项:
  --dry-run              只打印迁移计划，不写文件
  --namespace=NAME       仅处理单个 namespace（如 labelstudio）
  --namespaces=A,B       多个 namespace
  --targets=zh,zh_tw     目标语言目录

说明:
  fix-extract 在 extract 前写入 ${path.relative(WEB_ROOT, SNAPSHOT_FILE)}。
  locales 未进 git 时仍可依快照迁移；无快照且无 git HEAD 时会提示重跑 yarn i18n:extract。
`);
}

function listNamespaces(localesDir, sourceLang, namespaceFilters) {
  const sourceDir = path.join(WEB_ROOT, localesDir, sourceLang);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`源语言目录不存在: ${path.relative(WEB_ROOT, sourceDir)}`);
  }

  let names = fs
    .readdirSync(sourceDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));

  if (namespaceFilters?.length) {
    const wanted = new Set(namespaceFilters);
    names = names.filter((n) => wanted.has(n));
  }

  return names;
}

/** @param {Partial<typeof DEFAULT_OPTS>} opts */
function buildLocaleSnapshot(opts = {}) {
  const merged = { ...DEFAULT_OPTS, ...opts };
  const namespaces = listNamespaces(merged.localesDir, merged.sourceLang, merged.namespaces);
  const snapshot = {};

  for (const ns of namespaces) {
    snapshot[ns] = {};
    const enPath = path.join(WEB_ROOT, merged.localesDir, merged.sourceLang, `${ns}.json`);
    snapshot[ns][merged.sourceLang] = readJson(enPath) || {};

    for (const targetLang of merged.targets) {
      const targetPath = path.join(WEB_ROOT, merged.localesDir, targetLang, `${ns}.json`);
      snapshot[ns][targetLang] = readJson(targetPath) || {};
    }
  }

  return snapshot;
}

function writeLocaleSnapshot(snapshot) {
  fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  fs.writeFileSync(
    SNAPSHOT_FILE,
    `${JSON.stringify({ savedAt: new Date().toISOString(), snapshot }, null, 2)}\n`,
    "utf8",
  );
}

function loadLocaleSnapshot() {
  if (!fs.existsSync(SNAPSHOT_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
    return data.snapshot || null;
  } catch {
    return null;
  }
}

function resolveBeforeState(ns, opts, enPath, targetPath, targetLang) {
  const snap = opts.beforeSnapshot?.[ns];
  if (snap) {
    return {
      oldEn: snap[opts.sourceLang] || null,
      oldTarget: targetLang != null ? snap[targetLang] || {} : {},
      source: "snapshot",
    };
  }

  return {
    oldEn: readJsonAtGitRef(enPath, "HEAD"),
    oldTarget: targetPath ? readJsonAtGitRef(targetPath, "HEAD") || {} : {},
    source: "git",
  };
}

function targetNeedsMigration(targetJson, toKey) {
  const existing = targetJson[toKey];
  return existing == null || String(existing).trim() === "";
}

function migrateNamespace(ns, opts) {
  const enPath = path.join(WEB_ROOT, opts.localesDir, opts.sourceLang, `${ns}.json`);
  const beforeEn = resolveBeforeState(ns, opts, enPath, null, null);
  const oldEn = beforeEn.oldEn;
  const newEn = readJson(enPath);

  if (!newEn) {
    console.warn(`⚠️  跳过（读取失败）: ${path.relative(WEB_ROOT, enPath)}`);
    return { written: 0, hadBefore: false };
  }

  if (!oldEn) {
    console.warn(
      `⚠️  ${ns}: 无 extract 前快照且 git HEAD 无 ${path.relative(WEB_ROOT, enPath)}，无法检测 rename`,
    );
    return { written: 0, hadBefore: false };
  }

  const migrations = findRenameMigrations(oldEn, newEn);
  if (migrations.length === 0) return { written: 0, hadBefore: true };

  const sourceLabel = beforeEn.source === "snapshot" ? "extract 前快照" : "git HEAD";
  console.log(
    `\n📄 ${opts.sourceLang}/${ns}.json：检测到 ${migrations.length} 组 rename（en value 相同，对比 ${sourceLabel}）`,
  );

  let written = 0;

  for (const targetLang of opts.targets) {
    const targetPath = path.join(WEB_ROOT, opts.localesDir, targetLang, `${ns}.json`);
    const beforeTarget = resolveBeforeState(ns, opts, enPath, targetPath, targetLang);
    const oldTarget = beforeTarget.oldTarget;
    const newTarget = readJson(targetPath) || {};
    let changed = false;

    for (const { fromKey, toKey } of migrations) {
      const oldTranslation = oldTarget[fromKey];
      if (!isTranslatable(oldTranslation)) continue;
      if (!targetNeedsMigration(newTarget, toKey)) continue;

      console.log(
        `   ${targetLang}: ${fromKey} → ${toKey}  (${JSON.stringify(oldTranslation).slice(0, 48)}…)`,
      );
      newTarget[toKey] = oldTranslation;
      changed = true;
    }

    if (!changed) continue;

    if (opts.dryRun) {
      console.log(`   [dry-run] 将写入 ${path.relative(WEB_ROOT, targetPath)}`);
      written++;
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, `${JSON.stringify(newTarget, null, 2)}\n`, "utf8");
    console.log(`   ✅ 已写入 ${path.relative(WEB_ROOT, targetPath)}`);
    written++;
  }

  return { written, hadBefore: true };
}

/**
 * @param {Partial<typeof DEFAULT_OPTS>} overrides
 * @returns {{ written: number, namespaces: string[] }}
 */
function runMigrateRenamedKeys(overrides = {}) {
  const opts = { ...DEFAULT_OPTS, ...overrides };

  if (!opts.beforeSnapshot) {
    opts.beforeSnapshot = loadLocaleSnapshot();
    if (opts.beforeSnapshot) {
      console.log(`📂 已加载快照: ${path.relative(WEB_ROOT, SNAPSHOT_FILE)}`);
    }
  }

  const namespaces = listNamespaces(opts.localesDir, opts.sourceLang, opts.namespaces);

  if (namespaces.length === 0) {
    console.log("无 namespace 需处理。");
    return { written: 0, namespaces: [] };
  }

  console.log(
    `🔀 rename key 译文迁移（${namespaces.length} 个 namespace，目标 [${opts.targets.join(", ")}]）`,
  );
  if (opts.dryRun) console.log("   （dry-run：不写文件）");

  let written = 0;
  let anyBefore = false;

  for (const ns of namespaces) {
    const result = migrateNamespace(ns, opts);
    written += result.written;
    anyBefore = anyBefore || result.hadBefore;
  }

  if (written === 0) {
    if (!anyBefore && !opts.beforeSnapshot) {
      console.log(
        "\n无法迁移：locales 未进 git 且无 extract 前快照。请重新执行 yarn i18n:extract（会先快照再 extract）。",
      );
    } else {
      console.log("\n无 rename 迁移（或无 1:1 同 en value 的删/增 key 对，或目标译文已存在）。");
    }
  } else {
    console.log(`\n完成。${opts.dryRun ? "将更新" : "已更新"} ${written} 个目标语言文件。`);
  }

  return { written, namespaces };
}

function main() {
  const opts = parseMigrateArgs(process.argv.slice(2));
  if (opts.help) {
    showHelp();
    process.exit(0);
  }

  try {
    runMigrateRenamedKeys(opts);
  } catch (err) {
    console.error(`❌ ${err.message || err}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runMigrateRenamedKeys,
  parseMigrateArgs,
  buildLocaleSnapshot,
  writeLocaleSnapshot,
  loadLocaleSnapshot,
  SNAPSHOT_FILE,
};
