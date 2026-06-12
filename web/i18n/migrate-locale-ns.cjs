#!/usr/bin/env node
/**
 * 把 labelstudio.json 里误落的 appCommon.* / datamanager.* key 迁回对应 namespace 文件。
 * 不改 key 名，只移动条目；目标文件已有同 key 时保留非空译文。
 *
 * 用法（web/）:
 *   node i18n/migrate-locale-ns.cjs [--dry-run]
 */

const fs = require("fs");
const path = require("path");
const mtConfig = require("./mt.config.cjs");
const { WEB_ROOT, readJson } = require("./locale-git.cjs");

const MOVES = [
  { prefix: "appCommon.", targetNs: "app-common" },
  { prefix: "datamanager.", targetNs: "datamanager" },
];

function parseArgs(argv) {
  return { dryRun: argv.includes("--dry-run") };
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

function mergeEntry(target, key, value) {
  if (!(key in target) || target[key] === "" || target[key] == null) {
    target[key] = value;
    return "moved";
  }
  if (target[key] === value) return "duplicate";
  return "kept-target";
}

function migrateLocale(lang, dryRun) {
  const localesDir = path.join(WEB_ROOT, mtConfig.localesDir, lang);
  const labelPath = path.join(localesDir, "labelstudio.json");
  const labelstudio = readJson(labelPath);
  const stats = { moved: 0, duplicate: 0, kept: 0 };

  for (const { prefix, targetNs } of MOVES) {
    const targetPath = path.join(localesDir, `${targetNs}.json`);
    const target = readJson(targetPath);
    const toRemove = [];

    for (const [key, value] of Object.entries(labelstudio)) {
      if (!key.startsWith(prefix)) continue;
      const result = mergeEntry(target, key, value);
      if (result === "moved") stats.moved++;
      else if (result === "duplicate") stats.duplicate++;
      else stats.kept++;
      toRemove.push(key);
    }

    for (const key of toRemove) delete labelstudio[key];

    if (!dryRun) {
      writeJson(targetPath, sortKeys(target));
    }
  }

  if (!dryRun) writeJson(labelPath, sortKeys(labelstudio));
  return stats;
}

function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const langs = [mtConfig.sourceLang, ...(mtConfig.defaultTargets || ["zh", "zh_tw"])];

  console.log(dryRun ? "dry-run: migrate locale namespace keys\n" : "migrate locale namespace keys\n");

  for (const lang of langs) {
    const stats = migrateLocale(lang, dryRun);
    console.log(
      `${lang}: moved ${stats.moved}, duplicate ${stats.duplicate}, kept existing target ${stats.kept}`,
    );
  }
}

main();
