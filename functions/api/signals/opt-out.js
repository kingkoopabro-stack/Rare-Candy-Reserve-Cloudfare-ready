// POST /api/signals/opt-out — turn signal matching off or on.
//
// { device_id, enabled: 0|1 } — `enabled` is whether SIGNALS are
// enabled: 1 = signals on (matching uses my clicks), 0 = signals off
// (Find falls back to typed prefs only, and new signals are ignored
// silently). { opt_out: 0|1 } is accepted as an alias and means the
// same thing the other way round (opt_out 1 = signals off). Sets
// profiles.signals_opt_out. Default is ON (signals_enabled) until
// the member opts out — Chris's call, per the design doc's decision
// 17; the brief's default stands.
import { json, noDb, getDb, readJson, profileByDevice } from "../_lib.js";
import { CREATOR_NOT_SETUP_MSG } from "../_creator.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  let optOut = null;
  if (typeof a.opt_out === "number" || a.opt_out === true || a.opt_out === false) {
    optOut = a.opt_out === 1 || a.opt_out === true ? 1 : 0;
  } else if (typeof a.enabled === "number" || a.enabled === true || a.enabled === false) {
    optOut = (a.enabled === 1 || a.enabled === true) ? 0 : 1;
  }
  if (optOut == null) return json({ ok: false, error: "Send enabled: 1 to turn signals on, or enabled: 0 to turn them off." });
  try {
    await db.prepare("UPDATE profiles SET signals_opt_out = ? WHERE id = ?").bind(optOut, me.id).run();
  } catch (e) {
    if (/no such column|no column named/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG });
    throw e;
  }
  return json({ ok: true, error: null, signals_enabled: optOut === 0, signals_opt_out: optOut });
}
