import { useCopyText } from "@humansignal/core";
import { Button, IconFileCopy, IconLaunch, Label, Typography } from "@humansignal/ui";
/**
 * FIXME: This is legacy imports. We're not supposed to use such statements
 * each one of these eventually has to be migrated to core/ui
 */
import { Input, TextArea } from "apps/labelstudio/src/components/Form";
import { atom, useAtomValue } from "jotai";
import { atomWithMutation, atomWithQuery } from "jotai-tanstack-query";
import React from "react";
import styles from "./PersonalAccessToken.module.css";
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'


const tokenAtom = atomWithQuery(() => ({
  queryKey: ["access-token"],
  queryFn: async () => {
    const result = await fetch("/api/current-user/token");
    return result.json();
  },
}));

const resetTokenAtom = atomWithMutation(() => ({
  mutationKey: ["reset-token"],
  mutationFn: async () => {
    const result = await fetch("/api/current-user/reset-token", {
      method: "post",
    });
    return result.json();
  },
}));

const currentTokenAtom = atom((get) => {
  const initialToken = get(tokenAtom).data?.token;
  const resetToken = get(resetTokenAtom).data?.token;

  return resetToken ?? initialToken;
});

export const PersonalAccessToken = () => {
  const { t } = useTranslation("app-common");
  const token = useAtomValue(currentTokenAtom);
  const reset = useAtomValue(resetTokenAtom);
  const curl = React.useMemo(() => {
    const siteOrigin = typeof window !== "undefined" ? window.location.origin : "";
    return i18next.t(
      "appCommon.pages.AccountSettings.sections.PersonalAccessToken.curlXGetOriginapiprojectsHAuthorizationTokenCurrenttoken",
      {
        ns: "app-common",
        defaultValue:
          "curl -X GET {{siteOrigin}}/api/projects/ -H 'Authorization: Token {{currentToken}}'",
        siteOrigin,
        currentToken: token ?? "",
      },
    );
  }, [token]);
  const [copyToken, tokenCopied] = useCopyText({ defaultText: token ?? "" });
  const [copyCurl, curlCopied] = useCopyText({ defaultText: curl });

  return (
    <div id="personal-access-token">
      <div className="flex flex-col gap-6">
        <div>
          <Label
            text={t("appCommon.pages.AccountSettings.sections.PersonalAccessToken.accessToken", {
              defaultValue: "Access Token",
            })}
            className={styles.label}
          />
          <div className="flex gap-2 w-full justify-between">
            <Input name="token" className={styles.input} readOnly value={token ?? ""} />
            <Button
              leading={<IconFileCopy />}
              onClick={() => copyToken()}
              disabled={tokenCopied}
              variant="primary"
              look="outlined"
              className="w-[116px]"
            >
              {tokenCopied
                ? t("appCommon.pages.AccountSettings.sections.PersonalAccessToken.copied", { defaultValue: "Copied!" })
                : t("appCommon.pages.AccountSettings.sections.PersonalAccessToken.copy", { defaultValue: "Copy" })}
            </Button>
            <Button variant="negative" look="outlined" onClick={() => reset.mutate()}>
              {t('appCommon.pages.AccountSettings.sections.PersonalAccessToken.reset', { defaultValue: "Reset" })}
            </Button>
          </div>
        </div>
        <div>
          <Label
            text={t("appCommon.pages.AccountSettings.sections.PersonalAccessToken.exampleCurlRequest", {
              defaultValue: "Example CURL Request",
            })}
            className={styles.label}
          />
          <div className="flex gap-2 w-full justify-between">
            <TextArea
              name="example-curl"
              readOnly
              className={styles.textarea}
              rawClassName={styles.textarea}
              value={curl ?? ""}
            />
            <Button
              leading={<IconFileCopy />}
              onClick={() => copyCurl()}
              disabled={curlCopied}
              variant="primary"
              look="outlined"
              className="w-[116px]"
            >
              {curlCopied
                ? t("appCommon.pages.AccountSettings.sections.PersonalAccessToken.copied", { defaultValue: "Copied!" })
                : t("appCommon.pages.AccountSettings.sections.PersonalAccessToken.copy", { defaultValue: "Copy" })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export function PersonalAccessTokenDescription() {
  const { t } = useTranslation("app-common")
  return (
    <Typography>
      {t('appCommon.pages.AccountSettings.sections.PersonalAccessToken.authenticateWithOurApiUsingYourPersonalAccessToken', { defaultValue: "Authenticate with our API using your personal access token." })}
      {!window.APP_SETTINGS?.whitelabel_is_active && (
        <>
          {" "}
          {t('appCommon.pages.AccountSettings.sections.PersonalAccessToken.see', { defaultValue: "See" })}{" "}
          <a href="https://labelstud.io/guide/api.html" target="_blank" rel="noreferrer" className="inline-flex gap-1">
            {t('appCommon.pages.AccountSettings.sections.PersonalAccessToken.docs', { defaultValue: "Docs" })}{" "}
            <span>
              <IconLaunch className="h-6 w-6" />
            </span>
          </a>
        </>
      )}
    </Typography>
  );
}
