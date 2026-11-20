// GET /api/headlines — the Community's own most eye-catching posts.
// Top posts by engagement (hearts × 2 + comments), newest first on ties.
// Forum + creator posts ONLY. Adult posts are NEVER in Headlines — the
// 18+ area is separate from YourSpace, so adult content lives only in
// the #/adult area (which fetches kind=adult explicitly). Self-contained:
// Community posts only, no external news source or API. Used by the
// #/headlines page and the headlines strip on YourSpace.
// Query: ?device_id= (kept for compatibility) &limit= (default 10, max 25).
import { json, noDb, getDb, shapePost, badgesForProfiles, profileByDevice, filterVisiblePosts } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const deviceId = q.get("device_id") || "";
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "10", 10) || 10, 1), 25);
  // Feed redesign (v3.14) — device_id now matters: friends-only posts
  // must not leak into Headlines for strangers.
  const caller = deviceId ? await profileByDevice(db, deviceId) : null;

  const { results } = await db.prepare(
    `SELECT p.*, a.id AS author_id, a.username AS author_username, a.occupation AS author_occupation, a.avatar_blob_key AS author_avatar
     FROM posts p JOIN profiles a ON a.id = p.profile_id ORDER BY p.id DESC LIMIT 200`,
  ).all();
  const rows = await filterVisiblePosts(db, caller, (results || []).filter((r) => {
    // Adult posts are NEVER in Headlines — the 18+ area is separate
    // from YourSpace. Adult content lives only in the #/adult area.
    if ((r.kind ?? "forum") === "adult") return false;
    return true;
  }));
  const shaped = [];
  const badgeMap = await badgesForProfiles(db, rows.map((r) => r.author_id));
  for (const r of rows) {
    const post = await shapePost(db, r, { id: r.author_id, username: r.author_username, occupation: r.author_occupation, avatar_blob_key: r.author_avatar, badges: badgeMap.get(r.author_id) || [] });
    // Engagement: hearts count double, comments count once.
    post.engagement = (post.score || 0) * 2 + (post.comment_count || 0);
    shaped.push(post);
  }
  shaped.sort((a, b) => (b.engagement - a.engagement) || (b.id - a.id));
  return json({ headlines: shaped.slice(0, limit) });
}
