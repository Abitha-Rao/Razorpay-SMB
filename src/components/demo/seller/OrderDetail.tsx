import { toast } from "sonner";

import {
  Btn,
  Card,
  MarkedByYou,
  ScreenHeader,
  SectionTitle,
  StatusChip,
  TIER_META,
  Timeline,
} from "@/components/demo/ui";
import {
  discountAmount,
  dueOnDelivery,
  formatINR,
  lineTotal,
  orderTotal,
  orderValue,
  subtotal,
} from "@/lib/demo/money";
import { fullAddress, trackingUrl } from "@/lib/demo/shipping";
import { actions, useStore } from "@/lib/demo/store";
import type { Order } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

const PAY_LABEL: Record<Order["paymentMode"], string> = {
  pending: "Not chosen yet",
  prepaid: "Prepaid online",
  cod: "Cash on delivery",
  partial: "Part paid online, rest on delivery",
};

/** Expected remaining steps, for the greyed-out part of the timeline. */
function upcomingSteps(o: Order): string[] {
  if (o.status === "refused" || o.status === "delivered") return [];
  const done = new Set(o.timeline.map((t) => t.label));
  const steps: string[] = [];
  if (!done.has("Opened")) steps.push("Opened");
  if (o.status === "awaiting_payment") steps.push("Paid / COD confirmed");
  if (!o.shippedAt) steps.push("Shipped");
  steps.push("Delivered");
  return steps;
}

export function OrderDetail({ id }: { id: string }) {
  const order = useStore((s) => s.orders.find((o) => o.id === id));
  if (!order) return null;

  const value = orderValue(order.lines, order.discount);
  const disc = discountAmount(order.lines, order.discount);
  const total = orderTotal(order);
  const due = dueOnDelivery(order);
  const canShip = ["paid", "cod_confirmed", "partial_paid"].includes(order.status);
  const isCod = order.paymentMode === "cod" || order.paymentMode === "partial";
  const track = trackingUrl(order);

  return (
    <div className="pb-8">
      <ScreenHeader
        title={order.id}
        onBack={actions.back}
        right={
          <div className="flex items-center gap-1.5">
            {order.deliveredBy === "seller" && <MarkedByYou />}
            <StatusChip status={order.status} />
          </div>
        }
      />
      <div className="space-y-4 px-4 pt-4">
        <div>
          <p className="text-lg font-semibold text-navy">{order.buyerName}</p>
          <p className="text-sm text-navy/60">{order.buyerPhone || "No phone"}</p>
          {order.address && <p className="mt-1 text-sm text-navy/70">{fullAddress(order)}</p>}
        </div>

        {order.risk && (
          <div className={cn("rounded-2xl p-3", TIER_META[order.risk.tier].cls)}>
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", TIER_META[order.risk.tier].dot)} />
              <span className="text-xs font-semibold">COD check · score {order.risk.score}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-navy">
              {order.verdictSource === "claude" && <span className="mr-1 font-semibold">Why:</span>}
              {order.verdict}
            </p>
            <details className="mt-2 text-xs text-navy/70">
              <summary className="cursor-pointer select-none font-medium">Rules that fired</summary>
              <ul className="mt-1 space-y-0.5">
                {order.risk.reasons.map((r) => (
                  <li key={r.code} className="flex justify-between">
                    <span>{r.label}</span>
                    <span className="font-mono">{r.points > 0 ? `+${r.points}` : r.points}</span>
                  </li>
                ))}
                {order.risk.prepaidReason === "custom" && (
                  <li>Custom orders are prepaid only on this strictness</li>
                )}
              </ul>
            </details>
          </div>
        )}

        <Card>
          <SectionTitle>Items</SectionTitle>
          <ul className="divide-y divide-navy/8">
            {order.lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 py-2 text-sm">
                <span className="text-navy">
                  {l.name}
                  <span className="text-navy/50">
                    {" "}
                    × {l.qty}
                    {l.size ? ` · ${l.size}` : ""}
                    {l.type === "custom" ? " · custom" : ""}
                  </span>
                </span>
                <span className="font-medium text-navy">{formatINR(lineTotal(l))}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 space-y-1 border-t border-navy/10 pt-2 text-sm">
            <Line label="Subtotal" value={formatINR(subtotal(order.lines))} />
            {disc > 0 && <Line label="Discount" value={"−" + formatINR(disc)} />}
            {order.paymentMode !== "pending" && (
              <>
                <Line
                  label="Shipping"
                  value={order.shippingCharged ? formatINR(order.shippingCharged) : "Free"}
                />
                {order.codFee > 0 && <Line label="COD fee" value={formatINR(order.codFee)} />}
              </>
            )}
            <Line
              label="Total"
              value={formatINR(order.paymentMode === "pending" ? value : total)}
              bold
            />
          </div>
        </Card>

        <Card>
          <SectionTitle>Payment</SectionTitle>
          <Line label="Mode" value={PAY_LABEL[order.paymentMode]} />
          <Line label="Collected so far" value={formatINR(order.paidAmount)} />
          {due > 0 && <Line label="To collect on delivery" value={formatINR(due)} />}
          {order.status === "delivered" && (
            <Line
              label="Payment"
              value={
                order.paymentVerified
                  ? order.deliveredBy === "upi"
                    ? "Verified · UPI at doorstep"
                    : "Verified · paid online"
                  : "Cash – not verified"
              }
            />
          )}
        </Card>

        <Card>
          <SectionTitle
            action={
              track ? (
                <a
                  href={track}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-2 text-xs font-semibold text-rzp"
                >
                  Track on {order.courier} ↗
                </a>
              ) : undefined
            }
          >
            Timeline
          </SectionTitle>
          <Timeline events={order.timeline} upcoming={upcomingSteps(order)} />
        </Card>

        {order.status === "awaiting_payment" && (
          <Btn size="lg" className="w-full" onClick={() => actions.openSheet("remind", order.id)}>
            Remind buyer
          </Btn>
        )}

        {canShip && (
          <>
            <Btn size="lg" className="w-full" onClick={() => actions.openSheet("ship", order.id)}>
              Ship order
            </Btn>
            {isCod && (
              <Btn
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => actions.openSheet("cod_confirm", order.id)}
              >
                Confirm COD with buyer
              </Btn>
            )}
          </>
        )}

        {order.status === "shipped" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Btn
                variant="success"
                size="lg"
                onClick={() => {
                  actions.markDelivered(order.id, "seller");
                  toast.success("Marked as delivered");
                }}
              >
                Mark as delivered
              </Btn>
              <Btn
                variant="danger"
                size="lg"
                onClick={() => {
                  actions.markReturned(order.id);
                  toast(`Marked as returned · ${order.buyerName} is now prepaid only`);
                }}
              >
                Mark as returned
              </Btn>
            </div>
            <Btn
              variant="secondary"
              className="w-full"
              onClick={() => actions.openSheet("ship_update", order.id)}
            >
              Share shipping update
            </Btn>
            <p className="text-center text-[11px] text-navy/45">
              If neither is tapped, this becomes Delivered 10 days after shipping.
            </p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 rounded-xl border border-dashed border-navy/20 px-3 py-2 text-xs">
              <span className="text-navy/40">Demo:</span>
              <button
                className="font-medium text-rzp"
                onClick={() => actions.simulateTenDays(order.id)}
              >
                Simulate 10 days later
              </button>
              {isCod && (
                <button
                  className="font-medium text-rzp"
                  onClick={() => actions.markDelivered(order.id, "upi")}
                >
                  Simulate doorstep UPI payment
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between py-0.5 text-sm", bold && "pt-1 font-semibold")}>
      <span className={bold ? "text-navy" : "text-navy/60"}>{label}</span>
      <span className="text-navy">{value}</span>
    </div>
  );
}
