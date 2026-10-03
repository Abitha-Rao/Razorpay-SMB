/**
 * Every buyer-facing message is written for the seller to share from their own WhatsApp
 * (or copy). Razorpay never messages the buyer directly in this concept.
 */
import { buyerPrices, dueOnDelivery, formatINR, orderTotal } from "./money";
import { SELLER } from "./seed";
import type { Order, Settings } from "./types";

export type MessageKind = "link" | "remind" | "cod_confirm" | "ship_update";

export function linkUrl(order: Pick<Order, "linkCode">): string {
  return `rzp.io/ol/${order.linkCode}`;
}

function greeting(order: Pick<Order, "buyerName">): string {
  const first = order.buyerName && order.buyerName !== "Buyer" ? order.buyerName.split(" ")[0] : "";
  return first ? `Hi ${first}` : "Hi";
}

export function buyerMessage(kind: MessageKind, order: Order, settings: Settings): string {
  const hi = greeting(order);
  const link = linkUrl(order);
  switch (kind) {
    case "link":
      return `${hi}, here is your order from ${SELLER.name}: ${formatINR(
        buyerPrices(order.lines, order.discount, settings).prepaidTotal,
      )}. Confirm address and pay here: ${link}`;
    case "remind":
      return `${hi}, a gentle reminder for your order from ${SELLER.name} (${formatINR(
        orderTotal(order),
      )}). Pay or choose COD here: ${link}`;
    case "cod_confirm":
      return `${hi}, confirming your COD order of ${formatINR(dueOnDelivery(order))} from ${
        SELLER.name
      }, to be paid on delivery. Please reply YES to confirm and we'll ship it.`;
    case "ship_update":
      return `${hi}, your order from ${SELLER.name} has shipped via ${order.courier ?? "courier"}${
        order.awb ? `, tracking number ${order.awb}` : ""
      }. Track: ${link}`;
  }
}

export const MESSAGE_TITLE: Record<MessageKind, string> = {
  link: "Share order link",
  remind: "Remind buyer",
  cod_confirm: "Confirm COD with buyer",
  ship_update: "Share shipping update",
};
