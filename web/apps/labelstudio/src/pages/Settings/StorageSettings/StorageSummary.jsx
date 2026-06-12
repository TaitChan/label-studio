import { format } from "date-fns/esm";
import { Button, CodeBlock, IconFileCopy, Space, Tooltip } from "@humansignal/ui";
import { DescriptionList } from "../../../components/DescriptionList/DescriptionList";
import { modal } from "../../../components/Modal/Modal";
import { Oneof } from "../../../components/Oneof/Oneof";
import { getLastTraceback } from "../../../utils/helpers";
import { useCopyText } from "@humansignal/core";
import { useTranslation } from "react-i18next";


// Component to handle copy functionality within the modal
const CopyButton = ({ msg }) => {
  const { t } = useTranslation("labelstudio");
  const [copyText, copied] = useCopyText({ defaultText: msg });

  return (
    <Button variant="neutral" icon={<IconFileCopy />} onClick={() => copyText()} disabled={copied} className="w-[7rem]">
      {copied
        ? t("pages.Settings.StorageSettings.StorageSummary.copied", { defaultValue: "Copied!" })
        : t("pages.Settings.StorageSettings.StorageSummary.copy", { defaultValue: "Copy" })}
    </Button>
  );
};

export const StorageSummary = ({ target, storage, className, storageTypes = [] }) => {
  const { t } = useTranslation("labelstudio")
  const storageStatus = storage.status.replace(/_/g, " ").replace(/(^\w)/, (match) => match.toUpperCase());
  const last_sync_count = storage.last_sync_count ? storage.last_sync_count : 0;

  const tasks_existed =
    typeof storage.meta?.tasks_existed !== "undefined" && storage.meta?.tasks_existed !== null
      ? storage.meta.tasks_existed
      : 0;
  const total_annotations =
    typeof storage.meta?.total_annotations !== "undefined" && storage.meta?.total_annotations !== null
      ? storage.meta.total_annotations
      : 0;

  // help text for tasks and annotations
  const tasks_added_help = t('pages.Settings.StorageSettings.StorageSummary.last_sync_countNewTasksAddedDuringTheLastSync', { defaultValue: "{{last_sync_count}} new tasks added during the last sync.", last_sync_count });
  const tasks_total_help = [
    t('pages.Settings.StorageSettings.StorageSummary.tasks_existedTasksThatHaveBeenFoundAndAlreadySyncedWillNotBeAddedToTheProjectAgain', { defaultValue: "{{tasks_existed}} tasks that have been found and already synced will not be added to the project again.", tasks_existed }),
    t('pages.Settings.StorageSettings.StorageSummary.valTasksHaveBeenAddedInTotalForThisStorage', { defaultValue: "{{val}} tasks have been added in total for this storage.", val: tasks_existed + last_sync_count }),
  ].join("\n");
  const annotations_help = t('pages.Settings.StorageSettings.StorageSummary.last_sync_countAnnotationsSuccessfullySavedDuringTheLastSync', { defaultValue: "{{last_sync_count}} annotations successfully saved during the last sync.", last_sync_count });
  const total_annotations_help =
    typeof storage.meta?.total_annotations !== "undefined"
      ? t('pages.Settings.StorageSettings.StorageSummary.total_annotationsTotalAnnotationsSeenInTheProjectAtTheSyncMoment', { defaultValue: "{{total_annotations}} total annotations seen in the project at the sync moment.", total_annotations: storage.meta.total_annotations })
      : "";

  const handleButtonClick = () => {
    const msg =
      t('pages.Settings.StorageSettings.StorageSummary.errorLogsForValtype', { defaultValue: "Error logs for {{val}}{{type}}", val: target === "export" ? "export " : "", type: storage.type }) +
      t('pages.Settings.StorageSettings.StorageSummary.storageIdInProjectProjectAndJobLast_sync_job', { defaultValue: "storage {{id}} in project {{project}} and job {{last_sync_job}}:", id: storage.id, project: storage.project, last_sync_job: storage.last_sync_job }) +
      `${getLastTraceback(storage.traceback)}\n\n` +
      t('pages.Settings.StorageSettings.StorageSummary.metaVal', { defaultValue: "meta = {{val}}", val: JSON.stringify(storage.meta) });

    const currentModal = modal({
      title: t('pages.Settings.StorageSettings.StorageSummary.storageSyncErrorLog', { defaultValue: "Storage Sync Error Log" }),
      body: <CodeBlock code={msg} variant="negative" className="max-h-[50vh] overflow-y-auto" />,
      footer: (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {!window.APP_SETTINGS?.whitelabel_is_active && (
            <div>
              <>
                <a
                  href="https://labelstud.io/guide/storage.html#Troubleshooting"
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={t('pages.Settings.StorageSettings.StorageSummary.learnMoreAboutCloudStorageTroubleshooting', { defaultValue: "Learn more about cloud storage troubleshooting" })}
                >
                  {t('pages.Settings.StorageSettings.StorageSummary.seeDocs', { defaultValue: "See docs" })}
                </a>{" "}
                {t('pages.Settings.StorageSettings.StorageSummary.forTroubleshootingTipsOnCloudStorageConnections', { defaultValue: "for troubleshooting tips on cloud storage connections." })}
              </>
            </div>
          )}
          <Space>
            <CopyButton msg={msg} />
            <Button variant="primary" className="w-[7rem]" onClick={() => currentModal.close()}>
              {t('pages.Settings.StorageSettings.StorageSummary.close', { defaultValue: "Close" })}
            </Button>
          </Space>
        </div>
      ),
      style: { width: "700px" },
      optimize: false,
      allowClose: true,
    });
  };

  return (
    <div className={className}>
      <DescriptionList>
        <DescriptionList.Item term={t("pages.Settings.StorageSettings.StorageSummary.type", { defaultValue: "Type" })}>
          {(storageTypes ?? []).find((s) => s.name === storage.type)?.title ?? storage.type}
        </DescriptionList.Item>

        <Oneof value={storage.type}>
          <SummaryS3 case={["s3", "s3s"]} storage={storage} />
          <GSCStorage case="gcs" storage={storage} />
          <AzureStorage case="azure" storage={storage} />
          <RedisStorage case="redis" storage={storage} />
          <LocalStorage case="localfiles" storage={storage} />
        </Oneof>

        <DescriptionList.Item
          term={t("pages.Settings.StorageSettings.StorageSummary.status", { defaultValue: "Status" })}
          help={[
            t('pages.Settings.StorageSettings.StorageSummary.initializedStorageWasAddedButNeverSyncedSufficientForStartingUriLinkResolving', { defaultValue: "Initialized: storage was added, but never synced; sufficient for starting URI link resolving" }),
            t('pages.Settings.StorageSettings.StorageSummary.queuedSyncJobIsInTheQueueButNotYetStarted', { defaultValue: "Queued: sync job is in the queue, but not yet started" }),
            t('pages.Settings.StorageSettings.StorageSummary.inProgressSyncJobIsRunning', { defaultValue: "In progress: sync job is running" }),
            t('pages.Settings.StorageSettings.StorageSummary.failedSyncJobStoppedSomeErrorsOccurred', { defaultValue: "Failed: sync job stopped, some errors occurred" }),
            t('pages.Settings.StorageSettings.StorageSummary.completedWithErrorsSyncJobCompletedButSomeTasksHadValidationErrors', { defaultValue: "Completed with errors: sync job completed but some tasks had validation errors" }),
            t('pages.Settings.StorageSettings.StorageSummary.completedSyncJobCompletedSuccessfully', { defaultValue: "Completed: sync job completed successfully" }),
          ].join("\n")}
        >
          {storageStatus === "Failed" || storageStatus === t('pages.Settings.StorageSettings.StorageSummary.completedWithErrors', { defaultValue: "Completed with errors" }) ? (
            <span
              className="cursor-pointer border-b border-dashed border-negative-border-subtle text-negative-content"
              onClick={handleButtonClick}
            >{t('pages.Settings.StorageSettings.StorageSummary.storagestatusViewLogs', { defaultValue: "{{storageStatus}} (View Logs)", storageStatus })}</span>
          ) : (
            storageStatus
          )}
        </DescriptionList.Item>

        {target === "export" ? (
          <DescriptionList.Item term={t("pages.Settings.StorageSettings.StorageSummary.annotations", { defaultValue: "Annotations" })} help={t('pages.Settings.StorageSettings.StorageSummary.annotations_helpTotal_annotations_help', { defaultValue: "{{annotations_help}}n{{total_annotations_help}}", annotations_help, total_annotations_help })}>
            <Tooltip title={annotations_help}>
              <span>{last_sync_count}</span>
            </Tooltip>
            <Tooltip title={total_annotations_help}>
              <span>{t('pages.Settings.StorageSettings.StorageSummary.total_annotationsTotal', { defaultValue: "({{total_annotations}} total)", total_annotations })}</span>
            </Tooltip>
          </DescriptionList.Item>
        ) : (
          <DescriptionList.Item term={t("pages.Settings.StorageSettings.StorageSummary.tasks", { defaultValue: "Tasks" })} help={t('pages.Settings.StorageSettings.StorageSummary.tasks_added_helpTasks_total_help', { defaultValue: "{{tasks_added_help}}n{{tasks_total_help}}", tasks_added_help, tasks_total_help })}>
            <Tooltip title={t('pages.Settings.StorageSettings.StorageSummary.tasks_added_helpTasks_total_help', { defaultValue: "{{tasks_added_help}}n{{tasks_total_help}}", tasks_added_help, tasks_total_help })} style={{ whiteSpace: "pre-wrap" }}>
              <span>{last_sync_count + tasks_existed}</span>
            </Tooltip>
            <Tooltip title={tasks_added_help}>
              <span>{t('pages.Settings.StorageSettings.StorageSummary.last_sync_countNew', { defaultValue: "({{last_sync_count}} new)", last_sync_count })}</span>
            </Tooltip>
          </DescriptionList.Item>
        )}

        <DescriptionList.Item term={t("pages.Settings.StorageSettings.StorageSummary.lastSync", { defaultValue: "Last Sync" })}>
          {storage.last_sync ? format(new Date(storage.last_sync), "MMMM dd, yyyy ∙ HH:mm:ss") : t('pages.Settings.StorageSettings.StorageSummary.notSyncedYet', { defaultValue: "Not synced yet" })}
        </DescriptionList.Item>
      </DescriptionList>
    </div>
  );
};

const SummaryS3 = ({ storage }) => {
  const { t } = useTranslation("labelstudio");
  return (
    <DescriptionList.Item term={t("pages.Settings.StorageSettings.StorageSummary.bucket", { defaultValue: "Bucket" })}>
      {storage.bucket}
    </DescriptionList.Item>
  );
};

const GSCStorage = ({ storage }) => {
  const { t } = useTranslation("labelstudio");
  return (
    <DescriptionList.Item term={t("pages.Settings.StorageSettings.StorageSummary.bucket", { defaultValue: "Bucket" })}>
      {storage.bucket}
    </DescriptionList.Item>
  );
};

const AzureStorage = ({ storage }) => {
  const { t } = useTranslation("labelstudio");
  return (
    <DescriptionList.Item term={t("pages.Settings.StorageSettings.StorageSummary.container", { defaultValue: "Container" })}>
      {storage.container}
    </DescriptionList.Item>
  );
};

const RedisStorage = ({ storage }) => {
  const { t } = useTranslation("labelstudio");
  return (
    <>
      <DescriptionList.Item term={t("pages.Settings.StorageSettings.StorageSummary.path", { defaultValue: "Path" })}>
        {storage.path}
      </DescriptionList.Item>
      <DescriptionList.Item term={t("pages.Settings.StorageSettings.StorageSummary.host", { defaultValue: "Host" })}>
        {storage.host}
        {storage.port ? `:${storage.port}` : ""}
      </DescriptionList.Item>
    </>
  );
};

const LocalStorage = ({ storage }) => {
  const { t } = useTranslation("labelstudio");
  return (
    <DescriptionList.Item term={t("pages.Settings.StorageSettings.StorageSummary.path", { defaultValue: "Path" })}>
      {storage.path}
    </DescriptionList.Item>
  );
};
