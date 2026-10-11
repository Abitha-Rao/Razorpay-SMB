/** Orders that were paid or confirmed a while ago but haven't been marked Delivered or Returned. */
import type { Order } from "./types";

/** An order needs marking once it was paid or confirmed more than this many days ago. */
export const MARK_AFTER_DAYS = 3;
const MARK_AFTER_MS = MARK_AFTER_DAYS * 24 * 60 * 60 * 1000;

const OPEN_STATUSES: Order["status"][] = ["paid", "cod_confirmed", "partial_paid"];

/** The timeline events that mark an order as paid, COD-confirmed or part-paid. */
const CONFIRM_EVENT = /^(Paid|COD confirmed|Part paid)/;

/** When the order was paid or confirmed, from its timeline; createdAt if there isn't such an event. */
export function confirmedAt(order: Pick<Order, "timeline" | "createdAt">): number {
  const event = order.timeline.find((t) => CONFIRM_EVENT.test(t.label));
  return new Date(event?.at ?? order.createdAt).getTime();
}

export function needsMarking(order: Order, now: number = Date.now()): boolean {
  return OPEN_STATUSES.includes(order.status) && now - confirmedAt(order) > MARK_AFTER_MS;
}

export function ordersNeedingMarking(orders: Order[], now: number = Date.now()): Order[] {
  return orders.filter((o) => needsMarking(o, now));
}

export function markingBannerText(count: number): string {
  return count === 1
    ? `1 order confirmed over ${MARK_AFTER_DAYS} days ago. Mark it delivered or returned to keep your track record accurate.`
    : `${count} orders confirmed over ${MARK_AFTER_DAYS} days ago. Mark them delivered or returned to keep your track record accurate.`;
}
