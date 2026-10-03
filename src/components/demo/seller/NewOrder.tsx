import { useEffect } from "react";
import { toast } from "sonner";

import {
  Btn,
  Card,
  Field,
  ScreenHeader,
  SectionTitle,
  Spinner,
  inputCls,
} from "@/components/demo/ui";
import { AI_TIMEOUT_MS, draftOrderFn } from "@/lib/demo/ai.functions";
import { PRESETS, fallbackDraft } from "@/lib/demo/fallback";
import {
  buyerPrices,
  discountAmount,
  formatINR,
  isLineComplete,
  lineTotal,
  subtotal,
  totalWeight,
} from "@/lib/demo/money";
import { SELLER } from "@/lib/demo/seed";
import { actions, getState, newLineId, useStore } from "@/lib/demo/store";
import { withTimeout } from "@/lib/demo/timeout";
import type { CatalogItem, DraftResult, OrderLine } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

const MIN_LOADING_MS = 1000;

function toLines(draft: DraftResult, catalog: CatalogItem[]): OrderLine[] {
  return draft.lines.map((l) => {
    const item =
      catalog.find((c) => c.id === l.catalog_id) ??
      (l.type === "catalog"
        ? catalog.find((c) => c.name.toLowerCase() === l.name?.toLowerCase())
        : undefined);
    if (l.type === "catalog" && item) {
      // Catalog price is fixed – ignore whatever price the model returned.
      return {
        id: newLineId(),
        type: "catalog",
        catalogId: item.id,
        name: item.name,
        qty: Math.max(1, Number(l.qty) || 1),
        unitPrice: item.price,
        weightKg: item.weightKg,
        size: l.size ?? undefined,
      };
    }
    return {
      id: newLineId(),
      type: "custom",
      name: l.name ?? "",
      qty: Math.max(1, Number(l.qty) || 1),
      unitPrice: typeof l.unit_price === "number" && l.unit_price > 0 ? l.unit_price : null,
      weightKg: typeof l.weight_kg === "number" && l.weight_kg > 0 ? l.weight_kg : 0.3,
      size: l.size ?? undefined,
    };
  });
}

export function NewOrder() {
  const draft = useStore((s) => s.draft);
  const catalog = useStore((s) => s.catalog);
  const settings = useStore((s) => s.settings);
  const shareOrderId = useStore((s) => s.shareOrderId);

  async function runDraft() {
    const { draft: d, catalog: cat, settings: st } = getState();
    if (!d.chat.trim()) return;
    actions.updateDraft({ status: "loading" });
    const started = Date.now();
    // The demo parser is a silent fallback if the call fails or takes longer than 8s.
    const result = await withTimeout(
      draftOrderFn({ data: { chat: d.chat, catalog: cat, from: d.from, useLive: st.useLiveAi } }),
      AI_TIMEOUT_MS,
      () => ({ source: "fallback" as const, draft: fallbackDraft(d.chat, cat, d.from) }),
    );
    const wait = MIN_LOADING_MS - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const r = result.draft;
    actions.updateDraft({
      status: "drafted",
      source: result.source,
      lines: toLines(r, cat),
      discount: r.discount && r.discount.value ? r.discount : null,
      buyerName: r.buyer_name ?? d.from?.name ?? "",
      buyerPhone: r.buyer_phone ?? d.from?.phone ?? "",
      addressText: r.address_text ?? "",
      pincode: r.pincode ?? r.address_text?.match(/\b[1-9]\d{5}\b/)?.[0] ?? "",
      paymentHint: r.payment_hint ?? "unknown",
      uncertain: r.uncertain ?? [],
    });
  }

  const lines = draft.lines;
  const prices = buyerPrices(lines, draft.discount, settings);
  const allComplete = lines.length > 0 && lines.every(isLineComplete);

  return (
    <div className="pb-8">
      <ScreenHeader title="New order" onBack={actions.back} />
      <div className="space-y-5 px-4 pt-4">
        <section>
          <Field label="Paste the buyer's chat">
            <textarea
              value={draft.chat}
              onChange={(e) => actions.updateDraft({ chat: e.target.value, from: undefined })}
              rows={4}
              placeholder="e.g. want the green saree, cod pls, address: …"
              className={cn(inputCls, "resize-none leading-relaxed")}
            />
          </Field>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.key}
                onClick={() =>
                  actions.updateDraft({
                    chat: p.chat,
                    from: p.from,
                    status: "editing",
                    lines: [],
                    uncertain: [],
                  })
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  draft.chat === p.chat
                    ? "border-rzp bg-rzp/10 text-rzp-dark"
                    : "border-navy/15 bg-white text-navy/75 hover:border-rzp/50",
                )}
              >
                {String.fromCharCode(97 + i)}) {p.label}
              </button>
            ))}
          </div>
          {draft.from && (
            <p className="mt-2 text-xs text-navy/55">
              Shared from WhatsApp chat with{" "}
              <span className="font-medium text-navy">{draft.from.name}</span>
            </p>
          )}
          <Btn
            size="lg"
            className="mt-3 w-full"
            disabled={!draft.chat.trim() || draft.status === "loading"}
            onClick={runDraft}
          >
            {draft.status === "loading" ? (
              <>
                <Spinner /> Reading the chat…
              </>
            ) : (
              <>✨ Draft with AI</>
            )}
          </Btn>
        </section>

        {draft.status === "loading" && <DraftSkeleton />}

        {draft.status === "drafted" && (
          <>
            <DraftEditor catalog={catalog} />

            <Card className="space-y-2 bg-white ring-1 ring-navy/10">
              <Row label="Subtotal" value={formatINR(subtotal(lines))} />
              <DiscountRow />
              <Row
                label="Shipping"
                value={
                  prices.prepaidShipping === 0
                    ? "Free (prepaid)"
                    : formatINR(prices.prepaidShipping)
                }
                sub={`${formatINR(prices.codShipping)} + ${formatINR(prices.codFee)} COD fee if buyer picks COD`}
              />
              <div className="flex items-baseline justify-between border-t border-navy/10 pt-2">
                <span className="text-sm font-semibold text-navy">Total</span>
                <span className="text-xl font-bold text-navy">
                  {formatINR(prices.prepaidTotal)}
                </span>
              </div>
              <p className="text-[11px] text-navy/45">
                Calculated from the lines · {totalWeight(lines).toFixed(1)} kg · total can't be
                typed in
              </p>
            </Card>

            <p className="rounded-xl bg-rzp/8 px-3 py-2.5 text-xs leading-relaxed text-navy/75">
              AI drafted this from the chat. Check it before sending – you stay in charge of the
              conversation.
            </p>

            <Btn
              size="lg"
              className="w-full"
              disabled={!allComplete}
              onClick={() => actions.createLink()}
            >
              Create link
            </Btn>
            {!allComplete && (
              <p className="-mt-3 text-center text-xs text-[#b54708]">
                Set a price and name for every line first.
              </p>
            )}
          </>
        )}
      </div>

      {shareOrderId && <ShareSheet orderId={shareOrderId} />}
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-navy/65">{label}</span>
        <span className="font-medium text-navy">{value}</span>
      </div>
      {sub && <p className="text-right text-[11px] text-navy/45">{sub}</p>}
    </div>
  );
}

function DiscountRow() {
  const discount = useStore((s) => s.draft.discount);
  const lines = useStore((s) => s.draft.lines);
  const type = discount?.type ?? "flat";
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-navy/65">Discount</span>
      <div className="flex items-center gap-1.5">
        <div className="flex overflow-hidden rounded-lg border border-navy/15 text-xs">
          {(["flat", "percent"] as const).map((t) => (
            <button
              key={t}
              onClick={() =>
                actions.updateDraft({ discount: { type: t, value: discount?.value ?? 0 } })
              }
              className={cn(
                "px-2 py-1",
                type === t ? "bg-navy text-white" : "bg-white text-navy/70",
              )}
            >
              {t === "flat" ? "₹" : "%"}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={discount?.value ?? ""}
          placeholder="0"
          onChange={(e) => {
            const v = Math.max(0, Number(e.target.value) || 0);
            actions.updateDraft({
              discount: v ? { type, value: type === "percent" ? Math.min(v, 100) : v } : null,
            });
          }}
          className="w-16 rounded-lg border border-navy/15 px-2 py-1 text-right text-sm text-navy outline-none focus:border-rzp"
        />
        <span className="w-14 text-right font-medium text-navy">
          {discountAmount(lines, discount)
            ? "−" + formatINR(discountAmount(lines, discount))
            : "₹0"}
        </span>
      </div>
    </div>
  );
}

function DraftSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
      ))}
    </div>
  );
}

function DraftEditor({ catalog }: { catalog: CatalogItem[] }) {
  const draft = useStore((s) => s.draft);

  function updateLine(id: string, patch: Partial<OrderLine>) {
    actions.updateDraft({
      lines: getState().draft.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }

  function setType(line: OrderLine, type: OrderLine["type"]) {
    if (type === line.type) return;
    if (type === "catalog") {
      const item = catalog[0];
      if (!item) return;
      updateLine(line.id, {
        type,
        catalogId: item.id,
        name: item.name,
        unitPrice: item.price,
        weightKg: item.weightKg,
      });
    } else {
      updateLine(line.id, { type, catalogId: undefined });
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle>Draft order</SectionTitle>
        {draft.source === "claude" && (
          <span className="mb-2 rounded-full bg-rzp/10 px-2 py-0.5 text-[10px] font-semibold text-rzp-dark">
            Drafted by AI
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Buyer name">
          <input
            className={inputCls}
            value={draft.buyerName}
            placeholder="Not in chat"
            onChange={(e) => actions.updateDraft({ buyerName: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputCls}
            value={draft.buyerPhone}
            placeholder="Not in chat"
            onChange={(e) => actions.updateDraft({ buyerPhone: e.target.value })}
          />
        </Field>
      </div>

      {draft.lines.map((line) => (
        <Card key={line.id} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex overflow-hidden rounded-lg border border-navy/15 bg-white text-xs font-medium">
              {(["catalog", "custom"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(line, t)}
                  className={cn(
                    "px-3 py-1.5",
                    line.type === t ? "bg-navy text-white" : "text-navy/70",
                  )}
                >
                  {t === "catalog" ? "From catalog" : "Custom"}
                </button>
              ))}
            </div>
            <button
              onClick={() =>
                actions.updateDraft({ lines: draft.lines.filter((l) => l.id !== line.id) })
              }
              className="text-xs font-medium text-risk"
            >
              Remove
            </button>
          </div>

          {line.type === "catalog" ? (
            <select
              className={inputCls}
              value={line.catalogId}
              onChange={(e) => {
                const item = catalog.find((c) => c.id === e.target.value);
                if (!item) return;
                updateLine(line.id, {
                  catalogId: item.id,
                  name: item.name,
                  unitPrice: item.price,
                  weightKg: item.weightKg,
                });
              }}
            >
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} – {formatINR(c.price)}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-2">
              <input
                className={inputCls}
                value={line.name}
                placeholder="Item name"
                onChange={(e) => updateLine(line.id, { name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Price (₹)">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className={cn(
                      inputCls,
                      line.unitPrice == null && "border-warning ring-2 ring-warning/20",
                    )}
                    value={line.unitPrice ?? ""}
                    placeholder="Set price"
                    onChange={(e) =>
                      updateLine(line.id, {
                        unitPrice: Number(e.target.value) > 0 ? Number(e.target.value) : null,
                      })
                    }
                  />
                </Field>
                <Field label="Weight (kg)">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    className={inputCls}
                    value={line.weightKg}
                    onChange={(e) =>
                      updateLine(line.id, { weightKg: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </Field>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-navy/60">Qty</span>
              <div className="flex items-center rounded-lg border border-navy/15 bg-white">
                <button
                  className="h-8 w-8 text-lg text-navy/70"
                  onClick={() => updateLine(line.id, { qty: Math.max(1, line.qty - 1) })}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold text-navy">{line.qty}</span>
                <button
                  className="h-8 w-8 text-lg text-navy/70"
                  onClick={() => updateLine(line.id, { qty: line.qty + 1 })}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <input
                className="h-8 w-16 rounded-lg border border-navy/15 bg-white px-2 text-xs text-navy outline-none focus:border-rzp"
                placeholder="Size"
                value={line.size ?? ""}
                onChange={(e) => updateLine(line.id, { size: e.target.value || undefined })}
              />
            </div>
            <span className="text-sm font-semibold text-navy">
              {line.unitPrice ? formatINR(lineTotal(line)) : "—"}
            </span>
          </div>
        </Card>
      ))}

      <button
        onClick={() => {
          const first = catalog[0];
          if (!first) return;
          actions.updateDraft({
            lines: [
              ...draft.lines,
              {
                id: newLineId(),
                type: "catalog",
                catalogId: first.id,
                name: first.name,
                qty: 1,
                unitPrice: first.price,
                weightKg: first.weightKg,
              },
            ],
          });
        }}
        className="w-full rounded-xl border border-dashed border-navy/25 py-2.5 text-sm font-medium text-navy/70 hover:border-rzp hover:text-rzp"
      >
        + Add line
      </button>

      {draft.uncertain.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/8 px-3 py-2.5">
          <p className="mb-1 text-xs font-semibold text-[#b54708]">Check these</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-navy/80">
            {draft.uncertain.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ShareSheet({ orderId }: { orderId: string }) {
  const order = useStore((s) => s.orders.find((o) => o.id === orderId));
  const settings = useStore((s) => s.settings);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") actions.closeShareSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!order) return null;

  const total = buyerPrices(order.lines, order.discount, settings).prepaidTotal;
  const first = order.buyerName && order.buyerName !== "Buyer" ? order.buyerName.split(" ")[0] : "";
  const link = `rzp.io/ol/${order.linkCode}`;
  const message = `Hi${first ? " " + first : ""}, here is your order from ${SELLER.name}: ${formatINR(total)}. Confirm address and pay here: ${link}`;
  const openBuyer = { label: "Buyer view", onClick: () => actions.setView("buyer") };

  return (
    <div
      className="absolute inset-0 z-30 flex items-end bg-navy/40"
      onClick={() => actions.closeShareSheet()}
    >
      <div
        role="dialog"
        aria-label="Share order link"
        className="w-full rounded-t-3xl bg-white px-4 pb-6 pt-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-navy/15" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-navy">Share order link</h3>
            <p className="mb-3 text-xs text-navy/55">
              {order.id} · {link}
            </p>
          </div>
          <button
            onClick={() => actions.closeShareSheet()}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-navy/60 hover:bg-surface"
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
              actions.closeShareSheet();
              toast.success(`Sent to ${first || "the buyer"} on WhatsApp (simulated)`, {
                action: openBuyer,
              });
            }}
          >
            Share on WhatsApp
          </Btn>
          <Btn
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => {
              navigator.clipboard?.writeText(message).catch(() => undefined);
              actions.closeShareSheet();
              toast("Link copied", { action: openBuyer });
            }}
          >
            Copy link
          </Btn>
        </div>
      </div>
    </div>
  );
}
