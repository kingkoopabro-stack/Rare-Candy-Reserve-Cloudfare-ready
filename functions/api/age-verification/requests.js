// GET /api/age-verification/requests — OPERATOR ONLY. Lists pending ID
// review requests (username + date only — no image data, no ID details).
import { json, noDb, getDb, profileByDevice, isOperator, iso } from "../_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me || !isOperator(env, me)) return json({ requests: [] });
  const { results } = await db.prepare(
    `SELECT r.id, r.profile_id, r.status, r.created_at, p.username
     FROM age_verification_requests r JOIN profiles p ON p.id = r.profile_id
     ORDER BY r.id DESC LIMIT 100`,
  ).all();
  const out = (results || []).map((r) => ({
    id: r.id, profile_id: r.profile_id, username: r.username,
    status: r.status, created_at: iso(r.created_at),
  }));
  out.sort((a, b) => (a.status === b.status ? b.id - a.id : a.status === "pending" ? -1 : 1));
  return json({ requests: out });
}
