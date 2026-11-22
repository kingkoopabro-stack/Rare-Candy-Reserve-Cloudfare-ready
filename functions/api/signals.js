// Discovery signals — POST /api/signals (record one) and
// GET /api/signals (my tally).
//
// A signal is an on-site action the member already made while
// looking: a view of a creator post / listing / menu (kind + genre +
// tags), a click into a profile or menu item, a heart, or a search
// term. Stored as a per-member tally — counts per type/tag, never a
// full history log, never sold or shared. The Find page says so
// plainly: "Matched from what you've looked at here — your clicks on
// this site only. Nothing leaves the site."
//
// POST { device_id, kind: "view"|"click"|"heart"|"search", type, tag }.
// `kind` is validated but not stored (the tally is per type/tag).
// Recording is ignored SILENTLY when the caller opted out — the
// client keeps firing signals and nothing is kept. GET returns
// { signals: [{ type, tag, count }], signals_enabled }.
import { json, noDb, getDb, readJson, profileByDevice, nowMs, normalizeTag, iso } from "./_lib.js";
import { CREATOR_NOT_SETUP_MSG } from "./_creator.js";

const SIGNAL_KINDS = ["view", "click", "heart", "search"];

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first.", signals: [], signals_enabled: true });
  let signals = [];
  try {
    const { results } = await db.prepare(
      "SELECT type, tag, count, updated_at FROM interest_signals WHERE profile_id = ? ORDER BY count DESC, updated_at DESC LIMIT 200",
    ).bind(me.id).all();
    signals = (results || []).map((r) => ({ type: r.type ?? "", tag: r.tag ?? "", count: Number(r.count || 0), updated_at: iso(r.updated_at) }));
  } catch { signals = []; /* table not there yet — nothing recorded */ }
  return json({ ok: true, signals, signals_enabled: me.signals_opt_out !== 1 });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  if (!SIGNAL_KINDS.includes(String(a.kind || ""))) return json({ ok: false, error: "Signal kind needs to be view, click, heart, or search." });
  const type = normalizeTag(a.type || "");
  const tag = normalizeTag(a.tag || "");
  if (!type && !tag) return json({ ok: false, error: "Say what it was about — a type or a tag." });
  // Opted out: ignored silently. The client keeps firing; nothing
  // is kept, and the caller can't tell from the answer.
  if (me.signals_opt_out === 1) return json({ ok: true, ignored: true });
  const now = nowMs();
  try {
    await db.prepare(
      "INSERT INTO interest_signals (profile_id, type, tag, count, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(profile_id, type, tag) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at",
    ).bind(me.id, type, tag, now).run();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG });
    throw e;
  }
  return json({ ok: true, error: null, ignored: false });
}
