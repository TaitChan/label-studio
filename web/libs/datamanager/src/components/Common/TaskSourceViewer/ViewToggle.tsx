import { Tabs, TabsList, TabsTrigger } from "@humansignal/ui";
import { useTranslation } from 'react-i18next'


export type ViewMode = "code" | "interactive";

interface ViewToggleProps {
  /** Current view mode (code or interactive) */
  view: ViewMode;
  /** Callback when view mode changes */
  onViewChange: (view: ViewMode) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * ViewToggle - Controls for switching between Code and Interactive view modes
 */
export const ViewToggle = ({ view, onViewChange, className }: ViewToggleProps) => {
  const { t } = useTranslation("datamanager")
  return (
    <Tabs value={view} onValueChange={(newValue: string) => onViewChange(newValue as ViewMode)} variant="default">
      <TabsList className={className}>
        <TabsTrigger value="code">{t('datamanager.components.Common.TaskSourceViewer.ViewToggle.code', { defaultValue: "Code" })}</TabsTrigger>
        <TabsTrigger value="interactive">{t('datamanager.components.Common.TaskSourceViewer.ViewToggle.interactive', { defaultValue: "Interactive" })}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
