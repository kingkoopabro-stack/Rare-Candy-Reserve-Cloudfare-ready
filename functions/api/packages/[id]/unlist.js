// POST /api/packages/:id/unlist — pull a listed package back to
// staging. The menu slot pointing at it is removed (the menu just
// stops taking new sales for it); staged content is never deleted,
// in-flight orders and requests finish normally, and buyers who
// already paid keep their copy in "My stuff".
import { json, noDb, getDb, readJson, profileByDevice, nowMs, isOperator } from "../../_lib.js";
import { CREATOR_NOT_SETUP_MSG } from "../../_creator.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  const id = Number(params.id);
  let pkg = null;
  try {
    pkg = await db.prepare("SELECT * FROM creator_packages WHERE id = ? LIMIT 1").bind(id).first();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG });
    throw e;
  }
  if (!pkg) return json({ ok: false, error: "That package is gone." });
  if (pkg.profile_id !== me.id && !isOperator(env, me)) return json({ ok: false, error: "That package isn't yours." });
  await db.prepare("UPDATE creator_packages SET status = 'staged', updated_at = ? WHERE id = ?").bind(nowMs(), id).run();
  await db.prepare("DELETE FROM creator_menu_items WHERE package_id = ?").bind(id).run();
  return json({ ok: true, error: null, package_id: id, status: "staged" });
}
