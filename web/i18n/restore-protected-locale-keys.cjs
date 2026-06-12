#!/usr/bin/env node
/**
 * extract 会 removeUnusedKeys，动态 key（datamanager.actions/columns.*）不在源码里会被删。
 * 本模块在 extract 后从 extract 前快照恢复受保护 prefix 的 key（含 zh/zh_tw 译文），
 * 再交给 seed 脚本更新 en；避免 extract 非零退出导致 seed 未跑、译文永久丢失。
 */

const fs = require("fs");
const path = require("path");

const mtConfig = require("./mt.config.cjs");
const { WEB_ROOT, readJson } = require("./locale-git.cjs");

/** namespace → 不可被 extract 删除的 key 前缀（动态 t() / registry 维护） */
const PROTECTED_RULES = [
  {
    namespace: "datamanager",
    prefixes: ["datamanager.actions.", "datamanager.columns."],
    label: "datamanager.actions/columns.*",
  },
];

function isProtectedKey(namespace, key) {
  const rule = PROTECTED_RULES.find((r) => r.namespace === namespace);
  if (!rule) return false;
  return rule.prefixes.some((prefix) => key.startsWith(prefix));
}

function localePath(lang, namespace) {
  return path.join(WEB_ROOT, mtConfig.localesDir, lang, `${namespace}.json`);
}

function writeSortedJson(filePath, data) {
  const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`);
}

/**
 * 从 extract 前快照恢复受保护 key（key 缺失，或 zh/zh_tw 被 extract+seed 清空时）。
 * @param {{ beforeSnapshot: object, dryRun?: boolean }} opts
 */
function runRestoreProtectedKeys(opts = {}) {
  const { beforeSnapshot, dryRun = false } = opts;
  if (!beforeSnapshot) return { restored: 0, details: [] };

  let restored = 0;
  const details = [];

  for (const [namespace, langs] of Object.entries(beforeSnapshot)) {
    if (!PROTECTED_RULES.some((r) => r.namespace === namespace)) continue;

    for (const [lang, oldLocale] of Object.entries(langs)) {
      if (!oldLocale || typeof oldLocale !== "object") continue;

      const filePath = localePath(lang, namespace);
      const current = readJson(filePath) || {};
      let changed = false;

      for (const [key, oldValue] of Object.entries(oldLocale)) {
        if (!isProtectedKey(namespace, key)) continue;

        const missing = !(key in current);
        const emptied =
          lang !== mtConfig.sourceLang &&
          typeof oldValue === "string" &&
          oldValue.trim().length > 0 &&
          (current[key] === "" || current[key] === undefined);

        if (!missing && !emptied) continue;

        current[key] = oldValue;
        restored += 1;
        changed = true;
        details.push({ lang, namespace, key, reason: missing ? "missing" : "emptied" });
      }

      if (changed && !dryRun) {
        writeSortedJson(filePath, current);
      }
    }
  }

  return { restored, details };
}

/**
 * 流水线末尾防呆：受保护 key 数量不得少于 extract 前快照。
 * @param {object} beforeSnapshot
 */
function verifyProtectedKeys(beforeSnapshot) {
  const missing = [];

  if (!beforeSnapshot) return { ok: true, missing };

  for (const rule of PROTECTED_RULES) {
    const langs = beforeSnapshot[rule.namespace];
    if (!langs) continue;

    const enOld = langs[mtConfig.sourceLang] || {};
    const enPath = localePath(mtConfig.sourceLang, rule.namespace);
    const enCurrent = readJson(enPath) || {};

    for (const key of Object.keys(enOld)) {
      if (!rule.prefixes.some((prefix) => key.startsWith(prefix))) continue;
      if (!(key in enCurrent)) {
        missing.push({ namespace: rule.namespace, key, lang: mtConfig.sourceLang });
      }
    }
  }

  return { ok: missing.length === 0, missing };
}

module.exports = {
  PROTECTED_RULES,
  isProtectedKey,
  runRestoreProtectedKeys,
  verifyProtectedKeys,
};
