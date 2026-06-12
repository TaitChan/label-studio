import { IconSortDown, IconSortUp } from "@humansignal/icons";
import { Button, ButtonGroup } from "@humansignal/ui";
import { inject, observer } from "mobx-react";
import { ColumnPicker } from "../../Common/ColumnPicker";
import { Space } from "../../Common/Space/Space";
import "./OrderButton.prefix.css";
import i18next from 'i18next'


const orderableFilter = (col) => col.orderable ?? col.original?.orderable;

const injector = inject(({ store }) => {
  const view = store?.currentView;

  return {
    view,
    ordering: view?.currentOrder,
    columns: Array.from(view?.targetColumns ?? []),
  };
});

export const OrderButton = injector(
  observer(({ size, ordering, view, columns, ...rest }) => {
    return (
      <Space style={{ fontSize: 12 }} className="orderButton">
        <ButtonGroup collapsed {...rest}>
          <ColumnPicker
            columns={columns}
            columnFilter={orderableFilter}
            value={ordering?.field ?? null}
            onChange={(key) => view.setOrdering(key)}
            placeholder={i18next.t('datamanager.components.DataManager.Toolbar.OrderButton.orderBy', { ns: "datamanager", defaultValue: "Order by" })}
            triggerProps={{
              style: {
                padding: "var(--spacing-tight)",
              },
            }}
          />

          <Button
            size={size}
            look="outlined"
            variant="neutral"
            disabled={!ordering}
            onClick={() => view.setOrdering(ordering?.field)}
            aria-label={ordering?.desc
              ? i18next.t("datamanager.components.DataManager.Toolbar.OrderButton.sortAscending", { ns: "datamanager",
                  defaultValue: "Sort ascending",
                })
              : i18next.t("datamanager.components.DataManager.Toolbar.OrderButton.sortDescending", { ns: "datamanager",
                  defaultValue: "Sort descending",
                })}
          >
            {ordering?.desc ? <IconSortUp /> : <IconSortDown />}
          </Button>
        </ButtonGroup>
      </Space>
    );
  }),
);
