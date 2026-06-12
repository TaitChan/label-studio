import { Button } from "@humansignal/ui";
import { IconCross } from "@humansignal/icons";
import { useTranslation } from 'react-i18next'


interface FormHeaderProps {
  title?: string;
  onClose: () => void;
}

export const FormHeader = ({ title, onClose }: FormHeaderProps) => {
  const { t } = useTranslation("app-common")
  return (
    <div className="flex justify-between items-start px-wide py-base pt-wide">
      <div>
        <h2 className="m-0 mb-tight text-headline-large font-medium text-neutral-content">{title}</h2>
        <div className="text-body-medium text-neutral-content-subtle leading-relaxed">
          {t('appCommon.blocks.StorageProviderForm.components.form-header.importYourDataFromCloudStorageProviders', { defaultValue: "Import your data from cloud storage providers" })}
        </div>
      </div>
      <Button leading={<IconCross />} look="string" onClick={onClose} />
    </div>
  );
};
