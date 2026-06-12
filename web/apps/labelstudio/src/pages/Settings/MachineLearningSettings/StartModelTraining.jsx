import { useCallback, useState } from "react";
import { Button } from "@humansignal/ui";
import { useAPI } from "../../../providers/ApiProvider";
import { Typography } from "@humansignal/ui";
import { useTranslation } from 'react-i18next'


export const StartModelTraining = ({ backend }) => {
  const { t } = useTranslation("labelstudio")
  const api = useAPI();
  const [response, setResponse] = useState(null);

  const onStartTraining = useCallback(
    async (backend) => {
      const res = await api.callApi("trainMLBackend", {
        params: {
          pk: backend.id,
        },
      });

      setResponse(res.response || {});
    },
    [api],
  );

  return (
    <div className="max-w-[680px]">
      <Typography size="small" className="text-neutral-content-subtler">
        {t('pages.Settings.MachineLearningSettings.StartModelTraining.youreAboutToManuallyTriggerYourModelsTrainingProcessThisActionWillStartTheLearningPhaseBasedOnHowTrainMethodIsImplementedInTheMlBackendProceedToBeginThisProcess', { defaultValue: "You're about to manually trigger your model's training process. This action will start the learning phase basedn        on how train method is implemented in the ML Backend. Proceed to begin this process." })}
      </Typography>
      <Typography size="small" className="text-neutral-content-subtler mt-base mb-wide">
        {t('pages.Settings.MachineLearningSettings.StartModelTraining.noteCurrentlyThereIsNoBuiltinFeedbackLoopWithinThisInterfaceForTrackingTheTrainingProgressYoullNeedToMonitorTheModelsTrainingStepsDirectlyThroughTheModelsOwnToolsAndEnvironment', { defaultValue: "*Note: Currently, there is no built-in feedback loop within this interface for tracking the training progress.n        You'll need to monitor the model's training steps directly through the model's own tools and environment." })}
      </Typography>

      {!response && (
        <Button
          onClick={() => {
            onStartTraining(backend);
          }}
        >
          {t('pages.Settings.MachineLearningSettings.StartModelTraining.startTraining', { defaultValue: "Start Training" })}
        </Button>
      )}

      {!!response && (
        <>
          <pre>{t('pages.Settings.MachineLearningSettings.StartModelTraining.requestSent', { defaultValue: "Request Sent!" })}</pre>
          <pre>{t('pages.Settings.MachineLearningSettings.StartModelTraining.response2', { defaultValue: "Response:" })} {JSON.stringify(response, null, 2)}</pre>
        </>
      )}
    </div>
  );
};
