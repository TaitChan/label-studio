/**
 * /api/projects/:pk/export/formats 下发的 title / description / tags 映射到
 * pages.ExportPage.exportFormats.{name}.* / exportFormatTags.* key。
 * en 默认值来自 API；locales 由 seed-export-format-keys 维护。
 */

export function exportFormatTagSlug(tag) {
  return String(tag || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function translateExportFormatTitle(format, t) {
  if (!format?.title) return format?.title;
  const name = format.name;
  if (!name) return format.title;
  return t(`pages.ExportPage.exportFormats.${name}.title`, {
    defaultValue: format.title,
  });
}

export function translateExportFormatDescription(format, t) {
  if (!format?.description) return format?.description;
  const name = format.name;
  if (!name) return format.description;
  return t(`pages.ExportPage.exportFormats.${name}.description`, {
    defaultValue: format.description,
  });
}

export function translateExportFormatTag(tag, t) {
  if (!tag) return tag;
  const slug = exportFormatTagSlug(tag);
  if (!slug) return tag;
  return t(`pages.ExportPage.exportFormatTags.${slug}`, {
    defaultValue: tag,
  });
}
