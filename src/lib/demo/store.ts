/**
 * One in-memory store for the whole prototype, so the seller and buyer views always
 * show the same order instantly. "Reset demo" rebuilds it from the seed.
 */
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { codDecision, normalizePhone, samePhone } from "./cod";
import { isPlaceholderAddress, titleCaseName } from "./fallback";
import type { MessageKind } from "./messages";
import { buyerPrices, formatINR, orderTotal, orderValue } from "./money";
import {
  DEFAULT_SETTINGS,
  FIRST_DEMO_ORDER,
  SEED_CATALOG,
  buildSeedOrders,
  seedLists,
} from "./seed";
import type {
  AiSource,
  BuyerRef,
  CatalogItem,
  CodCheck,
  Discount,
  Order,
  OrderLine,
  Settings,
} from "./types";

export type SellerTab = "home" | "orders" | "buyers" | "record" | "settings";

export type DraftState = {
  chat: string;
  from?: { name: string; phone: string } | undefined;
  status: "editing" | "loading" | "drafted";
  source?: AiSource | undefined;
  lines: OrderLine[];
  discount: Discount;
  /** Shown under the discount when it was capped. */
  discountWarning?: string | null | undefined;
  buyerName: string;
  buyerPhone: string;
  addressText: string;
  pincode: string;
  /** The chat asked for "same/old address": fill it from this phone's last order. */
  useSavedAddress?: boolean | undefined;
  /** The seller decides whether COD is offered on this order. */
  codOffered: boolean;
  paymentHint: "prepaid" | "cod" | "unknown";
  uncertain: string[];
};

export type BuyerStep =
  "order" | "address" | "payment" | "checking" | "cod_outcome" | "checkout" | "done";

export type BuyerFlow = {
  orderId: string;
  step: BuyerStep;
  name: string;
  phone: string;
  address: string;
  /** The buyer typed or edited the address – don't replace it with a saved one. */
  addressEdited?: boolean | undefined;
  /** Set while the address is still the one prefilled from this phone's last order. */
  savedAddress?: string | undefined;
  pincode: string;
  city: string;
  /** The buyer typed the city themselves – never overwrite it from a lookup. */
  cityEdited?: boolean | undefined;
  state: string;
  checkout?: { amount: number; purpose: "prepaid" | "partial" } | undefined;
  paymentId?: string | undefined;
};

export type Sheet = { kind: MessageKind; orderId: string };

export type State = {
  view: "seller" | "buyer";
  tab: SellerTab;
  screen: { kind: "tab" } | { kind: "new" } | { kind: "order"; id: string };
  settings: Settings;
  catalog: CatalogItem[];
  orders: Order[];
  draft: DraftState;
  /** The one bottom sheet open in the seller app (share/copy a message to the buyer). */
  sheet: Sheet | null;
  /** The order the buyer link points at (latest link created). */
  linkOrderId: string | null;
  buyer: BuyerFlow | null;
  /** Buyers the seller always allows COD. */
  trusted: BuyerRef[];
  /** Buyers who only get prepaid. */
  blocked: BuyerRef[];
  linksCreated: number;
  orderSeq: number;
  /** When the seed orders' dates were last anchored to "now". */
  seededAt: number;
  aiAvailable: boolean;
};

export function emptyDraft(): DraftState {
  return {
    chat: "",
    status: "editing",
    lines: [],
    discount: null,
    discountWarning: null,
    buyerName: "",
    buyerPhone: "",
    addressText: "",
    pincode: "",
    useSavedAddress: false,
    codOffered: true,
    paymentHint: "unknown",
    uncertain: [],
  };
}

function initialState(aiAvailable = false): State {
  const lists = seedLists();
  return {
    view: "seller",
    tab: "home",
    screen: { kind: "tab" },
    settings: { ...DEFAULT_SETTINGS },
    catalog: SEED_CATALOG.map((c) => ({ ...c })),
    orders: buildSeedOrders(),
    draft: emptyDraft(),
    sheet: null,
    linkOrderId: null,
    buyer: null,
    trusted: lists.trusted,
    blocked: lists.blocked,
    linksCreated: 0,
    orderSeq: FIRST_DEMO_ORDER,
    seededAt: Date.now(),
    aiAvailable,
  };
}

// ---------- persistence ----------
// The demo survives a page refresh; "Reset demo" clears it. Storage can be unavailable
// (private mode, blocked site data), so every access is guarded.

const STORAGE_KEY = "chat-checkout-demo-v1";

type Persisted = Pick<
  State,
  | "view"
  | "tab"
  | "settings"
  | "catalog"
  | "orders"
  | "draft"
  | "linkOrderId"
  | "buyer"
  | "trusted"
  | "blocked"
  | "linksCreated"
  | "orderSeq"
  | "seededAt"
>;

const HOUR_MS = 60 * 60 * 1000;

function isSeedOrder(o: Order): boolean {
  return Number(o.id.replace(/\D/g, "")) < FIRST_DEMO_ORDER;
}

/**
 * Seed orders are dated relative to when the demo was seeded. When it's reopened days later,
 * shift them forward so they still look recent.
 */
export function rebaseSeed(
  orders: Order[],
  seededAt: number | undefined,
): { orders: Order[]; seededAt: number } {
  const now = Date.now();
  const seed = orders.filter(isSeedOrder);
  const anchor =
    seededAt ?? (seed.length ? Math.max(...seed.map((o) => new Date(o.createdAt).getTime())) : now);
  const delta = now - anchor;
  if (delta < HOUR_MS) return { orders, seededAt: anchor };
  const shift = (iso: string) => new Date(new Date(iso).getTime() + delta).toISOString();
  return {
    seededAt: now,
    orders: orders.map((o) =>
      isSeedOrder(o)
        ? {
            ...o,
            createdAt: shift(o.createdAt),
            timeline: o.timeline.map((t) => ({ ...t, at: shift(t.at) })),
          }
        : o,
    ),
  };
}

function loadPersisted(): State {
  const fresh = initialState();
  if (typeof window === "undefined") return fresh;
  try {
    // Older versions of the prototype used other keys and shapes.
    window.localStorage.removeItem("order-link-demo-v1");
    window.localStorage.removeItem("order-link-demo-v2");
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Partial<Persisted>;
    if (!Array.isArray(saved.orders) || !saved.settings) return fresh;
    const rebased = rebaseSeed(saved.orders, saved.seededAt);
    const restored: State = {
      ...fresh,
      ...saved,
      orders: rebased.orders,
      seededAt: rebased.seededAt,
      settings: { ...fresh.settings, ...saved.settings },
      trusted: saved.trusted ?? fresh.trusted,
      blocked: saved.blocked ?? fresh.blocked,
    };
    // Steps driven by timers can't resume after a reload; step back to where they started.
    if (restored.draft.status === "loading")
      restored.draft = { ...restored.draft, status: "editing" };
    if (restored.buyer?.step === "checking")
      restored.buyer = { ...restored.buyer, step: "payment" };
    return restored;
  } catch {
    return fresh;
  }
}

function persist(s: State) {
  if (typeof window === "undefined") return;
  const data: Persisted = {
    view: s.view,
    tab: s.tab,
    settings: s.settings,
    catalog: s.catalog,
    orders: s.orders,
    draft: s.draft,
    linkOrderId: s.linkOrderId,
    buyer: s.buyer,
    trusted: s.trusted,
    blocked: s.blocked,
    linksCreated: s.linksCreated,
    orderSeq: s.orderSeq,
    seededAt: s.seededAt,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked – the demo still works in memory.
  }
}

function clearPersisted() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

let state: State = loadPersisted();
const listeners = new Set<() => void>();

function emit() {
  persist(state);
  for (const l of listeners) l();
}

export function getState(): State {
  return state;
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  emit();
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(state),
  );
}

/** Toasts belong to the screen that raised them. */
function clearToasts() {
  toast.dismiss();
}

/** Most recent past order from this phone that has a full address. */
export function lastAddressFor(phone: string, orders: Order[]): Order | undefined {
  if (!normalizePhone(phone)) return undefined;
  return orders
    .filter((o) => samePhone(o.buyerPhone, phone) && o.address && !isPlaceholderAddress(o.address))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** What the COD rules say for this order right now. */
export function codCheckFor(
  s: Pick<State, "orders" | "trusted" | "blocked">,
  order: Order,
): CodCheck {
  return codDecision({
    phone: order.buyerPhone,
    orderValue: orderValue(order.lines, order.discount),
    codOffered: order.codOffered,
    override: order.override,
    trusted: s.trusted,
    blocked: s.blocked,
    pastOrders: s.orders,
    excludeOrderId: order.id,
  });
}

function now() {
  return new Date().toISOString();
}

// ---------- actions ----------

export const actions = {
  resetDemo() {
    clearPersisted();
    clearToasts();
    // Restores the seed orders, the Trusted and Blocked lists, the ₹49 COD fee and free shipping.
    state = initialState(state.aiAvailable);
    emit();
  },
  setAiAvailable(aiAvailable: boolean) {
    setState({ aiAvailable });
  },
  setView(view: State["view"]) {
    clearToasts();
    // Switching phones always closes any sheet; after the link sheet, land on the order book.
    setState((s) =>
      s.sheet?.kind === "link"
        ? { view, sheet: null, tab: "orders", screen: { kind: "tab" } }
        : { view, sheet: null },
    );
  },
  openSheet(kind: Sheet["kind"], orderId: string) {
    clearToasts();
    setState({ sheet: { kind, orderId } });
  },
  closeSheet() {
    setState((s) =>
      s.sheet?.kind === "link"
        ? { sheet: null, tab: "orders", screen: { kind: "tab" } }
        : { sheet: null },
    );
  },
  setTab(tab: SellerTab) {
    clearToasts();
    setState({ tab, screen: { kind: "tab" }, sheet: null });
  },
  openNewOrder() {
    clearToasts();
    setState({ screen: { kind: "new" }, draft: emptyDraft(), sheet: null });
  },
  openOrder(id: string) {
    clearToasts();
    setState({ screen: { kind: "order", id }, sheet: null });
  },
  back() {
    clearToasts();
    setState({ screen: { kind: "tab" }, sheet: null });
  },
  updateDraft(patch: Partial<DraftState>) {
    setState((s) => ({ draft: { ...s.draft, ...patch } }));
  },
  updateSettings(patch: Partial<Settings>) {
    setState((s) => ({ settings: { ...s.settings, ...patch } }));
  },
  addCatalogItem(item: Omit<CatalogItem, "id">) {
    const id = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36);
    setState((s) => ({ catalog: [...s.catalog, { ...item, id }] }));
  },
  updateOrder(id: string, patch: Partial<Order> | ((o: Order) => Partial<Order>)) {
    setState((s) => ({
      orders: s.orders.map((o) =>
        o.id === id ? { ...o, ...(typeof patch === "function" ? patch(o) : patch) } : o,
      ),
    }));
  },
  addTimeline(id: string, label: string) {
    actions.updateOrder(id, (o) => ({ timeline: [...o.timeline, { label, at: now() }] }));
  },

  /** Turn the confirmed draft into an order + link, and open the share sheet. */
  createLink(): Order {
    const s = state;
    const d = s.draft;
    const linkCode = s.linksCreated === 0 ? "AB12CD" : randomCode();
    const phone = d.buyerPhone.trim();
    let address = isPlaceholderAddress(d.addressText) ? "" : d.addressText.trim();
    let pincode = d.pincode.trim();
    let addressSource: Order["addressSource"];
    if (d.useSavedAddress && !address) {
      const last = lastAddressFor(phone, s.orders);
      if (last?.address) {
        address = last.address;
        pincode = last.pincode ?? pincode;
        addressSource = "last_order";
      }
    }
    const order: Order = {
      id: `ORD-${s.orderSeq}`,
      linkCode,
      createdAt: now(),
      buyerName: titleCaseName(d.buyerName) || "Buyer",
      buyerPhone: phone,
      address: address || undefined,
      pincode: pincode || undefined,
      addressSource,
      lines: d.lines.map((l) => ({ ...l })),
      discount: d.discount,
      status: "awaiting_payment",
      paymentMode: "pending",
      paidAmount: 0,
      codFee: 0,
      shippingCharged: 0,
      codOffered: d.codOffered,
      uncertain: d.uncertain,
      timeline: [{ label: "Link created", at: now() }],
    };
    clearToasts();
    setState({
      orders: [order, ...s.orders],
      linksCreated: s.linksCreated + 1,
      orderSeq: s.orderSeq + 1,
      sheet: { kind: "link", orderId: order.id },
      linkOrderId: order.id,
      buyer: {
        orderId: order.id,
        step: "order",
        name: order.buyerName === "Buyer" ? "" : order.buyerName,
        phone: order.buyerPhone,
        address: order.address ?? "",
        pincode: order.pincode ?? "",
        city: "",
        state: "",
      },
    });
    return order;
  },

  updateBuyer(patch: Partial<BuyerFlow>) {
    setState((s) => (s.buyer ? { buyer: { ...s.buyer, ...patch } } : {}));
  },

  /** Record the buyer's confirmed delivery details on the order. */
  saveBuyerDetails() {
    const b = state.buyer;
    if (!b) return;
    actions.updateOrder(b.orderId, (o) => ({
      buyerName: titleCaseName(b.name) || "Buyer",
      buyerPhone: b.phone.trim(),
      address: b.address.trim(),
      pincode: b.pincode.trim(),
      city: b.city.trim() || undefined,
      state: b.state.trim() || undefined,
      // Keep the "from last order" note only while the buyer left that address unchanged.
      addressSource:
        o.addressSource === "last_order" && o.address === b.address.trim()
          ? "last_order"
          : undefined,
    }));
  },

  /** Online payment succeeded in the mock checkout. */
  completePayment(orderId: string, purpose: "prepaid" | "partial", amount: number) {
    const s = state;
    const order = s.orders.find((o) => o.id === orderId);
    if (!order) return;
    const prices = buyerPrices(order.lines, order.discount, s.settings);
    if (purpose === "partial") {
      actions.updateOrder(orderId, {
        status: "partial_paid",
        paymentMode: "partial",
        paidAmount: amount,
        codFee: prices.codFee,
        shippingCharged: prices.codShipping,
        codCheck: codCheckFor(s, order),
      });
      actions.addTimeline(orderId, `Part paid (${formatINR(amount)}), rest on delivery`);
    } else {
      actions.updateOrder(orderId, {
        status: "paid",
        paymentMode: "prepaid",
        paidAmount: amount,
        codFee: 0,
        shippingCharged: prices.prepaidShipping,
      });
      actions.addTimeline(orderId, "Paid");
    }
  },

  confirmCod(orderId: string) {
    const s = state;
    const order = s.orders.find((o) => o.id === orderId);
    if (!order) return;
    const prices = buyerPrices(order.lines, order.discount, s.settings);
    actions.updateOrder(orderId, {
      status: "cod_confirmed",
      paymentMode: "cod",
      paidAmount: 0,
      codFee: prices.codFee,
      shippingCharged: prices.codShipping,
      codCheck: codCheckFor(s, order),
    });
    actions.addTimeline(orderId, "COD confirmed");
  },

  // ---------- seller decisions ----------

  /** "Allow COD anyway": the seller overrides the COD rules for this one order. */
  allowCodAnyway(orderId: string) {
    actions.updateOrder(orderId, { override: true });
    actions.addTimeline(orderId, "You allowed COD (override)");
  },

  /** The seller marks the parcel Delivered by hand. */
  markDelivered(orderId: string) {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order || !["paid", "cod_confirmed", "partial_paid"].includes(order.status)) return;
    actions.updateOrder(orderId, {
      status: "delivered",
      // Cash collected on delivery settles the rest of a COD order.
      paidAmount: order.paymentMode === "prepaid" ? order.paidAmount : orderTotal(order),
    });
    actions.addTimeline(orderId, "Delivered");
  },

  /** The seller marks the parcel Returned by hand. */
  markReturned(orderId: string) {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order || !["paid", "cod_confirmed", "partial_paid"].includes(order.status)) return;
    actions.updateOrder(orderId, { status: "returned" });
    actions.addTimeline(orderId, "Returned to seller");
  },

  /** Add to Trusted (and take off Blocked). Trusted buyers are always allowed COD. */
  trustBuyer(phone: string, name: string) {
    setState((s) => ({
      trusted: s.trusted.some((b) => samePhone(b.phone, phone))
        ? s.trusted
        : [...s.trusted, { phone, name, at: now() }],
      blocked: s.blocked.filter((b) => !samePhone(b.phone, phone)),
    }));
  },
  untrustBuyer(phone: string) {
    setState((s) => ({ trusted: s.trusted.filter((b) => !samePhone(b.phone, phone)) }));
  },
  unblockBuyer(phone: string) {
    setState((s) => ({ blocked: s.blocked.filter((b) => !samePhone(b.phone, phone)) }));
  },
};

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function newLineId() {
  return "l-" + Math.random().toString(36).slice(2, 9);
}
