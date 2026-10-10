import { useState } from "react";

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
import { SIZE_FLAG, draftFlags, groundedSize, needsSize } from "@/lib/demo/draftChecks";
import {
  SAMPLES,
  fallbackDraft,
  isPlaceholderAddress,
  titleCaseName,
  wantsSavedAddress,
} from "@/lib/demo/fallback";
import {
  buyerPrices,
  capDiscount,
  discountAmount,
  formatINR,
  isLineComplete,
  lineTotal,
  subtotal,
  totalWeight,
} from "@/lib/demo/money";
import { actions, getState, lastAddressFor, newLineId, useStore } from "@/lib/demo/store";
import { withTimeout } from "@/lib/demo/timeout";
import type { CatalogItem, DraftResult, OrderLine } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

const MIN_LOADING_MS = 1000;

function toLines(draft: DraftResult, catalog: CatalogItem[], message: string): OrderLine[] {
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
        size: groundedSize(l.size, message),
      };
    }
    return {
      id: newLineId(),
      type: "custom",
      name: l.name ?? "",
      qty: Math.max(1, Number(l.qty) || 1),
      unitPrice: typeof l.unit_price === "number" && l.unit_price > 0 ? l.unit_price : null,
      weightKg: typeof l.weight_kg === "number" && l.weight_kg > 0 ? l.weight_kg : 0.3,
      size: groundedSize(l.size, message),
    };
  });
}

export function NewOrder() {
  const draft = useStore((s) => s.draft);
  const catalog = useStore((s) => s.catalog);
  const settings = useStore((s) => s.settings);
  // "Use a sample message" cycles through the samples; this is the next one to load.
  const [nextSample, setNextSample] = useState(0);
  const [sampleNote, setSampleNote] = useState<string | null>(null);

  function loadSample() {
    const index = nextSample % SAMPLES.length;
    const sample = SAMPLES[index]!;
    actions.updateDraft({
      chat: sample.chat,
      from: sample.from,
      status: "editing",
      lines: [],
      uncertain: [],
    });
    setSampleNote(`Sample ${index + 1} of ${SAMPLES.length}: ${sample.label}`);
    setNextSample(index + 1);
    void runDraft();
  }

  /** Bring the drafted order, with its flags, into view once it appears. */
  function showDraft() {
    setTimeout(
      () => document.getElementById("draft-order")?.scrollIntoView({ block: "start" }),
      60,
    );
  }

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
    const lines = toLines(r, cat, d.chat);
    const phone = r.buyer_phone ?? d.from?.phone ?? "";
    const uncertain = [...(r.uncertain ?? [])];

    // "Same/old address" is a reference, not an address: look it up from this number's last order.
    const placeholder = isPlaceholderAddress(r.address_text);
    const wantsSaved = placeholder || (!r.address_text && wantsSavedAddress(d.chat));
    const saved = wantsSaved ? lastAddressFor(phone, getState().orders) : undefined;
    if (wantsSaved)
      uncertain.push(
        saved
          ? `Buyer asked for the same address as last time – using the address from ${saved.id}`
          : "Buyer asked for their old address, but this number has no past order – ask for it",
      );

    // Custom lines need a weight for shipping; flag any the message didn't state.
    r.lines.forEach((l, i) => {
      if (lines[i]?.type === "custom" && !(typeof l.weight_kg === "number" && l.weight_kg > 0))
        uncertain.push(`Check weight: ${lines[i]!.name || "custom item"}`);
    });

    const capped = capDiscount(lines, r.discount && r.discount.value ? r.discount : null);
    const address = placeholder ? "" : (r.address_text ?? "");
    actions.updateDraft({
      status: "drafted",
      source: result.source,
      lines,
      discount: capped.discount,
      discountWarning: capped.warning,
      buyerName: titleCaseName(r.buyer_name ?? d.from?.name ?? ""),
      buyerPhone: phone,
      addressText: address,
      pincode: r.pincode ?? address.match(/\b[1-9]\d{5}\b/)?.[0] ?? "",
      useSavedAddress: wantsSaved,
      // Custom items need payment upfront by default; the seller can change it below.
      codOffered: !lines.some((l) => l.type === "custom"),
      paymentHint: r.payment_hint ?? "unknown",
      uncertain,
    });
    showDraft();
  }

  const lines = draft.lines;
  const prices = buyerPrices(lines, draft.discount, settings);
  const allComplete = lines.length > 0 && lines.every(isLineComplete);
  const canCreate = allComplete && prices.prepaidTotal > 0;

  return (
    <div className="pb-8">
      <ScreenHeader title="New order" onBack={actions.back} />
      <div className="space-y-5 px-4 pt-4">
        <section>
          <Field label="Paste the buyer's order message">
            <textarea
              value={draft.chat}
              onChange={(e) => actions.updateDraft({ chat: e.target.value, from: undefined })}
              rows={4}
              placeholder="e.g. want the green saree, cod pls, address: …"
              className={cn(inputCls, "resize-none leading-relaxed")}
            />
          </Field>
          <div className="mt-2 flex items-center gap-2">
            <Btn
              size="sm"
              variant="secondary"
              disabled={draft.status === "loading"}
              onClick={loadSample}
            >
              Use a sample message
            </Btn>
            {sampleNote && <span className="text-[11px] text-navy/50">{sampleNote}</span>}
          </div>
          {draft.from && (
            <p className="mt-2 text-xs text-navy/55">
              Order message from <span className="font-medium text-navy">{draft.from.name}</span>
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
                <Spinner /> Reading the message…
              </>
            ) : (
              <>✨ Draft with AI</>
            )}
          </Btn>
          {draft.status === "editing" && (
            <button
              className="mt-2 w-full text-center text-sm font-medium text-rzp underline-offset-2 hover:underline"
              onClick={() => {
                actions.startBlankDraft();
                showDraft();
              }}
            >
              Or build the order yourself
            </button>
          )}
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

            <Card className="space-y-2 bg-white ring-1 ring-navy/10">
              <p className="text-sm font-semibold text-navy">Payment options</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { offered: true, label: "Pay now + COD" },
                  { offered: false, label: "Pay now only" },
                ].map((o) => (
                  <button
                    key={o.label}
                    onClick={() => actions.updateDraft({ codOffered: o.offered })}
                    className={cn(
                      "rounded-xl border-2 px-3 py-2.5 text-sm font-medium",
                      draft.codOffered === o.offered
                        ? "border-rzp bg-rzp/8 text-navy"
                        : "border-navy/12 text-navy/60",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-navy/50">
                You decide what the buyer can choose. If COD is on, your COD rules still apply when
                they pick it.
              </p>
            </Card>

            <p className="rounded-xl bg-rzp/8 px-3 py-2.5 text-xs leading-relaxed text-navy/75">
              {draft.source === undefined
                ? "You built this order. Check it before sending."
                : "AI drafted this from the message. Check it before sending – you stay in charge of the conversation."}
            </p>

            <Btn
              size="lg"
              className="w-full"
              disabled={!canCreate}
              onClick={() => actions.createLink()}
            >
              Create payment link
            </Btn>
            {!canCreate && (
              <p className="-mt-3 text-center text-xs text-[#b54708]">
                {lines.length === 0
                  ? "Add at least one item first."
                  : allComplete
                    ? "The total can't be ₹0 – lower the discount."
                    : "Set a price and name for every line first."}
              </p>
            )}
          </>
        )}
      </div>
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
  const warning = useStore((s) => s.draft.discountWarning);
  const lines = useStore((s) => s.draft.lines);
  const type = discount?.type ?? "flat";

  function setDiscount(next: { type: "flat" | "percent"; value: number }) {
    const capped = capDiscount(lines, next.value > 0 ? next : null);
    actions.updateDraft({
      // Keep the chosen ₹/% type even at 0 so the toggle doesn't jump back.
      discount: capped.discount ?? (next.value > 0 ? null : { type: next.type, value: 0 }),
      discountWarning: capped.warning,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-navy/65">Discount</span>
        <div className="flex items-center gap-1.5">
          <div className="flex overflow-hidden rounded-lg border border-navy/15 text-xs">
            {(["flat", "percent"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDiscount({ type: t, value: discount?.value ?? 0 })}
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
            value={discount?.value || ""}
            placeholder="0"
            onChange={(e) => setDiscount({ type, value: Math.max(0, Number(e.target.value) || 0) })}
            className="w-16 rounded-lg border border-navy/15 px-2 py-1 text-right text-sm text-navy outline-none focus:border-rzp"
          />
          <span className="w-14 text-right font-medium text-navy">
            {discountAmount(lines, discount)
              ? "−" + formatINR(discountAmount(lines, discount))
              : "₹0"}
          </span>
        </div>
      </div>
      {warning && (
        <p className="mt-1 text-right text-[11px] font-medium text-[#b54708]">{warning}</p>
      )}
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
  // Built by hand (no AI call) when there is no draft source.
  const manual = draft.source === undefined;
  const flags = draftFlags(draft.lines, draft.uncertain, catalog);

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
    <section id="draft-order" className="scroll-mt-16 space-y-4">
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
            placeholder={manual ? "Buyer name" : "Not in the message"}
            onChange={(e) => actions.updateDraft({ buyerName: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputCls}
            value={draft.buyerPhone}
            placeholder={manual ? "Mobile number" : "Not in the message"}
            onChange={(e) => actions.updateDraft({ buyerPhone: e.target.value })}
          />
        </Field>
      </div>

      {flags.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/8 px-3 py-2.5">
          <p className="mb-1 text-xs font-semibold text-[#b54708]">Check these</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-navy/80">
            {flags.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      {draft.lines.length === 0 && (
        <p className="rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-xs text-navy/55">
          Add the items the buyer ordered.
        </p>
      )}

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
              className="text-xs font-medium text-danger"
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
                className={cn(
                  "h-8 w-16 rounded-lg border border-navy/15 bg-white px-2 text-xs text-navy outline-none focus:border-rzp",
                  needsSize(line, catalog) && "border-warning ring-2 ring-warning/20",
                )}
                placeholder="Size"
                value={line.size ?? ""}
                onChange={(e) => updateLine(line.id, { size: e.target.value || undefined })}
              />
            </div>
            <span className="text-sm font-semibold text-navy">
              {line.unitPrice ? formatINR(lineTotal(line)) : "—"}
            </span>
          </div>
          {needsSize(line, catalog) && (
            <p className="rounded-lg bg-warning/12 px-2.5 py-1.5 text-xs font-medium text-[#b54708]">
              ⚠ {SIZE_FLAG}
            </p>
          )}
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
    </section>
  );
}
