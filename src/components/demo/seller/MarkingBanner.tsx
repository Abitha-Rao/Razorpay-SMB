import { markingBannerText, ordersNeedingMarking } from "@/lib/demo/marking";
import { actions, useStore } from "@/lib/demo/store";

/**
 * "N orders confirmed over 3 days ago…". Tapping it shows just those orders on the Orders screen.
 * Hidden when no order needs marking.
 */
export function MarkingBanner({ showAll }: { showAll?: boolean }) {
  const orders = useStore((s) => s.orders);
  const count = ordersNeedingMarking(orders).length;
  if (count === 0) return null;
  return (
    <div className="rounded-2xl border border-warning/40 bg-warning/10">
      <button
        onClick={() => actions.showNeedsMarking()}
        className="w-full px-3 py-2.5 text-left text-xs font-medium leading-relaxed text-[#b54708]"
      >
        {markingBannerText(count)}
      </button>
      {showAll && (
        <button
          onClick={() => actions.clearMarkingFilter()}
          className="w-full border-t border-warning/30 px-3 py-1.5 text-left text-[11px] font-semibold text-rzp"
        >
          Show all orders
        </button>
      )}
    </div>
  );
}
