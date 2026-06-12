import i18next from "i18next";

/**
 * 后端 /api/dm/actions 下发的 title / dialog / form 文案映射到 datamanager.actions.{id}.* key。
 * en 默认值来自 API；locales 由 seed-dm-action-keys 维护。
 */

export function translateActionTitle(action) {
  if (!action?.title) return action?.title;
  return i18next.t(`datamanager.actions.${action.id}.title`, {
    ns: "datamanager",
    defaultValue: action.title,
  });
}

export function translateActionDialogTitle(action) {
  const title = action?.dialog?.title;
  if (!title) return title;
  return i18next.t(`datamanager.actions.${action.id}.dialogTitle`, {
    ns: "datamanager",
    defaultValue: title,
  });
}

export function translateActionDialogText(action, fallbackText) {
  const text = action?.dialog?.text ?? fallbackText;
  if (!text) return text;
  return i18next.t(`datamanager.actions.${action.id}.dialogText`, {
    ns: "datamanager",
    defaultValue: text,
  });
}

export function translateActionDisabledReason(action) {
  const reason = action?.disabled_reason ?? action?.disabledReason;
  if (!reason) return reason;
  return i18next.t(`datamanager.actions.${action.id}.disabledReason`, {
    ns: "datamanager",
    defaultValue: reason,
  });
}

function translateFormField(actionId, field) {
  if (!field?.name) return field;

  const next = { ...field };

  if (field.label != null) {
    next.label = i18next.t(`datamanager.actions.${actionId}.form.${field.name}.label`, {
      ns: "datamanager",
      defaultValue: field.label,
    });
  }

  if (field.placeholder != null) {
    next.placeholder = i18next.t(`datamanager.actions.${actionId}.form.${field.name}.placeholder`, {
      ns: "datamanager",
      defaultValue: field.placeholder,
    });
  }

  return next;
}

/** 翻译 action 确认弹窗里 Form.Builder 的 fields（保留 API 动态后缀作 defaultValue）。 */
export function translateActionFormFields(actionId, formSections) {
  if (!Array.isArray(formSections)) return formSections;

  return formSections.map((section) => {
    if (!section?.fields) return section;
    return {
      ...section,
      fields: section.fields.map((field) => translateFormField(actionId, field)),
    };
  });
}
