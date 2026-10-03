/**
 * Shipping without an aggregator or tracking API: the seller books with their own courier
 * and types the tracking number. Tracking links are placeholders to each courier's site.
 */
import type { Courier, Order } from "./types";

export const COURIERS: Courier[] = [
  "Delhivery",
  "Shadowfax",
  "Ekart",
  "India Post",
  "DTDC",
  "Other",
];

const TRACKING_URL: Partial<Record<Courier, (awb: string) => string>> = {
  Delhivery: (awb) => `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`,
  Shadowfax: (awb) => `https://tracker.shadowfax.in/#/track/${encodeURIComponent(awb)}`,
  Ekart: (awb) => `https://ekartlogistics.com/shipmenttrack/${encodeURIComponent(awb)}`,
  "India Post": () =>
    "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx",
  DTDC: (awb) => `https://www.dtdc.in/tracking.asp?strCnno=${encodeURIComponent(awb)}`,
};

/** Placeholder tracking link for the order's courier, or null for "Other" / no tracking number. */
export function trackingUrl(order: Pick<Order, "courier" | "awb">): string | null {
  if (!order.courier || !order.awb) return null;
  return TRACKING_URL[order.courier]?.(order.awb) ?? null;
}

/** An order left in "Shipped" becomes Delivered automatically after this long. */
export const AUTO_DELIVER_DAYS = 10;
export const AUTO_DELIVER_MS = AUTO_DELIVER_DAYS * 24 * 60 * 60 * 1000;

export function fullAddress(order: Pick<Order, "address" | "pincode" | "city" | "state">): string {
  const base = order.address ?? "";
  const tail = [order.city, order.state].filter(
    (p) => p && !base.toLowerCase().includes(p.toLowerCase()),
  );
  const pin = order.pincode && !base.includes(order.pincode) ? order.pincode : "";
  return [base, ...tail].filter(Boolean).join(", ") + (pin ? ` ${pin}` : "");
}
