import { useCallback, useRef, useState } from "react";
import { Button } from "@humansignal/ui";
import { LeaveBlocker, type LeaveBlockerCallbacks } from "../../../components/LeaveBlocker/LeaveBlocker";
import { modal } from "../../../components/Modal/Modal";
import { Space } from "../../../components/Space/Space";
import { useTranslation } from "react-i18next";
import i18next from "i18next";


type SaveAndLeaveButtonProps = {
  onSave: () => Promise<void>;
  text?: string;
};
const SaveAndLeaveButton = ({ onSave, text = i18next.t('pages.CreateProject.Config.UnsavedChanges.saveAndLeave', { defaultValue: "Save and Leave" }) }: SaveAndLeaveButtonProps) => {
  const { t } = useTranslation("labelstudio")
  const [saving, setSaving] = useState(false);
  const saveHandler = useCallback(async () => {
    setSaving(true);
    await onSave();
    setSaving(false);
  }, [onSave]);
  return (
    <Button size="small" onClick={saveHandler} waiting={saving} aria-label={t('pages.CreateProject.Config.UnsavedChanges.saveChanges', { defaultValue: "Save changes" })}>
      {text}
    </Button>
  );
};

type UnsavedChangesModalProps = {
  onSave: () => void;
  onCancel?: () => void;
  onDiscard?: () => void;
  cancelText?: string;
  discardText?: string;
  okText?: string;
  title?: string;
  body?: string;
};

export const unsavedChangesModal = ({
  onSave,
  onCancel,
  onDiscard,
  cancelText,
  discardText,
  okText,
  title = i18next.t('pages.CreateProject.Config.UnsavedChanges.youHaveUnsavedChanges', { defaultValue: "You have unsaved changes." }),
  body = i18next.t('pages.CreateProject.Config.UnsavedChanges.wouldYouLikeToSaveThemBeforeLeaving', { defaultValue: "Would you like to save them before leaving?" }),
  ...props
}: UnsavedChangesModalProps) => {
  let modalInstance: any;
  const saveAndLeave = async () => {
    await onSave?.();
    modalInstance?.close();
  };
  modalInstance = modal({
    ...props,
    title,
    body: () => <>{body}</>,
    allowClose: true,
    footer: (
      <Space align="end">
        <Button
          look="outlined"
          size="small"
          onClick={() => {
            onCancel?.();
            modalInstance?.close();
          }}
          autoFocus
        >
          {cancelText ?? i18next.t("pages.CreateProject.Config.UnsavedChanges.cancel", { defaultValue: "Cancel" })}
        </Button>

        {onDiscard && (
          <Button
            variant="negative"
            look="outlined"
            onClick={() => {
              onDiscard?.();
              modalInstance?.close();
            }}
            size="small"
          >
            {discardText ?? i18next.t('pages.CreateProject.Config.UnsavedChanges.discardAndLeave', { defaultValue: "Discard and leave" })}
          </Button>
        )}

        <SaveAndLeaveButton onSave={saveAndLeave} text={okText} />
      </Space>
    ),
    style: { width: 512 },
    unique: "UNSAVED_CHANGES_MODAL",
  });
};

type UnsavedChangesProps = {
  hasChanges: boolean;
  onSave: () => any;
};

/**
 * Component that blocks navigation if there are unsaved changes
 * @param hasChanges - flag that indicates if there are unsaved changes
 * @param onSave - function that should be called to save changes
 */
export const UnsavedChanges = ({ hasChanges, onSave }: UnsavedChangesProps) => {
  const saveHandlerRef = useRef(onSave);
  saveHandlerRef.current = onSave;
  const blockHandler = useCallback(async ({ continueCallback, cancelCallback }: LeaveBlockerCallbacks) => {
    const wrappedOnSave = async () => {
      const result = await saveHandlerRef.current?.();
      if (result === true) {
        continueCallback && setTimeout(continueCallback, 0);
      } else {
        // We consider that user tries to save changes, but as long as there are some errors,
        // we just close the modal to allow user to see and fix them
        cancelCallback?.();
      }
    };

    unsavedChangesModal({
      onSave: wrappedOnSave,
      onCancel: cancelCallback,
      onDiscard: continueCallback,
    });
  }, []);

  return <LeaveBlocker active={hasChanges} onBlock={blockHandler} />;
};
