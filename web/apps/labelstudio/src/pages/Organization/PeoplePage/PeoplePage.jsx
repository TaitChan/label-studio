import { Button } from "@humansignal/ui";
import { useCallback, useMemo, useRef, useState } from "react";
import { useUpdatePageTitle } from "@humansignal/core";
import { HeidiTips } from "../../../components/HeidiTips/HeidiTips";
import { modal } from "../../../components/Modal/Modal";
import { Space } from "../../../components/Space/Space";
import { cn } from "../../../utils/bem";
import { FF_AUTH_TOKENS, FF_LSDV_E_297, isFF } from "../../../utils/feature-flags";
import "./PeopleInvitation.prefix.css";
import { PeopleList } from "./PeopleList";
import "./PeoplePage.prefix.css";
import { TokenSettingsModal } from "@humansignal/app-common/blocks/TokenSettingsModal";
import { IconPlus } from "@humansignal/icons";
import { useToast } from "@humansignal/ui";
import { InviteLink } from "./InviteLink";
import { SelectedUser } from "./SelectedUser";
import { useTranslation } from 'react-i18next'
import i18next from "i18next";


export const PeoplePage = () => {
  const { t } = useTranslation("labelstudio")
  const apiSettingsModal = useRef();
  const toast = useToast();
  const [selectedUser, setSelectedUser] = useState(null);
  const [invitationOpen, setInvitationOpen] = useState(false);

  useUpdatePageTitle("People");

  const selectUser = useCallback(
    (user) => {
      setSelectedUser(user);

      localStorage.setItem("selectedUser", user?.id);
    },
    [setSelectedUser],
  );

  const apiTokensSettingsModalProps = useMemo(
    () => ({
      title: t('pages.Organization.PeoplePage.PeoplePage.apiTokenSettings', { defaultValue: "API Token Settings" }),
      style: { width: 480 },
      body: () => (
        <TokenSettingsModal
          onSaved={() => {
            toast.show({ message: t('pages.Organization.PeoplePage.PeoplePage.apiTokenSettingsSaved', { defaultValue: "API Token settings saved" }) });
            apiSettingsModal.current?.close();
          }}
        />
      ),
    }),
    [],
  );

  const showApiTokenSettingsModal = useCallback(() => {
    apiSettingsModal.current = modal(apiTokensSettingsModalProps);
    __lsa("organization.token_settings");
  }, [apiTokensSettingsModalProps]);

  const defaultSelected = useMemo(() => {
    return localStorage.getItem("selectedUser");
  }, []);

  return (
    <div className={cn("people").toClassName()}>
      <div className={cn("people").elem("controls").toClassName()}>
        <Space spread>
          <Space />

          <Space>
            {isFF(FF_AUTH_TOKENS) && (
              <Button look="outlined" onClick={showApiTokenSettingsModal} aria-label={t('pages.Organization.PeoplePage.PeoplePage.showApiTokenSettings', { defaultValue: "Show API token settings" })}>
                {t('pages.Organization.PeoplePage.PeoplePage.apiTokensSettings', { defaultValue: "API Tokens Settings" })}
              </Button>
            )}
            <Button
              leading={<IconPlus className="!h-4" />}
              onClick={() => setInvitationOpen(true)}
              aria-label={t('pages.Organization.PeoplePage.PeoplePage.inviteNewMember', { defaultValue: "Invite new member" })}
            >
              {t('pages.Organization.PeoplePage.PeoplePage.addMembers', { defaultValue: "Add Members" })}
            </Button>
          </Space>
        </Space>
      </div>
      <div className={cn("people").elem("content").toClassName()}>
        <PeopleList
          selectedUser={selectedUser}
          defaultSelected={defaultSelected}
          onSelect={(user) => selectUser(user)}
        />

        {selectedUser ? (
          <SelectedUser user={selectedUser} onClose={() => selectUser(null)} />
        ) : (
          isFF(FF_LSDV_E_297) && <HeidiTips collection="organizationPage" />
        )}
      </div>
      <InviteLink
        opened={invitationOpen}
        onClosed={() => {
          console.log("hidden");
          setInvitationOpen(false);
        }}
      />
    </div>
  );
};

PeoplePage.title = i18next.t("pages.Organization.PeoplePage.PeoplePage.people", { defaultValue: "People" });
PeoplePage.path = "/";
