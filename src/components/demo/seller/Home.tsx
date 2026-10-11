import { Btn, OrderAmount, OrderStatusTags } from "@/components/demo/ui";
import { MarkingBanner } from "@/components/demo/seller/MarkingBanner";
import { SELLER } from "@/lib/demo/seed";
import { actions, useStore } from "@/lib/demo/store";

export function Home() {
  const orders = useStore((s) => s.orders);
  const today = new Date().toDateString();
  const todayCount = orders.filter((o) => new Date(o.createdAt).toDateString() === today).length;
  const awaiting = orders.filter((o) => o.status === "awaiting_payment").length;
  const toDeliver = orders.filter((o) =>
    ["paid", "cod_confirmed", "partial_paid"].includes(o.status),
  ).length;
  const recent = orders.slice(0, 4);

  const cards = [
    { label: "Orders today", value: todayCount, onClick: () => actions.setTab("orders") },
    { label: "Awaiting payment", value: awaiting, onClick: () => actions.setTab("orders") },
    { label: "To deliver", value: toDeliver, onClick: () => actions.setTab("orders") },
  ];

  return (
    <div className="px-4 pb-6 pt-5">
      <p className="text-xs text-navy/55">Good morning 👋</p>
      <h1 className="text-xl font-bold text-navy">
        {SELLER.name}, {SELLER.city}
      </h1>

      <div className="mt-3 empty:hidden">
        <MarkingBanner />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={c.onClick}
            className="rounded-2xl bg-surface p-3 text-left"
          >
            <p className="text-2xl font-bold text-navy">{c.value}</p>
            <p className="text-[11px] leading-tight text-navy/60">{c.label}</p>
          </button>
        ))}
      </div>

      <Btn size="lg" className="mt-5 w-full text-base" onClick={actions.openNewOrder}>
        + New order
      </Btn>
      <p className="mt-2 text-center text-xs text-navy/50">
        Paste a buyer's order message – AI drafts the order, you share the payment link
      </p>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/55">
          Recent orders
        </h2>
        <button className="text-xs font-semibold text-rzp" onClick={() => actions.setTab("orders")}>
          See all
        </button>
      </div>
      <ul className="mt-2 divide-y divide-navy/8">
        {recent.map((o) => (
          <li key={o.id}>
            <button
              onClick={() => {
                actions.setTab("orders");
                actions.openOrder(o.id);
              }}
              className="flex w-full items-center justify-between gap-2 py-3 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-navy">{o.buyerName}</p>
                <p className="truncate text-xs text-navy/55">
                  {o.lines.map((l) => l.name).join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <OrderAmount order={o} />
                <OrderStatusTags order={o} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
