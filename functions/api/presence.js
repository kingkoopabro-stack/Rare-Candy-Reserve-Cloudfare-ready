// GET /api/presence — buddy list (members with effective presence).
// POST /api/presence — heartbeat / set status { device_id, status, away_message }.
// Presence is best-effort: 'online' only counts with a fresh heartbeat
// (see presenceOf in _lib.js — 3 minutes); staleness degrades to offline.
// If the v2 migration hasn't run yet, GET degrades to all-offline and
// POST answers a clean "not set up yet" instead of crashing.
// GET is ROLE-GATED (2026-11-21), same rule as /api/members: the team
// sees every buddy; a regular member sees only their own friends (+
// themself); guests see nobody. A buddy list is a friends list.
import { json, noDb, getDb, readJson, profileByDevice, shapeMember, roleOf, isTeamRole, isOperator, nowMs } from "./_lib.js";

const STATUSES = ["online", "away", "offline"];

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "60", 10) || 60, 1), 100);
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ buddies: [], scope: "none" });
  if (isOperator(env, me) || isTeamRole(roleOf(me))) {
    const { results } = await db.prepare("SELECT * FROM profiles ORDER BY id DESC LIMIT ?").bind(limit).all();
    return json({ buddies: (results || []).map(shapeMember), scope: "all" });
  }
  let rows = [];
  try {
    const { results } = await db.prepare(
      "SELECT p.* FROM profiles p WHERE p.id = ? OR p.id IN (SELECT friend_id FROM friends WHERE profile_id = ?) ORDER BY p.username ASC LIMIT ?"
    ).bind(me.id, me.id, limit).all();
    rows = results || [];
  } catch { rows = []; }
  return json({ buddies: rows.map(shapeMember), scope: "friends" });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first — presence needs a profile." });
  const status = STATUSES.includes(a.status) ? a.status : "online";
  const awayMessage = String(a.away_message ?? me.away_message ?? "").trim().slice(0, 140);
  try {
    await db.prepare("UPDATE profiles SET presence_status = ?, away_message = ?, last_seen = ?, updated_at = ? WHERE id = ?")
      .bind(status, awayMessage, nowMs(), nowMs(), me.id).run();
  } catch (e) {
    if (/no such column/i.test(String((e && e.message) || e))) {
      return json({ ok: false, error: "Presence isn't set up yet — the shop is still running a quick database update." });
    }
    throw e;
  }
  return json({ ok: true, error: null, presence: status, away_message: awayMessage });
}
