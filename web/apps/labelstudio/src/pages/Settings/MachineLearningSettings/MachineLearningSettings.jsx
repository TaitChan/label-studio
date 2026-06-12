import { useCallback, useContext, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Button, Typography, Spinner, EmptyState, SimpleCard } from "@humansignal/ui";
import { useUpdatePageTitle, createTitleFromSegments } from "@humansignal/core";
import { Form, Label, Toggle } from "../../../components/Form";
import { modal } from "../../../components/Modal/Modal";
import { IconModels, IconExternal } from "@humansignal/icons";
import { useAPI } from "../../../providers/ApiProvider";
import { ProjectContext } from "../../../providers/ProjectProvider";
import { MachineLearningList } from "./MachineLearningList";
import { CustomBackendForm } from "./Forms";
import { TestRequest } from "./TestRequest";
import { StartModelTraining } from "./StartModelTraining";
import "./MachineLearningSettings.prefix.css";
import i18next from "i18next";
import { useTranslation, Trans } from 'react-i18next';


export const MachineLearningSettings = () => {
  const { t } = useTranslation("labelstudio")
  const api = useAPI();
  const { project, fetchProject } = useContext(ProjectContext);
  const [backends, setBackends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useUpdatePageTitle(createTitleFromSegments([project?.title, t("pages.Settings.MachineLearningSettings.MachineLearningSettings.modelSettings", { defaultValue: "Model Settings" })]));

  const fetchBackends = useCallback(async () => {
    setLoading(true);
    const models = await api.callApi("mlBackends", {
      params: {
        project: project.id,
        include_static: true,
      },
    });

    if (models) setBackends(models);
    setLoading(false);
    setLoaded(true);
  }, [project, setBackends]);

  const startTrainingModal = useCallback(
    (backend) => {
      const modalProps = {
        title: t('pages.Settings.MachineLearningSettings.MachineLearningSettings.startModelTraining', { defaultValue: "Start Model Training" }),
        style: { width: 760 },
        closeOnClickOutside: true,
        body: <StartModelTraining backend={backend} />,
      };

      modal(modalProps);
    },
    [project],
  );

  const showRequestModal = useCallback(
    (backend) => {
      const modalProps = {
        title: t('pages.Settings.MachineLearningSettings.MachineLearningSettings.testRequest', { defaultValue: "Test Request" }),
        style: { width: 760 },
        closeOnClickOutside: true,
        body: <TestRequest backend={backend} />,
      };

      modal(modalProps);
    },
    [project],
  );

  const showMLFormModal = useCallback(
    (backend) => {
      const action = backend ? "updateMLBackend" : "addMLBackend";
      const modalProps = {
        title: t('pages.Settings.MachineLearningSettings.MachineLearningSettings.valModel', { defaultValue: "{{val}} Model", val: backend ? "Edit" : "Connect" }),
        style: { width: 760 },
        closeOnClickOutside: false,
        body: (
          <CustomBackendForm
            action={action}
            backend={backend}
            project={project}
            onSubmit={() => {
              fetchBackends();
              modalRef.close();
            }}
          />
        ),
      };

      const modalRef = modal(modalProps);
    },
    [project, fetchBackends],
  );

  useEffect(() => {
    if (project.id) {
      fetchBackends();
    }
  }, [project.id]);

  return (
    <section>
      <div className="w-[42rem]">
        <Typography variant="headline" size="medium" className="mb-base">
          {t('pages.Settings.MachineLearningSettings.MachineLearningSettings.model', { defaultValue: "Model" })}
        </Typography>
        {loading && <Spinner size={32} />}
        {loaded && backends.length === 0 && (
          <SimpleCard title="" className="bg-primary-background border-primary-border-subtler p-base">
            <EmptyState
              size="medium"
              variant="primary"
              icon={<IconModels />}
              title={t('pages.Settings.MachineLearningSettings.MachineLearningSettings.letsConnectYourFirstModel', { defaultValue: "Let's connect your first model" })}
              description={t('pages.Settings.MachineLearningSettings.MachineLearningSettings.connectAMachineLearningModelToGenerateLivePredictionsForYourProjectComparePredictionsAccelerateLabelingWithAutomaticPrelabelingAndDirectYourTeamToTheMostImpactfulTasksThroughActiveLearning', { defaultValue: "Connect a machine learning model to generate live predictions for your project. Compare predictions, accelerate labeling with automatic prelabeling, and direct your team to the most impactful tasks through active learning." })}
              actions={
                <Button
                  variant="primary"
                  look="filled"
                  onClick={() => showMLFormModal()}
                  aria-label={t('pages.Settings.MachineLearningSettings.MachineLearningSettings.addMachineLearningModel', { defaultValue: "Add machine learning model" })}
                >
                  {t('pages.Settings.MachineLearningSettings.MachineLearningSettings.connectModel', { defaultValue: "Connect Model" })}
                </Button>
              }
              footer={
                !window.APP_SETTINGS?.whitelabel_is_active && (
                  <Typography variant="label" size="small" className="text-primary-link">
                    <a
                      href="https://labelstud.io/guide/ml"
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="ml-help-link"
                      aria-label={t('pages.Settings.MachineLearningSettings.MachineLearningSettings.learnMoreAboutMachineLearningModelsOpensInNewWindow', { defaultValue: "Learn more about machine learning models (opens in new window)" })}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {t('pages.Settings.MachineLearningSettings.MachineLearningSettings.learnMore', { defaultValue: "Learn more" })}
                      <IconExternal width={16} height={16} />
                    </a>
                  </Typography>
                )
              }
            />
          </SimpleCard>
        )}
        <MachineLearningList
          onEdit={(backend) => showMLFormModal(backend)}
          onTestRequest={(backend) => showRequestModal(backend)}
          onStartTraining={(backend) => startTrainingModal(backend)}
          fetchBackends={fetchBackends}
          backends={backends}
        />

        {backends.length > 0 && (
          <div className="my-wide">
            <Typography size="small" className="text-neutral-content-subtler">
              {t('pages.Settings.MachineLearningSettings.MachineLearningSettings.aConnectedModelHasBeenDetectedIfYouWishToFetchPredictionsFromThisModelPleaseFollowTheseSteps', { defaultValue: "A connected model has been detected! If you wish to fetch predictions from this model, please follow thesen              steps:" })}
            </Typography>
            <Typography size="small" className="text-neutral-content-subtler mt-base">1. Navigate to the <i>Data Manager</i>.</Typography>
            <Typography size="small" className="text-neutral-content-subtler mt-tighter">
              {t('pages.Settings.MachineLearningSettings.MachineLearningSettings.2SelectTheDesiredTasks', { defaultValue: "2. Select the desired tasks." })}
            </Typography>
            <Typography size="small" className="text-neutral-content-subtler mt-tighter">3. Click on <i>Batch predictions</i> from the <i>Actions</i> menu.</Typography>
            <Typography size="small" className="text-neutral-content-subtler mt-base">
              {t('pages.Settings.MachineLearningSettings.MachineLearningSettings.ifYouWantToUseTheModelPredictionsForPrelabelingPleaseConfigureThisInThe', { defaultValue: "If you want to use the model predictions for prelabeling, please configure this in the" })}{" "}
              <NavLink to="annotation" className="hover:underline">
                {t('pages.Settings.MachineLearningSettings.MachineLearningSettings.annotationSettings2', { defaultValue: "Annotation settings" })}
              </NavLink>
              .
            </Typography>
          </div>
        )}

        <Form
          action="updateProject"
          formData={{ ...project }}
          params={{ pk: project.id }}
          onSubmit={() => fetchProject()}
        >
          {backends.length > 0 && (
            <div className="p-wide border border-neutral-border rounded-md">
              <Form.Row columnCount={1}>
                <Label text={t("pages.Settings.MachineLearningSettings.MachineLearningSettings.configuration", { defaultValue: "Configuration" })} large />

                <div>
                  <Toggle
                    label={t('pages.Settings.MachineLearningSettings.MachineLearningSettings.startModelTrainingOnAnnotationSubmission', { defaultValue: "Start model training on annotation submission" })}
                    description={t('pages.Settings.MachineLearningSettings.MachineLearningSettings.thisOptionWillSendARequestToTrainWithInformationAboutAnnotationsYouCanUseThisToEnableAnActiveLearningLoopYouCanAlsoManuallyStartTrainingThroughModelMenuInItsCard', { defaultValue: "This option will send a request to /train with information about annotations. You can use this to enable an Active Learning loop. You can also manually start training through model menu in its card." })}
                    name="start_training_on_annotation_update"
                  />
                </div>
              </Form.Row>
            </div>
          )}

          {backends.length > 0 && (
            <Form.Actions>
              <Form.Indicator>
                <span case="success">{t('pages.Settings.MachineLearningSettings.MachineLearningSettings.saved', { defaultValue: "Saved!" })}</span>
              </Form.Indicator>
              <Button type="submit" look="primary" className="w-[120px]" aria-label={t('pages.Settings.MachineLearningSettings.MachineLearningSettings.saveMachineLearningSettings', { defaultValue: "Save machine learning settings" })}>
                {t('pages.Settings.MachineLearningSettings.MachineLearningSettings.save', { defaultValue: "Save" })}
              </Button>
            </Form.Actions>
          )}
        </Form>
      </div>
    </section>
  );
};

MachineLearningSettings.title = i18next.t("pages.Settings.MachineLearningSettings.MachineLearningSettings.model", { defaultValue: "Model" });
MachineLearningSettings.path = "/ml";
