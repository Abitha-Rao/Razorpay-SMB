/**
 * Hard-coded fallbacks so the demo always works without an API key (and so the recorded demo
 * can't be spoiled by a slow call). The sample chats return fixed drafts; any other text goes
 * through a small keyword parser.
 */
import type { CatalogItem, DraftResult } from "./types";

export type Sample = {
  key: "new" | "returned" | "blocked" | "trusted";
  /** What this sample shows, for the caption under "Use a sample message". */
  label: string;
  /** Simulates the chat being shared from this WhatsApp contact. */
  from?: { name: string; phone: string } | undefined;
  chat: string;
};

/**
 * "Use a sample message" cycles through these. Each one meets a different COD rule:
 * a new buyer, a buyer with a returned parcel, a blocked buyer and a trusted buyer.
 */
export const SAMPLES: Sample[] = [
  {
    key: "new",
    label: "New buyer, COD",
    chat: "hi, 1 blue cotton kurti pls, cod. send to flat 12 b block near hanuman mandir sector 4 rohini delhi 110085. priya 9811204521",
  },
  {
    key: "returned",
    label: "Buyer with an earlier returned parcel",
    chat: "hello, rohit here 9811122233. 1 green bandhani saree, cod please. address: house 7 gali 3 aliganj lucknow 226024",
  },
  {
    key: "blocked",
    label: "Buyer on your Blocked list",
    chat: "need 1 block print dupatta, cod. vikram 9414055667. address: ward 9 near bus stand sikar 332001",
  },
  {
    key: "trusted",
    label: "Trusted regular buyer",
    from: { name: "Anjali Verma", phone: "98290 11223" },
    chat: "Hi di, same blue kurti as last time, size M, 2 pieces. Send to my old address. COD is fine.",
  },
];

const SAMPLE_DRAFTS: Record<Sample["key"], DraftResult> = {
  new: {
    buyer_name: "Priya",
    buyer_phone: "9811204521",
    lines: [
      {
        type: "catalog",
        catalog_id: "kurti-blue",
        name: "Blue cotton kurti",
        qty: 1,
        unit_price: 1200,
        size: null,
      },
    ],
    discount: null,
    payment_hint: "cod",
    address_text: "flat 12 b block near hanuman mandir sector 4 rohini delhi 110085",
    pincode: "110085",
    uncertain: ["Size not mentioned – please check"],
  },
  returned: {
    buyer_name: "Rohit",
    buyer_phone: "9811122233",
    lines: [
      {
        type: "catalog",
        catalog_id: "saree-bandhani-green",
        name: "Green bandhani saree",
        qty: 1,
        unit_price: 2450,
      },
    ],
    discount: null,
    payment_hint: "cod",
    address_text: "house 7 gali 3 aliganj lucknow 226024",
    pincode: "226024",
    uncertain: [],
  },
  blocked: {
    buyer_name: "Vikram",
    buyer_phone: "9414055667",
    lines: [
      {
        type: "catalog",
        catalog_id: "dupatta-blockprint",
        name: "Block-print dupatta",
        qty: 1,
        unit_price: 650,
      },
    ],
    discount: null,
    payment_hint: "cod",
    address_text: "ward 9 near bus stand sikar 332001",
    pincode: "332001",
    uncertain: [],
  },
  trusted: {
    buyer_name: "Anjali Verma",
    buyer_phone: "98290 11223",
    lines: [
      {
        type: "catalog",
        catalog_id: "kurti-blue",
        name: "Blue cotton kurti",
        qty: 2,
        unit_price: 1200,
        size: "M",
      },
    ],
    discount: null,
    payment_hint: "cod",
    address_text: null,
    pincode: null,
    uncertain: [],
  },
};

const ITEM_KEYWORDS: Record<string, RegExp> = {
  "kurti-blue": /kurt[ia]/i,
  "saree-bandhani-green": /saree|sari|bandhani/i,
  "dupatta-blockprint": /dupatta/i,
  "jhumka-silver": /jhumk|earring/i,
  "stole-maroon": /stole/i,
};

export function fallbackDraft(
  chat: string,
  catalog: CatalogItem[],
  from?: Sample["from"] | undefined,
): DraftResult {
  const sample = SAMPLES.find((p) => p.chat.trim() === chat.trim());
  if (sample) return structuredClone(SAMPLE_DRAFTS[sample.key]);

  const uncertain: string[] = [];
  const qtyMatch =
    chat.match(/(\d+)\s*(pcs|pieces|piece|nos|qty)/i) ?? chat.match(/\bx\s?(\d+)\b/i);
  const sizeMatch = chat.match(/\bsize\s*[:-]?\s*(xxl|xl|xs|s|m|l)\b/i);
  let qtyGuessed = false;

  const lines: DraftResult["lines"] = [];
  for (const item of catalog) {
    const kw =
      ITEM_KEYWORDS[item.id] ?? new RegExp(item.name.split(" ").slice(-1)[0] ?? item.name, "i");
    const idx = chat.search(kw);
    if (idx < 0) continue;
    // "2 jhumkas and 1 dupatta": take the number written just before the item.
    const before = chat.slice(Math.max(0, idx - 20), idx);
    const own = before.match(/(\d+)\s*(?:x\s*)?(?:[a-z]+\s+){0,2}$/i)?.[1];
    const qty = own ? Number(own) : qtyMatch ? Number(qtyMatch[1]) : 1;
    if (!own && !qtyMatch) qtyGuessed = true;
    lines.push({
      type: "catalog",
      catalog_id: item.id,
      name: item.name,
      qty,
      unit_price: item.price,
      size: sizeMatch?.[1] && item.id === "kurti-blue" ? sizeMatch[1].toUpperCase() : null,
    });
  }
  if (qtyGuessed) uncertain.push("Quantity not mentioned – assumed 1");
  if (lines.some((l) => l.catalog_id === "kurti-blue") && !sizeMatch)
    uncertain.push("Size not mentioned – please check");
  if (lines.length === 0) {
    lines.push({
      type: "custom",
      name: "Item from the message (edit name)",
      qty: qtyMatch ? Number(qtyMatch[1]) : 1,
      unit_price: null,
      weight_kg: 0.3,
    });
    uncertain.push("Couldn't match an item from your catalog – added as a custom line");
  }

  const pct = chat.match(/(\d{1,2})\s*%/)?.[1];
  const flat = chat.match(/(?:₹|rs\.?\s?)(\d+)\s*(?:off|discount)/i)?.[1];
  const discount: DraftResult["discount"] = pct
    ? { type: "percent", value: Number(pct) }
    : flat
      ? { type: "flat", value: Number(flat) }
      : null;
  // "name Kavya", or a name written just before the phone number ("priya 9811204521").
  const NOT_NAMES =
    /^(pls|please|cod|upi|no|number|phone|call|whatsapp|mob|mobile|ph|contact|is)$/i;
  const beforePhone = chat.match(
    /\b([a-z]{3,})[,\s]+(?:\+91[\s-]?)?[6-9][0-9x]{4}\s?[0-9x]{5}/i,
  )?.[1];
  const nameMatch =
    chat.match(/\b(?:name|naam)\s*(?:is|:|-)?\s*([a-z]+)/i)?.[1] ??
    (beforePhone && !NOT_NAMES.test(beforePhone) ? beforePhone : undefined);
  const buyerName = nameMatch
    ? nameMatch[0]!.toUpperCase() + nameMatch.slice(1).toLowerCase()
    : null;

  const phone =
    chat.match(/(?:\+91[\s-]?)?[6-9][0-9x]{4}\s?[0-9x]{5}/i)?.[0] ?? from?.phone ?? null;
  // "address: …", "send to …" or "deliver to …", up to the sentence end or the name + phone.
  const addressMatch = chat.match(
    /(?:address\s*[:-]|send (?:it )?to|deliver (?:it )?to|ship (?:it )?to)\s*([^\n]+?)(?:\.\s|,\s*[a-z]+\s+[6-9][0-9x]{9}|$)/i,
  );
  const pincode = chat.match(/\b[1-9]\d{5}\b/)?.[0] ?? null;
  const payment_hint = /\bcod\b|cash on delivery/i.test(chat)
    ? "cod"
    : /gpay|upi|phonepe|paytm|prepaid|pay now|transfer/i.test(chat)
      ? "prepaid"
      : "unknown";
  if (!phone) uncertain.push("Buyer phone not in the message");

  return {
    buyer_name: buyerName ?? from?.name ?? null,
    buyer_phone: phone,
    lines,
    discount,
    payment_hint,
    address_text: addressMatch?.[1]?.trim() ?? null,
    pincode,
    uncertain,
  };
}

/** "same address as last time", "send to my old address", "usual address"… */
const SAVED_ADDRESS_RE =
  /\b(same|old|last|previous|usual|earlier|purana)\b[\w\s]{0,20}\baddress\b|\baddress\b[\w\s]{0,20}\b(same|as last time|as before)\b/i;

export function wantsSavedAddress(text: string | null | undefined): boolean {
  return !!text && SAVED_ADDRESS_RE.test(text);
}

/** True when the "address" is really a reference to a saved one, not a deliverable address. */
export function isPlaceholderAddress(text: string | null | undefined): boolean {
  if (!text) return false;
  return wantsSavedAddress(text) && !/\d/.test(text);
}

/** "priya" → "Priya", "anjali VERMA" → "Anjali Verma". */
export function titleCaseName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}
