import { beforeEach, describe, expect, it } from "vitest";

import { checkoutSummary, lastUsedPayment } from "@/lib/demo/checkout";
import { SIZE_FLAG, draftFlags, groundedSize, needsSize } from "@/lib/demo/draftChecks";
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
  SELLER,
  SELLER_INITIALS,
  VIKRAM,
  buildSeedOrders,
  seedAddressBook,
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

  it("the new-buyer sample drafts Priya's kurti for ₹1,200, with no size named", () => {
    const d = fallbackDraft(SAMPLES[0]!.chat, SEED_CATALOG);
    expect(d.buyer_name).toBe("Priya");
    expect(d.buyer_phone).toBe("9811204521");
    expect(d.payment_hint).toBe("cod");
    expect(d.pincode).toBe("110085");
    const lines = linesFrom(SAMPLES[0]!.chat);
    expect(orderValue(lines, null)).toBe(1200);
    expect(buyerPrices(lines, null, DEFAULT_SETTINGS).prepaidTotal).toBe(1200);
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

    actions.completePayment(order.id, "prepaid", 1200);
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
    actions.completePayment(order.id, "prepaid", 1200);
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

describe("checkout price summary", () => {
  const order = {
    lines: [
      { id: "1", type: "catalog", name: "Saree", qty: 1, unitPrice: 2450, weightKg: 0.6 },
    ] as OrderLine[],
    discount: null,
  };
  const allowed = { action: "allowed", reason: "default", prepayNudge: true } as const;
  const part = {
    action: "part_payment",
    reason: "returned",
    prepayNudge: false,
    upfrontAmount: 490,
  } as const;

  it("online: free shipping, no COD Fee", () => {
    const s = checkoutSummary(order, DEFAULT_SETTINGS, "upi", allowed);
    expect(s).toMatchObject({ shipping: 0, codFee: 0, total: 2450, payNow: 2450, onDelivery: 0 });
  });

  it("COD adds shipping and the COD Fee, all due on delivery", () => {
    const s = checkoutSummary(order, DEFAULT_SETTINGS, "cod", allowed);
    expect(s).toMatchObject({ shipping: 70, codFee: 49, total: 2569, payNow: 0, onDelivery: 2569 });
  });

  it("part-payment splits the COD total into an advance and the rest", () => {
    const s = checkoutSummary(order, DEFAULT_SETTINGS, "cod", part);
    expect(s).toMatchObject({ total: 2569, payNow: 490, onDelivery: 2079 });
  });

  it("shows the seller's discount", () => {
    const s = checkoutSummary(
      { ...order, discount: { type: "percent", value: 10 } },
      DEFAULT_SETTINGS,
      "upi",
      allowed,
    );
    expect(s).toMatchObject({ subtotal: 2450, discount: 245, total: 2205 });
  });
});

describe("returning buyers", () => {
  it("preselects the last-used payment method", () => {
    expect(lastUsedPayment(ANJALI.phone, seed)).toEqual({ method: "cod", app: undefined });
    expect(lastUsedPayment("98100 77889", seed)).toEqual({ method: "upi", app: "PhonePe" });
    expect(lastUsedPayment("99001 23456", seed)?.method).toBe("card");
    expect(lastUsedPayment("9811204521", seed)).toBeNull();
  });

  it("has a saved Home address for every seed buyer", () => {
    const book = seedAddressBook();
    expect(book).toHaveLength(10);
    expect(book.every((a) => a.label === "Home" && a.pincode && a.city && a.state)).toBe(true);
  });
});

describe("buyer checkout steps", () => {
  beforeEach(() => actions.resetDemo());

  function link(phone: string) {
    actions.openNewOrder();
    actions.updateDraft({
      status: "drafted",
      lines: linesFrom(SAMPLES[0]!.chat),
      buyerName: "Priya",
      buyerPhone: phone,
      addressText: "flat 12 b block near hanuman mandir sector 4 rohini delhi 110085",
      pincode: "110085",
    });
    return actions.createLink();
  }

  it("starts at the mobile number, prefilled only from a full number", () => {
    link("9811204521");
    expect(getState().buyer).toMatchObject({ step: "mobile", phone: "9811204521" });
    link("98xxxxxx21");
    expect(getState().buyer?.phone).toBe("");
  });

  it("a returning number loads its saved address after the OTP", () => {
    link("9811204521");
    actions.updateBuyer({ phone: "9829011223", otp: "123456" });
    actions.verifyOtp();
    const b = getState().buyer!;
    expect(b).toMatchObject({ step: "main", returning: true });
    expect(b.address).toMatchObject({
      label: "Home",
      name: "Anjali Verma",
      pincode: "302018",
      city: "Jaipur",
    });
    expect(getState().orders[0]!.buyerPhone).toBe("9829011223");
  });

  it("a new number is asked for an address, and can save it as Home, Work or Other", () => {
    const order = link("9811204521");
    actions.updateBuyer({ phone: "9811204521", otp: "654321" });
    actions.verifyOtp();
    expect(getState().buyer).toMatchObject({ step: "address", returning: false });

    const before = getState().addressBook.length;
    actions.submitAddress({
      name: "Priya",
      address: "flat 12 b block near hanuman mandir sector 4 rohini delhi",
      pincode: "110085",
      city: "Delhi",
      state: "Delhi",
      label: "Work",
    });
    expect(getState().addressBook).toHaveLength(before + 1);
    expect(getState().addressBook.at(-1)).toMatchObject({ label: "Work", phone: "9811204521" });
    expect(getState().buyer?.step).toBe("main");
    expect(getState().orders.find((o) => o.id === order.id)).toMatchObject({
      city: "Delhi",
      state: "Delhi",
    });

    // The same number is a returning buyer next time.
    link("9811204521");
    actions.updateBuyer({ phone: "9811204521", otp: "111111" });
    actions.verifyOtp();
    expect(getState().buyer).toMatchObject({ step: "main", returning: true });
  });

  it("an address with no label is used for the order but not saved", () => {
    link("9811204521");
    actions.updateBuyer({ phone: "9811204521", otp: "654321" });
    actions.verifyOtp();
    const before = getState().addressBook.length;
    actions.submitAddress({
      name: "Priya",
      address: "flat 12 b block near hanuman mandir sector 4 rohini delhi",
      pincode: "110085",
      city: "Delhi",
      state: "Delhi",
    });
    expect(getState().addressBook).toHaveLength(before);
  });

  it("paying records the method and app for next time", () => {
    const order = link("9811204521");
    actions.completePayment(order.id, "prepaid", 1200, "upi", "PhonePe");
    expect(lastUsedPayment("9811204521", getState().orders, "other")).toEqual({
      method: "upi",
      app: "PhonePe",
    });
  });
});

describe("blocking and adding buyers", () => {
  beforeEach(() => actions.resetDemo());

  it("a buyer is on one list at a time", () => {
    actions.blockBuyer(ANJALI.phone, ANJALI.name);
    expect(getState().blocked.map((b) => b.phone)).toContain(ANJALI.phone);
    expect(getState().trusted.map((b) => b.phone)).not.toContain(ANJALI.phone);
    actions.trustBuyer(ANJALI.phone, ANJALI.name);
    expect(getState().trusted.map((b) => b.phone)).toContain(ANJALI.phone);
    expect(getState().blocked.map((b) => b.phone)).not.toContain(ANJALI.phone);
  });

  it("a blocked buyer sees COD unavailable", () => {
    actions.blockBuyer("94000 11111", "Test Buyer");
    expect(decide("94000 11111", { blocked: getState().blocked })).toMatchObject({
      action: "prepaid_only",
      reason: "blocked",
    });
  });

  it("Add buyer puts someone who hasn't ordered on a list", () => {
    actions.addBuyerToList("trusted", "9876543210", "Meena");
    actions.addBuyerToList("blocked", "9123456780", "Ravi");
    expect(getState().trusted.map((b) => b.name)).toContain("Meena");
    expect(getState().blocked.map((b) => b.name)).toContain("Ravi");
    actions.addBuyerToList("blocked", "9876543210", "Meena");
    expect(getState().trusted.map((b) => b.name)).not.toContain("Meena");
    expect(getState().blocked.map((b) => b.name)).toContain("Meena");
  });
});

describe("missing-detail flags", () => {
  const kurti: OrderLine = {
    id: "k",
    type: "catalog",
    catalogId: "kurti-blue",
    name: "Blue cotton kurti",
    qty: 1,
    unitPrice: 1200,
    weightKg: 0.3,
  };
  const saree: OrderLine = {
    ...kurti,
    id: "s",
    catalogId: "saree-bandhani-green",
    name: "Green bandhani saree",
  };

  it("sample 1 asks for a kurti without naming a size, so the form flags it", () => {
    const sample = SAMPLES[0]!;
    expect(sample.chat).toMatch(/kurti/i);
    expect(sample.chat).not.toMatch(/size|\b(xs|s|m|l|xl|xxl|small|medium|large)\b/i);
    const d = fallbackDraft(sample.chat, SEED_CATALOG);
    expect(d.lines[0]).toMatchObject({ catalog_id: "kurti-blue", qty: 1 });
    expect(d.lines[0]!.size).toBeFalsy();
    expect(draftFlags(linesFrom(sample.chat), [], SEED_CATALOG)).toEqual([SIZE_FLAG]);
  });

  it("flags a sized item even when the AI reports nothing, and clears once a size is typed", () => {
    expect(draftFlags([kurti], [], SEED_CATALOG)).toEqual(["Size not mentioned – please check"]);
    expect(draftFlags([{ ...kurti, size: "M" }], [], SEED_CATALOG)).toEqual([]);
    expect(needsSize(kurti, SEED_CATALOG)).toBe(true);
    expect(needsSize(saree, SEED_CATALOG)).toBe(false);
  });

  it("doesn't repeat the AI's own size flag, and keeps its other flags", () => {
    const flags = draftFlags(
      [kurti],
      ["Size not specified for the kurti", "Phone number looks incomplete"],
      SEED_CATALOG,
    );
    expect(flags).toEqual([SIZE_FLAG, "Phone number looks incomplete"]);
  });

  it("drops a size the model guessed, but keeps one the buyer wrote", () => {
    expect(groundedSize("M", "hi, 1 blue kurti pls")).toBeUndefined();
    expect(groundedSize("M", "blue kurti size M pls")).toBe("M");
    expect(groundedSize("M", "blue kurti, medium")).toBe("M");
    expect(groundedSize("XL", "kurti xl please")).toBe("XL");
    expect(groundedSize("M", "I'm in jaipur")).toBeUndefined();
  });
});

describe("building an order without AI", () => {
  beforeEach(() => actions.resetDemo());

  it("opens a blank draft form with no AI source, and the order still goes through", () => {
    actions.openNewOrder();
    actions.updateDraft({ chat: "phone order" });
    actions.startBlankDraft();
    const d = getState().draft;
    expect(d).toMatchObject({
      status: "drafted",
      lines: [],
      buyerName: "",
      buyerPhone: "",
      codOffered: true,
      chat: "phone order",
    });
    expect(d.source).toBeUndefined();

    actions.updateDraft({
      buyerName: "meena",
      buyerPhone: "9876543210",
      lines: linesFrom("2 jhumkas please"),
    });
    const order = actions.createLink();
    expect(order).toMatchObject({ buyerName: "Meena", buyerPhone: "9876543210" });
    expect(order.lines[0]).toMatchObject({ catalogId: "jhumka-silver", qty: 2 });
  });
});

describe("order message samples and seller identity", () => {
  it("the seller is Shristi's Handloom in Jaipur", () => {
    expect(SELLER.name).toBe("Shristi's Handloom");
    expect(SELLER.city).toBe("Jaipur");
    expect(SELLER_INITIALS).toBe("SH");
  });

  it("every sample message drafts an order, and the first caption reads 'New buyer, COD'", () => {
    expect(SAMPLES[0]!.label).toBe("New buyer, COD");
    for (const sample of SAMPLES) {
      const d = fallbackDraft(sample.chat, SEED_CATALOG, sample.from);
      expect(d.lines.length, sample.label).toBeGreaterThan(0);
      expect(
        d.lines.every((l) => l.type === "catalog" && l.unit_price),
        sample.label,
      ).toBe(true);
      expect(d.payment_hint, sample.label).toBe("cod");
    }
  });

  it("a sample flags a missing detail, and a message without a size flags the size", () => {
    const flagged = SAMPLES.filter(
      (s) => fallbackDraft(s.chat, SEED_CATALOG, s.from).uncertain.length > 0,
    );
    expect(flagged.length).toBeGreaterThan(0);
    const d = fallbackDraft("2 blue kurti pls, cod. priya 9811204521", SEED_CATALOG);
    expect(d.uncertain).toContain("Size not mentioned – please check");
  });

  it("order message wording replaces 'chat' in the drafted flags", () => {
    const d = fallbackDraft("blue kurti size M", SEED_CATALOG);
    expect(d.uncertain).toContain("Buyer phone not in the message");
    expect(fallbackDraft("something nice", SEED_CATALOG).lines[0]!.name).toBe(
      "Item from the message (edit name)",
    );
  });
});
