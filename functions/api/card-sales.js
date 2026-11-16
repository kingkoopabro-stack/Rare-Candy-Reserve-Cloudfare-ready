// GET /api/card-sales?card_name= — listCardSales: community-reported
// ACTUAL sales matching a card name (newest first) + chart stats
// (count, median, latest, low, high). Fuzzy card-key match.
// POST /api/card-sales — logCardSale: logs a REAL sale a member made.
import {
  json, noDb, getDb, readJson, profileByDevice,
  normalizeCardKey, cardKeysMatch, medianCents, SALE_VENUES, iso, nowMs,
} from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const name = String(q.get("card_name") || "").trim();
  if (!name || name.length > 120) return json({ sales: [], count: 0, median_cents: 0, latest_cents: 0, min_cents: 0, max_cents: 0 });
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "40", 10) || 40, 1), 60);
  const key = normalizeCardKey(name);
  const { results } = await db.prepare(
    `SELECT s.*, p.username AS reporter_username FROM card_sales s JOIN profiles p ON p.id = s.profile_id`,
  ).all();
  const matched = (results || [])
    .filter((r) => cardKeysMatch(r.card_key, key))
    .sort((a, b) => (a.sold_date === b.sold_date ? b.id - a.id : a.sold_date < b.sold_date ? 1 : -1));
  const prices = matched.map((r) => r.price_cents);
  return json({
    sales: matched.slice(0, limit).map((r) => ({
      id: r.id, card_name: r.card_name, price_cents: r.price_cents,
      sold_date: r.sold_date, venue: r.venue, reporter_username: r.reporter_username,
      created_at: iso(r.created_at),
    })),
    count: matched.length,
    median_cents: medianCents(prices),
    latest_cents: matched[0]?.price_cents ?? 0,
    min_cents: prices.length ? Math.min(...prices) : 0,
    max_cents: prices.length ? Math.max(...prices) : 0,
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, sale_id: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your account first — sales are logged under your name so the chart shows who reported each one.");
  const cardName = String(a.card_name || "").trim();
  if (cardName.length < 2 || cardName.length > 120) return fail("Card name needs 2–120 characters.");
  const priceCents = Math.round(Number(a.price_cents) || 0);
  if (priceCents <= 0 || priceCents > 100000000) return fail("Enter the price it actually sold for.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.sold_date || "")) return fail("Use the date it sold (YYYY-MM-DD).");
  const today = new Date().toISOString().slice(0, 10);
  if (a.sold_date > today) return fail("That date is in the future — log the sale with the date it actually sold.");
  if (Number.isNaN(new Date(`${a.sold_date}T00:00:00`).getTime())) return fail("That date doesn't look right.");
  if (!SALE_VENUES.includes(a.venue)) return fail("Pick where it sold.");
  const r = await db.prepare(
    "INSERT INTO card_sales (profile_id, card_name, card_key, price_cents, sold_date, venue, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(me.id, cardName, normalizeCardKey(cardName), priceCents, a.sold_date, a.venue, nowMs()).run();
  return json({ ok: true, error: null, sale_id: r.meta.last_row_id });
}
