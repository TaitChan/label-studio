import { useCallback, useState } from "react";
import { Button } from "@humansignal/ui";
import { useAPI } from "../../../providers/ApiProvider";
import { Typography } from "@humansignal/ui";
import { useTranslation } from 'react-i18next'


export const TestRequest = ({ backend }) => {
  const { t } = useTranslation("labelstudio")
  const api = useAPI();
  const [testResponse, setTestResponse] = useState({});
  console.log(testResponse.url);

  const sendTestRequest = useCallback(
    async (backend) => {
      const response = await api.callApi("predictWithML", {
        params: {
          pk: backend.id,
          random: true,
        },
      });

      if (response) setTestResponse(response);
    },
    [setTestResponse],
  );

  return (
    <section>
      <Button
        onClick={() => {
          sendTestRequest(backend);
        }}
      >
        {t('pages.Settings.MachineLearningSettings.TestRequest.sendRequest', { defaultValue: "Send Request" })}
      </Button>
      <Typography size="smaller" className="my-tight">
        {t('pages.Settings.MachineLearningSettings.TestRequest.thisSendsATestRequestToThePredictionEndpointOfTheMlBackendUsingARandomTask', { defaultValue: "This sends a test request to the prediction endpoint of the ML Backend using a random task." })}
      </Typography>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Typography variant="title" size="medium">
            {t('pages.Settings.MachineLearningSettings.TestRequest.request', { defaultValue: "Request" })}
          </Typography>
          <div className="bg-neutral-surface rounded-md p-tight overflow-y-scroll max-h-[400px] min-h-[90px]">
            <pre className="whitespace-pre-wrap break-words text-body-small">
              {testResponse.url && t('pages.Settings.MachineLearningSettings.TestRequest.postUrlVal', { defaultValue: "POST {{url}}nn{{val}}", url: testResponse.url, val: JSON.stringify(testResponse.request, null, 2) })}
            </pre>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Typography variant="title" size="medium">
            {t('pages.Settings.MachineLearningSettings.TestRequest.response', { defaultValue: "Response" })}
          </Typography>
          <div className="bg-neutral-surface rounded-md p-tight overflow-y-scroll max-h-[400px] min-h-[90px]">
            <pre className="whitespace-pre-wrap break-words text-body-small">
              {testResponse.status && t('pages.Settings.MachineLearningSettings.TestRequest.statusVal', { defaultValue: "{{status}}nn{{val}}", status: testResponse.status, val: JSON.stringify(testResponse.response, null, 2) })}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
};
