// Profile page comments (v3.7, spec section 9).
// GET /api/profile-comments?profile_id=&device_id= — comments on a
// member's page, newest last. Visibility is enforced per viewer:
//   public  — anyone can see.
//   friends — only friends of the page owner (and the owner + author).
//   private — only the page owner and the author.
// POST /api/profile-comments — leave a comment on a page. Only a
//   signed-in member who added the owner (a friend) or the owner
//   themselves can comment. Optional image or GIF, visibility
//   public / friends / private (default public).
// DELETE /api/profile-comments?id=&device_id= — the page owner, the
//   author, or the operator can delete a comment.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, putImage, imageUrl, iso, nowMs, createNotification, notifyMentions, badgesForProfiles } from "./_lib.js";

async function isFriendOf(db, viewerId, ownerId) {
  if (!viewerId || viewerId === ownerId) return viewerId === ownerId;
  try {
    const f = await db.prepare("SELECT 1 FROM friends WHERE profile_id = ? AND friend_id = ? LIMIT 1").bind(viewerId, ownerId).first();
    return !!f;
  } catch { return true; /* friends table not there yet — don't block comments */ }
}

function canSee(c, viewer, isFriend, isOwner) {
  if (c.visibility === "public") return true;
  if (isOwner) return true;
  if (viewer && c.author_id === viewer.id) return true;
  if (c.visibility === "friends" && isFriend) return true;
  return false;
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const profileId = Number(url.searchParams.get("profile_id"));
  if (!profileId) return json({ ok: false, error: "Pick a page first.", comments: [] });
  const deviceId = url.searchParams.get("device_id") || "";
  const viewer = deviceId ? await profileByDevice(db, deviceId) : null;
  const owner = await db.prepare("SELECT id FROM profiles WHERE id = ? LIMIT 1").bind(profileId).first();
  if (!owner) return json({ ok: false, error: "That page doesn't exist.", comments: [] });
  // v3.9 — subject: which picture a comment belongs to ("avatar",
  // "gallery:<id>"). Empty/missing = the page itself (existing behavior).
  const subject = String(url.searchParams.get("subject") || "").trim().slice(0, 40);
  let rows = [];
  try {
    const r = subject
      ? await db.prepare("SELECT * FROM profile_comments WHERE profile_id = ? AND subject = ? ORDER BY created_at ASC LIMIT 200").bind(profileId, subject).all()
      : await db.prepare("SELECT * FROM profile_comments WHERE profile_id = ? AND subject IS NULL ORDER BY created_at ASC LIMIT 200").bind(profileId).all();
    rows = r.results || [];
  } catch {
    // Table or subject column not there yet — fall back to the plain
    // page-comments list (pre-v3.9 behavior) so nothing breaks.
    try {
      const r = await db.prepare("SELECT * FROM profile_comments WHERE profile_id = ? ORDER BY created_at ASC LIMIT 200").bind(profileId).all();
      rows = r.results || [];
    } catch { return json({ ok: true, comments: [] }); /* table not there yet */ }
  }
  const isOwner = !!viewer && viewer.id === profileId;
  const isFriend = await isFriendOf(db, viewer?.id, profileId);
  const authorIds = [...new Set(rows.map((c) => c.author_id))];
  const authors = new Map();
  if (authorIds.length) {
    const placeholders = authorIds.map(() => "?").join(",");
    const { results } = await db.prepare(`SELECT id, username, avatar_blob_key FROM profiles WHERE id IN (${placeholders})`).bind(...authorIds).all();
    for (const a of (results || [])) authors.set(a.id, a);
  }
  const badgeMap = await badgesForProfiles(db, authorIds);
  const out = [];
  for (const c of rows) {
    if (!canSee(c, viewer, isFriend, isOwner)) continue;
    const a = authors.get(c.author_id) || {};
    out.push({
      id: c.id, profile_id: c.profile_id, author_id: c.author_id,
      author_username: a.username ?? "member", author_avatar_url: imageUrl(a.avatar_blob_key ?? null),
      author_badges: badgeMap.get(c.author_id) || [],
      body: c.body, image_url: imageUrl(c.image_blob_key ?? null), gif_url: c.gif_url ?? null,
      visibility: c.visibility, is_mine: !!viewer && c.author_id === viewer.id,
      created_at: iso(c.created_at),
    });
  }
  return json({ ok: true, comments: out, is_owner: isOwner, can_comment: !!viewer && (isOwner || isFriend) });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!me) return json({ ok: false, error: "Sign in to leave a page comment." });
  const profileId = Number(a.profile_id);
  if (!profileId) return json({ ok: false, error: "Pick a page first." });
  const owner = await db.prepare("SELECT id FROM profiles WHERE id = ? LIMIT 1").bind(profileId).first();
  if (!owner) return json({ ok: false, error: "That page doesn't exist." });
  const isFriend = await isFriendOf(db, me.id, profileId);
  if (me.id !== profileId && !isFriend) {
    return json({ ok: false, error: "Add them as a friend first — only friends can leave page comments." });
  }
  const body = String(a.body || "").trim();
  if (!body && !a.image && !a.gif_url) return json({ ok: false, error: "Write something, or attach a picture or GIF." });
  if (body.length > 500) return json({ ok: false, error: "Keep it under 500 characters." });
  const visibility = ["public", "friends", "private"].includes(a.visibility) ? a.visibility : "public";
  // v3.9 — subject: which picture the comment belongs to ("avatar",
  // "gallery:<id>"). Empty = the page itself. Only the safe pattern is
  // accepted; anything else is treated as a page comment.
  const subjectRaw = String(a.subject || "").trim().slice(0, 40);
  const subject = /^[a-z0-9:_-]{1,40}$/.test(subjectRaw) ? subjectRaw : null;
  let imageKey = null;
  if (a.image) {
    const up = await putImage(env, "comment-images", String(a.device_id), a.image, 2500000);
    if (!up.ok) return json({ ok: false, error: up.error });
    imageKey = up.key;
  }
  const gifUrl = String(a.gif_url || "").trim().slice(0, 500);
  if (gifUrl && !/^https:\/\//i.test(gifUrl)) return json({ ok: false, error: "GIF needs an https:// link." });
  let commentId = null;
  let subjectSkipped = false;
  try {
    const r = await db.prepare("INSERT INTO profile_comments (profile_id, author_id, body, image_blob_key, gif_url, visibility, subject, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(profileId, me.id, body, imageKey, gifUrl || null, visibility, subject, nowMs()).run();
    commentId = r.meta.last_row_id;
  } catch (e) {
    // The subject column isn't there yet (migration pending) — retry
    // without it so the comment still lands as a page comment.
    if (!/no such column|no column named/i.test(String((e && e.message) || e))) {
      return json({ ok: false, error: "Page comments aren't switched on yet — run the v3.7 update first." });
    }
    try {
      const r = await db.prepare("INSERT INTO profile_comments (profile_id, author_id, body, image_blob_key, gif_url, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(profileId, me.id, body, imageKey, gifUrl || null, visibility, nowMs()).run();
      commentId = r.meta.last_row_id;
      subjectSkipped = true;
    } catch {
      return json({ ok: false, error: "Page comments aren't switched on yet — run the v3.7 update first." });
    }
  }
  // Notifications (v3.8) — never block the response; createNotification
  // skips quietly when the table isn't there yet or it's your own page.
  await createNotification(db, {
    profile_id: profileId, actor_profile_id: me.id, kind: "comment",
    ref_type: "profile_comment", ref_id: commentId,
    text: subject ? `@${me.username} commented on your picture` : `@${me.username} commented on your page`,
    link: `#/member/${profileId}`,
  });
  await notifyMentions(db, me, body, { ref_type: "profile_comment", ref_id: commentId, label: "in a page comment", link: `#/member/${profileId}` });
  return json({ ok: true, error: null, subject_skipped: subjectSkipped });
}

export async function onRequestDelete({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const deviceId = url.searchParams.get("device_id") || "";
  const me = deviceId ? await profileByDevice(db, deviceId) : null;
  if (!me || !id) return json({ ok: false, error: "Sign in first." });
  const c = await db.prepare("SELECT * FROM profile_comments WHERE id = ? LIMIT 1").bind(id).first();
  if (!c) return json({ ok: false, error: "That comment is gone already." });
  const isOwner = me.id === c.profile_id;
  const isAuthor = me.id === c.author_id;
  if (!isOwner && !isAuthor && !isOperator(env, me)) return json({ ok: false, error: "Only the page owner, the author, or the operator can delete this." });
  await db.prepare("DELETE FROM profile_comments WHERE id = ?").bind(id).run();
  return json({ ok: true, error: null });
}
