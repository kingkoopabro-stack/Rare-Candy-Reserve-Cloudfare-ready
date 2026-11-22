// GET /api/connect/status?device_id= — has this seller finished
// linking their bank? Asks Stripe for the Connect account and reports
// charges_enabled + payouts_enabled. When both are true the profile
// is marked connect_onboarded, which is the gate for listing and
// getting paid.
import { json, noDb, getDb, profileByDevice } from "../_lib.js";
import { stripePlatformConfigured, stripePlatformCall } from "../_stripe.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first." });
  if (!me.connect_account_id) {
    return json({ ok: true, onboarded: false, charges_enabled: false, payouts_enabled: false, account_id: null });
  }
  if (!stripePlatformConfigured(env)) {
    return json({ ok: true, onboarded: false, charges_enabled: false, payouts_enabled: false, account_id: me.connect_account_id, note: "Stripe isn't connected right now." });
  }
  const acct = await stripePlatformCall(env, "GET", "/accounts/" + encodeURIComponent(me.connect_account_id), null, null);
  if (!acct.ok) return json({ ok: false, error: acct.error });
  const charges = acct.data.charges_enabled === true;
  const payouts = acct.data.payouts_enabled === true;
  const onboarded = charges && payouts;
  if (onboarded && me.connect_onboarded !== 1) {
    try { await db.prepare("UPDATE profiles SET connect_onboarded = 1 WHERE id = ?").bind(me.id).run(); } catch { /* column not there yet */ }
  }
  return json({ ok: true, onboarded, charges_enabled: charges, payouts_enabled: payouts, account_id: me.connect_account_id });
}
