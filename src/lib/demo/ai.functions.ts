/**
 * Claude calls. These run only on the server (TanStack Start server functions), so the
 * API key never reaches the browser. With no ANTHROPIC_API_KEY set, every call returns
 * the hard-coded fallback and the demo still works.
 */
import { createServerFn } from "@tanstack/react-start";

import { fallbackCleanAddress, fallbackDraft } from "./fallback";
import type { AddressResult, AiSource, CatalogItem, DraftResult } from "./types";

const MODEL = "claude-haiku-4-5";

export const DRAFT_SYSTEM_PROMPT =
  "You turn an Indian small seller's WhatsApp/Instagram chat into a draft order. Use the seller's catalog where an item matches; otherwise mark the line custom and do not invent a price unless the chat states one. Return only JSON: {buyer_name, buyer_phone, lines:[{type:'catalog'|'custom', catalog_id?, name, qty, unit_price?, size?}], discount:{type:'flat'|'percent', value}|null, payment_hint:'prepaid'|'cod'|'unknown', address_text?, uncertain:[strings]}. Never write messages to the buyer.";

export const ADDRESS_SYSTEM_PROMPT =
  "Clean an Indian delivery address. Fix spacing and capitalisation and order it as house/flat, building, street, landmark, area, city, pincode. Do not add details that are not in the input. Return JSON: {clean_address, missing:[strings], confidence:'high'|'medium'|'low'}.";

export const VERDICT_SYSTEM_PROMPT =
  "Explain a COD risk decision to a small seller in one or two plain sentences, no jargon, no blame on the buyer. Input: tier, action taken, reasons list. Return plain text.";

function apiKey(): string | undefined {
  return typeof process !== "undefined" ? process.env["ANTHROPIC_API_KEY"] : undefined;
}

async function callClaude(system: string, user: string, maxTokens: number): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: apiKey(), timeout: 15_000, maxRetries: 1 });
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

export const cleanAddressFn = createServerFn({ method: "POST" })
  .validator((input: { address: string; useLive: boolean }) => input)
  .handler(async ({ data }): Promise<{ source: AiSource; result: AddressResult }> => {
    const fallback = () => ({
      source: "fallback" as const,
      result: fallbackCleanAddress(data.address),
    });
    if (!data.useLive || !apiKey()) return fallback();
    try {
      const result = parseJson<AddressResult>(
        await callClaude(ADDRESS_SYSTEM_PROMPT, data.address, 400),
      );
      if (typeof result.clean_address !== "string") throw new Error("No clean_address");
      result.missing = Array.isArray(result.missing) ? result.missing : [];
      return { source: "claude", result };
    } catch (err) {
      console.error("cleanAddressFn: falling back", err);
      return fallback();
    }
  });

export const explainRiskFn = createServerFn({ method: "POST" })
  .validator(
    (input: { tier: string; action: string; reasons: string[]; useLive: boolean }) => input,
  )
  .handler(async ({ data }): Promise<{ source: AiSource; text: string | null }> => {
    if (!data.useLive || !apiKey()) return { source: "fallback", text: null };
    try {
      const user = JSON.stringify({ tier: data.tier, action: data.action, reasons: data.reasons });
      const text = await callClaude(VERDICT_SYSTEM_PROMPT, user, 200);
      return { source: "claude", text: text || null };
    } catch (err) {
      console.error("explainRiskFn: falling back", err);
      return { source: "fallback", text: null };
    }
  });
