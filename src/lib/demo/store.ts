/**
 * One in-memory store for the whole prototype, so the seller and buyer views always
 * show the same order instantly. "Reset demo" rebuilds it from the seed.
 */
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { isPlaceholderAddress, titleCaseName } from "./fallback";
import type { MessageKind } from "./messages";
import { buyerPrices, formatINR, orderTotal, orderValue } from "./money";
import { normalizePhone, scoreRisk, sellerVerdict } from "./risk";
import { DEFAULT_SETTINGS, SEED_CATALOG, buildSeedOrders } from "./seed";
import { AUTO_DELIVER_MS } from "./shipping";
import type {
  AddressResult,
  AiSource,
  BlockedPhone,
  CatalogItem,
  Courier,
  Discount,
  Order,
  OrderLine,
  RiskOutcome,
  RiskResult,
  Settings,
} from "./types";

export type SellerTab = "home" | "orders" | "summary" | "settings";

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
  paymentHint: "prepaid" | "cod" | "unknown";
  uncertain: string[];
};

export type BuyerStep = "order" | "address" | "checking" | "payment" | "checkout" | "done";

export type BuyerFlow = {
  orderId: string;
  step: BuyerStep;
  name: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  suggestion?: (AddressResult & { source: AiSource; forAddress: string }) | undefined;
  suggestionHandled: boolean;
  /** Computed when the buyer taps "Continue to payment"; decides which options they see. */
  risk?: RiskResult | undefined;
  checkout?: { amount: number; purpose: "prepaid" | "partial" } | undefined;
  paymentId?: string | undefined;
};

export type Sheet = { kind: MessageKind | "ship"; orderId: string };

export type State = {
  view: "seller" | "buyer";
  tab: SellerTab;
  screen: { kind: "tab" } | { kind: "new" } | { kind: "order"; id: string };
  settings: Settings;
  catalog: CatalogItem[];
  orders: Order[];
  draft: DraftState;
  /** The one bottom sheet open in the seller app (share/copy messages, ship order). */
  sheet: Sheet | null;
  /** The order the buyer link points at (latest link created). */
  linkOrderId: string | null;
  buyer: BuyerFlow | null;
  /** Phones the seller won't offer COD to (added when a parcel is returned). */
  codBlocked: BlockedPhone[];
  linksCreated: number;
  orderSeq: number;
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
    paymentHint: "unknown",
    uncertain: [],
  };
}

function initialState(aiAvailable = false): State {
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
    codBlocked: [],
    linksCreated: 0,
    orderSeq: 1064,
    aiAvailable,
  };
}

// ---------- persistence ----------
// The demo survives a page refresh; "Reset demo" clears it. Storage can be unavailable
// (private mode, blocked site data), so every access is guarded.

const STORAGE_KEY = "order-link-demo-v2";

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
  | "codBlocked"
  | "linksCreated"
  | "orderSeq"
>;

function loadPersisted(): State {
  const fresh = initialState();
  if (typeof window === "undefined") return fresh;
  try {
    window.localStorage.removeItem("order-link-demo-v1"); // older shape
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Partial<Persisted>;
    if (!Array.isArray(saved.orders) || !saved.settings) return fresh;
    const restored: State = {
      ...fresh,
      ...saved,
      settings: { ...fresh.settings, ...saved.settings },
      codBlocked: saved.codBlocked ?? [],
    };
    // Steps driven by timers can't resume after a reload; step back to where they started.
    if (restored.draft.status === "loading")
      restored.draft = { ...restored.draft, status: "editing" };
    if (restored.buyer?.step === "checking")
      restored.buyer = { ...restored.buyer, step: "address" };
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
    codBlocked: s.codBlocked,
    linksCreated: s.linksCreated,
    orderSeq: s.orderSeq,
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
  const p = normalizePhone(phone);
  if (!p) return undefined;
  return orders
    .filter(
      (o) => normalizePhone(o.buyerPhone) === p && o.address && !isPlaceholderAddress(o.address),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function now() {
  return new Date().toISOString();
}

// ---------- actions ----------

export const actions = {
  resetDemo() {
    clearPersisted();
    clearToasts();
    // Restores Balanced, ₹49 COD fee, free shipping, the seed orders and an empty COD-not-allowed list.
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
      uncertain: d.uncertain,
      timeline: [{ label: "Link sent", at: now() }],
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
        suggestionHandled: false,
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

  /** Score the order from the buyer's details; the payment screen shows only what this allows. */
  runRiskCheck(): RiskResult | null {
    const s = state;
    const b = s.buyer;
    const order = b && s.orders.find((o) => o.id === b.orderId);
    if (!b || !order) return null;
    const risk = scoreRisk({
      phone: b.phone,
      address: b.address,
      pincode: b.pincode,
      orderValue: orderValue(order.lines, order.discount),
      lines: order.lines,
      strictness: s.settings.strictness,
      pastOrders: s.orders,
      excludeOrderId: order.id,
      codBlockedPhones: s.codBlocked.map((c) => c.phone),
    });
    actions.updateBuyer({ risk });
    return risk;
  },

  /** Store the risk decision and the seller-facing verdict once the buyer has chosen. */
  recordOutcome(orderId: string, outcome: RiskOutcome) {
    const risk = state.buyer?.orderId === orderId ? state.buyer.risk : undefined;
    if (!risk) return;
    actions.updateOrder(orderId, {
      risk,
      verdict: sellerVerdict(risk, outcome, formatINR),
      verdictSource: "template",
    });
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
    actions.recordOutcome(orderId, purpose === "partial" ? "partial" : "prepaid");
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
    });
    actions.addTimeline(orderId, "COD confirmed");
    actions.recordOutcome(orderId, "cod");
  },

  // ---------- shipping & outcomes ----------

  /** Seller booked the parcel with their own courier. Opens the shipping-update share sheet. */
  shipOrder(orderId: string, courier: Courier, awb: string) {
    const tracking = awb.trim();
    actions.updateOrder(orderId, {
      status: "shipped",
      courier,
      awb: tracking || undefined,
      shippedAt: now(),
    });
    actions.addTimeline(
      orderId,
      `Shipped via ${courier}${tracking ? ` · tracking ${tracking}` : ""}`,
    );
    setState({ sheet: { kind: "ship_update", orderId } });
  },

  markDelivered(orderId: string, by: "seller" | "auto" | "upi") {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order || order.status !== "shipped") return;
    const online = order.paymentMode === "prepaid" || order.paymentMode === "partial";
    actions.updateOrder(orderId, {
      status: "delivered",
      deliveredBy: by,
      paymentVerified: online || by === "upi",
      // Cash collected at the door (or by UPI) settles the rest of a COD order.
      paidAmount: order.paymentMode === "prepaid" ? order.paidAmount : orderTotal(order),
    });
    if (by === "upi") actions.addTimeline(orderId, "Paid by UPI at the doorstep");
    actions.addTimeline(
      orderId,
      by === "seller"
        ? "Delivered (marked by you)"
        : by === "auto"
          ? "Delivered (auto-marked 10 days after shipping)"
          : "Delivered",
    );
  },

  /** Parcel came back. The buyer's number goes on the COD-not-allowed list. */
  markReturned(orderId: string) {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order || order.status !== "shipped") return;
    actions.updateOrder(orderId, { status: "refused" });
    actions.addTimeline(orderId, "Returned to seller");
    if (order.buyerPhone) actions.blockPhone(order.buyerPhone, order.buyerName);
  },

  /** Any order left in Shipped for 10 days is treated as delivered. */
  applyAutoDelivery() {
    const cutoff = Date.now() - AUTO_DELIVER_MS;
    for (const o of state.orders) {
      if (o.status === "shipped" && o.shippedAt && new Date(o.shippedAt).getTime() <= cutoff)
        actions.markDelivered(o.id, "auto");
    }
  },

  /** Demo shortcut: pretend 10 days have passed since this order shipped. */
  simulateTenDays(orderId: string) {
    actions.updateOrder(orderId, {
      shippedAt: new Date(Date.now() - AUTO_DELIVER_MS - 60_000).toISOString(),
    });
    actions.applyAutoDelivery();
  },

  blockPhone(phone: string, name: string) {
    setState((s) =>
      s.codBlocked.some((c) => normalizePhone(c.phone) === normalizePhone(phone))
        ? {}
        : { codBlocked: [...s.codBlocked, { phone, name, at: now() }] },
    );
  },
  unblockPhone(phone: string) {
    setState((s) => ({
      codBlocked: s.codBlocked.filter((c) => normalizePhone(c.phone) !== normalizePhone(phone)),
    }));
  },
};

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function newLineId() {
  return "l-" + Math.random().toString(36).slice(2, 9);
}
