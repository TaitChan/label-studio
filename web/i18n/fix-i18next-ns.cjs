#!/usr/bin/env node
/**
 * 为 i18next.t('appCommon.*' | 'datamanager.*', { ... }) 补 ns，避免 extract 写入 labelstudio.json。
 *
 * 挂载位置（均在 extract 之前）：
 *   - fix-instrument 后处理（prefix-keys 之后）
 *   - fix-extract 步骤 1.5（快照之后、i18next-cli extract 之前）
 *
 * 用法（web/）:
 *   node i18n/fix-i18next-ns.cjs [--dry-run] [--scope=libs/app-common]
 */

const fs = require("fs");
const path = require("path");
const { WEB_ROOT } = require("./config.cjs");

const PREFIX_TO_NS = {
  appCommon: "app-common",
  datamanager: "datamanager",
};

function parseArgs(argv) {
  const opts = { dryRun: false, scope: "", quiet: false };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--quiet") opts.quiet = true;
    else if (arg.startsWith("--scope=")) opts.scope = arg.slice("--scope=".length).trim();
  }
  return opts;
}

function findBalancedParenEnd(source, openIndex) {
  let depth = 0;
  let inStr = null;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function scanStringLiteral(source, start) {
  const quote = source[start];
  if (quote !== '"' && quote !== "'") return null;
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === quote) return { value: source.slice(start + 1, i), end: i + 1 };
    i++;
  }
  return null;
}

function inferNsFromKey(key) {
  const prefix = key.split(".")[0];
  return PREFIX_TO_NS[prefix] ?? null;
}

function fixFile(source) {
  const edits = [];
  let idx = 0;

  while ((idx = source.indexOf("i18next.t(", idx)) !== -1) {
    const openParen = source.indexOf("(", idx);
    const closeParen = findBalancedParenEnd(source, openParen);
    if (closeParen === -1) break;

    const callText = source.slice(idx, closeParen + 1);
    const argsStart = openParen + 1;
    const rawArgs = source.slice(argsStart, closeParen);
    const argsText = rawArgs.trim();
    const argsTrimOffset = rawArgs.length - rawArgs.trimStart().length;
    const firstNonWs = argsText.search(/\S/);
    if (firstNonWs === -1) {
      idx = closeParen + 1;
      continue;
    }

    const keyLit = scanStringLiteral(argsText, firstNonWs);
    if (!keyLit) {
      idx = closeParen + 1;
      continue;
    }

    const expectedNs = inferNsFromKey(keyLit.value);
    if (!expectedNs) {
      idx = closeParen + 1;
      continue;
    }

    if (/\bns\s*:/.test(callText)) {
      idx = closeParen + 1;
      continue;
    }

    const afterKey = argsText.slice(keyLit.end);
    const optsBraceRel = afterKey.search(/\{/);
    if (optsBraceRel === -1) {
      idx = closeParen + 1;
      continue;
    }

    const optsBraceAbs = argsStart + argsTrimOffset + keyLit.end + optsBraceRel;
    let insertAt = optsBraceAbs + 1;
    while (insertAt < source.length && /\s/.test(source[insertAt])) insertAt++;

    const snippet = `ns: "${expectedNs}", `;
    edits.push({ insertAt, snippet });
    idx = closeParen + 1;
  }

  if (edits.length === 0) return { source, count: 0 };

  edits.sort((a, b) => b.insertAt - a.insertAt);
  let next = source;
  for (const { insertAt, snippet } of edits) {
    next = next.slice(0, insertAt) + snippet + next.slice(insertAt);
  }
  return { source: next, count: edits.length };
}

function walkSourceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== "node_modules") walkSourceFiles(p, out);
    else if (/\.(jsx?|tsx?)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function collectFiles(scope) {
  if (scope) {
    const roots = scope.split(",").map((s) => {
      const trimmed = s.trim();
      if (trimmed.startsWith("libs/")) return path.join(WEB_ROOT, trimmed);
      return path.join(WEB_ROOT, "apps/labelstudio/src", trimmed);
    });
    return [
      ...new Set(
        roots.flatMap((r) => {
          if (!fs.existsSync(r)) return [];
          return fs.statSync(r).isDirectory() ? walkSourceFiles(r) : [r];
        }),
      ),
    ];
  }
  return [
    ...walkSourceFiles(path.join(WEB_ROOT, "libs/app-common")),
    ...walkSourceFiles(path.join(WEB_ROOT, "libs/datamanager")),
  ];
}

/**
 * @param {{ dryRun?: boolean, scope?: string, quiet?: boolean }} options
 * @returns {{ total: number, filesChanged: number }}
 */
function runFixI18nextNs(options = {}) {
  const opts = {
    dryRun: Boolean(options.dryRun),
    scope: options.scope || "",
    quiet: Boolean(options.quiet),
  };
  const files = collectFiles(opts.scope);

  let total = 0;
  let filesChanged = 0;

  for (const filePath of files) {
    const before = fs.readFileSync(filePath, "utf8");
    if (!before.includes("i18next.t(")) continue;

    const { source: after, count } = fixFile(before);
    if (count === 0) continue;

    total += count;
    filesChanged++;
    if (!opts.quiet) {
      const rel = path.relative(WEB_ROOT, filePath);
      console.log(`${opts.dryRun ? "[dry-run] " : ""}${rel}: +ns × ${count}`);
    }

    if (!opts.dryRun) fs.writeFileSync(filePath, after, "utf8");
  }

  if (!opts.quiet) {
    console.log(
      `\n${opts.dryRun ? "Would fix" : "Fixed"} ${total} i18next.t call(s) in ${filesChanged} file(s)`,
    );
  }

  return { total, filesChanged };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  runFixI18nextNs(opts);
}

if (require.main === module) {
  main();
}

module.exports = { runFixI18nextNs, PREFIX_TO_NS };
