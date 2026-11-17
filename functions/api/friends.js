// GET /api/friends?device_id= — my friends list.
// POST /api/friends — add or remove a friend. One click = friends
// (instant, no approval, per the MySpace spec). Stored in BOTH
// directions so "are we friends" is one lookup; unfriend deletes both.
// Requires the v3.6 migration (friends table); without it, writes fail
// with a clear error instead of silently doing nothing.
import { json, noDb, getDb, readJson, profileByDevice, imageUrl, nowMs } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me) return json({ friends: [] });
  let rows = [];
  try {
    const { results } = await db.prepare(
      "SELECT p.id, p.username, p.avatar_blob_key FROM friends f JOIN profiles p ON p.id = f.friend_id WHERE f.profile_id = ? ORDER BY p.username ASC",
    ).bind(me.id).all();
    rows = results || [];
  } catch { rows = []; }
  return json({ friends: rows.map((p) => ({ id: p.id, username: p.username, avatar_url: imageUrl(p.avatar_blob_key) })) });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first — friends are for members." });
  const friendId = Math.round(Number(a.friend_id) || 0);
  if (friendId <= 0) return json({ ok: false, error: "Missing member." });
  if (friendId === me.id) return json({ ok: false, error: "That's you — you're already your own best friend." });
  const target = await db.prepare("SELECT id FROM profiles WHERE id = ? LIMIT 1").bind(friendId).first();
  if (!target) return json({ ok: false, error: "That member doesn't exist." });
  const action = String(a.action || "");
  if (action !== "add" && action !== "remove") return json({ ok: false, error: "Pick add or remove." });
  try {
    if (action === "add") {
      const now = nowMs();
      await db.prepare("INSERT OR IGNORE INTO friends (profile_id, friend_id, created_at) VALUES (?, ?, ?)").bind(me.id, friendId, now).run();
      await db.prepare("INSERT OR IGNORE INTO friends (profile_id, friend_id, created_at) VALUES (?, ?, ?)").bind(friendId, me.id, now).run();
      return json({ ok: true, error: null, is_friend: true });
    }
    await db.prepare("DELETE FROM friends WHERE (profile_id = ? AND friend_id = ?) OR (profile_id = ? AND friend_id = ?)").bind(me.id, friendId, friendId, me.id).run();
    return json({ ok: true, error: null, is_friend: false });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) {
      return json({ ok: false, error: "Friends aren't switched on yet — the shop is still running a quick database update. Try again later." });
    }
    throw e;
  }
}
