import i18next from 'i18next'
/**
 * Shared utilities for state chip components
 *
 * This file re-exports the state registry functions for backward compatibility.
 * The actual implementation is in state-registry.ts which provides an extensible
 * semantic type system that LSE can extend.
 */

export {
  stateRegistry,
  StateType,
  getStateColorClass,
  getStateVariant,
  formatStateName,
  getStateDescription,
  getStateType,
  isTerminalState,
  requiresAttention,
  type EntityType,
  type StateMetadata,
} from "./state-registry";

/**
 * Format timestamp to human-readable string
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return i18next.t("appCommon.components.state-chips.utils.justNow", { ns: "app-common", defaultValue: "Just now" });
  }
  if (diffMins < 60) {
    const unit =
      diffMins === 1
        ? i18next.t("appCommon.components.state-chips.utils.minuteSingular", { ns: "app-common", defaultValue: "minute" })
        : i18next.t("appCommon.components.state-chips.utils.minutePlural", { ns: "app-common", defaultValue: "minutes" });
    return i18next.t("appCommon.components.state-chips.utils.diffminsValAgo", {
      ns: "app-common", defaultValue: "{{diffMins}} {{unit}} ago",
      diffMins,
      unit,
    });
  }
  if (diffHours < 24) {
    const unit =
      diffHours === 1
        ? i18next.t("appCommon.components.state-chips.utils.hourSingular", { ns: "app-common", defaultValue: "hour" })
        : i18next.t("appCommon.components.state-chips.utils.hourPlural", { ns: "app-common", defaultValue: "hours" });
    return i18next.t("appCommon.components.state-chips.utils.diffhoursValAgo", {
      ns: "app-common", defaultValue: "{{diffHours}} {{unit}} ago",
      diffHours,
      unit,
    });
  }
  if (diffDays < 7) {
    const unit =
      diffDays === 1
        ? i18next.t("appCommon.components.state-chips.utils.daySingular", { ns: "app-common", defaultValue: "day" })
        : i18next.t("appCommon.components.state-chips.utils.dayPlural", { ns: "app-common", defaultValue: "days" });
    return i18next.t("appCommon.components.state-chips.utils.diffdaysValAgo", {
      ns: "app-common", defaultValue: "{{diffDays}} {{unit}} ago",
      diffDays,
      unit,
    });
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format user name from triggered_by object
 */
export function formatUserName(
  triggeredBy: {
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null,
): string {
  if (!triggeredBy) {
    return i18next.t("appCommon.components.state-chips.utils.system", { ns: "app-common", defaultValue: "System" });
  }

  const { first_name, last_name, email } = triggeredBy;

  if (first_name && last_name) return i18next.t('appCommon.components.state-chips.utils.first_nameLast_name', { ns: "app-common", defaultValue: "{{first_name}} {{last_name}}", first_name, last_name });
  if (first_name) return first_name;
  if (last_name) return last_name;
  if (email) return email;

  return i18next.t("appCommon.components.state-chips.utils.system", { ns: "app-common", defaultValue: "System" });
}
