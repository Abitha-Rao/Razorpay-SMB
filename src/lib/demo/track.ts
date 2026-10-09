import type { Order } from "./types";

export type TrackRecord = {
  /** Orders paid through the link (in full or in part) and marked Delivered. */
  paidDelivered: number;
  delivered: number;
  returned: number;
  /** Returned ÷ (delivered + returned), or null before any order has an outcome. */
  returnRatePct: number | null;
};

/**
 * Only orders paid through the link and marked Delivered count as "paid & delivered".
 * Cash-only COD deliveries can't be verified, so they are left out. The return rate is
 * measured across every order the seller marked, so returns can't be hidden.
 */
export function trackRecord(orders: Order[]): TrackRecord {
  const delivered = orders.filter((o) => o.status === "delivered");
  const returned = orders.filter((o) => o.status === "returned").length;
  const paidDelivered = delivered.filter(
    (o) => o.paymentMode === "prepaid" || o.paymentMode === "partial",
  ).length;
  const settled = delivered.length + returned;
  return {
    paidDelivered,
    delivered: delivered.length,
    returned,
    returnRatePct: settled ? Math.round((returned / settled) * 100) : null,
  };
}
