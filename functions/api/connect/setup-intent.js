// POST /api/connect/setup-intent — start saving a card for an offer.
// Returns a Stripe SetupIntent client_secret the buyer confirms with
// Stripe.js. The card is authorized when the offer is made and charged
// only if the seller accepts — nothing moves on a decline or a
// counter. The payment method id comes back from Stripe.js after the
// buyer confirms; the offer endpoint attaches it to the buyer.
import { json, noDb, getDb, readJson, profileByDevice } from "../../_lib.js";
import { stripePlatformConfigured, stripePlatformCall } from "../../_stripe.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  if (!stripePlatformConfigured(env)) return json({ ok: false, error: "Card checkout isn't switched on yet." });
  let customerId = me.stripe_customer_id || null;
  if (!customerId) {
    const c = await stripePlatformCall(env, "POST", "/v1/customers", {
      email: me.contact_email || "", name: me.username || "",
      metadata: { profile_id: String(me.id) },
    });
    if (c.error) return json({ ok: false, error: c.error });
    customerId = c.data && c.data.id;
    if (!customerId) return json({ ok: false, error: "Stripe couldn't start the card setup." });
    try { await db.prepare("UPDATE profiles SET stripe_customer_id = ? WHERE id = ?").bind(customerId, me.id).run(); } catch { /* column not there yet */ }
  }
  const si = await stripePlatformCall(env, "POST", "/v1/setup_intents", {
    customer: customerId, payment_method_types: ["card"], usage: "off_session",
  });
  if (si.error) return json({ ok: false, error: si.error });
  return json({ ok: true, error: null, client_secret: si.data && si.data.client_secret, customer_id: customerId });
}
