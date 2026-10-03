import { useState } from "react";

import {
  FilterChip,
  OrderAmount,
  ScreenHeader,
  OrderStatusTags,
  inputCls,
} from "@/components/demo/ui";
import { actions, useStore } from "@/lib/demo/store";
import type { Order, OrderStatus } from "@/lib/demo/types";

const STATUS_FILTERS: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "awaiting_payment", label: "Awaiting payment" },
  { key: "paid", label: "Paid" },
  { key: "cod_confirmed", label: "COD confirmed" },
  { key: "partial_paid", label: "Partial paid" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "refused", label: "Returned" },
];

const PAY_FILTERS = [
  { key: "all", label: "Any payment" },
  { key: "prepaid", label: "Prepaid" },
  { key: "cod", label: "COD" },
] as const;

function payType(o: Order): "prepaid" | "cod" | "pending" {
  if (o.paymentMode === "prepaid") return "prepaid";
  if (o.paymentMode === "pending") return "pending";
  return "cod";
}

export function Orders() {
  const orders = useStore((s) => s.orders);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [pay, setPay] = useState<(typeof PAY_FILTERS)[number]["key"]>("all");

  const query = q.trim().toLowerCase();
  const list = orders.filter(
    (o) =>
      (status === "all" || o.status === status) &&
      (pay === "all" || payType(o) === pay) &&
      (!query ||
        o.buyerName.toLowerCase().includes(query) ||
        o.buyerPhone.replace(/\s/g, "").includes(query.replace(/\s/g, "")) ||
        o.id.toLowerCase().includes(query) ||
        o.lines.some((l) => l.name.toLowerCase().includes(query))),
  );

  return (
    <div className="pb-6">
      <ScreenHeader
        title="Orders"
        right={<span className="text-xs text-navy/50">{orders.length} total</span>}
      />
      <div className="space-y-2 px-4 pt-3">
        <input
          className={inputCls}
          placeholder="Search buyer, phone or product"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {STATUS_FILTERS.map((f) => (
            <FilterChip key={f.key} active={status === f.key} onClick={() => setStatus(f.key)}>
              {f.label}
            </FilterChip>
          ))}
        </div>
        <div className="flex gap-1.5">
          {PAY_FILTERS.map((f) => (
            <FilterChip key={f.key} active={pay === f.key} onClick={() => setPay(f.key)}>
              {f.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <ul className="mt-2 divide-y divide-navy/8 px-4">
        {list.length === 0 && (
          <li className="py-10 text-center text-sm text-navy/50">No orders match</li>
        )}
        {list.map((o) => {
          const pt = payType(o);
          return (
            <li key={o.id}>
              <button
                onClick={() => actions.openOrder(o.id)}
                className="flex w-full items-start justify-between gap-2 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">{o.buyerName}</p>
                  <p className="truncate text-xs text-navy/55">
                    {o.lines.map((l) => l.name).join(", ")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-navy/40">
                    {o.id} ·{" "}
                    {new Date(o.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                    {pt !== "pending" && ` · ${pt === "prepaid" ? "Prepaid" : "COD"}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <OrderAmount order={o} />
                  <OrderStatusTags order={o} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
