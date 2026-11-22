// POST /api/orders/:id/confirm — buyer confirms receipt ("I got it").
// Shipped → delivered: the seller's wallet is credited, with the same
// once-only guarded sale_credit as marking delivered from the shipping
// form (fee on the item price only, shipping passes through, Lucre for
// both sides). Already delivered → just stamps the confirmation, no
// second credit. Paid (not shipped yet) → wait until it ships.
import { json, noDb, getDb, readJson, profileByDevice, PLATFORM_FEE_PERCENT, nowMs, awardLucre, LUCRE_AWARDS, notifyBuyerSeller } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "No profile on this device." });
  const id = Number(params.id);
  const o = await db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1").bind(id).first();
  if (!o) return json({ ok: false, error: "That order is gone." });
  if (o.buyer_id !== me.id) return json({ ok: false, error: "Only the buyer confirms receipt on an order." });
  if (o.status === "paid") return json({ ok: false, error: "It hasn't shipped yet — you confirm once the seller marks it shipped with tracking." });
  if (o.buyer_confirmed_at) return json({ ok: false, error: "You already confirmed this one." });
  const now = nowMs();
  try {
    await db.prepare("UPDATE orders SET buyer_confirmed_at = ? WHERE id = ?").bind(now, id).run();
  } catch (e) {
    if (/no such column/i.test(String((e && e.message) || e))) return json({ ok: false, error: "Confirming receipt isn't switched on yet — the shop is still running a quick database update. Try again later." });
    throw e;
  }
  if (o.status === "shipped") {
    await db.prepare("UPDATE orders SET status = 'delivered', updated_at = ? WHERE id = ?").bind(now, id).run();
    // Creator menu (2026-11-21): a delivered menu order completes
    // its custom request too (requested → accepted → paid →
    // delivered → completed). Best-effort — a missing requests table
    // just means no request could exist.
    try {
      if (o.menu_item_id) {
        await db.prepare("UPDATE creator_requests SET status = 'completed', updated_at = ? WHERE order_id = ? AND status IN ('paid', 'delivered')").bind(now, id).run();
      }
    } catch { /* requests table not there yet */ }
    // Wallet credit — twin of the shipping form's delivered credit:
    // once only (sale_credit row guards it), fee on item price only.
    // SKIPPED for Stripe Checkout orders: their money is already in
    // the seller's Stripe balance (destination charge) — crediting the
    // wallet too would pay them twice. Lucre still awards either way.
    const existing = await db.prepare("SELECT id FROM payout_entries WHERE order_id = ? AND kind = 'sale_credit' LIMIT 1").bind(id).first();
    if (!existing) {
      if (!o.stripe_session_id && !o.stripe_payment_intent_id) {
        const fee = Math.round((o.amount_cents * PLATFORM_FEE_PERCENT) / 100);
        await db.prepare(
          "INSERT INTO payout_entries (profile_id, kind, amount_cents, note, status, order_id, created_at) VALUES (?, 'sale_credit', ?, ?, 'available', ?, ?)",
        ).bind(o.seller_id, o.amount_cents - fee + (o.shipping_cents || 0), o.item_title, id, now).run();
      }
      await awardLucre(db, o.seller_id, LUCRE_AWARDS.transaction, "transaction", "order:" + String(id) + ":seller");
      if (o.buyer_id && o.buyer_id !== o.seller_id) {
        await awardLucre(db, o.buyer_id, LUCRE_AWARDS.transaction, "transaction", "order:" + String(id) + ":buyer");
      }
    }
    // The seller hears the confirmation — the order is complete, and
    // for a card order the money is on its way to their bank.
    const sellerProfile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(o.seller_id).first();
    await notifyBuyerSeller(db, sellerProfile, me, "order",
      "✅ @" + me.username + " confirmed receipt on \"" + o.item_title + "\" — the order is complete." + (o.stripe_session_id || o.stripe_payment_intent_id ? " The payment is on its way to your bank on Stripe's payout schedule (typically ~2 business days)." : ""),
      "#/orders", "order", id);
  }
  return json({ ok: true, error: null, status: o.status === "shipped" ? "delivered" : o.status });
}
