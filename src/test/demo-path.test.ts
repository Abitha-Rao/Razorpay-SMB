import { describe, expect, it } from "vitest";

import { fallbackCleanAddress, fallbackDraft, PRESETS } from "@/lib/demo/fallback";
import { buyerPrices, orderValue } from "@/lib/demo/money";
import { scoreRisk, templateVerdict } from "@/lib/demo/risk";
import { DEFAULT_SETTINGS, SEED_CATALOG, buildSeedOrders } from "@/lib/demo/seed";
import { formatINR } from "@/lib/demo/money";
import type { OrderLine } from "@/lib/demo/types";

const seed = buildSeedOrders();

function linesFrom(chat: string): OrderLine[] {
  return fallbackDraft(chat, SEED_CATALOG).lines.map((l, i) => {
    const item = SEED_CATALOG.find((c) => c.id === l.catalog_id);
    return {
      id: String(i),
      type: l.type,
      catalogId: l.catalog_id,
      name: l.name,
      qty: l.qty,
      unitPrice: item?.price ?? l.unit_price ?? null,
      weightKg: item?.weightKg ?? 0.3,
    };
  });
}

describe("seed data", () => {
  it("has 63 orders so the demo order is the 64th this month", () => {
    expect(seed).toHaveLength(63);
  });
  it("has 4 refused COD orders, Anjali with 3 delivered, one flagged number", () => {
    expect(seed.filter((o) => o.status === "refused")).toHaveLength(4);
    const anjali = seed.filter((o) => o.buyerName === "Anjali Verma");
    expect(anjali.filter((o) => o.status === "delivered")).toHaveLength(3);
    expect(
      seed.filter((o) => o.buyerPhone === "98111 22233" && o.status === "refused"),
    ).toHaveLength(1);
  });
  it("is roughly a third prepaid", () => {
    const decided = seed.filter((o) => o.paymentMode !== "pending");
    const share = decided.filter((o) => o.paymentMode === "prepaid").length / decided.length;
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.45);
  });
});

describe("demo path: preset b (new COD buyer)", () => {
  const chat = PRESETS[1]!.chat;
  const draft = fallbackDraft(chat, SEED_CATALOG);
  const lines = linesFrom(chat);

  it("drafts one green bandhani saree for Priya at ₹2,450", () => {
    expect(draft.buyer_name).toBe("Priya");
    expect(draft.payment_hint).toBe("cod");
    expect(orderValue(lines, null)).toBe(2450);
    expect(buyerPrices(lines, null, DEFAULT_SETTINGS).prepaidTotal).toBe(2450);
  });

  it("cleans the address to the expected suggestion", () => {
    expect(fallbackCleanAddress(draft.address_text!).clean_address).toBe(
      "Flat 12, B Block, Near Hanuman Mandir, Sector 4, Rohini, Delhi 110085",
    );
  });

  it("scores medium in Balanced and asks for ₹490 upfront", () => {
    const risk = scoreRisk({
      phone: draft.buyer_phone!,
      address: "Flat 12, B Block, Near Hanuman Mandir, Sector 4, Rohini, Delhi 110085",
      pincode: "110085",
      orderValue: 2450,
      lines,
      strictness: "balanced",
      pastOrders: seed,
    });
    expect(risk.score).toBe(45);
    expect(risk.tier).toBe("medium");
    expect(risk.upfrontAmount).toBe(490);
    expect(templateVerdict(risk, formatINR)).toBe(
      "Medium risk: first order from this number and address looked incomplete. Asked for ₹490 upfront.",
    );
  });
});

describe("other presets", () => {
  it("regular buyer Anjali is low risk", () => {
    const lines = linesFrom(PRESETS[0]!.chat);
    const risk = scoreRisk({
      phone: "98290 11223",
      address: "C-14, Shanti Nagar, Durgapura, Jaipur",
      pincode: "302018",
      orderValue: orderValue(lines, null),
      lines,
      strictness: "balanced",
      pastOrders: seed,
    });
    expect(orderValue(lines, null)).toBe(2400);
    expect(risk.tier).toBe("low");
  });

  it("custom order is prepaid only in Balanced", () => {
    const lines: OrderLine[] = [
      { id: "1", type: "custom", name: "Lehenga", qty: 1, unitPrice: 4500, weightKg: 1.2 },
    ];
    const risk = scoreRisk({
      phone: "90000 00000",
      address: "House 4, MG Road, Jaipur",
      pincode: "302001",
      orderValue: 4500,
      lines,
      strictness: "balanced",
      pastOrders: seed,
    });
    expect(risk.action).toBe("prepaid_only");
  });

  it("past refusal number gets flagged", () => {
    const lines = linesFrom(PRESETS[1]!.chat);
    const risk = scoreRisk({
      phone: "98111 22233",
      address: "House 7, Gali 3, Aliganj, Lucknow",
      pincode: "226024",
      orderValue: 2450,
      lines,
      strictness: "balanced",
      pastOrders: seed,
    });
    expect(risk.reasons.map((r) => r.code)).toContain("past_refusal");
  });
});
