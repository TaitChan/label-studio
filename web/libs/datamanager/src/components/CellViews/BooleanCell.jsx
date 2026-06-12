import { Badge } from "@humansignal/ui";
import { useTranslation } from 'react-i18next'


const parseBoolean = (value) => {
  if ([true, 1, "true", "1", "yes"].includes(value) || !!value === true) {
    return true;
  }
  return false;
};

export const BooleanCell = (column) => {
  const { t } = useTranslation("datamanager")
  const boolValue = parseBoolean(column.value);

  if (boolValue === true) {
    return <Badge variant="positive">{t('datamanager.components.CellViews.BooleanCell.true', { defaultValue: "True" })}</Badge>;
  }
  if (boolValue === false) {
    return <Badge variant="negative">{t('datamanager.components.CellViews.BooleanCell.false', { defaultValue: "False" })}</Badge>;
  }

  return null;
};

BooleanCell.userSelectable = false;
