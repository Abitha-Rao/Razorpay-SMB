import { beforeEach, describe, expect, it } from "vitest";

import { codDecision, codSummary, prepaidOnlyReason } from "@/lib/demo/cod";
import {
  SAMPLES,
  fallbackDraft,
  isPlaceholderAddress,
  titleCaseName,
  wantsSavedAddress,
} from "@/lib/demo/fallback";
import { buyerPrices, capDiscount, formatINR, orderValue } from "@/lib/demo/money";
import { checkPincode, cityFromAddress, knownCityIn } from "@/lib/demo/pincode";
import {
  ANJALI,
  DEFAULT_SETTINGS,
  ROHIT,
  SEED_CATALOG,
  VIKRAM,
  buildSeedOrders,
  seedLists,
} from "@/lib/demo/seed";
import { actions, codCheckFor, getState, lastAddressFor, rebaseSeed } from "@/lib/demo/store";
import { trackRecord } from "@/lib/demo/track";
import type { Order, OrderLine } from "@/lib/demo/types";

const seed = buildSeedOrders();
const lists = seedLists();

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

function decide(phone: string, extra: Partial<Parameters<typeof codDecision>[0]> = {}) {
  return codDecision({
    phone,
    orderValue: 2450,
    codOffered: true,
    trusted: lists.trusted,
    blocked: lists.blocked,
    pastOrders: seed,
    ...extra,
  });
}

describe("seed data", () => {
  it("is one seller with 12 orders", () => {
    expect(seed).toHaveLength(12);
  });
  it("has one returned order, one trusted buyer and one blocked buyer", () => {
    expect(seed.filter((o) => o.status === "returned")).toHaveLength(1);
    expect(seed.find((o) => o.status === "returned")?.buyerPhone).toBe(ROHIT.phone);
    expect(lists.trusted.map((b) => b.phone)).toEqual([ANJALI.phone]);
    expect(lists.blocked.map((b) => b.phone)).toEqual([VIKRAM.phone]);
  });
  it("starts with 5 paid & delivered orders and a 13% return rate", () => {
    const r = trackRecord(seed);
    expect(r.paidDelivered).toBe(5);
    expect(r.delivered).toBe(7);
    expect(r.returned).toBe(1);
    expect(r.returnRatePct).toBe(13);
  });
  it("re-anchors dates when reopened days later", () => {
    const old = buildSeedOrders(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const { orders } = rebaseSeed(old, undefined);
    const newest = Math.max(...orders.map((o) => new Date(o.createdAt).getTime()));
    expect(Date.now() - newest).toBeLessThan(60 * 60 * 1000);
  });
});

describe("sample chats", () => {
  it("has a sample for each COD rule", () => {
    expect(SAMPLES.map((s) => s.key)).toEqual(["new", "returned", "blocked", "trusted"]);
  });

  it("the new-buyer sample drafts Priya's saree for ₹2,450", () => {
    const d = fallbackDraft(SAMPLES[0]!.chat, SEED_CATALOG);
    expect(d.buyer_name).toBe("Priya");
    expect(d.buyer_phone).toBe("9811204521");
    expect(d.payment_hint).toBe("cod");
    expect(d.pincode).toBe("110085");
    const lines = linesFrom(SAMPLES[0]!.chat);
    expect(orderValue(lines, null)).toBe(2450);
    expect(buyerPrices(lines, null, DEFAULT_SETTINGS).prepaidTotal).toBe(2450);
  });

  it("the trusted sample asks for the old address, which is looked up from her last order", () => {
    expect(wantsSavedAddress(SAMPLES[3]!.chat)).toBe(true);
    expect(isPlaceholderAddress("my old address")).toBe(true);
    const last = lastAddressFor(ANJALI.phone, seed);
    expect(last?.address).toBe(ANJALI.address);
    expect(last?.pincode).toBe(ANJALI.pincode);
  });

  it("reads a free-form chat: per-item quantities, % discount, name, phone, UPI", () => {
    const d = fallbackDraft(
      "hi! 2 jhumkas and 1 dupatta for my sister, regular customer so some discount na? 10% off ok. name Kavya, 9876501234, will pay upi",
      SEED_CATALOG,
    );
    expect(Object.fromEntries(d.lines.map((l) => [l.catalog_id, l.qty]))).toEqual({
      "jhumka-silver": 2,
      "dupatta-blockprint": 1,
    });
    expect(d.discount).toEqual({ type: "percent", value: 10 });
    expect(d.buyer_name).toBe("Kavya");
    expect(d.buyer_phone).toBe("9876501234");
    expect(d.payment_hint).toBe("prepaid");
    expect(titleCaseName("priya")).toBe("Priya");
  });
});

describe("COD rules, in order", () => {
  it("a new buyer is allowed COD, with a nudge to pay now", () => {
    const c = decide("9811204521");
    expect(c).toMatchObject({ action: "allowed", reason: "default", prepayNudge: true });
  });

  it("a trusted buyer is allowed COD with no nudge", () => {
    expect(decide(ANJALI.phone)).toMatchObject({
      action: "allowed",
      reason: "trusted",
      prepayNudge: false,
    });
  });

  it("a blocked buyer gets prepaid only", () => {
    const c = decide(VIKRAM.phone);
    expect(c).toMatchObject({ action: "prepaid_only", reason: "blocked" });
    expect(prepaidOnlyReason(c, false)).toBe("COD isn't available for this order.");
  });

  it("a buyer with a returned parcel is asked for a part-payment", () => {
    const c = decide(ROHIT.phone);
    expect(c).toMatchObject({ action: "part_payment", reason: "returned", upfrontAmount: 490 });
    expect(codSummary(c, formatINR)).toBe(
      "Part-payment of ₹490 to confirm COD · An earlier parcel was returned",
    );
  });

  it("trusted is checked before the other rules", () => {
    const c = decide(ROHIT.phone, {
      trusted: [...lists.trusted, { phone: ROHIT.phone, name: ROHIT.name, at: "" }],
    });
    expect(c).toMatchObject({ action: "allowed", reason: "trusted" });
  });

  it("the seller can override a blocked or part-payment order", () => {
    expect(decide(VIKRAM.phone, { override: true })).toMatchObject({
      action: "allowed",
      reason: "override",
    });
    expect(decide(ROHIT.phone, { override: true }).action).toBe("allowed");
  });

  it("the seller's choice of 'pay now only' comes first", () => {
    const c = decide(ANJALI.phone, { codOffered: false });
    expect(c).toMatchObject({ action: "prepaid_only", reason: "seller" });
    expect(prepaidOnlyReason(c, true)).toBe(
      "This order has a custom item, so the seller needs payment upfront.",
    );
    expect(prepaidOnlyReason(c, false)).toBe(
      "The seller accepts online payment only for this order.",
    );
  });
});

describe("full path in the store", () => {
  beforeEach(() => actions.resetDemo());

  function newOrder(phone: string, name: string) {
    actions.openNewOrder();
    actions.updateDraft({
      status: "drafted",
      lines: linesFrom(SAMPLES[0]!.chat),
      buyerName: name,
      buyerPhone: phone,
      addressText: "flat 12 b block near hanuman mandir sector 4 rohini delhi 110085",
      pincode: "110085",
    });
    return actions.createLink();
  }

  const find = (id: string): Order => getState().orders.find((o) => o.id === id)!;

  it("paste, confirm, share, buyer pays, seller marks delivered: the track record grows", () => {
    const before = trackRecord(getState().orders).paidDelivered;
    const order = newOrder("9811204521", "Priya");
    expect(order.id).toBe("ORD-1013");
    expect(getState().sheet?.kind).toBe("link");

    actions.completePayment(order.id, "prepaid", 2450);
    expect(find(order.id).status).toBe("paid");
    actions.markDelivered(order.id);
    expect(find(order.id).status).toBe("delivered");
    expect(trackRecord(getState().orders).paidDelivered).toBe(before + 1);
  });

  it("a cash COD delivery doesn't count towards paid & delivered", () => {
    const before = trackRecord(getState().orders).paidDelivered;
    const order = newOrder("9811204521", "Priya");
    actions.confirmCod(order.id);
    actions.markDelivered(order.id);
    expect(trackRecord(getState().orders).paidDelivered).toBe(before);
  });

  it("a returned order is counted in the return rate and gives that phone a part-payment next time", () => {
    const order = newOrder("9811204521", "Priya");
    actions.completePayment(order.id, "prepaid", 2450);
    actions.markReturned(order.id);
    expect(find(order.id).status).toBe("returned");
    expect(trackRecord(getState().orders).returned).toBe(2);

    const next = newOrder("9811204521", "Priya");
    expect(codCheckFor(getState(), find(next.id))).toMatchObject({
      action: "part_payment",
      reason: "returned",
    });
  });

  it("Allow COD anyway flips a blocked order and flags it", () => {
    const order = newOrder(VIKRAM.phone, "Vikram");
    expect(codCheckFor(getState(), find(order.id)).action).toBe("prepaid_only");
    actions.allowCodAnyway(order.id);
    expect(find(order.id).override).toBe(true);
    expect(codCheckFor(getState(), find(order.id))).toMatchObject({ reason: "override" });
    actions.confirmCod(order.id);
    expect(find(order.id)).toMatchObject({ status: "cod_confirmed", override: true });
  });

  it("Trusted and Blocked lists move buyers between them", () => {
    actions.trustBuyer(VIKRAM.phone, VIKRAM.name);
    expect(getState().trusted.map((b) => b.phone)).toContain(VIKRAM.phone);
    expect(getState().blocked.map((b) => b.phone)).not.toContain(VIKRAM.phone);
    actions.untrustBuyer(VIKRAM.phone);
    expect(getState().trusted.map((b) => b.phone)).not.toContain(VIKRAM.phone);
  });

  it("Reset demo restores the seed, the lists and the settings", () => {
    newOrder("9811204521", "Priya");
    actions.updateSettings({ codFee: 99 });
    actions.trustBuyer("90000 00000", "Test");
    actions.resetDemo();
    const s = getState();
    expect(s.orders).toHaveLength(12);
    expect(s.settings.codFee).toBe(49);
    expect(s.settings.prepaidOffer).toBe("free_shipping");
    expect(s.trusted.map((b) => b.phone)).toEqual([ANJALI.phone]);
    expect(s.blocked.map((b) => b.phone)).toEqual([VIKRAM.phone]);
  });
});

describe("amounts and address checks", () => {
  const lines: OrderLine[] = [
    { id: "1", type: "catalog", name: "Saree", qty: 1, unitPrice: 2450, weightKg: 0.6 },
  ];

  it("caps a % or ₹ discount at 90% of the subtotal", () => {
    expect(capDiscount(lines, { type: "percent", value: 150 }).discount).toEqual({
      type: "percent",
      value: 90,
    });
    expect(capDiscount(lines, { type: "flat", value: 5000 }).discount).toEqual({
      type: "flat",
      value: 2205,
    });
  });

  it("validates pincodes and fills city/state", () => {
    expect(checkPincode("999999")).toEqual({ status: "invalid", error: "Invalid pincode" });
    expect(checkPincode("1100")).toEqual({ status: "invalid", error: "Enter a 6-digit pincode" });
    expect(checkPincode("110085")).toEqual({ status: "ok", city: "Delhi", state: "Delhi" });
    expect(checkPincode("452001")).toEqual({
      status: "ok",
      city: "Indore",
      state: "Madhya Pradesh",
    });
    expect(checkPincode("744101").status).toBe("unserviceable");
  });

  it("finds the city in an address", () => {
    expect(knownCityIn("Flat 12, Rohini, Delhi 110085")).toBe("Delhi");
    expect(knownCityIn("12, 4th Cross, Indiranagar, Bangalore")).toBe("Bengaluru");
    expect(cityFromAddress("near the temple")).toBe("");
  });
});
