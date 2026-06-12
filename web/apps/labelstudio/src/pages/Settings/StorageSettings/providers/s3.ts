import { z } from "zod";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import { IconCloudProviderS3 } from "@humansignal/icons";
import i18next from 'i18next'


export const s3Provider: ProviderConfig = {
  name: "s3",
  title: i18next.t('pages.Settings.StorageSettings.providers.s3.amazonS3', { defaultValue: "Amazon S3" }),
  description: i18next.t('pages.Settings.StorageSettings.providers.s3.configureYourAwsS3ConnectionWithAllRequiredLabelStudioSettings', { defaultValue: "Configure your AWS S3 connection with all required Label Studio settings" }),
  icon: IconCloudProviderS3,
  fields: [
    {
      name: "bucket",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.s3.bucketName', { defaultValue: "Bucket Name" }),
      required: true,
      placeholder: "my-storage-bucket",
      schema: z.string().min(1, "Bucket name is required"),
    },
    {
      name: "region_name",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.s3.regionName', { defaultValue: "Region Name" }),
      placeholder: i18next.t('pages.Settings.StorageSettings.providers.s3.useast1Default', { defaultValue: "us-east-1 (default)" }),
      schema: z.string().optional().default(""),
    },
    {
      name: "s3_endpoint",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.s3.s3Endpoint', { defaultValue: "S3 Endpoint" }),
      placeholder: "https://s3.amazonaws.com (default)",
      schema: z.string().optional().default(""),
    },
    {
      name: "prefix",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.s3.bucketPrefix', { defaultValue: "Bucket prefix" }),
      placeholder: "path/to/files",
      schema: z.string().optional().default(""),
      target: "export",
    },
    {
      name: "aws_access_key_id",
      type: "password",
      label: i18next.t('pages.Settings.StorageSettings.providers.s3.accessKeyId', { defaultValue: "Access Key ID" }),
      required: true,
      placeholder: i18next.t('pages.Settings.StorageSettings.providers.s3.akiaiosfodnn7example', { defaultValue: "AKIAIOSFODNN7EXAMPLE" }),
      autoComplete: "off",
      accessKey: true,
      schema: z.string().min(1, "Access Key ID is required"),
    },
    {
      name: "aws_secret_access_key",
      type: "password",
      label: i18next.t('pages.Settings.StorageSettings.providers.s3.secretAccessKey', { defaultValue: "Secret Access Key" }),
      required: true,
      placeholder: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      autoComplete: "new-password",
      accessKey: true,
      schema: z.string().min(1, "Secret Access Key is required"),
    },
    {
      name: "aws_session_token",
      type: "password",
      label: i18next.t('pages.Settings.StorageSettings.providers.s3.sessionToken', { defaultValue: "Session Token" }),
      placeholder: i18next.t('pages.Settings.StorageSettings.providers.s3.sessionTokenOptional', { defaultValue: "Session token (optional)" }),
      autoComplete: "new-password",
      schema: z.string().optional().default(""),
    },
    {
      name: "presign",
      type: "toggle",
      label: i18next.t('pages.Settings.StorageSettings.providers.s3.usePresignedUrlsOnProxyThroughThePlatformOff', { defaultValue: "Use pre-signed URLs (On) / Proxy through the platform (Off)" }),
      description:
        i18next.t('pages.Settings.StorageSettings.providers.s3.whenPresignedUrlsAreEnabledAllDataBypassesThePlatformAndUserBrowsersDirectlyReadDataFromStorage', { defaultValue: "When pre-signed URLs are enabled, all data bypasses the platform and user browsers directly read data from storage" }),
      schema: z.boolean().default(true),
      target: "import",
      resetConnection: false,
    },
    {
      name: "presign_ttl",
      type: "counter",
      label: i18next.t('pages.Settings.StorageSettings.providers.s3.expirePresignedUrlsMinutes', { defaultValue: "Expire pre-signed URLs (minutes)" }),
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
    { fields: ["region_name"] },
    { fields: ["s3_endpoint"] },
    { fields: ["prefix"] },
    { fields: ["aws_access_key_id"] },
    { fields: ["aws_secret_access_key"] },
    { fields: ["aws_session_token"] },
    { fields: ["presign", "presign_ttl"] },
  ],
};
