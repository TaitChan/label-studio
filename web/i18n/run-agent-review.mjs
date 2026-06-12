#!/usr/bin/env node
/**
 * instrument 后 Cursor Agent 自动审 + 修 + yarn i18n:check；通过后默认 fix-extract
 *
 * 用法（在 web/ 目录）:
 *   yarn i18n:agent-review                              # 从 git 变更 auto-detect scope
 *   yarn i18n:agent-review -- --scope=pages/Home        # 显式指定 scope
 *
 * 环境变量:
 *   CURSOR_API_KEY — 仓库根 .env.local 或 web/.env 或进程环境
 */

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { Agent, CursorAgentError } from "@cursor/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
  formatModulesEnv,
  extractModulesEnv,
  appendModule,
  resolveRunModules,
  moduleRepoPath,
} = require("./config.cjs");
const WEB_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");
const REPORT_DIR = path.join(WEB_ROOT, ".quality-reports");

function loadEnvFiles() {
  for (const envPath of [
    path.join(REPO_ROOT, ".env.local"),
    path.join(WEB_ROOT, ".env"),
  ]) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key]) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const opts = {
    instrument: false,
    fixOnly: false,
    scope: "",
    scopeExplicit: false,
    model: "default",
    maxRetries: 2,
    skipCheck: false,
    noExtract: false,
    instrumentExtra: [],
    extractExtra: [],
  };

  const EXTRACT_FLAGS = new Set(["--no-backfill", "--no-migrate-keys", "--dry-run"]);

  for (const arg of argv) {
    if (arg === "--instrument") opts.instrument = true;
    else if (arg === "--fix-only") opts.fixOnly = true;
    else if (arg === "--skip-check") opts.skipCheck = true;
    else if (arg === "--no-extract") opts.noExtract = true;
    else if (arg.startsWith("--scope=")) {
      opts.scope = arg.slice("--scope=".length).trim().replace(/^\/+|\/+$/g, "");
      opts.scopeExplicit = true;
    } else if (arg.startsWith("--model=")) {
      opts.model = arg.slice("--model=".length).trim();
    } else if (arg.startsWith("--max-retries=")) {
      opts.maxRetries = Number(arg.slice("--max-retries=".length));
    } else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (EXTRACT_FLAGS.has(arg) || arg.startsWith("--namespace=") || arg.startsWith("--targets=")) {
      opts.extractExtra.push(arg);
    } else opts.instrumentExtra.push(arg);
  }

  return opts;
}

function showHelp() {
  console.log(`
Cursor Agent i18n 审阅（web/i18n/run-agent-review.mjs）

用法:
  yarn i18n:agent-review [options]

流程:
  仅审源码（instrument 已由 i18n:instrument 跑过）→ check 通过 → 默认 extract

选项:
  --instrument         先跑 fix-instrument.cjs
  --fix-only           传给 fix-instrument（仅后处理）
  --scope=pages/Home   显式审阅范围（合并 config.json modules 做 check/extract）
                       未传时从 git 变更 auto-detect，check 仅扫推断 scope
  --no-extract         check 通过后跳过 extract
  --model=default        Cursor 模型 id（默认 default；composer-2.5 偶发秒失败可换 default）
  --max-retries=2      check 失败后最多重试轮数
  --skip-check         不跑 check，也不自动 extract
  --help, -h           显示帮助

传给 fix-instrument：--no-prefix-keys 等。
传给 fix-extract：--no-backfill、--no-migrate-keys、--namespace= 等。

环境:
  CURSOR_API_KEY       必填；见仓库根 .env.local.example
`);
}

function runInstrument(opts) {
  const args = ["i18n/fix-instrument.cjs"];
  if (opts.fixOnly) args.push("--fix-only");
  if (opts.scope) args.push(`--scope=${opts.scope}`);
  args.push(...opts.instrumentExtra);
  console.log(`> node ${args.join(" ")} (cwd: web/)\n`);
  execFileSync("node", args, { cwd: WEB_ROOT, stdio: "inherit" });
}

function moduleSourceGlob(moduleId) {
  return moduleRepoPath(moduleId);
}

function collectGitDiff(modules) {
  const relPaths = modules.map((id) => moduleRepoPath(id));
  const maxDiffChars = 24_000;
  try {
    const diff = execFileSync(
      "git",
      ["diff", "--", ...relPaths],
      { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );
    if (diff.length <= maxDiffChars) return diff;
    return (
      diff.slice(0, maxDiffChars) +
      `\n\n… diff 已截断（${diff.length} 字符 > ${maxDiffChars}），请直接打开 scope 目录检查`
    );
  } catch {
    return "";
  }
}

function buildCheckModulesEnv(moduleRun) {
  return formatModulesEnv({
    envScope: process.env.I18N_EXTRACT_SCOPE,
    modules: moduleRun.modules,
    narrow: moduleRun.narrow,
  });
}

function runExtract(opts) {
  const args = ["i18n/fix-extract.cjs", ...opts.extractExtra];
  const extractScope = extractModulesEnv();
  const env = {
    ...process.env,
    I18N_EXTRACT_SCOPE: extractScope,
  };
  console.log(`\n> extract 全量 modules: I18N_EXTRACT_SCOPE=${extractScope}`);
  console.log(`> node ${args.join(" ")} (cwd: web/)\n`);
  execFileSync("node", args, { cwd: WEB_ROOT, stdio: "inherit", env });
}

function finishAfterCheck(moduleRun, opts, reportMeta) {
  writeReport(reportMeta);
  console.log("✓ yarn i18n:check 通过");

  if (opts.noExtract) {
    console.log("\n已跳过 extract（--no-extract）");
    process.exit(0);
  }

  for (const id of moduleRun.modules) {
    appendModule(id);
  }
  console.log(`\n📋 modules 已追加: [${moduleRun.modules.join(", ")}]（i18n/config.json）`);

  runExtract(opts);
  process.exit(0);
}

function runI18nCheck(moduleRun) {
  const env = {
    ...process.env,
    I18N_EXTRACT_SCOPE: buildCheckModulesEnv(moduleRun),
  };

  const result = spawnSync("yarn", ["i18n:check"], {
    cwd: WEB_ROOT,
    encoding: "utf8",
    shell: true,
    env,
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    output,
  };
}

const PROMPT_TEMPLATE_PATH = path.join(__dirname, "agent-review-prompt.txt");

function buildPrompt({ scopes, diff }) {
  const srcDirs = scopes.map((scope) => moduleRepoPath(scope));
  const scopeLabel = scopes.join(", ");
  const srcDirBlock =
    srcDirs.length === 1
      ? `\`${srcDirs[0]}/\``
      : srcDirs.map((dir) => `- \`${dir}/\``).join("\n");

  const template = fs.readFileSync(PROMPT_TEMPLATE_PATH, "utf8");
  const diffBlock =
    diff || "(无 diff — 请直接打开 scope 目录检查 instrument 结果)";

  return template
    .replace(/\{\{scope\}\}/g, scopeLabel)
    .replace(/\{\{srcDir\}\}/g, srcDirBlock)
    .replace(/\{\{diff\}\}/g, diffBlock)
    .trim();
}

async function streamAgentRun(agentRun) {
  console.log(`[run] id=${agentRun.id} requestId=${agentRun.requestId ?? "?"}\n`);
  for await (const event of agentRun.stream()) {
    if (event.type === "assistant") {
      for (const block of event.message.content) {
        if (block.type === "text") process.stdout.write(block.text);
      }
    } else if (event.type === "thinking") {
      process.stdout.write(event.text ?? "");
    } else if (event.type === "tool_call") {
      if (event.status === "running") {
        process.stdout.write(`\n[tool] ${event.name} …\n`);
      } else if (event.status === "completed") {
        process.stdout.write(`[tool] ${event.name} done\n`);
      } else if (event.status === "error") {
        process.stdout.write(`\n[tool] ${event.name} error`);
        if (event.result) process.stdout.write(`: ${String(event.result).slice(0, 500)}`);
        process.stdout.write("\n");
      }
    } else if (event.type === "error") {
      process.stdout.write(`\n[agent-error] ${event.message ?? JSON.stringify(event)}\n`);
    }
  }
  process.stdout.write("\n");
}

async function dumpRunFailure(agentRun, result) {
  const detail =
    result?.error ??
    result?.summary ??
    result?.result ??
    "(无详细错误；常见原因：模型不可用、API 超时、scope 过大。可试 --model=default 或缩小 --scope)";
  console.error(`  detail: ${detail}`);

  if (result?.result && result.result !== detail) {
    console.error(`  result: ${String(result.result).slice(0, 2000)}`);
  }
  if (result?.durationMs != null) {
    console.error(`  durationMs: ${result.durationMs}`);
  }
  if (agentRun.supports?.("conversation")) {
    try {
      const turns = await agentRun.conversation();
      const tail = turns.slice(-3);
      if (tail.length > 0) {
        console.error("  conversation (last turns):");
        console.error(JSON.stringify(tail, null, 2).slice(0, 4000));
      }
    } catch (err) {
      console.error(`  conversation: unavailable (${err.message})`);
    }
  }
}

function writeReport(meta) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const file = path.join(REPORT_DIR, `i18n-agent-review-${Date.now()}.json`);
  fs.writeFileSync(file, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  console.log(`报告: ${file}`);
  return file;
}

async function main() {
  loadEnvFiles();

  const rawArgv = process.argv.slice(2);
  if (rawArgv.includes("--instrument")) {
    rawArgv.splice(rawArgv.indexOf("--instrument"), 1);
  }
  const opts = parseArgs(rawArgv);
  const withInstrument =
    process.argv.includes("--instrument") &&
    process.env.npm_lifecycle_event !== "i18n:instrument";

  if (opts.help) {
    showHelp();
    process.exit(0);
  }

  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "缺少 CURSOR_API_KEY。复制仓库根 .env.local.example → .env.local 并填入 key。",
    );
    process.exit(1);
  }

  if (withInstrument) {
    runInstrument({ ...opts, instrument: true });
  }

  const moduleRun = resolveRunModules({
    repoRoot: REPO_ROOT,
    explicitModule: opts.scope,
    moduleExplicit: opts.scopeExplicit,
  });

  if (moduleRun.modules.length === 0) {
    console.error(
      "未能从 git 变更推断 scope（无 web/apps/labelstudio/src/pages|components、web/libs/* 改动）。\n" +
        "请显式指定，例如：yarn i18n:agent-review -- --scope=pages/CreateProject\n" +
        "datamanager 可用 shorthand：--scope=components/Filters 或全量 --scope=libs/datamanager\n" +
        "或：yarn i18n:agent-review -- --scope=libs/app-common",
    );
    process.exit(1);
  }

  if (moduleRun.source === "git") {
    console.log(`📍 auto-detect scope: [${moduleRun.modules.join(", ")}]（git 变更）`);
    console.log(`   check 仅扫上述 module；extract 仍用 config.json 全部 modules\n`);
  } else if (moduleRun.modules.some((id) => id.startsWith("libs/datamanager/"))) {
    console.log(`📍 scope 已归一化为 datamanager module id（libs/datamanager/components/...）\n`);
  }

  const diff = collectGitDiff(moduleRun.modules);
  const prompt = buildPrompt({ scopes: moduleRun.modules, diff });

  const agent = await Agent.create({
    apiKey,
    model: { id: opts.model },
    mode: "agent",
    name: `i18n-review-${moduleRun.modules.map((s) => s.replace(/\//g, "-")).join("-")}`,
    local: {
      cwd: REPO_ROOT,
      settingSources: ["project"],
      customTools: {
        i18n_check: {
          description:
            "Run `yarn i18n:check` in web/. Returns PASS/FAIL with full output.",
          async execute() {
            const check = runI18nCheck(moduleRun);
            return check.ok
              ? `PASS\n${check.output}`
              : `FAIL (exit ${check.status})\n${check.output}`;
          },
        },
      },
    },
  });

  try {
    let lastCheck = { ok: true, output: "" };

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      const message =
        attempt === 0
          ? prompt
          : [
              `yarn i18n:check 仍未通过（第 ${attempt} 次重试）。`,
              "继续修源码直到通过。",
              "",
              "```",
              lastCheck.output,
              "```",
            ].join("\n");

      const agentRun = await agent.send(message);
      await streamAgentRun(agentRun);
      const result = await agentRun.wait();

      if (result.status === "error") {
        console.error(`\n✗ Agent 运行失败 (runId=${result.id})`);
        if (result.error) console.error(`  error: ${result.error}`);
        if (result.summary) console.error(`  summary: ${result.summary}`);
        await dumpRunFailure(agentRun, result);
        const checkPreview = runI18nCheck(moduleRun);
        if (!checkPreview.ok) {
          console.error("\n当前 yarn i18n:check 仍未通过（可先手动修，再 extract）：");
          console.error(checkPreview.output.split("\n").slice(0, 15).join("\n"));
        }
        writeReport({
          agentId: agent.agentId,
          runId: result.id,
          requestId: result.requestId,
          status: "error",
          error:
            result.error ??
            result.summary ??
            result.result ??
            "Agent run failed without error message",
          model: opts.model,
          scope: moduleRun.modules.join(","),
          scopeSource: moduleRun.source,
        });
        console.error(
          "\n可重试: yarn i18n:agent-review -- --model=default --scope=" +
            moduleRun.modules.join(","),
        );
        console.error("或跳过 Agent: yarn i18n:check && yarn i18n:extract");
        process.exit(2);
      }

      if (result.status === "cancelled") {
        writeReport({
          agentId: agent.agentId,
          runId: result.id,
          status: "cancelled",
          scope: moduleRun.modules.join(","),
          scopeSource: moduleRun.source,
        });
        process.exit(2);
      }

      if (opts.skipCheck) {
        writeReport({
          agentId: agent.agentId,
          runId: result.id,
          status: "finished",
          skippedCheck: true,
          scope: moduleRun.modules.join(","),
          scopeSource: moduleRun.source,
        });
        console.log("\n已跳过 check 与 extract（--skip-check）");
        process.exit(0);
      }

      lastCheck = runI18nCheck(moduleRun);
      if (lastCheck.ok) {
        finishAfterCheck(moduleRun, opts, {
          agentId: agent.agentId,
          runId: result.id,
          requestId: result.requestId,
          status: "finished",
          attempts: attempt + 1,
          scope: moduleRun.modules.join(","),
          scopeSource: moduleRun.source,
          extract: !opts.noExtract,
        });
      }

      console.error(`✗ yarn i18n:check 失败 (attempt ${attempt + 1}/${opts.maxRetries + 1})`);
    }

    writeReport({
      agentId: agent.agentId,
      status: "check_failed",
      scope: moduleRun.modules.join(","),
      scopeSource: moduleRun.source,
      output: lastCheck.output,
    });
    console.error(lastCheck.output);
    process.exit(3);
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error(
        `SDK 启动失败: ${err.message} (retryable=${err.isRetryable})`,
      );
      if (err.requestId) console.error(`requestId=${err.requestId}`);
      process.exit(1);
    }
    throw err;
  } finally {
    await agent[Symbol.asyncDispose]();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
