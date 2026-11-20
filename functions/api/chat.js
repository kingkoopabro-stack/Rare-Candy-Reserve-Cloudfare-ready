// GET /api/chat — listChatMessages (latest first stored, returned oldest last).
// POST /api/chat — postChatMessage. Signed-in members chat under their chat
// name (or username) uncensored; guests chat under a name they pick (or
// "Guest") and their messages are ALWAYS profanity-censored server-side
// before storage.
import { json, noDb, getDb, readJson, profileByDevice, censorText, iso, nowMs, badgesForProfiles } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const limit = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get("limit") || "60", 10) || 60, 1), 100);
  const { results } = await db.prepare("SELECT * FROM chat_messages ORDER BY id DESC LIMIT ?").bind(limit).all();
  const rows = (results || []).reverse();
  const badgeMap = await badgesForProfiles(db, rows.map((r) => r.profile_id));
  return json({
    messages: rows.map((r) => ({
      id: r.id, author_name: r.author_name, is_member: r.profile_id != null,
      profile_id: r.profile_id ?? null, author_badges: r.profile_id ? (badgeMap.get(r.profile_id) || []) : [],
      body: r.body, censored: r.censored === 1, created_at: iso(r.created_at),
    })),
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const bodyRaw = String(a.body || "").trim();
  if (!bodyRaw || bodyRaw.length > 500) return json({ ok: false, error: "Write a message (up to 500 characters).", censored: false });
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  let authorName, body, censored = false;
  if (me) {
    authorName = me.chat_name || me.username;
    body = bodyRaw;
  } else {
    authorName = String(a.guest_name || "").trim().slice(0, 24) || "Guest";
    const c = censorText(bodyRaw);
    body = c.text;
    censored = c.censored;
  }
  await db.prepare("INSERT INTO chat_messages (profile_id, author_name, body, censored, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(me?.id ?? null, authorName, body, censored ? 1 : 0, nowMs()).run();
  return json({ ok: true, error: null, censored });
}
