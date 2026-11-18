// Team roster (v3.7) — badge holders only (operator + admin + mod).
// GET /api/team?device_id= — every team member (operator, admin, mod)
// with their presence (online / away / offline), so the team can see
// who's around. Members and guests cannot read this.
import { json, noDb, getDb, profileByDevice, roleOf, isTeamRole, imageUrl, presenceOf, iso } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me || !isTeamRole(roleOf(me))) return json({ ok: false, error: "Team only.", team: [] });
  const { results } = await db.prepare(
    "SELECT id, username, avatar_blob_key, role, is_operator, presence_status, last_seen, away_message, created_at FROM profiles WHERE role IN ('operator', 'admin', 'mod') OR is_operator = 1 ORDER BY id ASC",
  ).all();
  return json({
    ok: true,
    team: (results || []).map((r) => ({
      id: r.id, username: r.username, avatar_url: imageUrl(r.avatar_blob_key),
      role: roleOf(r), presence: presenceOf(r), away_message: r.away_message ?? "",
      created_at: iso(r.created_at),
    })),
  });
}
