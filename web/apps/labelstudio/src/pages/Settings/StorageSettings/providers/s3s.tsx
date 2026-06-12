import { EnterpriseBadge, IconSpark } from "@humansignal/ui";
import { Alert, AlertTitle, AlertDescription } from "@humansignal/shad/components/ui/alert";
import { IconCloudProviderS3 } from "@humansignal/icons";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import i18next from 'i18next'


const s3sProvider: ProviderConfig = {
  name: "s3s",
  title: i18next.t('pages.Settings.StorageSettings.providers.s3s.amazonS3WithIamRole', { defaultValue: "Amazon S3nwith IAM Role" }),
  description: i18next.t('pages.Settings.StorageSettings.providers.s3s.configureYourAwsS3ConnectionUsingIamRoleAccessForEnhancedSecurityProxyOnly', { defaultValue: "Configure your AWS S3 connection using IAM role access for enhanced security (proxy only)" }),
  icon: IconCloudProviderS3,
  disabled: true,
  badge: <EnterpriseBadge />,
  fields: [
    {
      name: "enterprise_info",
      type: "message",
      content: (
        <Alert variant="gradient">
          <IconSpark />
          <AlertTitle>{i18next.t('pages.Settings.StorageSettings.providers.s3s.enterpriseFeature', { defaultValue: "Enterprise Feature" })}</AlertTitle>
          <AlertDescription>
            {i18next.t('pages.Settings.StorageSettings.providers.s3s.amazonS3WithIamRoleIsAvailableInLabelStudioEnterprise', { defaultValue: "Amazon S3 with IAM Role is available in Label Studio Enterprise." })}{" "}
            <a
              href="https://docs.humansignal.com/guide/storage.html#Set-up-an-S3-connection-with-IAM-role-access"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              {i18next.t('pages.Settings.StorageSettings.providers.s3s.learnMore', { defaultValue: "Learn more" })}
            </a>
          </AlertDescription>
        </Alert>
      ),
    },
  ],
  layout: [{ fields: ["enterprise_info"] }],
};

export default s3sProvider;
