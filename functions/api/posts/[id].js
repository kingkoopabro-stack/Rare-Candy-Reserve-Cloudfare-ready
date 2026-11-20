// GET /api/posts/:id — getPost (permalink target; adult posts only to
// age-verified callers). DELETE /api/posts/:id — deletePost (own posts, or any post if the caller is the operator).
// PUT /api/posts/:id — editPost (feed redesign v3.14): the author (or the
// operator) can change title/body/tags, add a photo or short video they
// forgot, and flip visibility between public and friends-only. A post can
// be changed at most 3 times — every edit is logged in post_edits, and
// the limit is enforced here, server-side. Needs the feed-redesign
// migration (post_edits table + posts.visibility column) to run first.
import { json, noDb, getDb, readJson, profileByDevice, shapePost, normalizeTags, putImage, putVideo, nowMs, canSeePost } from "../_lib.js";

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
  // Feed redesign (v3.14) — friends-only posts are hidden from strangers
  // even on a direct link.
  const caller = deviceId ? await profileByDevice(db, deviceId) : null;
  if (!(await canSeePost(db, caller, row))) return json({ post: null });
  return json({ post: await shapePost(db, row, { id: row.author_id, username: row.author_username, occupation: row.author_occupation, avatar_blob_key: row.author_avatar }) });
}

export async function onRequestPut({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const fail = (error) => json({ ok: false, error });
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first — editing needs a username.");
  const id = Number(params.id);
  const post = await db.prepare("SELECT * FROM posts WHERE id = ? LIMIT 1").bind(id).first();
  if (!post) return fail("That post is gone.");
  // Author can edit their own post; the operator (Chris) can edit any post.
  if (post.profile_id !== me.id && me.is_operator !== 1) return fail("You can only edit your own posts.");
  // 3-edit limit — counted from the post_edits log (the record itself).
  let used = 0;
  try {
    const r = await db.prepare("SELECT COUNT(*) AS n FROM post_edits WHERE post_id = ?").bind(id).first();
    used = Number(r?.n || 0);
  } catch {
    return fail("Post editing isn't switched on yet — the shop is still running a quick database update. Try again later.");
  }
  if (used >= 3) return fail("You've used all 3 edits on this post.");
  const title = String(a.title || "").trim();
  const body = String(a.body || "").trim();
  if (title.length < 3 || title.length > 120) return fail("Title needs 3–120 characters.");
  if (body.length < 1 || body.length > 4000) return fail("Write something in the post (up to 4000 characters).");
  const visibility = a.visibility === "friends" ? "friends" : "public";
  const tags = normalizeTags(a.tags || []).join(",");
  // Media add (v3.14) — a new photo/video replaces the old one; the old
  // R2 object is left orphaned (same as the create flow leaves nothing
  // behind to clean up — R2 keys are never reused).
  let imageKey = post.image_blob_key || null;
  let videoKey = post.video_blob_key || null;
  if (a.image) {
    const up = await putImage(env, "post-images", String(a.device_id), a.image, 2500000);
    if (!up.ok) return fail(up.error);
    imageKey = up.key;
  }
  if (a.video) {
    const up = await putVideo(env, "post-videos", String(a.device_id), a.video, 15000000);
    if (!up.ok) return fail(up.error);
    videoKey = up.key;
  }
  if (post.kind === "card_auth" && !imageKey) return fail("Card Check posts need a photo — add one before saving.");
  const now = nowMs();
  try {
    await db.prepare("INSERT INTO post_edits (post_id, editor_id, title, body, edited_at) VALUES (?, ?, ?, ?, ?)").bind(id, me.id, title, body, now).run();
    await db.prepare("UPDATE posts SET title = ?, body = ?, tags = ?, visibility = ?, image_blob_key = ?, video_blob_key = ?, updated_at = ? WHERE id = ?").bind(title, body, tags, visibility, imageKey, videoKey, now, id).run();
  } catch (e) {
    if (/no such column|no column named/i.test(String((e && e.message) || e))) {
      return fail("Post editing isn't switched on yet — the shop is still running a quick database update. Try again later.");
    }
    throw e;
  }
  const row = await db.prepare(
    `SELECT p.*, a.id AS author_id, a.username AS author_username, a.occupation AS author_occupation, a.avatar_blob_key AS author_avatar
     FROM posts p JOIN profiles a ON a.id = p.profile_id WHERE p.id = ? LIMIT 1`,
  ).bind(id).first();
  return json({ ok: true, error: null, edit_count: used + 1, post: await shapePost(db, row, { id: row.author_id, username: row.author_username, occupation: row.author_occupation, avatar_blob_key: row.author_avatar }) });
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
  // Author can delete their own post; the operator (Chris) can delete any post.
  if (post.profile_id !== me.id && me.is_operator !== 1) return json({ ok: false, error: "You can only delete your own posts." });
  const { results } = await db.prepare("SELECT id FROM comments WHERE post_id = ?").bind(id).all();
  const stmts = [db.prepare("DELETE FROM post_votes WHERE post_id = ?").bind(id)];
  for (const c of (results || [])) stmts.push(db.prepare("DELETE FROM comment_votes WHERE comment_id = ?").bind(c.id));
  stmts.push(db.prepare("DELETE FROM auth_votes WHERE post_id = ?").bind(id));
  stmts.push(db.prepare("DELETE FROM comments WHERE post_id = ?").bind(id));
  stmts.push(db.prepare("DELETE FROM posts WHERE id = ?").bind(id));
  await db.batch(stmts);
  return json({ ok: true, error: null });
}
