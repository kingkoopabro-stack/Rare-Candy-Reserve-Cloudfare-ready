// GET /api/listings/:id — getListing (permalink target, with fee split).
// DELETE /api/listings/:id — deleteListing (own listings only; sold ones stay
// as the receipt on the buyer's order).
import { json, noDb, getDb, readJson, profileByDevice, shapeListing } from "../_lib.js";

async function loadListing(db, id) {
  return await db.prepare(
    `SELECT l.*, s.id AS seller_id, s.username AS seller_username, s.occupation AS seller_occupation,
            s.avatar_blob_key AS seller_avatar, s.payout_method AS seller_payout_method, s.payout_handle AS seller_payout_handle
     FROM listings l JOIN profiles s ON s.id = l.profile_id WHERE l.id = ? LIMIT 1`,
  ).bind(id).first();
}

export async function onRequestGet({ env, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const row = await loadListing(db, Number(params.id));
  if (!row) return json({ listing: null });
  return json({
    listing: await shapeListing(db, row, {
      id: row.seller_id, username: row.seller_username, occupation: row.seller_occupation,
      avatar_blob_key: row.seller_avatar, payout_method: row.seller_payout_method, payout_handle: row.seller_payout_handle,
    }),
  });
}

export async function onRequestDelete({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "No profile on this device." });
  const id = Number(params.id);
  const l = await db.prepare("SELECT * FROM listings WHERE id = ? LIMIT 1").bind(id).first();
  if (!l) return json({ ok: false, error: "That listing is already gone." });
  if (l.profile_id !== me.id) return json({ ok: false, error: "You can only close your own listings." });
  if (l.status === "sold") return json({ ok: false, error: "Sold listings stay put — they're the receipt on the buyer's order. They're already hidden from the market." });
  await db.batch([
    db.prepare("DELETE FROM bids WHERE listing_id = ?").bind(id),
    db.prepare("DELETE FROM trade_votes WHERE listing_id = ?").bind(id),
    db.prepare("DELETE FROM listing_comments WHERE listing_id = ?").bind(id),
    db.prepare("DELETE FROM listings WHERE id = ?").bind(id),
  ]);
  return json({ ok: true, error: null });
}
