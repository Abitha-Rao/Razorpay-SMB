/**
 * Simulated COD risk rules. Deterministic and deliberately readable – these are
 * the rules the README documents and the pitch walks through.
 */
import { upfrontAmount } from "./money";
import { TIER3_PINCODES } from "./seed";
import type {
  Order,
  OrderLine,
  RiskOutcome,
  RiskReason,
  RiskResult,
  RiskTier,
  Strictness,
} from "./types";

export const RISK_POINTS = {
  new_phone: 30,
  past_refusal: 25,
  low_address: 15,
  tier3_pincode: 10,
  high_value: 10,
  custom_line: 20,
  repeat_buyer: -20,
} as const;

export const HIGH_VALUE_THRESHOLD = 3000;

/** medium ≥ first number, high ≥ second number. */
export const THRESHOLDS: Record<Strictness, { medium: number; high: number }> = {
  relaxed: { medium: 50, high: 80 },
  balanced: { medium: 35, high: 65 },
  strict: { medium: 20, high: 45 },
};

export const STRICTNESS_COPY: Record<Strictness, { label: string; line: string }> = {
  relaxed: {
    label: "Relaxed",
    line: "Most buyers get COD. Only clearly risky orders are asked to pay something upfront.",
  },
  balanced: {
    label: "Balanced",
    line: "New or unclear orders pay a small part upfront. Custom orders are prepaid only.",
  },
  strict: {
    label: "Strict",
    line: "COD mainly for trusted repeat buyers. Others pay upfront or fully prepaid.",
  },
};

export function normalizePhone(phone: string): string {
  return phone.toLowerCase().replace(/[^0-9x]/g, "");
}

export function phoneHistory(phone: string, orders: Order[], excludeId?: string) {
  const p = normalizePhone(phone);
  const past = orders.filter((o) => o.id !== excludeId && p && normalizePhone(o.buyerPhone) === p);
  return {
    past,
    delivered: past.filter((o) => o.status === "delivered").length,
    refused: past.filter((o) => o.status === "refused").length,
  };
}

/**
 * Address confidence used by the risk rules. Low when there's no house/flat number,
 * or when there's no street and the address leans on a landmark ("near ...") instead.
 */
export function assessAddress(address: string): {
  confidence: "high" | "medium" | "low";
  missing: string[];
} {
  const a = address.toLowerCase();
  const hasHouse =
    /\b(flat|house|h\.?\s?no\.?|plot|door|room|apt|apartment|ward)\s*[-#:]?\s*\d+/.test(a) ||
    /(^|[\s,])[a-z]?-?\d+[a-z]?\s*[,/-]/.test(a) ||
    /^\s*\d+/.test(a);
  const hasStreet =
    /\b(road|rd|street|st|marg|lane|gali|cross|main|avenue|path|row|chowk|nagar|colony|vihar|block \d)\b/.test(
      a,
    );
  const landmark = /\b(near|opp\.?|opposite|behind|beside)\b/.test(a);
  const missing: string[] = [];
  if (!hasHouse) missing.push("House or flat number");
  if (!hasStreet) missing.push("Street or road name");
  if (!hasHouse || (!hasStreet && landmark)) return { confidence: "low", missing };
  if (!hasStreet) return { confidence: "medium", missing };
  return { confidence: "high", missing };
}

export type RiskInput = {
  phone: string;
  address: string;
  pincode: string;
  orderValue: number;
  lines: OrderLine[];
  strictness: Strictness;
  pastOrders: Order[];
  excludeOrderId?: string;
  /** Phones the seller put on the "COD not allowed" list. */
  codBlockedPhones?: string[];
};

export function isCodBlocked(phone: string, blocked: string[] = []): boolean {
  const p = normalizePhone(phone);
  return !!p && blocked.some((b) => normalizePhone(b) === p);
}

export function scoreRisk(input: RiskInput): RiskResult {
  const reasons: RiskReason[] = [];
  const history = phoneHistory(input.phone, input.pastOrders, input.excludeOrderId);

  if (history.past.length === 0)
    reasons.push({
      code: "new_phone",
      points: RISK_POINTS.new_phone,
      label: "New phone number (no past orders)",
    });
  if (history.refused > 0)
    reasons.push({
      code: "past_refusal",
      points: RISK_POINTS.past_refusal,
      label: "This phone returned a COD parcel before",
    });
  const addr = assessAddress(input.address);
  if (addr.confidence === "low") {
    const noHouse = addr.missing.includes("House or flat number");
    reasons.push({
      code: "low_address",
      points: RISK_POINTS.low_address,
      label: noHouse
        ? "Address has no house or flat number"
        : "Address has no street (landmark only)",
      detail: noHouse ? "no_house" : "no_street",
    });
  }
  if (TIER3_PINCODES.includes(input.pincode.trim()))
    reasons.push({
      code: "tier3_pincode",
      points: RISK_POINTS.tier3_pincode,
      label: "Tier-3 pincode",
    });
  if (input.orderValue > HIGH_VALUE_THRESHOLD)
    reasons.push({
      code: "high_value",
      points: RISK_POINTS.high_value,
      label: "Order value above ₹3,000",
    });
  const hasCustom = input.lines.some((l) => l.type === "custom");
  if (hasCustom)
    reasons.push({
      code: "custom_line",
      points: RISK_POINTS.custom_line,
      label: "Custom (non-catalog) item",
    });
  if (history.delivered >= 2)
    reasons.push({
      code: "repeat_buyer",
      points: RISK_POINTS.repeat_buyer,
      label: `Repeat buyer with ${history.delivered} delivered orders`,
    });
  const blocked = isCodBlocked(input.phone, input.codBlockedPhones);
  if (blocked)
    reasons.push({
      code: "cod_blocked",
      points: 0,
      label: "On your COD-not-allowed list",
    });

  const score = Math.max(
    0,
    Math.min(
      100,
      reasons.reduce((s, r) => s + r.points, 0),
    ),
  );
  const t = THRESHOLDS[input.strictness];
  const tier: RiskTier = score >= t.high ? "high" : score >= t.medium ? "medium" : "low";

  // Prepaid only: the seller blocked this number, custom orders (Balanced and Strict), or a high score.
  if (blocked)
    return { score, tier: "high", reasons, action: "prepaid_only", prepaidReason: "blocked" };
  if (hasCustom && input.strictness !== "relaxed")
    return { score, tier: "high", reasons, action: "prepaid_only", prepaidReason: "custom" };
  if (tier === "high")
    return { score, tier, reasons, action: "prepaid_only", prepaidReason: "score" };
  if (tier === "medium")
    return {
      score,
      tier,
      reasons,
      action: "partial_upfront",
      upfrontAmount: upfrontAmount(input.orderValue),
    };
  return { score, tier, reasons, action: "cod_allowed" };
}

/** One-line reason shown to the buyer when only "Pay now" is offered. */
export function buyerPrepaidReason(risk: RiskResult): string {
  if (risk.prepaidReason === "custom")
    return "This order has a custom item, so the seller needs payment upfront.";
  return "COD isn't available for this order.";
}

/** Seller-facing phrases: about the buyer, in the third person. */
function reasonPhrase(r: RiskReason): string {
  switch (r.code) {
    case "new_phone":
      return "new number";
    case "past_refusal":
      return "this number returned a COD parcel before";
    case "low_address":
      return r.detail === "no_house"
        ? "the address had no house number"
        : "the address had no street";
    case "tier3_pincode":
      return "a pincode with more returns";
    case "high_value":
      return "order above ₹3,000";
    case "custom_line":
      return "custom item";
    case "repeat_buyer":
      return r.label.toLowerCase();
    case "cod_blocked":
      return "number is on your COD-not-allowed list";
  }
}

function joinPlain(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** What happened, in seller-facing words, e.g. "so we asked for ₹490 upfront". */
export function outcomePhrase(
  risk: RiskResult,
  outcome: RiskOutcome,
  formatINR: (n: number) => string,
): string {
  if (risk.action === "prepaid_only") return "so COD was switched off and the buyer paid upfront";
  if (risk.action === "partial_upfront") {
    const ask = `so we asked for ${formatINR(risk.upfrontAmount ?? 0)} upfront`;
    return outcome === "prepaid" ? `${ask}; the buyer paid in full instead` : ask;
  }
  return outcome === "prepaid"
    ? "so COD was offered; the buyer chose to pay upfront"
    : "so COD was allowed";
}

/**
 * Template verdict for the seller's order page, e.g.
 * "New number and the address had no street, so we asked for ₹490 upfront."
 */
export function sellerVerdict(
  risk: RiskResult,
  outcome: RiskOutcome,
  formatINR: (n: number) => string,
): string {
  // When the seller blocked the number or the order is custom, that alone explains the decision.
  const key =
    risk.prepaidReason === "blocked"
      ? risk.reasons.filter((r) => r.code === "cod_blocked")
      : risk.prepaidReason === "custom"
        ? risk.reasons.filter((r) => r.code === "custom_line")
        : risk.reasons.filter((r) => r.points !== 0);
  const why = key.length
    ? capitalise(joinPlain(key.map(reasonPhrase)))
    : "Nothing unusual about this order";
  return `${why}, ${outcomePhrase(risk, outcome, formatINR)}.`;
}
