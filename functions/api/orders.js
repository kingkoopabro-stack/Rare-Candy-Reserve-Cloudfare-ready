// GET /api/orders?team=1 — the 💰 Transactions queue for the team
// (operator / admin / mod). Unpaid first, then newest. Each row is
// the normal order shape plus a light: red = pending_payment (or a
// manual payment not yet marked paid), green = paid (Stripe-verified)
// or marked-paid (manual tag, so the team can tell it apart at a
// glance). CS#, buyer/seller, amount, date, and the dispute flag
// ride on the shape already. Guests and regular members get nothing.
// My Orders stays the per-member view (my-orders.js) — this queue is
// the review side only.
import { json, noDb, getDb, profileByDevice, shapeOrder, profilesMap, roleOf, isTeamRole } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first.", orders: [] });
  if (!isTeamRole(roleOf(me))) return json({ ok: false, error: "The transactions queue is for the team only.", orders: [] });
  if (q.get("team") !== "1") {
    return json({ ok: false, error: "Your own orders live in My Orders — this list is the team review queue (?team=1).", orders: [] });
  }
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "100", 10) || 100, 1), 200);
  let rows;
  try {
    ({ results: rows } = await db.prepare(
      "SELECT * FROM orders ORDER BY CASE WHEN status = 'pending_payment' THEN 0 ELSE 1 END, created_at DESC LIMIT ?",
    ).bind(limit).all());
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: "Orders aren't set up yet — the shop is still running a quick database update.", orders: [] });
    throw e;
  }
  const names = await profilesMap(db);
  const out = [];
  for (const r of (rows || [])) {
    const shaped = await shapeOrder(db, r, names);
    const paid = r.status === "paid" || r.status === "shipped" || r.status === "delivered" || r.marked_paid_at != null;
    out.push({
      ...shaped,
      light: paid ? "green" : "red",
      paid_via: (r.payment_method ?? "stripe") === "manual" ? "manual" : "stripe",
      marked_paid: r.marked_paid_at != null,
    });
  }
  return json({ ok: true, orders: out });
}
