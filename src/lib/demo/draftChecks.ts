/**
 * Checks on a drafted order that don't depend on what the AI chose to report. The draft form
 * always flags a sized item with no size, so a model that returns an empty "uncertain" list
 * can't hide it.
 */
import type { CatalogItem, OrderLine } from "./types";

export const SIZE_FLAG = "Size not mentioned – please check";

/** Items that come in sizes, matched by name so items the seller adds to the catalog work too. */
const SIZED_ITEM_RE =
  /\b(kurti|kurtis|kurta|kurtas|blouse|top|shirt|dress|suit|salwar|lehenga|palazzo|pants)\b/i;

/** An item name that comes in sizes. */
export function isSizedName(name: string): boolean {
  return SIZED_ITEM_RE.test(name);
}

/** A catalog line for an item that comes in sizes. */
export function isSizedLine(line: OrderLine, catalog: CatalogItem[]): boolean {
  if (line.type !== "catalog") return false;
  const name = catalog.find((c) => c.id === line.catalogId)?.name ?? line.name;
  return isSizedName(name);
}

/** A sized item that has no size yet. Clears as soon as the seller types one. */
export function needsSize(line: OrderLine, catalog: CatalogItem[]): boolean {
  return isSizedLine(line, catalog) && !line.size?.trim();
}

const SIZE_WORDS: Record<string, string[]> = {
  XS: ["xs", "extra small"],
  S: ["small"],
  M: ["medium"],
  L: ["large"],
  XL: ["xl", "extra large"],
  XXL: ["xxl", "2xl"],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Keep a size only if the buyer actually wrote it. The model must not guess one, because a
 * guessed size would hide the "size not mentioned" flag.
 */
export function groundedSize(size: string | null | undefined, message: string): string | undefined {
  const s = size?.trim();
  if (!s) return undefined;
  const text = message.toLowerCase();
  const key = s.toUpperCase();
  const words = SIZE_WORDS[key] ?? [];
  const spelled = [...words, key.toLowerCase()].some(
    (w) => w.length > 1 && new RegExp(`(^|[^a-z0-9])${escapeRe(w)}([^a-z0-9]|$)`).test(text),
  );
  // One-letter sizes (S, M, L) only count next to the word "size", so "I'm" isn't a size.
  const letter =
    key.length === 1 &&
    new RegExp(
      `size\\s*[:\\-.]?\\s*${key.toLowerCase()}\\b|\\b${key.toLowerCase()}\\s*size\\b`,
    ).test(text);
  return spelled || letter ? s : undefined;
}

/** Model or parser flags that say a size is missing. The form works that out itself. */
const SIZE_MISSING_RE =
  /\bsize\b.*\b(not (mentioned|specified|stated|given|provided|clear)|missing|unspecified)\b|\bno size\b|\bwithout (a )?size\b/i;

/**
 * Everything to check on a draft: a missing size first (worked out from the lines, so it clears
 * when the seller fills it in), then whatever else the AI or parser reported.
 */
export function draftFlags(
  lines: OrderLine[],
  uncertain: string[],
  catalog: CatalogItem[],
): string[] {
  const hasSizedLine = lines.some((l) => isSizedLine(l, catalog));
  const rest = hasSizedLine ? uncertain.filter((u) => !SIZE_MISSING_RE.test(u)) : uncertain;
  return lines.some((l) => needsSize(l, catalog)) ? [SIZE_FLAG, ...rest] : rest;
}
