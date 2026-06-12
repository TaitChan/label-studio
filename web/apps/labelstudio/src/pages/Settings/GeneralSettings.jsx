import { Badge, Button, Select, Typography, Tooltip, EnterpriseBadge } from "@humansignal/ui";
import { useCallback, useContext } from "react";
import { IconSpark } from "@humansignal/icons";
import { Form, Input, TextArea } from "../../components/Form";
import { RadioGroup } from "../../components/Form/Elements/RadioGroup/RadioGroup";
import { ProjectContext } from "../../providers/ProjectProvider";
import { cn } from "../../utils/bem";
import { HeidiTips } from "../../components/HeidiTips/HeidiTips";
import { FF_LSDV_E_297, isFF } from "../../utils/feature-flags";
import { createURL } from "../../components/HeidiTips/utils";
import i18next from "i18next";
import { useTranslation } from "react-i18next";


export const GeneralSettings = () => {
  const { t } = useTranslation("labelstudio")
  const { project, fetchProject } = useContext(ProjectContext);

  const updateProject = useCallback(() => {
    if (project.id) fetchProject(project.id, true);
  }, [project]);

  const colors = ["#FDFDFC", "#FF4C25", "#FF750F", "#ECB800", "#9AC422", "#34988D", "#617ADA", "#CC6FBE"];

  const samplings = [
    { value: "Sequential", label: t('pages.Settings.GeneralSettings.sequential', { defaultValue: "Sequential" }), description: t('pages.Settings.GeneralSettings.tasksAreOrderedByTaskId', { defaultValue: "Tasks are ordered by Task ID" }) },
    { value: "Uniform", label: t('pages.Settings.GeneralSettings.random', { defaultValue: "Random" }), description: t('pages.Settings.GeneralSettings.tasksAreChosenWithUniformRandom', { defaultValue: "Tasks are chosen with uniform random" }) },
  ];

  return (
    <div className={cn("general-settings").toClassName()}>
      <div className={cn("general-settings").elem("wrapper").toClassName()}>
        <h1>{t('pages.Settings.GeneralSettings.generalSettings', { defaultValue: "General Settings" })}</h1>
        <div className={cn("settings-wrapper").toClassName()}>
          <Form action="updateProject" formData={{ ...project }} params={{ pk: project.id }} onSubmit={updateProject}>
            <Form.Row columnCount={1} rowGap="16px">
              <Input name="title" label={t('pages.Settings.GeneralSettings.projectName', { defaultValue: "Project Name" })} />

              <TextArea name="description" label={t("pages.Settings.GeneralSettings.description", { defaultValue: "Description" })} style={{ minHeight: 128 }} />
              {isFF(FF_LSDV_E_297) && (
                <div className={cn("workspace-placeholder").toClassName()}>
                  <div className={cn("workspace-placeholder").elem("badge-wrapper").toClassName()}>
                    <div className={cn("workspace-placeholder").elem("title").toClassName()}>{t('pages.Settings.GeneralSettings.workspace', { defaultValue: "Workspace" })}</div>
                    <EnterpriseBadge size="small" className="ml-2" />
                  </div>
                  <Select placeholder={t('pages.Settings.GeneralSettings.selectAnOption', { defaultValue: "Select an option" })} disabled options={[]} />
                  <Typography size="small" className="my-tight">
                    {t('pages.Settings.GeneralSettings.simplifyProjectManagementByOrganizingProjectsIntoWorkspaces', { defaultValue: "Simplify project management by organizing projects into workspaces." })}{" "}
                    <a
                      target="_blank"
                      href={createURL(
                        "https://docs.humansignal.com/guide/manage_projects#Create-workspaces-to-organize-projects",
                        {
                          experiment: "project_settings_tip",
                          treatment: "simplify_project_management",
                        },
                      )}
                      rel="noreferrer"
                      className="underline hover:no-underline"
                    >
                      {t('pages.Settings.GeneralSettings.learnMore', { defaultValue: "Learn more" })}
                    </a>
                  </Typography>
                </div>
              )}
              <RadioGroup name="color" label={t("pages.Settings.GeneralSettings.color", { defaultValue: "Color" })} size="large" labelProps={{ size: "large" }}>
                {colors.map((color) => (
                  <RadioGroup.Button key={color} value={color}>
                    <div className={cn("color").toClassName()} style={{ "--background": color }} />
                  </RadioGroup.Button>
                ))}
              </RadioGroup>

              <RadioGroup label={t('pages.Settings.GeneralSettings.taskSampling', { defaultValue: "Task Sampling" })} labelProps={{ size: "large" }} name="sampling" simple>
                {samplings.map(({ value, label, description }) => (
                  <RadioGroup.Button
                    key={value}
                    value={value}
                    label={label}
                    description={description}
                  />
                ))}
                {isFF(FF_LSDV_E_297) && (
                  <RadioGroup.Button
                    key="uncertainty-sampling"
                    value=""
                    label={
                      <>
                        {t('pages.Settings.GeneralSettings.uncertaintySampling', { defaultValue: "Uncertainty sampling" })}{" "}
                        <Tooltip title={t('pages.Settings.GeneralSettings.availableOnLabelStudioEnterprise', { defaultValue: "Available on Label Studio Enterprise" })}>
                          <Badge
                            variant="enterprise"
                            icon={<IconSpark />}
                            size="small"
                            style="ghost"
                            className="ml-tightest"
                          />
                        </Tooltip>
                      </>
                    }
                    disabled
                    description={
                      <>
                        {t('pages.Settings.GeneralSettings.tasksAreChosenAccordingToModelUncertaintyScoreActiveLearningMode', { defaultValue: "Tasks are chosen according to model uncertainty score (active learning mode)." })}{" "}
                        <a
                          target="_blank"
                          href={createURL("https://docs.humansignal.com/guide/active_learning", {
                            experiment: "project_settings_workspace",
                            treatment: "workspaces",
                          })}
                          rel="noreferrer"
                        >
                          {t('pages.Settings.GeneralSettings.learnMore', { defaultValue: "Learn more" })}
                        </a>
                      </>
                    }
                  />
                )}
              </RadioGroup>
            </Form.Row>

            <Form.Actions>
              <Form.Indicator>
                <span case="success">{t('pages.Settings.GeneralSettings.saved', { defaultValue: "Saved!" })}</span>
              </Form.Indicator>
              <Button type="submit" className="w-[150px]" aria-label={t('pages.Settings.GeneralSettings.saveGeneralSettings', { defaultValue: "Save general settings" })}>
                {t('pages.Settings.GeneralSettings.save', { defaultValue: "Save" })}
              </Button>
            </Form.Actions>
          </Form>
        </div>
      </div>
      {isFF(FF_LSDV_E_297) && <HeidiTips collection="projectSettings" />}
    </div>
  );
};

GeneralSettings.title = i18next.t("pages.Settings.GeneralSettings.general", { defaultValue: "General" });
GeneralSettings.path = "/";
GeneralSettings.exact = true;
