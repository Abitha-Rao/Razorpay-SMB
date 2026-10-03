# Razorpay Order Link (concept prototype)

A clickable, mobile-first prototype for a product-management challenge. A one-person Instagram or WhatsApp seller with no website pastes a buyer's chat, AI drafts the order, and the seller confirms and shares a Razorpay-hosted link. The buyer confirms the address and pays, or gets a COD decision based on risk, and the order lands in the seller's order book.

> Prototype only: the Razorpay checkout is simulated and no real payments happen. This is a concept and is not affiliated with or endorsed by Razorpay.

## Demo path (about 90 seconds)

1. **Seller app** → **New order** → tap preset **b) New COD buyer** → **Draft with AI** → **Create link** → **Share on WhatsApp** (or close the sheet with ✕, Escape or a tap outside).
2. **Buyer view** toggle → **Confirm address** → **Accept** the cleaned address (city and state fill from the pincode) → **Continue to payment**.
3. Checking order… → medium risk, so the payment screen offers only **Pay now** or **Pay ₹490 now, rest on delivery** → pay with any UPI app.
4. Switch to **Seller app** → **Orders**. ORD-1064 shows **Partial paid**, total ₹2,569 ("₹490 paid · ₹2,079 on delivery"), and its detail says: _"New number and the address had no street, so we asked for ₹490 upfront."_
5. **Summary** → COD refusal rate with "Before Order Link: 31%", the "Saved this month" card, the Pro card, "Ready for your own store?" card (64 orders this month) and Working capital card.

The demo state (orders, settings, current draft and link, COD-not-allowed list) is saved in `localStorage`, so a page refresh keeps the order you just created. **Reset demo** (top right) clears it and restores Balanced strictness, the ₹49 COD fee, free shipping on prepaid, the 63 seed orders, and an empty COD-not-allowed list.

## Messages: share or copy, never sent by Razorpay

Every buyer-facing message opens a sheet with the prefilled text, **Share on WhatsApp** and **Copy message**. The seller sends it from their own WhatsApp:

| Message          | Where                                                  | Example                                                                                                          |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Order link       | After **Create link**                                  | "Hi Priya, here is your order from Meera's Handloom: ₹2,450. Confirm address and pay here: rzp.io/ol/AB12CD"     |
| Payment reminder | **Remind buyer** on an awaiting order                  | "Hi Jyoti, a gentle reminder for your order from Meera's Handloom (₹3,650). Pay or choose COD here: rzp.io/ol/…" |
| COD confirmation | **Confirm COD with buyer** on a COD or part-paid order | "Hi Priya, confirming your COD order of ₹2,079 … Please reply YES to confirm"                                    |
| Shipping update  | Opens after **Mark as shipped**                        | "Hi Priya, your order … has shipped via Delhivery, tracking number DL14902231. Track: rzp.io/ol/AB12CD"          |

Every sheet closes with ✕, Escape, a tap outside, after sharing or copying, and when switching between Seller app and Buyer view. Toasts last 3 seconds and are cleared whenever the screen or view changes.

## Shipping and outcomes (no aggregator, no tracking API)

- **Ship order** (on Paid, COD confirmed or Partial paid orders) shows the shipping details read-only: name, phone, full address, pincode, weight and, for COD, the amount to collect. It also has **Copy for courier**, a courier dropdown (Delhivery, Shadowfax, Ekart, India Post, DTDC, Other) and a tracking number field (optional for Other). **Mark as shipped** then opens the shipping-update sheet.
- **Tracking link:** a "Track on [courier]" link (a placeholder URL to the courier's site) appears on the seller's order and on the buyer's order page.
- **Shipped orders** have **Mark as delivered** and **Mark as returned**. If neither is tapped, the order becomes Delivered automatically 10 days after shipping. The demo links **Simulate 10 days later** and, for COD, **Simulate doorstep UPI payment** (Delivered and payment-verified) let you show this without waiting.
- **Returns:** a returned parcel adds the buyer's phone to **Settings → COD not allowed** (removable) and counts in the Summary refusal rate and money lost.
- **Seller-marked deliveries** show a "Marked by you" tag.
- **Trust badge:** "N orders completed via Razorpay" counts only payment-verified deliveries (prepaid, part-paid or doorstep UPI) minus returns. It starts at 128 on the seed data.

## Risk rules (simulated, deterministic)

All rules live in [`src/lib/demo/risk.ts`](src/lib/demo/risk.ts). The score is clamped to 0–100.

| Rule                                                                               | Points       |
| ---------------------------------------------------------------------------------- | ------------ |
| New phone number (not in past orders)                                              | +30          |
| This phone has a past returned COD order                                           | +25          |
| Address confidence is low (no house/flat number, or no street and only a landmark) | +15          |
| Pincode is tier 3 (seeded list in `seed.ts`)                                       | +10          |
| Order value above ₹3,000                                                           | +10          |
| Custom (non-catalog) line in the order                                             | +20          |
| Repeat buyer with 2+ delivered orders                                              | −20          |
| Phone is on the seller's COD-not-allowed list                                      | prepaid only |

| Strictness         | Medium (pay part upfront) | High (prepaid only) |
| ------------------ | ------------------------- | ------------------- |
| Relaxed            | ≥ 50                      | ≥ 80                |
| Balanced (default) | ≥ 35                      | ≥ 65                |
| Strict             | ≥ 20                      | ≥ 45                |

- Custom orders are always prepaid only in Balanced and Strict.
- On medium risk, the upfront amount is 20% of the order value, rounded to ₹10, with a minimum of ₹100 and capped at 50%.
- **When the check runs:** when the buyer taps **Continue to payment**. The payment screen then shows only valid options: low risk gets **Pay now / COD**, medium gets **Pay now / Pay ₹X now, rest on delivery**, and high risk or a custom item gets only **Pay now** with a one-line reason. COD is never shown and then refused.
- **Seller's order page:** the verdict talks about the buyer in the third person, for example "Custom item, so COD was switched off and the buyer paid upfront." The buyer page keeps its own wording, for example "This order has a custom item, so the seller needs payment upfront."
- Every reason that fires is stored on the order and shown under "Rules that fired".

**Preset b scores 45 in Balanced:** +30 for a new number and +15 because the address has a landmark but no street. 45 is medium, so the buyer is asked for 20% of ₹2,450, which is ₹490. `src/test/demo-path.test.ts` locks this in, so a change to the scoring that breaks the demo fails the tests.

### Prices

The total is always computed from the lines (subtotal − discount). Neither the seller nor the buyer can type a total. A % discount is capped at 90% and a ₹ discount at subtotal − ₹1, with an inline warning. **Create link** stays disabled while the total is ₹0 or any line has no price.

- **Pay now:** order value, with free shipping by default (Settings → Prepaid offer).
- **COD:** order value + ₹70 shipping + ₹49 COD fee (configurable).

## AI calls

The calls are in [`src/lib/demo/ai.functions.ts`](src/lib/demo/ai.functions.ts). They run as TanStack Start **server functions**, so the API key never reaches the browser. Model: `claude-haiku-4-5`.

| Call            | System prompt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Order drafting  | "You turn an Indian small seller's WhatsApp/Instagram chat into a draft order. Use the seller's catalog where an item matches; otherwise mark the line custom and do not invent a price unless the chat states one. Return only JSON: {buyer_name, buyer_phone, lines:[{type:'catalog'\|'custom', catalog_id?, name, qty, unit_price?, size?}], discount:{type:'flat'\|'percent', value}\|null, payment_hint:'prepaid'\|'cod'\|'unknown', address_text?, uncertain:[strings]}. Never write messages to the buyer." Input: the chat plus the catalog as JSON. |
| Address cleanup | "Clean an Indian delivery address. Fix spacing and capitalisation and order it as house/flat, building, street, landmark, area, city, pincode. Do not add details that are not in the input. Return JSON: {clean_address, missing:[strings], confidence:'high'\|'medium'\|'low'}."                                                                                                                                                                                                                                                                           |
| Risk verdict    | "Explain a COD risk decision to a small seller in one or two plain sentences, no jargon, no blame on the buyer. Input: tier, action taken, reasons list. Return plain text."                                                                                                                                                                                                                                                                                                                                                                                 |

Catalog prices always come from the catalog, whatever price the model returns.

### Turning live AI on

1. In Lovable, add a secret named `ANTHROPIC_API_KEY` in the project's settings (Secrets or environment variables). The server reads it from `process.env` or the Cloudflare worker bindings.
2. Re-publish. **Settings → Use live AI (Claude)** shows "Connected".

If no key is set, or a call fails, returns bad JSON or takes longer than 8 seconds, the app silently falls back to the parser in [`src/lib/demo/fallback.ts`](src/lib/demo/fallback.ts). The fallback returns the expected draft for the three preset chats, so the demo always works. It also reads per-item quantities, % or ₹ discounts, names and phone numbers from free-form chats.

What you see on screen:

- **Drafts:** "Drafted by AI" appears only when Claude answered. A fallback draft shows no label.
- **Risk verdicts:** "Why:" appears before the sentence only when Claude wrote it. A fallback verdict is shown with no label.
- **Settings:** shows "Connected" when the server can see the key. To record the demo, switch live AI off there so a slow API call can't spoil the take.

### Draft and buyer-page edge cases

- **Names** are capitalised ("priya" → "Priya").
- **"Same/old address"** in the chat is never copied into the address field. The app looks up that phone's last order and prefills its address and pincode, and the buyer page says "Using address from the last order".
- **Custom lines** with no stated weight get "Check weight" in the "Check these" list.
- **Pincodes** must be 6 digits starting with 1–8 (000000 and 999999 are invalid), with the inline error "Enter a 6-digit pincode". A seeded list marks some pincodes "Not serviceable", and city and state fill from a seeded lookup. A city is required before Continue.

## What is simulated

- **Razorpay checkout:** a mock UPI, card and netbanking sheet. Only UPI completes, and no money moves.
- **WhatsApp share:** shows a toast. Copy really copies the message.
- **Pincodes:** serviceability and the city/state lookup use small seeded lists.
- **Courier tracking:** placeholder links to each courier's site. There's no tracking API, so delivery is marked by the seller, by a doorstep UPI payment, or automatically after 10 days.
- **Seed data:** 63 past orders over 4 weeks (about 35% prepaid, 4 returned COD parcels, repeat buyer Anjali with 3 delivered orders, and number `98111 22233` with one past return), so the demo order becomes the 64th this month.
- **"Saved this month":** (31% baseline refusal rate − current rate) × this month's COD orders × ₹180. The 31% "before" rate is an assumed baseline.
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
