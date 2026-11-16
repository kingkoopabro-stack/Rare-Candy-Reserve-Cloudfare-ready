// GET /api/tags?scope=general|adult — listTags. Tag counts for one forum
// scope, most-used first. Adult tags NEVER leak into the general scope.
import { json, noDb, getDb, profileByDevice, parseTags } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const scope = q.get("scope") === "adult" ? "adult" : "general";
  const deviceId = q.get("device_id") || "";
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "24", 10) || 24, 1), 60);
  if (scope === "adult") {
    const caller = deviceId ? await profileByDevice(db, deviceId) : null;
    if (!caller || caller.age_verified !== 1) return json({ tags: [] });
  }
  const { results } = await db.prepare("SELECT kind, tags FROM posts").all();
  const counts = new Map();
  for (const r of (results || [])) {
    const k = r.kind ?? "forum";
    if (scope === "adult" ? k !== "adult" : k !== "forum") continue;
    for (const t of parseTags(r.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const tags = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
  return json({ tags });
}
