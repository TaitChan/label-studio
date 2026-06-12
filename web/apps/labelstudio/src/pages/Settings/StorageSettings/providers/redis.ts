import { z } from "zod";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import { IconCloudProviderRedis } from "@humansignal/icons";
import i18next from 'i18next'


export const redisProvider: ProviderConfig = {
  name: "redis",
  title: i18next.t('pages.Settings.StorageSettings.providers.redis.redisStorage', { defaultValue: "Redis Storage" }),
  description: i18next.t('pages.Settings.StorageSettings.providers.redis.configureYourRedisStorageConnectionWithAllRequiredLabelStudioSettings', { defaultValue: "Configure your Redis storage connection with all required Label Studio settings" }),
  icon: IconCloudProviderRedis,
  fields: [
    {
      name: "db",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.redis.databaseNumberDb', { defaultValue: "Database Number (db)" }),
      placeholder: "1",
      schema: z.string().default("1"),
    },
    {
      name: "password",
      type: "password",
      label: i18next.t('pages.Settings.StorageSettings.providers.redis.password', { defaultValue: "Password" }),
      autoComplete: "new-password",
      placeholder: i18next.t('pages.Settings.StorageSettings.providers.redis.yourRedisPassword', { defaultValue: "Your redis password" }),
      schema: z.string().optional().default(""),
    },
    {
      name: "host",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.redis.host', { defaultValue: "Host" }),
      required: true,
      placeholder: "redis://example.com",
      schema: z.string().min(1, "Host is required"),
    },
    {
      name: "port",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.redis.port', { defaultValue: "Port" }),
      placeholder: "6379",
      schema: z.string().default("6379"),
    },
    {
      name: "prefix",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.redis.bucketPrefix', { defaultValue: "Bucket prefix" }),
      placeholder: "path/to/files",
      schema: z.string().optional().default(""),
      target: "export",
    },
  ],
  layout: [{ fields: ["host", "port", "db", "password"] }, { fields: ["prefix"] }],
};

export default redisProvider;
