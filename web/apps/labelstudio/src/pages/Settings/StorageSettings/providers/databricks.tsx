import { EnterpriseBadge, IconSpark } from "@humansignal/ui";
import { Alert, AlertTitle, AlertDescription } from "@humansignal/shad/components/ui/alert";
import { IconCloudProviderDatabricks } from "@humansignal/icons";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import i18next from 'i18next'


const databricksProvider: ProviderConfig = {
  name: "databricks",
  title: i18next.t('pages.Settings.StorageSettings.providers.databricks.databricksFilesUcVolumes', { defaultValue: "Databricks Filesn(UC Volumes)" }),
  description: i18next.t('pages.Settings.StorageSettings.providers.databricks.configureYourDatabricksUnityCatalogVolumesConnectionWithAllRequiredSettingsProxyOnly', { defaultValue: "Configure your Databricks Unity Catalog Volumes connection with all required settings (proxy only)" }),
  icon: IconCloudProviderDatabricks,
  disabled: true,
  badge: <EnterpriseBadge />,
  fields: [
    {
      name: "enterprise_info",
      type: "message",
      content: (
        <Alert variant="gradient">
          <IconSpark />
          <AlertTitle>{i18next.t('pages.Settings.StorageSettings.providers.databricks.enterpriseFeature', { defaultValue: "Enterprise Feature" })}</AlertTitle>
          <AlertDescription>
            {i18next.t('pages.Settings.StorageSettings.providers.databricks.databricksFilesUcVolumesIsAvailableInLabelStudioEnterprise', { defaultValue: "Databricks Files (UC Volumes) is available in Label Studio Enterprise." })}{" "}
            <a
              href="https://docs.humansignal.com/guide/storage.html#Databricks-Files-UC-Volumes"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              {i18next.t('pages.Settings.StorageSettings.providers.databricks.learnMore', { defaultValue: "Learn more" })}
            </a>
          </AlertDescription>
        </Alert>
      ),
    },
  ],
  layout: [{ fields: ["enterprise_info"] }],
};

export default databricksProvider;
