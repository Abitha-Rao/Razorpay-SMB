import { useEffect } from "react";
import { toast } from "sonner";

import { BuyerApp } from "@/components/demo/buyer/BuyerApp";
import { SellerApp } from "@/components/demo/seller/SellerApp";
import { getAiStatus } from "@/lib/demo/ai.functions";
import { actions, useStore } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

export function PhoneShell() {
  const view = useStore((s) => s.view);
  const hasLink = useStore((s) => s.linkOrderId !== null);

  useEffect(() => {
    getAiStatus()
      .then((r) => actions.setAiAvailable(r.available))
      .catch(() => actions.setAiAvailable(false));
  }, []);

  // On phones, leave a 56px strip under the app so floating badges (e.g. Lovable's) never cover the nav.
  return (
    <div className="min-h-dvh bg-[#e9edf3] pb-14 sm:py-6">
      <div className="mx-auto flex w-full max-w-[390px] flex-col sm:gap-3">
        {/* Controls – outside the phone on desktop, a slim bar on mobile */}
        <div className="flex items-center gap-2 bg-white px-3 py-2 sm:rounded-2xl sm:px-2 sm:shadow-sm">
          <div className="flex flex-1 rounded-xl bg-surface p-1">
            {(["seller", "buyer"] as const).map((v) => (
              <button
                key={v}
                onClick={() => actions.setView(v)}
                className={cn(
                  "relative flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
                  view === v ? "bg-white text-navy shadow-sm" : "text-navy/50",
                )}
              >
                {v === "seller" ? "Seller app" : "Buyer view"}
                {v === "buyer" && hasLink && view !== "buyer" && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rzp" />
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              actions.resetDemo();
              toast("Reset");
            }}
            className="rounded-lg px-2.5 py-2 text-xs font-medium text-navy/60 hover:bg-surface"
          >
            Reset
          </button>
        </div>

        <div className="relative flex h-[calc(100dvh-116px)] flex-col overflow-hidden bg-white sm:h-[min(780px,calc(100dvh-110px))] sm:min-h-[560px] sm:rounded-[40px] sm:border-[10px] sm:border-[#111827] sm:shadow-2xl">
          {view === "seller" && (
            <div className="shrink-0 border-b border-navy/5 px-4 py-1.5 text-[10px] font-semibold tracking-wide text-navy/60">
              Chat Checkout <span className="font-normal text-navy/40">by Razorpay</span>
            </div>
          )}
          <div className="relative min-h-0 flex-1">
            {view === "seller" ? (
              <SellerApp />
            ) : (
              <div className="h-full overflow-y-auto">
                <BuyerApp />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
