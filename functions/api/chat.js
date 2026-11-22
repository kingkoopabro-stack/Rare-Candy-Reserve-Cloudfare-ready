// GET /api/chat — listChatMessages (latest first stored, returned oldest last).
// POST /api/chat — postChatMessage. Signed-in members chat under their chat
// name (or username) uncensored; guests chat under a name they pick (or
// "Guest") and their messages are ALWAYS profanity-censored server-side
// before storage. Members may attach one file (images ≤ 2.5 MB, other
// files ≤ 10 MB — same caps as DMs, same R2 bucket, "chat-attachments/").
// Guests can't attach. Live chat is NOT auto-deleted — the 24h rule is
// DMs only.
import { json, noDb, getDb, readJson, profileByDevice, censorText, iso, nowMs, badgesForProfiles, putFileAttachment, imageUrl, deleteBlob } from "./_lib.js";

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
      attachment: r.attachment_key ? {
        url: imageUrl(r.attachment_key), name: r.attachment_name ?? "file",
        mime: r.attachment_mime ?? "", size: r.attachment_size ?? 0,
        is_image: typeof r.attachment_mime === "string" && r.attachment_mime.startsWith("image/"),
      } : null,
    })),
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const bodyRaw = String(a.body || "").trim();
  if ((!bodyRaw || bodyRaw.length > 500) && !a.attachment) return json({ ok: false, error: "Write a message (up to 500 characters) or attach a file.", censored: false });
  if (bodyRaw.length > 500) return json({ ok: false, error: "Write a message (up to 500 characters).", censored: false });
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  let authorName, body, censored = false;
  if (me) {
    authorName = me.chat_name || me.username;
    body = bodyRaw;
  } else {
    if (a.attachment) return json({ ok: false, error: "Guests can't attach files — create an account first.", censored: false });
    authorName = String(a.guest_name || "").trim().slice(0, 24) || "Guest";
    const c = censorText(bodyRaw);
    body = c.text;
    censored = c.censored;
  }
  let attKey = null, attName = "", attMime = "", attSize = 0;
  if (a.attachment) {
    const up = await putFileAttachment(env, "chat-attachments", String(a.device_id), a.attachment);
    if (!up.ok) return json({ ok: false, error: up.error, censored: false });
    attKey = up.key;
    attName = String(a.attachment.name || "file").slice(0, 120);
    attMime = up.mime;
    attSize = up.bytes;
  }
  try {
    await db.prepare("INSERT INTO chat_messages (profile_id, author_name, body, censored, created_at, attachment_key, attachment_name, attachment_mime, attachment_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(me?.id ?? null, authorName, body, censored ? 1 : 0, nowMs(), attKey, attName, attMime, attSize).run();
  } catch (e) {
    if (!/no such column/i.test(String((e && e.message) || e))) throw e;
    if (attKey) await deleteBlob(env, attKey);
    await db.prepare("INSERT INTO chat_messages (profile_id, author_name, body, censored, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(me?.id ?? null, authorName, body, censored ? 1 : 0, nowMs()).run();
  }
  return json({ ok: true, error: null, censored });
}
