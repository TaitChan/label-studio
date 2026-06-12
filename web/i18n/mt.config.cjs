/**
 * Coze workflow 机翻回填配置：en locale JSON → 目标语言 locale JSON。
 *
 * 请在 web/.env 设置 COZE_API_KEY（不要提交到仓库）。
 * 可选：COZE_WORKFLOW_ID
 *
 * CLI 示例：yarn i18n:backfill --targets=zh,zh_tw
 *
 * Coze workflow 提示词见 coze-prompt.txt（每次 API 只处理一个 {{target}} 语言）。
 */
module.exports = {
  localesDir: "locales",
  sourceLang: "en",
  /** Coze workflow 的 {{source}} */
  sourceLabel: "英文",

  /**
   * locale 目录名 → Coze {{target}} 标签（一次请求只处理一个语言）。
   * 脚本会按 target 循环逐个调 API，不会把 "zh,zh_tw" 放在一次调用里。
   */
  targets: {
    zh: { label: "简体中文" },
    zh_tw: { label: "繁体中文" },
  },

  /** 未传 --targets 时的默认值 */
  defaultTargets: ["zh", "zh_tw"],

  coze: {
    apiUrl: "https://api.coze.cn/v1/workflow/stream_run",
    workflowId: process.env.COZE_WORKFLOW_ID,
    apiKey: process.env.COZE_API_KEY,
  },

  mtBatchSize: 25,
  mtDelayMs: 1000,
  /** 单批次 API 失败时的最大重试次数（含输出条数不匹配） */
  mtMaxRetries: 3,
  /** 重试间隔（毫秒） */
  mtRetryDelayMs: 2000,
};
