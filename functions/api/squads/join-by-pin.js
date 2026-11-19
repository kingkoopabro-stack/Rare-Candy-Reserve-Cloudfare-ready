// POST /api/squads/join-by-pin — join a squad by its 4-digit PIN
// { device_id, pin }. Finds the most recently active squad with that PIN
// (open or private) that isn't full and hasn't expired, and joins it.
// PINs are only 4 digits, so collisions are possible — the freshest
// match wins, and the room header always shows the game + title so a
// wrong-group join is obvious at a glance.
import {
  json, noDb, getDb, readJson, profileByDevice, nowMs,
  SQUAD_MAX_PLAYERS, squadIsExpired, shapeSquad,
} from "../_lib.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first — Group Up is for members.");
  const pin = String(a.pin || "").trim();
  if (!/^\d{4}$/.test(pin)) return fail("Enter the group's 4-digit PIN code.");
  try {
    const { results } = await db.prepare(
      "SELECT * FROM squads WHERE pin = ? ORDER BY last_activity_at DESC LIMIT 10",
    ).bind(pin).all();
    const now = nowMs();
    for (const row of (results || [])) {
      if (squadIsExpired(row, now)) continue;
      const shaped = await shapeSquad(db, row, me.id);
      if (shaped.is_member) return json({ ok: true, error: null, squad: shaped, already: true });
      if (shaped.member_count >= SQUAD_MAX_PLAYERS) continue;
      await db.prepare("INSERT OR IGNORE INTO squad_members (squad_id, profile_id, joined_at) VALUES (?, ?, ?)").bind(row.id, me.id, now).run();
      await db.prepare("UPDATE squads SET last_activity_at = ? WHERE id = ?").bind(now, row.id).run();
      const fresh = await db.prepare("SELECT * FROM squads WHERE id = ? LIMIT 1").bind(row.id).first();
      return json({ ok: true, error: null, squad: await shapeSquad(db, fresh, me.id) });
    }
    return fail("No open group found with that PIN code — check the digits and try again.");
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail("Group Up isn't set up yet — the shop is still running a quick database update.");
    throw e;
  }
}
