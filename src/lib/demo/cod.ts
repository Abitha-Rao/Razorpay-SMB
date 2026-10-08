/**
 * Simple COD rules, checked when the buyer picks COD:
 *   0. The seller's own choices come first: "Allow COD anyway" (override) and "offer COD on this
 *      order" (the seller always has the final say on payment options).
 *   1. Trusted buyers (the seller's list) are allowed COD.
 *   2. Otherwise: blocked buyers get prepaid only; a buyer with a returned parcel is asked for
 *      a part-payment; everyone else gets COD with a nudge to pay now.
 * There is no score and no risk level.
 */
import { upfrontAmount } from "./money";
import type { BuyerRef, CodCheck, CodReason, Order } from "./types";

export function normalizePhone(phone: string): string {
  return phone.toLowerCase().replace(/[^0-9x]/g, "");
}

export function samePhone(a: string, b: string): boolean {
  const x = normalizePhone(a);
  return !!x && x === normalizePhone(b);
}

export function isListed(phone: string, list: BuyerRef[] = []): boolean {
  return list.some((b) => samePhone(b.phone, phone));
}

/** This phone's earlier orders, and how many ended Delivered or Returned. */
export function phoneHistory(phone: string, orders: Order[], excludeId?: string) {
  const past = orders.filter((o) => o.id !== excludeId && samePhone(o.buyerPhone, phone));
  return {
    past,
    delivered: past.filter((o) => o.status === "delivered").length,
    returned: past.filter((o) => o.status === "returned").length,
  };
}

export type CodInput = {
  phone: string;
  orderValue: number;
  /** The seller chose to offer COD on this order. */
  codOffered: boolean;
  /** The seller tapped "Allow COD anyway". */
  override?: boolean | undefined;
  trusted: BuyerRef[];
  blocked: BuyerRef[];
  pastOrders: Order[];
  excludeOrderId?: string | undefined;
};

export function codDecision(input: CodInput): CodCheck {
  if (input.override) return { action: "allowed", reason: "override", prepayNudge: false };
  if (!input.codOffered) return { action: "prepaid_only", reason: "seller", prepayNudge: false };
  // a) Trusted buyers are allowed COD.
  if (isListed(input.phone, input.trusted))
    return { action: "allowed", reason: "trusted", prepayNudge: false };
  // b) Everyone else goes through the simple rules.
  if (isListed(input.phone, input.blocked))
    return { action: "prepaid_only", reason: "blocked", prepayNudge: false };
  if (phoneHistory(input.phone, input.pastOrders, input.excludeOrderId).returned > 0)
    return {
      action: "part_payment",
      reason: "returned",
      prepayNudge: false,
      upfrontAmount: upfrontAmount(input.orderValue),
    };
  return { action: "allowed", reason: "default", prepayNudge: true };
}

const REASON_TEXT: Record<CodReason, string> = {
  override: "You allowed COD for this order",
  seller: "You offered online payment only",
  trusted: "Trusted buyer",
  blocked: "Blocked buyer",
  returned: "An earlier parcel was returned",
  default: "No history to flag",
};

/** One plain line for the seller, e.g. "Part-payment of ₹490 · An earlier parcel was returned". */
export function codSummary(check: CodCheck, formatINR: (n: number) => string): string {
  const what =
    check.action === "allowed"
      ? check.prepayNudge
        ? "COD allowed, with a nudge to pay now"
        : "COD allowed"
      : check.action === "part_payment"
        ? `Part-payment of ${formatINR(check.upfrontAmount ?? 0)} to confirm COD`
        : "Prepaid only";
  return `${what} · ${REASON_TEXT[check.reason]}`;
}

/** The one line the buyer sees when only "Pay now" is offered. */
export function prepaidOnlyReason(check: CodCheck, hasCustomItem: boolean): string {
  if (check.reason === "seller")
    return hasCustomItem
      ? "This order has a custom item, so the seller needs payment upfront."
      : "The seller accepts online payment only for this order.";
  return "COD isn't available for this order.";
}
