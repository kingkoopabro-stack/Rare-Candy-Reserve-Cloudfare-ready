// GET /api/posts/:id/comments — listComments (oldest first; adult posts
// only to age-verified callers).
// POST /api/posts/:id/comments — addComment (optional GIF).
import { json, noDb, getDb, readJson, profileByDevice, imageUrl, nowMs } from "../../_lib.js";

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const id = Number(params.id);
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const post = await db.prepare("SELECT kind FROM posts WHERE id = ? LIMIT 1").bind(id).first();
  if ((post?.kind ?? "forum") === "adult") {
    const caller = deviceId ? await profileByDevice(db, deviceId) : null;
    if (!caller || caller.age_verified !== 1) return json({ comments: [] });
  }
  const { results } = await db.prepare(
    `SELECT c.*, a.id AS author_id, a.username AS author_username, a.occupation AS author_occupation, a.avatar_blob_key AS author_avatar
     FROM comments c JOIN profiles a ON a.id = c.profile_id WHERE c.post_id = ? ORDER BY c.id ASC`,
  ).bind(id).all();
  const comments = [];
  for (const r of (results || [])) {
    const hearts = await db.prepare("SELECT COUNT(*) AS n FROM comment_votes WHERE comment_id = ? AND value = 1").bind(r.id).first();
    comments.push({
      id: r.id, post_id: r.post_id, body: r.body, gif_url: r.gif_url ?? null, gif_label: r.gif_label ?? "",
      author_id: r.author_id, author_username: r.author_username, author_occupation: r.author_occupation ?? "",
      author_avatar_url: imageUrl(r.author_avatar), score: hearts?.n ?? 0,
      created_at: new Date(r.created_at).toISOString(),
    });
  }
  return json({ comments });
}

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, comment_id: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first — commenting needs a username.");
  const id = Number(params.id);
  const post = await db.prepare("SELECT id, kind, profile_id, allow_comments FROM posts WHERE id = ? LIMIT 1").bind(id).first();
  if (!post) return fail("That post is gone.");
  if ((post.kind ?? "forum") === "adult" && me.age_verified !== 1) return fail("The 18+ area is for age-verified members only — verify your age with a photo ID first.");
  if (post.allow_comments !== 1 && post.profile_id !== me.id) return fail("The author turned comments off on this post — existing comments stay up, but no new ones for now.");
  const body = String(a.body || "").trim().slice(0, 2000);
  if (!body && !a.gif_url) return fail("Write something or pick a GIF.");
  const r = await db.prepare(
    "INSERT INTO comments (post_id, profile_id, body, gif_url, gif_label, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(id, me.id, body, a.gif_url ? String(a.gif_url).slice(0, 500) : null, String(a.gif_label || "").slice(0, 80), nowMs()).run();
  return json({ ok: true, error: null, comment_id: r.meta.last_row_id });
}
