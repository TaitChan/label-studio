import { useCallback, useContext, useEffect, useState } from "react";
import { Card, Menu } from "../../../components";
import { Button, Dropdown } from "@humansignal/ui";
import { ApiContext } from "../../../providers/ApiProvider";
import { StorageSummary } from "./StorageSummary";
import { IconEllipsisVertical } from "@humansignal/icons";
import { useTranslation } from 'react-i18next'


export const StorageCard = ({ rootClass, target, storage, onEditStorage, onDeleteStorage, storageTypes }) => {
  const { t } = useTranslation("labelstudio")
  const [syncing, setSyncing] = useState(false);
  const api = useContext(ApiContext);
  const [storageData, setStorageData] = useState({ ...storage });
  const [synced, setSynced] = useState(null);

  const startSync = useCallback(async () => {
    setSyncing(true);
    setSynced(null);

    const result = await api.callApi("syncStorage", {
      params: {
        target,
        type: storageData.type,
        pk: storageData.id,
      },
    });

    if (result) {
      setStorageData(result);
      setSynced(result.last_sync_count);
    }

    setSyncing(false);
  }, [storage]);

  useEffect(() => {
    setStorageData(storage);
  }, [storage]);

  const notSyncedYet = synced !== null || ["in_progress", "queued"].includes(storageData.status);

  return (
    <Card
      header={storageData.title ?? t('pages.Settings.StorageSettings.StorageCard.untitledType', { defaultValue: "Untitled {{type}}", type: storageData.type })}
      extra={
        <Dropdown.Trigger
          align="right"
          content={
            <Menu size="compact" style={{ width: 110 }}>
              <Menu.Item onClick={() => onEditStorage(storageData)}>{t('pages.Settings.StorageSettings.StorageCard.edit', { defaultValue: "Edit" })}</Menu.Item>
              <Menu.Item onClick={() => onDeleteStorage(storageData)}>{t('pages.Settings.StorageSettings.StorageCard.delete', { defaultValue: "Delete" })}</Menu.Item>
            </Menu>
          }
        >
          <Button look="string" className="-ml-3" aria-label={t('pages.Settings.StorageSettings.StorageCard.storageOptions', { defaultValue: "Storage options" })}>
            <IconEllipsisVertical />
          </Button>
        </Dropdown.Trigger>
      }
    >
      <StorageSummary
        target={target}
        storage={storageData}
        className={rootClass.elem("summary").toClassName()}
        storageTypes={storageTypes}
      />
      <div className={rootClass.elem("sync").toClassName()}>
        <div className="mt-base">
          <Button
            look="outlined"
            waiting={syncing}
            onClick={startSync}
            disabled={notSyncedYet}
            aria-label={t('pages.Settings.StorageSettings.StorageCard.syncStorage', { defaultValue: "Sync Storage" })}
          >
            {t('pages.Settings.StorageSettings.StorageCard.syncStorage', { defaultValue: "Sync Storage" })}
          </Button>
          {notSyncedYet && (
            <div className={rootClass.elem("sync-count").toClassName()}>
              {t('pages.Settings.StorageSettings.StorageCard.syncingMayTakeSomeTimePleaseRefreshThePageToSeeTheCurrentStatus', { defaultValue: "Syncing may take some time, please refresh the page to see the current status." })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
