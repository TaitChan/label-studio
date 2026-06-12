import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { IconGlobe } from "@humansignal/icons";
import { Button, Dropdown } from "@humansignal/ui";
import { APP_LOCALE_OPTIONS, changeAppLocale } from "../../i18n";
import { Menu } from "../Menu/Menu";
import { cn } from "../../utils/bem";

const LABEL_DEFAULTS = {
  english: "English",
  simplifiedChinese: "简体中文",
  traditionalChinese: "繁體中文",
};

export const LangSelect = () => {
  const { t, i18n } = useTranslation("components");
  const menubarClass = cn("menu-header");

  const currentLabel = useMemo(() => {
    const option = APP_LOCALE_OPTIONS.find((item) => item.code === i18n.language);
    if (!option) return LABEL_DEFAULTS.english;
    return t(`components.Menubar.LangSelect.${option.labelKey}`, {
      defaultValue: LABEL_DEFAULTS[option.labelKey],
    });
  }, [i18n.language, t]);

  const tooltipTitle = t("components.Menubar.LangSelect.currentLanguage", {
    defaultValue: "Language: {{language}}",
    language: currentLabel,
  });

  return (
    <div className={menubarClass.elem("lang").toClassName()}>
      <Dropdown.Trigger
        alignment="bottom-right"
        content={
          <Menu closeDropdownOnItemClick>
            {APP_LOCALE_OPTIONS.map((option) => (
              <Menu.Item
                key={option.code}
                active={i18n.language === option.code}
                onClick={() => changeAppLocale(option.code)}
                label={t(`components.Menubar.LangSelect.${option.labelKey}`, {
                  defaultValue: LABEL_DEFAULTS[option.labelKey],
                })}
              />
            ))}
          </Menu>
        }
      >
        <div
          className={menubarClass.elem("lang-trigger").toClassName()}
          aria-label={t("components.Menubar.LangSelect.language", { defaultValue: "Language" })}
          data-testid="lang-select-button"
        >
          <Button
            variant="neutral"
            look="outlined"
            size="small"
            icon={<IconGlobe />}
            tooltip={tooltipTitle}
            tabIndex={-1}
          />
        </div>
      </Dropdown.Trigger>
    </div>
  );
};
