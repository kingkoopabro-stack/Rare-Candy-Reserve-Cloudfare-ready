// GET /api/posts/:id/edits — edit history for one post (feed redesign
// v3.14). Lists every edit with its timestamp and who made it, oldest
// first. The ⋯ menu's "Edit history" option reads this. Anyone who can
// see the post can see its history; friends-only posts are gated the
// same way as the post itself. Needs the feed-redesign migration
// (post_edits table) — answers an empty history until it runs.
import { json, noDb, getDb, profileByDevice, canSeePost, iso } from "../../_lib.js";

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const id = Number(params.id);
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const post = await db.prepare("SELECT * FROM posts WHERE id = ? LIMIT 1").bind(id).first();
  if (!post) return json({ edits: [] });
  const caller = deviceId ? await profileByDevice(db, deviceId) : null;
  if (!(await canSeePost(db, caller, post))) return json({ edits: [] });
  let rows = [];
  try {
    const r = await db.prepare(
      `SELECT e.edited_at, p.username AS editor_username
       FROM post_edits e LEFT JOIN profiles p ON p.id = e.editor_id
       WHERE e.post_id = ? ORDER BY e.edited_at ASC`,
    ).bind(id).all();
    rows = r.results || [];
  } catch { rows = []; }
  return json({
    edits: rows.map((r, i) => ({
      n: i + 1,
      edited_at: iso(r.edited_at),
      editor_username: r.editor_username || "member",
    })),
  });
}
