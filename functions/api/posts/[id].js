// GET /api/posts/:id — getPost (permalink target; adult posts only to
// age-verified callers). DELETE /api/posts/:id — deletePost (own posts only).
import { json, noDb, getDb, readJson, profileByDevice, shapePost } from "../_lib.js";

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const id = Number(params.id);
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const row = await db.prepare(
    `SELECT p.*, a.id AS author_id, a.username AS author_username, a.occupation AS author_occupation, a.avatar_blob_key AS author_avatar
     FROM posts p JOIN profiles a ON a.id = p.profile_id WHERE p.id = ? LIMIT 1`,
  ).bind(id).first();
  if (!row) return json({ post: null });
  if ((row.kind ?? "forum") === "adult") {
    const caller = deviceId ? await profileByDevice(db, deviceId) : null;
    if (!caller || caller.age_verified !== 1) return json({ post: null });
  }
  return json({ post: await shapePost(db, row, { id: row.author_id, username: row.author_username, occupation: row.author_occupation, avatar_blob_key: row.author_avatar }) });
}

export async function onRequestDelete({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "No profile on this device." });
  const id = Number(params.id);
  const post = await db.prepare("SELECT * FROM posts WHERE id = ? LIMIT 1").bind(id).first();
  if (!post) return json({ ok: false, error: "That post is already gone." });
  if (post.profile_id !== me.id) return json({ ok: false, error: "You can only delete your own posts." });
  const { results } = await db.prepare("SELECT id FROM comments WHERE post_id = ?").bind(id).all();
  const stmts = [db.prepare("DELETE FROM post_votes WHERE post_id = ?").bind(id)];
  for (const c of (results || [])) stmts.push(db.prepare("DELETE FROM comment_votes WHERE comment_id = ?").bind(c.id));
  stmts.push(db.prepare("DELETE FROM auth_votes WHERE post_id = ?").bind(id));
  stmts.push(db.prepare("DELETE FROM comments WHERE post_id = ?").bind(id));
  stmts.push(db.prepare("DELETE FROM posts WHERE id = ?").bind(id));
  await db.batch(stmts);
  return json({ ok: true, error: null });
}
