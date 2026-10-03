# Razorpay Order Link (concept prototype)

A clickable, mobile-first prototype for a product-management challenge. A one-person Instagram or WhatsApp seller with no website pastes a buyer's chat, AI drafts the order, and the seller confirms and shares a Razorpay-hosted link. The buyer confirms the address and pays, or gets a COD decision based on risk, and the order lands in the seller's order book.

> Prototype only: the Razorpay checkout is simulated and no real payments happen. This is a concept and is not affiliated with or endorsed by Razorpay.

## Demo path (about 90 seconds)

1. **Seller app** → **New order** → tap preset **b) New COD buyer** → **Draft with AI** → **Create link** → **Share on WhatsApp**.
2. **See what the buyer sees** (or use the **Buyer view** toggle) → **Confirm address** → **Accept** the cleaned address → **Continue to payment** → **Cash on delivery**.
3. Checking order… → **medium risk** → **Pay ₹490 now, rest on delivery** → pay with any UPI app.
4. Switch to **Seller app** → **Orders**. ORD-1064 shows **Partial paid** with the plain-language verdict: _"Medium risk: first order from this number and address looked incomplete. Asked for ₹490 upfront."_
5. **Summary** → Pro card, "Ready for your own store?" card (64 orders this month) and Working capital card.

**Reset demo** (top right) reloads the seed data. A page refresh does the same.

## Risk rules (simulated, deterministic)

All rules live in [`src/lib/demo/risk.ts`](src/lib/demo/risk.ts). The score is clamped to 0–100.

| Rule                                                                                | Points |
| ----------------------------------------------------------------------------------- | ------ |
| New phone number (not in past orders)                                               | +30    |
| This phone has a past refused order                                                 | +25    |
| Address confidence is low (no house/flat number, or no street and only a landmark) | +15    |
| Pincode is tier 3 (seeded list in `seed.ts`)                                        | +10    |
| Order value above ₹3,000                                                            | +10    |
| Custom (non-catalog) line in the order                                              | +20    |
| Repeat buyer with 2+ delivered orders                                               | −20    |

| Strictness         | Medium (pay part upfront) | High (prepaid only) |
| ------------------ | ------------------------- | ------------------- |
| Relaxed            | ≥ 50                      | ≥ 80                |
| Balanced (default) | ≥ 35                      | ≥ 65                |
| Strict             | ≥ 20                      | ≥ 45                |

- Custom orders are always prepaid only in Balanced and Strict.
- On medium risk, the upfront amount is 20% of the order value, rounded to ₹10, with a minimum of ₹100 and capped at 50%.
- Every reason that fires is stored on the order and shown to the seller under "Why (rules that fired)".

**Preset b scores 45 in Balanced:** +30 for a new number and +15 because the address has a landmark but no street. 45 is medium, so the buyer is asked for 20% of ₹2,450, which is ₹490. `src/test/demo-path.test.ts` locks this in, so a change to the scoring that breaks the demo fails the tests.

### Prices

The total is always computed from the lines (subtotal − discount). Neither the seller nor the buyer can type a total.

- **Pay now:** order value, with free shipping by default (Settings → Prepaid offer).
- **COD:** order value + ₹70 shipping + ₹49 COD fee (configurable).

## AI calls

The calls are in [`src/lib/demo/ai.functions.ts`](src/lib/demo/ai.functions.ts). They run as TanStack Start **server functions**, so the API key never reaches the browser. Model: `claude-haiku-4-5`.

| Call            | System prompt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Order drafting  | "You turn an Indian small seller's WhatsApp/Instagram chat into a draft order. Use the seller's catalog where an item matches; otherwise mark the line custom and do not invent a price unless the chat states one. Return only JSON: {buyer_name, buyer_phone, lines:[{type:'catalog'\|'custom', catalog_id?, name, qty, unit_price?, size?}], discount:{type:'flat'\|'percent', value}\|null, payment_hint:'prepaid'\|'cod'\|'unknown', address_text?, uncertain:[strings]}. Never write messages to the buyer." Input: the chat plus the catalog as JSON. |
| Address cleanup | "Clean an Indian delivery address. Fix spacing and capitalisation and order it as house/flat, building, street, landmark, area, city, pincode. Do not add details that are not in the input. Return JSON: {clean_address, missing:[strings], confidence:'high'\|'medium'\|'low'}."                                                                                                                                                                                                                      |
| Risk verdict    | "Explain a COD risk decision to a small seller in one or two plain sentences, no jargon, no blame on the buyer. Input: tier, action taken, reasons list. Return plain text."                                                                                                                                                                                                                                                                                                                                     |

Catalog prices always come from the catalog, whatever price the model returns.

### Turning live AI on

1. In Lovable, open the project's Cloud or Secrets settings and add a secret named `ANTHROPIC_API_KEY`.
2. Re-publish. **Settings → Use live AI (Claude)** becomes available, and the draft shows "Drafted by Claude Haiku".

If no key is set, or a call fails or returns bad JSON, every call falls back to the hard-coded parser in [`src/lib/demo/fallback.ts`](src/lib/demo/fallback.ts). The fallback returns the expected draft for the three preset chats, so the demo always works. To record the demo, switch live AI off in Settings so a slow API call can't spoil the take.

## What is simulated

- **Razorpay checkout:** a mock UPI, card and netbanking sheet. Only UPI completes, and no money moves.
- **WhatsApp share and Copy link:** they show a toast, and Copy also copies the message.
- **Pincode serviceability:** a small seeded "not serviceable" list.
- **Seed data:** 63 past orders over 4 weeks (about 35% prepaid, 4 refused COD parcels, repeat buyer Anjali with 3 delivered orders, and number `98111 22233` with one past refusal), so the demo order becomes the 64th this month.
- **Pro trial, store migration, loan eligibility:** these show a "not in prototype" toast.
- **State:** held in memory in one store, shared by the seller and buyer views.

## Development

This is a TanStack Start + React + Tailwind app, built from a Lovable template and synced with Lovable through GitHub.

```sh
bun install
bun run dev      # http://localhost:8080
bun run test     # risk rules + demo path tests
bun run build
```

Edit in the [Lovable editor](https://lovable.dev/projects/53b1bb67-e0e9-4bee-b8be-7f9aec957c25), or push to `main` and the changes sync back into Lovable.
