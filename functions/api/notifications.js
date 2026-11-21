// GET /api/notifications?device_id= — my notifications, newest first,
// plus the unread count. If the migration hasn't run yet, returns an
// empty list instead of crashing.
// POST /api/notifications — mark one or all as read:
//   { device_id, action: "read", id } or { device_id, action: "read_all" }.
import { json, noDb, getDb, readJson, profileByDevice } from "./_lib.js";

const EMPTY = { notifications: [], unread: 0 };

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me) return json(EMPTY);
  let rows = [];
  try {
    // Team pings first (kind "team" is the priority marker), then newest.
    const { results } = await db.prepare(
      "SELECT * FROM notifications WHERE profile_id = ? ORDER BY CASE WHEN kind = 'team' THEN 0 ELSE 1 END, created_at DESC, id DESC LIMIT 50",
    ).bind(me.id).all();
    rows = results || [];
  } catch { return json(EMPTY); /* notifications table not there yet */ }
  let unread = 0;
  try {
    const row = await db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE profile_id = ? AND read = 0").bind(me.id).first();
    unread = row?.n ?? 0;
  } catch { unread = rows.filter((r) => r.read !== 1).length; }
  const actorIds = [...new Set(rows.map((r) => r.actor_profile_id).filter(Boolean))];
  const actors = new Map();
  if (actorIds.length) {
    const placeholders = actorIds.map(() => "?").join(",");
    const { results } = await db.prepare(`SELECT id, username FROM profiles WHERE id IN (${placeholders})`).bind(...actorIds).all();
    for (const a of (results || [])) actors.set(a.id, a.username);
  }
  return json({
    notifications: rows.map((r) => ({
      id: r.id, kind: r.kind, text: r.text, link: r.link || null,
      read: r.read === 1, created_at: r.created_at,
      actor_username: actors.get(r.actor_profile_id) || null,
    })),
    unread,
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first.", unread: 0 });
  const action = String(a.action || "");
  try {
    if (action === "read") {
      const id = Number(a.id || 0);
      if (!id) return json({ ok: false, error: "Missing notification.", unread: 0 });
      await db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND profile_id = ?").bind(id, me.id).run();
    } else if (action === "read_all") {
      await db.prepare("UPDATE notifications SET read = 1 WHERE profile_id = ? AND read = 0").bind(me.id).run();
    } else {
      return json({ ok: false, error: "Pick read or read_all.", unread: 0 });
    }
  } catch { return json({ ok: true, error: null, unread: 0 }); /* table not there yet — nothing to mark */ }
  let unread = 0;
  try {
    const row = await db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE profile_id = ? AND read = 0").bind(me.id).first();
    unread = row?.n ?? 0;
  } catch { /* ignore */ }
  return json({ ok: true, error: null, unread });
}
