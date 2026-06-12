/**
 * locale JSON 与 git HEAD 对比的共用工具（backfill --stale、migrate-renamed-keys）。
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const WEB_ROOT = path.join(__dirname, "..");
const REPO_ROOT = path.join(WEB_ROOT, "..");

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

function readJsonAtGitRef(filePath, gitRef = "HEAD") {
  if (!filePath || typeof filePath !== "string") return null;
  const relFromRepo = path.relative(REPO_ROOT, filePath);
  try {
    const raw = execFileSync("git", ["show", `${gitRef}:${relFromRepo}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 同 key、en value 变更（改 defaultValue，未 rename key）。
 * 不含新增/删除的 key（新增走默认 backfill 补空；删除由 migrate 处理 rename）。
 */
function valueChangedKeys(oldEn, newEn) {
  const changed = new Set();
  if (!oldEn || !newEn) return changed;
  for (const key of sortedKeys(newEn)) {
    if (key in oldEn && oldEn[key] !== newEn[key]) {
      changed.add(key);
    }
  }
  return changed;
}

/** @deprecated 用 valueChangedKeys；保留给可能的外部引用 */
function staleKeysFromGit(sourcePath, source) {
  const previous = readJsonAtGitRef(sourcePath, "HEAD");
  return valueChangedKeys(previous, source);
}

/**
 * en 中 key 改名、value 不变：oldEn 删 key A，newEn 增 key B，且 A/B 的 en value 相同。
 * 仅 1:1 匹配时返回迁移对，避免歧义。
 */
function findRenameMigrations(oldEn, newEn) {
  if (!oldEn || !newEn) return [];

  const removed = Object.keys(oldEn).filter((key) => !(key in newEn));
  const added = Object.keys(newEn).filter((key) => !(key in oldEn));
  const migrations = [];
  const usedRemoved = new Set();

  for (const toKey of added) {
    const enValue = newEn[toKey];
    if (!isTranslatable(enValue)) continue;

    const candidates = removed.filter(
      (fromKey) => !usedRemoved.has(fromKey) && oldEn[fromKey] === enValue,
    );
    if (candidates.length !== 1) continue;

    const fromKey = candidates[0];
    usedRemoved.add(fromKey);
    migrations.push({ fromKey, toKey, enValue });
  }

  return migrations;
}

module.exports = {
  WEB_ROOT,
  REPO_ROOT,
  readJson,
  readJsonAtGitRef,
  isTranslatable,
  sortedKeys,
  staleKeysFromGit,
  valueChangedKeys,
  findRenameMigrations,
};
