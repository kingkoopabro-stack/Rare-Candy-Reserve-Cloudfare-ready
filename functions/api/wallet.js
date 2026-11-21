// GET /api/wallet — getMyWallet: available balance (delivered sales minus
// payouts requested), pending balance (paid/shipped sales not yet
// delivered), lifetime earnings, payout method on file, payout history.
import { json, noDb, getDb, profileByDevice, PLATFORM_FEE_PERCENT, iso } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const empty = { ok: false, error: "Create your profile first — your wallet lives on it.", balance_cents: 0, pending_cents: 0, lifetime_cents: 0, payout_method: "", payout_handle: "", entries: [] };
  const me = await profileByDevice(db, deviceId);
  if (!me) return json(empty);
  const { results } = await db.prepare("SELECT * FROM payout_entries WHERE profile_id = ? ORDER BY id DESC").bind(me.id).all();
  const rows = results || [];
  let balance = 0;
  let lifetime = 0;
  for (const e of rows) {
    if (e.kind === "sale_credit") { lifetime += e.amount_cents; if (e.status === "available") balance += e.amount_cents; }
    if (e.kind === "payout_request" && (e.status === "requested" || e.status === "sent")) balance -= e.amount_cents;
  }
  const { results: sales } = await db.prepare("SELECT amount_cents, shipping_cents, status FROM orders WHERE seller_id = ?").bind(me.id).all();
  let pending = 0;
  for (const o of (sales || [])) {
    // Fee on item price only; shipping passes through to the seller
    // (they pay the postage); tax never lands in the wallet — it
    // belongs to the state and is remitted from Stripe/PayPal.
    if (o.status === "paid" || o.status === "shipped") pending += o.amount_cents - Math.round((o.amount_cents * PLATFORM_FEE_PERCENT) / 100) + (o.shipping_cents || 0);
  }
  return json({
    ok: true, error: null,
    balance_cents: Math.max(0, balance), pending_cents: pending, lifetime_cents: lifetime,
    payout_method: me.payout_method ?? "", payout_handle: me.payout_handle ?? "",
    entries: rows.map((e) => ({ id: e.id, kind: e.kind, amount_cents: e.amount_cents, note: e.note ?? "", status: e.status, created_at: iso(e.created_at) })),
  });
}
