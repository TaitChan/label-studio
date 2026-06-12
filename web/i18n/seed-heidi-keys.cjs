#!/usr/bin/env node
/**
 * HeidiTips 文案来自 content.ts / liveContent.json，key 在运行时动态生成。
 * 写入 locales/{lang}/heidi-tips.json（ignoreNamespaces，extract 不碰此文件）。
 */

const fs = require("fs");
const path = require("path");

const WEB_ROOT = path.join(__dirname, "..");
const HEIDI_DIR = path.join(WEB_ROOT, "apps/labelstudio/src/components/HeidiTips");
const LOCALES_DIR = path.join(WEB_ROOT, "locales");
const NS = "heidi-tips";
const LANGS = ["en", "zh", "zh_tw"];
const HEIDI_KEY_PREFIX = "heidiTips.";

function isTranslatable(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function tipBody(tip) {
  return tip.description ?? tip.content ?? "";
}

function collectFrom(data) {
  const keys = {};
  for (const [collection, tips] of Object.entries(data)) {
    if (!Array.isArray(tips)) continue;
    for (const tip of tips) {
      const id = tip.link?.params?.treatment ?? "default";
      keys[`heidiTips.${collection}.${id}.title`] = tip.title;
      keys[`heidiTips.${collection}.${id}.content`] = tipBody(tip);
      keys[`heidiTips.${collection}.${id}.link`] = tip.link?.label ?? "";
    }
  }
  return keys;
}

function readFallbackTips() {
  const contentSrc = fs.readFileSync(path.join(HEIDI_DIR, "content.ts"), "utf8");
  const match = contentSrc.match(/export const defaultTipsCollection[^=]*=\s*(\{[\s\S]*\});?\s*$/);
  if (!match) {
    throw new Error("seed-heidi-keys: could not parse content.ts");
  }
  return eval(`(${match[1]})`);
}

function loadHeidiTipKeys() {
  const live = JSON.parse(fs.readFileSync(path.join(HEIDI_DIR, "liveContent.json"), "utf8"));
  const fallback = readFallbackTips();
  return {
    ...collectFrom(fallback),
    ...collectFrom(live),
    "heidiTips.dismiss": "Don't show",
  };
}

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

/**
 * @param {{ dryRun?: boolean }} [opts]
 * @returns {{ added: number, updated: number, langs: string[] }}
 */
function runSeedHeidiKeys(opts = {}) {
  const heidiKeys = loadHeidiTipKeys();
  let added = 0;
  let updated = 0;
  const touchedLangs = [];

  for (const lang of LANGS) {
    const filePath = path.join(LOCALES_DIR, lang, `${NS}.json`);
    const locale = readJson(filePath);
    let langChanged = false;

    for (const [key, enValue] of Object.entries(heidiKeys)) {
      if (!key.startsWith(HEIDI_KEY_PREFIX)) continue;

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

  return { added, updated, langs: touchedLangs };
}

module.exports = { runSeedHeidiKeys, loadHeidiTipKeys, HEIDI_KEY_PREFIX, NS };

if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  const { added, updated, langs } = runSeedHeidiKeys({ dryRun });
  const action = dryRun ? "would update" : "updated";
  console.log(
    `seed-heidi-keys：${action} heidi-tips.json（+${added} key${added === 1 ? "" : "s"}，~${updated} en value 变更，语言: ${langs.join(", ") || "无"})`,
  );
}
