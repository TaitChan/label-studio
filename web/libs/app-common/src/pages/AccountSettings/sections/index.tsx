import { PersonalInfo } from "./PersonalInfo";
import { EmailPreferences } from "./EmailPreferences";
import { PersonalAccessToken, PersonalAccessTokenDescription } from "./PersonalAccessToken";
import { MembershipInfo } from "./MembershipInfo";
import { HotkeysManager } from "./Hotkeys";
import type React from "react";
import { PersonalJWTToken } from "./PersonalJWTToken";
import type { AuthTokenSettings } from "../types";
import { ABILITY, type AuthPermissions } from "@humansignal/core/providers/AuthProvider";
import { ff } from "@humansignal/core";
import { Badge } from "@humansignal/ui";
import i18next from 'i18next'


export type SectionType = {
  title: string | React.ReactNode;
  id: string;
  component: React.FC;
  description?: React.FC;
};

export const accountSettingsSections = (settings: AuthTokenSettings, permissions: AuthPermissions): SectionType[] => {
  const canCreateTokens = permissions.can(ABILITY.can_create_tokens);

  return [
    {
      title: i18next.t('appCommon.pages.AccountSettings.sections.index.personalInfo', { ns: "app-common", defaultValue: "Personal Info" }),
      id: "personal-info",
      component: PersonalInfo,
    },
    {
      title: (
        <div className="flex items-center gap-tight">
          <span>{i18next.t('appCommon.pages.AccountSettings.sections.index.hotkeys', { ns: "app-common", defaultValue: "Hotkeys" })}</span>
          <Badge variant="beta" style="solid" shape="rounded">
            {i18next.t('appCommon.pages.AccountSettings.sections.index.beta', { ns: "app-common", defaultValue: "Beta" })}
          </Badge>
        </div>
      ),
      id: "hotkeys",
      component: HotkeysManager,
      description: () =>
        i18next.t('appCommon.pages.AccountSettings.sections.index.customizeYourKeyboardShortcutsToSpeedUpYourWorkflowClickOnAnyHotkeyBelowToAssignANewKeyCombinationThatWorksBestForYou', { ns: "app-common", defaultValue: "Customize your keyboard shortcuts to speed up your workflow. Click on any hotkey below to assign a new key combination that works best for you." }),
    },
    {
      title: i18next.t('appCommon.pages.AccountSettings.sections.index.emailPreferences', { ns: "app-common", defaultValue: "Email Preferences" }),
      id: "email-preferences",
      component: EmailPreferences,
    },
    {
      title: i18next.t('appCommon.pages.AccountSettings.sections.index.membershipInfo', { ns: "app-common", defaultValue: "Membership Info" }),
      id: "membership-info",
      component: MembershipInfo,
    },
    settings.api_tokens_enabled &&
      canCreateTokens &&
      ff.isActive(ff.FF_AUTH_TOKENS) && {
        title: i18next.t('appCommon.pages.AccountSettings.sections.index.personalAccessToken', { ns: "app-common", defaultValue: "Personal Access Token" }),
        id: "personal-access-token",
        component: PersonalJWTToken,
        description: PersonalAccessTokenDescription,
      },
    settings.legacy_api_tokens_enabled &&
      canCreateTokens && {
        title: ff.isActive(ff.FF_AUTH_TOKENS)
          ? i18next.t("appCommon.pages.AccountSettings.sections.index.legacyToken", { ns: "app-common", defaultValue: "Legacy Token" })
          : i18next.t('appCommon.pages.AccountSettings.sections.index.accessToken', { ns: "app-common", defaultValue: "Access Token" }),
        id: "legacy-token",
        component: PersonalAccessToken,
        description: PersonalAccessTokenDescription,
      },
  ].filter(Boolean) as SectionType[];
};
