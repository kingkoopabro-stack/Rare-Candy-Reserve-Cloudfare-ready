// POST /api/checkout/confirm — the buyer comes back from Stripe's
// hosted checkout. We ask Stripe what really happened (never trust
// the URL alone): if the session's payment_status is "paid" and its
// metadata names this order, the order is marked paid and the listing
// sold. Idempotent — confirming twice is harmless. The seller is
// notified in-app (and by email/text if they asked for them): the
// money is captured and on its way to their bank on Stripe's payout
// schedule, typically ~2 business days — never "instant".
// The paid-marking itself lives in finalizePaidOrder (_creator.js),
// shared with the Stripe webhook — the webhook is the backstop that
// makes the green light true when the buyer pays and closes the tab
// without returning.
import { json, noDb, getDb, readJson, profileByDevice } from "../_lib.js";
import { stripePlatformConfigured, stripePlatformCall } from "../_stripe.js";
import { finalizePaidOrder } from "../_creator.js";

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
  const res = await finalizePaidOrder(db, o, s, request.headers.get("cf-connecting-ip") || "", me);
  return json({ ok: true, error: null, order_id: orderId, cs_number: res.csNumber, watermark_text: res.watermarkText });
}
