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
  | "repeat_buyer";

export type RiskReason = { code: RiskReasonCode; points: number; label: string };

export type RiskResult = {
  score: number;
  tier: RiskTier;
  reasons: RiskReason[];
  /** What the buyer was offered as a result. */
  action: "cod_confirmed" | "partial_upfront" | "prepaid_only";
  upfrontAmount?: number | undefined;
  /** True when a custom line forced prepaid-only regardless of score. */
  customForcedPrepaid?: boolean | undefined;
};

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
  risk?: RiskResult;
  verdict?: string;
  verdictSource?: "claude" | "template";
  timeline: TimelineEvent[];
  uncertain?: string[];
  /** Seed orders that ended in a refused COD parcel. */
  refused?: boolean;
};

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
  completedOrders: number;
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
