import { IconChevronDown, IconChevronRight, IconTrash } from "@humansignal/icons";
import { Button, Spinner, Badge, EnterpriseBadge } from "@humansignal/ui";
import { inject, observer } from "mobx-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActions } from "../../../hooks/useActions";
import { cn } from "../../../utils/bem";
import { FF_LOPS_E_3, isFF } from "../../../utils/feature-flags";
import { Dropdown } from "@humansignal/ui";
import Form from "../../Common/Form/Form";
import { Menu } from "../../Common/Menu/Menu";
import { Modal } from "../../Common/Modal/ModalPopup";
import "./ActionsButton.prefix.css";
import i18next from "i18next";
import {
  translateActionDialogText,
  translateActionDialogTitle,
  translateActionDisabledReason,
  translateActionFormFields,
  translateActionTitle,
} from "../../../utils/dm-action-i18n";


const isFFLOPSE3 = isFF(FF_LOPS_E_3);
const injector = inject(({ store }) => ({
  store,
  hasSelected: store.currentView?.selected?.hasSelected ?? false,
}));

const DialogContent = ({ text, form, formRef, store, action }) => {
  const [formData, setFormData] = useState(form);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!formData) {
      setIsLoading(true);
      store
        .fetchActionForm(action.id)
        .then((form) => {
          setFormData(form);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [formData, store, action.id]);

  const fields = formData?.toJSON ? formData.toJSON() : formData;
  const translatedFields = translateActionFormFields(action.id, fields);

  return (
    <div className={cn("dialog-content").toClassName()}>
      <div className={cn("dialog-content").elem("text").toClassName()}>{text}</div>
      {isLoading && (
        <div
          className={cn("dialog-content").elem("loading").toClassName()}
          style={{ display: "flex", justifyContent: "center", marginTop: 16 }}
        >
          <Spinner />
        </div>
      )}
      {formData && (
        <div className={cn("dialog-content").elem("form").toClassName()} style={{ paddingTop: 16 }}>
          <Form.Builder ref={formRef} fields={translatedFields} autosubmit={false} withActions={false} />
        </div>
      )}
    </div>
  );
};

const ActionButton = ({ action, parentRef, store, formRef }) => {
  const isDeleteAction = action.id.includes("delete");
  const hasChildren = !!action.children?.length;
  const submenuRef = useRef();
  const actionTitle = translateActionTitle(action);
  const disabledReason = translateActionDisabledReason(action);

  const onClick = useCallback(
    (e) => {
      e.preventDefault();
      if (action.disabled) return;
      action?.callback
        ? action?.callback(store.currentView?.selected?.snapshot, action)
        : invokeAction(action, isDeleteAction, store, formRef);
      parentRef?.current?.close?.();
    },
    [store.currentView?.selected, action, isDeleteAction, parentRef, store, formRef],
  );

  const titleContainer = (
    <Menu.Item
      key={action.id}
      className={cn("actionButton")
        .mod({
          hasSeperator: isDeleteAction,
          hasSubMenu: action.children?.length > 0,
          isSeparator: action.isSeparator,
          isTitle: action.isTitle,
          danger: isDeleteAction,
          disabled: action.disabled,
        })
        .toClassName()}
      size="small"
      onClick={onClick}
      aria-label={actionTitle}
    >
      <div
        className={cn("actionButton").elem("titleContainer").toClassName()}
        {...(action.disabled ? { title: disabledReason } : {})}
      >
        <div className={cn("actionButton").elem("title").toClassName()}>
          {actionTitle}
          {action.enterprise_badge && <EnterpriseBadge className="ml-tightest" style="ghost" />}
        </div>
        {hasChildren ? <IconChevronRight className={cn("actionButton").elem("icon").toClassName()} /> : null}
      </div>
    </Menu.Item>
  );

  if (hasChildren) {
    return (
      <Dropdown.Trigger
        key={action.id}
        align="top-right-outside"
        toggle={false}
        ref={submenuRef}
        content={
          <ul className={cn("actionButton-submenu").toClassName()}>
            {action.children.map((childAction) => (
              <ActionButton
                key={childAction.id}
                action={childAction}
                parentRef={parentRef}
                store={store}
                formRef={formRef}
              />
            ))}
          </ul>
        }
      >
        {titleContainer}
      </Dropdown.Trigger>
    );
  }

  let menuVariant;
  if (isDeleteAction) {
    menuVariant = "negative";
  }

  return (
    <Menu.Item
      size="small"
      key={action.id}
      variant={menuVariant}
      onClick={onClick}
      className={`actionButton${action.isSeparator ? "_isSeparator" : action.isTitle ? "_isTitle" : ""} ${
        action.disabled ? "actionButton_disabled" : ""
      }`}
      icon={isDeleteAction && <IconTrash />}
      title={action.disabled ? disabledReason : null}
      aria-label={actionTitle}
      disabled={action.disabled}
      tooltip={disabledReason}
      tooltipAlignment="bottom-center"
    >
      <span className="flex items-center justify-between gap-base w-full">
        {actionTitle}
        {action.enterprise_badge && <EnterpriseBadge style="ghost" children="" />}
      </span>
    </Menu.Item>
  );
};

const invokeAction = (action, destructive, store, formRef) => {
  if (action.dialog) {
    const { type: dialogType, text, form, title } = action.dialog;
    const dialog = Modal[dialogType] ?? Modal.confirm;

    // Generate dynamic content for destructive actions
    let dialogTitle = title ? translateActionDialogTitle(action) : title;
    let dialogText = translateActionDialogText(action, text);
    let okButtonText = i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.ok", {
      ns: "datamanager",
      defaultValue: "OK",
    });
    let deleteObjectType;

    if (destructive && !title) {
      // Extract object type from action ID and title
      const objectMap = {
        delete_tasks: i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.deleteObjectType.tasks", {
          ns: "datamanager", defaultValue: "tasks",
        }),
        delete_annotations: i18next.t(
          "datamanager.components.DataManager.Toolbar.ActionsButton.deleteObjectType.annotations",
          { ns: "datamanager", defaultValue: "annotations" },
        ),
        delete_predictions: i18next.t(
          "datamanager.components.DataManager.Toolbar.ActionsButton.deleteObjectType.predictions",
          { ns: "datamanager", defaultValue: "predictions" },
        ),
        delete_reviews: i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.deleteObjectType.reviews", {
          ns: "datamanager", defaultValue: "reviews",
        }),
        delete_reviewers: i18next.t(
          "datamanager.components.DataManager.Toolbar.ActionsButton.deleteObjectType.reviewAssignments",
          { ns: "datamanager", defaultValue: "review assignments" },
        ),
        delete_annotators: i18next.t(
          "datamanager.components.DataManager.Toolbar.ActionsButton.deleteObjectType.annotatorAssignments",
          { ns: "datamanager", defaultValue: "annotator assignments" },
        ),
        delete_ground_truths: i18next.t(
          "datamanager.components.DataManager.Toolbar.ActionsButton.deleteObjectType.groundTruths",
          { ns: "datamanager", defaultValue: "ground truths" },
        ),
      };

      deleteObjectType =
        objectMap[action.id] ||
        action.title.toLowerCase().replace("delete ", "") ||
        i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.deleteObjectType.items", {
          ns: "datamanager", defaultValue: "items",
        });
      dialogTitle = i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.deleteSelectedObjecttype", {
        ns: "datamanager",
        defaultValue: "Delete selected {{objectType}}?",
        objectType: deleteObjectType,
      });

      // Convert to title case for button text
      const titleCaseObject = deleteObjectType
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      okButtonText = i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.deleteTitlecaseobject", {
        ns: "datamanager",
        defaultValue: "Delete {{titleCaseObject}}",
        titleCaseObject,
      });
    }

    if (destructive && !form) {
      // Use standardized warning message for simple delete actions
      const objectType =
        deleteObjectType ??
        i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.deleteObjectType.items", {
          ns: "datamanager", defaultValue: "items",
        });
      dialogText = i18next.t(
        "datamanager.components.DataManager.Toolbar.ActionsButton.youAreAboutToDeleteTheSelectedObjecttypeThisCantBeUndone",
        {
          ns: "datamanager",
          defaultValue: "You are about to delete the selected {{objectType}}.\n\nThis can't be undone.",
          objectType,
        },
      );
    }

    dialog({
      title: dialogTitle
        ? dialogTitle
        : destructive
          ? i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.destructiveAction", { ns: "datamanager",
              defaultValue: "Destructive action",
            })
          : i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.confirmAction", { ns: "datamanager",
              defaultValue: "Confirm action",
            }),
      body: (
        <DialogContent text={dialogText} form={form} formRef={formRef} store={store} action={action} />
      ),
      buttonLook: destructive ? "negative" : "primary",
      okText: destructive ? okButtonText : undefined,
      onOk() {
        const body = formRef.current?.assembleFormData({ asJSON: true });

        store.SDK.invoke("actionDialogOk", action.id, { body });
        store.invokeAction(action.id, { body });
      },
      closeOnClickOutside: false,
    });
  } else {
    store.invokeAction(action.id);
  }
};

export const ActionsButton = injector(
  observer(({ store, size, hasSelected, ...rest }) => {
    const formRef = useRef();
    const selectedCount = store.currentView.selectedCount;
    const [isOpen, setIsOpen] = useState(false);

    // Use TanStack Query hook for fetching actions
    const {
      actions: serverActions,
      isLoading,
      isFetching,
    } = useActions({
      enabled: isOpen,
      projectId: store.SDK.projectId,
    });

    const actions = useMemo(() => {
      return [...store.availableActions, ...serverActions].filter((a) => !a.hidden).sort((a, b) => a.order - b.order);
    }, [store.availableActions, serverActions]);
    const actionButtons = actions.map((action) => (
      <ActionButton key={action.id} action={action} parentRef={formRef} store={store} formRef={formRef} />
    ));
    const recordTypeLabel =
      isFFLOPSE3 && store.SDK.type === "DE"
        ? i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.record", {
            ns: "datamanager",
            defaultValue: "Record",
          })
        : i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.task", {
            ns: "datamanager",
            defaultValue: "Task",
          });

    return (
      <Dropdown.Trigger
        content={
          <Menu size="compact">
            {isLoading || isFetching ? (
              <Menu.Item data-testid="loading-actions" disabled>
                {i18next.t('datamanager.components.DataManager.Toolbar.ActionsButton.loadingActions', { ns: "datamanager", defaultValue: "Loading actions..." })}
              </Menu.Item>
            ) : (
              actionButtons
            )}
          </Menu>
        }
        openUpwardForShortViewport={false}
        disabled={!hasSelected}
        onToggle={setIsOpen}
      >
        <Button
          size={size}
          variant="neutral"
          look="outlined"
          disabled={!hasSelected}
          trailing={<IconChevronDown />}
          aria-label={i18next.t('datamanager.components.DataManager.Toolbar.ActionsButton.tasksActions', { ns: "datamanager", defaultValue: "Tasks Actions" })}
          {...rest}
        >
          {selectedCount > 0
            ? i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.selectedCountRecordType", {
                ns: "datamanager",
                count: selectedCount,
                defaultValue: "{{count}} {{recordTypeLabel}}",
                defaultValue_plural: "{{count}} {{recordTypeLabel}}s",
                recordTypeLabel,
              })
            : i18next.t("datamanager.components.DataManager.Toolbar.ActionsButton.actions", {
                ns: "datamanager",
                defaultValue: "Actions",
              })}
        </Button>
      </Dropdown.Trigger>
    );
  }),
);
