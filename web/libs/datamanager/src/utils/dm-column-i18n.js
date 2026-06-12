import i18next from "i18next";

/**
 * 后端 /api/dm/columns 下发的 title / help 映射到 datamanager.columns.{id}.* key。
 * 系统列 en 默认值来自 registry；项目 data 字段仍用 API title 作 defaultValue。
 */

function columnId(column) {
  if (!column) return null;
  return column.id ?? column.alias ?? null;
}

function isRegistryColumn(column) {
  if (!column) return false;
  if (column.project_defined === false) return true;
  // data 根节点
  if (column.id === "data" && !column.parent) return true;
  return false;
}

export function translateColumnTitle(column) {
  const title = typeof column === "string" ? column : column?.title;
  if (!title) return title;

  const id = typeof column === "string" ? null : columnId(column);
  if (!id) return title;

  if (isRegistryColumn(column)) {
    return i18next.t(`datamanager.columns.${id}.title`, {
      ns: "datamanager",
      defaultValue: title,
    });
  }

  // 项目 data 字段：title 即字段名，不写入 registry，仅 fallback
  return i18next.t(`datamanager.columns._project.${id}.title`, {
    ns: "datamanager",
    defaultValue: title,
  });
}

export function translateColumnHelp(column) {
  const help = column?.help;
  if (!help) return help;

  const id = columnId(column);
  if (!id || !isRegistryColumn(column)) return help;

  return i18next.t(`datamanager.columns.${id}.help`, {
    ns: "datamanager",
    defaultValue: help,
  });
}
