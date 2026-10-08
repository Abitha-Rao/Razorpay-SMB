import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Btn, Card, Field, ScreenHeader, SectionTitle, inputCls } from "@/components/demo/ui";
import { formatINR } from "@/lib/demo/money";
import { actions, useStore } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

const COD_RULES = [
  "Trusted buyers are always allowed COD.",
  "Blocked buyers can only pay now.",
  "A buyer whose earlier parcel was returned pays a small part now to confirm COD.",
  "Everyone else is allowed COD, with a nudge to pay now.",
  "You can allow COD anyway on any order.",
];

export function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const catalog = useStore((s) => s.catalog);
  const aiAvailable = useStore((s) => s.aiAvailable);
  const [adding, setAdding] = useState(false);
  const [item, setItem] = useState({ name: "", price: "", weight: "" });

  return (
    <div className="pb-8">
      <ScreenHeader title="Settings" />
      <div className="space-y-6 px-4 pt-4">
        <section>
          <SectionTitle>COD rules</SectionTitle>
          <Card>
            <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-navy/75">
              {COD_RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </Card>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Field label="COD fee (₹)">
            <input
              type="number"
              min={0}
              className={inputCls}
              value={settings.codFee}
              onChange={(e) =>
                actions.updateSettings({ codFee: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </Field>
          <Field label="Prepaid offer">
            <select
              className={inputCls}
              value={settings.prepaidOffer}
              onChange={(e) =>
                actions.updateSettings({ prepaidOffer: e.target.value as "free_shipping" | "none" })
              }
            >
              <option value="free_shipping">Free shipping</option>
              <option value="none">No offer</option>
            </select>
          </Field>
        </section>

        <section className="space-y-2">
          <Toggle
            label="Show my track record to buyers"
            sub="Buyers see your paid & delivered orders and return rate on your payment link."
            checked={settings.showTrackRecord}
            onChange={(v) => actions.updateSettings({ showTrackRecord: v })}
          />
          <Toggle
            label="Use live AI (Claude)"
            badge={
              aiAvailable ? (
                <span className="rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-semibold text-[#027a48]">
                  Connected
                </span>
              ) : (
                <span className="rounded-full bg-navy/8 px-2 py-0.5 text-[10px] font-semibold text-navy/55">
                  Not connected
                </span>
              )
            }
            sub={
              aiAvailable
                ? "Claude Haiku drafts orders from the buyer's chat."
                : "Add ANTHROPIC_API_KEY as a server secret to turn this on."
            }
            checked={settings.useLiveAi && aiAvailable}
            disabled={!aiAvailable}
            onChange={(v) => actions.updateSettings({ useLiveAi: v })}
          />
        </section>

        <section>
          <SectionTitle
            action={
              <button
                className="mb-2 text-xs font-semibold text-rzp"
                onClick={() => setAdding((a) => !a)}
              >
                {adding ? "Cancel" : "+ Add item"}
              </button>
            }
          >
            Catalog
          </SectionTitle>
          {adding && (
            <Card className="mb-3 space-y-2">
              <input
                className={inputCls}
                placeholder="Item name"
                value={item.name}
                onChange={(e) => setItem({ ...item, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputCls}
                  type="number"
                  placeholder="Price ₹"
                  value={item.price}
                  onChange={(e) => setItem({ ...item, price: e.target.value })}
                />
                <input
                  className={inputCls}
                  type="number"
                  step={0.1}
                  placeholder="Weight kg"
                  value={item.weight}
                  onChange={(e) => setItem({ ...item, weight: e.target.value })}
                />
              </div>
              <Btn
                className="w-full"
                disabled={!item.name.trim() || !(Number(item.price) > 0)}
                onClick={() => {
                  actions.addCatalogItem({
                    name: item.name.trim(),
                    price: Number(item.price),
                    weightKg: Number(item.weight) || 0.3,
                  });
                  setItem({ name: "", price: "", weight: "" });
                  setAdding(false);
                  toast.success("Added to catalog");
                }}
              >
                Save item
              </Btn>
            </Card>
          )}
          <ul className="divide-y divide-navy/8 rounded-2xl bg-surface px-3">
            {catalog.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-navy">{c.name}</p>
                  <p className="text-[11px] text-navy/50">{c.weightKg} kg</p>
                </div>
                <span className="text-sm font-semibold text-navy">{formatINR(c.price)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Toggle({
  label,
  badge,
  sub,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  badge?: ReactNode;
  sub: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface p-3 text-left disabled:opacity-60"
      role="switch"
      aria-checked={checked}
    >
      <span>
        <span className="flex items-center gap-2 text-sm font-medium text-navy">
          {label}
          {badge}
        </span>
        <span className="block text-xs text-navy/55">{sub}</span>
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-rzp" : "bg-navy/20",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
