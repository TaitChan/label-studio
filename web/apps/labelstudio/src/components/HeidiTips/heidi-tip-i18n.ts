import type { Tip, TipCollectionKey } from "./types";

/** Stable locale key: heidiTips.{collection}.{treatment}.{title|content|link} */
export function heidiTipTextKey(
  collection: TipCollectionKey,
  tip: Tip,
  field: "title" | "content" | "link",
): string {
  const id = tip.link.params?.treatment ?? "default";
  return `heidiTips.${collection}.${id}.${field}`;
}

export function heidiTipBody(tip: Tip): string {
  return tip.description ?? tip.content ?? "";
}
