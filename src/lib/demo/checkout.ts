/** Pure helpers for the buyer's checkout: payment methods, the price summary, last-used payment. */
import { samePhone } from "./cod";
import { discountAmount, subtotal } from "./money";
import type { CodCheck, Order, PayMethod, Settings } from "./types";

/** Online methods in the order they're listed, UPI first. COD is listed after them. */
export const ONLINE_METHODS: { key: Exclude<PayMethod, "cod">; label: string }[] = [
  { key: "upi", label: "UPI" },
  { key: "card", label: "Cards" },
  { key: "netbanking", label: "Netbanking" },
  { key: "wallet", label: "Wallets" },
];

export const UPI_APPS = ["Google Pay", "PhonePe", "Paytm", "BHIM"];

export type CheckoutSummary = {
  subtotal: number;
  discount: number;
  shipping: number;
  /** COD Fee – only when COD is the selected method. */
  codFee: number;
  total: number;
  /** Paid now through the link. */
  payNow: number;
  /** Left to pay on delivery. */
  onDelivery: number;
};

/** The price summary for the selected payment method. Everything is computed from the order lines. */
export function checkoutSummary(
  order: Pick<Order, "lines" | "discount">,
  settings: Settings,
  method: PayMethod,
  check: CodCheck,
): CheckoutSummary {
  const sub = subtotal(order.lines);
  const discount = discountAmount(order.lines, order.discount);
  const value = sub - discount;
  if (method !== "cod") {
    const shipping = settings.prepaidOffer === "free_shipping" ? 0 : settings.shipping;
    const total = value + shipping;
    return { subtotal: sub, discount, shipping, codFee: 0, total, payNow: total, onDelivery: 0 };
  }
  const shipping = settings.shipping;
  const codFee = settings.codFee;
  const total = value + shipping + codFee;
  const payNow = check.action === "part_payment" ? (check.upfrontAmount ?? 0) : 0;
  return { subtotal: sub, discount, shipping, codFee, total, payNow, onDelivery: total - payNow };
}

/** The payment method (and UPI app) this phone used on its most recent order, if any. */
export function lastUsedPayment(
  phone: string,
  orders: Order[],
  excludeId?: string,
): { method: PayMethod; app?: string | undefined } | null {
  const last = orders
    .filter((o) => o.id !== excludeId && o.method && samePhone(o.buyerPhone, phone))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return last?.method ? { method: last.method, app: last.payApp } : null;
}
