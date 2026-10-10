/**
 * One in-memory store for the whole prototype, so the seller and buyer views always
 * show the same order instantly. "Reset" rebuilds it from the seed.
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
  seedAddressBook,
  seedLists,
} from "./seed";
import type {
  AddressLabel,
  AiSource,
  BuyerRef,
  CatalogItem,
  CodCheck,
  Discount,
  Order,
  OrderLine,
  PayMethod,
  SavedAddress,
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

/** Mobile number → OTP → (new number: address) → checkout → paying → done. */
export type BuyerStep = "mobile" | "otp" | "address" | "main" | "paying" | "done";

/** The delivery address chosen for this order. */
export type SelectedAddress = {
  id?: string | undefined;
  label?: AddressLabel | undefined;
  name: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
};

export type BuyerFlow = {
  orderId: string;
  step: BuyerStep;
  /** The buyer's mobile number, digits only. */
  phone: string;
  otp: string;
  /** This number has a saved address. */
  returning: boolean;
  address?: SelectedAddress | undefined;
  paying?:
    { purpose: "prepaid" | "partial"; amount: number; method: PayMethod; app: string } | undefined;
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
  /** Addresses buyers saved against their mobile number. */
  addressBook: SavedAddress[];
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
    addressBook: seedAddressBook(),
    linksCreated: 0,
    orderSeq: FIRST_DEMO_ORDER,
    seededAt: Date.now(),
    aiAvailable,
  };
}

// ---------- persistence ----------
// The state survives a page refresh; "Reset" clears it. Storage can be unavailable
// (private mode, blocked site data), so every access is guarded.

const STORAGE_KEY = "chat-checkout-v2";

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
  | "addressBook"
  | "linksCreated"
  | "orderSeq"
  | "seededAt"
>;

const HOUR_MS = 60 * 60 * 1000;

function isSeedOrder(o: Order): boolean {
  return Number(o.id.replace(/\D/g, "")) < FIRST_DEMO_ORDER;
}

/**
 * Seed orders are dated relative to when the data was seeded. When it's reopened days later,
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
    // Older versions used other keys and shapes.
    for (const old of ["order-link-demo-v1", "order-link-demo-v2", "chat-checkout-demo-v1"])
      window.localStorage.removeItem(old);
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
      addressBook: saved.addressBook ?? fresh.addressBook,
    };
    // Steps driven by timers can't resume after a reload; step back to where they started.
    if (restored.draft.status === "loading")
      restored.draft = { ...restored.draft, status: "editing" };
    if (restored.buyer?.step === "paying")
      restored.buyer = { ...restored.buyer, step: "main", paying: undefined };
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
    addressBook: s.addressBook,
    linksCreated: s.linksCreated,
    orderSeq: s.orderSeq,
    seededAt: s.seededAt,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked – everything still works in memory.
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

/** Saved addresses for a mobile number, newest saved last. */
export function savedAddressesFor(phone: string, book: SavedAddress[]): SavedAddress[] {
  return book.filter((a) => samePhone(a.phone, phone));
}

function toSelected(a: SavedAddress): SelectedAddress {
  return {
    id: a.id,
    label: a.label,
    name: a.name,
    address: a.address,
    pincode: a.pincode,
    city: a.city,
    state: a.state,
  };
}

function now() {
  return new Date().toISOString();
}

// ---------- actions ----------

export const actions = {
  resetDemo() {
    clearPersisted();
    clearToasts();
    // Restores the seed orders, the Trusted and Blocked lists, the address book, the ₹49 COD fee and free shipping.
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
  /** "Or build the order yourself": the same draft form, blank, with no AI call. */
  startBlankDraft() {
    setState((s) => ({ draft: { ...emptyDraft(), chat: s.draft.chat, status: "drafted" } }));
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
    // The buyer starts at the mobile number step; prefill it when the chat had a full number.
    const digits = phone.replace(/\D/g, "");
    clearToasts();
    setState({
      orders: [order, ...s.orders],
      linksCreated: s.linksCreated + 1,
      orderSeq: s.orderSeq + 1,
      sheet: { kind: "link", orderId: order.id },
      linkOrderId: order.id,
      buyer: {
        orderId: order.id,
        step: "mobile",
        phone: /^[6-9]\d{9}$/.test(digits) ? digits : "",
        otp: "",
        returning: false,
      },
    });
    return order;
  },

  updateBuyer(patch: Partial<BuyerFlow>) {
    setState((s) => (s.buyer ? { buyer: { ...s.buyer, ...patch } } : {}));
  },

  // ---------- buyer checkout ----------

  /**
   * After the OTP: a number with a saved address loads it and goes to checkout;
   * a new number is asked for an address first.
   */
  verifyOtp() {
    const s = state;
    const b = s.buyer;
    if (!b) return;
    actions.updateOrder(b.orderId, { buyerPhone: b.phone });
    const saved = savedAddressesFor(b.phone, s.addressBook);
    if (saved[0]) {
      const sel = toSelected(saved[0]);
      applyAddress(b.orderId, sel);
      actions.updateBuyer({ step: "main", returning: true, address: sel });
    } else {
      actions.updateBuyer({ step: "address", returning: false, address: undefined });
    }
  },

  /** Use one of the buyer's saved addresses for this order. */
  useSavedAddress(id: string) {
    const b = state.buyer;
    const found = state.addressBook.find((a) => a.id === id);
    if (!b || !found) return;
    const sel = toSelected(found);
    applyAddress(b.orderId, sel);
    actions.updateBuyer({ address: sel, step: "main" });
  },

  /** Use a new address for this order, and save it against the mobile number if a label was chosen. */
  submitAddress(
    input: Omit<SelectedAddress, "id" | "label"> & { label?: AddressLabel | undefined },
  ) {
    const b = state.buyer;
    if (!b) return;
    let id: string | undefined;
    if (input.label) {
      id = `addr-${Date.now().toString(36)}`;
      const entry: SavedAddress = { ...input, id, label: input.label, phone: b.phone };
      setState((s) => ({ addressBook: [...s.addressBook, entry] }));
    }
    const sel: SelectedAddress = { ...input, id };
    applyAddress(b.orderId, sel);
    actions.updateBuyer({ address: sel, step: "main" });
  },

  /** Online payment succeeded. */
  completePayment(
    orderId: string,
    purpose: "prepaid" | "partial",
    amount: number,
    method: PayMethod = "upi",
    app?: string,
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
        codCheck: codCheckFor(s, order),
        method,
        payApp: app,
      });
      actions.addTimeline(orderId, `Part paid (${formatINR(amount)}), rest on delivery`);
    } else {
      actions.updateOrder(orderId, {
        status: "paid",
        paymentMode: "prepaid",
        paidAmount: amount,
        codFee: 0,
        shippingCharged: prices.prepaidShipping,
        method,
        payApp: app,
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
      method: "cod",
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

  /** A buyer is on one list at a time: adding to Trusted takes them off Blocked. */
  trustBuyer(phone: string, name: string) {
    setState((s) => ({
      trusted: s.trusted.some((b) => samePhone(b.phone, phone))
        ? s.trusted
        : [...s.trusted, { phone, name, at: now() }],
      blocked: s.blocked.filter((b) => !samePhone(b.phone, phone)),
    }));
  },
  /** ...and blocking takes them off Trusted. Blocked buyers only get prepaid. */
  blockBuyer(phone: string, name: string) {
    setState((s) => ({
      blocked: s.blocked.some((b) => samePhone(b.phone, phone))
        ? s.blocked
        : [...s.blocked, { phone, name, at: now() }],
      trusted: s.trusted.filter((b) => !samePhone(b.phone, phone)),
    }));
  },
  untrustBuyer(phone: string) {
    setState((s) => ({ trusted: s.trusted.filter((b) => !samePhone(b.phone, phone)) }));
  },
  unblockBuyer(phone: string) {
    setState((s) => ({ blocked: s.blocked.filter((b) => !samePhone(b.phone, phone)) }));
  },
  /** "Add buyer": put someone who hasn't ordered yet straight onto Trusted or Blocked. */
  addBuyerToList(list: "trusted" | "blocked", phone: string, name: string) {
    if (list === "trusted") actions.trustBuyer(phone, name);
    else actions.blockBuyer(phone, name);
  },
};

/** Put the chosen delivery details on the order. */
function applyAddress(orderId: string, a: SelectedAddress) {
  actions.updateOrder(orderId, {
    buyerName: titleCaseName(a.name) || "Buyer",
    address: a.address.trim(),
    pincode: a.pincode.trim(),
    city: a.city.trim() || undefined,
    state: a.state.trim() || undefined,
  });
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function newLineId() {
  return "l-" + Math.random().toString(36).slice(2, 9);
}
