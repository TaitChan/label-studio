import { forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@humansignal/ui";
import { InlineError } from "../../../components/Error/InlineError";
import { Form, Input } from "../../../components/Form";
import { Oneof } from "../../../components/Oneof/Oneof";
import { ApiContext } from "../../../providers/ApiProvider";
import { cn } from "../../../utils/bem";
import { isDefined } from "../../../utils/helpers";
import { useTranslation } from 'react-i18next'


export const StorageForm = forwardRef(({ onSubmit, target, project, rootClass, storage, storageTypes }, ref) => {
  const { t } = useTranslation("labelstudio")
  /**@type {import('react').RefObject<Form>} */
  const api = useContext(ApiContext);
  const formRef = ref ?? useRef();
  const [type, setType] = useState(storage?.type ?? storageTypes?.[0]?.name ?? "s3");
  const [checking, setChecking] = useState(false);
  const [connectionValid, setConnectionValid] = useState(null);
  const [formFields, setFormFields] = useState([]);

  useEffect(() => {
    api
      .callApi("storageForms", {
        params: {
          target,
          type,
        },
      })
      .then((formFields) => setFormFields(formFields ?? []));
  }, [type]);

  const storageTypeSelect = {
    columnCount: 1,
    fields: [
      {
        skip: true,
        type: "select",
        name: "storage_type",
        label: t('pages.Settings.StorageSettings.StorageForm.storageType', { defaultValue: "Storage Type" }),
        disabled: !!storage,
        options: storageTypes.map(({ name, title }) => ({
          value: name,
          label: title,
        })),
        value: storage?.type ?? type,
        onChange: setType,
      },
    ],
  };

  const validateStorageConnection = useCallback(async () => {
    setChecking(true);
    setConnectionValid(null);

    const form = formRef.current;

    if (form && form.validateFields()) {
      const body = form.assembleFormData({ asJSON: true });
      const type = form.getField("storage_type").value;

      if (isDefined(storage?.id)) {
        body.id = storage.id;
      }

      // we're using api provided by the form to be able to save
      // current api context and render inline erorrs properly
      const response = await form.api.callApi("validateStorage", {
        params: {
          target,
          type,
        },
        body,
      });

      if (response?.$meta?.ok) setConnectionValid(true);
      else setConnectionValid(false);
    }
    setChecking(false);
  }, [formRef, target, type, storage]);

  const action = useMemo(() => {
    return storage ? "updateStorage" : "createStorage";
  }, [storage]);

  return (
    <Form.Builder
      ref={formRef}
      action={action}
      params={{ target, type, project, pk: storage?.id }}
      fields={[storageTypeSelect, ...(formFields ?? [])]}
      formData={{ ...(storage ?? {}) }}
      skipEmpty={false}
      onSubmit={onSubmit}
      autoFill="off"
      autoComplete="off"
    >
      <Input type="hidden" name="project" value={project} />
      <Form.Actions
        valid={connectionValid}
        extra={
          connectionValid !== null && (
            <div className={cn("form-indicator").toClassName()}>
              <Oneof value={connectionValid}>
                <span className={cn("form-indicator").elem("item").mod({ type: "success" }).toClassName()} case={true}>
                  {t('pages.Settings.StorageSettings.StorageForm.successfullyConnected', { defaultValue: "Successfully connected!" })}
                </span>
                <span className={cn("form-indicator").elem("item").mod({ type: "fail" }).toClassName()} case={false}>
                  {t('pages.Settings.StorageSettings.StorageForm.connectionFailed', { defaultValue: "Connection failed" })}
                </span>
              </Oneof>
            </div>
          )
        }
      >
        <Input type="hidden" name="project" value={project} />
        <div className="flex gap-tight">
          <Button
            type="button"
            look="outlined"
            waiting={checking}
            onClick={validateStorageConnection}
            aria-label={t('pages.Settings.StorageSettings.StorageForm.testStorageConnection', { defaultValue: "Test storage connection" })}
          >
            {t('pages.Settings.StorageSettings.StorageForm.checkConnection', { defaultValue: "Check Connection" })}
          </Button>
          <Button type="submit" aria-label={storage ? t('pages.Settings.StorageSettings.StorageForm.saveStorageSettings', { defaultValue: "Save storage settings" }) : t('pages.Settings.StorageSettings.StorageForm.addStorage', { defaultValue: "Add storage" })}>
            {storage ? t("pages.Settings.StorageSettings.StorageForm.save", { defaultValue: "Save" }) : t("pages.Settings.StorageSettings.StorageForm.addStorage2", { defaultValue: "Add Storage" })}
          </Button>
        </div>
      </Form.Actions>

      <InlineError />
    </Form.Builder>
  );
});
