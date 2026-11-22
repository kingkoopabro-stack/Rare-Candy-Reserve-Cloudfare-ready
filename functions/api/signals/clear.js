// POST /api/signals/clear — "Forget what I've looked at". Deletes
// my whole interest tally in one tap. Typed prefs in Edit Profile
// are untouched — Find falls back to those.
import { json, noDb, getDb, readJson, profileByDevice } from "../_lib.js";
import { CREATOR_NOT_SETUP_MSG } from "../_creator.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  try {
    const r = await db.prepare("DELETE FROM interest_signals WHERE profile_id = ?").bind(me.id).run();
    return json({ ok: true, error: null, cleared: Number(r?.meta?.changes || 0) });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG });
    throw e;
  }
}
