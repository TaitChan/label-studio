import { settingsAtom, TOKEN_SETTINGS_KEY } from "@humansignal/app-common/pages/AccountSettings/atoms";
import type { AuthTokenSettings } from "@humansignal/app-common/pages/AccountSettings/types";
import { Button } from "@humansignal/ui";
import { Form, Input, Toggle } from "apps/labelstudio/src/components/Form";
import { useAtomValue } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { type ChangeEvent, useState } from "react";
import { useTranslation } from 'react-i18next'


export const TokenSettingsModal = ({ showTTL, onSaved }: { showTTL?: boolean; onSaved?: () => void }) => {
  const { t } = useTranslation("app-common")
  const settings = useAtomValue(settingsAtom);
  if (!settings.isSuccess || settings.isError || "error" in settings.data) {
    return <div>{t('appCommon.blocks.TokenSettingsModal.index.errorLoadingSettings', { defaultValue: "Error loading settings." })}</div>;
  }
  return (
    <TokenSettingsModalView
      key={settings.data?.api_tokens_enabled}
      settings={settings.data}
      showTTL={showTTL}
      onSaved={onSaved}
    />
  );
};

function TokenSettingsModalView({
  settings,
  showTTL,
  onSaved,
}: {
  settings: AuthTokenSettings;
  showTTL?: boolean;
  onSaved?: () => void;
}) {
  const { t } = useTranslation("app-common")
  const [enableTTL, setEnableTTL] = useState(settings.api_tokens_enabled);
  const queryClient = useAtomValue(queryClientAtom);
  const reloadSettings = () => {
    queryClient.invalidateQueries({ queryKey: [TOKEN_SETTINGS_KEY] });
    onSaved?.();
  };
  return (
    <Form action="accessTokenUpdateSettings" onSubmit={reloadSettings}>
      <Form.Row columnCount={1}>
        <Toggle
          label={t('appCommon.blocks.TokenSettingsModal.index.personalAccessTokens', { defaultValue: "Personal Access Tokens" })}
          name="api_tokens_enabled"
          description={t('appCommon.blocks.TokenSettingsModal.index.enableIncreasedTokenAuthenticationSecurity', { defaultValue: "Enable increased token authentication security" })}
          checked={settings.api_tokens_enabled ?? true}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEnableTTL(e.target.checked)}
        />
      </Form.Row>
      <Form.Row columnCount={1}>
        <Toggle
          label={t('appCommon.blocks.TokenSettingsModal.index.legacyTokens', { defaultValue: "Legacy Tokens" })}
          name="legacy_api_tokens_enabled"
          description={t('appCommon.blocks.TokenSettingsModal.index.enableLegacyAccessTokensTheseDoNotExpire', { defaultValue: "Enable legacy access tokens, these do not expire" })}
          checked={settings.legacy_api_tokens_enabled ?? false}
        />
      </Form.Row>
      {showTTL === true && (
        <Form.Row columnCount={1}>
          <Input
            name="api_token_ttl_days"
            label={t('appCommon.blocks.TokenSettingsModal.index.timetoliveOptionalPersonalAccessTokenOnly', { defaultValue: "Time-to-Live (optional, Personal Access Token only)" })}
            description={t('appCommon.blocks.TokenSettingsModal.index.theNumberOfDaysAfterCreationThatTheTokenWillBeValidForAfterThisTimePeriodAUserWillNeedToCreateANewAccessToken', { defaultValue: "The number of days, after creation, that the token will be valid for. After this time period a user will need to create a new access token" })}
            labelProps={{
              description:
                t('appCommon.blocks.TokenSettingsModal.index.theNumberOfDaysAfterCreationThatTheTokenWillBeValidForAfterThisTimePeriodAUserWillNeedToCreateANewAccessToken', { defaultValue: "The number of days, after creation, that the token will be valid for. After this time period a user will need to create a new access token" }),
            }}
            disabled={!enableTTL}
            type="number"
            min={10}
            max={365}
            value={settings.api_token_ttl_days ?? 30}
          />
        </Form.Row>
      )}
      <Form.Actions>
        <Button variant="primary" look="filled" type="submit">
          {t('appCommon.blocks.TokenSettingsModal.index.saveChanges', { defaultValue: "Save Changes" })}
        </Button>
      </Form.Actions>
    </Form>
  );
}
