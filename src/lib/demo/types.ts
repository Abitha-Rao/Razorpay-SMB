export type CatalogItem = {
  id: string;
  name: string;
  price: number;
  weightKg: number;
};

export type OrderLine = {
  id: string;
  type: "catalog" | "custom";
  catalogId?: string | undefined;
  name: string;
  qty: number;
  /** null only for a custom line whose price the seller hasn't set yet. */
  unitPrice: number | null;
  weightKg: number;
  size?: string | undefined;
};

export type Discount = { type: "flat" | "percent"; value: number } | null;

export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "cod_confirmed"
  | "partial_paid"
  | "shipped"
  | "delivered"
  | "refused";

/** How the buyer settled (or will settle) the order. */
export type PaymentMode = "pending" | "prepaid" | "cod" | "partial";

export type Strictness = "relaxed" | "balanced" | "strict";

export type RiskTier = "low" | "medium" | "high";

export type RiskReasonCode =
  | "new_phone"
  | "past_refusal"
  | "low_address"
  | "tier3_pincode"
  | "high_value"
  | "custom_line"
  | "repeat_buyer"
  | "cod_blocked";

export type RiskReason = {
  code: RiskReasonCode;
  points: number;
  label: string;
  /** For low_address: what was missing. */
  detail?: "no_house" | "no_street" | undefined;
};

export type RiskResult = {
  score: number;
  tier: RiskTier;
  reasons: RiskReason[];
  /** Which payment options the buyer is shown. */
  action: "cod_allowed" | "partial_upfront" | "prepaid_only";
  upfrontAmount?: number | undefined;
  /** Why COD was switched off, when action is prepaid_only. */
  prepaidReason?: "custom" | "blocked" | "score" | undefined;
};

/** How the buyer finally settled after seeing the options. */
export type RiskOutcome = "cod" | "partial" | "prepaid";

export type Courier = "Delhivery" | "Shadowfax" | "Ekart" | "India Post" | "DTDC" | "Other";

export type TimelineEvent = { label: string; at: string };

export type Order = {
  id: string;
  linkCode: string;
  createdAt: string;
  buyerName: string;
  buyerPhone: string;
  address?: string | undefined;
  pincode?: string | undefined;
  lines: OrderLine[];
  discount: Discount;
  status: OrderStatus;
  paymentMode: PaymentMode;
  /** Amount collected online so far. */
  paidAmount: number;
  /** COD fee charged on this order (0 if prepaid). */
  codFee: number;
  /** Shipping charged on this order (0 if waived for prepaid). */
  shippingCharged: number;
  city?: string | undefined;
  state?: string | undefined;
  /** Address was copied from this phone's last order ("same address as last time"). */
  addressSource?: "last_order" | undefined;
  risk?: RiskResult | undefined;
  verdict?: string | undefined;
  verdictSource?: "claude" | "template" | undefined;
  timeline: TimelineEvent[];
  uncertain?: string[] | undefined;
  courier?: Courier | undefined;
  awb?: string | undefined;
  shippedAt?: string | undefined;
  /** Who marked it delivered: the courier feed (seed), the seller, the 10-day rule, or a doorstep UPI payment. */
  deliveredBy?: "courier" | "seller" | "auto" | "upi" | undefined;
  /** Paid online (prepaid, part-paid or doorstep UPI) – counts towards the trust badge. */
  paymentVerified?: boolean | undefined;
};

export type BlockedPhone = { phone: string; name: string; at: string };

export type Settings = {
  strictness: Strictness;
  codFee: number;
  prepaidOffer: "free_shipping" | "none";
  shipping: number;
  showOrderCount: boolean;
  useLiveAi: boolean;
};

export type Seller = {
  name: string;
  city: string;
};

/** What the AI (or fallback parser) returns for a chat. */
export type DraftResult = {
  buyer_name: string | null;
  buyer_phone: string | null;
  lines: {
    type: "catalog" | "custom";
    catalog_id?: string;
    name: string;
    qty: number;
    unit_price?: number | null;
    size?: string | null;
    weight_kg?: number | null;
  }[];
  discount: Discount;
  payment_hint: "prepaid" | "cod" | "unknown";
  address_text?: string | null;
  pincode?: string | null;
  uncertain: string[];
};

export type AddressResult = {
  clean_address: string;
  missing: string[];
  confidence: "high" | "medium" | "low";
};

export type AiSource = "claude" | "fallback";
