/**
 * Order drafting is the only AI call. It runs only on the server (TanStack Start server functions), so the
 * API key never reaches the browser. With no ANTHROPIC_API_KEY set, every call returns
 * the hard-coded fallback and the demo still works.
 */
import { createServerFn } from "@tanstack/react-start";

import { fallbackDraft } from "./fallback";
import type { AiSource, CatalogItem, DraftResult } from "./types";

const MODEL = "claude-haiku-4-5";

export const DRAFT_SYSTEM_PROMPT =
  "You turn an Indian small seller's WhatsApp/Instagram chat into a draft order. Use the seller's catalog where an item matches; otherwise mark the line custom and do not invent a price unless the chat states one. Return only JSON: {buyer_name, buyer_phone, lines:[{type:'catalog'|'custom', catalog_id?, name, qty, unit_price?, size?}], discount:{type:'flat'|'percent', value}|null, payment_hint:'prepaid'|'cod'|'unknown', address_text?, uncertain:[strings]}. Never write messages to the buyer.";

/** Calls give up after this long so the client can fall back to the demo parser. */
export const AI_TIMEOUT_MS = 8000;

/**
 * Reads the secret on the server only. Lovable's Cloudflare worker exposes secrets as
 * bindings on globalThis.__env__ (Nitro), and on process.env when Node compat populates it.
 */
function apiKey(): string | undefined {
  const fromProcess = typeof process !== "undefined" ? process.env["ANTHROPIC_API_KEY"] : undefined;
  const bindings = (globalThis as { __env__?: Record<string, unknown> }).__env__;
  const fromBindings = bindings?.["ANTHROPIC_API_KEY"];
  const key = fromProcess || (typeof fromBindings === "string" ? fromBindings : undefined);
  return key?.trim() || undefined;
}

async function callClaude(system: string, user: string, maxTokens: number): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: apiKey(), timeout: AI_TIMEOUT_MS, maxRetries: 0 });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in model output");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { available: Boolean(apiKey()), model: MODEL };
});

type DraftInput = {
  chat: string;
  catalog: CatalogItem[];
  from?: { name: string; phone: string } | undefined;
  useLive: boolean;
};

export const draftOrderFn = createServerFn({ method: "POST" })
  .validator((input: DraftInput) => input)
  .handler(async ({ data }): Promise<{ source: AiSource; draft: DraftResult }> => {
    const fallback = () => ({
      source: "fallback" as const,
      draft: fallbackDraft(data.chat, data.catalog, data.from),
    });
    if (!data.useLive || !apiKey()) return fallback();
    try {
      const user = JSON.stringify({
        instructions:
          "Copy quantities, the discount (flat rupees or percent), buyer name and phone exactly as written in the chat. UPI, GPay, PhonePe or 'pay now' means payment_hint prepaid; COD means cod. Only set a line's size if the buyer wrote it. List every missing or unclear detail in uncertain, for example a sized item with no size, or no quantity. If the message is a filled-in order form with 'Label: value' lines (Name, Item, Size, Quantity, Phone), read each field; a blank field is missing, so do not guess it, and list it in uncertain.",
        chat: data.chat,
        shared_from_contact: data.from ?? null,
        catalog: data.catalog.map((c) => ({ id: c.id, name: c.name, price: c.price })),
      });
      const draft = parseJson<DraftResult>(await callClaude(DRAFT_SYSTEM_PROMPT, user, 1024));
      if (!Array.isArray(draft.lines)) throw new Error("Draft has no lines");
      draft.uncertain = Array.isArray(draft.uncertain) ? draft.uncertain : [];
      return { source: "claude", draft };
    } catch (err) {
      console.error("draftOrderFn: falling back", err);
      return fallback();
    }
  });
