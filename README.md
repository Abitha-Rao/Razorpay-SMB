# Chat Checkout

A mobile-first app for one-person Instagram and WhatsApp sellers. The seller pastes the buyer's order message, AI drafts the order, the seller confirms it and shares a payment link from their own WhatsApp, and the buyer pays through a checkout modelled on Razorpay Magic Checkout. If the buyer picks cash on delivery (COD), a few simple rules decide what they're offered. The seller marks each order Delivered or Returned, and their track record builds from real, paid deliveries.

> This is an unofficial concept build. The checkout is simulated: no real payments happen, the OTP accepts any 6 digits, and nothing is sent to a buyer. It is not affiliated with or endorsed by Razorpay.

## Product note

*Chat Checkout: Razorpay for sellers who sell on Instagram and WhatsApp.* A mobile flow for one-person sellers who run their business from a phone: turn a buyer's chat into a verified Razorpay order, in under two minutes. The one-page original is in [docs/ChatCheckout_ProductNote.pdf](docs/ChatCheckout_ProductNote.pdf).

### Problem

| Persona                                       | How they sell today                                                                                                   | Their problem                                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Shristi, 24, ethnic-wear reseller (Jaipur)    | Posts reels on Instagram; takes 10-15 orders a day in DMs; most buyers pick COD.                                      | About 1 in 3 COD parcels comes back and she pays freight both ways, ₹150-300 each time.                                     |
| Kavita, 45, home-made snacks and pickles (Hyderabad) | Steady repeat orders from family, friends and word of mouth on WhatsApp; recently opened an Instagram page to reach strangers. | Instagram buyers see a new account with few followers and won't pay someone they can't verify, though she has years of happy customers on WhatsApp. |
| Yash, 28, daily salad bowls (Bangalore)       | Posts the menu on WhatsApp; buyers fill a Google Form and upload their payment screenshot; 20-40 bowls a day.         | He has to match each screenshot to each form entry by hand, so some payments are missed and some orders are made without a confirmed payment. |

**Primary problem: COD orders that come back.** 14 of 22 sellers interviewed take mostly COD, and 35-40% of social-commerce COD orders are returned. Each costs the seller freight both ways, with no sale. They can't screen a COD buyer, because Razorpay's COD checks need a website. Also found in interviews: orders live in chats (19/22 track them there), payments are checked by screenshot so some are missed, and new buyers can't tell if a seller is genuine. 20/22 wanted an easier way to manage orders and payments.

**The gap.** Razorpay's checkout intelligence, including COD checks and saved addresses in Magic Checkout, is built for merchants with a Shopify/WooCommerce store, app or website to plug it into. Sellers without one get Payment Links, which collect money but don't help build the order, check a COD buyer or track what happens after.

### Solution

1. **Order from a chat message.** The seller sends her order format (name, item, size, quantity, phone). The buyer fills it in and replies, and the seller pastes the reply into the app. AI turns it into a ready order; the seller verifies it and shares the link back to the buyer.
2. **Safer checkout for the buyer.** The buyer checks the order and enters their address, which is checked for gaps. For COD, blocked buyers can't choose it, and others may see a prepaid offer or a small COD fee.
3. **Orders in the app.** Paid orders confirm automatically and show up with their status. Sellers mark delivered or returned.
4. **Track record.** Paid and delivered orders build a record on the seller's link, building toward a Trusted Business Badge.

### Decisions

- **In the MVP:** AI drafts and seller confirms, address check, COD rules, auto-confirm payment, delivered/returned marking and track record.
- **Left out on purpose:** Razorpay-sent messages (the seller owns the buyer relationship), a storefront builder, a new risk engine (reuses Magic Checkout), AI talking to buyers.
- **Bigger bet:** An opt-in, approval-first order bot on WhatsApp Business (needs Meta approval); courier tracking IDs marking delivered/returned.
- **Risks and mitigations:**
  - *Track record starts empty.* It counts only Chat Checkout orders, so it can't be faked with imported history. New sellers see little value at first.
  - *Buyers drop off at the address step.* Three fields to type, city and state fill from the pincode, and addresses are saved for repeat buyers.
  - *Sellers forget to mark delivered or returned.* Records stay incomplete, so the app reminds them after the expected delivery date.

### Success metrics

- **North Star, paid-and-delivered rate:** share of Chat Checkout orders that end paid and delivered, not returned or abandoned. It rises when fewer COD parcels come back, fewer buyers drop off and fewer payments are missed.
- **COD return rate:** returned or refused COD orders ÷ shipped COD orders, sellers with the checks vs a holdout group, over 60 days.
- **Drafts confirmed without edits:** drafts confirmed unedited ÷ all drafts, weekly.
- **Sellers active at month 3:** sellers with a paid order in month 3 ÷ those with one in month 1, by signup cohort.
- **Guardrail, checkout drop-out:** share of buyers who open the link but don't pay, compared with plain Payment Links.

### Why Razorpay, and why now

- **Moat:** existing Payment Links rails and Magic Checkout models, trained on 100M+ shoppers, which a chat-commerce startup can't match.
- **Cross-sell:** a seller's track record can qualify them for Capital loans, tapping the MSME credit gap, and can lead to a paid analytics tier later.
- **Direction:** Agent Studio (March 2026) already serves small businesses, nearly 80% of Razorpay's customers. Chat Checkout reaches those with no store, app or website.
- **Timing:** as Razorpay grows revenue beyond payments, new lines matter. Sellers who start now build their track record on Razorpay before they ever open a website.

## Full path (under 2 minutes)

1. **Seller app** → **New order** → **Use a sample message** (fills the order message and drafts the order in one tap). Check the draft, then **Create payment link**.
2. **Share on WhatsApp** (or **Copy message**). The app never messages the buyer itself.
3. **Buyer view** → mobile number → **Continue** → any 6 digits → **Continue** → address (new number) → **Continue** → pick a payment method → **Pay**.
4. **Seller app** → **Orders** → open the order → **Mark delivered**.
5. **Record** shows the track record grow (paid & delivered orders, return rate).

Tap **Use a sample message** again for the next sample. The first four each meet a different COD rule, and the fifth is a buyer's filled-in order format with Size left blank:

| Sample                    | Buyer                                                      | What they see under Payment Options                                  |
| ------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. New buyer, COD         | Priya (new number), asks for a kurti without naming a size | COD selectable, with a banner nudging them to pay online             |
| 2. Returned parcel        | Rohit (one returned order)                                 | "Pay a part now, rest on delivery" with the amount                   |
| 3. Blocked buyer          | Vikram (on the Blocked list)                               | COD disabled: "COD isn't available for this order"                   |
| 4. Trusted buyer          | Anjali (on the Trusted list)                               | COD selectable, no banner; her saved address loads after the OTP     |
| 5. Filled-in order format | Kavya (Size left blank)                                    | Size is flagged as missing; the COD rules apply as for any new buyer |

**Reset** (top right) restores the seed data: one seller, 12 orders (one returned order, one trusted buyer, one blocked buyer), saved addresses for the seed buyers, the ₹49 COD fee, free shipping on prepaid, and the Trusted and Blocked lists. The state is saved in `localStorage`, so a refresh keeps what you created.

## Seller flow

- **Paste the buyer's order message.** AI drafts items, quantity, price and buyer name, and flags missing details such as size or weight under "Check these", right above the drafted lines. A sized item with no size is also flagged on its own line, and the form works this out itself, so the flag shows even if the AI reports nothing. It clears as soon as the seller types a size.
- **Copy order format.** A secondary button by the message box copies a short form for the buyer to fill in (Name, Item, Size, Quantity, Phone) and shows "Order format copied, send it to your buyer". When the filled-in reply is pasted, the AI draft, and the offline parser when AI is unavailable, read each "Label: value" line. A blank field is flagged like any missing detail: a blank Size on a sized item, and a blank Name, Item, Quantity or Phone each get their own flag. "-" and "n/a" count as blank.
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

One list of all orders: buyer, amount, prepaid or COD, payment status, and the Override and Mark now tags. Search and filters by status and payment type. The seller marks each order **Delivered** or **Returned** by hand. Nothing is automatic.

**Reminder to mark delivery.** An order needs marking when it is paid, COD-confirmed or part-paid and was confirmed more than 3 days ago (from its payment or confirmation time in the timeline, or `createdAt` if there isn't one). A banner on Home and at the top of Orders says how many ("2 orders confirmed over 3 days ago. Mark them delivered or returned to keep your track record accurate."). Tapping it filters Orders to those orders, each with a **Mark now** tag, and **Show all orders** lifts the filter. The banner is hidden when nothing needs marking.

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
