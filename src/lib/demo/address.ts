import type { Order } from "./types";

/** Address, city/state and pincode as one line, without repeating parts already in the address. */
export function fullAddress(order: Pick<Order, "address" | "pincode" | "city" | "state">): string {
  const base = order.address ?? "";
  const tail = [order.city, order.state].filter(
    (p) => p && !base.toLowerCase().includes(p.toLowerCase()),
  );
  const pin = order.pincode && !base.includes(order.pincode) ? order.pincode : "";
  return [base, ...tail].filter(Boolean).join(", ") + (pin ? ` ${pin}` : "");
}
