import { observer } from "mobx-react";
import { FilterInput } from "../FilterInput";
import i18next from 'i18next'


const BaseInput = observer(({ value, onChange, placeholder }) => {
  return <FilterInput type="text" value={value} onChange={onChange} placeholder={placeholder} />;
});

export const StringFilter = [
  {
    key: "contains",
    label: i18next.t("datamanager.components.Filters.types.String.contains", { ns: "datamanager", defaultValue: "contains" }),
    valueType: "single",
    input: (props) => <BaseInput {...props} />,
  },
  {
    key: "not_contains",
    label: i18next.t('datamanager.components.Filters.types.String.notContains', { ns: "datamanager", defaultValue: "not contains" }),
    valueType: "single",
    input: (props) => <BaseInput {...props} />,
  },
  {
    key: "regex",
    label: i18next.t("datamanager.components.Filters.types.String.regex", { ns: "datamanager", defaultValue: "regex" }),
    valueType: "single",
    input: (props) => <BaseInput {...props} />,
  },
  {
    key: "equal",
    label: i18next.t("datamanager.components.Filters.types.String.equal", { ns: "datamanager", defaultValue: "equal" }),
    valueType: "single",
    input: (props) => <BaseInput {...props} />,
  },
  {
    key: "not_equal",
    label: i18next.t('datamanager.components.Filters.types.String.notEqual', { ns: "datamanager", defaultValue: "not equal" }),
    valueType: "single",
    input: (props) => <BaseInput {...props} />,
  },
];
