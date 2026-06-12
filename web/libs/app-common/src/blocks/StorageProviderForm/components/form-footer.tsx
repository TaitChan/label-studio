import { Button, cnm } from "@humansignal/ui";
import { useTranslation } from "react-i18next";


interface FormFooterProps {
  currentStep: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  onSave?: () => void;
  isEditMode: boolean;
  connectionChecked: boolean;
  filesPreview: any[] | null;
  testConnection: {
    isLoading: boolean;
    mutate: () => void;
  };
  loadPreview: {
    isLoading: boolean;
    mutate: () => void;
  };
  createStorage: {
    isLoading: boolean;
  };
  saveStorage?: {
    isLoading: boolean;
  };
  target?: "import" | "export";
  isProviderDisabled?: boolean;
}

export const FormFooter = ({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onSave,
  isEditMode,
  connectionChecked,
  filesPreview,
  testConnection,
  loadPreview,
  createStorage,
  saveStorage,
  target,
  isProviderDisabled = false,
}: FormFooterProps) => {
  const { t } = useTranslation("app-common");
  const showOutlinedLook = currentStep === totalSteps - 1 && target !== "export";
  const nextButtonLabel =
    currentStep < totalSteps - 1
      ? t("appCommon.blocks.StorageProviderForm.components.form-footer.next", { defaultValue: "Next" })
      : target === "export"
        ? t("appCommon.blocks.StorageProviderForm.components.form-footer.save", { defaultValue: "Save" })
        : t("appCommon.blocks.StorageProviderForm.components.form-footer.saveSync", { defaultValue: "Save & Sync" });
  let nextButtonTooltip: string | undefined;
  if (currentStep === 1 && !connectionChecked) {
    nextButtonTooltip = t("appCommon.blocks.StorageProviderForm.components.form-footer.testConnectionBeforeContinuing", {
      defaultValue: "Test connection before continuing",
    });
  } else if (currentStep === 0 && isProviderDisabled) {
    nextButtonTooltip = t(
      "appCommon.blocks.StorageProviderForm.components.form-footer.thisProviderIsNotAvailableInTheCurrentVersion",
      { defaultValue: "This provider is not available in the current version" },
    );
  }

  return (
    <div className="flex items-center justify-between p-wide border-t border-neutral-border bg-neutral-background">
      <Button look="outlined" onClick={onPrevious} disabled={currentStep === 0}>
        {t('appCommon.blocks.StorageProviderForm.components.form-footer.previous', { defaultValue: "Previous" })}
      </Button>

      <div className="flex gap-tight items-center">
        {(isEditMode ? currentStep === 0 : currentStep === 1) && (
          <>
            <Button
              waiting={testConnection.isLoading}
              onClick={testConnection.mutate}
              variant={connectionChecked ? "positive" : "primary"}
              className={cnm({
                "border-none shadow-none bg-positive-surface-content-subtle text-positive-content pointer-events-none":
                  connectionChecked,
              })}
              style={connectionChecked ? { textShadow: "none" } : {}}
            >
              {connectionChecked
                ? t("appCommon.blocks.StorageProviderForm.components.form-footer.connectionVerified", {
                    defaultValue: "Connection Verified",
                  })
                : t("appCommon.blocks.StorageProviderForm.components.form-footer.testConnection", {
                    defaultValue: "Test Connection",
                  })}
            </Button>
          </>
        )}

        {(isEditMode ? currentStep === 1 : currentStep === 2) && (
          <Button waiting={loadPreview.isLoading} onClick={loadPreview.mutate} disabled={filesPreview !== null}>
            {filesPreview !== null
              ? t("appCommon.blocks.StorageProviderForm.components.form-footer.previewLoaded", {
                  defaultValue: "✓ Preview Loaded",
                })
              : t("appCommon.blocks.StorageProviderForm.components.form-footer.loadPreview", {
                  defaultValue: "Load Preview",
                })}
          </Button>
        )}

        <Button
          onClick={onNext}
          waiting={currentStep === totalSteps - 1 && createStorage.isLoading}
          disabled={
            (!isEditMode && currentStep === 1 && !connectionChecked) || (currentStep === 0 && isProviderDisabled)
          }
          {...(showOutlinedLook ? { look: "outlined" as const } : {})}
          {...(nextButtonTooltip ? { tooltip: nextButtonTooltip } : {})}
        >
          {nextButtonLabel}
        </Button>

        {currentStep === totalSteps - 1 && target !== "export" && onSave && (
          <Button onClick={onSave} waiting={saveStorage?.isLoading}>
            {t('appCommon.blocks.StorageProviderForm.components.form-footer.save', { defaultValue: "Save" })}
          </Button>
        )}
      </div>
    </div>
  );
};
