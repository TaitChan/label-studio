import { Button } from "@humansignal/ui";
import { cn } from "apps/labelstudio/src/utils/bem";
import type { FC } from "react";
import "./EmptyList.prefix.css";
import { HeidiAi } from "apps/labelstudio/src/assets/images";
import { useTranslation } from 'react-i18next'


export const EmptyList: FC = () => {
  const { t } = useTranslation("labelstudio")
  return (
    <div className={cn("empty-models-list").toClassName()}>
      <div className={cn("empty-models-list").elem("content").toClassName()}>
        <div className={cn("empty-models-list").elem("heidy").toClassName()}>
          <HeidiAi />
        </div>
        <div className={cn("empty-models-list").elem("title").toClassName()}>{t('pages.Organization.Models.@components.EmptyList.createAModel', { defaultValue: "Create a Model" })}</div>
        <div className={cn("empty-models-list").elem("caption").toClassName()}>
          {t('pages.Organization.Models.@components.EmptyList.buildAHighQualityModelToAutolabelYourDataUsingLlms', { defaultValue: "Build a high quality model to auto-label your data using LLMs" })}
        </div>
        <Button aria-label={t('pages.Organization.Models.@components.EmptyList.createNewModel', { defaultValue: "Create new model" })}>{t('pages.Organization.Models.@components.EmptyList.createAModel', { defaultValue: "Create a Model" })}</Button>
      </div>
    </div>
  );
};
