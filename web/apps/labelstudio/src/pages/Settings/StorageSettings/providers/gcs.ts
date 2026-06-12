import { z } from "zod";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import { IconCloudProviderGCS } from "@humansignal/icons";
import i18next from 'i18next'


export const gcsProvider: ProviderConfig = {
  name: "gcs",
  title: i18next.t('pages.Settings.StorageSettings.providers.gcs.googleCloudStorage', { defaultValue: "Google Cloud Storage" }),
  description: i18next.t('pages.Settings.StorageSettings.providers.gcs.configureYourGoogleCloudStorageConnectionWithAllRequiredLabelStudioSettings', { defaultValue: "Configure your Google Cloud Storage connection with all required Label Studio settings" }),
  icon: IconCloudProviderGCS,
  fields: [
    {
      name: "bucket",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.gcs.bucketName', { defaultValue: "Bucket Name" }),
      required: true,
      schema: z.string().min(1, "Bucket name is required"),
    },
    {
      name: "prefix",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.gcs.bucketPrefix', { defaultValue: "Bucket prefix" }),
      placeholder: "path/to/files",
      schema: z.string().optional().default(""),
      target: "export",
    },
    {
      name: i18next.t('pages.Settings.StorageSettings.providers.gcs.google_application_credentials', { defaultValue: "google_application_credentials" }),
      type: "password",
      label: i18next.t('pages.Settings.StorageSettings.providers.gcs.googleApplicationCredentials', { defaultValue: "Google Application Credentials" }),
      description: i18next.t('pages.Settings.StorageSettings.providers.gcs.pasteTheContentsOfCredentialsjsonInThisFieldOrLeaveItBlankToUseAdc', { defaultValue: "Paste the contents of credentials.json in this field OR leave it blank to use ADC." }),
      autoComplete: "new-password",
      accessKey: true,
      schema: z.string().optional().default(""), // JSON validation could be added if needed
    },
    {
      name: "google_project_id",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.gcs.googleProjectId', { defaultValue: "Google Project ID" }),
      description: i18next.t('pages.Settings.StorageSettings.providers.gcs.leaveBlankToInheritFromGoogleApplicationCredentials', { defaultValue: "Leave blank to inherit from Google Application Credentials." }),
      schema: z.string().optional().default(""),
    },
    {
      name: "presign",
      type: "toggle",
      label: i18next.t('pages.Settings.StorageSettings.providers.gcs.usePresignedUrlsOnProxyThroughThePlatformOff', { defaultValue: "Use pre-signed URLs (On) / Proxy through the platform (Off)" }),
      description:
        i18next.t('pages.Settings.StorageSettings.providers.gcs.whenPresignedUrlsAreEnabledAllDataBypassesThePlatformAndUserBrowsersDirectlyReadDataFromStorage', { defaultValue: "When pre-signed URLs are enabled, all data bypasses the platform and user browsers directly read data from storage" }),
      schema: z.boolean().default(true),
      target: "import",
      resetConnection: false,
    },
    {
      name: "presign_ttl",
      type: "counter",
      label: i18next.t('pages.Settings.StorageSettings.providers.gcs.expirePresignedUrlsMinutes', { defaultValue: "Expire pre-signed URLs (minutes)" }),
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
    { fields: ["bucket"] },
    { fields: ["prefix"] },
    { fields: ["google_application_credentials"] },
    { fields: ["google_project_id"] },
    { fields: ["presign", "presign_ttl"] },
  ],
};

export default gcsProvider;
