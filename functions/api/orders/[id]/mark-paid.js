// POST /api/orders/:id/mark-paid — record that a manual payment
// landed (Cash App / PayPal / Venmo — the site cannot see those
// payments, so a person has to say so).
//
// { device_id, note? }. Seller on that order, or any team member.
// Records marked_paid_by + marked_paid_at on the order; the light
// flips green with the manual tag. For digital orders the CS# sale is
// logged here too, so the buyer's copy unlocks in "My stuff" the
// moment the payment is marked — the content stays locked until
// then. The optional note (≤140 chars) rides in the notification
// text only; it is not stored on the order. Stripe orders never need
// this — their light flips green on verification instead.
import { json, noDb, getDb, readJson, profileByDevice, shapeOrder, profilesMap, roleOf, isTeamRole } from "../../_lib.js";
import { markOrderPaidManual } from "../../_creator.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "No profile on this device." });
  const id = Number(params.id);
  const o = await db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1").bind(id).first();
  if (!o) return json({ ok: false, error: "That order is gone." });
  const team = isTeamRole(roleOf(me));
  if (o.seller_id !== me.id && !team) return json({ ok: false, error: "Only the seller on this order — or the team — can mark it paid." });
  if (o.status === "paid" || o.status === "shipped" || o.status === "delivered") {
    return json({ ok: false, error: "That order is already paid." });
  }
  if (o.status !== "pending_payment") return json({ ok: false, error: "That order isn't waiting on a payment." });
  const res = await markOrderPaidManual(db, o, me, a.note);
  const fresh = await db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1").bind(id).first();
  const names = await profilesMap(db);
  const shaped = await shapeOrder(db, fresh, names);
  return json({ ok: true, error: null, order: { ...shaped, light: "green", paid_via: "manual", marked_paid: true }, cs_number: res.csNumber });
}
