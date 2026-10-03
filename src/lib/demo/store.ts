/**
 * One in-memory store for the whole prototype, so the seller and buyer views always
 * show the same order instantly. "Reset demo" rebuilds it from the seed.
 */
import { useSyncExternalStore } from "react";

import { buyerPrices } from "./money";
import { DEFAULT_SETTINGS, SEED_CATALOG, buildSeedOrders } from "./seed";
import type {
  AddressResult,
  AiSource,
  CatalogItem,
  Discount,
  Order,
  OrderLine,
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
  buyerName: string;
  buyerPhone: string;
  addressText: string;
  pincode: string;
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
  pincode: string;
  suggestion?: AddressResult & { source: AiSource; forAddress: string };
  suggestionHandled: boolean;
  risk?: RiskResult;
  checkout?: { amount: number; purpose: "prepaid" | "partial" | "prepaid_after_risk" };
  paymentId?: string;
};

export type State = {
  view: "seller" | "buyer";
  tab: SellerTab;
  screen: { kind: "tab" } | { kind: "new" } | { kind: "order"; id: string };
  settings: Settings;
  catalog: CatalogItem[];
  orders: Order[];
  draft: DraftState;
  shareOrderId: string | null;
  /** The order the buyer link points at (latest link created). */
  linkOrderId: string | null;
  buyer: BuyerFlow | null;
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
    buyerName: "",
    buyerPhone: "",
    addressText: "",
    pincode: "",
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
    shareOrderId: null,
    linkOrderId: null,
    buyer: null,
    linksCreated: 0,
    orderSeq: 1064,
    aiAvailable,
  };
}

let state: State = initialState();
const listeners = new Set<() => void>();

function emit() {
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

// ---------- actions ----------

export const actions = {
  resetDemo() {
    state = initialState(state.aiAvailable);
    emit();
  },
  setAiAvailable(aiAvailable: boolean) {
    setState({ aiAvailable });
  },
  setView(view: State["view"]) {
    setState({ view });
  },
  setTab(tab: SellerTab) {
    setState({ tab, screen: { kind: "tab" } });
  },
  openNewOrder() {
    setState({ screen: { kind: "new" }, draft: emptyDraft(), shareOrderId: null });
  },
  openOrder(id: string) {
    setState({ screen: { kind: "order", id } });
  },
  back() {
    setState({ screen: { kind: "tab" } });
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
    actions.updateOrder(id, (o) => ({
      timeline: [...o.timeline, { label, at: new Date().toISOString() }],
    }));
  },

  /** Turn the confirmed draft into an order + link. */
  createLink(): Order {
    const s = state;
    const d = s.draft;
    const linkCode = s.linksCreated === 0 ? "AB12CD" : randomCode();
    const order: Order = {
      id: `ORD-${s.orderSeq}`,
      linkCode,
      createdAt: new Date().toISOString(),
      buyerName: d.buyerName.trim() || "Buyer",
      buyerPhone: d.buyerPhone.trim(),
      address: d.addressText.trim() || undefined,
      pincode: d.pincode.trim() || undefined,
      lines: d.lines.map((l) => ({ ...l })),
      discount: d.discount,
      status: "awaiting_payment",
      paymentMode: "pending",
      paidAmount: 0,
      codFee: 0,
      shippingCharged: 0,
      uncertain: d.uncertain,
      timeline: [{ label: "Link sent", at: new Date().toISOString() }],
    };
    setState({
      orders: [order, ...s.orders],
      linksCreated: s.linksCreated + 1,
      orderSeq: s.orderSeq + 1,
      shareOrderId: order.id,
      linkOrderId: order.id,
      buyer: {
        orderId: order.id,
        step: "order",
        name: order.buyerName === "Buyer" ? "" : order.buyerName,
        phone: order.buyerPhone,
        address: order.address ?? "",
        pincode: order.pincode ?? "",
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
    actions.updateOrder(b.orderId, {
      buyerName: b.name.trim() || "Buyer",
      buyerPhone: b.phone.trim(),
      address: b.address.trim(),
      pincode: b.pincode.trim(),
    });
  },

  /** Online payment succeeded in the mock checkout. */
  completePayment(
    orderId: string,
    purpose: "prepaid" | "partial" | "prepaid_after_risk",
    amount: number,
  ) {
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
      actions.addTimeline(
        orderId,
        `Part paid (${"₹" + amount.toLocaleString("en-IN")}), rest on delivery`,
      );
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
    });
    actions.addTimeline(orderId, "COD confirmed");
  },
};

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function newLineId() {
  return "l-" + Math.random().toString(36).slice(2, 9);
}
