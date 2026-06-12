import { EnterpriseBadge, IconSpark } from "@humansignal/ui";
import { Alert, AlertTitle, AlertDescription } from "@humansignal/shad/components/ui/alert";
import { IconCloudProviderGCS } from "@humansignal/icons";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import i18next from 'i18next'


const gcsWifProvider: ProviderConfig = {
  name: "gcswif",
  title: i18next.t('pages.Settings.StorageSettings.providers.gcswif.googleCloudStorageWifAuth', { defaultValue: "Google Cloud Storagen(WIF Auth)" }),
  description:
    i18next.t('pages.Settings.StorageSettings.providers.gcswif.configureYourGoogleCloudStorageConnectionWithWorkloadIdentityFederationAuthenticationProxyOnly', { defaultValue: "Configure your Google Cloud Storage connection with Workload Identity Federation authentication (proxy only)" }),
  icon: IconCloudProviderGCS,
  disabled: true,
  badge: <EnterpriseBadge />,
  fields: [
    {
      name: "enterprise_info",
      type: "message",
      content: (
        <Alert variant="gradient">
          <IconSpark />
          <AlertTitle>{i18next.t('pages.Settings.StorageSettings.providers.gcswif.enterpriseFeature', { defaultValue: "Enterprise Feature" })}</AlertTitle>
          <AlertDescription>
            {i18next.t('pages.Settings.StorageSettings.providers.gcswif.googleCloudStorageWithWorkloadIdentityFederationIsAvailableInLabelStudioEnterprise', { defaultValue: "Google Cloud Storage with Workload Identity Federation is available in Label Studio Enterprise." })}{" "}
            <a
              href="https://docs.humansignal.com/guide/storage.html#Google-Cloud-Storage-with-Workload-Identity-Federation-WIF"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              {i18next.t('pages.Settings.StorageSettings.providers.gcswif.learnMore', { defaultValue: "Learn more" })}
            </a>
          </AlertDescription>
        </Alert>
      ),
    },
  ],
  layout: [{ fields: ["enterprise_info"] }],
};

export default gcsWifProvider;
