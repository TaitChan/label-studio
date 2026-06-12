import { useEffect, useRef, useState, useCallback } from "react";
import { useHistory } from "react-router";
import { Button, Badge } from "@humansignal/ui";
import {
  IconWarningCircleFilled,
  IconTerminal,
  IconCode,
  IconBook,
  IconExternal,
  IconCopyOutline,
} from "@humansignal/icons";
import { Form, Input } from "../../components/Form";
import { Modal } from "../../components/Modal/Modal";
import { Space } from "../../components/Space/Space";
import { useAPI } from "../../providers/ApiProvider";
import { useFixedLocation, useParams } from "../../providers/RoutesProvider";
import { cn } from "../../utils/bem";
import { isDefined, copyText } from "../../utils/helpers";
import "./ExportPage.prefix.css";
import { useTranslation } from "react-i18next";
import {
  translateExportFormatDescription,
  translateExportFormatTag,
  translateExportFormatTitle,
} from "./export-format-i18n";

// Community Edition exports run synchronously in a single HTTP request.
// Large exports can exceed typical proxy timeouts, so we warn early and link to alternatives.
const LARGE_EXPORT_TASK_THRESHOLD = 1000;
const EXPORT_TIMEOUT_DOCS_URL = "https://labelstud.io/guide/export.html#Export-timeout-in-Community-Edition";
const EXPORT_CONSOLE_DOCS_URL = "https://labelstud.io/guide/export.html#Export-using-console-command";
const EXPORT_SNAPSHOT_SDK_URL = "https://api.labelstud.io/api-reference/api-reference/projects/exports/create";
const ENTERPRISE_URL = "https://docs.humansignal.com/guide/label_studio_compare";

// const formats = {
//   json: 'JSON',
//   csv: 'CSV',
// };

const downloadFile = (blob, filename) => {
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

const wait = () => new Promise((resolve) => setTimeout(resolve, 5000));

const isTimeoutLikeStatus = (status) => status === 408 || status === 502 || status === 504;

export const ExportPage = () => {
  const { t } = useTranslation("labelstudio");
  const history = useHistory();
  const location = useFixedLocation();
  const pageParams = useParams();
  const api = useAPI();

  const [previousExports, setPreviousExports] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadingMessage, setDownloadingMessage] = useState(false);
  const [availableFormats, setAvailableFormats] = useState([]);
  const [currentFormat, setCurrentFormat] = useState("JSON");
  const [projectTaskNumber, setProjectTaskNumber] = useState(null);
  const [exportIssue, setExportIssue] = useState(null);

  /** @type {import('react').RefObject<Form>} */
  const form = useRef();

  const proceedExport = async () => {
    setExportIssue(null);
    setDownloading(true);

    const messageTimer = window.setTimeout(() => {
      setDownloadingMessage(true);
    }, 1000);

    try {
      const params = form.current.assembleFormData({
        asJSON: true,
        full: true,
        booleansAsNumbers: true,
      });

      const response = await api.callApi("exportRaw", {
        params: {
          pk: pageParams.id,
          ...params,
        },
      });

      // The API proxy can return `null` for certain network errors; treat it as timeout-like
      // and show actionable guidance instead of a generic error.
      if (!response) {
        setExportIssue("timeout");
        return;
      }

      if (response.ok) {
        const blob = await response.blob();

        downloadFile(blob, response.headers.get("filename"));
        return;
      }

      if (isTimeoutLikeStatus(response.status)) {
        setExportIssue("timeout");
        return;
      }

      api.handleError(response);
    } finally {
      window.clearTimeout(messageTimer);
      setDownloading(false);
      setDownloadingMessage(false);
    }
  };

  useEffect(() => {
    if (isDefined(pageParams.id)) {
      let cancelled = false;

      api
        .callApi("previousExports", {
          params: {
            pk: pageParams.id,
          },
        })
        .then(({ export_files }) => {
          if (!cancelled) setPreviousExports(export_files.slice(0, 1));
        });

      api
        .callApi("exportFormats", {
          params: {
            pk: pageParams.id,
          },
        })
        .then((formats) => {
          if (cancelled) return;
          setAvailableFormats(formats);
          setCurrentFormat(formats[0]?.name);
        });

      // Fetch project metadata to show a proactive warning for large exports.
      // This is best-effort and should not trigger global error UI if it fails.
      api
        .callApi("project", {
          params: { pk: pageParams.id },
          errorFilter: () => true,
        })
        .then((project) => {
          if (cancelled) return;
          setProjectTaskNumber(project?.task_number ?? null);
        });

      return () => {
        cancelled = true;
      };
    }
  }, [pageParams.id]);

  return (
    <Modal
      onHide={() => {
        const path = location.pathname.replace(ExportPage.path, "");
        const search = location.search;

        history.replace(`${path}${search !== "?" ? search : ""}`);
      }}
      title={t("pages.ExportPage.ExportPage.exportData", { defaultValue: "Export data" })}
      style={{ width: 720 }}
      closeOnClickOutside={false}
      allowClose={!downloading}
      // footer="Read more about supported export formats in the Documentation."
      visible
    >
      <div className={cn("export-page").toClassName()}>
        <FormatInfo
          availableFormats={availableFormats}
          selected={currentFormat}
          onClick={(format) => setCurrentFormat(format.name)}
        />

        <ExportLargeProjectWarning taskCount={projectTaskNumber} />
        {exportIssue === "timeout" && <ExportTimeoutGuidance projectId={pageParams.id} exportType={currentFormat} />}

        <Form ref={form}>
          <Input type="hidden" name="exportType" value={currentFormat} />
        </Form>

        <div className={cn("export-page").elem("footer").toClassName()}>
          {downloadingMessage && (
            <div className={cn("export-page").elem("status-message").toClassName()}>
              {t("pages.ExportPage.ExportPage.filesAreBeingPreparedItMightTakeLongTime", {
                defaultValue: "Files are being prepared. It might take long time.",
              })}
            </div>
          )}
          <Space style={{ width: "100%" }} spread>
            <div className={cn("export-page").elem("recent").toClassName()}>
              <a className="no-go" href={EXPORT_TIMEOUT_DOCS_URL} target="_blank" rel="noreferrer">
                {t("pages.ExportPage.ExportPage.havingATimeoutOrTroubleExportingLargeProjects", {
                  defaultValue: "Having a timeout or trouble exporting large projects?",
                })}
              </a>
            </div>
            <div className={cn("export-page").elem("actions").toClassName()}>
              <Button
                className="w-[135px]"
                onClick={proceedExport}
                waiting={downloading}
                aria-label={t("pages.ExportPage.ExportPage.exportData", { defaultValue: "Export data" })}
              >
                {t("pages.ExportPage.ExportPage.export", { defaultValue: "Export" })}
              </Button>
            </div>
          </Space>
        </div>
      </div>
    </Modal>
  );
};

const FormatInfo = ({ availableFormats, selected, onClick }) => {
  const { t } = useTranslation("labelstudio");
  return (
    <div className={cn("formats").toClassName()}>
      <div className={cn("formats").elem("info").toClassName()}>
        {t("pages.ExportPage.ExportPage.youCanExportDatasetInOneOfTheFollowingFormats", {
          defaultValue: "You can export dataset in one of the following formats:",
        })}
      </div>
      <div className={cn("formats").elem("list").toClassName()}>
        {availableFormats.map((format) => (
          <div
            key={format.name}
            className={cn("formats")
              .elem("item")
              .mod({
                active: !format.disabled,
                selected: format.name === selected,
              })
              .toClassName()}
            onClick={!format.disabled ? () => onClick(format) : null}
          >
            <div className={cn("formats").elem("name").toClassName()}>
              {translateExportFormatTitle(format, t)}

              <Space size="small">
                {format.tags?.map?.((tag, index) => {
                  // Map tag text to badge variant
                  const tagLower = tag?.toLowerCase() || "";
                  let variant = "primary";
                  if (tagLower === "enterprise" || tagLower.includes("enterprise")) {
                    variant = "gradient";
                  } else if (tagLower === "beta") {
                    variant = "plum";
                  } else if (tagLower === "new" || tagLower.includes("new")) {
                    variant = "positive";
                  }

                  return (
                    <Badge key={index} variant={variant} size="small">
                      {translateExportFormatTag(tag, t)}
                    </Badge>
                  );
                })}
              </Space>
            </div>

            {format.description && (
              <div className={cn("formats").elem("description").toClassName()}>
                {translateExportFormatDescription(format, t)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={cn("formats").elem("feedback").toClassName()}>
        {t("pages.ExportPage.ExportPage.cantFindAnExportFormat", { defaultValue: "Can't find an export format?" })}
        <br />
        {t("pages.ExportPage.ExportPage.pleaseLetUsKnowIn", { defaultValue: "Please let us know in" })}{" "}
        <a className="no-go" href="https://slack.labelstud.io/?source=product-export" target="_blank" rel="noreferrer">
          {t("pages.ExportPage.ExportPage.slack", { defaultValue: "Slack" })}
        </a>{" "}
        {t("pages.ExportPage.ExportPage.orSubmitAnIssueToThe", { defaultValue: "or submit an issue to the" })}{" "}
        <a
          className="no-go"
          href="https://github.com/HumanSignal/label-studio-converter/issues"
          target="_blank"
          rel="noreferrer"
        >
          {t("pages.ExportPage.ExportPage.repository", { defaultValue: "Repository" })}
        </a>
      </div>
    </div>
  );
};

ExportPage.path = "/export";
ExportPage.modal = true;

const ExportLargeProjectWarning = ({ taskCount }) => {
  const { t } = useTranslation("labelstudio");
  if (!Number.isFinite(taskCount) || taskCount < LARGE_EXPORT_TASK_THRESHOLD) return null;

  return (
    <div className={cn("export-page").elem("warning").toClassName()}>
      <div className={cn("export-page").elem("warning-title").toClassName()}>
        {t("pages.ExportPage.ExportPage.largeProjectDetected", {
          defaultValue: "Large project detected ({{taskCount}} tasks)",
          taskCount: taskCount.toLocaleString(),
        })}
      </div>
      <div className={cn("export-page").elem("warning-body").toClassName()}>
        {t("pages.ExportPage.ExportPage.toAvoidPotentialTimeoutsDuringLargeDatasetExportsInTheCommunityEditionUseThe", {
          defaultValue:
            "To avoid potential timeouts during large dataset exports in the Community Edition, use the",
        })}{" "}
        <a className="no-go" href={EXPORT_TIMEOUT_DOCS_URL} target="_blank" rel="noreferrer">
          {t("pages.ExportPage.ExportPage.clisdkExportOptions", { defaultValue: "CLI/SDK export options" })}
        </a>{" "}
        {t("pages.ExportPage.ExportPage.orConsider", { defaultValue: "or consider" })}{" "}
        <a className="no-go" href={ENTERPRISE_URL} target="_blank" rel="noreferrer">
          {t("pages.ExportPage.ExportPage.enterprise", { defaultValue: "Enterprise" })}
        </a>{" "}
        {t("pages.ExportPage.ExportPage.forBackgroundExportsAtScale", {
          defaultValue: "for background exports at scale.",
        })}
      </div>
    </div>
  );
};

const ExportTimeoutGuidance = ({ projectId, exportType }) => {
  const { t } = useTranslation("labelstudio");
  const cliCommand = `label-studio export ${projectId} ${exportType} --export-path=<output-path>`;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyText(cliCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [cliCommand]);

  return (
    <div className={cn("export-page").elem("timeout").toClassName()}>
      <div className={cn("export-page").elem("timeout-header").toClassName()}>
        <IconWarningCircleFilled className={cn("export-page").elem("timeout-icon").toClassName()} />
        <div className={cn("export-page").elem("timeout-title").toClassName()}>
          {t("pages.ExportPage.ExportPage.exportTimedOut", { defaultValue: "Export timed out" })}
        </div>
      </div>
      <div className={cn("export-page").elem("timeout-body").toClassName()}>
        {t(
          "pages.ExportPage.ExportPage.thisExportIsProcessedSynchronouslyInTheCommunityEditionUiAndCanExceedTypicalReverseproxyTimeoutsOftenAround90SecondsForLargeDatasets",
          {
            defaultValue:
              "This export is processed synchronously in the Community Edition UI and can exceed typical reverse-proxy timeouts (often around 90 seconds) for large datasets.",
          },
        )}
      </div>

      <div className={cn("export-page").elem("timeout-actions").toClassName()}>
        <div className={cn("export-page").elem("timeout-actions-title").toClassName()}>
          {t("pages.ExportPage.ExportPage.recommendedOptions", { defaultValue: "Recommended options:" })}
        </div>
        <ul className={cn("export-page").elem("timeout-actions-list").toClassName()}>
          <li>
            <div className={cn("export-page").elem("timeout-action-item").toClassName()}>
              <IconTerminal className={cn("export-page").elem("timeout-action-icon").toClassName()} />
              <div className={cn("export-page").elem("timeout-action-content").toClassName()}>
                <span>
                  {t("pages.ExportPage.ExportPage.exportUsingThe", { defaultValue: "Export using the" })}{" "}
                  <a className="no-go" href={EXPORT_CONSOLE_DOCS_URL} target="_blank" rel="noreferrer">
                    {t("pages.ExportPage.ExportPage.consoleCommand", { defaultValue: "console command" })}
                    <IconExternal className={cn("export-page").elem("timeout-link-icon").toClassName()} />
                  </a>
                  :
                </span>
                <div className={cn("export-page").elem("timeout-code-wrapper").toClassName()}>
                  <pre className={cn("export-page").elem("timeout-code").toClassName()}>
                    <code>{cliCommand}</code>
                  </pre>
                  <button
                    type="button"
                    className={cn("export-page").elem("timeout-copy-button").toClassName()}
                    onClick={handleCopy}
                    aria-label={t("pages.ExportPage.ExportPage.copyCommand", { defaultValue: "Copy command" })}
                    title={
                      copied
                        ? t("pages.ExportPage.ExportPage.copiedExclamation", { defaultValue: "Copied!" })
                        : t("pages.ExportPage.ExportPage.copyCommand", { defaultValue: "Copy command" })
                    }
                  >
                    <IconCopyOutline className={cn("export-page").elem("timeout-copy-icon").toClassName()} />
                    {copied && (
                      <span className={cn("export-page").elem("timeout-copy-text").toClassName()}>
                        {t("pages.ExportPage.ExportPage.copied", { defaultValue: "Copied" })}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </li>
          <li>
            <div className={cn("export-page").elem("timeout-action-item").toClassName()}>
              <IconCode className={cn("export-page").elem("timeout-action-icon").toClassName()} />
              <div className={cn("export-page").elem("timeout-action-content").toClassName()}>
                {t("pages.ExportPage.ExportPage.use", { defaultValue: "Use" })}{" "}
                <a className="no-go" href={EXPORT_SNAPSHOT_SDK_URL} target="_blank" rel="noreferrer">
                  {t("pages.ExportPage.ExportPage.exportSnapshotsViaTheSdk", {
                    defaultValue: "export snapshots via the SDK",
                  })}
                  <IconExternal className={cn("export-page").elem("timeout-link-icon").toClassName()} />
                </a>{" "}
                {t("pages.ExportPage.ExportPage.toCreateAndDownloadASnapshotWithoutRelyingOnASingleUiRequest", {
                  defaultValue: "to create and download a snapshot without relying on a single UI request.",
                })}
              </div>
            </div>
          </li>
          <li>
            <div className={cn("export-page").elem("timeout-action-item").toClassName()}>
              <IconWarningCircleFilled className={cn("export-page").elem("timeout-action-icon").toClassName()} />
              <div className={cn("export-page").elem("timeout-action-content").toClassName()}>
                {t("pages.ExportPage.ExportPage.forLargescaleExportsInTheUiConsider", {
                  defaultValue: "For large-scale exports in the UI, consider",
                })}{" "}
                <a className="no-go" href={ENTERPRISE_URL} target="_blank" rel="noreferrer">
                  {t("pages.ExportPage.ExportPage.labelStudioEnterprise", { defaultValue: "Label Studio Enterprise" })}
                  <IconExternal className={cn("export-page").elem("timeout-link-icon").toClassName()} />
                </a>{" "}
                {t("pages.ExportPage.ExportPage.sinceItIsDesignedForLargescaleProjectsAndAsynchronousExports", {
                  defaultValue: "since it is designed for large-scale projects and asynchronous exports.",
                })}
              </div>
            </div>
          </li>
        </ul>
        <div className={cn("export-page").elem("timeout-footer").toClassName()}>
          <IconBook className={cn("export-page").elem("timeout-footer-icon").toClassName()} />
          <span>
            {t("pages.ExportPage.ExportPage.moreDetailsInTheDocumentation", {
              defaultValue: "More details in the documentation:",
            })}{" "}
            <a className="no-go" href={EXPORT_TIMEOUT_DOCS_URL} target="_blank" rel="noreferrer">
              {t("pages.ExportPage.ExportPage.exportTimeoutInCommunityEdition", {
                defaultValue: "Export timeout in Community Edition",
              })}
              <IconExternal className={cn("export-page").elem("timeout-link-icon").toClassName()} />
            </a>
          </span>
        </div>
      </div>
    </div>
  );
};
