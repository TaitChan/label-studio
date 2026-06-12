import { buttonVariant, Space } from "@humansignal/ui";
import { useUpdatePageTitle } from "@humansignal/core";
import { cn } from "apps/labelstudio/src/utils/bem";
import { Link } from "react-router-dom";
import type { Page } from "../../types/Page";
import { EmptyList } from "./@components/EmptyList";
import i18next from 'i18next'


export const ModelsPage: Page = () => {
  useUpdatePageTitle("Models");

  return (
    <div className={cn("prompter").toClassName()}>
      <EmptyList />
    </div>
  );
};

ModelsPage.title = () =>
  i18next.t("pages.Organization.Models.ModelsPage.models", { defaultValue: "Models" });
ModelsPage.titleRaw = "Models";
ModelsPage.path = "/models";

ModelsPage.context = () => {
  return (
    <Space size="small">
      <Link to="/prompt/settings" className={buttonVariant({ size: "small" })}>
        {i18next.t('pages.Organization.Models.ModelsPage.createModel', { defaultValue: "Create Model" })}
      </Link>
    </Space>
  );
};
