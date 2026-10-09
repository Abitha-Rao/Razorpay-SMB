import { upfrontAmount } from "./money";
import type {
  BuyerRef,
  CatalogItem,
  Order,
  OrderLine,
  OrderStatus,
  PayMethod,
  PaymentMode,
  SavedAddress,
  Seller,
  Settings,
} from "./types";

export const SELLER: Seller = {
  name: "Shristi's Handloom",
  city: "Jaipur",
};

/** Two-letter initials for the seller avatar, e.g. "SH". */
export const SELLER_INITIALS = SELLER.name
  .split(/\s+/)
  .map((w) => w[0])
  .join("")
  .slice(0, 2)
  .toUpperCase();

export const DEFAULT_SETTINGS: Settings = {
  codFee: 49,
  prepaidOffer: "free_shipping",
  shipping: 70,
  showTrackRecord: true,
  useLiveAi: true,
};

export const SEED_CATALOG: CatalogItem[] = [
  { id: "kurti-blue", name: "Blue cotton kurti", price: 1200, weightKg: 0.3 },
  { id: "saree-bandhani-green", name: "Green bandhani saree", price: 2450, weightKg: 0.6 },
  { id: "dupatta-blockprint", name: "Block-print dupatta", price: 650, weightKg: 0.2 },
  { id: "jhumka-silver", name: "Silver oxidised jhumkas", price: 480, weightKg: 0.1 },
  { id: "stole-maroon", name: "Maroon silk stole", price: 900, weightKg: 0.2 },
];

/** Pincodes the courier can't reach (for the pincode check). */
export const UNSERVICEABLE_PINCODES = ["744101", "194101", "737101"];

type Buyer = {
  name: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
};

/** Trusted: three delivered orders, so COD is always allowed. */
export const ANJALI: Buyer = {
  name: "Anjali Verma",
  phone: "98290 11223",
  address: "C-14, Shanti Nagar, Durgapura, Jaipur",
  pincode: "302018",
  city: "Jaipur",
  state: "Rajasthan",
};

/** Has one returned parcel, so COD needs a part-payment. */
export const ROHIT: Buyer = {
  name: "Rohit Sharma",
  phone: "98111 22233",
  address: "House 7, Gali 3, Aliganj, Lucknow",
  pincode: "226024",
  city: "Lucknow",
  state: "Uttar Pradesh",
};

/** On the seller's Blocked list, so prepaid only. */
export const VIKRAM: Buyer = {
  name: "Vikram Singh",
  phone: "94140 55667",
  address: "Ward 9, Near Bus Stand, Sikar",
  pincode: "332001",
  city: "Sikar",
  state: "Rajasthan",
};

const KAVYA: Buyer = {
  name: "Kavya Iyer",
  phone: "99001 23456",
  address: "12, 4th Cross, Indiranagar, Bengaluru",
  pincode: "560038",
  city: "Bengaluru",
  state: "Karnataka",
};
const NEHA: Buyer = {
  name: "Neha Gupta",
  phone: "98100 77889",
  address: "B-201, Mayur Vihar Phase 1, Delhi",
  pincode: "110091",
  city: "Delhi",
  state: "Delhi",
};
const SHALINI: Buyer = {
  name: "Shalini Rao",
  phone: "99860 11447",
  address: "88, Jayanagar 7th Block, Bengaluru",
  pincode: "560070",
  city: "Bengaluru",
  state: "Karnataka",
};
const SNEHA: Buyer = {
  name: "Sneha Patil",
  phone: "98220 45671",
  address: "Flat 302, Sai Residency, Baner Road, Pune",
  pincode: "411045",
  city: "Pune",
  state: "Maharashtra",
};
const DIVYA: Buyer = {
  name: "Divya Menon",
  phone: "98470 66554",
  address: "TC 15/220, Vazhuthacaud, Thiruvananthapuram",
  pincode: "695014",
  city: "Thiruvananthapuram",
  state: "Kerala",
};
const KOMAL: Buyer = {
  name: "Komal Singh",
  phone: "99280 16180",
  address: "Plot 33, Vaishali Nagar, Jaipur",
  pincode: "302021",
  city: "Jaipur",
  state: "Rajasthan",
};
const AYESHA: Buyer = {
  name: "Ayesha Khan",
  phone: "98330 90012",
  address: "Room 5, Noor Manzil, Mohammed Ali Road, Mumbai",
  pincode: "400003",
  city: "Mumbai",
  state: "Maharashtra",
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type Row = {
  buyer: Buyer;
  items: [catalogId: string, qty: number, size?: string][];
  mode: PaymentMode;
  status: OrderStatus;
  daysAgo: number;
  /** How they paid, so a returning buyer's checkout can preselect it. */
  method?: PayMethod;
  app?: string;
};

/** About 12 orders for one seller, oldest first. */
const ROWS: Row[] = [
  {
    buyer: ANJALI,
    items: [["kurti-blue", 2, "M"]],
    mode: "prepaid",
    status: "delivered",
    daysAgo: 25,
    method: "upi",
    app: "Google Pay",
  },
  {
    buyer: KAVYA,
    items: [["jhumka-silver", 2]],
    mode: "prepaid",
    status: "delivered",
    daysAgo: 22,
    method: "card",
  },
  {
    buyer: VIKRAM,
    items: [["dupatta-blockprint", 1]],
    mode: "cod",
    status: "delivered",
    daysAgo: 20,
    method: "cod",
  },
  {
    buyer: ROHIT,
    items: [["saree-bandhani-green", 1]],
    mode: "cod",
    status: "returned",
    daysAgo: 18,
    method: "cod",
  },
  {
    buyer: ANJALI,
    items: [["stole-maroon", 1]],
    mode: "prepaid",
    status: "delivered",
    daysAgo: 15,
    method: "upi",
    app: "Google Pay",
  },
  {
    buyer: NEHA,
    items: [["kurti-blue", 1, "L"]],
    mode: "partial",
    status: "delivered",
    daysAgo: 12,
    method: "upi",
    app: "PhonePe",
  },
  {
    buyer: SHALINI,
    items: [["dupatta-blockprint", 2]],
    mode: "prepaid",
    status: "delivered",
    daysAgo: 9,
    method: "wallet",
  },
  {
    buyer: ANJALI,
    items: [["jhumka-silver", 1]],
    mode: "cod",
    status: "delivered",
    daysAgo: 7,
    method: "cod",
  },
  {
    buyer: SNEHA,
    items: [["stole-maroon", 1]],
    mode: "prepaid",
    status: "paid",
    daysAgo: 2,
    method: "netbanking",
  },
  {
    buyer: DIVYA,
    items: [["kurti-blue", 1, "S"]],
    mode: "cod",
    status: "cod_confirmed",
    daysAgo: 2,
    method: "cod",
  },
  {
    buyer: KOMAL,
    items: [["saree-bandhani-green", 1]],
    mode: "partial",
    status: "partial_paid",
    daysAgo: 1,
    method: "upi",
    app: "Paytm",
  },
  {
    buyer: AYESHA,
    items: [["dupatta-blockprint", 1]],
    mode: "pending",
    status: "awaiting_payment",
    daysAgo: 0,
  },
];

/** The first order a demo adds gets this number. */
export const FIRST_DEMO_ORDER = ROWS.length + 1001;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function linkCode(rand: () => number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(rand() * chars.length)];
  return s;
}

function timeline(status: OrderStatus, mode: PaymentMode, created: number) {
  const at = (h: number) => new Date(created + h * HOUR).toISOString();
  const t = [{ label: "Link sent", at: at(0) }];
  if (status === "awaiting_payment") return t;
  t.push({ label: "Opened", at: at(0.3) });
  if (mode === "prepaid") t.push({ label: "Paid", at: at(0.4) });
  else if (mode === "partial") t.push({ label: "Part paid, rest on delivery", at: at(0.4) });
  else t.push({ label: "COD confirmed", at: at(0.4) });
  if (status === "delivered") t.push({ label: "Delivered", at: at(72) });
  if (status === "returned") t.push({ label: "Returned to seller", at: at(96) });
  return t;
}

/**
 * The seller's 12 past orders. Dated relative to `now` so they always look recent;
 * deterministic otherwise.
 */
export function buildSeedOrders(now = Date.now()): Order[] {
  const rand = mulberry32(42);
  const orders = ROWS.map((row, i): Order => {
    const lines: OrderLine[] = row.items.map(([id, qty, size], n) => {
      const item = SEED_CATALOG.find((c) => c.id === id)!;
      return {
        id: `seed-${i}-${n}`,
        type: "catalog",
        catalogId: item.id,
        name: item.name,
        qty,
        unitPrice: item.price,
        weightKg: item.weightKg,
        size,
      };
    });
    const value = lines.reduce((s, l) => s + (l.unitPrice ?? 0) * l.qty, 0);
    const isCod = row.mode === "cod" || row.mode === "partial";
    const total = value + (isCod ? 70 + 49 : 0);
    const created = now - row.daysAgo * DAY - Math.floor(rand() * 6 * HOUR);
    const paidAmount =
      row.mode === "prepaid"
        ? value
        : row.status === "delivered"
          ? total // the rest was collected in cash on delivery
          : row.mode === "partial"
            ? upfrontAmount(value)
            : 0;
    return {
      id: `ORD-${1001 + i}`,
      linkCode: linkCode(rand),
      createdAt: new Date(created).toISOString(),
      buyerName: row.buyer.name,
      buyerPhone: row.buyer.phone,
      address: row.buyer.address,
      pincode: row.buyer.pincode,
      city: row.buyer.city,
      state: row.buyer.state,
      method: row.method,
      payApp: row.app,
      lines,
      discount: null,
      status: row.status,
      paymentMode: row.mode,
      paidAmount,
      codFee: isCod ? 49 : 0,
      shippingCharged: isCod ? 70 : 0,
      codOffered: true,
      timeline: timeline(row.status, row.mode, created),
    };
  });
  return orders.reverse(); // newest first
}

/** The seller's Trusted list (Anjali) and Blocked list (Vikram) on the seed data. */
export function seedLists(now = Date.now()): { trusted: BuyerRef[]; blocked: BuyerRef[] } {
  const at = new Date(now - 10 * DAY).toISOString();
  return {
    trusted: [{ phone: ANJALI.phone, name: ANJALI.name, at }],
    blocked: [{ phone: VIKRAM.phone, name: VIKRAM.name, at }],
  };
}

/** Each seed buyer's address, saved as "Home" against their mobile number. */
export function seedAddressBook(): SavedAddress[] {
  const seen = new Set<string>();
  const book: SavedAddress[] = [];
  for (const { buyer } of ROWS) {
    if (seen.has(buyer.phone)) continue;
    seen.add(buyer.phone);
    book.push({
      id: `addr-${book.length + 1}`,
      phone: buyer.phone,
      label: "Home",
      name: buyer.name,
      address: buyer.address,
      pincode: buyer.pincode,
      city: buyer.city,
      state: buyer.state,
    });
  }
  return book;
}
