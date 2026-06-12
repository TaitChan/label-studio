import { useState } from "react";
import { Button } from "@humansignal/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@humansignal/shad/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@humansignal/shad/components/ui/alert";
import { useTranslation } from 'react-i18next'


// Type definitions
interface Hotkey {
  id: string;
  section: string;
  element: string;
  label: string;
  key: string;
  mac?: string;
  active: boolean;
  subgroup?: string;
  description?: string;
}

interface ImportData {
  hotkeys?: Hotkey[];
  settings?: {
    autoTranslatePlatforms?: boolean;
  };
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: ImportData | Hotkey[]) => void | Promise<void>;
}

/**
 * ImportDialog - A dialog component for importing hotkey configurations
 *
 * This component allows users to import hotkey configurations by pasting JSON data.
 * It validates the imported data structure and provides error feedback.
 *
 * @param {ImportDialogProps} props - The component props
 * @returns {React.ReactElement} The ImportDialog component
 */
export const ImportDialog = ({ open, onOpenChange, onImport }: ImportDialogProps) => {
  const { t } = useTranslation("app-common")
  // State for the import text input
  const [importText, setImportText] = useState<string>("");
  // State for validation errors
  const [error, setError] = useState<string>("");

  /**
   * Validates a single hotkey object structure
   * @param {unknown} hotkey - The hotkey object to validate
   * @throws {Error} If the hotkey is missing required fields
   */
  const validateHotkey = (hotkey: unknown): void => {
    if (!hotkey || typeof hotkey !== "object") {
      throw new Error("Invalid hotkey object");
    }

    const hotkeyObj = hotkey as Record<string, unknown>;
    const requiredFields = ["id", "section", "element", "label", "key"];
    const missingFields = requiredFields.filter((field) => !hotkeyObj[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
    }
  };

  /**
   * Handles the import process
   * Parses JSON, validates structure, and calls the onImport callback
   */
  const handleImport = (): void => {
    try {
      // Clear any previous errors
      setError("");

      // Validate input exists
      if (!importText.trim()) {
        throw new Error("Please enter JSON data to import");
      }

      // Parse the JSON
      const parsedData: unknown = JSON.parse(importText);

      // Handle both old format (array of hotkeys) and new format (object with hotkeys and settings)
      let hotkeys: unknown[];

      if (Array.isArray(parsedData)) {
        // Old format: direct array of hotkeys
        hotkeys = parsedData;
      } else if (parsedData && typeof parsedData === "object" && "hotkeys" in parsedData) {
        // New format: object with hotkeys property
        const dataObj = parsedData as { hotkeys?: unknown };
        if (!Array.isArray(dataObj.hotkeys)) {
          throw new Error("Invalid format: hotkeys property must be an array");
        }
        hotkeys = dataObj.hotkeys;
      } else {
        throw new Error("Invalid format: expected an array of hotkeys or an object with a hotkeys property");
      }

      // Validate it's not empty
      if (hotkeys.length === 0) {
        throw new Error("No hotkeys found in the imported data");
      }

      // Validate each hotkey object
      hotkeys.forEach((hotkey: unknown, index: number) => {
        try {
          validateHotkey(hotkey);
        } catch (validationError: unknown) {
          const errorMessage = validationError instanceof Error ? validationError.message : t('appCommon.pages.AccountSettings.sections.Hotkeys.Import.unknownValidationError', { defaultValue: "Unknown validation error" });
          throw new Error(`Hotkey at index ${index}: ${errorMessage}`);
        }
      });

      // If validation passes, proceed with import
      onImport(parsedData as ImportData | Hotkey[]);

      // Reset the dialog state
      resetDialogState();
    } catch (err: unknown) {
      // Set error message for display
      const errorMessage = err instanceof Error ? err.message : t('appCommon.pages.AccountSettings.sections.Hotkeys.Import.unknownErrorOccurred', { defaultValue: "Unknown error occurred" });
      setError(errorMessage);
    }
  };

  /**
   * Resets the dialog to its initial state
   */
  const resetDialogState = (): void => {
    setImportText("");
    setError("");
    onOpenChange(false);
  };

  /**
   * Handles dialog cancellation
   */
  const handleCancel = (): void => {
    resetDialogState();
  };

  /**
   * Handles textarea input changes
   * @param {React.ChangeEvent<HTMLTextAreaElement>} e - The change event
   */
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setImportText(e.target.value);
    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] bg-neutral-surface">
        <DialogHeader>
          <DialogTitle>{t('appCommon.pages.AccountSettings.sections.Hotkeys.Import.importHotkeys', { defaultValue: "Import Hotkeys" })}</DialogTitle>
          <DialogDescription>
            {t('appCommon.pages.AccountSettings.sections.Hotkeys.Import.pasteYourExportedHotkeysJsonBelowThisWillReplaceYourCurrentHotkeysMakeSureTheJsonContainsAnArrayOfHotkeyObjectsWithTheRequiredFields', { defaultValue: "Paste your exported hotkeys JSON below. This will replace your current hotkeys. Make sure the JSON contains an array of hotkey objects with the required fields." })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <label
            htmlFor="import-json"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {t('appCommon.pages.AccountSettings.sections.Hotkeys.Import.hotkeysJson', { defaultValue: "Hotkeys JSON" })}
          </label>
          <textarea
            id="import-json"
            className="flex min-h-[150px] w-full rounded-md border border-neutral-border bg-transparent px-tight py-tighter typography-body-small placeholder:text-neutral-content-subtler focus-visible:ring-4 focus-visible:ring-primary-focus-outline focus-visible:border-neutral-border-bolder focus-visible:outline-0 transition-all resize-none"
            placeholder={t('appCommon.pages.AccountSettings.sections.Hotkeys.Import.id1SectionAnnotationactionsElementButtonLabelSaveKeyCtrls', { defaultValue: "[{\"id\": 1, \"section\": \"annotation-actions\", \"element\": \"button\", \"label\": \"Save\", \"key\": \"Ctrl+S\"}]" })}
            value={importText}
            onChange={handleTextareaChange}
            {...(error ? { "aria-describedby": "import-error" } : {})}
          />

          {error && (
            <Alert variant="destructive" id="import-error">
              <AlertTitle>{t('appCommon.pages.AccountSettings.sections.Hotkeys.Import.importError', { defaultValue: "Import Error" })}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="neutral" onClick={handleCancel}>
            {t('appCommon.pages.AccountSettings.sections.Hotkeys.Import.cancel', { defaultValue: "Cancel" })}
          </Button>
          <Button onClick={handleImport} disabled={!importText.trim()}>
            {t('appCommon.pages.AccountSettings.sections.Hotkeys.Import.importHotkeys', { defaultValue: "Import Hotkeys" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
