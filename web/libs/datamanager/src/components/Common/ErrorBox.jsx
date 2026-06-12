import { inject } from "mobx-react";
import { Button } from "@humansignal/ui";
import { Dropdown } from "@humansignal/ui";
import { Menu } from "./Menu/Menu";
import { IconInfo } from "@humansignal/icons";
import i18next from 'i18next'


const ErrorRenderer = (error, i) => {
  return (
    <Menu.Item key={i} disabled={true}>
      {error.response?.detail}
    </Menu.Item>
  );
};

const injector = inject(({ store }) => {
  return {
    errors: store.serverErrors,
  };
});

export const ErrorBox = injector(({ errors }) => {
  return errors?.size > 0 ? (
    <Dropdown.Trigger content={<Menu>{Array.from(errors.values()).map(ErrorRenderer)}</Menu>}>
      <Button type="text" leading={<IconInfo />}>
        {i18next.t('datamanager.components.Common.ErrorBox.errorsOccurred', { ns: "datamanager", defaultValue: "Errors occurred" })}
      </Button>
    </Dropdown.Trigger>
  ) : null;
});
