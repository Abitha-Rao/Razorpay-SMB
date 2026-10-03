/**
 * Hard-coded fallbacks so the demo always works without an API key (and so the
 * recorded demo can't be spoiled by a slow call). Exact preset chats return the
 * expected drafts; any other text goes through a small keyword parser.
 */
import { assessAddress } from "./risk";
import type { AddressResult, CatalogItem, DraftResult } from "./types";

export type Preset = {
  key: "regular" | "cod" | "custom";
  label: string;
  /** Simulates the chat being shared from this WhatsApp contact. */
  from?: { name: string; phone: string } | undefined;
  chat: string;
};

export const PRESETS: Preset[] = [
  {
    key: "regular",
    label: "Regular buyer",
    from: { name: "Anjali Verma", phone: "98290 11223" },
    chat: "Hi di, same blue kurti as last time, size M, 2 pieces. Send to my old address. Will pay on GPay.",
  },
  {
    key: "cod",
    label: "New COD buyer",
    chat: "want the green bandhani saree, cod pls, address: flat 12 b block near hanuman mandir sector 4 rohini delhi 110085, priya 98xxxxxx21",
  },
  {
    key: "custom",
    label: "Custom order",
    chat: "Can you make a lehenga in maroon with gold border, budget around 4500? Need by 20th.",
  },
];

const PRESET_DRAFTS: Record<Preset["key"], DraftResult> = {
  regular: {
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
    payment_hint: "prepaid",
    address_text: "C-14, Shanti Nagar, Durgapura, Jaipur",
    pincode: "302018",
    uncertain: ['"Old address" – using the address from Anjali\'s last order. Please confirm.'],
  },
  cod: {
    buyer_name: "Priya",
    buyer_phone: "98xxxxxx21",
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
    address_text: "flat 12 b block near hanuman mandir sector 4 rohini delhi 110085",
    pincode: "110085",
    uncertain: [
      "Quantity not mentioned – assumed 1",
      "Phone number looks partly hidden – check with the buyer",
    ],
  },
  custom: {
    buyer_name: null,
    buyer_phone: null,
    lines: [
      {
        type: "custom",
        name: "Maroon lehenga with gold border (made to order)",
        qty: 1,
        unit_price: null,
        weight_kg: 1.2,
      },
    ],
    discount: null,
    payment_hint: "unknown",
    address_text: null,
    pincode: null,
    uncertain: [
      "Price not set – buyer's budget is around ₹4,500",
      "Size and measurements not mentioned",
      "Needs delivery by the 20th – check you can make it in time",
      "Buyer name and phone not in chat",
    ],
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
  from?: Preset["from"] | undefined,
): DraftResult {
  const preset = PRESETS.find((p) => p.chat.trim() === chat.trim());
  if (preset) return structuredClone(PRESET_DRAFTS[preset.key]);

  const uncertain: string[] = [];
  const qtyMatch =
    chat.match(/(\d+)\s*(pcs|pieces|piece|nos|qty)/i) ?? chat.match(/\bx\s?(\d+)\b/i);
  const qty = qtyMatch ? Number(qtyMatch[1]) : 1;
  if (!qtyMatch) uncertain.push("Quantity not mentioned – assumed 1");
  const sizeMatch = chat.match(/\bsize\s*[:-]?\s*(xxl|xl|xs|s|m|l)\b/i);

  const lines: DraftResult["lines"] = [];
  for (const item of catalog) {
    const kw =
      ITEM_KEYWORDS[item.id] ?? new RegExp(item.name.split(" ").slice(-1)[0] ?? item.name, "i");
    if (kw.test(chat)) {
      lines.push({
        type: "catalog",
        catalog_id: item.id,
        name: item.name,
        qty,
        unit_price: item.price,
        size: sizeMatch?.[1] && item.id === "kurti-blue" ? sizeMatch[1].toUpperCase() : null,
      });
    }
  }
  if (lines.some((l) => l.catalog_id === "kurti-blue") && !sizeMatch)
    uncertain.push("Size not mentioned – please check");
  if (lines.length === 0) {
    lines.push({
      type: "custom",
      name: "Item from chat (edit name)",
      qty,
      unit_price: null,
      weight_kg: 0.3,
    });
    uncertain.push("Couldn't match an item from your catalog – added as a custom line");
  }

  const phone =
    chat.match(/(?:\+91[\s-]?)?[6-9][0-9x]{4}\s?[0-9x]{5}/i)?.[0] ?? from?.phone ?? null;
  const addressMatch = chat.match(/address\s*[:-]\s*([^\n]+?)(?:,\s*[a-z]+\s+[6-9][0-9x]{9}|$)/i);
  const pincode = chat.match(/\b[1-9]\d{5}\b/)?.[0] ?? null;
  const payment_hint = /\bcod\b|cash on delivery/i.test(chat)
    ? "cod"
    : /gpay|upi|phonepe|paytm|prepaid|pay now|transfer/i.test(chat)
      ? "prepaid"
      : "unknown";
  if (!phone) uncertain.push("Buyer phone not in chat");

  return {
    buyer_name: from?.name ?? null,
    buyer_phone: phone,
    lines,
    discount: null,
    payment_hint,
    address_text: addressMatch?.[1]?.trim() ?? null,
    pincode,
    uncertain,
  };
}

const CITIES = [
  "delhi",
  "new delhi",
  "jaipur",
  "mumbai",
  "pune",
  "bengaluru",
  "bangalore",
  "chennai",
  "kolkata",
  "lucknow",
  "hyderabad",
  "ahmedabad",
  "noida",
  "gurgaon",
  "gurugram",
];

function titleCase(s: string) {
  return s.replace(/\b([a-z])([a-z]*)/g, (_, a: string, b: string) => a.toUpperCase() + b);
}

/** Rule-based tidy-up: spacing, capitalisation, comma-separated parts. Never adds details. */
export function fallbackCleanAddress(raw: string): AddressResult {
  let a = raw.replace(/\s+/g, " ").trim().toLowerCase();
  const pin = a.match(/\b[1-9]\d{5}\b/)?.[0];
  if (pin) a = a.replace(pin, "").trim();

  let parts: string[];
  if (a.includes(",")) {
    parts = a
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  } else {
    // Split before common address markers when the buyer typed no commas.
    const marked = a
      .replace(/\b(flat|house|plot|h\.?\s?no\.?)\s*(\d+\w?)/g, "|$1 $2|")
      .replace(/\b([a-z])\s+block\b/g, "|$1 block|")
      .replace(/\b(near|opp|opposite|behind)\b/g, "|$1")
      .replace(/\b(sector|phase)\s*(\d+)/g, "|$1 $2|");
    parts = marked
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
    // Peel known city off the last part ("rohini delhi" -> "rohini", "delhi").
    const last = parts[parts.length - 1] ?? "";
    const city = CITIES.find((c) => last.endsWith(" " + c) && last !== c);
    if (city) parts.splice(parts.length - 1, 1, last.slice(0, -city.length).trim(), city);
  }

  const cleaned = parts.map((p) => titleCase(p).replace(/\b([A-Z])\b(?= Block)/, "$1")).join(", ");
  const clean_address = pin ? `${cleaned} ${pin}` : cleaned;
  const { confidence, missing } = assessAddress(clean_address);
  if (!pin) missing.push("Pincode");
  return { clean_address, missing, confidence };
}
