// DELETE /api/posts/:id/comments/:commentId — deleteComment (own comments only).
import { json, noDb, getDb, readJson, profileByDevice } from "../../../_lib.js";

export async function onRequestDelete({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "No profile on this device." });
  const commentId = Number(params.commentId);
  const comment = await db.prepare("SELECT * FROM comments WHERE id = ? LIMIT 1").bind(commentId).first();
  if (!comment) return json({ ok: false, error: "That comment is already gone." });
  if (comment.profile_id !== me.id) return json({ ok: false, error: "You can only delete your own comments." });
  await db.batch([
    db.prepare("DELETE FROM comment_votes WHERE comment_id = ?").bind(commentId),
    db.prepare("DELETE FROM comments WHERE id = ?").bind(commentId),
  ]);
  return json({ ok: true, error: null });
}
