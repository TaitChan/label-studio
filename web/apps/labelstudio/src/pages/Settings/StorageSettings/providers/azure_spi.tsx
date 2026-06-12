import { EnterpriseBadge, IconSpark } from "@humansignal/ui";
import { Alert, AlertTitle, AlertDescription } from "@humansignal/shad/components/ui/alert";
import { IconCloudProviderAzure } from "@humansignal/icons";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import i18next from 'i18next'


const azureSpiProvider: ProviderConfig = {
  name: "azure_spi",
  title: i18next.t('pages.Settings.StorageSettings.providers.azure_spi.azureBlobStorageWithServicePrincipal', { defaultValue: "Azure Blob Storagenwith Service Principal" }),
  description:
    i18next.t('pages.Settings.StorageSettings.providers.azure_spi.configureYourAzureBlobStorageConnectionUsingServicePrincipalAuthenticationForEnhancedSecurityProxyOnly', { defaultValue: "Configure your Azure Blob Storage connection using Service Principal authentication for enhanced security (proxy only)" }),
  icon: IconCloudProviderAzure,
  disabled: true,
  badge: <EnterpriseBadge />,
  fields: [
    {
      name: "enterprise_info",
      type: "message",
      content: (
        <Alert variant="gradient">
          <IconSpark />
          <AlertTitle>{i18next.t('pages.Settings.StorageSettings.providers.azure_spi.enterpriseFeature', { defaultValue: "Enterprise Feature" })}</AlertTitle>
          <AlertDescription>
            {i18next.t('pages.Settings.StorageSettings.providers.azure_spi.azureBlobStorageWithServicePrincipalIsAvailableInLabelStudioEnterprise', { defaultValue: "Azure Blob Storage with Service Principal is available in Label Studio Enterprise." })}{" "}
            <a
              href="https://docs.humansignal.com/guide/storage.html#Azure-Blob-Storage-with-Service-Principal-authentication"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              {i18next.t('pages.Settings.StorageSettings.providers.azure_spi.learnMore', { defaultValue: "Learn more" })}
            </a>
          </AlertDescription>
        </Alert>
      ),
    },
  ],
  layout: [{ fields: ["enterprise_info"] }],
};

export default azureSpiProvider;
