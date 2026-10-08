# Chat Checkout (concept prototype)

A clickable, mobile-first prototype for a product-management challenge. A one-person Instagram or WhatsApp seller pastes a buyer's chat, AI drafts the order, the seller confirms it and shares a payment link from their own WhatsApp, and the buyer checks the order, adds an address and pays. If the buyer picks cash on delivery (COD), a few simple rules decide what they're offered. The seller marks each order Delivered or Returned, and their track record builds from real, paid deliveries.

> Prototype only: the checkout is simulated and no real payments happen. This is a concept and is not affiliated with or endorsed by Razorpay.

## Demo path (under 2 minutes)

1. **Seller app** → **New order** → **Use sample chat** (fills the chat and drafts the order in one tap). Check the draft, then **Create payment link**.
2. **Share on WhatsApp** (or **Copy message**). The app never messages the buyer itself.
3. **Buyer view** → **Confirm address** → **Continue to payment**. The prepaid offer and the COD fee sit side by side. Pick **Pay now** and pay with any UPI app.
4. **Seller app** → **Orders** → open the order → **Mark delivered**.
5. **Record** shows the track record grow (paid & delivered orders, return rate).

Tap **Use sample chat** again for the next sample. Each one meets a different COD rule:

| Sample             | Buyer                        | What happens when they pick COD             |
| ------------------ | ---------------------------- | ------------------------------------------- |
| 1. New buyer       | Priya (new number)           | COD allowed, with a nudge to pay now        |
| 2. Returned parcel | Rohit (one returned order)   | Pay a small part now to confirm COD         |
| 3. Blocked buyer   | Vikram (on the Blocked list) | Prepaid only                                |
| 4. Trusted buyer   | Anjali (on the Trusted list) | COD allowed; her saved address is prefilled |

**Reset demo** (top right) restores the seed data: one seller, 12 orders (one returned order, one trusted buyer, one blocked buyer), the ₹49 COD fee, free shipping on prepaid, and the Trusted and Blocked lists. The state is saved in `localStorage`, so a refresh keeps what you created.

## Seller flow

- **Paste the buyer's chat.** AI drafts items, quantity, price and buyer name, and flags missing details such as size or weight under "Check these".
- **The seller has the final say.** Every line, the discount (capped at 90% of the subtotal) and the **Payment options** (Pay now + COD, or Pay now only) are editable. Totals are always computed from the lines and can't be typed in. Custom items default to Pay now only.
- **Share the payment link** from your own WhatsApp (share or copy). **Remind buyer** and **Confirm COD with buyer** work the same way. Every sheet closes with ✕, Escape, a tap outside, after sharing or copying, and when switching between Seller app and Buyer view.

## Buyer flow

- Checks the order, then enters an address with four address fields (address, pincode, city, state) plus name and phone.
- **Simple address rules only:** every field filled, a valid pincode (6 digits starting 1–8), and a pincode that matches the city. A mismatch is a gentle amber flag that never blocks the buyer: "Address says X but pincode is for Y – please check." City and state fill from the pincode.
- **Saved address:** if this phone number has ordered before, its saved address is prefilled.
- Sees **Pay now** (prepaid offer) and **Cash on delivery** (+ COD fee) side by side.

## COD rules

All in [`src/lib/demo/cod.ts`](src/lib/demo/cod.ts). There is no risk score and no risk level. When the buyer picks COD, the checks run in this order:

0. **The seller's own choices first:** "Allow COD anyway" (override), and "Pay now only" on the order.
1. **Trusted buyers** (the seller's list) are allowed COD.
2. Otherwise:
   - **Blocked buyers** get prepaid only.
   - A buyer with a **returned parcel** in their history pays a small part now (20% of the order, rounded to ₹10, capped at 50%) to confirm COD.
   - **Everyone else** is allowed COD, with a nudge to pay now.

The buyer sees one of three outcomes: **COD allowed**, **a part-payment to confirm COD**, or **prepaid only** (with a one-line reason).

> Prototype rules. Production would reuse Razorpay Magic Checkout's COD rules.

## Seller override and Trusted buyers

- **Trusted buyers:** mark any buyer as Trusted from the **Buyers** tab or with **Add to trusted** on an order. The same screen lists Blocked buyers (with **Unblock**).
- **Allow COD anyway:** on an order still awaiting payment where the COD rules say prepaid only or part-payment, the seller can tap this. The buyer's screen updates at once, and the order carries an **Override** tag in the order book.

## Order book

One list of all orders: buyer, amount, prepaid or COD, payment status, and the Override tag. Search and filters by status and payment type. The seller marks each order **Delivered** or **Returned** by hand. Nothing is automatic.

## Track record

- Counts only orders **paid through the payment link** (in full or in part) and **marked Delivered**. Cash-only COD deliveries are left out because they can't be verified.
- **Return rate** = returned ÷ (delivered + returned), across all orders, so returns can't be hidden.
- Shown on the seller's **Record** tab, on the buyer's payment-link screen (you can turn this off in Settings), and on a shareable page at [`/track-record`](src/routes/track-record.tsx).

## AI

Only order drafting uses AI ([`src/lib/demo/ai.functions.ts`](src/lib/demo/ai.functions.ts)). It runs as a TanStack Start server function, so the API key never reaches the browser. Model: `claude-haiku-4-5`.

> "You turn an Indian small seller's WhatsApp/Instagram chat into a draft order. Use the seller's catalog where an item matches; otherwise mark the line custom and do not invent a price unless the chat states one. Return only JSON: {buyer_name, buyer_phone, lines:[{type:'catalog'|'custom', catalog_id?, name, qty, unit_price?, size?}], discount:{type:'flat'|'percent', value}|null, payment_hint:'prepaid'|'cod'|'unknown', address_text?, uncertain:[strings]}. Never write messages to the buyer."

Catalog prices always come from the catalog. If no key is set, or the call fails or takes longer than 8 seconds, the app silently falls back to a hard-coded parser ([`src/lib/demo/fallback.ts`](src/lib/demo/fallback.ts)); the four sample chats return fixed drafts. "Drafted by AI" appears only when Claude answered.

**API key:** add a secret named `ANTHROPIC_API_KEY` in Lovable's project settings (Cloud → Secrets) and re-publish. Never put it in the code or a chat. **Settings → Use live AI** shows "Connected" when the server can see it.

## What is simulated

- **Checkout:** a mock UPI, card and netbanking sheet. Only UPI completes, and no money moves.
- **WhatsApp:** share shows a toast. Copy really copies the message.
- **Pincodes:** serviceability and the city/state lookup use small seeded lists.
- **Delivered / Returned:** manual taps by the seller. There is no courier or tracking integration.
- **Track record page:** it shows this browser's demo data, not a shared database.

## Development

TanStack Start + React + Tailwind, built from a Lovable template and synced with Lovable through GitHub.

```sh
bun install
bun run dev      # http://localhost:8080
bun run test     # COD rules, track record and full-path tests
bun run build
```

Edit in the [Lovable editor](https://lovable.dev/projects/53b1bb67-e0e9-4bee-b8be-7f9aec957c25), or push to `main` and the changes sync back into Lovable.
