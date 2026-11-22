// GET /api/members?device_id=&limit= — member directory, ROLE-GATED.
// (2026-11-21) Only the team (operator/admin/mod) sees the full list.
// A regular member gets ONLY their own friends list (the mutual friends
// table, plus themself so their own card still shows). Guests get
// nothing. The gate is server-side on purpose — a client-only hide would
// still leak the directory to anyone calling the endpoint directly.
// The response carries `scope` ("all" | "friends" | "none") so the
// client can label the view honestly.
import { json, noDb, getDb, shapeMember, profileByDevice, roleOf, isTeamRole, isOperator } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "24", 10) || 24, 1), 60);
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ members: [], scope: "none" });
  if (isOperator(env, me) || isTeamRole(roleOf(me))) {
    const { results } = await db.prepare("SELECT * FROM profiles ORDER BY id DESC LIMIT ?").bind(limit).all();
    return json({ members: (results || []).map(shapeMember), scope: "all" });
  }
  // Regular member: their own friends only. Wrapped so a DB without the
  // friends table yet just answers empty instead of erroring.
  let rows = [];
  try {
    const { results } = await db.prepare(
      "SELECT p.* FROM profiles p WHERE p.id = ? OR p.id IN (SELECT friend_id FROM friends WHERE profile_id = ?) ORDER BY p.username ASC LIMIT ?"
    ).bind(me.id, me.id, limit).all();
    rows = results || [];
  } catch { rows = []; }
  return json({ members: rows.map(shapeMember), scope: "friends" });
}
