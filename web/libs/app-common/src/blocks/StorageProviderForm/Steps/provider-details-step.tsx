import { getProviderConfig } from "../providers";
import { ProviderForm } from "../components/provider-form";
import Input from "apps/labelstudio/src/components/Form/Elements/Input/Input";
import { Toggle } from "@humansignal/ui";
import { useTranslation } from 'react-i18next'


interface ProviderDetailsStepProps {
  formData: any;
  errors: Record<string, string>;
  handleProviderFieldChange: (name: string, value: any) => void;
  handleFieldBlur?: (name: string, value: any) => void;
  provider?: string;
  isEditMode?: boolean;
  target?: "import" | "export";
}

export const ProviderDetailsStep = ({
  formData,
  errors,
  handleProviderFieldChange,
  handleFieldBlur,
  provider,
  isEditMode = false,
  target,
}: ProviderDetailsStepProps) => {
  const { t } = useTranslation("app-common")
  const providerConfig = getProviderConfig(provider);

  if (!provider || !providerConfig) {
    return <div className="text-red-500">{!provider ? t('appCommon.blocks.StorageProviderForm.Steps.provider-details-step.noProviderSelected', { defaultValue: "No provider selected" }) : t('appCommon.blocks.StorageProviderForm.Steps.provider-details-step.unknownProviderProvider', { defaultValue: "Unknown provider: {{provider}}", provider })}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{providerConfig.title}</h2>
        <p className="text-muted-foreground">{providerConfig.description}</p>
      </div>

      {/* Title field - common for all providers */}
      <div className="space-y-2">
        <Input
          name="title"
          value={formData.title ?? ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProviderFieldChange("title", e.target.value)}
          placeholder={t('appCommon.blocks.StorageProviderForm.Steps.provider-details-step.enterADescriptiveNameEgLegalDocumentsTrainingData', { defaultValue: "Enter a descriptive name (e.g., 'Legal Documents', 'Training Data')" })}
          validate=""
          skip={false}
          labelProps={{}}
          ghost={false}
          tooltip=""
          tooltipIcon={null}
          required={true}
          label={t('appCommon.blocks.StorageProviderForm.Steps.provider-details-step.storageTitle', { defaultValue: "Storage Title" })}
          description={t('appCommon.blocks.StorageProviderForm.Steps.provider-details-step.thisNameWillHelpYouIdentifyThisConnectionInYourProject', { defaultValue: "This name will help you identify this connection in your project" })}
          footer={errors.title ? <span className="text-negative-content">{errors.title}</span> : ""}
          className={errors.title ? "border-negative-content" : ""}
        />
      </div>

      <ProviderForm
        provider={providerConfig}
        formData={formData}
        errors={errors}
        onChange={handleProviderFieldChange}
        onBlur={handleFieldBlur}
        isEditMode={isEditMode}
        target={target}
      />

      {/* Export-specific common fields */}
      {target === "export" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <Toggle
              checked={formData.can_delete_objects ?? false}
              onChange={(e) => handleProviderFieldChange("can_delete_objects", e.target.checked)}
              aria-label={t('appCommon.blocks.StorageProviderForm.Steps.provider-details-step.canDeleteObjectsFromStorage', { defaultValue: "Can delete objects from storage" })}
              label={t('appCommon.blocks.StorageProviderForm.Steps.provider-details-step.canDeleteObjectsFromStorage', { defaultValue: "Can delete objects from storage" })}
              description={t('appCommon.blocks.StorageProviderForm.Steps.provider-details-step.ifUncheckedAnnotationsWillNotBeDeletedFromStorage', { defaultValue: "If unchecked, annotations will not be deleted from storage" })}
            />
          </div>
        </div>
      )}
    </div>
  );
};
