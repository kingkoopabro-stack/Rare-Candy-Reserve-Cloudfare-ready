// POST /api/posts/:id/toggle-comments — togglePostComments (author only).
// While off, nobody but the author can add new comments; existing comments
// stay visible. Works on every post kind.
import { json, noDb, getDb, readJson, profileByDevice, nowMs } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "No profile on this device.", allow_comments: true });
  const id = Number(params.id);
  const post = await db.prepare("SELECT * FROM posts WHERE id = ? LIMIT 1").bind(id).first();
  if (!post) return json({ ok: false, error: "That post is already gone.", allow_comments: true });
  if (post.profile_id !== me.id) return json({ ok: false, error: "Only the author can turn comments on or off on a post.", allow_comments: post.allow_comments === 1 });
  const allow = !!a.allow_comments;
  await db.prepare("UPDATE posts SET allow_comments = ?, updated_at = ? WHERE id = ?").bind(allow ? 1 : 0, nowMs(), id).run();
  return json({ ok: true, error: null, allow_comments: allow });
}
