/**
 * The order format a seller can send a buyer, and the reader for the filled-in reply.
 * A reply is plain "Label: value" lines. A blank value means the buyer didn't give that detail.
 */

/** Copied by "Copy order format" and sent to the buyer from the seller's own WhatsApp. */
export const ORDER_FORMAT = `Hi! To place your order, please reply with:
Name:
Item:
Size:
Quantity:
Phone:`;

export const ORDER_FORMAT_TOAST = "Order format copied, send it to your buyer";

export type FormField = "name" | "item" | "size" | "quantity" | "phone" | "address" | "pincode";

/** Fields present in the reply. A blank field is the empty string; an absent one is undefined. */
export type ParsedForm = Partial<Record<FormField, string>>;

const LABELS: Record<string, FormField> = {
  name: "name",
  item: "item",
  items: "item",
  size: "size",
  quantity: "quantity",
  qty: "quantity",
  phone: "phone",
  mobile: "phone",
  contact: "phone",
  address: "address",
  pincode: "pincode",
  pin: "pincode",
};

const LABEL_LINE =
  /^\s*(name|items?|size|quantity|qty|phone|mobile|contact|address|pincode|pin)\s*[:\-–]\s*(.*)$/i;

/** "-", "n/a", "?" and the like mean the buyer left the field empty. */
export function isBlankValue(value: string | undefined): boolean {
  const v = (value ?? "").trim();
  return v === "" || /^[-–—_.?\s]+$/.test(v) || /^(n\/?a|na|none|nil|nothing|blank)$/i.test(v);
}

/** The core fields of the format; a reply with at least three of them counts as a filled-in format. */
const CORE: FormField[] = ["name", "item", "size", "quantity", "phone"];

/** Reads "Label: value" lines. Returns null when the message isn't a filled-in order format. */
export function parseLabelled(message: string): ParsedForm | null {
  const form: ParsedForm = {};
  for (const line of message.split(/\r?\n/)) {
    const m = line.match(LABEL_LINE);
    if (!m) continue;
    const field = LABELS[m[1]!.toLowerCase()];
    if (field && form[field] === undefined) form[field] = isBlankValue(m[2]) ? "" : m[2]!.trim();
  }
  return CORE.filter((f) => form[f] !== undefined).length >= 3 ? form : null;
}

export const BLANK_FLAGS = {
  name: "Buyer name not in the message",
  item: "Item not mentioned – please check",
  quantity: "Quantity not mentioned – assumed 1",
  phone: "Buyer phone not in the message",
} as const;

/** What the buyer wrote for Quantity, as a number (digits or a number word), or null. */
export function parseQuantity(value: string | undefined): number | null {
  if (isBlankValue(value)) return null;
  const digits = value!.match(/\d+/)?.[0];
  if (digits) return Math.max(1, Number(digits));
  const words = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const i = words.findIndex((w) => new RegExp(`\\b${w}\\b`, "i").test(value!));
  return i >= 0 ? i + 1 : null;
}

/** The phone number the buyer wrote, tidied if it contains a 10-digit mobile number. */
export function parsePhone(value: string | undefined): string | null {
  if (isBlankValue(value)) return null;
  const m = value!.match(/(?:\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})/);
  return m ? m[1]!.replace(/[\s-]/g, "") : value!.trim();
}

/**
 * Flags for the fields the buyer left blank (Size is flagged by the sized-item check on the
 * drafted lines). Only a filled-in format is checked, so ordinary messages are unaffected.
 */
export function formBlankFlags(form: ParsedForm | null): string[] {
  if (!form) return [];
  const flags: string[] = [];
  if (isBlankValue(form.name)) flags.push(BLANK_FLAGS.name);
  if (isBlankValue(form.item)) flags.push(BLANK_FLAGS.item);
  if (parseQuantity(form.quantity) === null) flags.push(BLANK_FLAGS.quantity);
  if (isBlankValue(form.phone)) flags.push(BLANK_FLAGS.phone);
  return flags;
}

const TOPIC: Record<keyof typeof BLANK_FLAGS, RegExp> = {
  name: /\bname\b/i,
  item: /\bitem\b/i,
  quantity: /\b(quantity|qty)\b/i,
  phone: /\b(phone|mobile|number)\b/i,
};

/** Add the blank-field flags that the AI or parser hasn't already raised in its own words. */
export function mergeBlankFlags(existing: string[], blank: string[]): string[] {
  const out = [...existing];
  for (const flag of blank) {
    const key = (Object.keys(BLANK_FLAGS) as (keyof typeof BLANK_FLAGS)[]).find(
      (k) => BLANK_FLAGS[k] === flag,
    );
    if (!out.some((e) => e === flag || (key && TOPIC[key].test(e)))) out.push(flag);
  }
  return out;
}
