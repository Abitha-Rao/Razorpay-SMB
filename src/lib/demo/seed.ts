import type {
  CatalogItem,
  Courier,
  Order,
  OrderLine,
  OrderStatus,
  PaymentMode,
  Seller,
  Settings,
} from "./types";

export const SELLER: Seller = {
  name: "Meera's Handloom",
  city: "Jaipur",
};

/** The trust badge shown to buyers on the seed data. */
export const SEED_TRUST_COUNT = 128;

export const DEFAULT_SETTINGS: Settings = {
  strictness: "balanced",
  codFee: 49,
  prepaidOffer: "free_shipping",
  shipping: 70,
  showOrderCount: true,
  useLiveAi: true,
};

export const SEED_CATALOG: CatalogItem[] = [
  { id: "kurti-blue", name: "Blue cotton kurti", price: 1200, weightKg: 0.3 },
  { id: "saree-bandhani-green", name: "Green bandhani saree", price: 2450, weightKg: 0.6 },
  { id: "dupatta-blockprint", name: "Block-print dupatta", price: 650, weightKg: 0.2 },
  { id: "jhumka-silver", name: "Silver oxidised jhumkas", price: 480, weightKg: 0.1 },
  { id: "stole-maroon", name: "Maroon silk stole", price: 900, weightKg: 0.2 },
];

/** Small seeded list of tier-3 pincodes used by the risk rules. */
export const TIER3_PINCODES = [
  "344001",
  "332001",
  "271801",
  "846004",
  "823001",
  "210001",
  "335001",
];

/** Pincodes the courier can't reach (for the pincode check). */
export const UNSERVICEABLE_PINCODES = ["744101", "194101", "737101"];

/** Average loss per refused COD parcel (forward + return shipping, packaging). */
export const RTO_LOSS_PER_PARCEL = 180;

/** COD refusal rate before Order Link (the seller's old WhatsApp-only COD), for the before/after story. */
export const BASELINE_REFUSAL_RATE = 31;

type Buyer = { name: string; phone: string; address: string; pincode: string };

export const ANJALI: Buyer = {
  name: "Anjali Verma",
  phone: "98290 11223",
  address: "C-14, Shanti Nagar, Durgapura, Jaipur",
  pincode: "302018",
};

/** A number with one refused COD parcel in the past. */
export const ROHIT: Buyer = {
  name: "Rohit Sharma",
  phone: "98111 22233",
  address: "House 7, Gali 3, Aliganj, Lucknow",
  pincode: "226024",
};

const POOL: Buyer[] = [
  {
    name: "Kavya Iyer",
    phone: "99001 23456",
    address: "12, 4th Cross, Indiranagar, Bengaluru",
    pincode: "560038",
  },
  {
    name: "Sneha Patil",
    phone: "98220 45671",
    address: "Flat 302, Sai Residency, Baner Road, Pune",
    pincode: "411045",
  },
  {
    name: "Pooja Agarwal",
    phone: "97830 22110",
    address: "45, Civil Lines, Ajmer",
    pincode: "305001",
  },
  {
    name: "Neha Gupta",
    phone: "98100 77889",
    address: "B-201, Mayur Vihar Phase 1, Delhi",
    pincode: "110091",
  },
  {
    name: "Ritu Choudhary",
    phone: "94140 33221",
    address: "Ward 9, Near Bus Stand, Sikar",
    pincode: "332001",
  },
  {
    name: "Divya Menon",
    phone: "98470 66554",
    address: "TC 15/220, Vazhuthacaud, Thiruvananthapuram",
    pincode: "695014",
  },
  {
    name: "Shalini Rao",
    phone: "99860 11447",
    address: "88, Jayanagar 7th Block, Bengaluru",
    pincode: "560070",
  },
  {
    name: "Ayesha Khan",
    phone: "98330 90012",
    address: "Room 5, Noor Manzil, Mohammed Ali Road, Mumbai",
    pincode: "400003",
  },
  {
    name: "Harpreet Kaur",
    phone: "98140 55667",
    address: "House 210, Sector 22, Chandigarh",
    pincode: "160022",
  },
  {
    name: "Lakshmi Narayan",
    phone: "94440 12398",
    address: "17, Kamarajar Street, T Nagar, Chennai",
    pincode: "600017",
  },
  {
    name: "Tanvi Shah",
    phone: "98250 78123",
    address: "A-9, Shyamal Row Houses, Satellite, Ahmedabad",
    pincode: "380015",
  },
  {
    name: "Ishita Bose",
    phone: "98300 44112",
    address: "21B, Lake Road, Kolkata",
    pincode: "700029",
  },
  {
    name: "Nandini Joshi",
    phone: "94130 67890",
    address: "Near Gandhi Chowk, Barmer",
    pincode: "344001",
  },
  {
    name: "Bhavna Mehta",
    phone: "98920 31415",
    address: "602, Lotus Towers, Andheri West, Mumbai",
    pincode: "400053",
  },
  {
    name: "Rekha Yadav",
    phone: "94150 27182",
    address: "Village Rampur, Near Primary School, Bahraich",
    pincode: "271801",
  },
  {
    name: "Komal Singh",
    phone: "99280 16180",
    address: "Plot 33, Vaishali Nagar, Jaipur",
    pincode: "302021",
  },
  {
    name: "Shruti Kulkarni",
    phone: "98600 14142",
    address: "Flat 7, Shree Apartments, Kothrud, Pune",
    pincode: "411038",
  },
  {
    name: "Aarti Mishra",
    phone: "94310 17320",
    address: "Mohalla Lalbagh, Near Kali Mandir, Darbhanga",
    pincode: "846004",
  },
  {
    name: "Swati Desai",
    phone: "98190 22360",
    address: "14, Hill Road, Bandra West, Mumbai",
    pincode: "400050",
  },
  {
    name: "Manisha Rathore",
    phone: "94600 26457",
    address: "88, Shastri Nagar, Jodhpur",
    pincode: "342003",
  },
  {
    name: "Jyoti Pandey",
    phone: "94500 31622",
    address: "Near Station, Civil Lines, Banda",
    pincode: "210001",
  },
  {
    name: "Preeti Saxena",
    phone: "98390 70710",
    address: "H-12, Gomti Nagar, Lucknow",
    pincode: "226010",
  },
];

/** Three other numbers with a refused parcel (four refusals in total with Rohit). */
const REFUSED_AT: Partial<Record<number, Buyer>> = {
  12: at(POOL, 12), // Nandini, Barmer
  30: ROHIT,
  35: at(POOL, 14), // Rekha, Bahraich
  48: at(POOL, 4), // Ritu, Sikar
};

const ANJALI_AT = [5, 22, 40];
const SEED_COUNT = 63;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SEED_COURIERS: Courier[] = ["Delhivery", "Shadowfax", "Ekart", "DTDC", "India Post"];

/** Index into a fixed seed list (always in range). */
function at<T>(list: T[], i: number): T {
  const v = list[i % list.length];
  if (v === undefined) throw new Error("seed index out of range");
  return v;
}

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

function code(rand: () => number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(rand() * chars.length)];
  return s;
}

/**
 * About 63 past orders over the last 4 weeks so the demo order becomes the 64th this month.
 * Deterministic (fixed RNG seed) but dated relative to now so it always looks fresh.
 */
export function buildSeedOrders(now = Date.now()): Order[] {
  const rand = mulberry32(42);
  const orders: Order[] = [];
  let poolIdx = 0;

  for (let i = 0; i < SEED_COUNT; i++) {
    const daysAgo = 27 - Math.floor((i * 28) / SEED_COUNT);
    const created = now - daysAgo * DAY - Math.floor(rand() * 10 * 60 * 60 * 1000);

    let buyer: Buyer;
    let refused = false;
    const refusedBuyer = REFUSED_AT[i];
    if (refusedBuyer) {
      buyer = refusedBuyer;
      refused = true;
    } else if (ANJALI_AT.includes(i)) {
      buyer = ANJALI;
    } else {
      // Skip the buyers reserved for refusals so their only history is the refusal.
      do {
        buyer = at(POOL, poolIdx);
        poolIdx++;
      } while (Object.values(REFUSED_AT).includes(buyer));
    }

    const lines = randomLines(rand, i);
    const awaiting = i >= SEED_COUNT - 3;
    // About 35% prepaid, spread evenly across the month.
    const prepaid =
      !refused && !awaiting && (ANJALI_AT.slice(0, 2).includes(i) || (i * 7) % 20 < 7);

    let status: OrderStatus;
    let paymentMode: PaymentMode;
    if (awaiting) {
      status = "awaiting_payment";
      paymentMode = "pending";
    } else if (refused) {
      status = "refused";
      paymentMode = "cod";
    } else if (ANJALI_AT.includes(i) || daysAgo >= 7) {
      status = "delivered";
      paymentMode = prepaid ? "prepaid" : "cod";
    } else if (daysAgo >= 3) {
      status = "shipped";
      paymentMode = prepaid ? "prepaid" : "cod";
    } else if (prepaid) {
      status = "paid";
      paymentMode = "prepaid";
    } else if (i % 4 === 0) {
      status = "partial_paid";
      paymentMode = "partial";
    } else {
      status = "cod_confirmed";
      paymentMode = "cod";
    }

    const value = lines.reduce((s, l) => s + (l.unitPrice ?? 0) * l.qty, 0);
    const isCod = paymentMode === "cod" || paymentMode === "partial";
    const paidAmount =
      paymentMode === "prepaid"
        ? value
        : paymentMode === "partial"
          ? Math.round((value * 0.2) / 10) * 10
          : status === "delivered" && isCod
            ? value + 70 + 49
            : 0;

    const shippedStatus = status === "shipped" || status === "delivered" || status === "refused";
    const courier = SEED_COURIERS[i % SEED_COURIERS.length]!;
    const delivered = status === "delivered";
    // Some COD buyers paid by UPI at the doorstep; prepaid and part-paid are verified online.
    const paidByUpi = delivered && paymentMode === "cod" && i % 2 === 0;

    orders.push({
      id: `ORD-${1001 + i}`,
      linkCode: code(rand),
      createdAt: new Date(created).toISOString(),
      buyerName: buyer.name,
      buyerPhone: buyer.phone,
      address: buyer.address,
      pincode: buyer.pincode,
      lines,
      discount: null,
      status,
      paymentMode,
      paidAmount,
      codFee: isCod ? 49 : 0,
      shippingCharged: isCod ? 70 : 0,
      timeline: seedTimeline(status, paymentMode, created, shippedStatus ? courier : undefined),
      ...(shippedStatus
        ? {
            courier,
            awb: `${courier.slice(0, 2).toUpperCase()}${7300000 + i * 1373}`,
            shippedAt: new Date(created + 20 * HOUR).toISOString(),
          }
        : {}),
      ...(delivered
        ? {
            deliveredBy: paidByUpi ? ("upi" as const) : ("courier" as const),
            paymentVerified: paymentMode === "prepaid" || paymentMode === "partial" || paidByUpi,
          }
        : {}),
    });
  }
  return orders.reverse(); // newest first
}

function randomLines(rand: () => number, i: number): OrderLine[] {
  const count = rand() < 0.3 ? 2 : 1;
  const lines: OrderLine[] = [];
  const used = new Set<string>();
  for (let n = 0; n < count; n++) {
    let item = at(SEED_CATALOG, Math.floor(rand() * SEED_CATALOG.length));
    if (used.has(item.id)) item = at(SEED_CATALOG, SEED_CATALOG.indexOf(item) + 1);
    used.add(item.id);
    lines.push({
      id: `seed-${i}-${n}`,
      type: "catalog",
      catalogId: item.id,
      name: item.name,
      qty: rand() < 0.2 ? 2 : 1,
      unitPrice: item.price,
      weightKg: item.weightKg,
      size:
        item.id === "kurti-blue" ? at(["S", "M", "L", "XL"], Math.floor(rand() * 4)) : undefined,
    });
  }
  return lines;
}

function seedTimeline(status: OrderStatus, mode: PaymentMode, created: number, courier?: Courier) {
  const at = (h: number) => new Date(created + h * 60 * 60 * 1000).toISOString();
  const t = [{ label: "Link sent", at: at(0) }];
  if (status === "awaiting_payment") return t;
  t.push({ label: "Opened", at: at(0.3) });
  if (mode === "prepaid") t.push({ label: "Paid", at: at(0.4) });
  else if (mode === "partial") t.push({ label: "Part paid, rest on delivery", at: at(0.4) });
  else t.push({ label: "COD confirmed", at: at(0.4) });
  if (status === "paid" || status === "cod_confirmed" || status === "partial_paid") return t;
  t.push({ label: courier ? `Shipped via ${courier}` : "Shipped", at: at(20) });
  if (status === "shipped") return t;
  if (status === "refused") t.push({ label: "Returned to seller", at: at(96) });
  else t.push({ label: "Delivered", at: at(96) });
  return t;
}

/** Payment-verified deliveries minus returns – what the trust badge counts. */
function verifiedScore(orders: Order[]): number {
  const verified = orders.filter((o) => o.status === "delivered" && o.paymentVerified).length;
  const returns = orders.filter((o) => o.status === "refused").length;
  return verified - returns;
}

let seedScore: number | null = null;

/**
 * "N orders completed via Razorpay": lifetime count that starts at 128 on the seed data and
 * moves with payment-verified deliveries (prepaid, part-paid or doorstep UPI) minus returns.
 */
export function trustBadgeCount(orders: Order[]): number {
  seedScore ??= verifiedScore(buildSeedOrders());
  return Math.max(0, SEED_TRUST_COUNT + verifiedScore(orders) - seedScore);
}
