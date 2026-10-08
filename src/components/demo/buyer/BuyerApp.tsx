import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { TrackRecordBadge } from "@/components/demo/TrackRecordParts";
import {
  Btn,
  Card,
  Field,
  Spinner,
  Timeline,
  inputCls,
  notInPrototype,
} from "@/components/demo/ui";
import { fullAddress } from "@/lib/demo/address";
import { COD_NOTE, prepaidOnlyReason } from "@/lib/demo/cod";
import { linkUrl } from "@/lib/demo/messages";
import { buyerPrices, dueOnDelivery, formatINR, lineTotal, subtotal } from "@/lib/demo/money";
import { checkPincode, cityFromAddress, knownCityIn } from "@/lib/demo/pincode";
import { SELLER } from "@/lib/demo/seed";
import { actions, codCheckFor, getState, lastAddressFor, useStore } from "@/lib/demo/store";
import type { Order } from "@/lib/demo/types";
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
      <h2 className="text-lg font-semibold text-navy">No payment link yet</h2>
      <p className="mt-1 text-sm text-navy/60">
        In the seller app, tap <b>New order</b>, draft from a chat and create a payment link. It
        opens here.
      </p>
      <Btn className="mt-5" onClick={() => actions.setView("seller")}>
        Go to seller app
      </Btn>
    </div>
  );
}

function BuyerHeader({ order }: { order: Order }) {
  const showRecord = useStore((s) => s.settings.showTrackRecord);
  return (
    <div className="bg-white px-4 pb-4 pt-3">
      <p className="text-[11px] text-navy/45">Chat Checkout · {linkUrl(order)}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-base font-bold text-white">
          MH
        </div>
        <div>
          <p className="text-base font-semibold text-navy">{SELLER.name}</p>
          <p className="text-xs text-navy/55">{SELLER.city}</p>
        </div>
      </div>
      {showRecord && <TrackRecordBadge />}
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

/**
 * Address step. Checks are simple rules only: every field filled, a valid pincode, and a pincode
 * that matches the city. A mismatch is a gentle flag; it never blocks the buyer.
 */
function AddressStep({ order }: { order: Order }) {
  const buyer = useStore((s) => s.buyer!);
  const [pinTouched, setPinTouched] = useState(false);
  const usingSaved =
    (!!buyer.savedAddress && buyer.savedAddress === buyer.address) ||
    (order.addressSource === "last_order" && order.address === buyer.address);

  function setPincode(pincode: string) {
    const check = checkPincode(pincode);
    const current = getState().buyer;
    // A city the buyer typed by hand is never replaced; the mismatch flag shows instead.
    const keepCity = current?.cityEdited ? { city: current.city } : null;
    if (check.status === "invalid" || check.status === "empty") {
      // An invalid pincode can't vouch for a city or state.
      actions.updateBuyer({ pincode, city: "", state: "", ...keepCity });
      return;
    }
    // Fill city and state from the pincode. If the lookup has no city, use the one named in the address.
    actions.updateBuyer({
      pincode,
      city: check.city || cityFromAddress(current?.address ?? "") || current?.city || "",
      state: check.state,
      ...keepCity,
    });
  }

  /** Pincode lookup had no city: take a known city named in the address text. */
  function fillCityFromAddress(address: string) {
    const b = getState().buyer;
    const check = checkPincode(b?.pincode ?? "");
    if (!b || b.cityEdited || check.status === "invalid" || check.status === "empty" || check.city)
      return;
    const city = knownCityIn(address);
    if (city) actions.updateBuyer({ city });
  }

  /** A phone number used before brings back its saved address, unless the buyer typed their own. */
  function prefillFromPhone(phone: string) {
    const s = getState();
    const b = s.buyer;
    if (!b || b.addressEdited) return;
    const last = lastAddressFor(
      phone,
      s.orders.filter((o) => o.id !== b.orderId),
    );
    if (!last?.address) return;
    if (b.address === last.address) {
      if (!b.savedAddress) actions.updateBuyer({ savedAddress: last.address });
      return;
    }
    const replaceable = !b.address.trim() || b.savedAddress === b.address;
    if (!replaceable) return;
    actions.updateBuyer({ address: last.address, savedAddress: last.address, cityEdited: false });
    setPincode(last.pincode ?? "");
  }

  useEffect(() => {
    prefillFromPhone(buyer.phone);
    // Prefilled pincode (from the chat or the last order): fill city/state straight away.
    if (getState().buyer?.pincode && !getState().buyer?.city) setPincode(getState().buyer!.pincode);
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

  const missing = [
    !buyer.name.trim() && "name",
    buyer.phone.replace(/[^0-9x]/gi, "").length < 10 && "phone",
    buyer.address.trim().length < 10 && "address",
    pin.status !== "ok" && "a valid, serviceable pincode",
    !buyer.city.trim() && "city",
  ].filter(Boolean) as string[];

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
            onChange={(e) => {
              actions.updateBuyer({ phone: e.target.value });
              prefillFromPhone(e.target.value);
            }}
          />
        </Field>
        <Field label="Address">
          <textarea
            rows={3}
            className={cn(inputCls, "resize-none")}
            value={buyer.address}
            onChange={(e) => {
              actions.updateBuyer({
                address: e.target.value,
                addressEdited: true,
                savedAddress: undefined,
              });
              fillCityFromAddress(e.target.value);
            }}
          />
        </Field>
        {usingSaved && (
          <p className="-mt-1 text-xs font-medium text-rzp-dark">
            ↺ Using your saved address from the last order
          </p>
        )}
        <Field
          label="Pincode"
          hint={
            showPinError ? (
              <p className="mt-1 text-xs font-medium text-danger">
                {pin.status === "invalid" && pin.error}
              </p>
            ) : pin.status === "ok" ? (
              <p className="mt-1 text-xs font-medium text-[#027a48]">
                ✓ Delivery available, 3–5 days
              </p>
            ) : pin.status === "unserviceable" ? (
              <p className="mt-1 text-xs font-medium text-danger">✕ Not serviceable</p>
            ) : null
          }
        >
          <input
            className={cn(inputCls, showPinError && "border-danger")}
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
                <p className="mt-1 text-xs font-medium text-danger">Enter your city</p>
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
      <Btn
        size="lg"
        className="w-full"
        disabled={missing.length > 0}
        onClick={() => {
          actions.saveBuyerDetails();
          actions.updateBuyer({ step: "payment" });
        }}
      >
        Continue to payment
      </Btn>
      {missing.length > 0 && (
        <p className="-mt-2 text-center text-[11px] text-navy/45">
          Still needed: {missing.join(", ")}
        </p>
      )}
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
      <p className="mt-4 text-base font-semibold text-navy">Checking COD for this order…</p>
      <p className="mt-1 text-xs text-navy/50">This takes a second</p>
    </div>
  );
}

/** The prepaid offer and the COD fee, side by side. COD is checked once the buyer picks it. */
function PaymentStep({ order }: { order: Order }) {
  const settings = useStore((s) => s.settings);
  const orders = useStore((s) => s.orders);
  const trusted = useStore((s) => s.trusted);
  const blocked = useStore((s) => s.blocked);
  const p = buyerPrices(order.lines, order.discount, settings);
  const check = codCheckFor({ orders, trusted, blocked }, order);
  // The seller offered online payment only, so COD isn't shown at all.
  const codHidden = check.reason === "seller";

  function pickCod() {
    actions.updateBuyer({ step: "checking" });
    setTimeout(() => actions.updateBuyer({ step: "cod_outcome" }), CHECKING_MS);
  }

  return (
    <>
      <p className="px-1 text-sm font-semibold text-navy">How would you like to pay?</p>
      <div className={cn("grid gap-3", codHidden ? "grid-cols-1" : "grid-cols-2")}>
        <button
          onClick={() =>
            actions.updateBuyer({
              step: "checkout",
              checkout: { amount: p.prepaidTotal, purpose: "prepaid" },
            })
          }
          className="relative flex flex-col rounded-2xl border-2 border-rzp bg-white p-3 text-left shadow-sm"
        >
          {!codHidden && (
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
        {!codHidden && (
          <button
            onClick={pickCod}
            className="flex flex-col rounded-2xl border-2 border-navy/12 bg-white p-3 text-left"
          >
            <span className="mt-1 text-sm font-semibold text-navy">Cash on delivery</span>
            <span className="text-xs text-navy/60">+{formatINR(p.codFee)} fee</span>
            <span className="mt-3 text-xl font-bold text-navy">{formatINR(p.codTotal)}</span>
            <span className="text-[11px] text-navy/50">
              incl. {formatINR(p.codShipping)} shipping + {formatINR(p.codFee)} fee
            </span>
          </button>
        )}
      </div>
      {codHidden && (
        <p className="px-1 text-xs text-navy/60">
          {prepaidOnlyReason(
            check,
            order.lines.some((l) => l.type === "custom"),
          )}
        </p>
      )}
      <BackLink to="address" />
    </>
  );
}

/** What the COD rules decided: COD allowed, a part-payment to confirm COD, or prepaid only. */
function CodOutcome({ order }: { order: Order }) {
  const settings = useStore((s) => s.settings);
  const orders = useStore((s) => s.orders);
  const trusted = useStore((s) => s.trusted);
  const blocked = useStore((s) => s.blocked);
  const p = buyerPrices(order.lines, order.discount, settings);
  const check = codCheckFor({ orders, trusted, blocked }, order);

  const payInFull = () =>
    actions.updateBuyer({
      step: "checkout",
      checkout: { amount: p.prepaidTotal, purpose: "prepaid" },
    });
  const confirmCod = () => {
    actions.confirmCod(order.id);
    actions.updateBuyer({ step: "done" });
  };

  let body;
  if (check.action === "allowed") {
    body = (
      <>
        <Card className="bg-white text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/12 text-2xl text-success">
            ✓
          </div>
          <p className="text-lg font-semibold text-navy">COD allowed</p>
          <p className="mt-1 text-sm text-navy/60">
            Pay {formatINR(p.codTotal)} in cash or UPI when it arrives.
          </p>
        </Card>
        {check.prepayNudge ? (
          <>
            <Btn size="lg" className="w-full" onClick={payInFull}>
              Pay {formatINR(p.prepaidTotal)} now – skip the {formatINR(p.codFee)} COD fee
            </Btn>
            <Btn variant="secondary" size="lg" className="w-full" onClick={confirmCod}>
              Confirm COD
            </Btn>
          </>
        ) : (
          <Btn size="lg" className="w-full" onClick={confirmCod}>
            Confirm COD
          </Btn>
        )}
      </>
    );
  } else if (check.action === "part_payment") {
    const x = check.upfrontAmount ?? 0;
    body = (
      <>
        <Card className="bg-white">
          <p className="text-base font-semibold text-navy">A small part now confirms COD</p>
          <p className="mt-1 text-sm text-navy/60">
            {SELLER.name} asks for an advance on this order. The rest is paid on delivery.
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
            {formatINR(p.codTotal - x)} on delivery (includes {formatINR(p.codShipping)} shipping +{" "}
            {formatINR(p.codFee)} COD fee)
          </p>
        </button>
        <button
          onClick={payInFull}
          className="w-full rounded-2xl border-2 border-navy/12 bg-white p-4 text-left"
        >
          <p className="text-base font-semibold text-navy">Pay the full amount now</p>
          <p className="mt-0.5 text-xs text-navy/60">
            {formatINR(p.prepaidTotal)} total{p.prepaidShipping === 0 ? " · free shipping" : ""}, no
            COD fee
          </p>
        </button>
      </>
    );
  } else {
    body = (
      <>
        <Card className="bg-white">
          <p className="text-base font-semibold text-navy">Pay now to place this order</p>
          <p className="mt-1 text-sm text-navy/60">
            {prepaidOnlyReason(
              check,
              order.lines.some((l) => l.type === "custom"),
            )}
          </p>
        </Card>
        <Btn size="lg" className="w-full" onClick={payInFull}>
          Pay {formatINR(p.prepaidTotal)} now
        </Btn>
      </>
    );
  }

  return (
    <>
      {body}
      <BackLink to="payment" />
      <p className="px-1 text-center text-[10px] text-navy/35">{COD_NOTE}</p>
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
    <>
      <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-navy/10">
        <div className="bg-navy px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{SELLER.name}</p>
            <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px]">Test mode</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{formatINR(checkout.amount)}</p>
          <p className="text-[11px] text-white/60">
            {checkout.purpose === "partial" ? "Advance · rest on delivery" : "Full payment"} ·{" "}
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
  const finished = order.status === "delivered" || order.status === "returned";

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
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy/50">
          Order status
        </p>
        <Timeline events={order.timeline} upcoming={finished ? [] : ["Delivered"]} />
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
