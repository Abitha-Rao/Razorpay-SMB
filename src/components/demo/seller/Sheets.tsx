import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Btn, Field, inputCls } from "@/components/demo/ui";
import { MESSAGE_TITLE, buyerMessage, linkUrl, type MessageKind } from "@/lib/demo/messages";
import { dueOnDelivery, formatINR, totalWeight } from "@/lib/demo/money";
import { COURIERS, fullAddress } from "@/lib/demo/shipping";
import { actions, useStore } from "@/lib/demo/store";
import type { Courier, Order } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

/** Renders whichever sheet the store says is open. Lives at the seller app root. */
export function SheetHost() {
  const sheet = useStore((s) => s.sheet);
  const order = useStore((s) =>
    s.sheet ? s.orders.find((o) => o.id === s.sheet!.orderId) : undefined,
  );
  if (!sheet || !order) return null;
  if (sheet.kind === "ship") return <ShipSheet order={order} />;
  return <MessageSheet kind={sheet.kind} order={order} />;
}

function BottomSheet({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") actions.closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="absolute inset-0 z-30 flex items-end bg-navy/40"
      onClick={() => actions.closeSheet()}
    >
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[92%] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pb-6 pt-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-navy/15" />
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-navy">{title}</h3>
            {subtitle && <p className="text-xs text-navy/55">{subtitle}</p>}
          </div>
          <button
            onClick={() => actions.closeSheet()}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-navy/60 hover:bg-surface"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function copyText(text: string) {
  navigator.clipboard?.writeText(text).catch(() => undefined);
}

/** Share/copy a prefilled message from the seller's own WhatsApp. Razorpay sends nothing. */
function MessageSheet({ kind, order }: { kind: MessageKind; order: Order }) {
  const settings = useStore((s) => s.settings);
  const message = buyerMessage(kind, order, settings);
  const who =
    order.buyerName && order.buyerName !== "Buyer" ? order.buyerName.split(" ")[0] : "the buyer";

  return (
    <BottomSheet title={MESSAGE_TITLE[kind]} subtitle={`${order.id} · ${linkUrl(order)}`}>
      <div className="mb-4 rounded-2xl bg-[#e7fbe6] p-3">
        <p className="rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm leading-relaxed text-[#111b21] shadow-sm">
          {message}
        </p>
      </div>
      <div className="space-y-2">
        <Btn
          size="lg"
          className="w-full bg-[#25D366] hover:bg-[#1ebe5a]"
          onClick={() => {
            actions.closeSheet();
            toast.success(`Opened WhatsApp to ${who} (simulated)`);
          }}
        >
          Share on WhatsApp
        </Btn>
        <Btn
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() => {
            copyText(message);
            actions.closeSheet();
            toast("Message copied");
          }}
        >
          Copy message
        </Btn>
      </div>
    </BottomSheet>
  );
}

function ShipSheet({ order }: { order: Order }) {
  const [courier, setCourier] = useState<Courier>("Delhivery");
  const [awb, setAwb] = useState("");
  const collect = dueOnDelivery(order);
  const address = fullAddress(order);
  const weight = totalWeight(order.lines);
  const needsAwb = courier !== "Other";
  const canShip = !needsAwb || awb.trim().length >= 4;

  const courierText = [
    order.buyerName,
    order.buyerPhone,
    address,
    `Weight: ${weight.toFixed(1)} kg`,
    collect > 0 ? `COD – collect ${formatINR(collect)}` : "Prepaid – collect nothing",
  ].join("\n");

  return (
    <BottomSheet
      title="Ship order"
      subtitle={`${order.id} · book with your courier, then add the tracking number`}
    >
      <div className="space-y-1.5 rounded-2xl bg-surface p-3 text-sm">
        <Row label="Name" value={order.buyerName} />
        <Row label="Phone" value={order.buyerPhone || "—"} />
        <Row label="Address" value={address || "—"} />
        <Row label="Pincode" value={order.pincode ?? "—"} />
        <Row label="Weight" value={`${weight.toFixed(1)} kg`} />
        <Row
          label="Amount to collect"
          value={collect > 0 ? formatINR(collect) : "Nothing (prepaid)"}
          strong={collect > 0}
        />
      </div>
      <Btn
        variant="secondary"
        className="mt-2 w-full"
        onClick={() => {
          copyText(courierText);
          toast("Copied for courier");
        }}
      >
        Copy for courier
      </Btn>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Field label="Courier">
          <select
            className={inputCls}
            value={courier}
            onChange={(e) => setCourier(e.target.value as Courier)}
          >
            {COURIERS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label={needsAwb ? "Tracking number" : "Tracking number (optional)"}>
          <input
            className={inputCls}
            value={awb}
            placeholder={needsAwb ? "e.g. 1490 2231 7781" : "Optional"}
            onChange={(e) => setAwb(e.target.value)}
          />
        </Field>
      </div>
      <Btn
        size="lg"
        className="mt-4 w-full"
        disabled={!canShip}
        onClick={() => actions.shipOrder(order.id, courier, awb)}
      >
        Mark as shipped
      </Btn>
      {!canShip && (
        <p className="mt-1.5 text-center text-xs text-[#b54708]">
          Add the tracking number from {courier}.
        </p>
      )}
    </BottomSheet>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-navy/55">{label}</span>
      <span className={cn("text-right text-navy", strong && "font-semibold")}>{value}</span>
    </div>
  );
}
