// DELETE /api/shop-listings/:id — operator only: delete one override.
// The listing falls back to its hardcoded site.js data (or disappears
// entirely if it was a brand-new shop-* listing with no hardcoded row).
import { json, noDb, getDb, readJson, profileByDevice, isOperator } from "../_lib.js";

export async function onRequestDelete({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!me || !isOperator(env, me)) return json({ ok: false, error: "Operator only." });
  const id = String((params && params.id) || "").trim().toLowerCase();
  if (!id) return json({ ok: false, error: "Pick a listing first." });
  const res = await db.prepare("DELETE FROM shop_listing_overrides WHERE id = ?").bind(id).run();
  return json({ ok: true, deleted: (res.meta && res.meta.changes) > 0 });
}
