import { formatDistanceToNow, format, parseISO } from "date-fns";
import { useCallback, useContext } from "react";

import truncate from "truncate-middle";
import { Menu } from "../../../components";
import { Button, Dropdown } from "@humansignal/ui";
import { confirm } from "../../../components/Modal/Modal";
import { Oneof } from "../../../components/Oneof/Oneof";
import { IconEllipsis } from "@humansignal/icons";
import { Tooltip } from "@humansignal/ui";
import { ApiContext } from "../../../providers/ApiProvider";
import { cn } from "../../../utils/bem";

import "./MachineLearningList.prefix.css";
import { useTranslation } from 'react-i18next'


export const MachineLearningList = ({ backends, fetchBackends, onEdit, onTestRequest, onStartTraining }) => {
  const api = useContext(ApiContext);

  const onDeleteModel = useCallback(
    async (backend) => {
      await api.callApi("deleteMLBackend", {
        params: {
          pk: backend.id,
        },
      });
      await fetchBackends();
    },
    [fetchBackends, api],
  );

  return (
    <div>
      {backends.map((backend) => (
        <BackendCard
          key={backend.id}
          backend={backend}
          onStartTrain={onStartTraining}
          onDelete={onDeleteModel}
          onEdit={onEdit}
          onTestRequest={onTestRequest}
        />
      ))}
    </div>
  );
};

const BackendCard = ({ backend, onStartTrain, onEdit, onDelete, onTestRequest }) => {
  const { t } = useTranslation("labelstudio")
  const confirmDelete = useCallback(
    (backend) => {
      confirm({
        title: t('pages.Settings.MachineLearningSettings.MachineLearningList.deleteMlBackend', { defaultValue: "Delete ML Backend" }),
        body: t('pages.Settings.MachineLearningSettings.MachineLearningList.thisActionCannotBeUndoneAreYouSure', { defaultValue: "This action cannot be undone. Are you sure?" }),
        buttonLook: "destructive",
        onOk() {
          onDelete?.(backend);
        },
      });
    },
    [backend, onDelete],
  );

  const rootClass = cn("backend-card");

  return (
    <div className={rootClass.toClassName()}>
      <div className={rootClass.elem("title-container").toClassName()}>
        <div>
          <BackendState backend={backend} />
          <div className={rootClass.elem("title").toClassName()}>{backend.title}</div>
        </div>

        <div className={rootClass.elem("menu").toClassName()}>
          <Dropdown.Trigger
            align="right"
            content={
              <Menu size="medium" contextual>
                <Menu.Item onClick={() => onEdit(backend)}>Edit</Menu.Item>
                <Menu.Item onClick={() => onTestRequest(backend)}>Send Test Request</Menu.Item>
                <Menu.Item onClick={() => onStartTrain(backend)}>{t('pages.Settings.MachineLearningSettings.MachineLearningList.startTraining', { defaultValue: "Start Training" })}</Menu.Item>
                <Menu.Divider />
                <Menu.Item onClick={() => confirmDelete(backend)} isDangerous>
                  {t('pages.Settings.MachineLearningSettings.MachineLearningList.delete', { defaultValue: "Delete" })}
                </Menu.Item>
              </Menu>
            }
          >
            <Button look="string" size="small" className="!p-0" aria-label={t('pages.Settings.MachineLearningSettings.MachineLearningList.machineLearningModelOptions', { defaultValue: "Machine learning model options" })}>
              <IconEllipsis />
            </Button>
          </Dropdown.Trigger>
        </div>
      </div>

      <div className={rootClass.elem("meta").toClassName()}>
        <div className={rootClass.elem("group").toClassName()}>{truncate(backend.url, 20, 10, "...")}</div>
        <div className={rootClass.elem("group").toClassName()}>
          <Tooltip title={format(parseISO(backend.created_at), "yyyy-MM-dd HH:mm:ss")}>
            <span>
              {t('pages.Settings.MachineLearningSettings.MachineLearningList.creatednbsp', { defaultValue: "Created&nbsp;" })}
              {formatDistanceToNow(parseISO(backend.created_at), {
                addSuffix: true,
              })}
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

const BackendState = ({ backend }) => {
  const { t } = useTranslation("labelstudio")
  const { state } = backend;

  return (
    <div className={cn("ml").elem("status").toClassName()}>
      <span className={cn("ml").elem("indicator").mod({ state }).toClassName()} />
      <Oneof value={state} className={cn("ml").elem("status-label").toClassName()}>
        <span case="DI">{t('pages.Settings.MachineLearningSettings.MachineLearningList.disconnected', { defaultValue: "Disconnected" })}</span>
        <span case="CO">{t('pages.Settings.MachineLearningSettings.MachineLearningList.connected', { defaultValue: "Connected" })}</span>
        <span case="ER">{t('pages.Settings.MachineLearningSettings.MachineLearningList.error', { defaultValue: "Error" })}</span>
        <span case="TR">{t('pages.Settings.MachineLearningSettings.MachineLearningList.training', { defaultValue: "Training" })}</span>
        <span case="PR">{t('pages.Settings.MachineLearningSettings.MachineLearningList.predicting', { defaultValue: "Predicting" })}</span>
      </Oneof>
    </div>
  );
};
