// POST /api/squads/:id/join — join a squad { device_id, pin? }.
// Open squads need no code; private squads need the 4-digit PIN.
// Rejects full squads (4), expired squads, and double-joins.
import {
  json, noDb, getDb, readJson, profileByDevice, nowMs,
  SQUAD_MAX_PLAYERS, squadIsExpired, shapeSquad,
} from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first — Group Up is for members.");
  const id = Number(params.id);
  try {
    const row = await db.prepare("SELECT * FROM squads WHERE id = ? LIMIT 1").bind(id).first();
    if (!row) return fail("That group is gone.");
    if (squadIsExpired(row)) return fail("That group's playtime is over — it closed up.");
    const shaped = await shapeSquad(db, row, me.id);
    if (shaped.is_member) return fail("You're already in this group.");
    if (shaped.member_count >= SQUAD_MAX_PLAYERS) return fail("That group is full (4/4).");
    if (shaped.is_private) {
      const pin = String(a.pin || "").trim();
      if (!pin || pin !== String(row.pin || "")) return fail("Wrong PIN code for this group.");
    }
    const now = nowMs();
    await db.prepare("INSERT OR IGNORE INTO squad_members (squad_id, profile_id, joined_at) VALUES (?, ?, ?)").bind(id, me.id, now).run();
    await db.prepare("UPDATE squads SET last_activity_at = ? WHERE id = ?").bind(now, id).run();
    const fresh = await db.prepare("SELECT * FROM squads WHERE id = ? LIMIT 1").bind(id).first();
    return json({ ok: true, error: null, squad: await shapeSquad(db, fresh, me.id) });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail("Group Up isn't set up yet — the shop is still running a quick database update.");
    throw e;
  }
}
