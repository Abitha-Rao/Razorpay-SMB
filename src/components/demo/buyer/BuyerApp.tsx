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
import { AI_TIMEOUT_MS, cleanAddressFn, explainRiskFn } from "@/lib/demo/ai.functions";
import { fallbackCleanAddress } from "@/lib/demo/fallback";
import { linkUrl } from "@/lib/demo/messages";
import { buyerPrices, dueOnDelivery, formatINR, lineTotal, subtotal } from "@/lib/demo/money";
import { checkPincode, cityFromAddress, knownCityIn } from "@/lib/demo/pincode";
import { buyerPrepaidReason, outcomePhrase } from "@/lib/demo/risk";
import { SELLER, trustBadgeCount } from "@/lib/demo/seed";
import { fullAddress, trackingUrl } from "@/lib/demo/shipping";
import { actions, getState, useStore } from "@/lib/demo/store";
import { withTimeout } from "@/lib/demo/timeout";
import type { Order, RiskOutcome } from "@/lib/demo/types";
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
        {buyer.step === "address" && <AddressStep order={order} />}
        {buyer.step === "checking" && <Checking />}
        {buyer.step === "payment" && <PaymentStep order={order} />}
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
  const orders = useStore((s) => s.orders);
  return (
    <div className="bg-white px-4 pb-4 pt-3">
      <p className="text-[11px] text-navy/45">{linkUrl(order)}</p>
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
          <span>✓</span> {trustBadgeCount(orders)} orders completed via Razorpay
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
  const sub = subtotal(order.lines);
  return (
    <>
      <Card className="bg-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">Your order</p>
        <OrderLines order={order} />
        {p.value !== sub && (
          <div className="flex justify-between border-t border-navy/8 pt-2 text-sm text-success">
            <span>Discount</span>
            <span>−{formatINR(sub - p.value)}</span>
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

function AddressStep({ order }: { order: Order }) {
  const buyer = useStore((s) => s.buyer!);
  const useLive = useStore((s) => s.settings.useLiveAi);
  const [cleaning, setCleaning] = useState(false);
  const [pinTouched, setPinTouched] = useState(false);
  const fromLastOrder = order.addressSource === "last_order" && buyer.address === order.address;

  async function cleanup(address: string) {
    if (!address.trim() || address.trim().length < 12) return;
    const current = getState().buyer;
    if (current?.suggestion?.forAddress === address) return;
    setCleaning(true);
    const res = await withTimeout(
      cleanAddressFn({ data: { address, useLive } }),
      AI_TIMEOUT_MS,
      () => ({
        source: "fallback" as const,
        result: fallbackCleanAddress(address),
      }),
    );
    setCleaning(false);
    // Ignore if the buyer kept typing meanwhile.
    if (getState().buyer?.address !== address) return;
    const same = res.result.clean_address.trim().toLowerCase() === address.trim().toLowerCase();
    actions.updateBuyer({
      suggestion: { ...res.result, source: res.source, forAddress: address },
      suggestionHandled: same,
    });
  }

  function setPincode(pincode: string) {
    const check = checkPincode(pincode);
    const current = getState().buyer;
    // A city the buyer typed by hand is never replaced; the mismatch warning flags it instead.
    const keepCity = current?.cityEdited ? { city: current.city } : null;
    if (check.status === "invalid" || check.status === "empty") {
      // An invalid pincode can't vouch for a city or state.
      actions.updateBuyer({ pincode, city: "", state: "", ...keepCity });
      return;
    }
    // Auto-fill city and state from the pincode. If the lookup has no city, use the one in the
    // (cleaned) address; the buyer can still edit it.
    const address = current?.address ?? "";
    actions.updateBuyer({
      pincode,
      city: check.city || cityFromAddress(address) || current?.city || "",
      state: check.state,
      ...keepCity,
    });
  }

  /** Pincode lookup had no city: take a known city named in the address (Keep mine / edits). */
  function fillCityFromAddress(address: string) {
    const b = getState().buyer;
    const check = checkPincode(b?.pincode ?? "");
    if (!b || b.cityEdited || check.status === "invalid" || check.status === "empty" || check.city)
      return;
    const city = knownCityIn(address);
    if (city) actions.updateBuyer({ city });
  }

  useEffect(() => {
    // Prefilled pincode (from the chat or the last order): fill city/state straight away.
    if (buyer.pincode && !buyer.city) setPincode(buyer.pincode);
    // Address came prefilled from the chat – offer the tidy-up straight away.
    // A saved address from the last order is already clean, so skip it.
    if (buyer.address && !buyer.suggestion && !fromLastOrder) void cleanup(buyer.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pin = checkPincode(buyer.pincode);
  const pinCity = pin.status === "ok" || pin.status === "unserviceable" ? pin.city : "";
  // A hand-typed city that differs from the pincode's, or a different known city in the address.
  const typedCity = buyer.cityEdited ? buyer.city.trim() : "";
  const addressCity = knownCityIn(buyer.address);
  const mismatchCity = !pinCity
    ? ""
    : typedCity && typedCity.toLowerCase() !== pinCity.toLowerCase()
      ? typedCity
      : addressCity && addressCity !== pinCity
        ? addressCity
        : "";
  const showPinError = pin.status === "invalid" && (pinTouched || buyer.pincode.length >= 6);
  const canContinue =
    buyer.name.trim() &&
    buyer.phone.replace(/[^0-9x]/gi, "").length >= 10 &&
    buyer.address.trim().length >= 10 &&
    pin.status === "ok" &&
    buyer.city.trim();
  const s = buyer.suggestion;
  const showSuggestion = s && !buyer.suggestionHandled && s.forAddress === buyer.address;

  function continueToPayment() {
    actions.saveBuyerDetails();
    // The risk check runs here, so the payment screen only shows options that will work.
    actions.updateBuyer({ step: "checking" });
    setTimeout(() => {
      actions.runRiskCheck();
      actions.updateBuyer({ step: "payment" });
    }, CHECKING_MS);
  }

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
            onChange={(e) => {
              actions.updateBuyer({ address: e.target.value, suggestionHandled: false });
              fillCityFromAddress(e.target.value);
            }}
            onBlur={(e) => void cleanup(e.target.value)}
          />
        </Field>
        {fromLastOrder && (
          <p className="-mt-1 text-xs font-medium text-rzp-dark">
            ↺ Using address from the last order
          </p>
        )}
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
                  const pinFromClean = s.clean_address.match(/\b[1-8]\d{5}\b/)?.[0];
                  actions.updateBuyer({
                    address: s.clean_address,
                    suggestionHandled: true,
                    suggestion: { ...s, forAddress: s.clean_address },
                  });
                  if (pinFromClean) setPincode(pinFromClean);
                }}
              >
                Accept
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => {
                  actions.updateBuyer({ suggestionHandled: true });
                  fillCityFromAddress(buyer.address);
                }}
              >
                Keep mine
              </Btn>
            </div>
          </div>
        )}
        <Field
          label="Pincode"
          hint={
            showPinError ? (
              <p className="mt-1 text-xs font-medium text-risk">
                {pin.status === "invalid" && pin.error}
              </p>
            ) : pin.status === "ok" ? (
              <p className="mt-1 text-xs font-medium text-[#027a48]">
                ✓ Delivery available, 3–5 days
              </p>
            ) : pin.status === "unserviceable" ? (
              <p className="mt-1 text-xs font-medium text-risk">✕ Not serviceable</p>
            ) : null
          }
        >
          <input
            className={cn(inputCls, showPinError && "border-risk")}
            inputMode="numeric"
            maxLength={6}
            value={buyer.pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
            onBlur={() => setPinTouched(true)}
          />
          {mismatchCity && (
            <p className="mt-1.5 rounded-lg bg-warning/12 px-2.5 py-1.5 text-xs font-medium text-[#b54708]">
              Address says {mismatchCity} but pincode is for {pinCity} – please check.
            </p>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="City"
            hint={
              pin.status === "ok" && !buyer.city.trim() ? (
                <p className="mt-1 text-xs font-medium text-risk">Enter your city</p>
              ) : null
            }
          >
            <input
              className={inputCls}
              value={buyer.city}
              placeholder="City"
              onChange={(e) =>
                actions.updateBuyer({
                  city: e.target.value,
                  cityEdited: e.target.value.trim() !== "",
                })
              }
            />
          </Field>
          <Field label="State">
            <input
              className={cn(inputCls, "bg-surface")}
              value={buyer.state}
              placeholder="From pincode"
              readOnly
            />
          </Field>
        </div>
      </Card>
      <p className="px-1 text-[11px] leading-relaxed text-navy/50">
        🔒 Your address is shared with {SELLER.name} and the courier only to deliver this order.
      </p>
      <Btn size="lg" className="w-full" disabled={!canContinue} onClick={continueToPayment}>
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

function Checking() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <Spinner className="h-8 w-8 text-rzp" />
      <p className="mt-4 text-base font-semibold text-navy">Checking order…</p>
      <p className="mt-1 text-xs text-navy/50">This takes a second</p>
    </div>
  );
}

/** Only the options the risk check allows – COD is never shown and then refused. */
function PaymentStep({ order }: { order: Order }) {
  const settings = useStore((s) => s.settings);
  const risk = useStore((s) => s.buyer?.risk);
  const p = buyerPrices(order.lines, order.discount, settings);
  if (!risk) return null;

  const payNow = (
    <button
      onClick={() =>
        actions.updateBuyer({
          step: "checkout",
          checkout: { amount: p.prepaidTotal, purpose: "prepaid" },
        })
      }
      className="relative flex flex-col rounded-2xl border-2 border-rzp bg-white p-3 text-left shadow-sm"
    >
      {risk.action !== "prepaid_only" && (
        <span className="absolute -top-2.5 left-3 rounded-full bg-rzp px-2 py-0.5 text-[10px] font-semibold text-white">
          Recommended
        </span>
      )}
      <span className="mt-1 text-sm font-semibold text-navy">Pay now</span>
      <span className="text-xs text-[#027a48]">
        {p.prepaidShipping === 0 ? "Free shipping" : `Shipping ${formatINR(p.prepaidShipping)}`}
      </span>
      <span className="mt-3 text-xl font-bold text-navy">{formatINR(p.prepaidTotal)}</span>
      <span className="text-[11px] text-navy/50">UPI, card or netbanking</span>
    </button>
  );

  return (
    <>
      <p className="px-1 text-sm font-semibold text-navy">How would you like to pay?</p>

      {risk.action === "prepaid_only" ? (
        <>
          {payNow}
          <p className="px-1 text-xs text-navy/60">{buyerPrepaidReason(risk)}</p>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {payNow}
          {risk.action === "cod_allowed" ? (
            <button
              onClick={() => {
                actions.confirmCod(order.id);
                actions.updateBuyer({ step: "done" });
                void fetchVerdict(order.id, "cod");
              }}
              className="flex flex-col rounded-2xl border-2 border-navy/12 bg-white p-3 text-left"
            >
              <span className="mt-1 text-sm font-semibold text-navy">Cash on delivery</span>
              <span className="text-xs text-navy/60">+{formatINR(p.codFee)} fee</span>
              <span className="mt-3 text-xl font-bold text-navy">{formatINR(p.codTotal)}</span>
              <span className="text-[11px] text-navy/50">
                incl. {formatINR(p.codShipping)} shipping + {formatINR(p.codFee)} fee
              </span>
            </button>
          ) : (
            <button
              onClick={() =>
                actions.updateBuyer({
                  step: "checkout",
                  checkout: { amount: risk.upfrontAmount ?? 0, purpose: "partial" },
                })
              }
              className="flex flex-col rounded-2xl border-2 border-navy/12 bg-white p-3 text-left"
            >
              <span className="mt-1 text-sm font-semibold text-navy">
                Pay {formatINR(risk.upfrontAmount ?? 0)} now, rest on delivery
              </span>
              <span className="mt-3 text-xl font-bold text-navy">
                {formatINR(risk.upfrontAmount ?? 0)}
              </span>
              <span className="text-[11px] text-navy/50">
                + {formatINR(p.codTotal - (risk.upfrontAmount ?? 0))} on delivery (incl.{" "}
                {formatINR(p.codShipping)} shipping + {formatINR(p.codFee)} COD fee)
              </span>
            </button>
          )}
        </div>
      )}
      {risk.action === "partial_upfront" && (
        <p className="px-1 text-xs text-navy/60">
          {risk.reasons.some((r) => r.code === "new_phone")
            ? "First order from this number – pay a small part now to confirm COD."
            : "Pay a small part now to confirm COD."}
        </p>
      )}
      <BackLink to="address" />
    </>
  );
}

/** Ask Claude to phrase the seller-facing verdict; the template stays if it's off or slow. */
async function fetchVerdict(orderId: string, outcome: RiskOutcome) {
  const s = getState();
  const risk = s.orders.find((o) => o.id === orderId)?.risk;
  if (!risk) return;
  const res = await withTimeout(
    explainRiskFn({
      data: {
        tier: risk.tier,
        action: outcomePhrase(risk, outcome, formatINR).replace(/^so /, ""),
        reasons: risk.reasons.map((r) => r.label),
        useLive: s.settings.useLiveAi,
      },
    }),
    AI_TIMEOUT_MS,
    () => ({ source: "fallback" as const, text: null }),
  );
  if (res.source === "claude" && res.text) {
    actions.updateOrder(orderId, { verdict: res.text, verdictSource: "claude" });
  }
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
      void fetchVerdict(order.id, checkout!.purpose === "partial" ? "partial" : "prepaid");
    }, 1100);
  }

  return (
    <>
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
      {!processing && <BackLink to="payment" />}
    </>
  );
}

function Confirmation({ order }: { order: Order }) {
  const buyer = useStore((s) => s.buyer!);
  const isCod = order.paymentMode === "cod" || order.paymentMode === "partial";
  const due = dueOnDelivery(order);
  const paidOnline = order.paymentMode === "prepaid" || order.paymentMode === "partial";
  const shipped = !!order.shippedAt;
  const finished = order.status === "delivered" || order.status === "refused";
  const upcoming = finished ? [] : shipped ? ["Delivered"] : ["Shipped", "Delivered"];
  const track = trackingUrl(order);

  return (
    <>
      <Card className="bg-white text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/12 text-2xl text-success">
          ✓
        </div>
        <p className="text-lg font-semibold text-navy">
          {order.status === "delivered"
            ? "Delivered"
            : order.paymentMode === "prepaid"
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
          {order.status === "delivered" ? (
            <div className="flex justify-between">
              <span className="text-navy/60">Paid</span>
              <span className="font-semibold text-navy">{formatINR(order.paidAmount)}</span>
            </div>
          ) : (
            paidOnline && (
              <div className="flex justify-between">
                <span className="text-navy/60">Paid online</span>
                <span className="font-semibold text-navy">{formatINR(order.paidAmount)}</span>
              </div>
            )
          )}
          {isCod && due > 0 && (
            <div className="flex justify-between">
              <span className="text-navy/60">To pay on delivery</span>
              <span className="font-semibold text-navy">{formatINR(due)}</span>
            </div>
          )}
        </div>
      </Card>
      <Card className="bg-white">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">Tracking</p>
          {track && (
            <a
              href={track}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-rzp"
            >
              Track on {order.courier} ↗
            </a>
          )}
        </div>
        <Timeline events={order.timeline} upcoming={upcoming} />
      </Card>
      <Card className="bg-white">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy/50">
          Delivering to
        </p>
        <p className="text-sm text-navy">{order.buyerName}</p>
        <p className="text-sm text-navy/70">{fullAddress(order)}</p>
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
