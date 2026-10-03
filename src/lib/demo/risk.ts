/**
 * Simulated COD risk rules. Deterministic and deliberately readable – these are
 * the rules the README documents and the pitch walks through.
 */
import { upfrontAmount } from "./money";
import { TIER3_PINCODES } from "./seed";
import type { Order, OrderLine, RiskReason, RiskResult, RiskTier, Strictness } from "./types";

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
};

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
      label: "This phone refused a COD parcel before",
    });
  if (assessAddress(input.address).confidence === "low")
    reasons.push({
      code: "low_address",
      points: RISK_POINTS.low_address,
      label: "Address confidence is low",
    });
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

  const score = Math.max(
    0,
    Math.min(
      100,
      reasons.reduce((s, r) => s + r.points, 0),
    ),
  );
  const t = THRESHOLDS[input.strictness];
  let tier: RiskTier = score >= t.high ? "high" : score >= t.medium ? "medium" : "low";

  // Custom orders default to prepaid only in Balanced and Strict.
  const customForcedPrepaid = hasCustom && input.strictness !== "relaxed";
  if (customForcedPrepaid) tier = "high";

  if (tier === "high") return { score, tier, reasons, action: "prepaid_only", customForcedPrepaid };
  if (tier === "medium")
    return {
      score,
      tier,
      reasons,
      action: "partial_upfront",
      upfrontAmount: upfrontAmount(input.orderValue),
    };
  return { score, tier, reasons, action: "cod_confirmed" };
}

const PLAIN: Record<RiskReason["code"], string> = {
  new_phone: "first order from this number",
  past_refusal: "this number refused a COD parcel before",
  low_address: "address looked incomplete",
  tier3_pincode: "this pincode sees more returns",
  high_value: "the order is above ₹3,000",
  custom_line: "it's a custom-made item",
  repeat_buyer: "repeat buyer",
};

function joinPlain(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}

export function actionSentence(risk: RiskResult, formatINR: (n: number) => string): string {
  if (risk.action === "partial_upfront")
    return `Asked for ${formatINR(risk.upfrontAmount ?? 0)} upfront.`;
  if (risk.action === "prepaid_only")
    return risk.customForcedPrepaid
      ? "Custom orders are prepaid only, so COD was not offered."
      : "Asked to pay in full before shipping.";
  return "COD confirmed.";
}

/** Template verdict, used when Claude isn't available (and shown instantly before Claude replies). */
export function templateVerdict(risk: RiskResult, formatINR: (n: number) => string): string {
  const tierWord = risk.tier.charAt(0).toUpperCase() + risk.tier.slice(1);
  const positives = risk.reasons.filter((r) => r.points > 0).map((r) => PLAIN[r.code]);
  const repeat = risk.reasons.find((r) => r.code === "repeat_buyer");
  let why = joinPlain(positives);
  if (repeat) why = why ? `${why}, but ${repeat.label.toLowerCase()}` : repeat.label.toLowerCase();
  if (!why) why = "nothing unusual about this order";
  return `${tierWord} risk: ${why}. ${actionSentence(risk, formatINR)}`;
}
