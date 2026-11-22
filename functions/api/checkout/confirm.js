// POST /api/checkout/confirm — the buyer comes back from Stripe's
// hosted checkout. We ask Stripe what really happened (never trust
// the URL alone): if the session's payment_status is "paid" and its
// metadata names this order, the order is marked paid and the listing
// sold. Idempotent — confirming twice is harmless. The seller is
// notified in-app (and by email/text if they asked for them): the
// money is captured and on its way to their bank on Stripe's payout
// schedule, typically ~2 business days — never "instant".
import { json, noDb, getDb, readJson, profileByDevice, nowMs, notifyBuyerSeller, notifyTeam, money, createContentSale } from "../_lib.js";
import { stripePlatformConfigured, stripePlatformCall } from "../_stripe.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, order_id: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your account first.");
  const orderId = Number(a.order_id || 0);
  const sessionId = String(a.session_id || "").trim();
  if (!orderId || !sessionId) return fail("Missing the checkout details — open the order from My Orders and try again.");
  const o = await db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1").bind(orderId).first();
  if (!o) return fail("That order is gone.");
  if (o.buyer_id !== me.id) return fail("Only the buyer confirms their own checkout.");
  if (o.status === "paid" || o.status === "shipped" || o.status === "delivered") {
    return json({ ok: true, error: null, order_id: orderId, already: true });
  }
  if (o.status !== "pending_payment") return fail("That order isn't waiting on a payment.");
  if (!stripePlatformConfigured(env)) return fail("Stripe isn't connected, so the payment can't be verified yet — the order stays pending. Nothing was charged twice.");
  const session = await stripePlatformCall(env, "GET", "/checkout/sessions/" + encodeURIComponent(sessionId), null, null);
  if (!session.ok) return fail(session.error);
  const s = session.data || {};
  if (String((s.metadata && s.metadata.order_id) || "") !== String(orderId)) {
    return fail("That checkout doesn't belong to this order.");
  }
  if (s.payment_status !== "paid") {
    return fail(s.payment_status === "unpaid" ? "The payment didn't go through — no money moved. You can try again from My Orders." : "The payment is still " + s.payment_status + " — check back in a moment.");
  }
  const now = nowMs();
  await db.prepare("UPDATE orders SET status = 'paid', updated_at = ? WHERE id = ?").bind(now, orderId).run();
  await db.prepare("UPDATE listings SET status = 'sold', updated_at = ? WHERE id = ?").bind(now, o.listing_id).run();
  try {
    await db.prepare("UPDATE orders SET stripe_payment_intent_id = ? WHERE id = ?").bind(s.payment_intent || null, orderId).run();
  } catch { /* column not there yet — harmless */ }
  // CS# for digital listings — same log as creator-post sales: a
  // sequential number, the buyer IP server-side only, and the watermark
  // line for the buyer's copy. The sale record carries the
  // " [Digital Asset]" label (see _lib.js createContentSale).
  const listing = await db.prepare("SELECT listing_type, is_private FROM listings WHERE id = ? LIMIT 1").bind(o.listing_id).first();
  const isDigital = !!(listing && listing.listing_type === "digital");
  const isPrivate = !!(listing && listing.is_private === 1);
  let csNumber = null;
  let watermarkText = "";
  if (isDigital) {
    const seller = await db.prepare("SELECT id, username FROM profiles WHERE id = ? LIMIT 1").bind(o.seller_id).first();
    const cs = await createContentSale(db, {
      listingId: o.listing_id, buyerId: me.id, buyerUsername: me.username,
      sellerId: o.seller_id, sellerUsername: (seller && seller.username) || "",
      itemTitle: o.item_title, amountCents: o.amount_cents,
      buyerIp: request.headers.get("cf-connecting-ip") || "", now, digital_asset: true,
    });
    csNumber = cs.csNumber;
    watermarkText = cs.watermarkText;
  }
  // Notifications — seller hears first (a sale!), buyer gets the receipt.
  const sellerProfile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(o.seller_id).first();
  const buyerProfile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(o.buyer_id).first();
  await notifyBuyerSeller(db, sellerProfile, me, "sale",
    "💰 @" + me.username + " bought your \"" + o.item_title + "\" for " + money(o.amount_cents) + " — payment captured, on its way to your bank on Stripe's payout schedule (typically ~2 business days).",
    "#/orders", "order", orderId);
  await notifyBuyerSeller(db, buyerProfile, me, "order",
    "✅ Your order for \"" + o.item_title + "\" is paid — " + money(o.amount_cents) + ". The seller ships it with tracking; tap \"I got it\" when it lands.",
    "#/orders", "order", orderId);
  // Private sale — the operator (Chris) hears about every one, same as
  // a Flea Market sale.
  if (isPrivate) {
    await notifyTeam(db, me, "🔒 Private sale: @" + me.username + " bought \"" + o.item_title + "\" from @" + ((sellerProfile && sellerProfile.username) || "member") + " for " + money(o.amount_cents) + (isDigital ? " (Digital Asset)" : " (physical)") + " — payment captured.", "#/orders", orderId);
  }
  return json({ ok: true, error: null, order_id: orderId, cs_number: csNumber, watermark_text: watermarkText });
}
