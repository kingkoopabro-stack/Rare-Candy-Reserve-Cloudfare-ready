// POST /api/listings/:id/buy — buyListing. Records a purchase of a sale
// listing (or a flea listing by its high bidder) as an order in the buyer's
// My Orders, and marks the listing sold. Payment itself is arranged
// directly between buyer and seller — no money moves in this app.
import { json, noDb, getDb, readJson, profileByDevice, nowMs } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, order_id: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to buy — orders live on your profile.");
  const id = Number(params.id);
  const l = await db.prepare("SELECT * FROM listings WHERE id = ? LIMIT 1").bind(id).first();
  if (!l) return fail("That listing is gone.");
  if (l.status !== "active") return fail("That item already sold.");
  if (l.profile_id === me.id) return fail("You can't buy your own listing.");
  if (l.kind === "trade") return fail("Trade listings aren't bought — leave a comment on the listing to offer your trade.");
  let amount = l.price_cents;
  if (l.kind === "flea") {
    const { results } = await db.prepare("SELECT profile_id, amount_cents FROM bids WHERE listing_id = ?").bind(id).all();
    const lb = results || [];
    const top = lb.length ? Math.max(...lb.map((b) => b.amount_cents)) : null;
    if (top == null || !lb.some((b) => b.profile_id === me.id && b.amount_cents === top)) {
      return fail("Only the high bidder can complete a flea-market purchase.");
    }
    amount = top;
  }
  const now = nowMs();
  const r = await db.prepare(
    "INSERT INTO orders (listing_id, buyer_id, seller_id, item_title, amount_cents, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)",
  ).bind(id, me.id, l.profile_id, l.title, amount, now, now).run();
  await db.prepare("UPDATE listings SET status = 'sold', updated_at = ? WHERE id = ?").bind(now, id).run();
  return json({ ok: true, error: null, order_id: r.meta.last_row_id });
}
