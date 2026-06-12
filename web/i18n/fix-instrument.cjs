#!/usr/bin/env node
/**
 * instrument 一站式后处理：
 *   1. 运行 i18next-cli instrument（可用 --fix-only 跳过）
 *   2. 按 namespaceByPath 补全 useTranslation("namespace")
 *   3. t() / i18next.t() 改为 { defaultValue } 对象写法（保留插值变量）
 *   4. 拆开 i18next-cli 粘在上一行末尾的 import（`;import …` → `;\nimport …`）
 *   5. 去掉 instrument 误生成的无效 <Trans>（乱码 i18nKey，保留内部 JSX）
 *   6. 还原 API 名 / 路由 path / Tailwind 类名等误包 t()
 *   7. prefix-keys：按文件路径补 key 前缀（仅源码；locale 用 yarn i18n:extract）
 *   7.5 fix-i18next-ns：i18next.t('appCommon.*' | 'datamanager.*') 补 ns（extract 前）
 *   8. 删除 web/i18n.ts（i18next-cli init 残留）
 *   9. 强制 Cursor Agent 审查（run-agent-review → check → extract）
 *
 * 转换示例：
 *   t('key', 'Hello')           → t('key', { defaultValue: 'Hello' })
 *   t('key', '{{n}} items', { n }) → t('key', { defaultValue: '{{n}} items', n })
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const {
  WEB_ROOT,
  SOURCE_ROOT,
  inferNamespace,
  toSrcRelative,
  formatModulesEnv,
  appendModule,
  detectModulesFromGit,
  moduleAbsPath,
  dedupe,
} = require("./config.cjs");
const { runPrefixKeys } = require("./prefix-keys.cjs");
const { runFixI18nextNs } = require("./fix-i18next-ns.cjs");
const REPO_ROOT = path.join(WEB_ROOT, "..");
const SRC_ROOT = path.join(WEB_ROOT, SOURCE_ROOT);
const SCAFFOLD_I18N = path.join(WEB_ROOT, "i18n.ts");
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const T_CALLEE_PATTERNS = [/\bi18next\.t\s*\(/g, /(?<![.\w$])t\s*\(/g, /\btranslate\s*\(/g];

const AGENT_REVIEW_FLAGS = new Set([
  "--no-extract",
  "--no-backfill",
  "--no-migrate-keys",
  "--skip-check",
]);

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    interactive: false,
    fixOnly: false,
    noPrefixKeys: false,
    noAgentReview: false,
    scope: "",
    scopeExplicit: false,
    scopeAuto: false,
    prefix: "",
    namespace: "",
    instrumentArgs: [],
    agentReviewArgs: [],
  };

  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--interactive") opts.interactive = true;
    else if (arg === "--fix-only") opts.fixOnly = true;
    else if (arg === "--no-prefix-keys") opts.noPrefixKeys = true;
    else if (arg === "--no-agent-review") opts.noAgentReview = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("--scope=")) {
      opts.scope = arg.slice("--scope=".length).trim().replace(/^\/+|\/+$/g, "");
      opts.scopeExplicit = true;
    } else if (arg.startsWith("--prefix=")) {
      opts.prefix = arg.slice("--prefix=".length).trim().replace(/^\.+|\.+$/g, "");
    } else if (arg.startsWith("--namespace=")) {
      opts.namespace = arg.slice("--namespace=".length).trim();
    } else if (
      AGENT_REVIEW_FLAGS.has(arg) ||
      arg.startsWith("--model=") ||
      arg.startsWith("--max-retries=") ||
      arg.startsWith("--targets=")
    ) {
      opts.agentReviewArgs.push(arg);
    } else {
      opts.instrumentArgs.push(arg);
    }
  }

  return opts;
}

function showHelp() {
  console.log(`
instrument 一站式（web/i18n/fix-instrument.cjs）

用法:
  yarn i18n:instrument [options]

步骤:
  instrument 后处理 → 强制 Agent 审（check 通过 → extract）

选项:
  --dry-run          instrument 预览；不写源码、不跑 Agent 审
  --interactive      传给 i18next-cli instrument
  --namespace=NS     传给 i18next-cli instrument
  --fix-only         只执行后处理（跳过 i18next-cli instrument）；会对 scope + git 改动文件做 false-positive 还原
  --scope=pages/Home  显式限定 prefix-keys / Agent 审范围；i18next-cli instrument 仍会扫全仓库，后处理会对 git 改动文件统一跑误包还原
                      支持 pages/X、components/X、libs/app-common
  --prefix=pages.Home  覆盖自动 key 前缀（默认按文件路径）
  --no-prefix-keys   跳过 key 前缀步骤
  --no-agent-review  跳过强制 Agent 审（不推荐）
  --no-extract       传给 agent-review：审过后不 extract
  --no-backfill      传给 fix-extract：跳过机翻
  --help, -h         显示帮助
`);
}

function runAgentReview(opts) {
  const args = ["i18n/run-agent-review.mjs"];
  if (opts.scopeExplicit) args.push(`--scope=${opts.scope}`);
  args.push(...opts.agentReviewArgs);

  console.log(`\n--- 强制 Agent 审查 ---\n> node ${args.join(" ")} (cwd: web/)\n`);
  try {
    execFileSync("node", args, { cwd: WEB_ROOT, stdio: "inherit" });
  } catch (err) {
    const code = err.status ?? 1;
    if (code === 2) {
      console.error(
        "\nAgent 审阅未成功（exit 2：Agent 返回 error/cancelled）。见上方输出与 web/.quality-reports/",
      );
    } else if (code === 3) {
      console.error("\nAgent 审阅后 yarn i18n:check 仍未通过（exit 3）。见上方 check 输出。");
    }
    throw err;
  }
}

function runInstrument(opts) {
  if (opts.fixOnly) return { approved: 0 };

  const env = { ...process.env };
  env.I18N_EXTRACT_SCOPE = formatModulesEnv({
    envScope: process.env.I18N_EXTRACT_SCOPE,
    modules: dedupe(String(opts.scope).split(",")),
    narrow: opts.scopeAuto,
  });
  if (!opts.scope) {
    console.warn(
      "⚠️  未能从 git 推断 scope，i18next-cli 使用 i18n/config.json。新模块可显式指定，例如：\n" +
        "   yarn i18n:instrument -- --scope=components/Menubar\n",
    );
  } else if (opts.scopeAuto) {
    console.log(`📍 auto-detect scope: [${opts.scope}]（git 变更）\n`);
  }

  const args = ["instrument"];
  if (opts.dryRun) args.push("--dry-run");
  if (opts.interactive) args.push("--interactive");
  if (opts.namespace) args.push("--namespace", opts.namespace);
  args.push(...opts.instrumentArgs);

  console.log(`$ i18next-cli ${args.join(" ")}`);
  const output = execFileSync("i18next-cli", args, {
    stdio: ["inherit", "pipe", "inherit"],
    cwd: WEB_ROOT,
    env,
    encoding: "utf8",
  });
  process.stdout.write(output);

  const approvedMatch = output.match(/Approved:\s*(\d+)/i);
  return { approved: approvedMatch ? Number(approvedMatch[1]) : 0 };
}

function walkSourceFiles(root, files) {
  if (!fs.existsSync(root)) return;
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (SOURCE_EXTS.has(path.extname(ent.name)) && !/\.(test|spec)\./.test(ent.name)) {
        files.push(p);
      }
    }
  }
  walk(root);
}

function collectFiles(scope) {
  const modules = dedupe(String(scope).split(","));
  const files = [];

  if (modules.length === 0 || modules.every((m) => !m.trim())) {
    walkSourceFiles(SRC_ROOT, files);
    return files.sort();
  }

  for (const entry of modules) {
    if (!entry.trim()) continue;
    walkSourceFiles(moduleAbsPath(entry), files);
  }
  return files.sort();
}

/** i18next-cli instrument 无 scope 参数，会改全仓库；用 git diff 收集实际改动文件做后处理 */
function collectGitChangedWebSources() {
  try {
    const out = execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMR", "HEAD", "--", "web/apps", "web/libs"],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return out
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p && SOURCE_EXTS.has(path.extname(p)) && !/\.(test|spec)\./.test(p))
      .map((p) => path.join(REPO_ROOT, p))
      .filter((p) => fs.existsSync(p));
  } catch {
    return [];
  }
}

function scanStringLiteral(source, start) {
  const quote = source[start];
  if (quote !== '"' && quote !== "'" && quote !== "`") return null;
  let i = start + 1;
  let value = "";
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      value += source[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (ch === quote) {
      return { value, end: i + 1, isTemplate: quote === "`" };
    }
    if (quote === "`" && ch === "$" && source[i + 1] === "{") {
      return { value: "", end: i, isTemplate: true, hasInterpolation: true };
    }
    value += ch;
    i++;
  }
  return null;
}

function findFirstArgEnd(argsText, start) {
  let depth = 0;
  let inStr = null;
  let i = start;
  while (i < argsText.length) {
    const ch = argsText[i];
    if (inStr) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === inStr) inStr = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      i++;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    if (ch === ")" || ch === "}" || ch === "]") depth--;
    if (ch === "," && depth === 0) return i;
    i++;
  }
  return argsText.length;
}

function findBalancedParenEnd(source, openIndex) {
  let depth = 0;
  let inStr = null;
  let i = openIndex;
  while (i < source.length) {
    const ch = source[i];
    if (inStr) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === inStr) inStr = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      i++;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function quoteDefaultValue(value) {
  return JSON.stringify(value);
}

/**
 * t('key', 'English') → t('key', { defaultValue: 'English' })
 * t('key', '{{n}} x', { n, count }) → t('key', { defaultValue: '{{n}} x', n, count })
 */
function rewriteTArgs(argsText) {
  const keyStart = argsText.search(/\S/);
  if (keyStart === -1) return null;

  const keyEnd = findFirstArgEnd(argsText, keyStart);
  const keyPart = argsText.slice(keyStart, keyEnd).trim();
  let rest = argsText.slice(keyEnd).trim();
  if (!rest.startsWith(",")) return null;

  rest = rest.slice(1).trim();
  const secondEnd = findFirstArgEnd(rest, 0);
  const secondPart = rest.slice(0, secondEnd).trim();
  const thirdPart = rest.slice(secondEnd).trim();

  if (secondPart.startsWith("{")) {
    if (/\bdefaultValue\s*:/.test(secondPart)) return null;
    return null;
  }

  const lit = scanStringLiteral(secondPart, 0);
  if (!lit || lit.hasInterpolation) return null;
  if (lit.end !== secondPart.length) return null;

  const dv = quoteDefaultValue(lit.value);

  if (thirdPart.startsWith(",")) {
    const objPart = thirdPart.slice(1).trim();
    if (!objPart.startsWith("{")) return null;
    const close = objPart.lastIndexOf("}");
    if (close === -1) return null;
    const inner = objPart.slice(1, close).trim();
    return inner ? `${keyPart}, { defaultValue: ${dv}, ${inner} }` : `${keyPart}, { defaultValue: ${dv} }`;
  }

  return `${keyPart}, { defaultValue: ${dv} }`;
}

function fixTCallOptions(source) {
  const edits = [];

  for (const pattern of T_CALLEE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const openParen = source.indexOf("(", match.index);
      const closeParen = findBalancedParenEnd(source, openParen);
      if (closeParen === -1) continue;

      const argsText = source.slice(openParen + 1, closeParen);
      const rewritten = rewriteTArgs(argsText);
      if (!rewritten) continue;

      edits.push({
        start: openParen + 1,
        end: closeParen,
        text: rewritten,
      });
    }
  }

  if (edits.length === 0) return { source, changes: 0 };

  edits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const edit of edits) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }

  return { source: out, changes: edits.length };
}

function fixUseTranslationCalls(source, expectedNs) {
  if (!expectedNs || !/useTranslation\s*\(/.test(source)) {
    return { source, changes: 0 };
  }

  let changes = 0;
  const out = source.replace(/useTranslation\s*\(([\s\S]*?)\)/g, (full, inner) => {
    const trimmed = inner.trim();
    if (!trimmed) {
      changes++;
      return `useTranslation("${expectedNs}")`;
    }
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      return full;
    }
    const quoted = trimmed.match(/^['"]([^'"]+)['"]$/);
    if (!quoted) return full;
    if (quoted[1] === expectedNs) return full;
    changes++;
    return `useTranslation("${expectedNs}")`;
  });

  return { source: out, changes };
}

/** i18next-cli instrument 会把新 import 粘在上一行 import 末尾，如 `from "x";import i18next …` */
function fixMergedImportLines(source) {
  // 只匹配同一行粘连（`;` 后仅有空格/制表符，不含换行）
  const pattern = /;([ \t]*import\s)/g;
  const matches = source.match(pattern);
  if (!matches) return { source, changes: 0 };
  return { source: source.replace(pattern, ";\n$1"), changes: matches.length };
}

function looksLikeTailwindClassString(value) {
  const text = String(value).trim();
  if (!/\b(bg|text|border)-[\w-]+/.test(text)) return false;
  const tokens = text.split(/\s+/);
  return tokens.length >= 2
    ? tokens.every((token) => /^(?:[a-z][\w-]*|(?:bg|text|border)-[\w-]+)$/.test(token))
    : /^(?:bg|text|border)-[\w-]+$/.test(text);
}

/** 还原 i18next-cli instrument 对 API 名、路由 path、Tailwind 类名等的误包 t() */
function fixInstrumentFalsePositives(source) {
  let changes = 0;
  let out = source;

  out = out.replace(
    /\.invoke\s*\(\s*i18next\.t\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g,
    (_match, method) => {
      changes++;
      return `.invoke("${method}"`;
    },
  );

  out = out.replace(
    /\bpath\s*:\s*i18next\.t\s*\(\s*['"][^'"]*['"]\s*,\s*['"]\{\{path\}\}([^'"]*)['"]\s*,\s*\{\s*path\s*:\s*([^}]+)\s*\}\s*\)/g,
    (_match, suffix, varName) => {
      changes++;
      return `path: \`\${${varName.trim()}}${suffix}\``;
    },
  );

  out = out.replace(
    /i18next\.t\s*\(\s*['"][^'"]*['"]\s*,\s*['"]((?:(?:bg|text|border)-)[^'"]+)['"]\s*\)/g,
    (match, classes) => {
      if (!looksLikeTailwindClassString(classes)) return match;
      changes++;
      return `"${classes}"`;
    },
  );

  out = out.replace(
    /(\?\s*["']([^'"]+)["']\s*:\s*)(?:i18next\.t|(?<![.\w$])t)\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([a-z][\w]*)['"]\s*\)/g,
    (_match, prefix, _trueVal, falseVal) => {
      changes++;
      return `${prefix}"${falseVal}"`;
    },
  );

  out = out.replace(
    /(?:i18next\.t|(?<![.\w$])t)\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([a-z][\w]*)['"]\s*\)(\s*:\s*["'][a-z][\w]*["'])/g,
    (_match, trueVal, suffix) => {
      changes++;
      return `"${trueVal}"${suffix}`;
    },
  );

  // instrument 误包 API action 名（如 addMLBackend / updateMLBackend）
  out = out.replace(
    /:\s*(?:i18next\.t|(?<![.\w$])t)\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([a-z][A-Z][\w]*)['"]\s*\)/g,
    (_match, actionName) => {
      changes++;
      return `: "${actionName}"`;
    },
  );

  out = out.replace(
    /\?\s*["']([a-zA-Z][\w]*)["']\s*:\s*(?:i18next\.t|(?<![.\w$])t)\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([a-zA-Z][\w]*)['"]\s*\)/g,
    (_match, trueAction, falseAction) => {
      if (trueAction !== falseAction && !/Backend$|ML|Api/i.test(trueAction + falseAction)) return _match;
      changes++;
      return `? "${trueAction}" : "${falseAction}"`;
    },
  );

  // instrument 误把 i18n.changeLanguage(expr) 粘在 t() 前（LangSelect、PeopleList 等）
  out = out.replace(
    /i18n\.changeLanguage\s*\([^)]*\)\s*;\s*(?=(?:i18next\.t|(?<![.\w$])t)\s*\()/g,
    () => {
      changes++;
      return "";
    },
  );

  // localStorage / sessionStorage key（如 config-editor-width:123）不是 UI 文案
  out = out.replace(
    /i18next\.t\s*\(\s*['"][^'"]*['"]\s*,\s*['"]config-editor-width:\{\{projectId\}\}['"]\s*,\s*\{\s*projectId\s*\}\s*\)/g,
    () => {
      changes++;
      return "`config-editor-width:${projectId}`";
    },
  );

  // cookie 技术值 `${finalKey}=true`
  out = out.replace(
    /i18next\.t\s*\(\s*['"][^'"]*['"]\s*,\s*['"]\{\{finalKey\}\}=true['"]\s*,\s*\{\s*finalKey\s*\}\s*\)/g,
    () => {
      changes++;
      return "`${finalKey}=true`";
    },
  );

  // 分析/埋点 event key 模板（HeidiTips utils）
  out = out.replace(
    /i18next\.t\s*\(\s*['"][^'"]*['"]\s*,\s*['"]\{\{EVENT_NAMESPACE_KEY\}\}\.\{\{collection\}\}\.\{\{val\}\}\.\{\{val2\}\}\.\{\{event\}\}['"]\s*,\s*\{[^}]+\}\s*\)/g,
    () => {
      changes++;
      return "`${EVENT_NAMESPACE_KEY}.${collection}.${tip.link.params?.experiment}.${tip.link.params?.treatment}.${event}`";
    },
  );

  return { source: out, changes };
}

/** i18next-cli instrument 把内联 <a>/<i> 压成乱码 i18nKey 的 <Trans> — 去掉外壳，保留内部 JSX */
function isInstrumentGarbageTransKey(key) {
  if (!key) return false;
  if (key.startsWith("aHref")) return true;
  if (/^[0-9][A-Za-z]{10,}/.test(key)) return true;
  if (/Target_blank|Relnoreferrer|Classname|Onclick|Seenbsp|Thenbsp|Idata|Ibatch|Iactions/i.test(key)) {
    return true;
  }
  if (!key.includes(".") && key.length > 35 && /href/i.test(key)) return true;
  return false;
}

function fixBrokenInstrumentTrans(source) {
  let changes = 0;
  const out = source.replace(
    /<Trans\s+[^>]*i18nKey=["']([^"']+)["'][^>]*>([\s\S]*?)<\/Trans>/g,
    (full, key, inner) => {
      if (!isInstrumentGarbageTransKey(key)) return full;
      changes++;
      return inner;
    },
  );
  return { source: out, changes };
}

function fixPostProcess(opts, extraFiles = []) {
  const scoped = collectFiles(opts.scope);
  const files = dedupe([...scoped, ...extraFiles]).sort();
  if (extraFiles.length > 0 && extraFiles.length !== scoped.length) {
    console.log(
      `\n📍 后处理范围：scope ${scoped.length} 个文件 + instrument git 改动 ${extraFiles.length} 个（去重后 ${files.length} 个）\n`,
    );
  }
  let nsChanges = 0;
  let tChanges = 0;
  let importChanges = 0;
  let transUnwrapChanges = 0;
  let falsePositiveChanges = 0;
  let touched = 0;
  const skipped = [];

  for (const filePath of files) {
    const srcRel = toSrcRelative(filePath, WEB_ROOT);
    const expectedNs = inferNamespace(srcRel);
    let source = fs.readFileSync(filePath, "utf8");
    let fileChanges = 0;

    const importFix = fixMergedImportLines(source);
    source = importFix.source;
    fileChanges += importFix.changes;
    importChanges += importFix.changes;

    const transFix = fixBrokenInstrumentTrans(source);
    source = transFix.source;
    fileChanges += transFix.changes;
    transUnwrapChanges += transFix.changes;

    const fpFix = fixInstrumentFalsePositives(source);
    source = fpFix.source;
    fileChanges += fpFix.changes;
    falsePositiveChanges += fpFix.changes;

    const nsFix = fixUseTranslationCalls(source, expectedNs);
    source = nsFix.source;
    fileChanges += nsFix.changes;
    nsChanges += nsFix.changes;

    const tFix = fixTCallOptions(source);
    source = tFix.source;
    fileChanges += tFix.changes;
    tChanges += tFix.changes;

    if (expectedNs === null && /useTranslation\s*\(/.test(source)) {
      skipped.push(srcRel);
    }

    if (fileChanges === 0) continue;

    touched++;
    const label = path.relative(WEB_ROOT, filePath);
    console.log(
      `${opts.dryRun ? "[dry-run] " : ""}${label}: import-split x${importFix.changes}, trans-unwrap x${transFix.changes}, false-positive-revert x${fpFix.changes}, namespace x${nsFix.changes}, defaultValue-object x${tFix.changes}`,
    );

    if (!opts.dryRun) {
      fs.writeFileSync(filePath, source, "utf8");
    }
  }

  if (skipped.length > 0) {
    console.log("\n以下文件含 useTranslation 但未匹配 namespaces 配置，请在 i18n/config.json 补充：");
    for (const rel of skipped) console.log(`  ${SOURCE_ROOT}/${rel}`);
  }

  console.log(
    `\n${opts.dryRun ? "将修改" : "已修改"} ${touched} 个文件：import 拆行 ${importChanges} 处，Trans 去壳 ${transUnwrapChanges} 处，误包 t() 还原 ${falsePositiveChanges} 处，useTranslation ${nsChanges} 处，t() 对象化 ${tChanges} 处。`,
  );

  let prefixStats = { changedFiles: 0, changedCalls: 0 };
  if (!opts.noPrefixKeys) {
    console.log("");
    for (const scopeEntry of dedupe(String(opts.scope).split(","))) {
      const stats = runPrefixKeys({
        scope: scopeEntry,
        prefix: opts.prefix,
        namespace: opts.namespace,
        dryRun: opts.dryRun,
      });
      prefixStats.changedFiles += stats.changedFiles;
      prefixStats.changedCalls += stats.changedCalls;
    }
  }

  let nsFixStats = { total: 0, filesChanged: 0 };
  console.log("");
  nsFixStats = runFixI18nextNs({ dryRun: opts.dryRun, scope: opts.scope });

  return { touched, nsChanges, tChanges, ...prefixStats, nsFixStats };
}

function removeScaffoldI18n(opts) {
  if (!fs.existsSync(SCAFFOLD_I18N)) return false;

  const rel = path.relative(WEB_ROOT, SCAFFOLD_I18N);
  if (opts.dryRun) {
    console.log(`[dry-run] 将删除 ${rel}（init 脚手架，运行时用 apps/labelstudio/src/i18n/index.ts）`);
    return false;
  }

  fs.unlinkSync(SCAFFOLD_I18N);
  console.log(`已删除 ${rel}`);
  return true;
}

function runPostInstrumentCheck() {
  const modules = detectModulesFromGit(REPO_ROOT);
  if (modules.length === 0) {
    console.log("\n🔍 instrument 后自检：无 git 变更 module，跳过 i18n:check");
    return;
  }

  const env = { ...process.env, I18N_EXTRACT_SCOPE: modules.join(",") };
  console.log(`\n🔍 instrument 后自检（git 变更 modules: [${modules.join(", ")}]）\n`);
  try {
    execFileSync("node", ["i18n/check-quality.cjs"], { cwd: WEB_ROOT, env, stdio: "inherit" });
  } catch {
    console.error(
      "\n🚨 instrument 后 i18n:check 未通过（常见为 instrument 误伤 API 名 / Tailwind / Trans / HeidiTips）",
    );
    console.error("   修复: yarn i18n:instrument -- --fix-only");
    console.error("   或: git diff 还原误改文件后重跑 check");
    process.exit(1);
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    showHelp();
    process.exit(0);
  }

  if (!opts.scopeExplicit) {
    const detected = detectModulesFromGit(REPO_ROOT);
    if (detected.length > 0) {
      opts.scope = detected.join(",");
      opts.scopeAuto = true;
    }
  }

  const instrumentResult = runInstrument(opts);

  let instrumentTouched = [];
  if (!opts.dryRun && !opts.fixOnly) {
    instrumentTouched = collectGitChangedWebSources();
  }

  if (!opts.dryRun) {
    const postStats = fixPostProcess(opts, instrumentTouched);
    const removedScaffold = removeScaffoldI18n(opts);

    const hasWork =
      instrumentResult.approved > 0 ||
      postStats.touched > 0 ||
      postStats.changedCalls > 0 ||
      postStats.nsFixStats?.total > 0 ||
      removedScaffold;

    if (!hasWork) {
      console.log(
        "\n无源码变更，跳过 Agent 审查与 extract。若目标模块未 instrument，可改源码后重跑，或显式：\n" +
          "  yarn i18n:instrument -- --scope=components/Menubar",
      );
      return;
    }

    if (opts.noAgentReview) {
      if (opts.scope) {
        for (const scopeEntry of dedupe(String(opts.scope).split(","))) {
          appendModule(scopeEntry);
        }
        console.log(`\n📋 modules 已追加: [${opts.scope}]（i18n/config.json）`);
      }
      runPostInstrumentCheck();
      console.log("\n已跳过 Agent 审查（--no-agent-review）");
      console.log("建议: yarn i18n:agent-review");
      console.log("强制: cursor自行读取 agent-review-prompt.txt 并执行");
      return;
    }

    runAgentReview(opts);
  } else {
    console.log("\n[dry-run] 跳过后处理、删除 i18n.ts 与 Agent 审查");
  }
}

main();
