// GET /api/listings/:id/comments — listListingComments (oldest first).
// POST /api/listings/:id/comments — addListingComment (when the poster left
// comments on; optional GIF).
import { json, noDb, getDb, readJson, profileByDevice, isOperator, imageUrl, nowMs, createNotification, notifyMentions, awardLucre, LUCRE_AWARDS, commentReactionCounts, silenceCheck, bannedMemberCheck } from "../../_lib.js";

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const id = Number(params.id);
  // 18+ containment (2026-11-21): comments on an adult listing are 18+
  // content — only the seller, the operator, or a signed-in +
  // ID-verified member sees them. The single-listing read gates the
  // listing itself the same way; this closes the direct endpoint.
  const l = await db.prepare("SELECT is_adult, profile_id FROM listings WHERE id = ? LIMIT 1").bind(id).first();
  if (l?.is_adult === 1) {
    const deviceId = new URL(request.url).searchParams.get("device_id") || "";
    const me = deviceId ? await profileByDevice(db, deviceId) : null;
    if (!me || (me.id !== l.profile_id && !isOperator(env, me) && me.age_verified !== 1)) return json({ comments: [] });
  }
  const { results } = await db.prepare(
    `SELECT c.*, a.id AS author_id, a.username AS author_username, a.avatar_blob_key AS author_avatar
     FROM listing_comments c JOIN profiles a ON a.id = c.profile_id WHERE c.listing_id = ? ORDER BY c.id ASC`,
  ).bind(id).all();
  const comments = [];
  for (const r of (results || [])) {
    // Reactions (v3.15) — heart + sad + confused per comment.
    const rc = await commentReactionCounts(db, "listing", r.id);
    comments.push({
      id: r.id, listing_id: r.listing_id, body: r.body, gif_url: r.gif_url ?? null, gif_label: r.gif_label ?? "",
      author_id: r.author_id, author_username: r.author_username, author_avatar_url: imageUrl(r.author_avatar),
      score: rc.heart, hearts: rc.heart, sad: rc.sad, confused: rc.confused,
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
  if (!me) return fail("Create your profile first to comment.");
  // Silence (v3.18) — a silenced member can't comment until it expires.
  const silenced = silenceCheck(me);
  if (silenced) return fail(silenced);
  // Ban (v3.18) — a banned member can't comment at all.
  const banned = bannedMemberCheck(me);
  if (banned) return fail(banned);
  const body = String(a.body || "").trim().slice(0, 2000);
  if (!body && !a.gif_url) return fail("Write something or pick a GIF.");
  const id = Number(params.id);
  const l = await db.prepare("SELECT id, profile_id, allow_comments, is_adult FROM listings WHERE id = ? LIMIT 1").bind(id).first();
  if (!l) return fail("That listing is gone.");
  // 18+ containment (2026-11-21): only the seller, the operator, or a
  // signed-in + ID-verified member comments on an adult listing.
  if (l.is_adult === 1 && me.id !== l.profile_id && !isOperator(env, me) && me.age_verified !== 1) return fail("That listing is 18+ — verify your age with a photo ID first.");
  if (l.allow_comments !== 1) return fail("The poster turned comments off for this one.");
  const r = await db.prepare(
    "INSERT INTO listing_comments (listing_id, profile_id, body, gif_url, gif_label, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(id, me.id, body, a.gif_url ? String(a.gif_url).slice(0, 500) : null, String(a.gif_label || "").slice(0, 80), nowMs()).run();
  // Notifications (v3.17) — @mentions first, then the listing owner —
  // unless the owner was already mentioned, so one comment never pings
  // the same person twice. createNotification skips quietly when the
  // table isn't there yet or it's your own listing.
  const mentioned = await notifyMentions(db, me, body, { ref_type: "listing_comment", ref_id: r.meta.last_row_id, label: "on your listing", link: `#/listing/${id}` });
  if (l.profile_id && !mentioned.has(l.profile_id)) {
    await createNotification(db, {
      profile_id: l.profile_id, actor_profile_id: me.id, kind: "comment",
      ref_type: "listing_comment", ref_id: r.meta.last_row_id,
      text: `@${me.username} commented on your listing`,
      link: `#/listing/${id}`,
    });
  }
  // Lucre (v3.11) — 10 for commenting, once per comment.
  const lw = await awardLucre(db, me.id, LUCRE_AWARDS.comment, "comment", "listing:" + String(r.meta.last_row_id));
  const out = { ok: true, error: null, comment_id: r.meta.last_row_id };
  if (lw.awarded) out.lucre = { awarded: true, balance: lw.balance };
  return json(out);
}
