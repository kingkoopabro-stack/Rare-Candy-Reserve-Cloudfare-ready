// GET /api/sellers/:id/reviews — the review texts, PUBLIC. Reviews
// show on the seller's profile/shop page for anyone to read — words
// and stars. (The hate-speech filter runs at write time, in the
// review endpoint; this read side just serves what's accepted.)
import { json, noDb, getDb, iso } from "../../_lib.js";

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const sellerId = Number(params.id);
  let rows = [];
  try {
    const { results } = await db.prepare(
      "SELECT r.*, p.username AS buyer_username FROM seller_reviews r JOIN profiles p ON p.id = r.buyer_id WHERE r.seller_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 100",
    ).bind(sellerId).all();
    rows = results || [];
  } catch { return json({ ok: true, reviews: [] }); /* table not there yet */ }
  return json({
    ok: true,
    reviews: rows.map((r) => ({
      id: r.id, order_id: r.order_id, stars: r.stars, body: r.body,
      buyer_username: r.buyer_username, created_at: iso(r.created_at),
    })),
  });
}
