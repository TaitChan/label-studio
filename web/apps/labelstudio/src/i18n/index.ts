import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import enAppCommon from "../../../../locales/en/app-common.json";
import zhAppCommon from "../../../../locales/zh/app-common.json";
import zhTwAppCommon from "../../../../locales/zh_tw/app-common.json";
import enLabelstudio from "../../../../locales/en/labelstudio.json";
import zhLabelstudio from "../../../../locales/zh/labelstudio.json";
import zhTwLabelstudio from "../../../../locales/zh_tw/labelstudio.json";
import enComponents from "../../../../locales/en/components.json";
import enDatamanager from "../../../../locales/en/datamanager.json";
import enHeidiTips from "../../../../locales/en/heidi-tips.json";
import zhComponents from "../../../../locales/zh/components.json";
import zhDatamanager from "../../../../locales/zh/datamanager.json";
import zhHeidiTips from "../../../../locales/zh/heidi-tips.json";
import zhTwComponents from "../../../../locales/zh_tw/components.json";
import zhTwDatamanager from "../../../../locales/zh_tw/datamanager.json";
import zhTwHeidiTips from "../../../../locales/zh_tw/heidi-tips.json";

const SUPPORTED_LOCALES = ["en", "zh", "zh_tw"];
export const LOCALE_STORAGE_KEY = "ls-locale";
const DEFAULT_LOCALE = "en";
const DEFAULT_NAMESPACE = "labelstudio";
const NAMESPACES = [DEFAULT_NAMESPACE, "components", "heidi-tips", "app-common", "datamanager"];

export const APP_LOCALE_OPTIONS = [
  { code: "en", labelKey: "english" },
  { code: "zh", labelKey: "simplifiedChinese" },
  { code: "zh_tw", labelKey: "traditionalChinese" },
];

const storedLocale =
  typeof localStorage !== "undefined" ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
const locale =
  storedLocale && SUPPORTED_LOCALES.includes(storedLocale) ? storedLocale : DEFAULT_LOCALE;

const resources = {
  en: {
    labelstudio: enLabelstudio,
    components: enComponents,
    "heidi-tips": enHeidiTips,
    "app-common": enAppCommon,
    datamanager: enDatamanager,
  },
  zh: {
    labelstudio: zhLabelstudio,
    components: zhComponents,
    "heidi-tips": zhHeidiTips,
    "app-common": zhAppCommon,
    datamanager: zhDatamanager,
  },
  zh_tw: {
    labelstudio: zhTwLabelstudio,
    components: zhTwComponents,
    "heidi-tips": zhTwHeidiTips,
    "app-common": zhTwAppCommon,
    datamanager: zhTwDatamanager,
  },
};

void i18next.use(initReactI18next).init({
  lng: locale,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  defaultNS: DEFAULT_NAMESPACE,
  ns: NAMESPACES,
  keySeparator: false,
  resources,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as Window & { __i18next?: typeof i18next }).__i18next = i18next;
}

/** 切换语言并刷新页面（与 platform 项目一致，确保全局文案生效） */
export function changeAppLocale(code: string) {
  if (!SUPPORTED_LOCALES.includes(code)) return;
  localStorage.setItem(LOCALE_STORAGE_KEY, code);
  window.location.reload();
}

export { SUPPORTED_LOCALES };
export default i18next;
