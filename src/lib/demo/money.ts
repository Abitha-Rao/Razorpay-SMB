import type { Discount, Order, OrderLine, Settings } from "./types";

export function formatINR(amount: number): string {
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

export function lineTotal(line: OrderLine): number {
  return (line.unitPrice ?? 0) * line.qty;
}

export function subtotal(lines: OrderLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export function discountAmount(lines: OrderLine[], discount: Discount): number {
  if (!discount || !discount.value) return 0;
  const sub = subtotal(lines);
  const raw = discount.type === "percent" ? (sub * discount.value) / 100 : discount.value;
  return Math.min(Math.max(0, Math.round(raw)), sub);
}

/** Order value = items after discount. This is what the link shows and what risk rules use. */
export function orderValue(lines: OrderLine[], discount: Discount): number {
  return subtotal(lines) - discountAmount(lines, discount);
}

export function totalWeight(lines: OrderLine[]): number {
  return lines.reduce((sum, l) => sum + l.weightKg * l.qty, 0);
}

/**
 * The two prices a buyer sees. Totals are always derived from the lines;
 * nothing here accepts a typed-in total.
 */
export function buyerPrices(lines: OrderLine[], discount: Discount, settings: Settings) {
  const value = orderValue(lines, discount);
  const prepaidShipping = settings.prepaidOffer === "free_shipping" ? 0 : settings.shipping;
  return {
    value,
    prepaidShipping,
    prepaidTotal: value + prepaidShipping,
    codShipping: settings.shipping,
    codFee: settings.codFee,
    codTotal: value + settings.shipping + settings.codFee,
  };
}

/** Upfront amount for a medium-risk COD: 20% of order value, rounded to ₹10, capped at 50%. */
export function upfrontAmount(value: number): number {
  const twentyPct = Math.round((value * 0.2) / 10) * 10;
  return Math.min(Math.max(twentyPct, 100), Math.floor(value * 0.5));
}

export function isLineComplete(line: OrderLine): boolean {
  return line.name.trim().length > 0 && line.qty >= 1 && (line.unitPrice ?? 0) > 0;
}

/** What the order costs the buyer: items + shipping + COD fee (shipping/fee are set once they choose). */
export function orderTotal(order: Order): number {
  return orderValue(order.lines, order.discount) + order.shippingCharged + order.codFee;
}

/** Left to collect in cash on delivery (0 for prepaid or not-yet-chosen orders). */
export function dueOnDelivery(order: Order): number {
  if (order.paymentMode !== "cod" && order.paymentMode !== "partial") return 0;
  if (order.status === "delivered" || order.status === "refused") return 0;
  return Math.max(0, orderTotal(order) - order.paidAmount);
}
