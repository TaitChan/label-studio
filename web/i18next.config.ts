/** @type {import('i18next-cli').I18nextToolkitConfig} */
import { modulesToExtractGlobs } from "./i18n/config.cjs";
import i18nConfig from "./i18n/config.json";

/** 源码路径前缀 → namespace。见 web/i18n/config.json namespaces */
export const namespaceByPath = i18nConfig.namespaces.map((ns) => ({
  path: ns.pathPrefix,
  namespace: ns.namespace,
}));

export default {
  locales: ["en", "zh", "zh_tw"],

  namespaceByPath,

  extract: {
    // i18next extract.input：扫描哪些源码里的 t()，由 config.json modules 生成 glob
    // I18N_EXTRACT_SCOPE 可临时覆盖。例: pages/Home → apps/labelstudio/src/pages/Home/…
    input: modulesToExtractGlobs(),
    /** pages.* keys live in labelstudio; shared component keys can use components namespace. */
    output: "locales/{{language}}/{{namespace}}.json",

    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.test.*",
      "**/*.spec.*",
      "**/__tests__/**",
      "apps/labelstudio-e2e/**",
      "apps/playground/**",
      "libs/frontend-test/**",
      "libs/storybook/**",
      // HeidiTips：content.ts 保持纯英文；HeidiTip.tsx 运行时 t(heidi-tips)；seed-heidi-keys 解析 content.ts
      "apps/labelstudio/src/components/HeidiTips/content.ts",
    ],

    defaultNS: "labelstudio",
    keySeparator: false,
    nsSeparator: ":",

    primaryLanguage: "en",
    secondaryLanguages: ["zh", "zh_tw"],

    defaultValue: "",

    removeUnusedKeys: true,

    ignoreNamespaces: ["editor", "ui", "common", "heidi-tips"],

    sort: true,
    indentation: 2,

    extractFromComments: false,
  },

  lint: {
    ignore: ["libs/editor/**", "apps/labelstudio-e2e/**", "apps/playground/**"],
    ignoredAttributes: ["data-testid", "className", "css", "style"],
    ignoredTags: ["pre", "code", "script", "style"],
  },

  types: {
    input: ["locales/en/*.json"],
    basePath: "locales/en",
    output: "apps/labelstudio/src/i18n/resources.d.ts",
    resourcesFile: "apps/labelstudio/src/i18n/i18next.d.ts",
    enableSelector: true,
  },
};
