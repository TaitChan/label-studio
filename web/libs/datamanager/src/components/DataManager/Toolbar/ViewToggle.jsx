import { inject, observer } from "mobx-react";
import { RadioGroup } from "../../Common/RadioGroup/RadioGroup";
import { IconGrid, IconList } from "@humansignal/icons";
import { Tooltip } from "@humansignal/ui";
import i18next from 'i18next'


const viewInjector = inject(({ store }) => ({
  view: store.currentView,
}));

export const ViewToggle = viewInjector(
  observer(({ view, size, ...rest }) => {
    return (
      <RadioGroup
        size={size}
        value={view.type}
        onChange={(e) => view.setType(e.target.value)}
        {...rest}
        style={{ "--button-padding": "0 var(--spacing-tighter)" }}
      >
        <Tooltip title={i18next.t('datamanager.components.DataManager.Toolbar.ViewToggle.listView', { ns: "datamanager", defaultValue: "List view" })}>
          <div>
            <RadioGroup.Button value="list" aria-label={i18next.t('datamanager.components.DataManager.Toolbar.ViewToggle.switchToListView', { ns: "datamanager", defaultValue: "Switch to list view" })}>
              <IconList />
            </RadioGroup.Button>
          </div>
        </Tooltip>
        <Tooltip title={i18next.t('datamanager.components.DataManager.Toolbar.ViewToggle.gridView', { ns: "datamanager", defaultValue: "Grid view" })}>
          <div>
            <RadioGroup.Button value="grid" aria-label={i18next.t('datamanager.components.DataManager.Toolbar.ViewToggle.switchToGridView', { ns: "datamanager", defaultValue: "Switch to grid view" })}>
              <IconGrid />
            </RadioGroup.Button>
          </div>
        </Tooltip>
      </RadioGroup>
    );
  }),
);

export const DataStoreToggle = viewInjector(({ view, size, ...rest }) => {
  return (
    <RadioGroup value={view.target} size={size} onChange={(e) => view.setTarget(e.target.value)} {...rest}>
      <RadioGroup.Button value="tasks">{i18next.t('datamanager.components.DataManager.Toolbar.ViewToggle.tasks', { ns: "datamanager", defaultValue: "Tasks" })}</RadioGroup.Button>
      <RadioGroup.Button value="annotations" disabled>
        {i18next.t('datamanager.components.DataManager.Toolbar.ViewToggle.annotations', { ns: "datamanager", defaultValue: "Annotations" })}
      </RadioGroup.Button>
    </RadioGroup>
  );
});
