#!/usr/bin/env node
/**
 * Data Manager 列头文案：从 dm-columns.registry.json 写入 locales/{lang}/datamanager.json。
 * extract 无法扫描 API 下发的 column.title，由本脚本维护 en 并补全 zh/zh_tw 缺失 key。
 */

const fs = require("fs");
const path = require("path");

const WEB_ROOT = path.join(__dirname, "..");
const REGISTRY_FILE = path.join(__dirname, "dm-columns.registry.json");
const LOCALES_DIR = path.join(WEB_ROOT, "locales");
const NS = "datamanager";
const LANGS = ["en", "zh", "zh_tw"];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(filePath, data) {
  const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`);
}

function flattenRegistry(registry) {
  const keys = {};

  for (const [columnId, entry] of Object.entries(registry)) {
    if (columnId.startsWith("_")) continue;

    if (entry.title) {
      keys[`datamanager.columns.${columnId}.title`] = entry.title;
    }
    if (entry.help) {
      keys[`datamanager.columns.${columnId}.help`] = entry.help;
    }
  }

  return keys;
}

/**
 * @param {{ dryRun?: boolean }} [opts]
 */
function runSeedDmColumnKeys(opts = {}) {
  const registry = readJson(REGISTRY_FILE);
  const columnKeys = flattenRegistry(registry);
  let added = 0;
  let updated = 0;
  const touchedLangs = [];

  for (const lang of LANGS) {
    const filePath = path.join(LOCALES_DIR, lang, `${NS}.json`);
    const locale = readJson(filePath);
    let langChanged = false;

    for (const [key, enValue] of Object.entries(columnKeys)) {
      if (lang === "en") {
        if (!(key in locale)) {
          locale[key] = enValue;
          added += 1;
          langChanged = true;
        } else if (locale[key] !== enValue) {
          locale[key] = enValue;
          updated += 1;
          langChanged = true;
        }
        continue;
      }

      if (!(key in locale)) {
        locale[key] = "";
        added += 1;
        langChanged = true;
      }
    }

    if (langChanged) {
      touchedLangs.push(lang);
      if (!opts.dryRun) writeJson(filePath, locale);
    }
  }

  return { added, updated, keyCount: Object.keys(columnKeys).length, langs: touchedLangs };
}

module.exports = { runSeedDmColumnKeys, flattenRegistry, REGISTRY_FILE };

if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  const { added, updated, keyCount, langs } = runSeedDmColumnKeys({ dryRun });
  const action = dryRun ? "would update" : "updated";
  console.log(
    `seed-dm-column-keys：${action} datamanager.json（${keyCount} registry keys，+${added}，~${updated} en 变更，语言: ${langs.join(", ") || "无"})`,
  );
}
