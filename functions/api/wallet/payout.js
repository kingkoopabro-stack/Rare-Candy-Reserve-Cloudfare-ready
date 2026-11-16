// POST /api/wallet/payout — requestPayout. Requests a payout of the
// caller's full available wallet balance to the payout method on their
// profile. Records the request in payout history; the money itself is sent
// to that method outside the app (no payment processor is connected).
import { json, noDb, getDb, readJson, profileByDevice, nowMs } from "../_lib.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "No profile on this device.", amount_cents: 0 });
  if (!me.payout_method || !me.payout_handle) return json({ ok: false, error: "Set up your payout method + handle in your profile first — that's where the money goes.", amount_cents: 0 });
  const { results } = await db.prepare("SELECT kind, status, amount_cents FROM payout_entries WHERE profile_id = ?").bind(me.id).all();
  let balance = 0;
  for (const e of (results || [])) {
    if (e.kind === "sale_credit" && e.status === "available") balance += e.amount_cents;
    if (e.kind === "payout_request" && (e.status === "requested" || e.status === "sent")) balance -= e.amount_cents;
  }
  if (balance <= 0) return json({ ok: false, error: "Nothing available to pay out yet — your balance lands here when an order is marked delivered.", amount_cents: 0 });
  await db.prepare(
    "INSERT INTO payout_entries (profile_id, kind, amount_cents, note, status, created_at) VALUES (?, 'payout_request', ?, ?, 'requested', ?)",
  ).bind(me.id, balance, `Payout to ${me.payout_method}`, nowMs()).run();
  return json({ ok: true, error: null, amount_cents: balance });
}
