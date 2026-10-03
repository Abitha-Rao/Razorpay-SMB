import { describe, expect, it } from "vitest";

import {
  fallbackCleanAddress,
  fallbackDraft,
  isPlaceholderAddress,
  PRESETS,
  titleCaseName,
  wantsSavedAddress,
} from "@/lib/demo/fallback";
import { buyerPrices, capDiscount, formatINR, orderValue } from "@/lib/demo/money";
import { checkPincode } from "@/lib/demo/pincode";
import { buyerPrepaidReason, scoreRisk, sellerVerdict } from "@/lib/demo/risk";
import { DEFAULT_SETTINGS, SEED_CATALOG, buildSeedOrders, trustBadgeCount } from "@/lib/demo/seed";
import { lastAddressFor } from "@/lib/demo/store";
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
    expect(risk.action).toBe("partial_upfront");
    expect(sellerVerdict(risk, "partial", formatINR)).toBe(
      "New number and the address had no street, so we asked for ₹490 upfront.",
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

describe("fallback parser on a free-form chat", () => {
  it("reads per-item quantities, % discount, name, phone and UPI", () => {
    const d = fallbackDraft(
      "hi! 2 jhumkas and 1 dupatta for my sister, regular customer so some discount na? 10% off ok. name Kavya, 9876501234, will pay upi",
      SEED_CATALOG,
    );
    const qty = Object.fromEntries(d.lines.map((l) => [l.catalog_id, l.qty]));
    expect(qty).toEqual({ "jhumka-silver": 2, "dupatta-blockprint": 1 });
    expect(d.discount).toEqual({ type: "percent", value: 10 });
    expect(d.buyer_name).toBe("Kavya");
    expect(d.buyer_phone).toBe("9876501234");
    expect(d.payment_hint).toBe("prepaid");
  });
});

describe("test 1: free-form COD chat in Balanced", () => {
  const chat =
    "hi, the green bandhani saree pls, cod. send to flat 12 b block near hanuman mandir sector 4 rohini delhi 110085. priya 9811204521";
  const d = fallbackDraft(chat, SEED_CATALOG);

  it("drafts the saree, Priya, her phone, the address and COD", () => {
    expect(d.lines.map((l) => [l.catalog_id, l.qty])).toEqual([["saree-bandhani-green", 1]]);
    expect(titleCaseName(d.buyer_name!)).toBe("Priya");
    expect(d.buyer_phone).toBe("9811204521");
    expect(d.address_text).toBe("flat 12 b block near hanuman mandir sector 4 rohini delhi 110085");
    expect(d.pincode).toBe("110085");
    expect(d.payment_hint).toBe("cod");
  });

  it("is medium risk with ₹490 upfront", () => {
    const lines = linesFrom(chat);
    const risk = scoreRisk({
      phone: d.buyer_phone!,
      address: fallbackCleanAddress(d.address_text!).clean_address,
      pincode: "110085",
      orderValue: orderValue(lines, null),
      lines,
      strictness: "balanced",
      pastOrders: seed,
    });
    expect(risk.tier).toBe("medium");
    expect(risk.upfrontAmount).toBe(490);
  });
});

describe("test 2: regular buyer uses the saved address", () => {
  it("detects 'old address' and finds Anjali's last address", () => {
    expect(wantsSavedAddress(PRESETS[0]!.chat)).toBe(true);
    expect(isPlaceholderAddress("my old address")).toBe(true);
    expect(isPlaceholderAddress("Flat 12, old address road 110085")).toBe(false);
    const last = lastAddressFor("98290 11223", seed);
    expect(last?.address).toBe("C-14, Shanti Nagar, Durgapura, Jaipur");
    expect(last?.pincode).toBe("302018");
  });
});

describe("test 3: discount caps", () => {
  const lines: OrderLine[] = [
    { id: "1", type: "catalog", name: "Saree", qty: 1, unitPrice: 2450, weightKg: 0.6 },
  ];
  it("caps 150% at 90%", () => {
    const c = capDiscount(lines, { type: "percent", value: 150 });
    expect(c.discount).toEqual({ type: "percent", value: 90 });
    expect(c.warning).toMatch(/90%/);
  });
  it("caps a flat discount at subtotal − ₹1", () => {
    const c = capDiscount(lines, { type: "flat", value: 5000 });
    expect(c.discount).toEqual({ type: "flat", value: 2449 });
    expect(orderValue(lines, c.discount)).toBe(1);
  });
});

describe("test 4: a returned parcel makes the number prepaid only", () => {
  it("blocks COD for a number on the list, with the buyer-facing reason", () => {
    const lines = linesFrom(PRESETS[0]!.chat);
    const risk = scoreRisk({
      phone: "98290 11223",
      address: "C-14, Shanti Nagar, Durgapura, Jaipur",
      pincode: "302018",
      orderValue: 2400,
      lines,
      strictness: "balanced",
      pastOrders: seed,
      codBlockedPhones: ["9829011223"],
    });
    expect(risk.action).toBe("prepaid_only");
    expect(buyerPrepaidReason(risk)).toBe("COD isn't available for this order.");
  });

  it("explains a custom order to the seller in the third person", () => {
    const lines: OrderLine[] = [
      { id: "1", type: "custom", name: "Lehenga", qty: 1, unitPrice: 4500, weightKg: 1.2 },
    ];
    const risk = scoreRisk({
      phone: "98290 11223",
      address: "C-14, Shanti Nagar, Durgapura, Jaipur",
      pincode: "302018",
      orderValue: 4500,
      lines,
      strictness: "balanced",
      pastOrders: seed,
    });
    expect(sellerVerdict(risk, "prepaid", formatINR)).toBe(
      "Custom item, so COD was switched off and the buyer paid upfront.",
    );
    expect(buyerPrepaidReason(risk)).toBe(
      "This order has a custom item, so the seller needs payment upfront.",
    );
  });
});

describe("buyer page checks", () => {
  it("validates pincodes and fills city/state", () => {
    expect(checkPincode("999999").status).toBe("invalid");
    expect(checkPincode("000000").status).toBe("invalid");
    expect(checkPincode("1100").status).toBe("invalid");
    expect(checkPincode("110085")).toEqual({ status: "ok", city: "Delhi", state: "Delhi" });
    expect(checkPincode("744101").status).toBe("unserviceable");
  });

  it("trust badge starts at 128 on the seed", () => {
    expect(trustBadgeCount(seed)).toBe(128);
  });
});
