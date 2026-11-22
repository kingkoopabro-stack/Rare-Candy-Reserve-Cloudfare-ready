// POST /api/listings/:id/buy — start a Flea Market purchase. The buyer
// taps Buy → an order is recorded as pending_payment → a Stripe
// Checkout Session is created (destination charge: the money lands in
// the seller's Connect account, minus the 6% platform cut) → the
// buyer pays on Stripe's hosted checkout screen. NOTHING is charged
// here, and the listing is NOT marked sold until the payment is
// confirmed (see /api/checkout/confirm). No private-chat payments —
// the card goes on Stripe, the seller gets paid automatically to the
// bank they linked. PayPal is not part of this flow: it cannot be
// split into a Connect payout, so Flea Market buys are card-only.
// (The operator's own catalog keeps its PayPal + Stripe links.)
import { json, noDb, getDb, readJson, profileByDevice, nowMs, imageUrl } from "../../_lib.js";
import { stripePlatformConfigured, createCheckoutSession } from "../../_stripe.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, order_id: null, checkout_url: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to buy — orders live on your profile.");
  const id = Number(params.id);
  const l = await db.prepare("SELECT * FROM listings WHERE id = ? LIMIT 1").bind(id).first();
  if (!l) return fail("That listing is gone.");
  if (l.status !== "active") return fail("That item already sold.");
  if (l.profile_id === me.id) return fail("You can't buy your own listing.");
  // Creator menu / packages (2026-11-21, §12.8 build-time check): the
  // list/single GETs already gate private listings, but the buy
  // endpoint never did — anyone who guessed the id could pay for a
  // private sale meant for someone else. Only the designated buyer
  // can buy a private listing (the operator included: they review
  // sales, they don't take them).
  if (l.is_private === 1 && l.private_buyer_id !== me.id) {
    return fail("That private sale was set up for someone else — only the buyer it was set up for can pay for it.");
  }
  if (l.kind === "trade") return fail("Trade listings aren't bought — leave a comment on the listing to offer your trade.");
  let amount = l.price_cents;
  if (l.kind === "flea") {
    const { results } = await db.prepare("SELECT profile_id, amount_cents FROM bids WHERE listing_id = ?").bind(id).all();
    const lb = results || [];
    const top = lb.length ? Math.max(...lb.map((b) => b.amount_cents)) : null;
    if (top == null || !lb.some((b) => b.profile_id === me.id && b.amount_cents === top)) {
      return fail("Only the high bidder can complete a flea-market purchase.");
    }
    amount = top;
  }
  // The seller must have linked their bank (Connect) before anyone can
  // buy — otherwise the money has nowhere automatic to go.
  const seller = await db.prepare("SELECT id, username, connect_account_id, connect_onboarded FROM profiles WHERE id = ? LIMIT 1").bind(l.profile_id).first();
  if (!seller || !seller.connect_account_id) {
    return fail("This seller hasn't linked their bank yet, so checkout can't run — the sale waits until they do (one-time setup in Payouts). Nothing was charged.");
  }
  if (!stripePlatformConfigured(env)) {
    return fail("Card checkout isn't switched on yet — the shop is still setting it up. Nothing was charged.");
  }
  const listingType = l.listing_type ?? "physical";
  const shipCents = listingType === "digital" ? 0 : Math.round(Number(l.shipping_cents) || 0);
  const now = nowMs();
  const isNoColumn = (e) => /no such column|no column named/i.test(String((e && e.message) || e));
  let r;
  try {
    r = await db.prepare(
      "INSERT INTO orders (listing_id, buyer_id, seller_id, item_title, amount_cents, shipping_cents, status, created_at, updated_at, package_id) VALUES (?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?)",
    ).bind(id, me.id, l.profile_id, l.title, amount, shipCents, now, now, l.package_id ?? null).run();
  } catch (e) {
    // Missing-column fallbacks, one tier at a time — the tax
    // migration (shipping_cents) and the creator-menu migration
    // (package_id) may each be un-run. The CS# log still recovers
    // the package from the listing row at confirm time, so dropping
    // the column here never loses the delivery.
    if (!isNoColumn(e)) throw e;
    try {
      r = await db.prepare(
        "INSERT INTO orders (listing_id, buyer_id, seller_id, item_title, amount_cents, shipping_cents, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?)",
      ).bind(id, me.id, l.profile_id, l.title, amount, shipCents, now, now).run();
    } catch (e2) {
      if (!isNoColumn(e2)) throw e2;
      r = await db.prepare(
        "INSERT INTO orders (listing_id, buyer_id, seller_id, item_title, amount_cents, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending_payment', ?, ?)",
      ).bind(id, me.id, l.profile_id, l.title, amount, now, now).run();
    }
  }
  const orderId = r.meta.last_row_id;
  const origin = new URL(request.url).origin;
  const isDigital = listingType === "digital";
  const checkout = await createCheckoutSession(env, {
    orderId, listingId: id, itemName: l.title + " — Rare Candy Reserve",
    amountCents: amount, shippingCents: shipCents,
    destinationAccount: seller.connect_account_id,
    digitalAsset: isDigital,
    imageUrl: l.image_blob_key ? origin + imageUrl(l.image_blob_key) : null,
    successUrl: origin + "/community.html#/orders?checkout=success&session_id={CHECKOUT_SESSION_ID}&order_id=" + orderId,
    cancelUrl: origin + "/community.html#/listing/" + id + "?checkout=cancelled",
  });
  if (checkout.error) {
    // The order stays pending_payment — the buyer can retry from
    // My Orders, and the seller sees it as unpaid, never as sold.
    return json({ ok: false, error: checkout.error, order_id: orderId, checkout_url: null });
  }
  try {
    await db.prepare("UPDATE orders SET stripe_session_id = ? WHERE id = ?").bind(checkout.sessionId, orderId).run();
  } catch { /* stripe_session_id column not there yet — confirm still works off the session id */ }
  return json({ ok: true, error: null, order_id: orderId, checkout_url: checkout.url, amount_cents: amount, shipping_cents: shipCents });
}
