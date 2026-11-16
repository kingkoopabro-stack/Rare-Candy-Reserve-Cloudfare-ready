// GET /api/headlines — the Community's own most eye-catching posts.
// Top posts by engagement (hearts × 2 + comments), newest first on ties.
// Forum + creator posts; adult posts only for age-verified callers (the
// same server-side age gate as /api/posts — adult content never leaks to
// a non-verified caller). Self-contained: Community posts only, no
// external news source or API. Used by the #/headlines page and the
// headlines strip on The Street.
// Query: ?device_id= (age gate) &limit= (default 10, max 25).
import { json, noDb, getDb, profileByDevice, shapePost } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const deviceId = q.get("device_id") || "";
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "10", 10) || 10, 1), 25);

  let callerVerified = false;
  if (deviceId) {
    const caller = await profileByDevice(db, deviceId);
    callerVerified = !!caller && caller.age_verified === 1;
  }

  const { results } = await db.prepare(
    `SELECT p.*, a.id AS author_id, a.username AS author_username, a.occupation AS author_occupation, a.avatar_blob_key AS author_avatar
     FROM posts p JOIN profiles a ON a.id = p.profile_id ORDER BY p.id DESC LIMIT 200`,
  ).all();
  const rows = (results || []).filter((r) => {
    // Adult posts only for age-verified callers.
    if ((r.kind ?? "forum") === "adult" && !callerVerified) return false;
    return true;
  });
  const shaped = [];
  for (const r of rows) {
    const post = await shapePost(db, r, { id: r.author_id, username: r.author_username, occupation: r.author_occupation, avatar_blob_key: r.author_avatar });
    // Engagement: hearts count double, comments count once.
    post.engagement = (post.score || 0) * 2 + (post.comment_count || 0);
    shaped.push(post);
  }
  shaped.sort((a, b) => (b.engagement - a.engagement) || (b.id - a.id));
  return json({ headlines: shaped.slice(0, limit) });
}
