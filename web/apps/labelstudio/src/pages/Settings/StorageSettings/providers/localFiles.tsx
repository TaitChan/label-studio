import { z } from "zod";
import type { ProviderConfig } from "@humansignal/app-common/blocks/StorageProviderForm/types/provider";
import { IconFolderOpen } from "@humansignal/icons";
import { Alert, AlertDescription, AlertTitle } from "@humansignal/shad/components/ui/alert";
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'


const localFilesDocumentRoot =
  typeof window === "undefined" ? undefined : window.APP_SETTINGS?.local_files_document_root;
const localFilesServingEnabled =
  typeof window === "undefined" ? true : window.APP_SETTINGS?.local_files_serving_enabled !== false;
const isCommunityEdition =
  typeof window === "undefined" ? false : window.APP_SETTINGS?.version?.edition === "Community";
const trimTrailingSeparators = (value?: string) => value?.replace(/[/\\]+$/, "");
const defaultPathExample = localFilesDocumentRoot
  ? `${trimTrailingSeparators(localFilesDocumentRoot)}/your-subdirectory`
  : undefined;

const pathSchema = defaultPathExample
  ? z.string().min(1, "Path is required").default(defaultPathExample)
  : z.string().min(1, "Path is required");

const LocalFilesServingWarning = () => {
  const { t } = useTranslation("labelstudio")
  if (localFilesServingEnabled) return null;
  return (
    <>
      <Alert variant="destructive">
        <AlertTitle>{t('pages.Settings.StorageSettings.providers.localFiles.localFileServingIsDisabled', { defaultValue: "Local file serving is disabled" })}</AlertTitle>
        <AlertDescription>
          {t('pages.Settings.StorageSettings.providers.localFiles.setTheLocal_files_serving_enabledEnvironmentVariableToTrueAndRestartLabelStudioToEnableLocalFilesStorageSeeTheDocumentationForDetails', { defaultValue: "Set the \"LOCAL_FILES_SERVING_ENABLED\" environment variable to \"true\" and restart Label Studio to enable Localn          Files storage. See the documentation for details:" })}{" "}
          <a href="https://labelstud.io/guide/storage.html#Local-storage" target="_blank" rel="noreferrer">
            {t('pages.Settings.StorageSettings.providers.localFiles.localStorageDocumentation', { defaultValue: "Local Storage documentation" })}
          </a>
          {isCommunityEdition && (
            <Alert variant="info">
              <AlertDescription>
                <p>
                  {t('pages.Settings.StorageSettings.providers.localFiles.tipCreateAMydataOrLabelstudiodataDirectoryNextToTheCommandYouUseToRunLabelStudioAndLocalFileServingWillBeEnabledAutomatically', { defaultValue: "Tip: Create a \"mydata\" or \"label-studio-data\" directory next to the command you use to run Labeln                  Studio and local file serving will be enabled automatically." })}
                </p>
                <p>
                  {t('pages.Settings.StorageSettings.providers.localFiles.ifYouRunTheDockerImageTheAppStartsInLabelstudioSoYouCanBindmountYourHostFolderToLabelstudiomydataOrLabelstudiolabelstudiodataInsideTheContainerToEnableLocalFileServingWithoutExtraConfiguration', { defaultValue: "If you run the Docker image, the app starts in \"/label-studio\", so you can bind-mount your host foldern                  to \"/label-studio/mydata\" or \"/label-studio/label-studio-data\" inside the container to enable localn                  file serving without extra configuration." })}
                </p>
              </AlertDescription>
            </Alert>
          )}
        </AlertDescription>
      </Alert>
    </>
  );
};

export const localFilesProvider: ProviderConfig = {
  name: "localfiles",
  title: i18next.t('pages.Settings.StorageSettings.providers.localFiles.localFiles', { defaultValue: "Local Files" }),
  description: i18next.t('pages.Settings.StorageSettings.providers.localFiles.configureYourLocalFileStorageConnectionWithAllRequiredLabelStudioSettings', { defaultValue: "Configure your local file storage connection with all required Label Studio settings" }),
  icon: () => (
    <IconFolderOpen
      width={40}
      height={40}
      style={{
        color: "var(--color-accent-canteloupe-base)",
        filter: "drop-shadow(0px 0px 12px var(--color-accent-canteloupe-base))",
      }}
    />
  ),
  fields: [
    {
      name: "serving_warning",
      type: "message",
      content: LocalFilesServingWarning,
    },
    {
      name: "path",
      type: "text",
      label: i18next.t('pages.Settings.StorageSettings.providers.localFiles.absoluteLocalPath', { defaultValue: "Absolute local path" }),
      required: true,
      placeholder: defaultPathExample || "/data/my-folder/subdirectory",
      schema: pathSchema,
      defaultValue: defaultPathExample,
      description: i18next.t('pages.Settings.StorageSettings.providers.localFiles.thisPathMustBeAnAbsolutePathOnTheHostMachineWhereLabelStudioIsRunningAndStartWithLocalfilesdocumentrootLocal_files_document_root', { defaultValue: "This path must be an absolute path on the host machine where Label Studio is running and start with n\"{{localFilesDocumentRoot}}\" (LOCAL_FILES_DOCUMENT_ROOT).", localFilesDocumentRoot }),
    },
  ],
  layout: [{ fields: ["serving_warning"] }, { fields: ["path"] }],
};

export default localFilesProvider;
