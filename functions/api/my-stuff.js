// GET /api/my-stuff — the buyer's own purchased content + kept
// downloads (the server side of the "My stuff" phone app).
//
// { purchases: { content_sales: [...], orders: [...] }, kept: [...],
//   quota_bytes: 5 GB, used_bytes }. The library itself is
// references, not copies — owning 50 packages uses no room; only
// what the buyer actually keeps stored counts against the 5 GB.
// Buying is never blocked by the quota (the purchase + CS# record
// always land); only keeping a stored copy is. Delete frees room;
// the receipt / CS# record persists, so re-download stays possible
// while the seller's package still exists.
import { json, noDb, getDb, profileByDevice, shapeOrder, profilesMap, iso, money } from "./_lib.js";
import { MY_STUFF_QUOTA_BYTES, CREATOR_NOT_SETUP_MSG } from "./_creator.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first.", purchases: { content_sales: [], orders: [] }, kept: [], quota_bytes: MY_STUFF_QUOTA_BYTES, used_bytes: 0 });
  let sales = [];
  try {
    const { results } = await db.prepare(
      "SELECT * FROM content_sales WHERE buyer_id = ? ORDER BY cs_number DESC LIMIT 100",
    ).bind(me.id).all();
    sales = (results || []).map((r) => ({
      id: r.id,
      cs_number: r.cs_number,
      post_id: r.post_id ?? null, listing_id: r.listing_id ?? null,
      package_id: r.package_id ?? null, menu_item_id: r.menu_item_id ?? null,
      item_title: r.item_title ?? "", seller_username: r.seller_username ?? "",
      amount_cents: r.amount_cents, amount: money(r.amount_cents),
      watermark_text: r.watermark_text ?? "", created_at: iso(r.created_at),
    }));
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG, purchases: { content_sales: [], orders: [] }, kept: [], quota_bytes: MY_STUFF_QUOTA_BYTES, used_bytes: 0 });
    throw e;
  }
  const names = await profilesMap(db);
  let orders = [];
  try {
    const { results } = await db.prepare(
      "SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC LIMIT 100",
    ).bind(me.id).all();
    for (const r of (results || [])) orders.push(await shapeOrder(db, r, names));
  } catch { orders = []; /* orders table not there yet — content sales still list */ }
  let kept = [];
  let usedBytes = 0;
  try {
    const { results } = await db.prepare(
      `SELECT k.id, k.content_sale_id, k.package_id, k.size_bytes, k.kept_at, cs.cs_number, cs.item_title
       FROM my_stuff_kept k JOIN content_sales cs ON cs.id = k.content_sale_id
       WHERE k.buyer_id = ? AND k.deleted_at IS NULL ORDER BY k.kept_at DESC`,
    ).bind(me.id).all();
    kept = (results || []).map((r) => ({
      content_sale_id: r.content_sale_id, package_id: r.package_id ?? null,
      size_bytes: r.size_bytes ?? 0, kept_at: iso(r.kept_at),
      cs_number: r.cs_number, item_title: r.item_title ?? "",
    }));
    usedBytes = kept.reduce((s, k) => s + Number(k.size_bytes || 0), 0);
  } catch { kept = []; usedBytes = 0; /* kept table not there yet — nothing kept */ }
  return json({
    ok: true,
    purchases: { content_sales: sales, orders },
    kept, quota_bytes: MY_STUFF_QUOTA_BYTES, used_bytes: usedBytes,
  });
}
