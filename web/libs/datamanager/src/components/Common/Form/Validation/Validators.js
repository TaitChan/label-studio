import { isEmptyString } from "../../../../utils/helpers";
import { isDefined } from "../../../../utils/utils";
import "./Validation.prefix.css";
import i18next from 'i18next'


export const required = (fieldName, value) => {
  if (!isDefined(value) || isEmptyString(value)) {
    return i18next.t('datamanager.components.Common.Form.Validation.Validators.fieldnameIsRequired', { ns: "datamanager", defaultValue: "{{fieldName}} is required", fieldName });
  }
};

export const matchPattern = (pattern) => (fieldName, value) => {
  pattern = typeof pattern === "string" ? new RegExp(pattern) : pattern;

  if (!isEmptyString(value) && value.match(pattern) === null) {
    return i18next.t('datamanager.components.Common.Form.Validation.Validators.fieldnameMustMatchThePatternPattern', { ns: "datamanager", defaultValue: "{{fieldName}} must match the pattern {{pattern}}", fieldName, pattern });
  }
};

export const json = (fieldName, value) => {
  const err = i18next.t('datamanager.components.Common.Form.Validation.Validators.fieldnameMustBeValidJsonString', { ns: "datamanager", defaultValue: "{{fieldName}} must be valid JSON string", fieldName });

  if (!isDefined(value) || value.trim().length === 0) return;

  if (/^(\{|\[)/.test(value) === false || /(\}|\])$/.test(value) === false) {
    return err;
  }

  try {
    JSON.parse(value);
  } catch (e) {
    return err;
  }
};

export const regexp = (fieldName, value) => {
  try {
    new RegExp(value);
  } catch (err) {
    return i18next.t('datamanager.components.Common.Form.Validation.Validators.fieldnameMustBeAValidRegularExpression', { ns: "datamanager", defaultValue: "{{fieldName}} must be a valid regular expression", fieldName });
  }
};
