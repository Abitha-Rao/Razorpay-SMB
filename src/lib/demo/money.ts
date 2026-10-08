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

export const MAX_PERCENT_DISCOUNT = 90;

/**
 * Keep a discount within limits: at most 90% of the subtotal, whether entered as % or ₹,
 * so an order can never be free. Returns the capped discount and a warning if it changed.
 */
export function capDiscount(
  lines: OrderLine[],
  discount: Discount,
): { discount: Discount; warning: string | null } {
  if (!discount || !(discount.value > 0)) return { discount: null, warning: null };
  if (discount.type === "percent" && discount.value > MAX_PERCENT_DISCOUNT)
    return {
      discount: { type: "percent", value: MAX_PERCENT_DISCOUNT },
      warning: `Discount capped at ${MAX_PERCENT_DISCOUNT}%`,
    };
  const max = Math.floor((subtotal(lines) * MAX_PERCENT_DISCOUNT) / 100);
  if (discount.type === "flat" && discount.value > max)
    return {
      discount: { type: "flat", value: max },
      warning: `Discount capped at ${formatINR(max)} (${MAX_PERCENT_DISCOUNT}% of subtotal)`,
    };
  return { discount, warning: null };
}

export function discountAmount(lines: OrderLine[], discount: Discount): number {
  const capped = capDiscount(lines, discount).discount;
  if (!capped) return 0;
  const sub = subtotal(lines);
  const raw = capped.type === "percent" ? (sub * capped.value) / 100 : capped.value;
  return Math.min(Math.max(0, Math.round(raw)), Math.max(0, sub - 1));
}

/** Order value = items after discount. This is what the payment link shows. */
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

/** Advance for a part-payment COD: 20% of the order value, rounded to ₹10, capped at 50%. */
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
  if (order.status === "delivered" || order.status === "returned") return 0;
  return Math.max(0, orderTotal(order) - order.paidAmount);
}
