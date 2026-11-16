// GET /api/members?limit= — listMembers (newest first, public shape only).
import { json, noDb, getDb, shapeMember } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const limit = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get("limit") || "24", 10) || 24, 1), 60);
  const { results } = await db.prepare("SELECT * FROM profiles ORDER BY id DESC LIMIT ?").bind(limit).all();
  return json({ members: (results || []).map(shapeMember) });
}
