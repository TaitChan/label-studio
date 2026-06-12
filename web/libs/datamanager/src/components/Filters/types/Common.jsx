import { FilterDropdown } from "../FilterDropdown";
import i18next from 'i18next'


export const Common = [
  {
    key: "empty",
    label: i18next.t('datamanager.components.Filters.types.Common.isEmpty', { ns: "datamanager", defaultValue: "is empty" }),
    input: (props) => (
      <FilterDropdown
        value={props.value ?? false}
        onChange={(value) => props.onChange(value)}
        items={[
          { value: true, label: i18next.t("datamanager.components.Filters.types.Common.yes", { ns: "datamanager", defaultValue: "yes" }) },
          { value: false, label: i18next.t("datamanager.components.Filters.types.Common.no", { ns: "datamanager", defaultValue: "no" }) },
        ]}
        disabled={props.disabled}
      />
    ),
  },
];
