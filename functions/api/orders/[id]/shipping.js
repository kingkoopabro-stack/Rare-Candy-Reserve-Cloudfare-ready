// POST /api/orders/:id/shipping — updateOrderShipping (seller only).
// paid -> shipped -> delivered. Shipped requires a tracking number.
// Marking delivered credits the seller's wallet with their share
// (price minus the 5% street cut) — once only, guarded by the
// sale_credit row for that order.
import {
  json, noDb, getDb, readJson, profileByDevice, CARRIERS,
  PLATFORM_FEE_PERCENT, nowMs, awardLucre, LUCRE_AWARDS,
} from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "No profile on this device." });
  const carrier = String(a.carrier || "").trim();
  if (carrier && !CARRIERS.includes(carrier)) return json({ ok: false, error: "Pick a carrier from the list (USPS, UPS, FedEx, DHL, or Other)." });
  if (a.status === "shipped" && !String(a.tracking_number || "").trim()) return json({ ok: false, error: "Add the tracking number when you mark it shipped — that's what your buyer tracks with." });
  if (!["paid", "shipped", "delivered"].includes(a.status)) return json({ ok: false, error: "Pick paid, shipped, or delivered." });
  const id = Number(params.id);
  const o = await db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1").bind(id).first();
  if (!o) return json({ ok: false, error: "That order is gone." });
  if (o.seller_id !== me.id) return json({ ok: false, error: "Only the seller updates shipping on an order." });
  await db.prepare("UPDATE orders SET status = ?, carrier = ?, tracking_number = ?, updated_at = ? WHERE id = ?")
    .bind(a.status, carrier.slice(0, 20), String(a.tracking_number || "").trim().slice(0, 60), nowMs(), id).run();
  if (a.status === "delivered") {
    const existing = await db.prepare("SELECT id FROM payout_entries WHERE order_id = ? AND kind = 'sale_credit' LIMIT 1").bind(id).first();
    if (!existing) {
      const fee = Math.round((o.amount_cents * PLATFORM_FEE_PERCENT) / 100);
      await db.prepare(
        "INSERT INTO payout_entries (profile_id, kind, amount_cents, note, status, order_id, created_at) VALUES (?, 'sale_credit', ?, ?, 'available', ?, ?)",
      ).bind(me.id, o.amount_cents - fee, o.item_title, id, nowMs()).run();
      // Lucre (v3.11) — 40 each for a completed transaction: the seller
      // and the buyer both did the deal. Once per order (ledger key).
      await awardLucre(db, me.id, LUCRE_AWARDS.transaction, "transaction", "order:" + String(id) + ":seller");
      if (o.buyer_id && o.buyer_id !== me.id) {
        await awardLucre(db, o.buyer_id, LUCRE_AWARDS.transaction, "transaction", "order:" + String(id) + ":buyer");
      }
    }
  }
  return json({ ok: true, error: null });
}
