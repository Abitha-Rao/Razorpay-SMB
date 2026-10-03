import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Btn,
  Card,
  Field,
  Spinner,
  Timeline,
  inputCls,
  notInPrototype,
} from "@/components/demo/ui";
import { cleanAddressFn, explainRiskFn } from "@/lib/demo/ai.functions";
import { fallbackCleanAddress } from "@/lib/demo/fallback";
import { buyerPrices, formatINR, lineTotal } from "@/lib/demo/money";
import { actionSentence, scoreRisk, templateVerdict } from "@/lib/demo/risk";
import { SELLER, UNSERVICEABLE_PINCODES } from "@/lib/demo/seed";
import { actions, getState, useStore } from "@/lib/demo/store";
import type { Order, RiskResult } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

const CHECKING_MS = 1000;

export function BuyerApp() {
  const buyer = useStore((s) => s.buyer);
  const order = useStore((s) =>
    s.buyer ? s.orders.find((o) => o.id === s.buyer!.orderId) : undefined,
  );

  // Mark the link as opened the first time the buyer sees it.
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    if (
      order &&
      openedFor.current !== order.id &&
      !order.timeline.some((t) => t.label === "Opened")
    ) {
      openedFor.current = order.id;
      actions.addTimeline(order.id, "Opened");
    }
  }, [order]);

  if (!buyer || !order) return <NoLink />;

  return (
    <div className="min-h-full bg-surface pb-8">
      <BuyerHeader order={order} />
      <div className="space-y-4 px-4 pt-4">
        {buyer.step === "order" && <OrderStep order={order} />}
        {buyer.step === "address" && <AddressStep />}
        {buyer.step === "payment" && <PaymentStep order={order} />}
        {buyer.step === "checking" && <Checking />}
        {buyer.step === "cod_outcome" && <CodOutcome order={order} />}
        {buyer.step === "checkout" && <MockCheckout order={order} />}
        {buyer.step === "done" && <Confirmation order={order} />}
      </div>
    </div>
  );
}

function NoLink() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-24 text-center">
      <div className="mb-3 text-4xl">🔗</div>
      <h2 className="text-lg font-semibold text-navy">No order link yet</h2>
      <p className="mt-1 text-sm text-navy/60">
        In the seller app, tap <b>New order</b>, draft from a chat and create a link. It opens here.
      </p>
      <Btn className="mt-5" onClick={() => actions.setView("seller")}>
        Go to seller app
      </Btn>
    </div>
  );
}

function BuyerHeader({ order }: { order: Order }) {
  const showCount = useStore((s) => s.settings.showOrderCount);
  return (
    <div className="bg-white px-4 pb-4 pt-3">
      <p className="text-[11px] text-navy/45">rzp.io/ol/{order.linkCode}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-base font-bold text-white">
          MH
        </div>
        <div>
          <p className="text-base font-semibold text-navy">{SELLER.name}</p>
          <p className="text-xs text-navy/55">{SELLER.city}</p>
        </div>
      </div>
      {showCount && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-[#027a48]">
          <span>✓</span> {SELLER.completedOrders} orders completed via Razorpay
        </p>
      )}
    </div>
  );
}

function OrderLines({ order }: { order: Order }) {
  return (
    <ul className="divide-y divide-navy/8">
      {order.lines.map((l) => (
        <li key={l.id} className="flex items-start justify-between gap-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-navy">{l.name}</p>
            <p className="text-xs text-navy/55">
              Qty {l.qty}
              {l.size ? ` · Size ${l.size}` : ""} · {formatINR(l.unitPrice ?? 0)} each
            </p>
          </div>
          <p className="text-sm font-semibold text-navy">{formatINR(lineTotal(l))}</p>
        </li>
      ))}
    </ul>
  );
}

function OrderStep({ order }: { order: Order }) {
  const settings = useStore((s) => s.settings);
  const p = buyerPrices(order.lines, order.discount, settings);
  return (
    <>
      <Card className="bg-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">Your order</p>
        <OrderLines order={order} />
        {p.value !== order.lines.reduce((s, l) => s + lineTotal(l), 0) && (
          <div className="flex justify-between border-t border-navy/8 pt-2 text-sm text-success">
            <span>Discount</span>
            <span>−{formatINR(order.lines.reduce((s, l) => s + lineTotal(l), 0) - p.value)}</span>
          </div>
        )}
        <div className="mt-1 flex items-baseline justify-between border-t border-navy/10 pt-3">
          <span className="text-sm font-semibold text-navy">Order total</span>
          <span className="text-xl font-bold text-navy">{formatINR(p.value)}</span>
        </div>
        <p className="mt-1 text-[11px] text-navy/45">
          Set by the seller. Shipping is added on the next step.
        </p>
      </Card>
      <Btn size="lg" className="w-full" onClick={() => actions.updateBuyer({ step: "address" })}>
        Confirm address
      </Btn>
    </>
  );
}

function AddressStep() {
  const buyer = useStore((s) => s.buyer!);
  const useLive = useStore((s) => s.settings.useLiveAi);
  const [cleaning, setCleaning] = useState(false);

  async function cleanup(address: string) {
    if (!address.trim() || address.trim().length < 12) return;
    const current = getState().buyer;
    if (current?.suggestion?.forAddress === address) return;
    setCleaning(true);
    let res: Awaited<ReturnType<typeof cleanAddressFn>>;
    try {
      res = await cleanAddressFn({ data: { address, useLive } });
    } catch {
      res = { source: "fallback", result: fallbackCleanAddress(address) };
    }
    setCleaning(false);
    // Ignore if the buyer kept typing meanwhile.
    if (getState().buyer?.address !== address) return;
    const same = res.result.clean_address.trim().toLowerCase() === address.trim().toLowerCase();
    actions.updateBuyer({
      suggestion: { ...res.result, source: res.source, forAddress: address },
      suggestionHandled: same,
    });
  }

  // Address came prefilled from the chat – offer the tidy-up straight away.
  useEffect(() => {
    if (buyer.address && !buyer.suggestion) void cleanup(buyer.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pin = buyer.pincode.trim();
  const pinValid = /^[1-9]\d{5}$/.test(pin);
  const serviceable = pinValid && !UNSERVICEABLE_PINCODES.includes(pin);
  const canContinue =
    buyer.name.trim() &&
    buyer.phone.trim().length >= 10 &&
    buyer.address.trim().length >= 10 &&
    serviceable;
  const s = buyer.suggestion;
  const showSuggestion = s && !buyer.suggestionHandled && s.forAddress === buyer.address;

  return (
    <>
      <Card className="space-y-3 bg-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">
          Delivery details
        </p>
        <Field label="Name">
          <input
            className={inputCls}
            value={buyer.name}
            onChange={(e) => actions.updateBuyer({ name: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputCls}
            inputMode="tel"
            value={buyer.phone}
            onChange={(e) => actions.updateBuyer({ phone: e.target.value })}
          />
        </Field>
        <Field label="Address">
          <textarea
            rows={3}
            className={cn(inputCls, "resize-none")}
            value={buyer.address}
            onChange={(e) =>
              actions.updateBuyer({ address: e.target.value, suggestionHandled: false })
            }
            onBlur={(e) => void cleanup(e.target.value)}
          />
        </Field>
        {cleaning && (
          <p className="flex items-center gap-2 text-xs text-navy/55">
            <Spinner className="h-3.5 w-3.5" /> Tidying the address…
          </p>
        )}
        {showSuggestion && (
          <div className="rounded-xl border border-rzp/30 bg-rzp/6 p-3">
            <p className="text-xs font-semibold text-rzp-dark">Did you mean:</p>
            <p className="mt-0.5 text-sm font-medium text-navy">{s.clean_address}</p>
            {s.missing.length > 0 && (
              <p className="mt-1 text-[11px] text-navy/55">
                Not found: {s.missing.join(", ").toLowerCase()}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <Btn
                size="sm"
                onClick={() => {
                  const pinFromClean = s.clean_address.match(/\b[1-9]\d{5}\b/)?.[0];
                  actions.updateBuyer({
                    address: s.clean_address,
                    pincode: pinFromClean ?? buyer.pincode,
                    suggestionHandled: true,
                    suggestion: { ...s, forAddress: s.clean_address },
                  });
                }}
              >
                Accept
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => actions.updateBuyer({ suggestionHandled: true })}
              >
                Keep mine
              </Btn>
            </div>
          </div>
        )}
        <Field
          label="Pincode"
          hint={
            pinValid ? (
              <p
                className={cn(
                  "mt-1 text-xs font-medium",
                  serviceable ? "text-[#027a48]" : "text-risk",
                )}
              >
                {serviceable ? "✓ Delivery available, 3–5 days" : "✕ Not serviceable"}
              </p>
            ) : null
          }
        >
          <input
            className={inputCls}
            inputMode="numeric"
            maxLength={6}
            value={buyer.pincode}
            onChange={(e) => actions.updateBuyer({ pincode: e.target.value.replace(/\D/g, "") })}
          />
        </Field>
      </Card>
      <p className="px-1 text-[11px] leading-relaxed text-navy/50">
        🔒 Your address is shared with {SELLER.name} and the courier only to deliver this order.
      </p>
      <Btn
        size="lg"
        className="w-full"
        disabled={!canContinue}
        onClick={() => {
          actions.saveBuyerDetails();
          actions.updateBuyer({ step: "payment" });
        }}
      >
        Continue to payment
      </Btn>
      <BackLink to="order" />
    </>
  );
}

function BackLink({ to }: { to: "order" | "address" | "payment" }) {
  return (
    <button
      onClick={() => actions.updateBuyer({ step: to })}
      className="w-full text-center text-xs text-navy/50"
    >
      ← Back
    </button>
  );
}

function PaymentStep({ order }: { order: Order }) {
  const settings = useStore((s) => s.settings);
  const p = buyerPrices(order.lines, order.discount, settings);

  function chooseCod() {
    actions.updateBuyer({ step: "checking" });
    setTimeout(() => runCodCheck(order.id), CHECKING_MS);
  }

  return (
    <>
      <p className="px-1 text-sm font-semibold text-navy">How would you like to pay?</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() =>
            actions.updateBuyer({
              step: "checkout",
              checkout: { amount: p.prepaidTotal, purpose: "prepaid" },
            })
          }
          className="relative flex flex-col rounded-2xl border-2 border-rzp bg-white p-3 text-left shadow-sm"
        >
          <span className="absolute -top-2.5 left-3 rounded-full bg-rzp px-2 py-0.5 text-[10px] font-semibold text-white">
            Recommended
          </span>
          <span className="mt-1 text-sm font-semibold text-navy">Pay now</span>
          <span className="text-xs text-[#027a48]">
            {p.prepaidShipping === 0 ? "Free shipping" : `Shipping ${formatINR(p.prepaidShipping)}`}
          </span>
          <span className="mt-3 text-xl font-bold text-navy">{formatINR(p.prepaidTotal)}</span>
          <span className="text-[11px] text-navy/50">UPI, card or netbanking</span>
        </button>
        <button
          onClick={chooseCod}
          className="flex flex-col rounded-2xl border-2 border-navy/12 bg-white p-3 text-left"
        >
          <span className="mt-1 text-sm font-semibold text-navy">Cash on delivery</span>
          <span className="text-xs text-navy/60">+{formatINR(p.codFee)} fee</span>
          <span className="mt-3 text-xl font-bold text-navy">{formatINR(p.codTotal)}</span>
          <span className="text-[11px] text-navy/50">
            incl. {formatINR(p.codShipping)} shipping + {formatINR(p.codFee)} fee
          </span>
        </button>
      </div>
      <BackLink to="address" />
    </>
  );
}

/** Score the order, store the result, and fetch the seller-facing verdict. */
function runCodCheck(orderId: string) {
  const s = getState();
  const order = s.orders.find((o) => o.id === orderId);
  const b = s.buyer;
  if (!order || !b) return;
  const p = buyerPrices(order.lines, order.discount, s.settings);
  const risk = scoreRisk({
    phone: b.phone,
    address: b.address,
    pincode: b.pincode,
    orderValue: p.value,
    lines: order.lines,
    strictness: s.settings.strictness,
    pastOrders: s.orders,
    excludeOrderId: order.id,
  });
  actions.updateOrder(orderId, {
    risk,
    verdict: templateVerdict(risk, formatINR),
    verdictSource: "template",
  });
  actions.updateBuyer({ step: "cod_outcome", risk });
  if (risk.action === "cod_confirmed") actions.confirmCod(orderId);
  void fetchVerdict(orderId, risk);
}

async function fetchVerdict(orderId: string, risk: RiskResult) {
  const useLive = getState().settings.useLiveAi;
  try {
    const res = await explainRiskFn({
      data: {
        tier: risk.tier,
        action: actionSentence(risk, formatINR),
        reasons: risk.reasons.map((r) => r.label),
        useLive,
      },
    });
    if (res.source === "claude" && res.text) {
      actions.updateOrder(orderId, { verdict: res.text, verdictSource: "claude" });
    }
  } catch {
    // Keep the template verdict.
  }
}

function Checking() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <Spinner className="h-8 w-8 text-rzp" />
      <p className="mt-4 text-base font-semibold text-navy">Checking order…</p>
      <p className="mt-1 text-xs text-navy/50">This takes a second</p>
    </div>
  );
}

function CodOutcome({ order }: { order: Order }) {
  const risk = useStore((s) => s.buyer?.risk);
  const settings = useStore((s) => s.settings);
  const p = buyerPrices(order.lines, order.discount, settings);
  if (!risk) return null;

  if (risk.action === "cod_confirmed") {
    return (
      <>
        <Card className="bg-white text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/12 text-2xl text-success">
            ✓
          </div>
          <p className="text-lg font-semibold text-navy">COD confirmed</p>
          <p className="mt-1 text-sm text-navy/60">
            Pay {formatINR(p.codTotal)} in cash or UPI when it arrives.
          </p>
        </Card>
        <Btn size="lg" className="w-full" onClick={() => actions.updateBuyer({ step: "done" })}>
          Track order
        </Btn>
      </>
    );
  }

  if (risk.action === "partial_upfront") {
    const x = risk.upfrontAmount ?? 0;
    const rest = p.codTotal - x;
    return (
      <>
        <Card className="bg-white">
          <p className="text-base font-semibold text-navy">Confirm your COD order</p>
          <p className="mt-1 text-sm text-navy/60">
            {SELLER.name} asks for a small part upfront on this order. The rest is paid on delivery.
          </p>
        </Card>
        <button
          onClick={() =>
            actions.updateBuyer({ step: "checkout", checkout: { amount: x, purpose: "partial" } })
          }
          className="w-full rounded-2xl border-2 border-rzp bg-white p-4 text-left"
        >
          <p className="text-base font-semibold text-navy">
            Pay {formatINR(x)} now, rest on delivery
          </p>
          <p className="mt-0.5 text-xs text-navy/60">
            {formatINR(rest)} on delivery (includes {formatINR(p.codShipping)} shipping +{" "}
            {formatINR(p.codFee)} COD fee)
          </p>
        </button>
        <button
          onClick={() =>
            actions.updateBuyer({
              step: "checkout",
              checkout: { amount: p.prepaidTotal, purpose: "prepaid_after_risk" },
            })
          }
          className="w-full rounded-2xl border-2 border-navy/12 bg-white p-4 text-left"
        >
          <p className="text-base font-semibold text-navy">
            Pay the full amount now and skip the fee
          </p>
          <p className="mt-0.5 text-xs text-navy/60">
            {formatINR(p.prepaidTotal)} total{p.prepaidShipping === 0 ? " · free shipping" : ""}
          </p>
        </button>
        <BackLink to="payment" />
      </>
    );
  }

  return (
    <>
      <Card className="bg-white">
        <p className="text-base font-semibold text-navy">
          This seller accepts prepaid only for this order
        </p>
        <p className="mt-1 text-sm text-navy/60">
          {risk.customForcedPrepaid
            ? "It's made to order, so the seller needs payment before starting."
            : "Pay online now and your order ships right away."}
        </p>
      </Card>
      <Btn
        size="lg"
        className="w-full"
        onClick={() =>
          actions.updateBuyer({
            step: "checkout",
            checkout: { amount: p.prepaidTotal, purpose: "prepaid_after_risk" },
          })
        }
      >
        Pay {formatINR(p.prepaidTotal)} now
      </Btn>
      <BackLink to="payment" />
    </>
  );
}

const UPI_APPS = [
  { name: "Google Pay", color: "#4285F4" },
  { name: "PhonePe", color: "#5f259f" },
  { name: "Paytm", color: "#00baf2" },
  { name: "BHIM", color: "#f47b20" },
];

function MockCheckout({ order }: { order: Order }) {
  const checkout = useStore((s) => s.buyer?.checkout);
  const [processing, setProcessing] = useState<string | null>(null);
  if (!checkout) return null;

  function pay(app: string) {
    setProcessing(app);
    setTimeout(() => {
      actions.completePayment(order.id, checkout!.purpose, checkout!.amount);
      actions.updateBuyer({
        step: "done",
        paymentId: "pay_" + Math.random().toString(36).slice(2, 12).toUpperCase(),
      });
    }, 1100);
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-navy/10">
      <div className="bg-navy px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{SELLER.name}</p>
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px]">Test mode</span>
        </div>
        <p className="mt-1 text-2xl font-bold">{formatINR(checkout.amount)}</p>
        <p className="text-[11px] text-white/60">
          {checkout.purpose === "partial" ? "Upfront part · rest on delivery" : "Full payment"} ·{" "}
          {order.id}
        </p>
      </div>
      {processing ? (
        <div className="flex flex-col items-center py-14">
          <Spinner className="h-8 w-8 text-rzp" />
          <p className="mt-3 text-sm font-medium text-navy">Waiting for {processing}…</p>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy/50">UPI</p>
            <div className="grid grid-cols-4 gap-2">
              {UPI_APPS.map((a) => (
                <button
                  key={a.name}
                  onClick={() => pay(a.name)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-navy/10 p-2 hover:border-rzp"
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: a.color }}
                  >
                    {a.name[0]}
                  </span>
                  <span className="text-[10px] text-navy/70">{a.name}</span>
                </button>
              ))}
            </div>
          </div>
          {["Card", "Netbanking"].map((m) => (
            <button
              key={m}
              onClick={() => toast("Use UPI in this prototype")}
              className="flex w-full items-center justify-between rounded-xl border border-navy/10 px-3 py-3 text-sm font-medium text-navy"
            >
              {m} <span className="text-navy/30">›</span>
            </button>
          ))}
          <p className="text-center text-[10px] text-navy/40">
            Simulated checkout · no money moves
          </p>
        </div>
      )}
    </div>
  );
}

function Confirmation({ order }: { order: Order }) {
  const buyer = useStore((s) => s.buyer!);
  const settings = useStore((s) => s.settings);
  const p = buyerPrices(order.lines, order.discount, settings);
  const isCod = order.paymentMode === "cod" || order.paymentMode === "partial";
  const due = isCod ? p.codTotal - order.paidAmount : 0;
  const paidOnline = order.paidAmount > 0;

  const upcoming = ["Shipped", "Delivered"].filter(
    (u) => !order.timeline.some((t) => t.label === u),
  );

  return (
    <>
      <Card className="bg-white text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/12 text-2xl text-success">
          ✓
        </div>
        <p className="text-lg font-semibold text-navy">
          {order.paymentMode === "prepaid"
            ? "Payment successful"
            : order.paymentMode === "partial"
              ? "Order confirmed"
              : "COD confirmed"}
        </p>
        <p className="mt-0.5 text-xs text-navy/55">Order ID {order.id}</p>
        {buyer.paymentId && paidOnline && (
          <p className="text-[11px] text-navy/40">Payment ID {buyer.paymentId}</p>
        )}
        <div className="mt-3 space-y-1 rounded-xl bg-surface p-3 text-sm">
          {paidOnline && (
            <div className="flex justify-between">
              <span className="text-navy/60">Paid now</span>
              <span className="font-semibold text-navy">{formatINR(order.paidAmount)}</span>
            </div>
          )}
          {isCod && (
            <div className="flex justify-between">
              <span className="text-navy/60">To pay on delivery</span>
              <span className="font-semibold text-navy">{formatINR(due)}</span>
            </div>
          )}
        </div>
      </Card>
      <Card className="bg-white">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy/50">Tracking</p>
        <Timeline events={order.timeline} upcoming={upcoming} />
      </Card>
      <Card className="bg-white">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy/50">
          Delivering to
        </p>
        <p className="text-sm text-navy">{order.buyerName}</p>
        <p className="text-sm text-navy/70">
          {order.address}
          {order.pincode && !order.address?.includes(order.pincode) ? `, ${order.pincode}` : ""}
        </p>
      </Card>
      <Btn
        variant="secondary"
        className="w-full"
        onClick={() => notInPrototype("Chat with seller")}
      >
        Message {SELLER.name}
      </Btn>
    </>
  );
}
