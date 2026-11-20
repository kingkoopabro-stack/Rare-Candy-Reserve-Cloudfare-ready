// POST /api/posts/:id/comments/:commentId/vote — react to a thread comment.
// Reactions (v3.15): heart + sad + confused. One reaction per member
// per comment; tapping the same kind again takes it off, tapping
// another kind switches. Only a NEW heart notifies the author and pays
// the 5 Lucre (once per comment, as before) — sad/confused are silent.
// Until comment_reactions exists, hearts fall back to the legacy
// comment_votes table and sad/confused answer "not switched on yet".
import { json, noDb, getDb, readJson, profileByDevice, createNotification, awardLucre, LUCRE_AWARDS, REACTION_KINDS, toggleCommentReaction } from "../../../../_lib.js";

async function legacyCommentHeart(db, me, commentId) {
  const existing = await db.prepare("SELECT value FROM comment_votes WHERE comment_id = ? AND profile_id = ? LIMIT 1").bind(commentId, me.id).first();
  let myHeart;
  if (existing && existing.value === 1) {
    await db.prepare("DELETE FROM comment_votes WHERE comment_id = ? AND profile_id = ?").bind(commentId, me.id).run();
    myHeart = false;
  } else if (existing) {
    await db.prepare("UPDATE comment_votes SET value = 1 WHERE comment_id = ? AND profile_id = ?").bind(commentId, me.id).run();
    myHeart = true;
  } else {
    await db.prepare("INSERT INTO comment_votes (comment_id, profile_id, value) VALUES (?, ?, 1)").bind(commentId, me.id).run();
    myHeart = true;
  }
  const row = await db.prepare("SELECT COUNT(*) AS n FROM comment_votes WHERE comment_id = ? AND value = 1").bind(commentId).first();
  return { hearts: row?.n ?? 0, my_heart: myHeart };
}

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, hearts: 0, sad: 0, confused: 0, my_reaction: null, my_heart: false });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to react to comments.");
  const kind = REACTION_KINDS.includes(a.kind) ? a.kind : "heart";
  const commentId = Number(params.commentId);
  const comment = await db.prepare("SELECT * FROM comments WHERE id = ? LIMIT 1").bind(commentId).first();
  if (!comment) return fail("That comment is gone.");
  const post = await db.prepare("SELECT kind FROM posts WHERE id = ? LIMIT 1").bind(comment.post_id).first();
  if ((post?.kind ?? "forum") === "adult" && me.age_verified !== 1) return fail("The 18+ area is for age-verified members only.");
  const toggled = await toggleCommentReaction(db, me, "post", commentId, kind);
  if (!toggled) {
    // Reactions table not there yet — hearts still work the old way.
    if (kind !== "heart") return fail("Reactions aren't switched on yet — run the update first.");
    const legacy = await legacyCommentHeart(db, me, commentId);
    if (legacy.my_heart) {
      await createNotification(db, {
        profile_id: comment.profile_id, actor_profile_id: me.id, kind: "heart",
        ref_type: "comment", ref_id: commentId,
        text: `@${me.username} hearted your reply`,
        link: `#/thread/${comment.post_id}`,
      });
      await awardLucre(db, me.id, LUCRE_AWARDS.heart, "heart", "comment:" + String(commentId));
    }
    return json({ ok: true, error: null, hearts: legacy.hearts, sad: 0, confused: 0, my_reaction: legacy.my_heart ? "heart" : null, my_heart: legacy.my_heart });
  }
  // Notification (v3.8) + Lucre (v3.11) — only on a NEW heart.
  if (toggled.my_reaction === "heart") {
    await createNotification(db, {
      profile_id: comment.profile_id, actor_profile_id: me.id, kind: "heart",
      ref_type: "comment", ref_id: commentId,
      text: `@${me.username} hearted your reply`,
      link: `#/thread/${comment.post_id}`,
    });
    await awardLucre(db, me.id, LUCRE_AWARDS.heart, "heart", "comment:" + String(commentId));
  }
  return json({ ok: true, error: null, hearts: toggled.counts.heart, sad: toggled.counts.sad, confused: toggled.counts.confused, my_reaction: toggled.my_reaction, my_heart: toggled.my_reaction === "heart" });
}
