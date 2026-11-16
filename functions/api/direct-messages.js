// AIM-style 1:1 instant messages between members.
// GET /api/direct-messages?device_id=&with=<profileId> — one conversation
//   (oldest first; opening it marks their messages to me as read).
// GET /api/direct-messages?device_id=&inbox=1 — recent conversations with
//   last message + unread counts.
// POST /api/direct-messages — send an IM { device_id, to, body }.
// Members only (guests can't IM — the main room is the guest area).
// If the v2 migration hasn't run yet, every call answers a clean
// "not set up yet" instead of crashing.
import { json, noDb, getDb, readJson, profileByDevice, imageUrl, iso, nowMs } from "./_lib.js";

function dmShape(r, meId) {
  return {
    id: r.id, from_me: r.sender_id === meId,
    sender_id: r.sender_id, sender_username: r.sender_username,
    body: r.body, is_read: r.is_read === 1, created_at: iso(r.created_at),
  };
}

function notSetup() {
  return json({ ok: false, error: "Instant messages aren't set up yet — the shop is still running a quick database update." });
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const params = new URL(request.url).searchParams;
  const me = await profileByDevice(db, params.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first to use instant messages." });
  try {
    if (params.get("inbox") === "1") {
      const { results } = await db.prepare(
        `SELECT
           CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS partner_id,
           MAX(created_at) AS last_at
         FROM direct_messages WHERE sender_id = ? OR recipient_id = ?
         GROUP BY partner_id ORDER BY last_at DESC LIMIT 30`,
      ).bind(me.id, me.id, me.id).all();
      const inbox = [];
      for (const p of (results || [])) {
        const other = await db.prepare("SELECT id, username, avatar_blob_key FROM profiles WHERE id = ? LIMIT 1").bind(p.partner_id).first();
        if (!other) continue;
        const last = await db.prepare(
          `SELECT * FROM direct_messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) ORDER BY id DESC LIMIT 1`,
        ).bind(me.id, p.partner_id, p.partner_id, me.id).first();
        const unread = await db.prepare(
          "SELECT COUNT(*) AS n FROM direct_messages WHERE sender_id = ? AND recipient_id = ? AND is_read = 0",
        ).bind(p.partner_id, me.id).first();
        inbox.push({
          partner_id: other.id, partner_username: other.username,
          partner_avatar_url: imageUrl(other.avatar_blob_key),
          last_body: last ? last.body : "", last_from_me: last ? last.sender_id === me.id : false,
          last_at: last ? iso(last.created_at) : null,
          unread: unread?.n ?? 0,
        });
      }
      return json({ inbox });
    }
    const withId = Number(params.get("with") || 0);
    if (!withId) return json({ ok: false, error: "Pick someone to message." });
    const other = await db.prepare("SELECT id, username FROM profiles WHERE id = ? LIMIT 1").bind(withId).first();
    if (!other) return json({ ok: false, error: "That member doesn't exist." });
    const { results } = await db.prepare(
      `SELECT dm.*, s.username AS sender_username FROM direct_messages dm
       JOIN profiles s ON s.id = dm.sender_id
       WHERE (dm.sender_id = ? AND dm.recipient_id = ?) OR (dm.sender_id = ? AND dm.recipient_id = ?)
       ORDER BY dm.id ASC LIMIT 100`,
    ).bind(me.id, withId, withId, me.id).all();
    await db.prepare(
      "UPDATE direct_messages SET is_read = 1 WHERE sender_id = ? AND recipient_id = ? AND is_read = 0",
    ).bind(withId, me.id).run();
    return json({ with_id: other.id, with_username: other.username, messages: (results || []).map((r) => dmShape(r, me.id)) });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return notSetup();
    throw e;
  }
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first to send instant messages." });
  const toId = Number(a.to || 0);
  const body = String(a.body || "").trim();
  if (!toId || toId === me.id) return json({ ok: false, error: "Pick someone else to message." });
  if (!body || body.length > 500) return json({ ok: false, error: "Write a message (up to 500 characters)." });
  const other = await db.prepare("SELECT id, username FROM profiles WHERE id = ? LIMIT 1").bind(toId).first();
  if (!other) return json({ ok: false, error: "That member doesn't exist." });
  try {
    const now = nowMs();
    const r = await db.prepare(
      "INSERT INTO direct_messages (sender_id, recipient_id, body, is_read, created_at) VALUES (?, ?, ?, 0, ?)",
    ).bind(me.id, toId, body, now).run();
    return json({
      ok: true, error: null,
      message: { id: r.meta.last_row_id, from_me: true, sender_id: me.id, sender_username: me.username, body, is_read: false, created_at: iso(now) },
    });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return notSetup();
    throw e;
  }
}
