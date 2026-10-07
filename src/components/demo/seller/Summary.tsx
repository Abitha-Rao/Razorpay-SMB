import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { toast } from "sonner";

import { Btn, Card, ScreenHeader, SectionTitle } from "@/components/demo/ui";
import { formatINR } from "@/lib/demo/money";
import { BASELINE_REFUSAL_RATE, RTO_LOSS_PER_PARCEL } from "@/lib/demo/seed";
import { useStore } from "@/lib/demo/store";
import type { Order } from "@/lib/demo/types";

// Validated with the dataviz palette checker (CVD ΔE 28, normal ΔE 33).
const PREPAID_COLOR = "#1F7AE0";
const COD_COLOR = "#D9822B";
const DAY = 24 * 60 * 60 * 1000;
const STORE_THRESHOLD = 40;

function isPrepaid(o: Order) {
  return o.paymentMode === "prepaid";
}
function isCod(o: Order) {
  return o.paymentMode === "cod" || o.paymentMode === "partial";
}

export function Summary() {
  const orders = useStore((s) => s.orders);
  const now = Date.now();
  const month = orders.filter((o) => now - new Date(o.createdAt).getTime() < 30 * DAY);
  const decided = month.filter((o) => o.paymentMode !== "pending");
  const prepaidShare = decided.length
    ? Math.round((decided.filter(isPrepaid).length / decided.length) * 100)
    : 0;
  const codOrders = month.filter(isCod);
  const refused = month.filter((o) => o.status === "refused").length;
  // Only COD parcels whose fate is known (delivered or returned) count towards the rate.
  const codSettled = codOrders.filter(
    (o) => o.status === "delivered" || o.status === "refused",
  ).length;
  const refusalRate = codSettled ? Math.round((refused / codSettled) * 100) : 0;

  const byPhone = new Map<string, number>();
  for (const o of month) byPhone.set(o.buyerPhone, (byPhone.get(o.buyerPhone) ?? 0) + 1);
  const repeatBuyers = [...byPhone.values()].filter((n) => n >= 2).length;

  const weeks = [3, 2, 1, 0].map((w) => {
    const end = now - w * 7 * DAY;
    const start = end - 7 * DAY;
    const inWeek = month.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t > start && t <= end;
    });
    const prepaid = inWeek.filter(isPrepaid).length;
    const cod = inWeek.filter(isCod).length;
    return {
      label:
        w === 0
          ? "This wk"
          : new Date(start + DAY).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      prepaid,
      cod,
      total: prepaid + cod,
    };
  });

  // Parcels that would have come back at the old refusal rate, minus those that actually did.
  const saved = Math.round(
    Math.max(0, (BASELINE_REFUSAL_RATE - refusalRate) / 100) *
      codOrders.length *
      RTO_LOSS_PER_PARCEL,
  );

  const tiles: { label: string; value: string; note?: string; note2?: string }[] = [
    { label: "Orders this month", value: String(month.length) },
    { label: "Prepaid share", value: `${prepaidShare}%` },
    {
      label: "COD refusal rate",
      value: `${refusalRate}%`,
      note: `Before Order Link: ${BASELINE_REFUSAL_RATE}%`,
      note2: `Based on ${codSettled} shipped orders with a known outcome`,
    },
    { label: "Repeat buyers", value: String(repeatBuyers) },
  ];

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Summary"
        right={<span className="text-xs text-navy/50">Last 30 days</span>}
      />
      <div className="space-y-4 px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          {tiles.map((t) => (
            <Card key={t.label} className="p-3">
              <p className="text-2xl font-bold text-navy">{t.value}</p>
              <p className="text-xs text-navy/60">{t.label}</p>
              {t.note && <p className="mt-0.5 text-[11px] text-navy/45">{t.note}</p>}
              {t.note2 && <p className="text-[10px] leading-tight text-navy/40">{t.note2}</p>}
            </Card>
          ))}
        </div>
        <Card className="border border-success/25 bg-success/6 p-3">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-navy">Saved this month</p>
            <p className="text-2xl font-bold text-[#027a48]">{formatINR(saved)}</p>
          </div>
          <p className="mt-1 text-[11px] text-navy/50">
            Fewer returned parcels than at {BASELINE_REFUSAL_RATE}%. Still lost:{" "}
            {formatINR(refused * RTO_LOSS_PER_PARCEL)} ({refused} returned ×{" "}
            {formatINR(RTO_LOSS_PER_PARCEL)} shipping both ways)
          </p>
        </Card>

        <Card className="bg-white ring-1 ring-navy/8">
          <SectionTitle>Orders per week</SectionTitle>
          <div className="mb-1 flex gap-4 text-xs text-navy/70">
            <Legend color={PREPAID_COLOR} label="Prepaid" />
            <Legend color={COD_COLOR} label="COD" />
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeks}
                margin={{ top: 18, right: 4, left: 4, bottom: 0 }}
                barCategoryGap="28%"
              >
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "#0C245122" }}
                  tick={{ fontSize: 11, fill: "#0C245199" }}
                />
                <Tooltip
                  cursor={{ fill: "#0C24510A" }}
                  contentStyle={{ borderRadius: 12, border: "1px solid #0C24511A", fontSize: 12 }}
                  formatter={(v: number, name: string) => [
                    v,
                    name === "prepaid" ? "Prepaid" : "COD",
                  ]}
                />
                <Bar dataKey="cod" stackId="w" fill={COD_COLOR} stroke="#fff" strokeWidth={2} />
                <Bar
                  dataKey="prepaid"
                  stackId="w"
                  fill={PREPAID_COLOR}
                  stroke="#fff"
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                >
                  <LabelList
                    dataKey="total"
                    position="top"
                    style={{ fontSize: 11, fill: "#0C2451", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <ProCard />
        {month.length > STORE_THRESHOLD && <StoreCard count={month.length} />}
        <LoanCard />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function ProCard() {
  const locked = [
    "Refusal rate by pincode",
    "Best-selling products",
    "GST invoices",
    "Loan-readiness report",
  ];
  return (
    <div className="overflow-hidden rounded-2xl bg-navy p-4 text-white">
      <div className="flex items-baseline justify-between">
        <p className="text-base font-semibold">Order Link Pro</p>
        <p className="text-sm text-white/80">₹199/month</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {locked.map((l, i) => (
          <div key={l} className="relative overflow-hidden rounded-xl bg-white/10 p-2.5">
            <div className="pointer-events-none select-none blur-[3px]" aria-hidden>
              <div className="flex h-8 items-end gap-1">
                {[40, 70, 55, 90, 30].map((h, j) => (
                  <span
                    key={j}
                    className="w-2 rounded-t bg-white/60"
                    style={{ height: `${((h + i * 13) % 90) + 10}%` }}
                  />
                ))}
              </div>
              <p className="mt-1 text-[10px]">₹12,480 · 18%</p>
            </div>
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium">🔒 {l}</p>
          </div>
        ))}
      </div>
      <Btn
        className="mt-3 w-full bg-white text-navy hover:bg-white/90"
        onClick={() => toast("Pro trial – not in prototype")}
      >
        Try free for 14 days
      </Btn>
    </div>
  );
}

function StoreCard({ count }: { count: number }) {
  return (
    <Card className="border border-rzp/25 bg-rzp/6">
      <p className="text-base font-semibold text-navy">Ready for your own store?</p>
      <p className="mt-1 text-sm leading-relaxed text-navy/75">
        You've done {count} orders this month. Move to a store with Razorpay Magic Checkout – your
        order history and buyers come with you.
      </p>
      <Btn
        variant="secondary"
        className="mt-3 w-full"
        onClick={() => toast("Store setup – not in prototype")}
      >
        See how it works
      </Btn>
    </Card>
  );
}

function LoanCard() {
  return (
    <Card>
      <p className="text-base font-semibold text-navy">Working capital</p>
      <p className="mt-1 text-sm leading-relaxed text-navy/75">
        Based on 3 months of orders, you may be eligible for a loan from Razorpay Capital partners.
      </p>
      <p className="mt-2 rounded-lg bg-white px-2.5 py-2 text-[11px] text-navy/60">
        🔒 We'll share your order book with the lender only if you agree.
      </p>
      <Btn
        variant="secondary"
        className="mt-3 w-full"
        onClick={() => toast("Loan check – not in prototype")}
      >
        Check eligibility
      </Btn>
    </Card>
  );
}
