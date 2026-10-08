import { toast } from "sonner";

import { Card, ScreenHeader, SectionTitle } from "@/components/demo/ui";
import { isListed, normalizePhone } from "@/lib/demo/cod";
import { actions, useStore } from "@/lib/demo/store";
import type { BuyerRef } from "@/lib/demo/types";

type Person = { phone: string; name: string; orders: number; delivered: number; returned: number };

/** The Trusted and Blocked lists, plus everyone else who has ordered. */
export function Buyers() {
  const orders = useStore((s) => s.orders);
  const trusted = useStore((s) => s.trusted);
  const blocked = useStore((s) => s.blocked);

  // One row per phone number, from the order book (newest order first, so the latest name wins).
  const byPhone = new Map<string, Person>();
  for (const o of orders) {
    const key = normalizePhone(o.buyerPhone);
    if (!key) continue;
    const p = byPhone.get(key) ?? {
      phone: o.buyerPhone,
      name: o.buyerName,
      orders: 0,
      delivered: 0,
      returned: 0,
    };
    p.orders += 1;
    if (o.status === "delivered") p.delivered += 1;
    if (o.status === "returned") p.returned += 1;
    byPhone.set(key, p);
  }
  const stats = (b: BuyerRef) => byPhone.get(normalizePhone(b.phone));
  const others = [...byPhone.values()].filter(
    (p) => !isListed(p.phone, trusted) && !isListed(p.phone, blocked),
  );

  return (
    <div className="pb-8">
      <ScreenHeader title="Buyers" />
      <div className="space-y-5 px-4 pt-4">
        <p className="text-xs leading-relaxed text-navy/60">
          Trusted buyers are always allowed COD. Blocked buyers can only pay now.
        </p>

        <section>
          <SectionTitle>Trusted buyers</SectionTitle>
          {trusted.length === 0 ? (
            <Empty>No trusted buyers yet. Add one from the list below or from an order.</Empty>
          ) : (
            <List>
              {trusted.map((b) => (
                <Row
                  key={b.phone}
                  name={`★ ${b.name}`}
                  sub={`${b.phone} · ${stats(b)?.delivered ?? 0} delivered`}
                  action="Remove"
                  danger
                  onClick={() => actions.untrustBuyer(b.phone)}
                />
              ))}
            </List>
          )}
        </section>

        <section>
          <SectionTitle>Blocked buyers</SectionTitle>
          {blocked.length === 0 ? (
            <Empty>No blocked buyers.</Empty>
          ) : (
            <List>
              {blocked.map((b) => (
                <Row
                  key={b.phone}
                  name={b.name}
                  sub={`${b.phone} · prepaid only`}
                  action="Unblock"
                  onClick={() => actions.unblockBuyer(b.phone)}
                />
              ))}
            </List>
          )}
        </section>

        <section>
          <SectionTitle>Other buyers</SectionTitle>
          {others.length === 0 ? (
            <Empty>Everyone who has ordered is on a list.</Empty>
          ) : (
            <List>
              {others.map((p) => (
                <Row
                  key={p.phone}
                  name={p.name}
                  sub={`${p.phone} · ${p.orders} ${p.orders === 1 ? "order" : "orders"}${
                    p.returned > 0 ? " · parcel returned" : ""
                  }`}
                  action="Add to trusted"
                  onClick={() => {
                    actions.trustBuyer(p.phone, p.name);
                    toast(`${p.name} added to Trusted buyers`);
                  }}
                />
              ))}
            </List>
          )}
        </section>
      </div>
    </div>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-navy/8 rounded-2xl bg-surface px-3">{children}</ul>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <Card className="text-xs text-navy/55">{children}</Card>;
}

function Row({
  name,
  sub,
  action,
  danger,
  onClick,
}: {
  name: string;
  sub: string;
  action: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-navy">{name}</p>
        <p className="truncate text-[11px] text-navy/50">{sub}</p>
      </div>
      <button
        className={`shrink-0 text-xs font-semibold ${danger ? "text-danger" : "text-rzp"}`}
        onClick={onClick}
      >
        {action}
      </button>
    </li>
  );
}
