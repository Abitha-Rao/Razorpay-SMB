import { toast } from "sonner";

import {
  TRACK_RECORD_PATH,
  TrackRecordBadge,
  TrackRecordCard,
} from "@/components/demo/TrackRecordParts";
import { Btn, ScreenHeader, SectionTitle } from "@/components/demo/ui";
import { SELLER } from "@/lib/demo/seed";

/** The seller's track record, with the link to share it. */
export function TrackRecordScreen() {
  const url =
    typeof window === "undefined" ? TRACK_RECORD_PATH : window.location.origin + TRACK_RECORD_PATH;

  return (
    <div className="pb-8">
      <ScreenHeader title="Track record" />
      <div className="space-y-5 px-4 pt-4">
        <p className="text-xs leading-relaxed text-navy/60">
          {SELLER.name}'s record on Chat Checkout. It grows only with real deliveries that were paid
          through your payment link.
        </p>
        <TrackRecordCard />

        <section>
          <SectionTitle>Share it</SectionTitle>
          <div className="space-y-2">
            <Btn
              size="lg"
              className="w-full"
              onClick={() => {
                navigator.clipboard?.writeText(url).catch(() => undefined);
                toast("Track record link copied");
              }}
            >
              Copy shareable link
            </Btn>
            <a
              href={TRACK_RECORD_PATH}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 w-full items-center justify-center rounded-xl border border-rzp/30 text-sm font-semibold text-rzp"
            >
              Open the shareable page
            </a>
          </div>
        </section>

        <section>
          <SectionTitle>What buyers see on your payment link</SectionTitle>
          <TrackRecordBadge />
        </section>
      </div>
    </div>
  );
}
