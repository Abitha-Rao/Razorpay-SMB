import { Card } from "@/components/demo/ui";
import { trackRecord } from "@/lib/demo/track";
import { useStore } from "@/lib/demo/store";

export const TRACK_RECORD_PATH = "/track-record";

export const TRACK_RECORD_RULE =
  "Counts only orders paid through the payment link and marked Delivered by the seller.";

const RETURN_RATE_RULE =
  " The return rate is returned orders ÷ (delivered + returned) across all orders.";

/** Compact line for the buyer's payment-link screen. Buyers see the paid and delivered count only. */
export function TrackRecordBadge() {
  const orders = useStore((s) => s.orders);
  const { paidDelivered } = trackRecord(orders);
  if (paidDelivered === 0) return null;
  return (
    <div className="mt-3 rounded-xl bg-success/10 px-3 py-2">
      <p className="text-xs font-semibold text-[#027a48]">
        ✓ {paidDelivered} paid and delivered {paidDelivered === 1 ? "order" : "orders"}
      </p>
      <a
        href={TRACK_RECORD_PATH}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] font-medium text-navy/55 underline"
      >
        See the seller's track record
      </a>
    </div>
  );
}

/** The track record as two tiles plus how it's counted. Used on the seller screen and the shareable page. */
export function TrackRecordCard({ showReturnRate = true }: { showReturnRate?: boolean }) {
  const orders = useStore((s) => s.orders);
  const r = trackRecord(orders);
  return (
    <>
      <div className={showReturnRate ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
        <Card className="p-3">
          <p className="text-3xl font-bold text-navy">{r.paidDelivered}</p>
          <p className="text-xs text-navy/60">Paid & delivered orders</p>
        </Card>
        {showReturnRate && (
          <Card className="p-3">
            <p className="text-3xl font-bold text-navy">
              {r.returnRatePct === null ? "—" : `${r.returnRatePct}%`}
            </p>
            <p className="text-xs text-navy/60">Return rate</p>
            <p className="text-[10px] text-navy/40">
              {r.returned} returned of {r.delivered + r.returned} marked
            </p>
          </Card>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-navy/50">
        {TRACK_RECORD_RULE}
        {showReturnRate && RETURN_RATE_RULE}
      </p>
    </>
  );
}
