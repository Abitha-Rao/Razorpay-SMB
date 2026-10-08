import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

import { Btn } from "@/components/demo/ui";
import { MESSAGE_TITLE, buyerMessage, linkUrl, type MessageKind } from "@/lib/demo/messages";
import { actions, useStore } from "@/lib/demo/store";
import type { Order } from "@/lib/demo/types";

/** Renders whichever sheet the store says is open. Lives at the seller app root. */
export function SheetHost() {
  const sheet = useStore((s) => s.sheet);
  const order = useStore((s) =>
    s.sheet ? s.orders.find((o) => o.id === s.sheet!.orderId) : undefined,
  );
  if (!sheet || !order) return null;
  return <MessageSheet kind={sheet.kind} order={order} />;
}

function BottomSheet({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") actions.closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="absolute inset-0 z-30 flex items-end bg-navy/40"
      onClick={() => actions.closeSheet()}
    >
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[92%] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pb-6 pt-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-navy/15" />
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-navy">{title}</h3>
            {subtitle && <p className="text-xs text-navy/55">{subtitle}</p>}
          </div>
          <button
            onClick={() => actions.closeSheet()}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-navy/60 hover:bg-surface"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function copyText(text: string) {
  navigator.clipboard?.writeText(text).catch(() => undefined);
}

/** Share/copy a prefilled message from the seller's own WhatsApp. Razorpay sends nothing. */
function MessageSheet({ kind, order }: { kind: MessageKind; order: Order }) {
  const settings = useStore((s) => s.settings);
  const message = buyerMessage(kind, order, settings);
  const who =
    order.buyerName && order.buyerName !== "Buyer" ? order.buyerName.split(" ")[0] : "the buyer";

  return (
    <BottomSheet title={MESSAGE_TITLE[kind]} subtitle={`${order.id} · ${linkUrl(order)}`}>
      <div className="mb-4 rounded-2xl bg-[#e7fbe6] p-3">
        <p className="rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm leading-relaxed text-[#111b21] shadow-sm">
          {message}
        </p>
      </div>
      <div className="space-y-2">
        <Btn
          size="lg"
          className="w-full bg-[#25D366] hover:bg-[#1ebe5a]"
          onClick={() => {
            actions.closeSheet();
            toast.success(`Opened WhatsApp to ${who} (simulated)`);
          }}
        >
          Share on WhatsApp
        </Btn>
        <Btn
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() => {
            copyText(message);
            actions.closeSheet();
            toast("Message copied");
          }}
        >
          Copy message
        </Btn>
      </div>
    </BottomSheet>
  );
}
