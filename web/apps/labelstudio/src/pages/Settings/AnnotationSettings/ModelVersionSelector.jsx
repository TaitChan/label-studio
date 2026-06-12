import { useCallback, useContext, useEffect, useState } from "react";
import { useAPI } from "../../../providers/ApiProvider";
import { Select } from "../../../components/Form";
import { ProjectContext } from "../../../providers/ProjectProvider";
import { useTranslation } from 'react-i18next'


export const ModelVersionSelector = ({
  name = "model_version",
  valueName = "model_version",
  apiName = "projectModelVersions",
  ...props
}) => {
  const { t } = useTranslation("labelstudio")
  const api = useAPI();
  const { project } = useContext(ProjectContext);
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState([]);
  const [models, setModels] = useState([]);
  const [version, setVersion] = useState(null);
  const [placeholder, setPlaceholder] = useState("");

  useEffect(() => {
    setVersion(project?.[valueName] || null);
  }, [project?.[valueName], versions]);

  const fetchMLVersions = useCallback(async () => {
    const pk = project?.id;

    if (!pk) return;

    const modelVersions = await api.callApi(apiName, {
      params: {
        pk,
        extended: true,
        include_live_models: true,
      },
    });

    if (modelVersions?.live?.length > 0) {
      const liveModels = modelVersions.live.map((item) => {
        const label = t('pages.Settings.AnnotationSettings.ModelVersionSelector.titleReadable_state', { defaultValue: "{{title}} ({{readable_state}})", title: item.title, readable_state: item.readable_state });

        return {
          group: "Models",
          value: item.title,
          label,
        };
      });

      setModels(liveModels);
    }

    if (modelVersions?.static?.length > 0) {
      const staticModels = modelVersions.static.map((item) => {
        const label = t('pages.Settings.AnnotationSettings.ModelVersionSelector.model_versionCountPredictions', { defaultValue: "{{model_version}} ({{count}} predictions)", model_version: item.model_version, count: item.count });

        return {
          group: "Predictions",
          value: item.model_version,
          label,
        };
      });

      setVersions(staticModels);
    }

    if (!modelVersions?.static?.length && !modelVersions?.live?.length) {
      setPlaceholder("No model or predictions available");
    }

    setLoading(false);
  }, [project?.id, apiName]);

  useEffect(() => {
    fetchMLVersions();
  }, [fetchMLVersions]);

  return (
    <div>
      <label>{t('pages.Settings.AnnotationSettings.ModelVersionSelector.selectWhichPredictionsOrWhichModelYouWantToUse', { defaultValue: "Select which predictions or which model you want to use:" })}</label>
      <div style={{ display: "flex", alignItems: "center", width: 400 }}>
        <div style={{ flex: 1, paddingRight: 16 }}>
          <Select
            name={name}
            disabled={!versions.length && !models.length}
            value={version}
            onChange={setVersion}
            options={[...models, ...versions]}
            placeholder={placeholder || t('pages.Settings.AnnotationSettings.ModelVersionSelector.pleaseSelectModelOrPredictions', { defaultValue: "Please select model or predictions" })}
            isInProgress={loading}
            {...props}
          />
        </div>
      </div>
    </div>
  );
};
