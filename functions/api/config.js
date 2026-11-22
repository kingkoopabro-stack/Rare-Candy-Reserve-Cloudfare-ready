// GET /api/config — public site config the browser needs: whether
// card checkout / Connect are switched on, and the Stripe publishable
// key (public by design — it only identifies the account, it can't
// move money). Secret keys are never exposed here.
import { json, noDb, getDb } from "./_lib.js";
import { stripePlatformConfigured } from "./_stripe.js";

export async function onRequestGet({ env }) {
  const db = getDb(env);
  if (!db) return noDb();
  return json({
    ok: true,
    checkout_enabled: stripePlatformConfigured(env),
    connect_enabled: stripePlatformConfigured(env),
    stripe_publishable_key: env.STRIPE_PUBLISHABLE_KEY || null,
  });
}
