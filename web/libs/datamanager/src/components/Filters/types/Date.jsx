import { isValid } from "date-fns";
import { observer } from "mobx-react";
import React from "react";
import { DatePicker } from "../../Common/DatePicker/DatePicker";
import i18next from "i18next";

export const DateTimeInput = observer(({ value, range, time, onChange }) => {
  const onValueChange = React.useCallback(
    (selectedDate) => {
      let value;

      if (Array.isArray(selectedDate)) {
        const [min, max] = selectedDate
          .map((d) => (d ? new Date(d) : null))
          .map((d) => (isValid(d) ? d.toISOString() : null));

        value = { min, max };
      } else {
        value = selectedDate?.toISOString();
      }

      onChange(value);
    },
    [onChange],
  );

  const dateValue = React.useMemo(() => {
    if (range) {
      const { min, max } = value ?? {};

      return [min, max]
        .map((d) => (d === null ? undefined : d))
        .map((d) => new Date(d))
        .map((d) => (isValid(d) ? d : undefined));
    }
    const date = new Date(value === null ? undefined : value);

    return isValid(date) ? date : undefined;
  }, [range, value]);

  return (
    <DatePicker value={dateValue} selectRange={range} showTime={time === true} onChange={onValueChange} size="small" />
  );
});

export const DateFields = (extraProps) => [
  {
    key: "less",
    label: i18next.t("datamanager.components.Filters.types.Date.isBefore", { ns: "datamanager", defaultValue: "is before" }),
    valueType: "single",
    input: (props) => <DateTimeInput {...props} {...(extraProps ?? {})} />,
  },
  {
    key: "greater",
    label: i18next.t("datamanager.components.Filters.types.Date.isAfter", { ns: "datamanager", defaultValue: "is after" }),
    valueType: "single",
    input: (props) => <DateTimeInput {...props} {...(extraProps ?? {})} />,
  },
  {
    key: "in",
    label: i18next.t("datamanager.components.Filters.types.Date.isBetween", { ns: "datamanager", defaultValue: "is between" }),
    valueType: "range",
    input: (props) => <DateTimeInput range {...props} {...(extraProps ?? {})} />,
  },
  {
    key: "not_in",
    label: i18next.t("datamanager.components.Filters.types.Date.notBetween", { ns: "datamanager", defaultValue: "not between" }),
    valueType: "range",
    input: (props) => <DateTimeInput range {...props} {...(extraProps ?? {})} />,
  },
];

export const DateFilter = [...DateFields()];
