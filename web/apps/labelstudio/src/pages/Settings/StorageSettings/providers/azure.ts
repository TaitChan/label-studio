import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import { IconCloudProviderAzure } from "@humansignal/icons";
import { z } from "zod";
import i18next from 'i18next'


export const azureProvider: ProviderConfig = {
  name: "azure",
  title: i18next.t('pages.Settings.StorageSettings.providers.azure.azureBlobStorage', { defaultValue: "Azure Blob Storage" }),
  description: i18next.t('pages.Settings.StorageSettings.providers.azure.configureYourAzureBlobStorageConnectionWithAllRequiredLabelStudioSettings', { defaultValue: "Configure your Azure Blob Storage connection with all required Label Studio settings" }),
  icon: IconCloudProviderAzure,
  fields: [
    {
      name: "container",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.azure.containerName', { defaultValue: "Container Name" }),
      required: true,
      placeholder: "my-azure-container",
      schema: z.string().min(1, "Container name is required"),
    },
    {
      name: "prefix",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.azure.bucketPrefix', { defaultValue: "Bucket prefix" }),
      placeholder: "path/to/files",
      schema: z.string().optional().default(""),
      target: "export",
    },
    {
      name: "account_name",
      type: "password",
      label: i18next.t('pages.Settings.StorageSettings.providers.azure.accountName', { defaultValue: "Account Name" }),
      autoComplete: "off",
      accessKey: true,
      placeholder: "mystorageaccount",
      schema: z.string().optional().default(""),
    },
    {
      name: "account_key",
      type: "password",
      label: i18next.t('pages.Settings.StorageSettings.providers.azure.accountKey', { defaultValue: "Account Key" }),
      autoComplete: "new-password",
      accessKey: true,
      placeholder: i18next.t('pages.Settings.StorageSettings.providers.azure.yourStorageAccountKey', { defaultValue: "Your storage account key" }),
      schema: z.string().optional().default(""),
    },
    {
      name: "presign",
      type: "toggle",
      label: i18next.t('pages.Settings.StorageSettings.providers.azure.usePresignedUrlsOnProxyThroughThePlatformOff', { defaultValue: "Use pre-signed URLs (On) / Proxy through the platform (Off)" }),
      description:
        i18next.t('pages.Settings.StorageSettings.providers.azure.whenPresignedUrlsAreEnabledAllDataBypassesThePlatformAndUserBrowsersDirectlyReadDataFromStorage', { defaultValue: "When pre-signed URLs are enabled, all data bypasses the platform and user browsers directly read data from storage" }),
      schema: z.boolean().default(true),
      target: "import",
      resetConnection: false,
    },
    {
      name: "presign_ttl",
      type: "counter",
      label: i18next.t('pages.Settings.StorageSettings.providers.azure.expirePresignedUrlsMinutes', { defaultValue: "Expire pre-signed URLs (minutes)" }),
      min: 1,
      max: 10080,
      step: 1,
      schema: z.number().min(1).max(10080).default(15),
      target: "import",
      resetConnection: false,
      dependsOn: {
        field: "presign",
        value: true,
      },
    },
  ],
  layout: [
    { fields: ["container"] },
    { fields: ["prefix"] },
    { fields: ["account_name"] },
    { fields: ["account_key"] },
    { fields: ["presign", "presign_ttl"] },
  ],
};

export default azureProvider;
