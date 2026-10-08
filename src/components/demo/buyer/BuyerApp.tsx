import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { TrackRecordBadge } from "@/components/demo/TrackRecordParts";
import { Btn, Timeline, inputCls } from "@/components/demo/ui";
import { fullAddress } from "@/lib/demo/address";
import { ONLINE_METHODS, UPI_APPS, checkoutSummary, lastUsedPayment } from "@/lib/demo/checkout";
import { prepaidOnlyReason } from "@/lib/demo/cod";
import { linkUrl } from "@/lib/demo/messages";
import { discountAmount, dueOnDelivery, formatINR, lineTotal } from "@/lib/demo/money";
import { checkPincode, cityFromAddress, knownCityIn } from "@/lib/demo/pincode";
import { SELLER } from "@/lib/demo/seed";
import {
  actions,
  codCheckFor,
  savedAddressesFor,
  useStore,
  type SelectedAddress,
} from "@/lib/demo/store";
import type { AddressLabel, Order, PayMethod } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

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
    <div className="flex min-h-full flex-col bg-surface">
      <BuyerHeader order={order} />
      {buyer.step === "mobile" && <MobileStep />}
      {buyer.step === "otp" && <OtpStep />}
      {buyer.step === "address" && (
        <AddressForm
          initial={{
            name: order.buyerName === "Buyer" ? "" : order.buyerName,
            address: order.address ?? "",
            pincode: order.pincode ?? "",
          }}
          showSave
          onSubmit={(v) => actions.submitAddress(v)}
        />
      )}
      {buyer.step === "main" && <CheckoutStep order={order} />}
      {buyer.step === "paying" && <Paying />}
      {buyer.step === "done" && <Confirmation order={order} />}
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
    <div className="border-b border-navy/8 bg-white px-4 pb-3 pt-3">
      <p className="text-[11px] text-navy/45">Chat Checkout · {linkUrl(order)}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
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

/** A step's content, with its one primary button pinned to the bottom. */
function StepLayout({ children, bar }: { children: ReactNode; bar?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-3 px-4 pb-4 pt-3">{children}</div>
      {bar && (
        <div className="sticky bottom-0 z-10 border-t border-navy/8 bg-white px-4 py-3">{bar}</div>
      )}
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-navy/8 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

// ---------- a) mobile number, b) OTP ----------

function MobileStep() {
  const buyer = useStore((s) => s.buyer!);
  const valid = /^[6-9]\d{9}$/.test(buyer.phone);
  return (
    <StepLayout
      bar={
        <Btn
          size="lg"
          className="w-full"
          disabled={!valid}
          onClick={() => actions.updateBuyer({ step: "otp", otp: "" })}
        >
          Continue
        </Btn>
      }
    >
      <Section title="Mobile number">
        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-navy/15 bg-surface px-3 py-2.5 text-sm text-navy/70">
            +91
          </span>
          <input
            className={inputCls}
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={buyer.phone}
            onChange={(e) => actions.updateBuyer({ phone: e.target.value.replace(/\D/g, "") })}
          />
        </div>
        {buyer.phone.length === 10 && !valid && (
          <p className="mt-1.5 text-xs font-medium text-danger">Enter a valid mobile number</p>
        )}
      </Section>
    </StepLayout>
  );
}

function OtpStep() {
  const buyer = useStore((s) => s.buyer!);
  const valid = /^\d{6}$/.test(buyer.otp);
  return (
    <StepLayout
      bar={
        <Btn size="lg" className="w-full" disabled={!valid} onClick={() => actions.verifyOtp()}>
          Continue
        </Btn>
      }
    >
      <Section title="Enter OTP">
        <p className="mb-2 text-xs text-navy/60">
          Enter the 6-digit OTP sent to +91 {buyer.phone}.
        </p>
        <input
          className={cn(inputCls, "text-center text-lg tracking-[0.5em]")}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          value={buyer.otp}
          onChange={(e) => actions.updateBuyer({ otp: e.target.value.replace(/\D/g, "") })}
        />
        <button
          className="mt-3 text-xs font-medium text-rzp"
          onClick={() => actions.updateBuyer({ step: "mobile", otp: "" })}
        >
          Change number
        </button>
      </Section>
    </StepLayout>
  );
}

// ---------- address form (new number, or "Add new address") ----------

type AddressValues = Omit<SelectedAddress, "id" | "label"> & { label?: AddressLabel | undefined };

const LABELS: AddressLabel[] = ["Home", "Work", "Other"];

/**
 * Four address fields (address, pincode, city, state) plus the name. Checks are simple rules:
 * every field filled, a valid pincode, and a pincode that matches the city. A mismatch is a gentle
 * amber flag; it never blocks the buyer.
 */
function AddressForm({
  initial,
  showSave,
  onSubmit,
  onBack,
}: {
  initial: Partial<AddressValues>;
  showSave: boolean;
  onSubmit: (v: AddressValues) => void;
  onBack?: () => void;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [pincode, setPincode] = useState(initial.pincode ?? "");
  const [city, setCity] = useState(() => {
    const p = checkPincode(initial.pincode ?? "");
    const fromPin = p.status === "ok" || p.status === "unserviceable" ? p.city : "";
    return initial.city || fromPin || cityFromAddress(initial.address ?? "");
  });
  const [cityEdited, setCityEdited] = useState(false);
  const [pinTouched, setPinTouched] = useState(false);
  const [label, setLabel] = useState<AddressLabel | undefined>(showSave ? "Home" : undefined);

  const pin = checkPincode(pincode);
  const pinCity = pin.status === "ok" || pin.status === "unserviceable" ? pin.city : "";
  const state = pin.status === "ok" || pin.status === "unserviceable" ? pin.state : "";

  function changePincode(p: string) {
    setPincode(p);
    const c = checkPincode(p);
    if (cityEdited) return; // a city typed by hand is never replaced
    if (c.status === "invalid" || c.status === "empty") setCity("");
    else setCity(c.city || cityFromAddress(address) || city);
  }

  function changeAddress(v: string) {
    setAddress(v);
    if (!cityEdited && pin.status === "ok" && !pin.city) {
      const known = knownCityIn(v);
      if (known) setCity(known);
    }
  }

  // A hand-typed city that differs from the pincode's, or a different known city in the address.
  const typedCity = cityEdited ? city.trim() : "";
  const addressCity = knownCityIn(address);
  const mismatchCity = !pinCity
    ? ""
    : typedCity && typedCity.toLowerCase() !== pinCity.toLowerCase()
      ? typedCity
      : addressCity && addressCity !== pinCity
        ? addressCity
        : "";
  const showPinError = pin.status === "invalid" && (pinTouched || pincode.length >= 6);

  const missing = [
    !name.trim() && "name",
    address.trim().length < 10 && "address",
    pin.status !== "ok" && "a valid, serviceable pincode",
    !city.trim() && "city",
  ].filter(Boolean) as string[];

  return (
    <StepLayout
      bar={
        <>
          <Btn
            size="lg"
            className="w-full"
            disabled={missing.length > 0}
            onClick={() => onSubmit({ name, address, pincode, city, state, label })}
          >
            Continue
          </Btn>
          {missing.length > 0 && (
            <p className="mt-1.5 text-center text-[11px] text-navy/45">
              Still needed: {missing.join(", ")}
            </p>
          )}
        </>
      }
    >
      {onBack && (
        <button className="text-xs font-medium text-rzp" onClick={onBack}>
          ← Back
        </button>
      )}
      <Section title="Delivery address">
        <div className="space-y-3">
          <FormField label="Name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Address">
            <textarea
              rows={3}
              className={cn(inputCls, "resize-none")}
              value={address}
              onChange={(e) => changeAddress(e.target.value)}
            />
          </FormField>
          <FormField
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
              value={pincode}
              onChange={(e) => changePincode(e.target.value.replace(/\D/g, ""))}
              onBlur={() => setPinTouched(true)}
            />
            {mismatchCity && (
              <p className="mt-1.5 rounded-lg bg-warning/12 px-2.5 py-1.5 text-xs font-medium text-[#b54708]">
                Address says {mismatchCity} but pincode is for {pinCity} – please check.
              </p>
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="City"
              hint={
                pin.status === "ok" && !city.trim() ? (
                  <p className="mt-1 text-xs font-medium text-danger">Enter your city</p>
                ) : null
              }
            >
              <input
                className={inputCls}
                value={city}
                placeholder="City"
                onChange={(e) => {
                  setCity(e.target.value);
                  setCityEdited(e.target.value.trim() !== "");
                }}
              />
            </FormField>
            <FormField label="State">
              <input
                className={cn(inputCls, "bg-surface")}
                value={state}
                placeholder="From pincode"
                readOnly
              />
            </FormField>
          </div>
        </div>
      </Section>
      {showSave && (
        <Section title="Save my address as">
          <div className="flex gap-2">
            {LABELS.map((l) => (
              <button
                key={l}
                onClick={() => setLabel(label === l ? undefined : l)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium",
                  label === l
                    ? "border-rzp bg-rzp/10 text-rzp-dark"
                    : "border-navy/15 text-navy/70",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </Section>
      )}
      <p className="px-1 text-[11px] leading-relaxed text-navy/50">
        🔒 Your address is shared with {SELLER.name} and the courier only to deliver this order.
      </p>
    </StepLayout>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-navy/65">{label}</span>
      {children}
      {hint}
    </label>
  );
}

// ---------- c)–g) checkout ----------

function CheckoutStep({ order }: { order: Order }) {
  const buyer = useStore((s) => s.buyer!);
  const settings = useStore((s) => s.settings);
  const orders = useStore((s) => s.orders);
  const trusted = useStore((s) => s.trusted);
  const blocked = useStore((s) => s.blocked);
  const addressBook = useStore((s) => s.addressBook);
  const [view, setView] = useState<"main" | "pick" | "add">("main");
  const [summaryOpen, setSummaryOpen] = useState(true);

  const check = codCheckFor({ orders, trusted, blocked }, order);
  // COD is listed unless the seller offered online payment only; it can still be disabled.
  const codListed = check.reason !== "seller";
  const codUsable = codListed && check.action !== "prepaid_only";

  // Returning buyers get their last-used payment method preselected.
  const last = buyer.returning ? lastUsedPayment(buyer.phone, orders, order.id) : null;
  const [chosen, setChosen] = useState<PayMethod>(() =>
    last && (last.method !== "cod" || codUsable) ? last.method : "upi",
  );
  const [app, setApp] = useState(last?.app ?? UPI_APPS[0]!);
  const method: PayMethod = chosen === "cod" && !codUsable ? "upi" : chosen;

  const summary = checkoutSummary(order, settings, method, check);
  const codSummary = checkoutSummary(order, settings, "cod", check);
  const discount = discountAmount(order.lines, order.discount);

  if (view === "pick")
    return (
      <AddressPicker
        phone={buyer.phone}
        selectedId={buyer.address?.id}
        addresses={savedAddressesFor(buyer.phone, addressBook)}
        onUse={(id) => {
          actions.useSavedAddress(id);
          setView("main");
        }}
        onAdd={() => setView("add")}
        onBack={() => setView("main")}
      />
    );
  if (view === "add")
    return (
      <AddressForm
        initial={{}}
        showSave
        onBack={() => setView("pick")}
        onSubmit={(v) => {
          actions.submitAddress(v);
          setView("main");
        }}
      />
    );

  const label =
    method === "cod"
      ? check.action === "part_payment"
        ? `Pay ${formatINR(summary.payNow)}`
        : "Place order"
      : `Pay ${formatINR(summary.total)}`;

  function pay() {
    if (method === "cod" && check.action === "allowed") {
      actions.confirmCod(order.id);
      actions.updateBuyer({ step: "done" });
      return;
    }
    // Online payment, or the part-payment that confirms COD.
    const purpose = method === "cod" ? "partial" : "prepaid";
    const amount = method === "cod" ? summary.payNow : summary.total;
    actions.updateBuyer({ step: "paying", paying: { purpose, amount, method, app } });
    setTimeout(() => {
      actions.completePayment(
        order.id,
        purpose,
        amount,
        method,
        method === "cod" || method === "upi" ? app : undefined,
      );
      actions.updateBuyer({
        step: "done",
        paymentId: "pay_" + Math.random().toString(36).slice(2, 12).toUpperCase(),
      });
    }, 1100);
  }

  const showNudge = codListed && check.action === "allowed" && check.prepayNudge;

  return (
    <StepLayout
      bar={
        <Btn size="lg" className="w-full" onClick={pay}>
          {label}
        </Btn>
      }
    >
      <section className="rounded-2xl border border-navy/8 bg-white">
        <button
          className="flex w-full items-center justify-between gap-2 p-4 text-left"
          onClick={() => setSummaryOpen((o) => !o)}
          aria-expanded={summaryOpen}
        >
          <span className="text-sm font-semibold text-navy">Order Summary</span>
          <span className="flex items-center gap-2 text-sm text-navy/70">
            {!summaryOpen && (
              <span className="font-semibold text-navy">{formatINR(summary.total)}</span>
            )}
            <span className={cn("transition-transform", summaryOpen && "rotate-180")}>⌄</span>
          </span>
        </button>
        {summaryOpen && (
          <ul className="divide-y divide-navy/8 border-t border-navy/8 px-4">
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
        )}
      </section>

      <Section title="Coupons and offers">
        {order.discount && discount > 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-success/8 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-navy">Seller discount applied</p>
              <p className="text-xs text-navy/55">
                {order.discount.type === "percent"
                  ? `${order.discount.value}% off`
                  : `${formatINR(order.discount.value)} off`}
              </p>
            </div>
            <p className="text-sm font-semibold text-[#027a48]">−{formatINR(discount)}</p>
          </div>
        ) : (
          <p className="text-sm text-navy/55">No offers on this order.</p>
        )}
      </Section>

      <Section
        title="Delivery address"
        right={
          <button className="text-xs font-semibold text-rzp" onClick={() => setView("pick")}>
            Add/Change
          </button>
        }
      >
        {buyer.address ? (
          <div>
            <p className="text-sm font-medium text-navy">
              {buyer.address.label && (
                <span className="mr-2 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-navy/70">
                  {buyer.address.label}
                </span>
              )}
              {buyer.address.name}
            </p>
            <p className="mt-1 text-sm text-navy/70">{fullAddress(buyer.address)}</p>
            <p className="mt-0.5 text-xs text-navy/50">+91 {buyer.phone}</p>
          </div>
        ) : (
          <p className="text-sm text-navy/55">No address selected.</p>
        )}
      </Section>

      <Section title="Payment Options">
        {showNudge && (
          <p className="mb-3 rounded-xl bg-rzp/8 px-3 py-2.5 text-xs leading-relaxed text-navy/75">
            Pay online instead and skip the {formatINR(settings.codFee)} COD Fee
            {settings.prepaidOffer === "free_shipping" ? ", plus get free shipping" : ""}.
          </p>
        )}
        <div className="space-y-2">
          {ONLINE_METHODS.map((m) => (
            <div key={m.key}>
              <MethodRow
                selected={method === m.key}
                title={m.label}
                onClick={() => setChosen(m.key)}
              />
              {m.key === "upi" && method === "upi" && (
                <div className="mt-2 flex flex-wrap gap-2 pl-8">
                  {UPI_APPS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setApp(a)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        app === a
                          ? "border-rzp bg-rzp/10 text-rzp-dark"
                          : "border-navy/15 text-navy/65",
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {codListed &&
            (check.action === "part_payment" ? (
              <MethodRow
                selected={method === "cod"}
                title="Pay a part now, rest on delivery"
                sub={`${formatINR(codSummary.payNow)} now · ${formatINR(codSummary.onDelivery)} on delivery`}
                onClick={() => setChosen("cod")}
              />
            ) : check.action === "prepaid_only" ? (
              <MethodRow
                disabled
                selected={false}
                title="Cash on Delivery (COD)"
                sub="COD isn't available for this order"
              />
            ) : (
              <MethodRow
                selected={method === "cod"}
                title="Cash on Delivery (COD)"
                onClick={() => setChosen("cod")}
              />
            ))}
        </div>
        {!codListed && (
          <p className="mt-3 text-xs text-navy/55">
            {prepaidOnlyReason(
              check,
              order.lines.some((l) => l.type === "custom"),
            )}
          </p>
        )}
      </Section>

      <Section title="Price summary">
        <dl className="space-y-1.5 text-sm">
          <SummaryRow label="Subtotal" value={formatINR(summary.subtotal)} />
          {summary.discount > 0 && (
            <SummaryRow label="Discount" value={`−${formatINR(summary.discount)}`} />
          )}
          <SummaryRow
            label="Shipping"
            value={summary.shipping ? formatINR(summary.shipping) : "Free"}
          />
          {method === "cod" && <SummaryRow label="COD Fee" value={formatINR(summary.codFee)} />}
          <div className="flex items-baseline justify-between border-t border-navy/10 pt-2">
            <dt className="font-semibold text-navy">Total</dt>
            <dd className="text-lg font-bold text-navy">{formatINR(summary.total)}</dd>
          </div>
          {method === "cod" && summary.payNow > 0 && (
            <>
              <SummaryRow label="Pay now" value={formatINR(summary.payNow)} />
              <SummaryRow label="On delivery" value={formatINR(summary.onDelivery)} />
            </>
          )}
        </dl>
      </Section>
    </StepLayout>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-navy/60">{label}</dt>
      <dd className="font-medium text-navy">{value}</dd>
    </div>
  );
}

function MethodRow({
  selected,
  disabled,
  title,
  sub,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border-2 px-3 py-3 text-left",
        selected ? "border-rzp bg-rzp/5" : "border-navy/10",
        disabled && "cursor-not-allowed opacity-55",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-rzp" : "border-navy/25",
        )}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-rzp" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-navy">{title}</span>
        {sub && <span className="block text-xs text-navy/55">{sub}</span>}
      </span>
    </button>
  );
}

/** "Add/Change": pick one of the buyer's saved addresses, or add another. */
function AddressPicker({
  addresses,
  selectedId,
  onUse,
  onAdd,
  onBack,
}: {
  phone: string;
  addresses: ReturnType<typeof savedAddressesFor>;
  selectedId?: string | undefined;
  onUse: (id: string) => void;
  onAdd: () => void;
  onBack: () => void;
}) {
  const [picked, setPicked] = useState(selectedId ?? addresses[0]?.id);
  return (
    <StepLayout
      bar={
        <Btn
          size="lg"
          className="w-full"
          disabled={!picked}
          onClick={() => picked && onUse(picked)}
        >
          Continue
        </Btn>
      }
    >
      <button className="text-xs font-medium text-rzp" onClick={onBack}>
        ← Back
      </button>
      <Section title="Delivery address">
        <div className="space-y-2">
          {addresses.map((a) => (
            <MethodRow
              key={a.id}
              selected={picked === a.id}
              title={`${a.label} · ${a.name}`}
              sub={fullAddress(a)}
              onClick={() => setPicked(a.id)}
            />
          ))}
          {addresses.length === 0 && (
            <p className="text-sm text-navy/55">No saved addresses yet.</p>
          )}
        </div>
        <button className="mt-3 text-sm font-semibold text-rzp" onClick={onAdd}>
          + Add new address
        </button>
      </Section>
    </StepLayout>
  );
}

function Paying() {
  const paying = useStore((s) => s.buyer?.paying);
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-rzp border-t-transparent" />
      <p className="mt-4 text-base font-semibold text-navy">
        {paying?.method === "upi" || paying?.method === "cod"
          ? `Waiting for ${paying.app}…`
          : "Processing payment…"}
      </p>
      {paying && <p className="mt-1 text-sm text-navy/55">{formatINR(paying.amount)}</p>}
    </div>
  );
}

function Confirmation({ order }: { order: Order }) {
  const buyer = useStore((s) => s.buyer!);
  const isCod = order.paymentMode === "cod" || order.paymentMode === "partial";
  const due = dueOnDelivery(order);
  const paidOnline = order.paymentMode === "prepaid" || order.paymentMode === "partial";
  const finished = order.status === "delivered" || order.status === "returned";

  return (
    <StepLayout>
      <section className="rounded-2xl border border-navy/8 bg-white p-4 text-center">
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
      </section>
      <Section title="Order status">
        <Timeline events={order.timeline} upcoming={finished ? [] : ["Delivered"]} />
      </Section>
      <Section title="Delivering to">
        <p className="text-sm text-navy">{order.buyerName}</p>
        <p className="text-sm text-navy/70">{fullAddress(order)}</p>
      </Section>
      <Btn variant="secondary" className="w-full" onClick={() => toast("Chat isn't available yet")}>
        Message {SELLER.name}
      </Btn>
    </StepLayout>
  );
}
