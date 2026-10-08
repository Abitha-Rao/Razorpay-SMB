import { toast } from "sonner";

import {
  Btn,
  Card,
  OverrideTag,
  ScreenHeader,
  SectionTitle,
  StatusChip,
  Timeline,
} from "@/components/demo/ui";
import { codSummary, isListed } from "@/lib/demo/cod";
import { fullAddress } from "@/lib/demo/address";
import {
  discountAmount,
  dueOnDelivery,
  formatINR,
  lineTotal,
  orderTotal,
  orderValue,
  subtotal,
} from "@/lib/demo/money";
import { actions, codCheckFor, useStore } from "@/lib/demo/store";
import type { Order } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

const PAY_LABEL: Record<Order["paymentMode"], string> = {
  pending: "Not chosen yet",
  prepaid: "Prepaid through the link",
  cod: "Cash on delivery",
  partial: "Part paid through the link, rest on delivery",
};

/** Expected remaining steps, for the greyed-out part of the timeline. */
function upcomingSteps(o: Order): string[] {
  if (o.status === "returned" || o.status === "delivered") return [];
  if (o.status === "awaiting_payment") return ["Paid / COD confirmed", "Delivered"];
  return ["Delivered"];
}

export function OrderDetail({ id }: { id: string }) {
  const order = useStore((s) => s.orders.find((o) => o.id === id));
  const orders = useStore((s) => s.orders);
  const trusted = useStore((s) => s.trusted);
  const blocked = useStore((s) => s.blocked);
  if (!order) return null;

  const value = orderValue(order.lines, order.discount);
  const disc = discountAmount(order.lines, order.discount);
  const total = orderTotal(order);
  const due = dueOnDelivery(order);
  const isCod = order.paymentMode === "cod" || order.paymentMode === "partial";
  const awaiting = order.status === "awaiting_payment";
  const open = ["paid", "cod_confirmed", "partial_paid"].includes(order.status);

  // While the buyer hasn't paid, show what the COD rules would say right now.
  const check =
    awaiting || !order.codCheck ? codCheckFor({ orders, trusted, blocked }, order) : order.codCheck;
  const showCheck = awaiting || !!order.codCheck;
  const isTrusted = isListed(order.buyerPhone, trusted);
  const isBlocked = isListed(order.buyerPhone, blocked);
  const canOverride = awaiting && !order.override && check.action !== "allowed";

  return (
    <div className="pb-8">
      <ScreenHeader
        title={order.id}
        onBack={actions.back}
        right={
          <div className="flex items-center gap-1.5">
            {order.override && <OverrideTag />}
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

        {showCheck && (
          <Card className={cn(check.action === "allowed" ? "bg-success/8" : "bg-warning/10")}>
            <SectionTitle>{awaiting ? "If the buyer picks COD" : "COD check"}</SectionTitle>
            <p className="text-sm leading-relaxed text-navy">{codSummary(check, formatINR)}</p>
            {canOverride && (
              <Btn
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => {
                  actions.allowCodAnyway(order.id);
                  toast("COD allowed for this order");
                }}
              >
                Allow COD anyway
              </Btn>
            )}
          </Card>
        )}

        {order.buyerPhone && (
          <div className="space-y-2 rounded-2xl bg-surface px-3 py-2.5">
            <p className="text-sm text-navy">
              {isTrusted
                ? "★ Trusted buyer – COD always allowed"
                : isBlocked
                  ? "Blocked buyer – prepaid only"
                  : "Not on your Trusted or Blocked list"}
            </p>
            <div className="flex gap-2">
              {isTrusted ? (
                <Btn
                  size="sm"
                  variant="secondary"
                  onClick={() => actions.untrustBuyer(order.buyerPhone)}
                >
                  Remove from trusted
                </Btn>
              ) : (
                <Btn
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    actions.trustBuyer(order.buyerPhone, order.buyerName);
                    toast(`${order.buyerName} added to Trusted buyers`);
                  }}
                >
                  Add to trusted
                </Btn>
              )}
              {isBlocked ? (
                <Btn
                  size="sm"
                  variant="secondary"
                  onClick={() => actions.unblockBuyer(order.buyerPhone)}
                >
                  Unblock
                </Btn>
              ) : (
                <Btn
                  size="sm"
                  variant="secondary"
                  className="border-danger/30 text-danger hover:bg-danger/5"
                  onClick={() => {
                    actions.blockBuyer(order.buyerPhone, order.buyerName);
                    toast(`${order.buyerName} blocked`);
                  }}
                >
                  Block buyer
                </Btn>
              )}
            </div>
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
          {!order.codOffered && <Line label="Options offered" value="Pay now only" />}
        </Card>

        <Card>
          <SectionTitle>Timeline</SectionTitle>
          <Timeline events={order.timeline} upcoming={upcomingSteps(order)} />
        </Card>

        {awaiting && (
          <Btn size="lg" className="w-full" onClick={() => actions.openSheet("remind", order.id)}>
            Remind buyer
          </Btn>
        )}

        {open && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Btn
                variant="success"
                size="lg"
                onClick={() => {
                  actions.markDelivered(order.id);
                  toast.success("Marked as delivered");
                }}
              >
                Mark delivered
              </Btn>
              <Btn
                variant="danger"
                size="lg"
                onClick={() => {
                  actions.markReturned(order.id);
                  toast("Marked as returned");
                }}
              >
                Mark returned
              </Btn>
            </div>
            {isCod && (
              <Btn
                variant="secondary"
                className="w-full"
                onClick={() => actions.openSheet("cod_confirm", order.id)}
              >
                Confirm COD with buyer
              </Btn>
            )}
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
