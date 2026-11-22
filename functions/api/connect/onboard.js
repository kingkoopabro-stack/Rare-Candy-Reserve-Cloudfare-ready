// POST /api/connect/onboard — link your bank, once. Creates the
// seller's Stripe Connect Express account (if they don't have one)
// and returns Stripe's hosted onboarding link, where the seller
// verifies their identity and links their bank. The site never sees
// bank details — Stripe holds them. Until Chris sets the platform key
// (STRIPE_PLATFORM_KEY) this answers "not switched on yet".
import { json, noDb, getDb, readJson, profileByDevice } from "../_lib.js";
import { stripePlatformConfigured, stripePlatformCall } from "../_stripe.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  if (!stripePlatformConfigured(env)) {
    return json({ ok: false, error: "Bank linking isn't switched on yet — the shop is still setting up Stripe Connect. Your sales wait until then; nothing is lost." });
  }
  let accountId = me.connect_account_id || null;
  if (!accountId) {
    const acct = await stripePlatformCall(env, "POST", "/accounts", {
      type: "express", country: "US",
      email: me.contact_email || undefined,
      "capabilities[card_payments][requested]": "true",
      "capabilities[transfers][requested]": "true",
      "metadata[profile_id]": String(me.id),
      "metadata[username]": me.username,
    }, "rcr-connect-" + me.id);
    if (!acct.ok) return json({ ok: false, error: acct.error });
    accountId = acct.data.id;
    try {
      await db.prepare("UPDATE profiles SET connect_account_id = ? WHERE id = ?").bind(accountId, me.id).run();
    } catch { return json({ ok: false, error: "The bank-linking update hasn't run yet — try again in a bit." }); }
  }
  const origin = new URL(request.url).origin;
  const link = await stripePlatformCall(env, "POST", "/account_links", {
    account: accountId,
    refresh_url: origin + "/community.html#/payouts?connect=refresh",
    return_url: origin + "/community.html#/payouts?connect=done",
    type: "account_onboarding",
  }, null);
  if (!link.ok) return json({ ok: false, error: link.error });
  return json({ ok: true, error: null, url: link.data.url, account_id: accountId });
}
