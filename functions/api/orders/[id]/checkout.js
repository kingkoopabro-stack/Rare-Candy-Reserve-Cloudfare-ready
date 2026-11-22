// POST /api/orders/:id/checkout — resume a payment. The buyer started
// a purchase (or had an offer accepted) but didn't finish paying on
// Stripe — the order sits in pending_payment. This makes a FRESH
// Checkout Session for the same order (new session id, same amount)
// and returns its URL. Nothing is charged here; the listing is marked
// sold only when the payment is confirmed (see /api/checkout/confirm).
import { json, noDb, getDb, readJson, profileByDevice, imageUrl } from "../../_lib.js";
import { stripePlatformConfigured, createCheckoutSession } from "../../_stripe.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  const id = Number(params.id);
  const o = await db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1").bind(id).first();
  if (!o) return json({ ok: false, error: "That order is gone." });
  if (o.buyer_id !== me.id) return json({ ok: false, error: "Only the buyer pays for their order." });
  if (o.status !== "pending_payment") return json({ ok: false, error: "That order isn't waiting on a payment." });
  const l = await db.prepare("SELECT * FROM listings WHERE id = ? LIMIT 1").bind(o.listing_id).first();
  if (!l || l.status !== "active") return json({ ok: false, error: "That listing is gone — the order can't be paid anymore." });
  const seller = await db.prepare("SELECT connect_account_id FROM profiles WHERE id = ? LIMIT 1").bind(o.seller_id).first();
  if (!seller || !seller.connect_account_id) return json({ ok: false, error: "The seller hasn't linked their bank yet, so checkout can't run. Nothing was charged." });
  if (!stripePlatformConfigured(env)) return json({ ok: false, error: "Card checkout isn't switched on yet — the shop is still setting it up. Nothing was charged." });
  const origin = new URL(request.url).origin;
  const isDigital = (l.listing_type ?? "physical") === "digital";
  const checkout = await createCheckoutSession(env, {
    orderId: id, listingId: o.listing_id, itemName: o.item_title + " — Rare Candy Reserve",
    amountCents: o.amount_cents, shippingCents: o.shipping_cents ?? 0,
    destinationAccount: seller.connect_account_id,
    digitalAsset: isDigital,
    imageUrl: l.image_blob_key ? origin + imageUrl(l.image_blob_key) : null,
    successUrl: origin + "/community.html#/orders?checkout=success&session_id={CHECKOUT_SESSION_ID}&order_id=" + id,
    cancelUrl: origin + "/community.html#/listing/" + o.listing_id + "?checkout=cancelled",
  });
  if (checkout.error) return json({ ok: false, error: checkout.error });
  try {
    await db.prepare("UPDATE orders SET stripe_session_id = ? WHERE id = ?").bind(checkout.sessionId, id).run();
  } catch { /* column not there yet */ }
  return json({ ok: true, error: null, checkout_url: checkout.url, order_id: id });
}
