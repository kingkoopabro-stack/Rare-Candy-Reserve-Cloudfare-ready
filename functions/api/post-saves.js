// GET /api/post-saves?device_id= — the post ids I saved (feed redesign
// v3.14). POST /api/post-saves — save or unsave a post. This is the
// server-side log of who saved what, when: one row per (member, post)
// with a timestamp, so saves are recorded, not just remembered on one
// device. Guests can't save server-side (no account to log it under) —
// their saves stay in localStorage only. Needs the feed-redesign
// migration (post_saves table) — answers "not switched on yet" until
// it runs. No Lucre is paid for saving.
import { json, noDb, getDb, readJson, profileByDevice, nowMs } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = deviceId ? await profileByDevice(db, deviceId) : null;
  if (!me) return json({ saved_post_ids: [] });
  let rows = [];
  try {
    const r = await db.prepare("SELECT post_id FROM post_saves WHERE profile_id = ? ORDER BY created_at DESC").bind(me.id).all();
    rows = r.results || [];
  } catch { rows = []; }
  return json({ saved_post_ids: rows.map((r) => r.post_id) });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first — saving posts is for members." });
  const postId = Math.round(Number(a.post_id) || 0);
  if (postId <= 0) return json({ ok: false, error: "Missing post." });
  const post = await db.prepare("SELECT id FROM posts WHERE id = ? LIMIT 1").bind(postId).first();
  if (!post) return json({ ok: false, error: "That post is gone." });
  const action = String(a.action || "");
  if (action !== "add" && action !== "remove") return json({ ok: false, error: "Pick add or remove." });
  try {
    if (action === "add") {
      await db.prepare("INSERT OR IGNORE INTO post_saves (profile_id, post_id, created_at) VALUES (?, ?, ?)").bind(me.id, postId, nowMs()).run();
      return json({ ok: true, error: null, saved: true });
    }
    await db.prepare("DELETE FROM post_saves WHERE profile_id = ? AND post_id = ?").bind(me.id, postId).run();
    return json({ ok: true, error: null, saved: false });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) {
      return json({ ok: false, error: "Saving isn't switched on yet — the shop is still running a quick database update. Try again later." });
    }
    throw e;
  }
}
