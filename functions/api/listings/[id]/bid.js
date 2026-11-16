// POST /api/listings/:id/bid — placeBid. The bid must beat the current
// high bid (or the starting price). Bids are recorded here — payment and
// shipping are arranged between buyer and seller; no money moves in this app.
import { json, noDb, getDb, readJson, profileByDevice, money } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error, current) => json({ ok: false, error, current_bid_cents: current ?? null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to bid.");
  const id = Number(params.id);
  const amount = Math.round(Number(a.amount_cents) || 0);
  if (amount <= 0 || amount > 100000000) return fail("Enter a bid above $0.");
  const l = await db.prepare("SELECT * FROM listings WHERE id = ? LIMIT 1").bind(id).first();
  if (!l || l.kind !== "flea") return fail("That auction is not open.");
  if (l.profile_id === me.id) return fail("You can't bid on your own listing.");
  const { results } = await db.prepare("SELECT amount_cents FROM bids WHERE listing_id = ?").bind(id).all();
  const existing = results || [];
  const current = existing.length ? Math.max(...existing.map((b) => b.amount_cents)) : l.price_cents;
  if (amount <= current) return fail(`Your bid has to beat ${money(current)}.`, current);
  await db.prepare("INSERT INTO bids (listing_id, profile_id, amount_cents, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, me.id, amount, Date.now()).run();
  return json({ ok: true, error: null, current_bid_cents: amount });
}
