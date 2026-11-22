// GET /api/sellers/:id/rating — the PUBLIC seller rating: average
// stars + number of reviews. The review texts live at /reviews
// (also public) — this endpoint is just the aggregate line.
import { json, noDb, getDb } from "../../_lib.js";

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const sellerId = Number(params.id);
  // Aggregate — public. Computed at read time from accepted reviews.
  let avg = null, count = 0;
  try {
    const row = await db.prepare("SELECT AVG(stars) AS avg, COUNT(*) AS n FROM seller_reviews WHERE seller_id = ?").bind(sellerId).first();
    count = (row && row.n) || 0;
    avg = count ? Math.round(((row && row.avg) || 0) * 10) / 10 : null;
  } catch { avg = null; count = 0; /* table not there yet */ }
  return json({ ok: true, seller_id: sellerId, average_stars: avg, review_count: count });
}
