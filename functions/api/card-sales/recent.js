// GET /api/card-sales/recent — listRecentCardSales (newest first).
import { json, noDb, getDb, iso } from "../_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const limit = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get("limit") || "12", 10) || 12, 1), 40);
  const { results } = await db.prepare(
    `SELECT s.*, p.username AS reporter_username FROM card_sales s JOIN profiles p ON p.id = s.profile_id ORDER BY s.id DESC LIMIT ?`,
  ).bind(limit).all();
  return json({
    sales: (results || []).map((r) => ({
      id: r.id, card_name: r.card_name, price_cents: r.price_cents,
      sold_date: r.sold_date, venue: r.venue, reporter_username: r.reporter_username,
      created_at: iso(r.created_at),
    })),
  });
}
