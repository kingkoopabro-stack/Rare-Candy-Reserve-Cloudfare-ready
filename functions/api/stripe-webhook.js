// POST /api/stripe-webhook — Stripe's server-side payment notice.
// Listens for checkout.session.completed and marks the order paid +
// logs the CS# + notifies both sides, exactly as /api/checkout/confirm
// does — the backstop that makes the red/green light true even when
// the buyer pays and closes the tab without returning. The
// client-return confirm stays the fast path; this is the truth path.
//
// SECURITY: the RAW body is read first (never JSON-parsed before
// verification) and the `Stripe-Signature` header (t + v1 HMAC-SHA256
// with STRIPE_WEBHOOK_SECRET, ~5 min tolerance) is verified before
// anything in the payload is trusted. If STRIPE_WEBHOOK_SECRET is
// unset: 200 { ok:false, reason:"webhook not configured" } and
// NOTHING happens — an unverified request must never mark an order
// paid. Chris creates the secret in the Stripe Dashboard when he
// registers this endpoint URL; it is never invented here.
// When STRIPE_PLATFORM_KEY is also set, the session is re-fetched
// from Stripe before finalizing; otherwise the signature-verified
// event payload itself is trusted (that is what the signature is
// for). Other event types are acknowledged and ignored.
import { json, noDb, getDb, nowMs } from "./_lib.js";
import { stripePlatformConfigured, stripePlatformCall, verifyStripeWebhookSignature } from "./_stripe.js";
import { finalizePaidOrder } from "./_creator.js";

export async function onRequestGet() {
  return json({ ok: false, error: "Stripe webhooks POST here." }, 405);
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const secret = env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret) {
    return json({ ok: false, reason: "webhook not configured" }, 200);
  }
  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return json({ ok: false, error: "Couldn't read the webhook body." }, 400);
  }
  const header = request.headers.get("stripe-signature") || "";
  const valid = await verifyStripeWebhookSignature(raw, header, secret);
  if (!valid) return json({ ok: false, error: "Bad webhook signature." }, 400);
  let event = null;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Bad webhook body." }, 400);
  }
  if (!event || event.type !== "checkout.session.completed") {
    return json({ ok: true, ignored: true });
  }
  let session = (event.data && event.data.object) || null;
  if (!session || !session.id) return json({ ok: false, error: "No session in the webhook event." }, 200);
  const orderId = Number((session.metadata && session.metadata.order_id) || 0);
  if (!orderId) return json({ ok: false, error: "No order in the session metadata." }, 200);
  const order = await db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1").bind(orderId).first();
  if (!order) return json({ ok: false, error: "Order not found." }, 200);
  if (order.status === "paid" || order.status === "shipped" || order.status === "delivered") {
    return json({ ok: true, already: true, order_id: orderId });
  }
  // Re-fetch from Stripe when the platform key is set, so the
  // finalization rests on Stripe's live record, not just the event
  // payload. If the fetch fails, the signature-verified payload
  // still stands — a failed re-check must not lose a real payment.
  if (stripePlatformConfigured(env)) {
    const fresh = await stripePlatformCall(env, "GET", "/checkout/sessions/" + encodeURIComponent(String(session.id)), null, null);
    if (fresh.ok && fresh.data) session = fresh.data;
  }
  if (String((session.metadata && session.metadata.order_id) || "") !== String(orderId)) {
    return json({ ok: false, error: "That checkout doesn't belong to this order." }, 200);
  }
  if (session.payment_status !== "paid") {
    return json({ ok: false, error: "The payment isn't paid yet.", payment_status: session.payment_status || null }, 200);
  }
  const res = await finalizePaidOrder(db, order, session, "", null);
  return json({ ok: true, order_id: orderId, already: !!res.already, cs_number: res.csNumber });
}
