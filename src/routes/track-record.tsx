import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { TrackRecordCard } from "@/components/demo/TrackRecordParts";
import { SELLER } from "@/lib/demo/seed";

const TITLE = `${SELLER.name} – track record on Chat Checkout`;
const DESCRIPTION =
  "Paid and delivered orders and the return rate for this seller, counted only from orders paid through their Chat Checkout payment link.";

export const Route = createFileRoute("/track-record")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackRecordPage,
});

/** The shareable page: one seller's track record, readable without opening the app. */
function TrackRecordPage() {
  // The demo store is client-only (it lives in this browser), so render after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="min-h-dvh bg-[#e9edf3]" />;

  return (
    <div className="min-h-dvh bg-[#e9edf3] sm:py-6">
      <main className="mx-auto min-h-dvh w-full max-w-[390px] bg-white sm:min-h-0 sm:rounded-3xl sm:shadow-xl">
        <div className="bg-warning/15 px-3 py-1.5 text-center text-[11px] font-medium text-[#93370d] sm:rounded-t-3xl">
          Prototype – sample data, no real orders
        </div>
        <div className="px-4 pb-8 pt-5">
          <p className="text-[11px] font-semibold tracking-wide text-navy/55">
            Chat Checkout <span className="font-normal text-navy/40">by Razorpay (concept)</span>
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-base font-bold text-white">
              MH
            </div>
            <div>
              <h1 className="text-xl font-bold text-navy">{SELLER.name}</h1>
              <p className="text-xs text-navy/55">{SELLER.city} · Track record</p>
            </div>
          </div>
          <div className="mt-5">
            <TrackRecordCard />
          </div>
          <a href="/" className="mt-6 block text-center text-xs font-medium text-rzp">
            ← Back to the prototype
          </a>
        </div>
      </main>
    </div>
  );
}
