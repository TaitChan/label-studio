import { useMemo, useState } from "react";
import { useHistory } from "react-router";
import { Button, Typography, useToast } from "@humansignal/ui";
import { useUpdatePageTitle, createTitleFromSegments } from "@humansignal/core";
import { Label } from "../../components/Form";
import { modal } from "../../components/Modal/Modal";
import { useModalControls } from "../../components/Modal/ModalPopup";
import Input from "../../components/Form/Elements/Input/Input";
import { Space } from "../../components/Space/Space";
import { Spinner } from "../../components/Spinner/Spinner";
import { useAPI } from "../../providers/ApiProvider";
import { useProject } from "../../providers/ProjectProvider";
import { cn } from "../../utils/bem";
import i18next from "i18next";
import { useTranslation } from "react-i18next";


export const DangerZone = () => {
  const { t } = useTranslation("labelstudio")
  const { project } = useProject();
  const api = useAPI();
  const history = useHistory();
  const toast = useToast();
  const [processing, setProcessing] = useState(null);

  useUpdatePageTitle(createTitleFromSegments([project?.title, t("pages.Settings.DangerZone.dangerZone", { defaultValue: "Danger Zone" })]));

  const showDangerConfirmation = ({ title, message, requiredWord, buttonText, onConfirm }) => {
    const isDev = process.env.NODE_ENV === "development";

    return modal({
      title,
      width: 600,
      allowClose: false,
      body: () => {
        const ctrl = useModalControls();
        const inputValue = ctrl?.state?.inputValue || "";

        return (
          <div>
            <Typography variant="body" size="medium" className="mb-tight">
              {message}
            </Typography>
            <Input
              label={t('pages.Settings.DangerZone.toProceedTypeRequiredwordInTheFieldBelow', { defaultValue: "To proceed, type \"{{requiredWord}}\" in the field below:", requiredWord })}
              value={inputValue}
              onChange={(e) => ctrl?.setState({ inputValue: e.target.value })}
              autoFocus
              data-testid="danger-zone-confirmation-input"
              autoComplete="off"
            />
          </div>
        );
      },
      footer: () => {
        const ctrl = useModalControls();
        const inputValue = (ctrl?.state?.inputValue || "").trim().toLowerCase();
        const isValid = isDev || inputValue === requiredWord.toLowerCase();

        return (
          <Space align="end">
            <Button
              variant="neutral"
              look="outline"
              onClick={() => ctrl?.hide()}
              data-testid="danger-zone-cancel-button"
            >
              {t('pages.Settings.DangerZone.cancel', { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="negative"
              disabled={!isValid}
              onClick={async () => {
                await onConfirm();
                ctrl?.hide();
              }}
              data-testid="danger-zone-confirm-button"
            >
              {buttonText}
            </Button>
          </Space>
        );
      },
    });
  };

  const handleOnClick = (type) => () => {
    const actionConfig = {
      reset_cache: {
        title: t('pages.Settings.DangerZone.resetCache', { defaultValue: "Reset Cache" }),
        message: (
          <>
            {t('pages.Settings.DangerZone.youAreAboutToResetTheCacheFor', { defaultValue: "You are about to reset the cache for" })} <strong>{project.title}</strong>{t('pages.Settings.DangerZone.thisActionCannotBeUndone', { defaultValue: ". This action cannot be undone." })}
          </>
        ),
        requiredWord: "cache",
        buttonText: t('pages.Settings.DangerZone.resetCache', { defaultValue: "Reset Cache" }),
      },
      tabs: {
        title: t('pages.Settings.DangerZone.dropAllTabs', { defaultValue: "Drop All Tabs" }),
        message: (
          <>
            {t('pages.Settings.DangerZone.youAreAboutToDropAllTabsFor', { defaultValue: "You are about to drop all tabs for" })} <strong>{project.title}</strong>{t('pages.Settings.DangerZone.thisActionCannotBeUndone', { defaultValue: ". This action cannot be undone." })}
          </>
        ),
        requiredWord: "tabs",
        buttonText: t('pages.Settings.DangerZone.dropAllTabs', { defaultValue: "Drop All Tabs" }),
      },
      project: {
        title: t('pages.Settings.DangerZone.deleteProject', { defaultValue: "Delete Project" }),
        message: (
          <>
            {t('pages.Settings.DangerZone.youAreAboutToDeleteTheProject', { defaultValue: "You are about to delete the project" })} <strong>{project.title}</strong>{t('pages.Settings.DangerZone.thisActionCannotBeUndone', { defaultValue: ". This action cannot be undone." })}
          </>
        ),
        requiredWord: "delete",
        buttonText: t('pages.Settings.DangerZone.deleteProject', { defaultValue: "Delete Project" }),
      },
    };

    const config = actionConfig[type];

    if (!config) {
      return;
    }

    showDangerConfirmation({
      ...config,
      onConfirm: async () => {
        setProcessing(type);
        try {
          if (type === "reset_cache") {
            await api.callApi("projectResetCache", {
              params: {
                pk: project.id,
              },
            });
            toast.show({ message: t('pages.Settings.DangerZone.cacheResetSuccessfully', { defaultValue: "Cache reset successfully" }) });
          } else if (type === "tabs") {
            await api.callApi("deleteTabs", {
              body: {
                project: project.id,
              },
            });
            toast.show({ message: t('pages.Settings.DangerZone.allTabsDroppedSuccessfully', { defaultValue: "All tabs dropped successfully" }) });
          } else if (type === "project") {
            await api.callApi("deleteProject", {
              params: {
                pk: project.id,
              },
            });
            toast.show({ message: t('pages.Settings.DangerZone.projectDeletedSuccessfully', { defaultValue: "Project deleted successfully" }) });
            history.replace("/projects");
          }
        } catch (error) {
          toast.show({ message: t('pages.Settings.DangerZone.errorMessage', { defaultValue: "Error: {{message}}", message: error.message }), type: "error" });
        } finally {
          setProcessing(null);
        }
      },
    });
  };

  const buttons = useMemo(
    () => [
      {
        type: "annotations",
        disabled: true, //&& !project.total_annotations_number,
        label: t('pages.Settings.DangerZone.deleteTotal_annotations_numberAnnotations', { defaultValue: "Delete {{total_annotations_number}} Annotations", total_annotations_number: project.total_annotations_number }),
      },
      {
        type: "tasks",
        disabled: true, //&& !project.task_number,
        label: t('pages.Settings.DangerZone.deleteTask_numberTasks', { defaultValue: "Delete {{task_number}} Tasks", task_number: project.task_number }),
      },
      {
        type: "predictions",
        disabled: true, //&& !project.total_predictions_number,
        label: t('pages.Settings.DangerZone.deleteTotal_predictions_numberPredictions', { defaultValue: "Delete {{total_predictions_number}} Predictions", total_predictions_number: project.total_predictions_number }),
      },
      {
        type: "reset_cache",
        help:
          t('pages.Settings.DangerZone.resetCacheMayHelpInCasesLikeIfYouAreUnableToModifyTheLabelingConfigurationDue', { defaultValue: "Reset Cache may help in cases like if you are unable to modify the labeling configuration due " }) +
          t('pages.Settings.DangerZone.toValidationErrorsConcerningExistingLabelsButYouAreConfidentThatTheLabelsDontExistYouCan', { defaultValue: "to validation errors concerning existing labels, but you are confident that the labels don't exist. You can " }) +
          t('pages.Settings.DangerZone.useThisActionToResetTheCacheAndTryAgain', { defaultValue: "use this action to reset the cache and try again." }),
        label: t('pages.Settings.DangerZone.resetCache', { defaultValue: "Reset Cache" }),
      },
      {
        type: "tabs",
        help: t('pages.Settings.DangerZone.ifTheDataManagerIsNotLoadingDroppingAllDataManagerTabsCanHelp', { defaultValue: "If the Data Manager is not loading, dropping all Data Manager tabs can help." }),
        label: t('pages.Settings.DangerZone.dropAllTabs', { defaultValue: "Drop All Tabs" }),
      },
      {
        type: "project",
        help: t('pages.Settings.DangerZone.deletingAProjectRemovesAllTasksAnnotationsAndProjectDataFromTheDatabase', { defaultValue: "Deleting a project removes all tasks, annotations, and project data from the database." }),
        label: t('pages.Settings.DangerZone.deleteProject', { defaultValue: "Delete Project" }),
      },
    ],
    [project],
  );

  return (
    <div className={cn("simple-settings").toClassName()}>
      <Typography variant="headline" size="medium" className="mb-tighter">
        {t('pages.Settings.DangerZone.dangerZone', { defaultValue: "Danger Zone" })}
      </Typography>
      <Typography variant="body" size="medium" className="text-neutral-content-subtler !mb-base">
        {t('pages.Settings.DangerZone.performTheseActionsAtYourOwnRiskActionsYouTakeOnThisPageCantBeRevertedMakeSureYourDataIsBackedUp', { defaultValue: "Perform these actions at your own risk. Actions you take on this page can't be reverted. Make sure your data isn        backed up." })}
      </Typography>

      {project.id ? (
        <div style={{ marginTop: 16 }}>
          {buttons.map((btn) => {
            const waiting = processing === btn.type;
            const disabled = btn.disabled || (processing && !waiting);

            return (
              btn.disabled !== true && (
                <div className={cn("settings-wrapper").toClassName()} key={btn.type}>
                  <Typography variant="title" size="large">
                    {btn.label}
                  </Typography>
                  {btn.help && <Label description={btn.help} style={{ width: 600, display: "block" }} />}
                  <Button
                    key={btn.type}
                    variant="negative"
                    look="outlined"
                    disabled={disabled}
                    waiting={waiting}
                    onClick={handleOnClick(btn.type)}
                    style={{ marginTop: 16 }}
                  >
                    {btn.label}
                  </Button>
                </div>
              )
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
          <Spinner size={32} />
        </div>
      )}
    </div>
  );
};

DangerZone.title = i18next.t("pages.Settings.DangerZone.dangerZone", { defaultValue: "Danger Zone" });
DangerZone.path = "/danger-zone";
