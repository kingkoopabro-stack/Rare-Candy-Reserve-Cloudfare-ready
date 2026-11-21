// GET /api/posts/:id/comments — listComments (oldest first; adult posts
// only to age-verified callers).
// POST /api/posts/:id/comments — addComment (optional GIF).
import { json, noDb, getDb, readJson, profileByDevice, imageUrl, nowMs, createNotification, notifyMentions, badgesForProfiles, awardLucre, LUCRE_AWARDS, commentReactionCounts, silenceCheck, bannedMemberCheck } from "../../_lib.js";

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
  const badgeMap = await badgesForProfiles(db, (results || []).map((r) => r.author_id));
  for (const r of (results || [])) {
    // Reactions (v3.15) — heart + sad + confused per comment.
    const rc = await commentReactionCounts(db, "post", r.id);
    comments.push({
      id: r.id, post_id: r.post_id, body: r.body, gif_url: r.gif_url ?? null, gif_label: r.gif_label ?? "",
      author_id: r.author_id, author_username: r.author_username, author_occupation: r.author_occupation ?? "",
      author_avatar_url: imageUrl(r.author_avatar), author_badges: badgeMap.get(r.author_id) || [], score: rc.heart,
      hearts: rc.heart, sad: rc.sad, confused: rc.confused,
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
  // Silence (v3.18) — a silenced member can't comment until it expires.
  const silenced = silenceCheck(me);
  if (silenced) return fail(silenced);
  // Ban (v3.18) — a banned member can't comment at all.
  const banned = bannedMemberCheck(me);
  if (banned) return fail(banned);
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
  // Notifications (v3.8) — @mentions in the body first, then a reply
  // to the post author — unless the author was already mentioned, so
  // one comment never pings the same person twice. createNotification
  // skips quietly when the table isn't there yet or it's your own post.
  const mentioned = await notifyMentions(db, me, body, { ref_type: "comment", ref_id: r.meta.last_row_id, label: "in a reply", link: `#/thread/${id}` });
  if (!mentioned.has(post.profile_id)) {
    await createNotification(db, {
      profile_id: post.profile_id, actor_profile_id: me.id, kind: "reply",
      ref_type: "comment", ref_id: r.meta.last_row_id,
      text: `@${me.username} replied to your post`,
      link: `#/thread/${id}`,
    });
  }
  // Lucre (v3.11) — 10 for commenting, once per comment.
  const lw = await awardLucre(db, me.id, LUCRE_AWARDS.comment, "comment", String(r.meta.last_row_id));
  const out = { ok: true, error: null, comment_id: r.meta.last_row_id };
  if (lw.awarded) out.lucre = { awarded: true, balance: lw.balance };
  return json(out);
}
