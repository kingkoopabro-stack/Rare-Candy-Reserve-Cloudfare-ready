// POST /api/my-stuff/delete — delete a kept copy from "My stuff"
// and free the room immediately.
//
// { device_id, content_sale_id }. Storage hygiene only: deleting
// never refunds, never cancels the order, never notifies the seller,
// and NEVER deletes the content_sales receipt row — the proof of
// purchase persists, so the buyer can re-download later as long as
// the seller's package still exists (if the seller deleted it, the
// receipt remains but the files are gone).
import { json, noDb, getDb, readJson, profileByDevice, nowMs } from "../_lib.js";
import { MY_STUFF_QUOTA_BYTES, CREATOR_NOT_SETUP_MSG } from "../_creator.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  const saleId = Number(a.content_sale_id || 0);
  if (!saleId) return json({ ok: false, error: "Pick a kept item to delete." });
  let keptRow = null;
  try {
    keptRow = await db.prepare("SELECT * FROM my_stuff_kept WHERE buyer_id = ? AND content_sale_id = ? AND deleted_at IS NULL LIMIT 1").bind(me.id, saleId).first();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG });
    throw e;
  }
  if (!keptRow) return json({ ok: false, error: "That isn't in your kept stuff — your purchase receipt is still there if you want it back later." });
  await db.prepare("UPDATE my_stuff_kept SET deleted_at = ? WHERE id = ?").bind(nowMs(), keptRow.id).run();
  let used = 0;
  try {
    const r = await db.prepare("SELECT COALESCE(SUM(size_bytes), 0) AS n FROM my_stuff_kept WHERE buyer_id = ? AND deleted_at IS NULL").bind(me.id).first();
    used = Number(r?.n || 0);
  } catch { used = 0; }
  return json({ ok: true, error: null, used_bytes: used, quota_bytes: MY_STUFF_QUOTA_BYTES });
}
