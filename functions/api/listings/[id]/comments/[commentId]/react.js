// POST /api/listings/:id/comments/:commentId/react — react to a listing comment.
// Reactions (v3.15): heart + sad + confused. One reaction per member
// per comment; tapping the same kind again takes it off, tapping
// another kind switches. Only a NEW heart notifies the author and pays
// the 5 Lucre — sad/confused are silent. Listing comments never had a
// vote backend before, so there is no legacy fallback: until
// comment_reactions exists this answers "not switched on yet".
import { json, noDb, getDb, readJson, profileByDevice, createNotification, awardLucre, LUCRE_AWARDS, REACTION_KINDS, toggleCommentReaction } from "../../../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, hearts: 0, sad: 0, confused: 0, my_reaction: null, my_heart: false });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to react to comments.");
  const kind = REACTION_KINDS.includes(a.kind) ? a.kind : "heart";
  const listingId = Number(params.id);
  const commentId = Number(params.commentId);
  const comment = await db.prepare("SELECT * FROM listing_comments WHERE id = ? AND listing_id = ? LIMIT 1").bind(commentId, listingId).first();
  if (!comment) return fail("That comment is gone.");
  const toggled = await toggleCommentReaction(db, me, "listing", commentId, kind);
  if (!toggled) return fail("Reactions aren't switched on yet — run the update first.");
  // Notification (v3.8) + Lucre (v3.11) — only on a NEW heart.
  if (toggled.my_reaction === "heart") {
    await createNotification(db, {
      profile_id: comment.profile_id, actor_profile_id: me.id, kind: "heart",
      ref_type: "listing_comment", ref_id: commentId,
      text: `@${me.username} hearted your comment`,
      link: `#/listing/${listingId}`,
    });
    await awardLucre(db, me.id, LUCRE_AWARDS.heart, "heart", "listing-comment:" + String(commentId));
  }
  return json({ ok: true, error: null, hearts: toggled.counts.heart, sad: toggled.counts.sad, confused: toggled.counts.confused, my_reaction: toggled.my_reaction, my_heart: toggled.my_reaction === "heart" });
}
