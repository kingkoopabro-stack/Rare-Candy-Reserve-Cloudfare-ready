// POST /api/posts/:id/comments/:commentId/vote — voteComment.
// Hearts (or un-hearts) a comment — the only reaction comments have.
import { json, noDb, getDb, readJson, profileByDevice } from "../../../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, hearts: 0, my_heart: false });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to heart comments.");
  const commentId = Number(params.commentId);
  const comment = await db.prepare("SELECT * FROM comments WHERE id = ? LIMIT 1").bind(commentId).first();
  if (!comment) return fail("That comment is gone.");
  const post = await db.prepare("SELECT kind FROM posts WHERE id = ? LIMIT 1").bind(comment.post_id).first();
  if ((post?.kind ?? "forum") === "adult" && me.age_verified !== 1) return fail("The 18+ area is for age-verified members only.");
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
  return json({ ok: true, error: null, hearts: row?.n ?? 0, my_heart: myHeart });
}
