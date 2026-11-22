// POST /api/my-stuff/keep — keep a stored copy of a purchase in
// "My stuff" (counts against the 5 GB quota).
//
// { device_id, content_sale_id }. Buyer only, and only for their own
// purchase. The size is the package zip's size when the sale links a
// package; sales with no package (a creator post / listing photo
// sale) have no stored zip to count, so they count 0 — the quota
// bites only on stored package downloads. Refused plainly when the
// quota would overflow ("Your 'My stuff' is full (5 GB) — delete
// something to make room"). Buying is never blocked — only keeping.
import { json, noDb, getDb, readJson, profileByDevice, nowMs } from "../_lib.js";
import { MY_STUFF_QUOTA_BYTES, CREATOR_NOT_SETUP_MSG } from "../_creator.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  const saleId = Number(a.content_sale_id || 0);
  if (!saleId) return json({ ok: false, error: "Pick a purchase to keep." });
  let sale = null;
  try {
    sale = await db.prepare("SELECT * FROM content_sales WHERE id = ? LIMIT 1").bind(saleId).first();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG });
    throw e;
  }
  if (!sale) return json({ ok: false, error: "That purchase is gone." });
  if (sale.buyer_id !== me.id) return json({ ok: false, error: "You can only keep your own purchases." });
  let sizeBytes = 0;
  let packageId = sale.package_id ?? null;
  if (packageId) {
    try {
      const pkg = await db.prepare("SELECT size_bytes FROM creator_packages WHERE id = ? LIMIT 1").bind(packageId).first();
      sizeBytes = Number(pkg?.size_bytes || 0);
    } catch { sizeBytes = 0; }
  }
  let keptRow = null;
  try {
    keptRow = await db.prepare("SELECT * FROM my_stuff_kept WHERE buyer_id = ? AND content_sale_id = ? LIMIT 1").bind(me.id, saleId).first();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG });
    throw e;
  }
  if (keptRow && keptRow.deleted_at == null) {
    return json({ ok: true, error: null, already: true, used_bytes: await usedBytes(db, me.id), quota_bytes: MY_STUFF_QUOTA_BYTES });
  }
  const used = await usedBytes(db, me.id);
  if (used + sizeBytes > MY_STUFF_QUOTA_BYTES) {
    return json({ ok: false, error: "Your 'My stuff' is full (5 GB) — delete something to make room.", used_bytes: used, quota_bytes: MY_STUFF_QUOTA_BYTES });
  }
  const now = nowMs();
  if (keptRow) {
    await db.prepare("UPDATE my_stuff_kept SET deleted_at = NULL, kept_at = ?, size_bytes = ?, package_id = ? WHERE id = ?").bind(now, sizeBytes, packageId, keptRow.id).run();
  } else {
    await db.prepare("INSERT INTO my_stuff_kept (buyer_id, content_sale_id, package_id, size_bytes, kept_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)").bind(me.id, saleId, packageId, sizeBytes, now).run();
  }
  return json({ ok: true, error: null, already: false, used_bytes: await usedBytes(db, me.id), quota_bytes: MY_STUFF_QUOTA_BYTES });
}

async function usedBytes(db, buyerId) {
  try {
    const r = await db.prepare("SELECT COALESCE(SUM(size_bytes), 0) AS n FROM my_stuff_kept WHERE buyer_id = ? AND deleted_at IS NULL").bind(buyerId).first();
    return Number(r?.n || 0);
  } catch { return 0; }
}
