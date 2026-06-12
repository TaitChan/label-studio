import { type FC, type MouseEvent, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/bem";
import { IconCross } from "@humansignal/icons";
import "./HeidiTip.prefix.css";
import { Button } from "@humansignal/ui";
import { HeidiSpeaking } from "../../assets/images";
import { heidiTipBody, heidiTipTextKey } from "./heidi-tip-i18n";
import type { HeidiTipProps, Tip } from "./types";
import { createURL } from "./utils";

const HeidiLink: FC<{ link: Tip["link"]; label: string; onClick: () => void }> = ({ link, label, onClick }) => {
  const url = useMemo(() => {
    const params = link.params ?? {};
    /* if needed, add server ID here */

    return createURL(link.url, params);
  }, [link]);

  return (
    <a
      className={cn("heidy-tip").elem("link").toClassName()}
      href={url}
      target="_blank"
      onClick={onClick}
      rel="noreferrer"
    >
      {label}
    </a>
  );
};

export const HeidiTip: FC<HeidiTipProps> = ({ collection, tip, onDismiss, onLinkClick }) => {
  const { t } = useTranslation("heidi-tips");
  const body = heidiTipBody(tip);
  const title = t(heidiTipTextKey(collection, tip, "title"), { defaultValue: tip.title });
  const content = t(heidiTipTextKey(collection, tip, "content"), { defaultValue: body });
  const linkLabel = t(heidiTipTextKey(collection, tip, "link"), { defaultValue: tip.link.label });
  const dismissTooltip = t("heidiTips.dismiss", { defaultValue: "Don't show" });

  const handleClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
    },
    [onDismiss],
  );

  return (
    <div className={cn("heidy-tip").toClassName()}>
      <div className={cn("heidy-tip").elem("content").toClassName()}>
        <div className={cn("heidy-tip").elem("header").toClassName()}>
          <div className={cn("heidy-tip").elem("title").toClassName()}>{title}</div>
          {tip.closable && (
            <Button tooltip={dismissTooltip} look="string" size="small" onClick={handleClick} className="!p-0">
              <IconCross />
            </Button>
          )}
        </div>
        <div className={cn("heidy-tip").elem("text").toClassName()}>
          {content}
          <HeidiLink link={tip.link} label={linkLabel} onClick={onLinkClick} />
        </div>
      </div>
      <div className={cn("heidy-tip").elem("heidi").toClassName()}>
        <HeidiSpeaking />
      </div>
    </div>
  );
};
