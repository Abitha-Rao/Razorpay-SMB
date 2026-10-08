import type { ButtonHTMLAttributes, ReactNode } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { dueOnDelivery, formatINR, orderTotal } from "@/lib/demo/money";
import type { Order, OrderStatus } from "@/lib/demo/types";

export function notInPrototype(what?: string) {
  toast(what ? `${what} – not in prototype` : "Not in prototype");
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "success" | "danger";
  size?: "md" | "lg" | "sm";
};

export function Btn({ variant = "primary", size = "md", className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        size === "lg" && "min-h-14 px-5 text-base",
        size === "md" && "min-h-12 px-4 text-sm",
        size === "sm" && "min-h-9 px-3 text-xs",
        variant === "primary" && "bg-rzp text-white hover:bg-rzp-dark",
        variant === "secondary" && "border border-rzp/30 bg-white text-rzp hover:bg-rzp/5",
        variant === "ghost" && "text-navy/70 hover:bg-surface",
        variant === "success" && "bg-success text-white hover:bg-success/90",
        variant === "danger" && "bg-danger text-white hover:bg-danger/90",
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl bg-surface p-4", className)}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/55">{children}</h2>
      {action}
    </div>
  );
}

export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-navy/5 bg-white/95 px-4 py-3 backdrop-blur">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-navy hover:bg-surface"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h1 className="flex-1 text-lg font-semibold text-navy">{title}</h1>
      {right}
    </div>
  );
}

export const STATUS_META: Record<OrderStatus, { label: string; cls: string }> = {
  awaiting_payment: { label: "Awaiting payment", cls: "bg-warning/12 text-[#b54708]" },
  paid: { label: "Paid", cls: "bg-success/12 text-[#027a48]" },
  cod_confirmed: { label: "COD confirmed", cls: "bg-rzp/12 text-rzp-dark" },
  partial_paid: { label: "Partial paid", cls: "bg-[#7a5af8]/12 text-[#5925dc]" },
  delivered: { label: "Delivered", cls: "bg-success/12 text-[#027a48]" },
  returned: { label: "Returned", cls: "bg-danger/12 text-[#b42318]" },
};

export function StatusChip({ status }: { status: OrderStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", m.cls)}>
      {m.label}
    </span>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-navy bg-navy text-white"
          : "border-navy/15 bg-white text-navy/75 hover:border-navy/30",
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-navy/65">{label}</span>
      {children}
      {hint}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 text-sm text-navy outline-none placeholder:text-navy/35 focus:border-rzp focus:ring-2 focus:ring-rzp/20";

export function Timeline({
  events,
  upcoming = [],
}: {
  events: { label: string; at?: string }[];
  upcoming?: string[];
}) {
  const fmt = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";
  return (
    <ol className="relative ml-1.5 border-l-2 border-navy/10 pl-5">
      {events.map((e, i) => (
        <li key={i} className="relative pb-4 last:pb-1">
          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-success ring-2 ring-success/25" />
          <p className="text-sm font-medium text-navy">{e.label}</p>
          <p className="text-xs text-navy/50">{fmt(e.at)}</p>
        </li>
      ))}
      {upcoming.map((label) => (
        <li key={label} className="relative pb-4 last:pb-1">
          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-navy/15" />
          <p className="text-sm text-navy/40">{label}</p>
        </li>
      ))}
    </ol>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

/** Order total as shown in lists – matches the order detail, with the split for partial-paid orders. */
export function OrderAmount({ order }: { order: Order }) {
  const due = dueOnDelivery(order);
  return (
    <>
      <span className="text-sm font-semibold text-navy">{formatINR(orderTotal(order))}</span>
      {order.paymentMode === "partial" && due > 0 && (
        <span className="text-[10px] text-navy/45">
          {formatINR(order.paidAmount)} paid · {formatINR(due)} on delivery
        </span>
      )}
    </>
  );
}

/** Small tag on orders where the seller tapped "Allow COD anyway". */
export function OverrideTag() {
  return (
    <span className="rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-[#b54708]">
      Override
    </span>
  );
}

/** Status chip plus the "Override" tag, for order lists. */
export function OrderStatusTags({ order }: { order: Order }) {
  return (
    <span className="flex items-center gap-1">
      {order.override && <OverrideTag />}
      <StatusChip status={order.status} />
    </span>
  );
}
