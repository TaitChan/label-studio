import { FilterDropdown } from "../FilterDropdown";
import i18next from "i18next";

export const BooleanFilter = [
  {
    key: "equal",
    label: i18next.t("datamanager.components.Filters.types.Boolean.is", { ns: "datamanager", defaultValue: "is" }),
    valueType: "single",
    input: (props) => (
      <FilterDropdown
        defaultValue={props.value ?? false}
        onChange={(value) => props.onChange(value)}
        items={[
          { value: true, label: i18next.t("datamanager.components.Filters.types.Boolean.yes", { ns: "datamanager", defaultValue: "yes" }) },
          { value: false, label: i18next.t("datamanager.components.Filters.types.Boolean.no", { ns: "datamanager", defaultValue: "no" }) },
        ]}
        disabled={props.disabled}
      />
    ),
  },
];
