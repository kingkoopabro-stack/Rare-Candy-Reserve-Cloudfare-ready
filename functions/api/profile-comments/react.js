// POST /api/profile-comments/react — react to a page/picture comment.
// Reactions (v3.15): heart + sad + confused. One reaction per member
// per comment; tapping the same kind again takes it off, tapping
// another kind switches. Only a NEW heart notifies the author and pays
// the 5 Lucre — sad/confused are silent. Page comments never had a vote
// backend before, so there is no legacy fallback: until
// comment_reactions exists this answers "not switched on yet".
// Who can react: the page owner, the comment's author, or a friend of
// the page owner — the same gate as leaving a page comment.
import { json, noDb, getDb, readJson, profileByDevice, createNotification, awardLucre, LUCRE_AWARDS, REACTION_KINDS, toggleCommentReaction } from "../_lib.js";

async function isFriendOf(db, viewerId, ownerId) {
  if (!viewerId || viewerId === ownerId) return viewerId === ownerId;
  try {
    const f = await db.prepare("SELECT 1 FROM friends WHERE profile_id = ? AND friend_id = ? LIMIT 1").bind(viewerId, ownerId).first();
    return !!f;
  } catch { return true; /* friends table not there yet — don't block reactions */ }
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, hearts: 0, sad: 0, confused: 0, my_reaction: null, my_heart: false });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to react to comments.");
  const kind = REACTION_KINDS.includes(a.kind) ? a.kind : "heart";
  const commentId = Number(a.comment_id);
  if (!commentId) return fail("Pick a comment first.");
  const comment = await db.prepare("SELECT * FROM profile_comments WHERE id = ? LIMIT 1").bind(commentId).first();
  if (!comment) return fail("That comment is gone.");
  const isOwner = me.id === comment.profile_id;
  const isAuthor = me.id === comment.author_id;
  if (!isOwner && !isAuthor && !(await isFriendOf(db, me.id, comment.profile_id))) {
    return fail("Add them as a friend first — only friends can react to page comments.");
  }
  const toggled = await toggleCommentReaction(db, me, "profile", commentId, kind);
  if (!toggled) return fail("Reactions aren't switched on yet — run the update first.");
  // Notification (v3.8) + Lucre (v3.11) — only on a NEW heart.
  if (toggled.my_reaction === "heart") {
    await createNotification(db, {
      profile_id: comment.author_id, actor_profile_id: me.id, kind: "heart",
      ref_type: "profile_comment", ref_id: commentId,
      text: `@${me.username} hearted your page comment`,
      link: `#/member/${comment.profile_id}`,
    });
    await awardLucre(db, me.id, LUCRE_AWARDS.heart, "heart", "profile-comment:" + String(commentId));
  }
  return json({ ok: true, error: null, hearts: toggled.counts.heart, sad: toggled.counts.sad, confused: toggled.counts.confused, my_reaction: toggled.my_reaction, my_heart: toggled.my_reaction === "heart" });
}
