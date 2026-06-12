#!/usr/bin/env node
/**
 * 给 instrument 已生成的 t() / i18next.t() key 补路径式前缀（仅改源码）。
 * 由 fix-instrument.cjs 自动调用；locale JSON 请随后 yarn i18n:extract。
 */

const fs = require("fs");
const path = require("path");
const { moduleAbsPath } = require("./config.cjs");

const WEB_ROOT = path.join(__dirname, "..");
const SRC_ROOT = path.join(WEB_ROOT, "apps/labelstudio/src");
const CONFIG_PATH = path.join(WEB_ROOT, "i18next.config.ts");
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const KNOWN_PREFIXES = [
  "appCommon.",
  "apps.",
  "components.",
  "common.",
  "config.",
  "datamanager.",
  "hooks.",
  "libs.",
  "pages.",
  "providers.",
  "stores.",
  "utils.",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    scope: "",
    prefix: "",
    namespace: "",
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith("--scope=")) {
      opts.scope = trimSlashes(arg.slice("--scope=".length));
    } else if (arg.startsWith("--prefix=")) {
      opts.prefix = trimDots(arg.slice("--prefix=".length));
    } else if (arg.startsWith("--namespace=")) {
      opts.namespace = arg.slice("--namespace=".length).trim();
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    } else {
      fail(`未知参数: ${arg}`);
    }
  }

  return opts;
}

function fail(message) {
  console.error(message);
  console.error(
    "用法: yarn i18n:prefix-keys --scope=pages/Home [--namespace=labelstudio] [--prefix=pages.Home] [--dry-run]",
  );
  process.exit(1);
}

function readI18nextConfig() {
  const fallback = { defaultNS: "translation", nsSeparator: ":" };

  if (!fs.existsSync(CONFIG_PATH)) return fallback;

  const source = fs.readFileSync(CONFIG_PATH, "utf8");
  return {
    defaultNS: readString(source, "defaultNS") || fallback.defaultNS,
    nsSeparator: readString(source, "nsSeparator") || fallback.nsSeparator,
  };
}

function readString(source, key) {
  const match = source.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`));
  return match ? match[1] : "";
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function trimDots(value) {
  return value.replace(/^\.+|\.+$/g, "");
}

function resolveScope(scope) {
  const normalized = trimSlashes(scope || "");
  if (!normalized) return SRC_ROOT;
  return moduleAbsPath(normalized);
}

function filePrefix(filePath, overridePrefix) {
  if (overridePrefix) return overridePrefix;

  const relWeb = path.relative(WEB_ROOT, filePath).replace(/\\/g, "/");
  const appCommonMatch = relWeb.match(/^libs\/app-common\/src\/(.+)\.(ts|tsx|js|jsx)$/);
  if (appCommonMatch) {
    return `appCommon.${appCommonMatch[1].split("/").join(".")}`;
  }

  const datamanagerMatch = relWeb.match(/^libs\/datamanager\/src\/(.+)\.(ts|tsx|js|jsx)$/);
  if (datamanagerMatch) {
    return `datamanager.${datamanagerMatch[1].split("/").join(".")}`;
  }

  const rel = path.relative(SRC_ROOT, filePath);
  const withoutExt = rel.replace(/\.(ts|tsx|js|jsx)$/, "");
  return withoutExt.split(path.sep).join(".");
}

function collectFiles(target) {
  if (!fs.existsSync(target)) {
    fail(`scope 不存在: ${target}`);
  }

  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return SOURCE_EXTS.has(path.extname(target)) ? [target] : [];
  }

  const files = [];
  walk(target, files);
  return files.sort();
}

function walk(dir, files) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walk(fullPath, files);
    } else if (SOURCE_EXTS.has(path.extname(ent.name))) {
      files.push(fullPath);
    }
  }
}

function shouldPrefixKey(key) {
  if (!key) return false;
  if (KNOWN_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
  return true;
}

function suffixFromKey(key) {
  const parts = key.split(".");
  return parts[parts.length - 1];
}

function isIdentChar(ch) {
  return /[A-Za-z0-9_$]/.test(ch || "");
}

function skipWhitespace(source, index) {
  let i = index;
  while (i < source.length && /\s/.test(source[i])) i++;
  return i;
}

function skipString(source, index) {
  const quote = source[index];
  let i = index + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i++;
  }
  return source.length;
}

function skipLineComment(source, index) {
  let i = index + 2;
  while (i < source.length && source[i] !== "\n") i++;
  return i;
}

function skipBlockComment(source, index) {
  let i = index + 2;
  while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
  return Math.min(i + 2, source.length);
}

function findMatchingParen(source, parenIndex) {
  let depth = 0;
  let i = parenIndex;

  while (i < source.length) {
    if (source.startsWith("//", i)) {
      i = skipLineComment(source, i);
      continue;
    }
    if (source.startsWith("/*", i)) {
      i = skipBlockComment(source, i);
      continue;
    }
    if (source[i] === '"' || source[i] === "'" || source[i] === "`") {
      i = skipString(source, i);
      continue;
    }
    if (source[i] === "(") depth++;
    if (source[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }

  return -1;
}

function findCallParen(source, index) {
  if (source.startsWith("i18next.t", index) && !isIdentChar(source[index - 1]) && source[index - 1] !== ".") {
    const after = index + "i18next.t".length;
    const paren = skipWhitespace(source, after);
    return source[paren] === "(" ? paren : -1;
  }

  if (source[index] === "t" && !isIdentChar(source[index - 1]) && source[index - 1] !== "." && !isIdentChar(source[index + 1])) {
    const paren = skipWhitespace(source, index + 1);
    return source[paren] === "(" ? paren : -1;
  }

  return -1;
}

function readFirstStringArg(source, parenIndex) {
  let i = skipWhitespace(source, parenIndex + 1);

  while (source.startsWith("//", i) || source.startsWith("/*", i)) {
    i = source.startsWith("//", i) ? skipLineComment(source, i) : skipBlockComment(source, i);
    i = skipWhitespace(source, i);
  }

  const quote = source[i];
  if (quote !== '"' && quote !== "'") return null;

  let value = "";
  let j = i + 1;
  while (j < source.length) {
    const ch = source[j];
    if (ch === "\\") {
      value += source[j + 1] ?? "";
      j += 2;
      continue;
    }
    if (ch === quote) {
      return {
        quote,
        value,
        start: i + 1,
        end: j,
      };
    }
    value += ch;
    j++;
  }

  return null;
}

function escapeForQuote(value, quote) {
  return value.replace(/\\/g, "\\\\").replace(new RegExp(quote, "g"), `\\${quote}`);
}

function stripNamespace(key, nsSeparator) {
  const index = key.indexOf(nsSeparator);
  if (index <= 0) {
    return { namespace: "", key, hadNamespacePrefix: false };
  }

  return {
    namespace: key.slice(0, index),
    key: key.slice(index + nsSeparator.length),
    hadNamespacePrefix: true,
  };
}

function readCallNamespace(source, parenIndex) {
  const end = findMatchingParen(source, parenIndex);
  if (end < 0) return "";

  const callText = source.slice(parenIndex + 1, end);
  const match = callText.match(/\bns\s*:\s*["']([^"']+)["']/);
  return match ? match[1] : "";
}

function readFileNamespace(source) {
  const match = source.match(/\buseTranslation\s*\(\s*["']([^"']+)["']/);
  return match ? match[1] : "";
}

function prefixSource(source, prefix, opts, config) {
  const replacements = [];
  const fileNamespace = readFileNamespace(source);
  let i = 0;

  while (i < source.length) {
    if (source.startsWith("//", i)) {
      i = skipLineComment(source, i);
      continue;
    }
    if (source.startsWith("/*", i)) {
      i = skipBlockComment(source, i);
      continue;
    }
    if (source[i] === '"' || source[i] === "'" || source[i] === "`") {
      i = skipString(source, i);
      continue;
    }

    const paren = findCallParen(source, i);
    if (paren >= 0) {
      const arg = readFirstStringArg(source, paren);
      if (arg) {
        const keyInfo = stripNamespace(arg.value, config.nsSeparator);
        if (!shouldPrefixKey(keyInfo.key)) {
          i = paren + 1;
          continue;
        }

        const callNamespace = readCallNamespace(source, paren);
        const namespace =
          keyInfo.namespace || callNamespace || fileNamespace || opts.namespace || config.defaultNS;
        const suffix = suffixFromKey(keyInfo.key);
        const nextLocaleKey = `${prefix}.${suffix}`;
        const nextCodeKey = keyInfo.hadNamespacePrefix
          ? `${namespace}${config.nsSeparator}${nextLocaleKey}`
          : nextLocaleKey;

        replacements.push({
          start: arg.start,
          end: arg.end,
          oldKey: arg.value,
          newKey: nextCodeKey,
          namespace,
          text: escapeForQuote(nextCodeKey, arg.quote),
        });
      }
      i = paren + 1;
      continue;
    }

    i++;
  }

  if (replacements.length === 0) {
    return { source, replacements };
  }

  let out = source;
  for (const replacement of replacements.slice().reverse()) {
    out = `${out.slice(0, replacement.start)}${replacement.text}${out.slice(replacement.end)}`;
  }

  return { source: out, replacements };
}

function processFile(filePath, opts) {
  const source = fs.readFileSync(filePath, "utf8");
  const prefix = filePrefix(filePath, opts.prefix);
  const result = prefixSource(source, prefix, opts, opts.config);

  if (result.replacements.length === 0) {
    return { changed: 0, replacements: [] };
  }

  if (!opts.dryRun) {
    fs.writeFileSync(filePath, result.source, "utf8");
  }

  return {
    changed: result.replacements.length,
    replacements: result.replacements,
  };
}

/**
 * @param {{ scope?: string, prefix?: string, namespace?: string, dryRun?: boolean }} options
 */
function runPrefixKeys(options = {}) {
  const opts = {
    scope: options.scope || "",
    prefix: options.prefix || "",
    namespace: options.namespace || "",
    dryRun: Boolean(options.dryRun),
    config: readI18nextConfig(),
  };

  const scopePath = resolveScope(opts.scope);
  const files = collectFiles(scopePath);

  let changedFiles = 0;
  let changedCalls = 0;

  for (const file of files) {
    const result = processFile(file, opts);
    if (result.changed === 0) continue;

    changedFiles++;
    changedCalls += result.changed;

    const rel = path.relative(WEB_ROOT, file);
    const mode = opts.dryRun ? "would update" : "updated";
    console.log(`${mode}: ${rel} (${result.changed})`);
    for (const item of result.replacements) {
      console.log(`  [${item.namespace}] ${item.oldKey} -> ${item.newKey}`);
    }
  }

  const action = opts.dryRun ? "可更新" : "已更新";
  console.log(`prefix-keys：${action} ${changedFiles} 个源码文件，${changedCalls} 个 key（生成locale/json 请随后执行 yarn i18n:extract）`);

  return { changedFiles, changedCalls };
}

if (require.main === module) {
  const opts = parseArgs();
  if (!opts.scope) {
    fail("缺少参数: --scope=pages/Home");
  }
  runPrefixKeys(opts);
}

module.exports = { runPrefixKeys };
