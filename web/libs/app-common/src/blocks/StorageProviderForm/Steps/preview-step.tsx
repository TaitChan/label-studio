import { Label, Toggle, Select, Tooltip, cn } from "@humansignal/ui";
import { Form, Input } from "apps/labelstudio/src/components/Form";
import { IconDocument, IconSearch } from "@humansignal/icons";
import { formatDistanceToNow } from "date-fns";
import type { ForwardedRef } from "react";
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'


interface PreviewStepProps {
  formData: any;
  formState: any;
  setFormState: (updater: (prevState: any) => any) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  action: string;
  target: string;
  type: string;
  project: string;
  storage?: any;
  onSubmit: () => void;
  formRef: ForwardedRef<unknown>;
  filesPreview: any[] | null;
  formatSize: (bytes: number) => string;
  onImportSettingsChange?: () => void;
}

const regexFilters = [
  {
    title: i18next.t('appCommon.blocks.StorageProviderForm.Steps.preview-step.images', { ns: "app-common", defaultValue: "Images" }),
    regex: ".*.(jpe?g|png|gif)$",
    blob: true,
  },
  {
    title: i18next.t('appCommon.blocks.StorageProviderForm.Steps.preview-step.videos', { ns: "app-common", defaultValue: "Videos" }),
    regex: ".*\\.(mp4|avi|mov|wmv|webm)$",
    blob: true,
  },
  {
    title: i18next.t('appCommon.blocks.StorageProviderForm.Steps.preview-step.audio', { ns: "app-common", defaultValue: "Audio" }),
    regex: ".*\\.(mp3|wav|ogg|flac)$",
    blob: true,
  },
  {
    title: i18next.t('appCommon.blocks.StorageProviderForm.Steps.preview-step.tabular', { ns: "app-common", defaultValue: "Tabular" }),
    regex: ".*\\.(csv|tsv)$",
    blob: true,
  },
  {
    title: i18next.t('appCommon.blocks.StorageProviderForm.Steps.preview-step.json', { ns: "app-common", defaultValue: "JSON" }),
    regex: ".*\\.json$",
    blob: false,
  },
  {
    title: i18next.t('appCommon.blocks.StorageProviderForm.Steps.preview-step.jsonl', { ns: "app-common", defaultValue: "JSONL" }),
    regex: ".*\\.jsonl$",
    blob: false,
  },
  {
    title: i18next.t('appCommon.blocks.StorageProviderForm.Steps.preview-step.parquet', { ns: "app-common", defaultValue: "Parquet" }),
    regex: ".*\\.parquet$",
    blob: false,
  },
  {
    title: i18next.t('appCommon.blocks.StorageProviderForm.Steps.preview-step.allTasksFiles', { ns: "app-common", defaultValue: "All Tasks Files" }),
    regex: ".*\\.(json|jsonl|parquet)$",
    blob: false,
  },
] as const;

export const PreviewStep = ({
  formData,
  formState,
  setFormState,
  handleChange,
  action,
  target,
  type,
  project,
  storage,
  onSubmit,
  formRef,
  filesPreview,
  formatSize,
  onImportSettingsChange,
}: PreviewStepProps) => {
  const { t } = useTranslation("app-common")
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('appCommon.blocks.StorageProviderForm.Steps.preview-step.configureImportSettingsPreviewData', { defaultValue: "Configure Import Settings & Preview Data" })}</h2>
        <p className="text-muted-foreground">{t('appCommon.blocks.StorageProviderForm.Steps.preview-step.setUpFiltersForYourFilesAndPreviewWhatWillBeSynchronized', { defaultValue: "Set up filters for your files and preview what will be synchronized" })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column Header */}
        <h4>{t('appCommon.blocks.StorageProviderForm.Steps.preview-step.importConfiguration', { defaultValue: "Import Configuration" })}</h4>

        {/* Right Column Header with Button */}
        <div className="flex justify-between items-center">
          <h4>{t('appCommon.blocks.StorageProviderForm.Steps.preview-step.filesPreview', { defaultValue: "Files Preview" })}</h4>
        </div>

        {/* Left Column: Configuration */}
        <div>
          <Form
            ref={formRef}
            action={action}
            params={{ target, type, project, pk: storage?.id }}
            formData={formData}
            skipEmpty={false}
            onSubmit={onSubmit}
            autoFill="off"
            autoComplete="off"
          >
            <div className="space-y-8">
              {/* Path/Bucket Prefix Section - Hide for localfiles since it has its own path field */}
              {type !== "localfiles" && (
                <div className="space-y-2">
                  <Label
                    text={t("appCommon.blocks.StorageProviderForm.Steps.preview-step.valOptional", {
                      defaultValue: "{{val}} (optional)",
                      val:
                        type === "redis"
                          ? t("appCommon.blocks.StorageProviderForm.Steps.preview-step.pathToFiles", {
                              defaultValue: "Path to Files",
                            })
                          : t("appCommon.blocks.StorageProviderForm.Steps.preview-step.bucketPrefix", {
                              defaultValue: "Bucket Prefix",
                            }),
                    })}
                  />
                  <p className="text-sm text-muted-foreground">
                    {type === "redis"
                      ? t('appCommon.blocks.StorageProviderForm.Steps.preview-step.specifyTheFolderPathWithinYourStorageWhereYourFilesAreLocated', { defaultValue: "Specify the folder path within your storage where your files are located" })
                      : t('appCommon.blocks.StorageProviderForm.Steps.preview-step.specifyTheFolderPathWithinYourBucketWhereYourFilesAreLocated', { defaultValue: "Specify the folder path within your bucket where your files are located" })}
                  </p>
                  <Input
                    id={type === "redis" ? "path" : "prefix"}
                    name={type === "redis" ? "path" : "prefix"}
                    value={type === "redis" ? (formData.path ?? "") : (formData.prefix ?? "")}
                    onChange={(e) => {
                      handleChange(e);
                      // Reset preview when prefix/path changes
                      onImportSettingsChange?.();
                    }}
                    placeholder={t('appCommon.blocks.StorageProviderForm.Steps.preview-step.pathtofilesOrLeaveEmptyForRoot', { defaultValue: "path/to/files/ or leave empty for root" })}
                    style={{ width: "100%" }}
                    required={false}
                    skip={false}
                    labelProps={{}}
                    ghost={false}
                    tooltipIcon={null}
                  />
                </div>
              )}

              {/* Import Method */}
              <div className="space-y-2">
                <Label
                  text={t("appCommon.blocks.StorageProviderForm.Steps.preview-step.importMethodOptional", {
                    defaultValue: "Import Method (optional)",
                  })}
                />
                <p className="text-sm text-muted-foreground">{t('appCommon.blocks.StorageProviderForm.Steps.preview-step.chooseHowToInterpretYourDataFromStorage', { defaultValue: "Choose how to interpret your data from storage" })}</p>
                <Select
                  name="use_blob_urls"
                  value={formData.use_blob_urls ? "Files" : "Tasks"}
                  onChange={(value) => {
                    const isFiles = value === "Files";
                    setFormState((prevState) => ({
                      ...prevState,
                      formData: {
                        ...prevState.formData,
                        use_blob_urls: isFiles,
                        regex_filter: "", // Reset regex filter when import method changes
                      },
                    }));
                    // Reset validation state when import method changes
                    onImportSettingsChange?.();
                  }}
                  options={
                    [
                      {
                        value: "Files",
                        label: t('appCommon.blocks.StorageProviderForm.Steps.preview-step.filesAutomaticallyCreatesATaskForEachStorageObjectEgJpgMp3Txt', { defaultValue: "Files - Automatically creates a task for each storage object (e.g. JPG, MP3, TXT)" }),
                      },
                      {
                        value: "Tasks",
                        label: t('appCommon.blocks.StorageProviderForm.Steps.preview-step.tasksTreatEachJsonJsonlOrParquetAsOneOrMoreTaskDefinitionsPerFile', { defaultValue: "Tasks - Treat each JSON, JSONL, or Parquet as one or more task definitions per file" }),
                      },
                    ] as any
                  }
                  placeholder={t('appCommon.blocks.StorageProviderForm.Steps.preview-step.selectImportMethod', { defaultValue: "Select import method" })}
                />
              </div>

              {/* File Filter Section */}
              <div className="space-y-2">
                <Label
                  text={t("appCommon.blocks.StorageProviderForm.Steps.preview-step.fileNameFilterOptional", {
                    defaultValue: "File Name Filter (optional)",
                  })}
                />
                <p className="text-sm text-muted-foreground">{t('appCommon.blocks.StorageProviderForm.Steps.preview-step.useRegexPatternsToFilterWhichFilesAreImported', { defaultValue: "Use regex patterns to filter which files are imported" })}</p>
                <Input
                  id="regex_filter"
                  name="regex_filter"
                  value={formData.regex_filter ?? ""}
                  onChange={(e) => {
                    handleChange(e);
                    // Reset preview when regex filter changes
                    onImportSettingsChange?.();
                  }}
                  placeholder={
                    formData.use_blob_urls
                      ? t('appCommon.blocks.StorageProviderForm.Steps.preview-step.jpgpngImportsOnlyJpgPngFiles', { defaultValue: ".*\\.(jpg|png)$ - imports only JPG, PNG files" })
                      : t('appCommon.blocks.StorageProviderForm.Steps.preview-step.jsonjsonlparquetImportsTaskDefinitions', { defaultValue: ".*\\.(json|jsonl|parquet)$ - imports task definitions" })
                  }
                  style={{ width: "100%" }}
                  label=""
                  description=""
                  footer=""
                  className=""
                  validate=""
                  required={false}
                  skip={false}
                  labelProps={{}}
                  ghost={false}
                  tooltip=""
                  tooltipIcon={null}
                />

                <div className="flex flex-wrap gap-x-2 items-center text-xs">
                  <span className="text-muted-foreground">{t('appCommon.blocks.StorageProviderForm.Steps.preview-step.commonFilters', { defaultValue: "Common filters:" })}</span>
                  {regexFilters
                    .filter((r) => r.blob === formData.use_blob_urls)
                    .map((r) => {
                      return (
                        <button
                          key={r.regex}
                          type="button"
                          className="text-blue-600 border-b border-dotted border-blue-400 hover:text-blue-800"
                          onClick={(e) => {
                            e.preventDefault();
                            setFormState((prevState) => ({
                              ...prevState,
                              formData: {
                                ...prevState.formData,
                                regex_filter: r.regex,
                              },
                            }));
                            // Reset preview when common filter is selected
                            onImportSettingsChange?.();
                          }}
                        >
                          {r.title}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Scan All Subfolders */}
              <div className="flex items-center justify-between">
                <div>
                  <Label
                    text={t("appCommon.blocks.StorageProviderForm.Steps.preview-step.scanAllSubFolders", {
                      defaultValue: "Scan all sub-folders",
                    })}
                    className="block mb-2"
                  />
                  <p className="text-sm text-muted-foreground">{t('appCommon.blocks.StorageProviderForm.Steps.preview-step.includeFilesFromAllNestedFolders', { defaultValue: "Include files from all nested folders" })}</p>
                </div>
                <Toggle
                  checked={formData.recursive_scan ?? false}
                  onChange={(e) => {
                    setFormState((prevState) => ({
                      ...prevState,
                      formData: {
                        ...prevState.formData,
                        recursive_scan: e.target.checked,
                      },
                    }));
                    // Reset validation state when recursive scan changes
                    onImportSettingsChange?.();
                  }}
                />
              </div>
            </div>
          </Form>
        </div>

        {/* Right Column: Preview Files */}
        <div className="border rounded-md overflow-hidden h-[340px]">
          <div className="bg-card h-full flex flex-col">
            {filesPreview === null ? (
              // No API response yet
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center flex-grow">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <IconDocument className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">{t('appCommon.blocks.StorageProviderForm.Steps.preview-step.noPreviewAvailable', { defaultValue: "No Preview Available" })}</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {t('appCommon.blocks.StorageProviderForm.Steps.preview-step.configureYourImportSettingsAndClickLoadPreviewToSeeASampleOfFilesThatWillBeImported', { defaultValue: "Configure your import settings and click \"Load Preview\" to see a sample of files that will be imported." })}
                </p>
              </div>
            ) : filesPreview.length === 0 ? (
              // API returned empty array
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center flex-grow">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <IconSearch className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">{t('appCommon.blocks.StorageProviderForm.Steps.preview-step.noFilesFound', { defaultValue: "No Files Found" })}</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {t('appCommon.blocks.StorageProviderForm.Steps.preview-step.noFilesMatchingYourCurrentCriteriaWereFoundTryAdjustingYourFilterSettingsAndReloadThePreview', { defaultValue: "No files matching your current criteria were found. Try adjusting your filter settings and reload the preview." })}
                </p>
              </div>
            ) : (
              // Files available - display in a table format with fixed height and scrolling
              <div className="px-2 py-2 flex-grow overflow-auto">
                <div className="grid grid-cols-1 text-xs gap-1">
                  {filesPreview.map((file, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex justify-between py-0.5 px-2 bg-neutral-surface border-b last:border-b-0 rounded-small",
                        {
                          "hover:bg-neutral-surface-hover": file.key !== null,
                        },
                      )}
                    >
                      <Tooltip title={file.key || "..."} disabled={file.key === null}>
                        <div
                          className={cn("max-w-[260px] overflow-hidden", {
                            "cursor-help": file.key !== null,
                          })}
                        >
                          {file.key ? (
                            file.key.length > 28 ? (
                              <span>
                                {t("appCommon.blocks.StorageProviderForm.Steps.preview-step.truncatedFileKey", {
                                  defaultValue: "{{start}}...{{end}}",
                                  start: file.key.slice(0, 12),
                                  end: file.key.slice(-13),
                                })}
                              </span>
                            ) : (
                              file.key
                            )
                          ) : (
                            <span className="italic">{t('appCommon.blocks.StorageProviderForm.Steps.preview-step.previewLimitReached', { defaultValue: "... preview limit reached ..." })}</span>
                          )}
                        </div>
                      </Tooltip>
                      <div className="flex items-center space-x-1 text-muted-foreground whitespace-nowrap">
                        <span>
                          {file.last_modified && formatDistanceToNow(new Date(file.last_modified), { addSuffix: true })}
                        </span>
                        <span className="mx-0.5">•</span>
                        <span>{file.size && formatSize(file.size)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
