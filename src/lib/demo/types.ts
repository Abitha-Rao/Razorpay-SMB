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

/** Sellers mark each order Delivered or Returned by hand. */
export type OrderStatus =
  "awaiting_payment" | "paid" | "cod_confirmed" | "partial_paid" | "delivered" | "returned";

/** How the buyer settled (or will settle) the order. */
export type PaymentMode = "pending" | "prepaid" | "cod" | "partial";

/** What the simple COD rules decide when a buyer picks COD. */
export type CodAction = "allowed" | "part_payment" | "prepaid_only";

/** Which rule produced the decision, in the order the rules are checked. */
export type CodReason = "override" | "seller" | "trusted" | "blocked" | "returned" | "default";

export type CodCheck = {
  action: CodAction;
  reason: CodReason;
  /** COD is allowed, but the buyer is nudged to pay now instead. */
  prepayNudge: boolean;
  /** Advance to pay now when action is part_payment. */
  upfrontAmount?: number | undefined;
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
  city?: string | undefined;
  state?: string | undefined;
  /** Address was copied from this phone's last order ("same address as last time"). */
  addressSource?: "last_order" | undefined;
  lines: OrderLine[];
  discount: Discount;
  status: OrderStatus;
  paymentMode: PaymentMode;
  /** Amount collected so far (through the link, or in cash once delivered). */
  paidAmount: number;
  /** COD fee charged on this order (0 if prepaid). */
  codFee: number;
  /** Shipping charged on this order (0 if waived for prepaid). */
  shippingCharged: number;
  /** The seller decides whether COD is offered on this order at all. */
  codOffered: boolean;
  /** The seller tapped "Allow COD anyway". Shown as an "Override" tag. */
  override?: boolean | undefined;
  /** The COD check as it stood when the buyer picked COD. */
  codCheck?: CodCheck | undefined;
  timeline: TimelineEvent[];
  uncertain?: string[] | undefined;
};

/** A buyer on the seller's Trusted or Blocked list. */
export type BuyerRef = { phone: string; name: string; at: string };

export type Settings = {
  codFee: number;
  prepaidOffer: "free_shipping" | "none";
  shipping: number;
  showTrackRecord: boolean;
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

export type AiSource = "claude" | "fallback";
