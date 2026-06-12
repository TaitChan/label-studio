#!/usr/bin/env node
/**
 * Label Studio 前端 i18n 强门禁校验脚本。
 *
 * 校验项：
 *   1. 每个 t() / i18next.t() / translate() 调用都必须带 defaultValue
 *   2. useTranslation() 必须显式带 namespace（按路径推断，见 config.cjs）
 *   3. locales/en/*.json 不允许空字符串 value
 *   4. 三元表达式不得一侧硬编码 UI 文案、另一侧 t()
 *   5. <Trans> defaults 中 <N> 索引不得超过 components 数量
 *   6. 已 instrument 文件中的 aria-label / placeholder / title / alt / label / term 不得裸英文字面量
 *   7. UI 属性 JSX 表达式（title={...}）内不得裸英文字面量；三元 undefined/null 分支同理
 *   8. 已 instrument 文件中 <p>/<span> 等标签内不得残留裸英文段落/句子
 *   9. 已 instrument 文件中模块级 .title / .menuItem 不得裸英文字面量（侧边栏/页面标题）
 *  10. api.invoke 等方法调用的 API 标识符不得包 t() / i18next.t()
 *  11. 路由 path 配置不得包 t() / i18next.t()
 *  12. Tailwind / className 类名不得包 t() / i18next.t()
 *  13. 同一行不得出现 `;import`（i18next-cli instrument 粘连，应用 fix-only 拆行）
 *  14. instrument 误生成的无效 <Trans>（内联 <a>/<i> 被压成乱码 i18nKey）
 *  15. 不应翻译的内容不得包 t()：键盘码、date-fns 格式串、srcSet、=== 比较用技术标识、
 *      .replace 等字符串解析、仅 {{dateFormat}} 类技术变量拼接
 *  16. 模块顶层初始化（如 export const X = [...DateFields()]）调用的函数内不得使用 React hooks
 *  17. 相对路径 import/require 必须能解析到真实文件（避免 dm-column-i18n 等路径层级错误）
 *  18. i18next.t('appCommon.*' | 'datamanager.*') 必须显式带 ns，否则 extract 会写入 labelstudio.json
 *  19. i18next.t 的 ns 必须在 options 对象内（不得出现 `ns: "…", {` 语法）
 *
 * 用法（在 web/ 目录执行）：
 *   yarn i18n:check
 *   I18N_EXTRACT_SCOPE=pages/Home,components/Menubar yarn i18n:check
 *   node i18n/check-quality.cjs --json
 */

const fs = require("fs");
const path = require("path");

const { inferNamespace, toSrcRelative, modulesToExtractGlobs, resolveModules } = require("./config.cjs");

const WEB_ROOT = path.join(__dirname, "..");

const EXTRACT_IGNORE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/__tests__/**",
  "apps/labelstudio-e2e/**",
  "apps/playground/**",
  "libs/frontend-test/**",
  "libs/storybook/**",
];

/** 仅匹配函数调用，不用裸 \bt（会误命中 toClassName、title 等） */
const CALLEE_PATTERNS = [/\bi18next\.t\s*\(/g, /(?<![.\w$])t\s*\(/g, /\btranslate\s*\(/g];

const EN_LOCALE_DIR = path.join(WEB_ROOT, "locales/en");

const T_CALL_RE = /(?:i18next\.t|(?<![.\w$])t)\s*\(/;
const HARD_THEN_T_RE =
  /\?\s*["']([^"']{2,})["']\s*:\s*(?:i18next\.t|(?<![.\w$])t)\s*\(/;
const T_THEN_HARD_RE =
  /\?\s*(?:i18next\.t|(?<![.\w$])t)\s*\([^)]*\)\s*:\s*["']([^"']{2,})["']/;
const HARD_THEN_NULL_RE =
  /\?\s*["']([^"']{2,})["']\s*:\s*(?:undefined|null)\b/;
const NULL_THEN_HARD_RE =
  /\?\s*(?:undefined|null)\s*:\s*["']([^"']{2,})["']/;
const UI_ATTR_RE =
  /(?<![.\w$])(aria-label|placeholder|title|alt|label|term)\s*=\s*["']([A-Za-z][^"']{1,})["']/g;
const UI_ATTR_EXPR_RE =
  /(?<![.\w$])(aria-label|placeholder|title|alt|label|term)\s*=\s*\{/g;
const INLINE_BARE_JSX_TEXT_RE = />([A-Za-z][^<>{]{19,})</g;
const UI_CONTAINER_TAGS =
  "p|span|header|footer|li|dt|dd|label|h[1-6]|button|b|strong|td|th";
const MODULE_UI_PROP_RE =
  /\b([A-Z][\w$]*)\.(title|menuItem)\s*=\s*["']([A-Za-z][^"']*)["']/g;

function findBalancedBraceEnd(source, openIndex) {
  if (source[openIndex] !== "{") return -1;
  let depth = 0;
  let inStr = null;

  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (ch === inStr && source[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findTransBlockEnd(source, start) {
  let braceDepth = 0;
  let bracketDepth = 0;
  let inStr = null;

  for (let i = start + 6; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (ch === inStr && source[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth--;
    else if (ch === "[") bracketDepth++;
    else if (ch === "]") bracketDepth--;

    if (
      braceDepth === 0 &&
      bracketDepth === 0 &&
      source.slice(i, i + 2) === "/>"
    ) {
      return i + 2;
    }
    if (
      braceDepth === 0 &&
      bracketDepth === 0 &&
      source.slice(i, i + 8) === "</Trans>"
    ) {
      return i + 8;
    }
  }
  return -1;
}

function collectTransBlocks(source) {
  const blocks = [];
  let idx = 0;

  while (idx < source.length) {
    const start = source.indexOf("<Trans", idx);
    if (start === -1) break;
    const end = findTransBlockEnd(source, start);
    if (end === -1) break;
    blocks.push({ start, text: source.slice(start, end) });
    idx = end;
  }

  return blocks;
}

function extractComponentsExpr(block) {
  const marker = block.indexOf("components");
  if (marker === -1) return null;
  const braceStart = block.indexOf("{", marker);
  if (braceStart === -1) return null;
  const braceEnd = findBalancedBraceEnd(block, braceStart);
  if (braceEnd === -1) return null;
  return block.slice(braceStart + 1, braceEnd);
}

function looksLikeUiEnglish(text) {
  if (!text || !/[A-Za-z]/.test(text)) return false;
  if (/^https?:\/\//i.test(text)) return false;
  if (/^[\d\s.%+-]+$/.test(text)) return false;
  if (/^[a-z]+$/i.test(text) && text.length <= 3) return false;
  return true;
}

function countBracketArrayItems(arrayText) {
  const open = arrayText.indexOf("[");
  if (open === -1) return 0;

  let depth = 0;
  let items = 0;
  let hasItem = false;

  for (let i = open + 1; i < arrayText.length; i++) {
    const ch = arrayText[i];
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      if (ch === "]" && depth === 0) break;
      depth--;
    } else if (ch === "," && depth === 0) {
      items++;
    } else if (depth === 0 && !/\s/.test(ch)) {
      hasItem = true;
    }
  }

  return items + (hasItem ? 1 : 0);
}

function extractTransAttr(block, attr) {
  const quoted = new RegExp(`\\b${attr}\\s*=\\s*["']([^"']*)["']`);
  const brace = new RegExp(`\\b${attr}\\s*=\\s*\\{["']([^"']*)["']\\}`);
  return quoted.exec(block)?.[1] ?? brace.exec(block)?.[1] ?? null;
}

function maxTransTagIndex(defaults) {
  const tags = [...defaults.matchAll(/<(\d+)>/g)];
  if (tags.length === 0) return -1;
  return Math.max(...tags.map((m) => parseInt(m[1], 10)));
}

function fileUsesI18n(source) {
  return (
    /\buseTranslation\s*\(/.test(source) ||
    /\bi18next\.t\s*\(/.test(source) ||
    T_CALL_RE.test(source)
  );
}

function looksLikeJsxSentence(text) {
  if (!looksLikeUiEnglish(text)) return false;
  if (/\s/.test(text)) return true;
  return text.length >= 28;
}

function isLikelyCodeLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (
    /^(import|export|const|let|var|return|if|else|case|default|\/\/|\/\*|\*|@|type|interface|enum)\b/.test(
      trimmed,
    )
  ) {
    return true;
  }
  if (/[;{}()=]|=>|::|\?\?|\|\||&&/.test(trimmed)) return true;
  if (/:\s*(number|string|boolean|void|any|unknown|never)\b/.test(trimmed)) return true;
  if (/\w\.[a-zA-Z_$]/.test(trimmed)) return true;
  if (
    /^(className|onClick|onChange|onSubmit|onPointer|type|key|style|disabled|checked|value|name|id|href|target|rel|htmlFor|aria-|data-|set[A-Z])/.test(
      trimmed,
    )
  ) {
    return true;
  }
  return false;
}

function isBareUiTextLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 16) return false;
  if (isLikelyCodeLine(line)) return false;
  if (/[{<>]|(?:i18next\.t|(?<![.\w$])t)\s*\(|<Trans\b|useTranslation/.test(line)) {
    return false;
  }
  if (!/^([A-Z][a-zA-Z]*|[a-z]{3,})\s/.test(trimmed)) return false;
  return looksLikeJsxSentence(trimmed);
}

function pushTernaryHardLiteralIssue(issues, filePath, lineNo, lineText, literal, variant) {
  const messages = {
    "hard-t": "三元表达式一侧硬编码 UI 文案、另一侧 t()；两侧都应 t() 或合并为一个 key",
    "t-hard": "三元表达式一侧 t()、另一侧硬编码 UI 文案；两侧都应 t() 或合并为一个 key",
    "hard-null":
      '三元表达式硬编码 UI 文案、另一侧 undefined/null；应改为 t(..., { defaultValue: "..." })',
    "null-hard":
      '三元表达式 undefined/null、另一侧硬编码 UI 文案；应改为 t(..., { defaultValue: "..." })',
  };
  issues.push({
    file: filePath,
    line: lineNo,
    col: lineText.indexOf(literal) + 1,
    key: literal,
    rule: "mixed-ternary-i18n",
    message: messages[variant],
  });
}

function findMixedTernaryIssues(source, filePath) {
  if (!fileUsesI18n(source)) return [];

  const issues = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const patterns = [
      [HARD_THEN_T_RE, "hard-t"],
      [T_THEN_HARD_RE, "t-hard"],
      [HARD_THEN_NULL_RE, "hard-null"],
      [NULL_THEN_HARD_RE, "null-hard"],
    ];

    for (const [re, variant] of patterns) {
      const hit = line.match(re);
      if (hit && looksLikeUiEnglish(hit[1])) {
        pushTernaryHardLiteralIssue(issues, filePath, i + 1, line, hit[1], variant);
      }
    }
  }

  return issues;
}

function findTransIndexIssues(source, filePath) {
  if (!/<Trans\b/.test(source)) return [];

  const issues = [];

  for (const { start, text: block } of collectTransBlocks(source)) {
    const defaults = extractTransAttr(block, "defaults");
    if (!defaults) continue;

    const maxTag = maxTransTagIndex(defaults);
    if (maxTag < 0) continue;

    const componentsInner = extractComponentsExpr(block);
    const componentCount = componentsInner
      ? countBracketArrayItems(componentsInner.trim())
      : 0;

    if (componentCount === 0) continue;

    if (maxTag >= componentCount) {
      const pos = lineColAt(source, start);
      issues.push({
        file: filePath,
        line: pos.line,
        col: pos.col,
        key: `maxTag=${maxTag}, components=${componentCount}`,
        rule: "trans-tag-mismatch",
        message: `<Trans> defaults 使用 <${maxTag}> 但 components 仅 ${componentCount} 项（索引从 0 起，应改为 <${Math.max(0, componentCount - 1)}> 或补齐 components）`,
      });
    }
  }

  return issues;
}

function findBareUiAttributeIssues(source, filePath) {
  if (!fileUsesI18n(source)) return [];

  const issues = [];
  const clean = stripComments(source);
  UI_ATTR_RE.lastIndex = 0;
  let match;

  while ((match = UI_ATTR_RE.exec(clean)) !== null) {
    const value = match[2];
    if (!looksLikeUiEnglish(value)) continue;

    const before = clean.slice(Math.max(0, match.index - 40), match.index);
    if (/\{[^}]*$/.test(before) || /\bt\s*\($/.test(before)) continue;

    const pos = lineColAt(source, match.index);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: value,
      rule: "bare-ui-attribute",
      message: `${match[1]} 仍为裸英文字面量，应改为 t(..., { defaultValue: "..." })`,
    });
  }

  return issues;
}

function findBareUiAttributeExprIssues(source, filePath) {
  if (!fileUsesI18n(source)) return [];

  const issues = [];
  const clean = stripComments(source);
  UI_ATTR_EXPR_RE.lastIndex = 0;
  let match;

  while ((match = UI_ATTR_EXPR_RE.exec(clean)) !== null) {
    const braceStart = clean.indexOf("{", match.index);
    if (braceStart === -1) continue;
    const braceEnd = findBalancedBraceEnd(clean, braceStart);
    if (braceEnd === -1) continue;

    const expr = clean.slice(braceStart + 1, braceEnd);
    if (/(?:i18next\.t|(?<![.\w$])t)\s*\(/.test(expr)) continue;

    const stringLiterals = [...expr.matchAll(/["']([^"']{8,})["']/g)].map((m) => m[1]);
    if (
      stringLiterals.length > 0 &&
      stringLiterals.every((value) => looksLikeDateFnsFormat(value) || looksLikeSrcSet(value))
    ) {
      continue;
    }

    for (const lit of expr.matchAll(/["']([^"']{8,})["']/g)) {
      const value = lit[1];
      if (looksLikeDateFnsFormat(value)) continue;
      if (looksLikeSrcSet(value)) continue;
      if (!looksLikeUiEnglish(value)) continue;
      const pos = lineColAt(source, braceStart + 1 + lit.index);
      issues.push({
        file: filePath,
        line: pos.line,
        col: pos.col,
        key: value,
        rule: "bare-ui-attribute-expr",
        message: `${match[1]}={...} 含裸 UI 英文字面量，应改为 t(..., { defaultValue: "..." })`,
      });
      break;
    }
  }

  return issues;
}

function findBareJsxTextIssues(source, filePath) {
  if (!fileUsesI18n(source)) return [];

  const issues = [];
  const clean = stripComments(source);
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isBareUiTextLine(line)) continue;

    const text = line.trim();
    issues.push({
      file: filePath,
      line: i + 1,
      col: line.indexOf(text) + 1,
      key: text.slice(0, 60),
      rule: "bare-jsx-text",
      message:
        "JSX 内残留裸英文句子/段落，应改为 t() / <Trans>（含多 <p> 相邻、内联链接场景）",
    });
  }

  INLINE_BARE_JSX_TEXT_RE.lastIndex = 0;
  let inlineMatch;
  while ((inlineMatch = INLINE_BARE_JSX_TEXT_RE.exec(clean)) !== null) {
    const text = inlineMatch[1].trim();
    if (!looksLikeJsxSentence(text)) continue;

    const before = clean.slice(Math.max(0, inlineMatch.index - 30), inlineMatch.index);
    const tagMatch = before.match(new RegExp(`<(${UI_CONTAINER_TAGS})\\b[^>]*$`, "i"));
    if (!tagMatch) continue;

    const pos = lineColAt(source, inlineMatch.index + 1);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: text.slice(0, 60),
      rule: "bare-jsx-text",
      message: `<${tagMatch[1]}> 内残留裸英文，应改为 t() / <Trans>`,
    });
  }

  return issues;
}

function findBareModuleUiPropertyIssues(source, filePath) {
  if (!fileUsesI18n(source)) return [];

  const issues = [];
  const clean = stripComments(source);
  MODULE_UI_PROP_RE.lastIndex = 0;
  let match;

  while ((match = MODULE_UI_PROP_RE.exec(clean)) !== null) {
    const component = match[1];
    const prop = match[2];
    const value = match[3];
    if (!looksLikeUiEnglish(value)) continue;

    const pos = lineColAt(source, match.index);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: value,
      rule: "bare-module-ui-property",
      message: `${component}.${prop} 仍为裸英文字面量，应改为 i18next.t(..., { defaultValue: "..." })（侧边栏/页面标题）`,
    });
  }

  return issues;
}

const API_INVOKE_T_RE = /\.invoke\s*\(\s*(?:i18next\.t|(?<![.\w$])t)\s*\(/g;

function findApiInvokeI18nIssues(source, filePath) {
  const issues = [];
  const clean = stripComments(source);
  API_INVOKE_T_RE.lastIndex = 0;
  let match;

  while ((match = API_INVOKE_T_RE.exec(clean)) !== null) {
    const pos = lineColAt(source, match.index);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: "api.invoke",
      rule: "api-invoke-i18n",
      message: "api.invoke 第一个参数是 API 方法名，应保持字符串字面量，不要包 t() / i18next.t()",
    });
  }

  return issues;
}

const ROUTE_PATH_T_RE = /\bpath\s*:\s*(?:i18next\.t|(?<![.\w$])t)\s*\(/g;

function findRoutePathI18nIssues(source, filePath) {
  const issues = [];
  const clean = stripComments(source);
  ROUTE_PATH_T_RE.lastIndex = 0;
  let match;

  while ((match = ROUTE_PATH_T_RE.exec(clean)) !== null) {
    const pos = lineColAt(source, match.index);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: "path",
      rule: "route-path-i18n",
      message: "路由 path 是 URL 模式，应保持字符串/模板字面量，不要包 t() / i18next.t()",
    });
  }

  return issues;
}

const T_CLASS_VALUE_RES = [
  /(?:i18next\.t|(?<![.\w$])t)\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/g,
  /(?:i18next\.t|(?<![.\w$])t)\s*\([^)]*\bdefaultValue\s*:\s*['"]([^'"]+)['"]/g,
];

function looksLikeTailwindClassString(value) {
  const text = String(value).trim();
  if (!/\b(bg|text|border)-[\w-]+/.test(text)) return false;
  const tokens = text.split(/\s+/);
  return tokens.length >= 2
    ? tokens.every((token) => /^(?:[a-z][\w-]*|(?:bg|text|border)-[\w-]+)$/.test(token))
    : /^(?:bg|text|border)-[\w-]+$/.test(text);
}

/** Tailwind 任意值、instrument 误包的 {{val}} w-[…] 等 */
function looksLikeClassNameString(value) {
  const text = String(value).trim();
  if (looksLikeTailwindClassString(text)) return true;
  if (/\b(?:w|h|min-w|max-w|min-h|max-h)-\[[^\]]+\]/.test(text)) return true;
  if (/^\{\{[\w]+\}\}\s+\S/.test(text) && /\[[^\]]+\]/.test(text)) return true;
  return false;
}

function findTailwindClassI18nIssues(source, filePath) {
  const issues = [];
  const clean = stripComments(source);

  for (const pattern of T_CLASS_VALUE_RES) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(clean)) !== null) {
      const value = match[1];
      if (!looksLikeClassNameString(value)) continue;
      const pos = lineColAt(source, match.index);
      issues.push({
        file: filePath,
        line: pos.line,
        col: pos.col,
        key: value.slice(0, 60),
        rule: "tailwind-class-i18n",
        message: "Tailwind / className 类名应保持字符串字面量，不要包 t() / i18next.t()",
      });
    }
  }

  return issues;
}

function stripComments(source) {
  let out = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (source[i] === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += source[i++];
  }
  return out;
}

function lineColAt(source, index) {
  const before = source.slice(0, index);
  const lines = before.split("\n");
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

function scanStringLiteral(source, start) {
  const quote = source[start];
  if (quote !== '"' && quote !== "'" && quote !== "`") return null;
  let i = start + 1;
  let value = "";
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      value += source[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (ch === quote) {
      return { value, end: i + 1, isTemplate: quote === "`" };
    }
    if (quote === "`" && ch === "$" && source[i + 1] === "{") {
      return { value: "", end: i, isTemplate: true, hasInterpolation: true };
    }
    value += ch;
    i++;
  }
  return null;
}

function findFirstArgEnd(argsText, start) {
  let depth = 0;
  let inStr = null;
  let i = start;
  while (i < argsText.length) {
    const ch = argsText[i];
    if (inStr) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === inStr) inStr = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      i++;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    if (ch === ")" || ch === "}" || ch === "]") depth--;
    if (ch === "," && depth === 0) return i;
    i++;
  }
  return argsText.length;
}

function findBalancedParenEnd(source, openIndex) {
  let depth = 0;
  let inStr = null;
  let i = openIndex;
  while (i < source.length) {
    const ch = source[i];
    if (inStr) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === inStr) inStr = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      i++;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function findTCalls(source, filePath) {
  const issues = [];
  const clean = stripComments(source);
  const callStarts = new Set();

  for (const pattern of CALLEE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(clean)) !== null) {
      callStarts.add(match.index);
    }
  }

  for (const calleeStart of [...callStarts].sort((a, b) => a - b)) {
    const openParen = clean.indexOf("(", calleeStart);
    const closeParen = findBalancedParenEnd(clean, openParen);
    if (closeParen === -1) continue;

    const argsText = clean.slice(openParen + 1, closeParen).trim();
    const firstNonWs = argsText.search(/\S/);
    if (firstNonWs === -1) continue;

    const firstArgEnd = findFirstArgEnd(argsText, firstNonWs);
    const optionsText = argsText.slice(firstArgEnd).trim();
    const hasDefaultValue =
      /^,/.test(optionsText) && /\bdefaultValue\s*:/.test(optionsText);

    if (hasDefaultValue) continue;

    const keyLit = scanStringLiteral(argsText, firstNonWs);
    const keyLabel =
      keyLit && !keyLit.hasInterpolation ? keyLit.value : "(dynamic)";
    const pos = lineColAt(source, calleeStart);

    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: keyLabel,
      rule: "require-defaultValue",
      message: 't() 选项缺少 defaultValue（例如 { defaultValue: "English text" }）',
    });
  }

  return issues;
}

function resetCalleePatterns() {
  for (const pattern of CALLEE_PATTERNS) pattern.lastIndex = 0;
}

function findUseTranslationIssues(source, filePath) {
  const issues = [];
  const srcRel = toSrcRelative(path.join(WEB_ROOT, filePath), WEB_ROOT);
  const expectedNs = inferNamespace(srcRel);
  if (!expectedNs || !/useTranslation\s*\(/.test(source)) return issues;

  const clean = stripComments(source);
  const re = /useTranslation\s*\(([\s\S]*?)\)/g;
  let match;

  while ((match = re.exec(clean)) !== null) {
    const inner = match[1].trim();
    const pos = lineColAt(source, match.index);

    if (!inner) {
      issues.push({
        file: filePath,
        line: pos.line,
        col: pos.col,
        key: "",
        rule: "require-useTranslation-namespace",
        message: `useTranslation() 缺少 namespace，应为 useTranslation("${expectedNs}")；可执行 yarn i18n:instrument -- --fix-only`,
      });
      continue;
    }

    if (inner.startsWith("[") || inner.startsWith("{")) continue;

    const quoted = inner.match(/^['"]([^'"]+)['"]$/);
    if (!quoted) continue;

    if (quoted[1] !== expectedNs) {
      issues.push({
        file: filePath,
        line: pos.line,
        col: pos.col,
        key: quoted[1],
        rule: "require-useTranslation-namespace",
        message: `useTranslation("${quoted[1]}") 与路径推断的 namespace "${expectedNs}" 不一致`,
      });
    }
  }

  return issues;
}

function globToFiles(pattern) {
  const extMatch = pattern.match(/\{([^}]+)\}/);
  const exts = extMatch
    ? extMatch[1].split(",").map((e) => e.trim().replace(/^\./, ""))
    : null;
  const base = pattern.replace(/\/\*\*\/\*\.\{[^}]+\}$/, "").replace(/^\*\*\//, "");
  const absBase = path.join(WEB_ROOT, base);

  if (!pattern.includes("**")) {
    const p = path.join(WEB_ROOT, pattern);
    return fs.existsSync(p) ? [p] : [];
  }

  const results = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      const rel = path.relative(WEB_ROOT, p).replace(/\\/g, "/");
      if (shouldIgnore(rel)) continue;
      if (ent.isDirectory()) walk(p);
      else if (matchesExt(ent.name, exts)) results.push(p);
    }
  }
  walk(absBase);
  return results;
}

function matchesExt(name, exts) {
  if (!exts) return true;
  return exts.some((ext) => name.endsWith(`.${ext}`));
}

function shouldIgnore(relPath) {
  return EXTRACT_IGNORE.some((pat) => {
    const re = new RegExp(
      "^" +
        pat
          .replace(/\*\*/g, ".*")
          .replace(/\*/g, "[^/]*")
          .replace(/\./g, "\\.") +
        "$",
    );
    return re.test(relPath) || relPath.includes("node_modules");
  });
}

function collectSourceFiles() {
  const patterns = modulesToExtractGlobs();
  const files = new Set();
  for (const pattern of patterns) {
    for (const f of globToFiles(pattern)) files.add(f);
  }
  return [...files].sort();
}

function checkEnLocales() {
  const issues = [];
  if (!fs.existsSync(EN_LOCALE_DIR)) return issues;

  const localePaths = fs
    .readdirSync(EN_LOCALE_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(EN_LOCALE_DIR, file));

  for (const localePath of localePaths) {
    const data = JSON.parse(fs.readFileSync(localePath, "utf8"));
    for (const [key, value] of Object.entries(data)) {
      if (value === "") {
        issues.push({
          file: localePath,
          line: 0,
          key,
          rule: "en-empty-value",
          message: "en locale 存在空字符串（补齐 defaultValue 后执行 yarn i18n:extract）",
        });
      }
    }
  }
  return issues;
}

/** i18next-cli instrument 把内联 <a>/<i> 压成乱码 i18nKey 的 <Trans>（无 defaults/components） */
function isInstrumentGarbageTransKey(key) {
  if (!key) return false;
  if (key.startsWith("aHref")) return true;
  if (/^[0-9][A-Za-z]{10,}/.test(key)) return true;
  if (/Target_blank|Relnoreferrer|Classname|Onclick|Seenbsp|Thenbsp|Idata|Ibatch|Iactions/i.test(key)) {
    return true;
  }
  if (!key.includes(".") && key.length > 35 && /href/i.test(key)) return true;
  return false;
}

function findBrokenInstrumentTransIssues(source, filePath) {
  if (!/<Trans\b/.test(source)) return [];

  const issues = [];

  for (const { start, text: block } of collectTransBlocks(source)) {
    const i18nKey = extractTransAttr(block, "i18nKey");
    if (!i18nKey || !isInstrumentGarbageTransKey(i18nKey)) continue;

    const pos = lineColAt(source, start);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: i18nKey.slice(0, 60),
      rule: "broken-instrument-trans",
      message:
        "instrument 误把内联 <a>/<i> 包成无效 <Trans>（乱码 i18nKey）；改为 t()+<a> 或 Trans defaults+components；可 yarn i18n:instrument -- --fix-only 自动去壳",
    });
  }

  return issues;
}

/** date-fns format 占位符（避免把 Let's 里的 s、Delete 等误判） */
const DATE_FNS_FORMAT_TOKENS =
  /\b(?:Y{4}|Y{2}|M{1,4}|D{1,4}|d{1,4}|H{1,2}|h{1,2}|mm|ss|SSS|aaa)\b/gi;

const UNAMBIGUOUS_KEYBOARD_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
]);

const AMBIGUOUS_KEYBOARD_CODES = new Set([
  "Enter",
  "Escape",
  "Backspace",
  "Delete",
  "Tab",
  "Space",
  "Home",
  "End",
  "Meta",
  "Control",
  "Alt",
  "Shift",
]);

const TECH_INTERP_VAR_NAMES = new Set([
  "dateFormat",
  "timeFormat",
  "format",
  "finalFormat",
  "x1",
  "x2",
  "path",
  "val",
  "method",
  "key",
  "type",
  "id",
  "name",
  "code",
]);

const TECHNICAL_JSX_PROPS = new Set([
  "srcSet",
  "triggerClassName",
  "className",
  "style",
  "type",
  "key",
  "value",
  "name",
  "htmlFor",
  "rel",
  "target",
  "method",
  "encType",
]);

function parseDefaultValueFromArgs(argsText) {
  const idx = argsText.search(/\bdefaultValue\s*:/);
  if (idx === -1) return null;
  let i = argsText.indexOf(":", idx) + 1;
  while (i < argsText.length && /\s/.test(argsText[i])) i++;
  const lit = scanStringLiteral(argsText, i);
  if (!lit || lit.hasInterpolation) return null;
  return lit.value;
}

function parseKeyFromArgs(argsText) {
  const trimmed = argsText.trim();
  const lit = scanStringLiteral(trimmed, trimmed.search(/\S/));
  return lit?.value ?? "";
}

function detectTCallContext(before) {
  const propMatch = before.match(
    /\b(srcSet|triggerClassName|className|style|type|key|value|name|htmlFor|rel|target|method|encType)\s*=\s*\{?\s*$/,
  );
  const isCompare = /(?:===|==|!==|!=)\s*$/.test(before);
  const isReplace = /\.(?:replace|split|startsWith|endsWith|includes|indexOf|match)\s*\(\s*$/.test(before);
  const inArray = /(?:allowedKeys|KEYS|CODES)\s*=\s*\[|\[\s*[^,\]]*$/.test(before) || /,\s*$/.test(before.slice(-24));
  const isConstSentinel =
    /(?:const|let|var)\s+[A-Z_][\w]*\s*=\s*$/.test(before) &&
    /PASSWORD|PROTECTED|SENTINEL|FORMAT|_KEY|allowedKeys/i.test(before);
  const isFormatVar =
    /(?:finalFormat|dateFormat|timeFormat|format)\s*=\s*$/.test(before) ||
    /(?:finalFormat|dateFormat|timeFormat|format)\s*\?\s*$/.test(before);

  return {
    prop: propMatch?.[1] ?? null,
    isCompare,
    isReplace,
    inArray,
    isConstSentinel,
    isFormatVar,
    isKeyCompare: /\.key\s*(?:===|==|!==|!=)\s*$/.test(before),
  };
}

function looksLikeDateFnsFormat(value) {
  const text = String(value).trim();
  if (
    /^\{\{(dateFormat|timeFormat|format|finalFormat)\}\}(\s+\{\{(dateFormat|timeFormat|format|finalFormat)\}\})?$/.test(
      text,
    )
  ) {
    return true;
  }
  if (text.length > 48) return false;
  const withoutTokens = text.replace(DATE_FNS_FORMAT_TOKENS, " ").replace(/[\s./\-:T]/g, " ");
  if (/\b[a-z]{4,}\b/i.test(withoutTokens)) return false;
  const tokens = text.match(DATE_FNS_FORMAT_TOKENS);
  if (!tokens || tokens.length < 2) return false;
  if (!/[.\-/:]/.test(text)) return false;
  const remainder = text.replace(DATE_FNS_FORMAT_TOKENS, "").replace(/[\s./\-:T]/g, "");
  return remainder.length <= 2;
}

function looksLikeSrcSet(value) {
  const text = String(value).trim();
  return (
    /\{\{x[12]\}\}/.test(text) ||
    /\b\d+\s+\d+x\s*,\s*\{\{/.test(text) ||
    /\{\{[^}]+\}\}\s+\d+x\s*,\s*\{\{/.test(text)
  );
}

function looksLikeTechnicalIdentifier(value) {
  const text = String(value).trim();
  return /^[A-Z][a-zA-Z0-9_]*$/.test(text) && text.length >= 4;
}

function isInterpolationOnlyTechnical(defaultValue) {
  const text = String(defaultValue).trim();
  const matches = [...text.matchAll(/\{\{(\w+)\}\}/g)];
  if (matches.length === 0) return false;
  const remainder = text.replace(/\{\{\w+\}\}/g, "").trim();
  if (remainder && !/^[\s,./>|:-]*$/.test(remainder)) return false;
  return matches.every((m) => TECH_INTERP_VAR_NAMES.has(m[1]));
}

function isKeyboardCodeIssue(text, context) {
  if (UNAMBIGUOUS_KEYBOARD_CODES.has(text)) return true;
  if (!AMBIGUOUS_KEYBOARD_CODES.has(text)) return false;
  return context.inArray || context.isCompare || context.isKeyCompare;
}

function classifyShouldNotTranslate(defaultValue, context, key) {
  const text = String(defaultValue).trim();
  if (!text) return null;

  if (isKeyboardCodeIssue(text, context)) {
    return {
      rule: "keyboard-code-i18n",
      message: "键盘事件码（如 ArrowUp）是内部标识，不要包 t() / i18next.t()",
    };
  }

  if (looksLikeDateFnsFormat(text) || (context.isFormatVar && isInterpolationOnlyTechnical(text))) {
    return {
      rule: "date-format-i18n",
      message:
        "date-fns 格式模式 / 格式变量拼接不是 UI 文案，不要包 t()；用模板字符串如 `${dateFormat} ${timeFormat}`",
    };
  }

  if (looksLikeSrcSet(text)) {
    return {
      rule: "srcset-i18n",
      message: "img srcSet 是浏览器资源描述，不要包 t() / i18next.t()",
    };
  }

  if (context.prop && TECHNICAL_JSX_PROPS.has(context.prop) && looksLikeClassNameString(text)) {
    return {
      rule: "tailwind-class-i18n",
      message: `${context.prop} 中的类名应保持字符串字面量，不要包 t() / i18next.t()`,
    };
  }

  if (context.prop === "srcSet") {
    return {
      rule: "srcset-i18n",
      message: "srcSet 属性不要包 t() / i18next.t()",
    };
  }

  if (context.isCompare && looksLikeTechnicalIdentifier(text)) {
    return {
      rule: "technical-identifier-i18n",
      message: "=== / !== 比较用的技术标识（如 AgreementSelected）不要包 t()",
    };
  }

  if (context.isReplace) {
    return {
      rule: "string-manipulation-i18n",
      message: ".replace / .split 等字符串解析用的片段不要包 t()，保持字面量",
    };
  }

  if (context.isConstSentinel) {
    return {
      rule: "internal-constant-i18n",
      message: "模块级内部常量 / 哨兵值（如 PASSWORD_PROTECTED_VALUE）不要包 t()",
    };
  }

  if (isInterpolationOnlyTechnical(text) && /(?:format|Format|x[12]|srcSet|className|val)/i.test(text + key)) {
    return {
      rule: "interpolation-only-i18n",
      message: "defaultValue 仅拼接技术变量（{{dateFormat}}、{{x1}} 等），不是 UI 文案，不要包 t()",
    };
  }

  return null;
}

/** 扫描 t() 调用的 defaultValue 与上下文，抓 instrument 误翻（规则 15） */
function findShouldNotTranslateIssues(source, filePath) {
  const issues = [];
  const clean = stripComments(source);
  const callStarts = new Set();

  for (const pattern of CALLEE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(clean)) !== null) {
      callStarts.add(match.index);
    }
  }

  for (const calleeStart of [...callStarts].sort((a, b) => a - b)) {
    const openParen = clean.indexOf("(", calleeStart);
    const closeParen = findBalancedParenEnd(clean, openParen);
    if (closeParen === -1) continue;

    const argsText = clean.slice(openParen + 1, closeParen);
    if (!/\bdefaultValue\s*:/.test(argsText)) continue;

    const defaultValue = parseDefaultValueFromArgs(argsText);
    if (defaultValue === null) continue;

    const before = clean.slice(Math.max(0, calleeStart - 140), calleeStart);
    const context = detectTCallContext(before);
    const key = parseKeyFromArgs(argsText);
    const classified = classifyShouldNotTranslate(defaultValue, context, key);
    if (!classified) continue;

    const pos = lineColAt(source, calleeStart);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: key || defaultValue.slice(0, 60),
      rule: classified.rule,
      message: classified.message,
    });
  }

  return issues;
}

const CHANGE_LANGUAGE_INSTRUMENT_RE =
  /i18n\.changeLanguage\s*\([^)]*\)\s*;\s*(?:i18next\.t|(?<![.\w$])t)\s*\(/g;

function findChangeLanguageInstrumentIssues(source, filePath) {
  const issues = [];
  const clean = stripComments(source);
  CHANGE_LANGUAGE_INSTRUMENT_RE.lastIndex = 0;
  let match;

  while ((match = CHANGE_LANGUAGE_INSTRUMENT_RE.exec(clean)) !== null) {
    const pos = lineColAt(source, match.index);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: "i18n.changeLanguage",
      rule: "changeLanguage-instrument",
      message:
        "instrument 误插入 i18n.changeLanguage(...); 在 t() 前，应删除；可 yarn i18n:instrument -- --fix-only",
    });
  }

  return issues;
}

const HEIDI_CONTENT_FILE = "apps/labelstudio/src/components/HeidiTips/content.ts";

function findHeidiContentInstrumentIssues(source, filePath) {
  if (!filePath.replace(/\\/g, "/").endsWith(HEIDI_CONTENT_FILE)) return [];
  if (!/\bi18next\.t\s*\(/.test(stripComments(source))) return [];

  return [
    {
      file: filePath,
      line: 1,
      col: 1,
      key: "HeidiTips/content.ts",
      rule: "heidi-content-no-i18n",
      message:
        "HeidiTips/content.ts 必须保持纯英文字面量（运行时由 HeidiTip.tsx + heidi-tips.json 翻译）；不要用 i18next.t()，并从 git 还原后确保 i18next.config extract.ignore 包含此文件",
    },
  ];
}

/** CustomBackendForm action、api 方法名、storage key — 不是 UI 文案 */
const API_ACTION_TERNARY_RE =
  /\?\s*["']([a-zA-Z][\w]*)["']\s*:\s*(?:i18next\.t|(?<![.\w$])t)\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([a-zA-Z][\w]*)["']/g;
const ACTION_PROP_T_RE = /\baction\s*:\s*(?:i18next\.t|(?<![.\w$])t)\s*\(/g;
const STORAGE_KEY_T_RE = /(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\s*\(\s*(?:i18next\.t|(?<![.\w$])t)\s*\(/g;

function findApiActionI18nIssues(source, filePath) {
  const issues = [];
  const clean = stripComments(source);

  ACTION_PROP_T_RE.lastIndex = 0;
  let match;
  while ((match = ACTION_PROP_T_RE.exec(clean)) !== null) {
    const pos = lineColAt(source, match.index);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: "action",
      rule: "api-action-i18n",
      message: "action 是 API 方法名（如 addMLBackend），应保持字符串字面量，不要包 t() / i18next.t()",
    });
  }

  API_ACTION_TERNARY_RE.lastIndex = 0;
  while ((match = API_ACTION_TERNARY_RE.exec(clean)) !== null) {
    const pos = lineColAt(source, match.index);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: match[2],
      rule: "api-action-i18n",
      message: `三元表达式中的 API 方法名 "${match[2]}" 不要包 t()；应两侧都用字符串字面量`,
    });
  }

  STORAGE_KEY_T_RE.lastIndex = 0;
  while ((match = STORAGE_KEY_T_RE.exec(clean)) !== null) {
    const pos = lineColAt(source, match.index);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: "localStorage",
      rule: "storage-key-i18n",
      message: "localStorage / sessionStorage key 是技术标识，应保持模板字符串/字面量，不要包 t() / i18next.t()",
    });
  }

  return issues;
}

const REACT_HOOK_CALL_RE =
  /\buse(?:Translation|State|Effect|Memo|Callback|Context|Ref|Reducer|LayoutEffect|ImperativeHandle|DebugValue|DeferredValue|Transition|Id|SyncExternalStore|SDK)\s*\(/;

const MODULE_INIT_SPREAD_CALL_RE =
  /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*\[\.\.\.\s*(\w+)\s*\(/gm;

const RELATIVE_IMPORT_RE =
  /\b(?:from|import)\s+['"](\.[^'"]+)['"]|\brequire\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

const RESOLVE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".module.css",
  ".prefix.css",
  ".global.prefix.css",
  ".json",
  ".svg",
  "",
];

function functionBodyContainsHook(source, fnName) {
  const clean = stripComments(source);
  const patterns = [
    new RegExp(`(?:export\\s+)?const\\s+${fnName}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|\\w+)\\s*=>\\s*\\{`, "m"),
    new RegExp(`(?:export\\s+)?function\\s+${fnName}\\s*\\([^)]*\\)\\s*\\{`, "m"),
  ];

  for (const re of patterns) {
    const match = re.exec(clean);
    if (!match) continue;
    const braceIdx = clean.indexOf("{", match.index + match[0].length - 1);
    if (braceIdx === -1) continue;
    const end = findBalancedBraceEnd(clean, braceIdx);
    if (end === -1) continue;
    const body = clean.slice(braceIdx, end + 1);
    if (REACT_HOOK_CALL_RE.test(body)) return true;
  }

  return false;
}

/** Filters/types 等静态配置在模块 load 时调用工厂函数，内部不能用 useTranslation 等 hooks */
function findModuleLevelHookIssues(source, filePath) {
  const issues = [];
  const clean = stripComments(source);
  if (!REACT_HOOK_CALL_RE.test(clean)) return issues;

  const seen = new Set();
  let match;
  MODULE_INIT_SPREAD_CALL_RE.lastIndex = 0;

  while ((match = MODULE_INIT_SPREAD_CALL_RE.exec(clean)) !== null) {
    const fnName = match[1];
    if (seen.has(fnName)) continue;
    seen.add(fnName);

    if (!functionBodyContainsHook(source, fnName)) continue;

    const pos = lineColAt(source, match.index + match[0].indexOf(fnName));
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: fnName,
      rule: "module-level-hook-i18n",
      message:
        `${fnName}() 在模块顶层被调用（如 [...${fnName}()]），其内部不得使用 useTranslation/useState 等 hooks；静态 filter 配置请改用 i18next.t()`,
    });
  }

  return issues;
}

function resolveRelativeImport(fromAbsPath, spec) {
  const base = path.resolve(path.dirname(fromAbsPath), spec);

  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { ok: true };
    }
  }

  for (const ext of ["/index.ts", "/index.tsx", "/index.js", "/index.jsx", "/index.mjs"]) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { ok: true };
    }
  }

  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"]) {
      if (fs.existsSync(base + ext)) return { ok: true };
    }
  }

  return { ok: false, base };
}

function findUnresolvedImportIssues(source, filePath) {
  const issues = [];
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(WEB_ROOT, filePath);
  const clean = stripComments(source);
  const seen = new Set();

  let match;
  RELATIVE_IMPORT_RE.lastIndex = 0;
  while ((match = RELATIVE_IMPORT_RE.exec(clean)) !== null) {
    const spec = match[1] ?? match[2];
    if (!spec || seen.has(spec)) continue;
    seen.add(spec);

    const resolved = resolveRelativeImport(absPath, spec);
    if (resolved.ok) continue;

    const pos = lineColAt(source, match.index);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: spec,
      rule: "unresolved-import",
      message: `相对 import 无法解析: "${spec}"（从 ${path.relative(WEB_ROOT, absPath)} 出发找不到对应文件）`,
    });
  }

  return issues;
}

const PREFIX_TO_I18N_NS = {
  appCommon: "app-common",
  datamanager: "datamanager",
};

function inferNsFromPrefixedKey(key) {
  const prefix = key.split(".")[0];
  return PREFIX_TO_I18N_NS[prefix] ?? null;
}

/** i18next.t 走全局 defaultNS；带 appCommon/datamanager 前缀的 key 必须显式 ns */
function findMissingI18nextNsIssues(source, filePath) {
  const issues = [];
  const clean = stripComments(source);
  let idx = 0;

  while ((idx = clean.indexOf("i18next.t(", idx)) !== -1) {
    const openParen = clean.indexOf("(", idx);
    const closeParen = findBalancedParenEnd(clean, openParen);
    if (closeParen === -1) break;

    const callText = clean.slice(idx, closeParen + 1);
    const argsText = clean.slice(openParen + 1, closeParen).trim();
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

    const expectedNs = inferNsFromPrefixedKey(keyLit.value);
    if (!expectedNs) {
      idx = closeParen + 1;
      continue;
    }

    if (/\bns\s*:/.test(callText)) {
      idx = closeParen + 1;
      continue;
    }

    const pos = lineColAt(source, idx);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: keyLit.value,
      rule: "require-i18next-ns",
      message: `i18next.t("${keyLit.value.slice(0, 40)}…") 缺少 ns: "${expectedNs}"；可执行 node i18n/fix-i18next-ns.cjs`,
    });
    idx = closeParen + 1;
  }

  return issues;
}

const BROKEN_NS_BEFORE_OBJECT_RE =
  /i18next\.t\s*\([\s\S]*?\bns\s*:\s*["'](?:app-common|datamanager)["']\s*,\s*\{/g;

function findBrokenI18nextNsSyntaxIssues(source, filePath) {
  const issues = [];
  const clean = stripComments(source);
  let match;

  BROKEN_NS_BEFORE_OBJECT_RE.lastIndex = 0;
  while ((match = BROKEN_NS_BEFORE_OBJECT_RE.exec(clean)) !== null) {
    const pos = lineColAt(source, match.index);
    issues.push({
      file: filePath,
      line: pos.line,
      col: pos.col,
      key: "",
      rule: "broken-i18next-ns-syntax",
      message: 'i18next.t 的 ns 必须在 `{ ns: "…", defaultValue: … }` 对象内，不能写成 `ns: "…", {`',
    });
  }

  return issues;
}

function findMergedImportLineIssues(source, filePath) {
  const issues = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = /;[ \t]*import\s/.exec(line);
    if (!match) continue;

    issues.push({
      file: filePath,
      line: i + 1,
      col: match.index + 1,
      key: line.trim().slice(0, 60),
      rule: "merged-import-line",
      message:
        "import 粘在上一行末尾（`;import`），应拆成独立行；可执行 yarn i18n:instrument -- --fix-only --scope=…",
    });
  }

  return issues;
}

/** 内置回归：确保 instrument 典型误包能被规则 15 抓到 */
function runNonUiSelfTest() {
  const fixtures = [
    {
      name: "date-fns format concat",
      source: `const finalFormat = showTime ? t('datamanager.foo.dateformatTimeformat', { defaultValue: "{{dateFormat}} {{timeFormat}}", dateFormat, timeFormat }) : dateFormat;`,
      expectRule: "date-format-i18n",
    },
    {
      name: "keyboard code in array",
      source: `const allowedKeys = [t('x.arrowup', { ns: "datamanager", defaultValue: "ArrowUp" }), "Backspace"];`,
      expectRule: "keyboard-code-i18n",
    },
    {
      name: "technical compare identifier",
      source: `const ok = column.type === i18next.t('x.agreementselected', { ns: "datamanager", defaultValue: "AgreementSelected" });`,
      expectRule: "technical-identifier-i18n",
    },
    {
      name: "srcSet interpolation",
      source: `const imgSrcSet = t('x.srcset', { defaultValue: "{{x1}} 1x, {{x2}} 2x", x1: a, x2: b });`,
      expectRule: "srcset-i18n",
    },
    {
      name: "triggerClassName tailwind",
      source: `triggerClassName={t('x.cls', { defaultValue: "{{val}} w-[200px]", val: cn("list").toString() })}`,
      expectRule: "tailwind-class-i18n",
    },
    {
      name: "string replace fragment",
      source: `const x = title.toLowerCase().replace(t('x.del', { defaultValue: "delete " }), "");`,
      expectRule: "string-manipulation-i18n",
    },
    {
      name: "date-fns literal in format()",
      source: `title={format(parseISO(ts), t('pages.foo.datetimeFormat', { defaultValue: "yyyy-MM-dd HH:mm:ss" }))}`,
      expectRule: "date-format-i18n",
    },
    {
      name: "Delete button label (negative)",
      source: `label={t('pages.foo.delete', { defaultValue: "Delete" })}`,
      expectRule: null,
    },
    {
      name: "module-level hook in filter factory",
      source: `export const DateFilter = [...DateFields()];\n\nfunction DateFields() {\n  const { t } = useTranslation("datamanager");\n  return [{ label: t('x', { defaultValue: "Date" }) }];\n}`,
      expectRule: "module-level-hook-i18n",
      fn: findModuleLevelHookIssues,
    },
    {
      name: "unresolved relative import",
      source: `import { x } from "../../../utils/missing-file";\nexport default x;`,
      expectRule: "unresolved-import",
      fn: findUnresolvedImportIssues,
      filePath: path.join(WEB_ROOT, "libs/datamanager/src/components/Table/TableHead/TableHead.jsx"),
    },
    {
      name: "i18next.t missing ns (appCommon)",
      source: `const t = i18next.t('appCommon.pages.AccountSettings.sections.index.personalInfo', { defaultValue: "Personal Info" });`,
      expectRule: "require-i18next-ns",
      fn: findMissingI18nextNsIssues,
    },
    {
      name: "i18next.t with ns (negative)",
      source: `i18next.t('datamanager.components.Filters.Filters.addFilter', { ns: "datamanager", defaultValue: "Add Filter" });`,
      expectRule: null,
      fn: findMissingI18nextNsIssues,
    },
  ];

  let failed = 0;
  for (const fx of fixtures) {
    const checker = fx.fn ?? findShouldNotTranslateIssues;
    const filePath = fx.filePath ?? "fixture.jsx";
    const issues = checker(fx.source, filePath);
    const rule = issues[0]?.rule ?? null;
    if (rule !== fx.expectRule) {
      console.error(`FAIL ${fx.name}: expected ${fx.expectRule}, got ${rule}`);
      failed++;
    } else {
      console.log(`ok ${fx.name}`);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} self-test(s) failed`);
    process.exit(1);
  }
  console.log(`\n${fixtures.length} non-ui self-tests passed`);
}

function main() {
  const jsonOut = process.argv.includes("--json");
  const scopes = resolveModules();
  const scopeSource = process.env.I18N_EXTRACT_SCOPE ? "I18N_EXTRACT_SCOPE" : "i18n/config.json";
  const sourceFiles = collectSourceFiles();
  const callIssues = [];

  for (const filePath of sourceFiles) {
    resetCalleePatterns();
    const rel = path.relative(WEB_ROOT, filePath);
    const source = fs.readFileSync(filePath, "utf8");
    callIssues.push(...findTCalls(source, rel));
    callIssues.push(...findUseTranslationIssues(source, rel));
    callIssues.push(...findMixedTernaryIssues(source, rel));
    callIssues.push(...findTransIndexIssues(source, rel));
    callIssues.push(...findBrokenInstrumentTransIssues(source, rel));
    callIssues.push(...findBareUiAttributeIssues(source, rel));
    callIssues.push(...findBareUiAttributeExprIssues(source, rel));
    callIssues.push(...findBareJsxTextIssues(source, rel));
    callIssues.push(...findBareModuleUiPropertyIssues(source, rel));
    callIssues.push(...findApiInvokeI18nIssues(source, rel));
    callIssues.push(...findApiActionI18nIssues(source, rel));
    callIssues.push(...findRoutePathI18nIssues(source, rel));
    callIssues.push(...findTailwindClassI18nIssues(source, rel));
    callIssues.push(...findShouldNotTranslateIssues(source, rel));
    callIssues.push(...findChangeLanguageInstrumentIssues(source, rel));
    callIssues.push(...findHeidiContentInstrumentIssues(source, rel));
    callIssues.push(...findMergedImportLineIssues(source, rel));
    callIssues.push(...findModuleLevelHookIssues(source, rel));
    callIssues.push(...findUnresolvedImportIssues(source, filePath));
    callIssues.push(...findMissingI18nextNsIssues(source, rel));
    callIssues.push(...findBrokenI18nextNsSyntaxIssues(source, rel));
  }

  const localeIssues = checkEnLocales();
  const all = [...callIssues, ...localeIssues];

  if (jsonOut) {
    console.log(JSON.stringify({ ok: all.length === 0, issues: all }, null, 2));
    process.exit(all.length === 0 ? 0 : 1);
  }

  if (all.length === 0) {
    console.log(
      `i18n 检查通过（scope: [${scopes.join(", ")}] 来自 ${scopeSource}，${sourceFiles.length} 个源码文件，en locale 正常）`,
    );
    process.exit(0);
  }

  const byRule = {};
  for (const issue of all) {
    byRule[issue.rule] = (byRule[issue.rule] || 0) + 1;
  }

  console.error(`i18n 检查失败：${all.length} 个问题`);
  for (const [rule, count] of Object.entries(byRule)) {
    console.error(`  ${rule}: ${count}`);
  }
  console.error("");

  const shown = all.slice(0, 40);
  for (const issue of shown) {
    const loc =
      issue.line > 0 ? `${issue.file}:${issue.line}:${issue.col}` : issue.file;
    console.error(`  [${issue.rule}] ${loc} ${issue.key ? `"${issue.key}" — ` : ""}${issue.message}`);
  }
  if (all.length > shown.length) {
    console.error(`  … 以及另外 ${all.length - shown.length} 个`);
  }

  console.error("\n详见 web/i18n/README.md 与 .cursor/rules/i18n.mdc");
  process.exit(1);
}

if (process.argv.includes("--self-test-non-ui")) {
  runNonUiSelfTest();
} else {
  main();
}
