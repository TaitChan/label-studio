#!/usr/bin/env node
/**
 * Export 格式文案：从 export-formats.registry.json 写入 locales/{lang}/labelstudio.json。
 * extract 无法扫描动态 key（pages.ExportPage.exportFormats.{name}.*），由本脚本维护。
 */

const fs = require("fs");
const path = require("path");

const WEB_ROOT = path.join(__dirname, "..");
const REGISTRY_FILE = path.join(__dirname, "export-formats.registry.json");
const LOCALES_DIR = path.join(WEB_ROOT, "locales");
const NS = "labelstudio";
const LANGS = ["en", "zh", "zh_tw"];
const KEY_PREFIX = "pages.ExportPage.exportFormats";
const TAG_KEY_PREFIX = "pages.ExportPage.exportFormatTags";

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

  for (const [formatName, entry] of Object.entries(registry.formats || {})) {
    if (formatName.startsWith("_")) continue;
    if (entry.title) {
      keys[`${KEY_PREFIX}.${formatName}.title`] = entry.title;
    }
    if (entry.description) {
      keys[`${KEY_PREFIX}.${formatName}.description`] = entry.description;
    }
  }

  for (const [tagSlug, tagLabel] of Object.entries(registry.tags || {})) {
    if (tagSlug.startsWith("_")) continue;
    keys[`${TAG_KEY_PREFIX}.${tagSlug}`] = tagLabel;
  }

  return keys;
}

/**
 * @param {{ dryRun?: boolean }} [opts]
 */
function runSeedExportFormatKeys(opts = {}) {
  const registry = readJson(REGISTRY_FILE);
  const formatKeys = flattenRegistry(registry);
  let added = 0;
  let updated = 0;
  const touchedLangs = [];

  for (const lang of LANGS) {
    const filePath = path.join(LOCALES_DIR, lang, `${NS}.json`);
    const locale = readJson(filePath);
    let langChanged = false;

    for (const [key, enValue] of Object.entries(formatKeys)) {
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

  return { added, updated, keyCount: Object.keys(formatKeys).length, langs: touchedLangs };
}

module.exports = { runSeedExportFormatKeys, flattenRegistry, REGISTRY_FILE, KEY_PREFIX, TAG_KEY_PREFIX };

if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  const { added, updated, keyCount, langs } = runSeedExportFormatKeys({ dryRun });
  const action = dryRun ? "would update" : "updated";
  console.log(
    `seed-export-format-keys：${action} labelstudio.json（${keyCount} registry keys，+${added}，~${updated} en 变更，语言: ${langs.join(", ") || "无"})`,
  );
}
