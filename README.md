# Chat Checkout

A mobile-first app for one-person Instagram and WhatsApp sellers. The seller pastes the buyer's order message, AI drafts the order, the seller confirms it and shares a payment link from their own WhatsApp, and the buyer pays through a checkout modelled on Razorpay Magic Checkout. If the buyer picks cash on delivery (COD), a few simple rules decide what they're offered. The seller marks each order Delivered or Returned, and their track record builds from real, paid deliveries.

> This is an unofficial concept build. The checkout is simulated: no real payments happen, the OTP accepts any 6 digits, and nothing is sent to a buyer. It is not affiliated with or endorsed by Razorpay.

## Full path (under 2 minutes)

1. **Seller app** → **New order** → **Use a sample message** (fills the order message and drafts the order in one tap). Check the draft, then **Create payment link**.
2. **Share on WhatsApp** (or **Copy message**). The app never messages the buyer itself.
3. **Buyer view** → mobile number → **Continue** → any 6 digits → **Continue** → address (new number) → **Continue** → pick a payment method → **Pay**.
4. **Seller app** → **Orders** → open the order → **Mark delivered**.
5. **Record** shows the track record grow (paid & delivered orders, return rate).

Tap **Use a sample message** again for the next sample. Each one meets a different COD rule:

| Sample             | Buyer                                                      | What they see under Payment Options                              |
| ------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. New buyer, COD  | Priya (new number), asks for a kurti without naming a size | COD selectable, with a banner nudging them to pay online         |
| 2. Returned parcel | Rohit (one returned order)                                 | "Pay a part now, rest on delivery" with the amount               |
| 3. Blocked buyer   | Vikram (on the Blocked list)                               | COD disabled: "COD isn't available for this order"               |
| 4. Trusted buyer   | Anjali (on the Trusted list)                               | COD selectable, no banner; her saved address loads after the OTP |

**Reset** (top right) restores the seed data: one seller, 12 orders (one returned order, one trusted buyer, one blocked buyer), saved addresses for the seed buyers, the ₹49 COD fee, free shipping on prepaid, and the Trusted and Blocked lists. The state is saved in `localStorage`, so a refresh keeps what you created.

## Seller flow

- **Paste the buyer's order message.** AI drafts items, quantity, price and buyer name, and flags missing details such as size or weight under "Check these", right above the drafted lines. A sized item with no size is also flagged on its own line, and the form works this out itself, so the flag shows even if the AI reports nothing. It clears as soon as the seller types a size.
- **Or build the order yourself.** A link under **Draft with AI** opens the same draft form, blank, with no AI call. The seller fills in the buyer name, phone and lines herself, so she's never stuck if a buyer orders by phone or the AI call fails.
- **The seller has the final say.** Every line, the discount (capped at 90% of the subtotal) and the **Payment options** (Pay now + COD, or Pay now only) are editable. Totals are always computed from the lines and can't be typed in. Custom items default to Pay now only.
- **Share the payment link** from your own WhatsApp (share or copy). **Remind buyer** and **Confirm COD with buyer** work the same way. Every sheet closes with ✕, Escape, a tap outside, after sharing or copying, and when switching between Seller app and Buyer view.

## Buyer checkout

A clean white card layout with the Razorpay blue accent and one primary button pinned at the bottom of every step.

An **Order summary** block sits under the seller card on the first steps, so the buyer sees what they're paying for before they fill in an address: one line per item (name × quantity), subtotal, shipping and total.

1. **Mobile number** → **Continue**. Prefilled from the order message when it had a full number.
2. **OTP** → any 6 digits → **Continue**.
   - **Returning number:** its saved address loads after the OTP.
   - **New number:** the buyer enters an address instead: the buyer types only a name, an address and a pincode. City and state fill in from the pincode and are read-only. **Save my address as** Home, Work or Other.
3. **Order Summary** (collapsible): items, quantities, amounts and the total.
4. **Coupons and offers:** shows the seller's discount when the order has one.
5. **Delivery address**, with an **Add/Change** link to pick another saved address or add a new one.
6. **Payment Options:** UPI first, then Cards, Netbanking, Wallets, and Cash on Delivery (COD) when the seller allows it. A returning buyer's last-used method is preselected.
7. **Price summary:** subtotal, discount, shipping and total, with a **COD Fee** line when COD is selected.

**Simple address rules only:** every field filled, a valid pincode (6 digits starting 1–8), and a pincode that matches the city. A mismatch is a gentle amber flag that never blocks the buyer: "Address says X but pincode is for Y – please check."

## COD rules

All in [`src/lib/demo/cod.ts`](src/lib/demo/cod.ts). There is no risk score and no risk level. When the buyer picks COD, the checks run in this order:

0. **The seller's own choices first:** "Allow COD anyway" (override), and "Pay now only" on the order.
1. **Trusted buyers** (the seller's list) are allowed COD.
2. Otherwise:
   - **Blocked buyers** can't use COD.
   - A buyer with a **returned parcel** in their history pays a small part now (20% of the order, rounded to ₹10, capped at 50%) to confirm COD.
   - **Everyone else** is allowed COD, with a nudge to pay online.

The outcomes appear inside **Payment Options**:

- **Allowed:** COD is selectable, with a banner nudging the buyer to pay online instead (no banner for Trusted buyers).
- **Part-payment:** the COD option reads "Pay a part now, rest on delivery" with the amount.
- **Blocked:** the COD option is disabled with "COD isn't available for this order".
- **Pay now only** (the seller's choice): COD isn't listed, with a one-line reason.

## Trusted and Blocked buyers, and overrides

- **Buyers tab:** lists Trusted buyers, Blocked buyers and everyone else who has ordered. **+ Add buyer** (name and mobile number) puts someone who hasn't ordered yet straight onto Trusted or Blocked.
- **On an order:** **Add to trusted** and **Block buyer** sit side by side (with **Remove from trusted** and **Unblock** when they apply).
- **One list at a time:** blocking removes a buyer from Trusted, and trusting removes them from Blocked.
- **Allow COD anyway:** on an order still awaiting payment where COD is restricted, the seller can tap this. The buyer's screen updates at once, and the order carries an **Override** tag in the order book.

## Order book

One list of all orders: buyer, amount, prepaid or COD, payment status, and the Override tag. Search and filters by status and payment type. The seller marks each order **Delivered** or **Returned** by hand. Nothing is automatic.

## Track record

- Counts only orders **paid through the payment link** (in full or in part) and **marked Delivered**. Cash-only COD deliveries are left out because they can't be verified.
- **Return rate** = returned ÷ (delivered + returned), across all orders, so returns can't be hidden.
- Shown on the seller's **Record** tab (with the return rate), and to buyers as "✓ N paid and delivered orders" on the payment-link screen (you can turn this off in Settings) and on a shareable page at [`/track-record`](src/routes/track-record.tsx). Buyers don't see a return rate.

## AI

Only order drafting uses AI ([`src/lib/demo/ai.functions.ts`](src/lib/demo/ai.functions.ts)). It runs as a TanStack Start server function, so the API key never reaches the browser. Model: `claude-haiku-4-5`.

> "You turn an Indian small seller's WhatsApp/Instagram chat into a draft order. Use the seller's catalog where an item matches; otherwise mark the line custom and do not invent a price unless the chat states one. Return only JSON: {buyer_name, buyer_phone, lines:[{type:'catalog'|'custom', catalog_id?, name, qty, unit_price?, size?}], discount:{type:'flat'|'percent', value}|null, payment_hint:'prepaid'|'cod'|'unknown', address_text?, uncertain:[strings]}. Never write messages to the buyer."

Catalog prices always come from the catalog. If no key is set, or the call fails or takes longer than 8 seconds, the app silently falls back to a hard-coded parser ([`src/lib/demo/fallback.ts`](src/lib/demo/fallback.ts)); the four sample messages return fixed drafts. "Drafted by AI" appears only when Claude answered.

**API key:** add a secret named `ANTHROPIC_API_KEY` in Lovable's project settings (Cloud → Secrets) and re-publish. Never put it in the code or in a message. **Settings → Use live AI** shows "Connected" when the server can see it.

## What is simulated

- **Payment:** every method completes without moving money. The OTP accepts any 6 digits.
- **WhatsApp:** share shows a toast. Copy really copies the message.
- **Pincodes:** serviceability and the city/state lookup use small seeded lists.
- **Saved addresses and last-used payment methods:** seeded for the seed buyers; new ones are saved in this browser.
- **Delivered / Returned:** manual taps by the seller. There is no courier or tracking integration.
- **Track record page:** it shows this browser's data, not a shared database.

## Development

TanStack Start + React + Tailwind, built from a Lovable template and synced with Lovable through GitHub.

```sh
bun install
bun run dev      # http://localhost:8080
bun run test     # COD rules, checkout steps, track record and full-path tests
bun run build
```

Edit in the [Lovable editor](https://lovable.dev/projects/53b1bb67-e0e9-4bee-b8be-7f9aec957c25), or push to `main` and the changes sync back into Lovable.
