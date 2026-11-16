// Ephemeral private conversations (v3, Creator/Seller area) — seller <-> buyer.
// A private 1:1 conversation between two members, started from a creator
// post or a Find result.
//
// HONEST LABEL — read this before touching the code: messages are stored
// server-side in D1 and deleted when the conversation is closed. That is
// private + ephemeral, NOT true end-to-end encryption — there is no client
// key exchange on this stack, so the server (and anyone with database
// access) could read a message while it exists. The UI just says
// "Private chat" and NEVER words it as encrypted. Do not change that
// wording to something stronger, and do not add the word "encrypted" to
// the UI anywhere. A transaction marked done in a chat saves a receipt
// (see /api/receipts) that survives the message delete — the receipt is
// the only record of the money, and each member sees only their own.
//
// GET /api/ephemeral?device_id=&with=<profileId> — the open conversation
//   with that member (creates it if none is open); messages oldest first.
// GET /api/ephemeral?device_id=&inbox=1 — my open conversations.
// POST /api/ephemeral — send { device_id, to, body } or
//   { device_id, conversation_id, body }. Optional post_id (started from
//   a creator post) is stored on a new conversation so the seller knows
//   what it's about.
// DELETE /api/ephemeral — close & delete { device_id, conversation_id }:
//   deletes ALL messages in the conversation and marks it closed, for
//   both parties. Closing the chat window calls this.
// Only the two participants can read or write a conversation, and only
// age-verified members can start one (the creator area is 18+).
// If the v3 migration hasn't run yet, every call answers a clean
// "not set up yet" instead of crashing.
import { json, noDb, getDb, readJson, profileByDevice, imageUrl, iso, nowMs } from "./_lib.js";

function notSetup() {
  return json({ ok: false, error: "Private chats aren't set up yet — the shop is still running a quick database update." });
}

function isParticipant(conv, profileId) {
  return conv && (conv.member_a_id === profileId || conv.member_b_id === profileId);
}

async function openConversation(db, meId, otherId, postId) {
  const existing = await db.prepare(
    `SELECT * FROM ephemeral_conversations
     WHERE ((member_a_id = ? AND member_b_id = ?) OR (member_a_id = ? AND member_b_id = ?))
     AND closed_at IS NULL ORDER BY id DESC LIMIT 1`,
  ).bind(meId, otherId, otherId, meId).first();
  if (existing) return existing;
  const now = nowMs();
  const r = await db.prepare(
    `INSERT INTO ephemeral_conversations (member_a_id, member_b_id, post_id, created_at, last_message_at, closed_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
  ).bind(meId, otherId, postId || null, now, now).run();
  return await db.prepare("SELECT * FROM ephemeral_conversations WHERE id = ? LIMIT 1").bind(r.meta.last_row_id).first();
}

async function conversationShape(db, conv, meId) {
  const otherId = conv.member_a_id === meId ? conv.member_b_id : conv.member_a_id;
  const other = await db.prepare("SELECT id, username, avatar_blob_key FROM profiles WHERE id = ? LIMIT 1").bind(otherId).first();
  const last = await db.prepare(
    "SELECT * FROM ephemeral_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1",
  ).bind(conv.id).first();
  return {
    conversation_id: conv.id,
    partner_id: other ? other.id : otherId,
    partner_username: other ? other.username : "member",
    partner_avatar_url: other ? imageUrl(other.avatar_blob_key) : null,
    post_id: conv.post_id ?? null,
    last_body: last ? last.body : "",
    last_from_me: last ? last.sender_id === meId : false,
    last_at: last ? iso(last.created_at) : (conv.last_message_at ? iso(conv.last_message_at) : null),
    created_at: iso(conv.created_at),
  };
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const params = new URL(request.url).searchParams;
  const me = await profileByDevice(db, params.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first to use private chats." });
  try {
    if (params.get("inbox") === "1") {
      const { results } = await db.prepare(
        `SELECT * FROM ephemeral_conversations
         WHERE (member_a_id = ? OR member_b_id = ?) AND closed_at IS NULL
         ORDER BY last_message_at DESC LIMIT 30`,
      ).bind(me.id, me.id).all();
      const inbox = [];
      for (const conv of (results || [])) {
        inbox.push(await conversationShape(db, conv, me.id));
      }
      return json({ inbox });
    }
    const withId = Number(params.get("with") || 0);
    const convId = Number(params.get("conversation_id") || 0);
    let conv = null;
    if (convId) {
      conv = await db.prepare("SELECT * FROM ephemeral_conversations WHERE id = ? LIMIT 1").bind(convId).first();
      if (!conv) return json({ ok: false, error: "That chat doesn't exist." });
      if (!isParticipant(conv, me.id)) return json({ ok: false, error: "That's not your chat." });
      if (conv.closed_at) return json({ ok: false, error: "That chat was closed — its messages were deleted.", closed: true, conversation_id: conv.id });
    } else {
      if (!withId) return json({ ok: false, error: "Pick someone to message privately." });
      if (withId === me.id) return json({ ok: false, error: "Pick someone else to message." });
      const other = await db.prepare("SELECT id, username, age_verified FROM profiles WHERE id = ? LIMIT 1").bind(withId).first();
      if (!other) return json({ ok: false, error: "That member doesn't exist." });
      if (me.age_verified !== 1 || other.age_verified !== 1) {
        return json({ ok: false, error: "Private chats are 18+ — both sides need to be age-verified." });
      }
      // post_id (optional): started from a creator post — stored on a new
      // conversation so the seller knows what the chat is about.
      const postId = Number(params.get("post_id") || 0) || null;
      conv = await openConversation(db, me.id, withId, postId);
    }
    const { results } = await db.prepare(
      `SELECT m.*, s.username AS sender_username FROM ephemeral_messages m
       JOIN profiles s ON s.id = m.sender_id
       WHERE m.conversation_id = ? ORDER BY m.id ASC LIMIT 100`,
    ).bind(conv.id).all();
    const otherId = conv.member_a_id === me.id ? conv.member_b_id : conv.member_a_id;
    const other = await db.prepare("SELECT id, username FROM profiles WHERE id = ? LIMIT 1").bind(otherId).first();
    return json({
      conversation_id: conv.id,
      partner_id: other ? other.id : otherId,
      partner_username: other ? other.username : "member",
      post_id: conv.post_id ?? null,
      messages: (results || []).map((r) => ({
        id: r.id, from_me: r.sender_id === me.id,
        sender_id: r.sender_id, sender_username: r.sender_username,
        body: r.body, created_at: iso(r.created_at),
      })),
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
  if (!me) return json({ ok: false, error: "Create your account first to use private chats." });
  if (me.age_verified !== 1) {
    return json({ ok: false, error: "Private chats are 18+ — verify your age with a photo ID first (Rules & After Dark)." });
  }
  const body = String(a.body || "").trim();
  if (!body || body.length > 1000) return json({ ok: false, error: "Write a message (up to 1000 characters)." });
  try {
    let conv = null;
    const convId = Number(a.conversation_id || 0);
    if (convId) {
      conv = await db.prepare("SELECT * FROM ephemeral_conversations WHERE id = ? LIMIT 1").bind(convId).first();
      if (!conv) return json({ ok: false, error: "That chat doesn't exist." });
      if (!isParticipant(conv, me.id)) return json({ ok: false, error: "That's not your chat." });
      if (conv.closed_at) return json({ ok: false, error: "That chat was closed — its messages were deleted. Start a new one." });
    } else {
      const toId = Number(a.to || 0);
      if (!toId || toId === me.id) return json({ ok: false, error: "Pick someone else to message privately." });
      const other = await db.prepare("SELECT id, username, age_verified FROM profiles WHERE id = ? LIMIT 1").bind(toId).first();
      if (!other) return json({ ok: false, error: "That member doesn't exist." });
      if (other.age_verified !== 1) {
        return json({ ok: false, error: "Private chats are 18+ — that member isn't age-verified yet." });
      }
      const postId = Number(a.post_id || 0) || null;
      conv = await openConversation(db, me.id, toId, postId);
    }
    const now = nowMs();
    const r = await db.prepare(
      "INSERT INTO ephemeral_messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)",
    ).bind(conv.id, me.id, body, now).run();
    await db.prepare("UPDATE ephemeral_conversations SET last_message_at = ? WHERE id = ?").bind(now, conv.id).run();
    return json({
      ok: true, error: null, conversation_id: conv.id,
      message: { id: r.meta.last_row_id, from_me: true, sender_id: me.id, sender_username: me.username, body, created_at: iso(now) },
    });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return notSetup();
    throw e;
  }
}

export async function onRequestDelete({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  const convId = Number(a.conversation_id || 0);
  if (!convId) return json({ ok: false, error: "Pick a chat to close." });
  try {
    const conv = await db.prepare("SELECT * FROM ephemeral_conversations WHERE id = ? LIMIT 1").bind(convId).first();
    if (!conv) return json({ ok: false, error: "That chat doesn't exist." });
    if (!isParticipant(conv, me.id)) return json({ ok: false, error: "That's not your chat." });
    if (conv.closed_at) return json({ ok: true, error: null, closed: true, message: "That chat was already closed — its messages were deleted." });
    // Close & delete: every message in the conversation is deleted from
    // the database, for both parties, and the conversation is marked
    // closed so neither side can reopen or read it again.
    await db.batch([
      db.prepare("DELETE FROM ephemeral_messages WHERE conversation_id = ?").bind(convId),
      db.prepare("UPDATE ephemeral_conversations SET closed_at = ? WHERE id = ?").bind(nowMs(), convId),
    ]);
    return json({ ok: true, error: null, closed: true, message: "Chat closed — every message in it was deleted." });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return notSetup();
    throw e;
  }
}
