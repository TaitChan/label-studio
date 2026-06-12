/**
 * i18n 配置与 module 范围（唯一入口：web/i18n/config.json → namespaces[]）
 *
 * 职责：
 *   1. 读写 config.json
 *   2. 从 namespaces 推导 module id、源码路径、namespace
 *   3. git auto-detect / instrument 的 module 合并与写回
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const WEB_ROOT = path.join(__dirname, "..");
const CONFIG_FILE = path.join(__dirname, "config.json");

let cachedConfig = null;

// ── config.json 读写 ─────────────────────────────────────────────

function fail(message) {
  throw new Error(`${path.relative(WEB_ROOT, CONFIG_FILE)}: ${message}`);
}

function dedupe(list) {
  const out = [];
  for (const entry of list || []) {
    const normalized = String(entry).trim().replace(/^\/+|\/+$/g, "");
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) fail("文件不存在");
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    if (!data?.initialModule) fail("缺少 initialModule");
    if (!Array.isArray(data.namespaces) || data.namespaces.length === 0) {
      fail("缺少 namespaces");
    }
    const namespaces = data.namespaces.map((ns) => {
      if (!ns.namespace || !ns.pathPrefix || !ns.root || !Array.isArray(ns.modules)) {
        fail(`namespaces 项不完整: ${JSON.stringify(ns)}`);
      }
      return {
        namespace: ns.namespace,
        pathPrefix: ns.pathPrefix,
        root: ns.root,
        modules: [...ns.modules],
      };
    });
    return { initialModule: data.initialModule, namespaces };
  } catch (err) {
    if (err.message.includes("config.json")) throw err;
    fail(`解析失败 — ${err.message}`);
  }
}

function loadConfig() {
  if (!cachedConfig) cachedConfig = readConfig();
  return cachedConfig;
}

function saveConfig(partial) {
  cachedConfig = null;
  const merged = { ...readConfig(), ...partial };
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  cachedConfig = merged;
  return merged;
}

function namespacesSorted() {
  return [...loadConfig().namespaces].sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);
}

// ── namespaces → module / 路径 / namespace ─────────────────────

function moduleId(ns, entry) {
  if (entry === "*") return ns.pathPrefix.replace(/\/$/, "");
  return `${ns.pathPrefix}${entry}`;
}

function loadModules() {
  const out = [];
  for (const ns of loadConfig().namespaces) {
    for (const entry of ns.modules) {
      const id = moduleId(ns, entry);
      if (!out.includes(id)) out.push(id);
    }
  }
  return out.length > 0 ? out : [loadConfig().initialModule];
}

function parseModuleId(moduleIdStr) {
  const normalized = String(moduleIdStr).trim().replace(/^\/+|\/+$/g, "");
  for (const ns of namespacesSorted()) {
    const bare = ns.pathPrefix.replace(/\/$/, "");
    if (ns.modules.includes("*") && normalized === bare) {
      return { ns, entry: "*" };
    }
    if (normalized.startsWith(ns.pathPrefix)) {
      return { ns, entry: normalized.slice(ns.pathPrefix.length) };
    }
  }
  return null;
}

function moduleToSrcPath(moduleIdStr) {
  const parsed = parseModuleId(moduleIdStr);
  if (!parsed) fail(`未知 module: ${moduleIdStr}`);
  if (parsed.entry === "*") return parsed.ns.root;
  return `${parsed.ns.root}/${parsed.entry}`;
}

function moduleAbsPath(moduleIdStr) {
  return path.join(WEB_ROOT, moduleToSrcPath(moduleIdStr));
}

function moduleRepoPath(moduleIdStr) {
  return `web/${moduleToSrcPath(moduleIdStr)}`;
}

function inferNamespace(srcRel) {
  for (const ns of namespacesSorted()) {
    if (srcRel.startsWith(ns.pathPrefix)) return ns.namespace;
  }
  return null;
}

function toSrcRelative(filePath, webRoot = WEB_ROOT) {
  const rel = path.relative(webRoot, filePath).replace(/\\/g, "/");
  const appSrc = getAppSrcRoot();
  if (rel.startsWith(`${appSrc}/`)) return rel.slice(appSrc.length + 1);
  return rel;
}

function getAppSrcRoot() {
  const pages = loadConfig().namespaces.find((ns) => ns.pathPrefix === "pages/");
  return pages ? pages.root.replace(/\/pages$/, "") : "apps/labelstudio/src";
}

function resolveModules(envScope = process.env.I18N_EXTRACT_SCOPE) {
  if (envScope) {
    return dedupe(String(envScope).split(","));
  }
  return loadModules();
}

function modulesToExtractGlobs(envScope = process.env.I18N_EXTRACT_SCOPE) {
  return resolveModules(envScope).map((id) => `${moduleToSrcPath(id)}/**/*.{ts,tsx,js,jsx}`);
}

function saveModules(flatIds) {
  const ids = dedupe(flatIds);
  const namespaces = loadConfig().namespaces.map((ns) => ({ ...ns, modules: [] }));

  for (const id of ids) {
    const parsed = parseModuleId(id);
    if (!parsed) continue;
    const target = namespaces.find((ns) => ns.namespace === parsed.ns.namespace);
    if (!target) continue;
    if (parsed.entry === "*") {
      if (!target.modules.includes("*")) target.modules.push("*");
    } else if (!target.modules.includes(parsed.entry)) {
      target.modules.push(parsed.entry);
    }
  }

  for (const ns of namespaces) {
    if (ns.modules.length === 0 && ns.pathPrefix.startsWith("libs/")) {
      ns.modules = ["*"];
    }
  }

  saveConfig({ namespaces });
  return loadModules();
}

// ── instrument / agent-review：合并范围、git 推断 ────────────────

function mergeModules(envScope, extra) {
  const merged = [...resolveModules(envScope)];
  for (const item of dedupe(String(extra || "").split(","))) {
    if (!merged.includes(item)) merged.push(item);
  }
  return merged;
}

/** check / Agent 审：可窄范围（git auto-detect 时 narrow=true） */
function formatModulesEnv({ envScope, modules, narrow = false }) {
  const list = dedupe(modules);
  if (narrow) return list.join(",");
  return mergeModules(envScope, list.join(",")).join(",");
}

/** extract：始终用 config.json 全部 modules，避免 removeUnusedKeys 误删其它 key */
function extractModulesEnv() {
  return loadModules().join(",");
}

function libNamesFromModules(modules = loadModules()) {
  return loadConfig()
    .namespaces
    .filter((ns) => ns.pathPrefix.startsWith("libs/"))
    .filter((ns) => modules.some((id) => parseModuleId(id)?.ns.namespace === ns.namespace))
    .map((ns) => ns.pathPrefix.replace(/^libs\//, "").replace(/\/$/, ""));
}

function namespaceForLib(libName) {
  const pathPrefix = `libs/${libName}/`;
  return loadConfig().namespaces.find((ns) => ns.pathPrefix === pathPrefix) ?? null;
}

/** 将 lib 内相对 root 的路径匹配到 config 里的 module entry（最长前缀）。 */
function matchLibModuleFromRelPath(ns, relFromRoot) {
  if (ns.modules.includes("*")) {
    return ns.pathPrefix.replace(/\/$/, "");
  }

  let bestEntry = null;
  for (const entry of ns.modules) {
    if (entry === "*") continue;
    if (relFromRoot === entry || relFromRoot.startsWith(`${entry}/`)) {
      if (!bestEntry || entry.length > bestEntry.length) bestEntry = entry;
    }
  }

  return bestEntry ? moduleId(ns, bestEntry) : null;
}

/**
 * 解析 module id：完整 id、shorthand（components/Filters）、或 libs/foo 展开为子 module 列表。
 */
function resolveModuleId(moduleIdStr) {
  const normalized = String(moduleIdStr).trim().replace(/^\/+|\/+$/g, "");
  if (!normalized) return null;

  // Shorthand（如 components/Filters）优先匹配 config.modules 条目，避免落到 apps/labelstudio/components/
  for (const ns of loadConfig().namespaces) {
    if (ns.modules.includes(normalized)) {
      return moduleId(ns, normalized);
    }
  }

  if (parseModuleId(normalized)) return normalized;

  return null;
}

/** 显式 scope / git detect 结果归一化为 config.json 中的 module id。 */
function normalizeRunModules(modules) {
  const out = [];

  const push = (id) => {
    if (!id || !parseModuleId(id) || out.includes(id)) return;
    out.push(id);
  };

  for (const raw of dedupe(modules)) {
    const normalized = String(raw).trim().replace(/^\/+|\/+$/g, "");
    if (!normalized) continue;

    const resolved = resolveModuleId(normalized);
    if (resolved) {
      push(resolved);
      continue;
    }

    const libOnly = normalized.match(/^libs\/([^/]+)$/);
    if (libOnly) {
      const ns = namespaceForLib(libOnly[1]);
      if (ns && !ns.modules.includes("*")) {
        for (const entry of ns.modules) {
          if (entry !== "*") push(moduleId(ns, entry));
        }
      } else if (ns) {
        push(ns.pathPrefix.replace(/\/$/, ""));
      }
      continue;
    }

    fail(`未知 module: ${normalized}`);
  }

  return out;
}

function detectModulesFromGit(repoRoot) {
  const files = new Set();
  const appPrefix = `web/${getAppSrcRoot()}/`;
  const libsPrefix = "web/libs/";
  const allowedLibs = libNamesFromModules();

  const addLines = (text) => {
    for (const line of (text || "").split("\n")) {
      const trimmed = line.trim().replace(/\\/g, "/");
      if (trimmed) files.add(trimmed);
    }
  };

  try {
    addLines(execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot, encoding: "utf8" }));
  } catch { /* 非 git 仓库 */ }

  try {
    addLines(
      execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: repoRoot, encoding: "utf8" }),
    );
  } catch { /* ignore */ }

  const modules = [];
  const addModule = (id) => {
    const resolved = resolveModuleId(id);
    if (resolved && !modules.includes(resolved)) modules.push(resolved);
  };

  for (const file of files) {
    if (file.startsWith(appPrefix)) {
      const match = file.slice(appPrefix.length).match(/^(pages|components)\/([^/]+)\//);
      if (!match) continue;
      addModule(`${match[1]}/${match[2]}`);
      continue;
    }

    if (!file.startsWith(libsPrefix)) continue;

    const libMatch = file.slice(libsPrefix.length).match(/^([^/]+)\//);
    if (!libMatch || !allowedLibs.includes(libMatch[1])) continue;

    const ns = namespaceForLib(libMatch[1]);
    if (!ns) continue;

    const rootPrefix = `web/${ns.root}/`;
    if (!file.startsWith(rootPrefix)) {
      if (ns.modules.includes("*")) addModule(ns.pathPrefix.replace(/\/$/, ""));
      continue;
    }

    const relFromRoot = file.slice(rootPrefix.length);
    const matched = matchLibModuleFromRelPath(ns, relFromRoot);
    if (matched) addModule(matched);
  }

  return modules;
}

/**
 * 解析 instrument / agent-review 的 module 范围。
 * 显式 --scope：合并 config 全部 modules；否则 git auto-detect（仅本次改动）。
 */
function resolveRunModules({ repoRoot, explicitModule, moduleExplicit }) {
  if (moduleExplicit && explicitModule) {
    return {
      modules: normalizeRunModules(String(explicitModule).split(",")),
      source: "explicit",
      narrow: false,
    };
  }
  return { modules: detectModulesFromGit(repoRoot), source: "git", narrow: true };
}

/** instrument / agent-review 成功后，把 module 写入 config.json（归一化 id，避免 shorthand 写错 namespace） */
function appendModule(moduleIdStr) {
  if (!moduleIdStr) return loadModules();
  const resolved = resolveModuleId(moduleIdStr) ?? moduleIdStr;
  const merged = mergeModules(undefined, resolved);
  const prev = loadModules();
  if (merged.length === prev.length && merged.every((id, i) => id === prev[i])) {
    return merged;
  }
  return saveModules(merged);
}

module.exports = {
  WEB_ROOT,
  loadModules,
  saveModules,
  resolveModules,
  mergeModules,
  formatModulesEnv,
  extractModulesEnv,
  moduleToSrcPath,
  moduleAbsPath,
  moduleRepoPath,
  modulesToExtractGlobs,
  inferNamespace,
  toSrcRelative,
  detectModulesFromGit,
  resolveRunModules,
  resolveModuleId,
  normalizeRunModules,
  appendModule,
  dedupe,
  get SOURCE_ROOT() {
    return getAppSrcRoot();
  },
};
