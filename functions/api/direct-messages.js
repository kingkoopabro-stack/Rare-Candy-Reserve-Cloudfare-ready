// AIM-style 1:1 instant messages between members.
// GET /api/direct-messages?device_id=&with=<profileId> — one conversation
//   (oldest first; opening it marks their messages to me as read).
// GET /api/direct-messages?device_id=&inbox=1 — recent conversations with
//   last message + unread counts.
// POST /api/direct-messages — send an IM { device_id, to, body, attachment? }.
// Members only (guests can't IM — the main room is the guest area).
// If the v2 migration hasn't run yet, every call answers a clean
// "not set up yet" instead of crashing.
//
// PRIVATE MESSAGE AUTO-DELETE (decided 2026-11-21): every DM lives
// ONE DAY. Each message carries expires_at = sent + 24h; the GET
// never returns an expired message, and the purge (POST /api/dm-purge,
// plus lazy blob deletion on read) removes the rows AND their attached
// file blobs. The chat text stays only until its day is up — the whole
// thread is gone after a day, so data does not build up. This is DMs
// ONLY — the public live chat and group chats keep their messages.
// NO CHAT ARCHIVING, for privacy: no archive table, no export of old
// chats, no "archived chats" view — expired DMs are deleted, not kept.
import { json, noDb, getDb, readJson, profileByDevice, imageUrl, iso, nowMs, createNotification, putFileAttachment, deleteBlob } from "./_lib.js";

const DM_TTL_MS = 24 * 60 * 60 * 1000;

function dmShape(r, meId) {
  const attachment = r.attachment_key ? {
    url: imageUrl(r.attachment_key),
    name: r.attachment_name ?? "file",
    mime: r.attachment_mime ?? "",
    size: r.attachment_size ?? 0,
    is_image: typeof r.attachment_mime === "string" && r.attachment_mime.startsWith("image/"),
  } : null;
  return {
    id: r.id, from_me: r.sender_id === meId,
    sender_id: r.sender_id, sender_username: r.sender_username,
    body: r.body, is_read: r.is_read === 1, created_at: iso(r.created_at),
    expires_at: iso(r.expires_at ?? null), attachment,
  };
}

// Delete the R2 blobs of expired messages in one thread (lazy purge —
// runs when someone opens the thread, so a dead file never sits there
// waiting on the scheduled purge).
async function purgeExpiredBlobs(env, db, meId, withId) {
  try {
    const { results } = await db.prepare(
      "SELECT attachment_key FROM direct_messages WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)) AND expires_at IS NOT NULL AND expires_at <= ? AND attachment_key IS NOT NULL",
    ).bind(meId, withId, withId, meId, nowMs()).all();
    for (const r of (results || [])) await deleteBlob(env, r.attachment_key);
  } catch { /* attachment columns not there yet — nothing to purge */ }
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
    const other = await db.prepare("SELECT id, username, payout_method, payout_handle FROM profiles WHERE id = ? LIMIT 1").bind(withId).first();
    if (!other) return json({ ok: false, error: "That member doesn't exist." });
    // Auto-delete: never return a message past its day. The lazy purge
    // below also deletes the attached file blobs for this thread.
    await purgeExpiredBlobs(env, db, me.id, withId);
    const { results } = await db.prepare(
      `SELECT dm.*, s.username AS sender_username FROM direct_messages dm
       JOIN profiles s ON s.id = dm.sender_id
       WHERE ((dm.sender_id = ? AND dm.recipient_id = ?) OR (dm.sender_id = ? AND dm.recipient_id = ?))
         AND (dm.expires_at IS NULL OR dm.expires_at > ?)
       ORDER BY dm.id ASC LIMIT 100`,
    ).bind(me.id, withId, withId, me.id, nowMs()).all();
    await db.prepare(
      "UPDATE direct_messages SET is_read = 1 WHERE sender_id = ? AND recipient_id = ? AND is_read = 0",
    ).bind(withId, me.id).run();
    return json({
      with_id: other.id, with_username: other.username,
      // Payment buttons in the IM window deep-link to the other
      // person's payout method with their handle prefilled. This is
      // the ONLY place the handle is shown to another member — never
      // on a public page. Manual payment only; it never touches Stripe.
      with_payout_method: other.payout_method || "",
      with_payout_handle: other.payout_handle || "",
      messages: (results || []).map((r) => dmShape(r, me.id)),
    });
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
  // A message is text, a file, or both — but never neither.
  if ((!body || body.length > 500) && !a.attachment) return json({ ok: false, error: "Write a message (up to 500 characters) or attach a file." });
  if (body.length > 500) return json({ ok: false, error: "Write a message (up to 500 characters)." });
  const other = await db.prepare("SELECT id, username FROM profiles WHERE id = ? LIMIT 1").bind(toId).first();
  if (!other) return json({ ok: false, error: "That member doesn't exist." });
  // Optional attachment: images ≤ 2.5 MB, other files ≤ 10 MB (see
  // _lib.js putFileAttachment). Same R2 bucket, "dm-attachments/".
  let attKey = null, attName = "", attMime = "", attSize = 0;
  if (a.attachment) {
    const up = await putFileAttachment(env, "dm-attachments", String(a.device_id), a.attachment);
    if (!up.ok) return json({ ok: false, error: up.error });
    attKey = up.key;
    attName = String(a.attachment.name || "file").slice(0, 120);
    attMime = up.mime;
    attSize = up.bytes;
  }
  try {
    const now = nowMs();
    let r;
    try {
      r = await db.prepare(
        "INSERT INTO direct_messages (sender_id, recipient_id, body, is_read, created_at, attachment_key, attachment_name, attachment_mime, attachment_size, expires_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)",
      ).bind(me.id, toId, body, now, attKey, attName, attMime, attSize, now + DM_TTL_MS).run();
    } catch (e) {
      if (!/no such column/i.test(String((e && e.message) || e))) throw e;
      // The chat migration hasn't run yet — save the text without the
      // attachment/expiry columns rather than losing the message.
      if (attKey) await deleteBlob(env, attKey);
      r = await db.prepare(
        "INSERT INTO direct_messages (sender_id, recipient_id, body, is_read, created_at) VALUES (?, ?, ?, 0, ?)",
      ).bind(me.id, toId, body, now).run();
    }
    // Notification (v3.8) — skips quietly if the table isn't there yet.
    await createNotification(db, {
      profile_id: toId, actor_profile_id: me.id, kind: "message",
      ref_type: "direct_message", ref_id: r.meta.last_row_id,
      text: `@${me.username} sent you a message`,
      link: `#/member/${me.id}`,
    });
    return json({
      ok: true, error: null,
      message: { id: r.meta.last_row_id, from_me: true, sender_id: me.id, sender_username: me.username, body, is_read: false, created_at: iso(now), expires_at: iso(now + DM_TTL_MS), attachment: attKey ? { url: imageUrl(attKey), name: attName, mime: attMime, size: attSize, is_image: attMime.startsWith("image/") } : null },
    });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return notSetup();
    throw e;
  }
}
