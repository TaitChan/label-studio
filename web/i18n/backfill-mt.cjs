#!/usr/bin/env node
/**
 * i18next locale 回填脚本：把源语言（en）翻译到目标语言目录。
 * 通过 Coze workflow stream_run API 调用机翻。
 *
 * 用法（在 web/ 目录执行）：
 *   yarn i18n:backfill
 *   yarn i18n:backfill --targets=zh,zh_tw
 *   yarn i18n:backfill --dry-run --namespace=labelstudio
 *   yarn i18n:backfill --namespaces=labelstudio,components
 *   yarn i18n:backfill --modules=labelstudio,components --skip=components
 */

const fs = require("fs");
const path = require("path");

const { WEB_ROOT, valueChangedKeys, readJsonAtGitRef } = require("./locale-git.cjs");
const { loadLocaleSnapshot } = require("./migrate-renamed-keys.cjs");
const configPath = path.join(__dirname, "mt.config.cjs");
const COZE_QUOTA_BLOCK_FILE = path.join(WEB_ROOT, ".quality-reports", "i18n-coze-quota-blocked");

const COZE_QUOTA_PATTERN =
  /insufficient coze credits|coze credits balance|quota refresh|upgrade to paid version/i;

function isCozeQuotaError(err) {
  const message = err?.message || String(err);
  return COZE_QUOTA_PATTERN.test(message);
}

function markCozeQuotaError(err) {
  if (!err || typeof err !== "object") return err;
  if (isCozeQuotaError(err)) err.code = "COZE_QUOTA_EXHAUSTED";
  return err;
}

function isCozeQuotaBlocked() {
  return fs.existsSync(COZE_QUOTA_BLOCK_FILE);
}

function markCozeQuotaBlocked(reason) {
  fs.mkdirSync(path.dirname(COZE_QUOTA_BLOCK_FILE), { recursive: true });
  fs.writeFileSync(
    COZE_QUOTA_BLOCK_FILE,
    `${JSON.stringify({ reason: reason || "Insufficient coze credits", at: new Date().toISOString() }, null, 2)}\n`,
  );
}

function clearCozeQuotaBlocked() {
  if (fs.existsSync(COZE_QUOTA_BLOCK_FILE)) fs.unlinkSync(COZE_QUOTA_BLOCK_FILE);
}

/** web/.env 优先于 shell 环境变量（避免 ~/.zshrc 里的旧 COZE_API_KEY 覆盖项目配置） */
const WEB_ENV_PATH = path.join(WEB_ROOT, ".env");
const REPO_ENV_PATH = path.join(WEB_ROOT, "..", ".env");

function applyEnvFile(envPath, { override = false } = {}) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (override || !process.env[key]) {
      process.env[key] = val;
    }
  }
}

function loadDotenv() {
  try {
    const dotenv = require("dotenv");
    dotenv.config({ path: REPO_ENV_PATH });
    dotenv.config({ path: WEB_ENV_PATH, override: true });
  } catch {
    applyEnvFile(REPO_ENV_PATH);
    applyEnvFile(WEB_ENV_PATH, { override: true });
  }
}

loadDotenv();

const config = require(configPath);
if (process.env.COZE_WORKFLOW_ID) {
  config.coze.workflowId = process.env.COZE_WORKFLOW_ID;
}
if (process.env.COZE_API_KEY) {
  config.coze.apiKey = process.env.COZE_API_KEY;
}

function defaultOptions() {
  return {
    dryRun: false,
    force: false,
    stale: false,
    namespaces: null,
    skip: [],
    targets: [...(config.defaultTargets || ["zh", "zh_tw"])],
    localesDir: config.localesDir,
    batchSize: config.mtBatchSize,
    delayMs: config.mtDelayMs,
    maxRetries: config.mtMaxRetries ?? 3,
    retryDelayMs: config.mtRetryDelayMs ?? 2000,
  };
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const options = defaultOptions();

  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--stale") options.stale = true;
    else if (arg.startsWith("--namespace=")) {
      options.namespaces = splitCsv(arg.slice("--namespace=".length));
    } else if (arg.startsWith("--namespaces=")) {
      options.namespaces = splitCsv(arg.slice("--namespaces=".length));
    } else if (arg.startsWith("--modules=")) {
      // 本仓库使用 i18next namespace 作为批量处理单元；
      // 为了贴近其他项目的用法，modules 在这里等价于 namespaces。
      options.namespaces = splitCsv(arg.slice("--modules=".length));
    } else if (arg.startsWith("--skip=")) {
      options.skip = splitCsv(arg.slice("--skip=".length));
    } else if (arg.startsWith("--targets=")) {
      options.targets = arg
        .slice("--targets=".length)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--target=")) {
      options.targets = [arg.slice("--target=".length).trim()];
    } else if (arg.startsWith("--locales-dir=")) {
      options.localesDir = arg.slice("--locales-dir=".length).trim();
    } else if (arg.startsWith("--batch-size=")) {
      options.batchSize = Number.parseInt(arg.slice("--batch-size=".length), 10) || options.batchSize;
    } else if (arg.startsWith("--max-retries=")) {
      options.maxRetries = Number.parseInt(arg.slice("--max-retries=".length), 10) || options.maxRetries;
    } else if (arg.startsWith("--retry-delay-ms=")) {
      options.retryDelayMs =
        Number.parseInt(arg.slice("--retry-delay-ms=".length), 10) || options.retryDelayMs;
    } else if (arg === "--help" || arg === "-h") {
      const knownTargets = Object.keys(config.targets || {}).join(", ");
      console.log(`
用法: node i18n/backfill-mt.cjs [options]

参数:
  --dry-run              预览待翻译 key；不调用 API、不写文件
  --force                强制重译（即使目标语言已有内容）
  --stale                仅重译「同 key、en value 变更」的 key（优先 extract 快照，其次 git HEAD）
  --targets=zh,zh_tw     目标语言目录；默认: ${(config.defaultTargets || []).join(",")}
  --target=zh_tw         单个目标语言（--targets 的别名）
  --namespace=NAME       仅处理 locales/{lang}/NAME.json（如 labelstudio）
  --namespaces=A,B       批量处理多个 namespace（如 labelstudio,components）
  --modules=A,B          --namespaces 的别名，贴近其他项目的模块批处理用法
  --skip=A,B             从待处理 namespace 中排除指定项
  --locales-dir=PATH     默认: locales
  --batch-size=N         默认: ${config.mtBatchSize}
  --max-retries=N        单批次失败重试次数（默认: ${config.mtMaxRetries ?? 3}）
  --retry-delay-ms=N     重试间隔毫秒（默认: ${config.mtRetryDelayMs ?? 2000}）
  --help, -h             显示帮助

已配置目标语言（目录 → Coze 标签）: ${knownTargets}
需要在 web/.env 配置 COZE_API_KEY
`);
      process.exit(0);
    }
  }

  if (!options.targets || options.targets.length === 0) {
    options.targets = [...(config.defaultTargets || ["zh", "zh_tw"])];
  }

  for (const t of options.targets) {
    if (!config.targets?.[t]) {
      console.error(
        `❌ 未知目标语言 "${t}"。请在 i18n/mt.config.cjs 的 targets.{${t}} 中配置，或使用：${Object.keys(config.targets || {}).join(", ")}`,
      );
      process.exit(1);
    }
  }

  return options;
}

function splitCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function isTranslatable(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sortedKeys(obj) {
  return Object.keys(obj).sort();
}

function keysToTranslate(source, target, { force, stale, staleKeys }) {
  const keys = [];
  for (const key of sortedKeys(source)) {
    if (!isTranslatable(source[key])) continue;
    const existing = target[key];
    const isStale = stale && staleKeys?.has(key);
    if (force || isStale || existing == null || String(existing).trim() === "") {
      keys.push(key);
    }
  }
  return keys;
}

/** --stale：优先快照 / 传入的 staleKeysByNamespace，其次 git HEAD */
function resolveStaleKeys(ns, sourcePath, source, options) {
  if (options.staleKeysByNamespace?.[ns]) {
    return { keys: options.staleKeysByNamespace[ns], source: "explicit" };
  }

  const snap =
    options.beforeSnapshot?.[ns]?.[config.sourceLang] ||
    loadLocaleSnapshot()?.[ns]?.[config.sourceLang];
  if (snap) {
    return { keys: valueChangedKeys(snap, source) ?? new Set(), source: "snapshot" };
  }

  const previous = readJsonAtGitRef(sourcePath, "HEAD");
  if (previous) {
    return { keys: valueChangedKeys(previous, source) ?? new Set(), source: "git" };
  }

  return { keys: new Set(), source: "none" };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCozeStreamBody(raw) {
  let endContent = null;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;

    const payload = trimmed.slice(5).trim();
    if (!payload) continue;

    let data;
    try {
      data = JSON.parse(payload);
    } catch {
      continue;
    }

    const event = data.event || data.Event;
    if (event === "Error" || data.error_code) {
      throw new Error(data.error_message || data.msg || JSON.stringify(data));
    }

    if (!data.content) continue;

    const isEnd =
      data.node_is_finish === true &&
      (data.node_type === "End" || data.node_title === "End");

    if (isEnd) {
      endContent = data.content;
    }
  }

  if (!endContent) {
    throw new Error("Coze stream 返回中缺少 End 节点内容");
  }

  let parsed;
  try {
    parsed = JSON.parse(endContent);
  } catch {
    throw new Error(`Coze End 节点内容不是 JSON: ${endContent.slice(0, 200)}`);
  }

  const output = Array.isArray(parsed) ? parsed : parsed.output;
  if (!Array.isArray(output)) {
    throw new Error(`Coze 输出不是数组: ${JSON.stringify(parsed).slice(0, 200)}`);
  }

  return output;
}

async function callCozeTranslate(texts, { apiKey, workflowId, apiUrl, sourceLabel, targetLabel }) {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      parameters: {
        input: texts,
        source: sourceLabel,
        target: targetLabel,
      },
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Coze HTTP ${res.status}: ${body.slice(0, 500)}`);
  }

  const output = parseCozeStreamBody(body);
  if (output.length !== texts.length) {
    throw new Error(
      `Coze 输出长度 ${output.length} !== 输入长度 ${texts.length}`,
    );
  }

  return output;
}

async function callCozeTranslateWithRetry(texts, coze, { maxRetries, retryDelayMs }) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callCozeTranslate(texts, coze);
    } catch (err) {
      lastErr = markCozeQuotaError(err);
      if (lastErr.code === "COZE_QUOTA_EXHAUSTED") {
        throw lastErr;
      }
      if (attempt < maxRetries) {
        console.warn(
          `   ⚠️ 机翻失败 (${attempt}/${maxRetries}): ${err.message}；${retryDelayMs}ms 后重试…`,
        );
        await sleep(retryDelayMs);
      }
    }
  }
  throw lastErr;
}

async function translateBatchChunk(batchKeys, source, coze, retryOpts) {
  const texts = batchKeys.map((k) => source[k]);
  try {
    return await callCozeTranslateWithRetry(texts, coze, retryOpts);
  } catch (err) {
    const quotaErr = markCozeQuotaError(err);
    if (quotaErr.code === "COZE_QUOTA_EXHAUSTED") {
      throw quotaErr;
    }
    if (batchKeys.length <= 1) throw err;
    const mid = Math.ceil(batchKeys.length / 2);
    console.warn(
      `   ⚠️ 批次 ${batchKeys.length} 条仍失败，拆成 ${mid} + ${batchKeys.length - mid} 条: ${err.message}`,
    );
    const left = await translateBatchChunk(batchKeys.slice(0, mid), source, coze, retryOpts);
    const right = await translateBatchChunk(batchKeys.slice(mid), source, coze, retryOpts);
    return [...left, ...right];
  }
}

async function translateBatch(keys, source, coze, batchSize, delayMs, retryOpts) {
  const merged = {};
  const batches = Math.ceil(keys.length / batchSize);

  for (let i = 0; i < keys.length; i += batchSize) {
    const batchKeys = keys.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    console.log(`   机翻批次 ${batchNum}/${batches}（${batchKeys.length} 条）...`);

    const translated = await translateBatchChunk(batchKeys, source, coze, retryOpts);
    batchKeys.forEach((key, idx) => {
      const value = translated[idx];
      merged[key] = value != null && String(value).trim() ? String(value).trim() : source[key];
    });

    if (i + batchSize < keys.length) {
      await sleep(delayMs);
    }
  }

  return merged;
}

function buildTargetJson(source, target, updates) {
  const out = { ...target };
  for (const key of sortedKeys(source)) {
    if (key in updates) {
      out[key] = updates[key];
    } else if (!(key in out)) {
      out[key] = "";
    }
  }
  for (const key of Object.keys(out)) {
    if (!(key in source)) delete out[key];
  }
  const ordered = {};
  for (const key of sortedKeys(source)) {
    ordered[key] = out[key] ?? "";
  }
  return ordered;
}

function listNamespaceFiles(localesDir, sourceLang, namespaceFilters, skipFilters) {
  const sourceDir = path.join(WEB_ROOT, localesDir, sourceLang);
  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ 源语言目录不存在: ${path.relative(WEB_ROOT, sourceDir)}`);
    process.exit(1);
  }

  let files = fs
    .readdirSync(sourceDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));

  if (namespaceFilters?.length) {
    const wanted = new Set(namespaceFilters);
    files = files.filter((n) => wanted.has(n));
    if (files.length === 0) {
      console.warn(`⚠️  未找到 namespace: ${namespaceFilters.map((ns) => `${sourceLang}/${ns}.json`).join(", ")}`);
      return [];
    }
    const found = new Set(files);
    const missing = namespaceFilters.filter((ns) => !found.has(ns));
    if (missing.length > 0) {
      console.warn(`⚠️  未找到 namespace: ${missing.map((ns) => `${sourceLang}/${ns}.json`).join(", ")}`);
    }
  }

  if (skipFilters?.length) {
    const skipped = new Set(skipFilters);
    files = files.filter((n) => !skipped.has(n));
  }

  return files;
}

async function processNamespace(ns, targetLang, options, coze) {
  const sourcePath = path.join(WEB_ROOT, options.localesDir, config.sourceLang, `${ns}.json`);
  const targetPath = path.join(WEB_ROOT, options.localesDir, targetLang, `${ns}.json`);

  const source = readJson(sourcePath);
  if (!source) {
    console.warn(`⚠️  跳过（读取失败）: ${path.relative(WEB_ROOT, sourcePath)}`);
    return false;
  }

  const target = readJson(targetPath) || {};
  const staleResolved = options.stale ? resolveStaleKeys(ns, sourcePath, source, options) : null;
  const staleKeys = staleResolved?.keys ?? null;
  const keys = keysToTranslate(source, target, {
    force: options.force,
    stale: options.stale,
    staleKeys,
  });

  const targetLabel = config.targets[targetLang].label;
  const modeLabel = options.force ? "（force）" : options.stale ? "（stale）" : "";
  console.log(
    `\n📄 ${config.sourceLang}/${ns}.json → ${targetLang}/${ns}.json（Coze 目标: ${targetLabel}）`,
  );
  if (options.stale && staleKeys && staleKeys.size > 0) {
    const srcLabel =
      staleResolved.source === "snapshot"
        ? "extract 快照"
        : staleResolved.source === "git"
          ? "git HEAD"
          : "显式传入";
    console.log(`   同 key en value 变更 ${staleKeys.size} 个（对比 ${srcLabel}）`);
  }
  console.log(`   待翻译 ${keys.length} 个 key${modeLabel}`);

  if (keys.length === 0) {
    console.log("   ✓ 已是最新，无需更新");
    return false;
  }

  if (options.dryRun) {
    for (const key of keys.slice(0, 10)) {
      console.log(`   · ${key}: ${JSON.stringify(source[key]).slice(0, 60)}`);
    }
    if (keys.length > 10) console.log(`   … 以及其余 ${keys.length - 10} 个`);
    return false;
  }

  const updates = await translateBatch(
    keys,
    source,
    { ...coze, targetLabel },
    options.batchSize,
    options.delayMs,
    { maxRetries: options.maxRetries, retryDelayMs: options.retryDelayMs },
  );
  const next = buildTargetJson(source, target, updates);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`   ✅ 已写入 ${path.relative(WEB_ROOT, targetPath)}`);
  return true;
}

/**
 * @param {ReturnType<typeof parseArgs>} [overrides]
 */
async function runBackfill(overrides) {
  const options = { ...defaultOptions(), ...(overrides || {}) };
  const apiKey = config.coze.apiKey;

  if (!options.dryRun && process.env.I18N_BACKFILL_FORCE === "1") {
    clearCozeQuotaBlocked();
  }

  if (!options.dryRun && isCozeQuotaBlocked()) {
    const err = new Error(
      `Coze 配额不足，已跳转机翻（删除 ${path.relative(WEB_ROOT, COZE_QUOTA_BLOCK_FILE)} 或设置 I18N_BACKFILL_FORCE=1 后重试）`,
    );
    err.code = "COZE_QUOTA_EXHAUSTED";
    throw err;
  }

  if (!apiKey && !options.dryRun) {
    const err = new Error("缺少 COZE_API_KEY，请在 web/.env 中配置");
    err.code = "NO_COZE_KEY";
    throw err;
  }

  const cozeBase = {
    apiKey,
    workflowId: config.coze.workflowId,
    apiUrl: config.coze.apiUrl,
    sourceLabel: config.sourceLabel,
  };

  const namespaces = listNamespaceFiles(options.localesDir, config.sourceLang, options.namespaces, options.skip);

  console.log(
    `🌐 机翻回填: ${config.sourceLang} → [${options.targets.join(", ")}]（${namespaces.length} 个 namespace）`,
  );
  if (options.dryRun) console.log("   （dry-run：不调用 API、不写入文件）");
  if (options.stale && !options.force) {
    console.log("   含：zh/zh_tw 空 key 补全 + 同 key en value 变更重译");
  }

  let written = 0;
  try {
    for (const targetLang of options.targets) {
      for (const ns of namespaces) {
        if (await processNamespace(ns, targetLang, options, cozeBase)) written++;
      }
    }
  } catch (err) {
    if (err.code === "COZE_QUOTA_EXHAUSTED") {
      markCozeQuotaBlocked(err.message);
    }
    throw err;
  }

  clearCozeQuotaBlocked();
  console.log(`\n完成。${written > 0 ? ` 共更新 ${written} 个文件。` : ""}`);
  return { written };
}

async function main() {
  try {
    await runBackfill(parseArgs());
  } catch (err) {
    if (err.code === "COZE_QUOTA_EXHAUSTED") {
      console.warn(`\n⚠️  ${err.message}`);
      console.warn("   配额恢复后: rm .quality-reports/i18n-coze-quota-blocked && yarn i18n:backfill");
      process.exit(1);
    }
    console.error(`❌ ${err.message || err}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runBackfill,
  parseArgs,
  defaultOptions,
  isCozeQuotaError,
  isCozeQuotaBlocked,
  clearCozeQuotaBlocked,
  COZE_QUOTA_BLOCK_FILE,
};
