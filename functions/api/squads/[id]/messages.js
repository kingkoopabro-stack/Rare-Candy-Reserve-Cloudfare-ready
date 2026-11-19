// Group Up text chat — ephemeral, members only.
// GET /api/squads/:id/messages?device_id=&since= — messages oldest first,
//   limit 100. `since` is a message id: only messages after it (polling).
// POST /api/squads/:id/messages — send { device_id, text } (1–500 chars).
// Leaving the squad ends access to the chat; when the squad deletes,
// its messages go with it.
import { json, noDb, getDb, readJson, profileByDevice, iso, nowMs } from "../../_lib.js";

async function isMember(db, squadId, profileId) {
  const row = await db.prepare("SELECT 1 AS x FROM squad_members WHERE squad_id = ? AND profile_id = ? LIMIT 1").bind(squadId, profileId).first();
  return !!row;
}

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const id = Number(params.id);
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your profile first — Group Up is for members." });
  const since = Number(q.get("since") || 0);
  try {
    if (!(await isMember(db, id, me.id))) return json({ ok: false, error: "Join this group to see its chat." });
    const { results } = await db.prepare(
      "SELECT m.*, p.username FROM squad_messages m JOIN profiles p ON p.id = m.profile_id WHERE m.squad_id = ? AND m.id > ? ORDER BY m.id ASC LIMIT 100",
    ).bind(id, since).all();
    return json({
      messages: (results || []).map((r) => ({
        id: r.id, profile_id: r.profile_id, username: r.username,
        body: r.body, created_at: iso(r.created_at),
      })),
    });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ messages: [], error: "Group Up isn't set up yet — the shop is still running a quick database update." });
    throw e;
  }
}

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first — Group Up is for members.");
  const text = String(a.text || "").trim();
  if (!text || text.length > 500) return fail("Write a message (up to 500 characters).");
  const id = Number(params.id);
  try {
    if (!(await isMember(db, id, me.id))) return fail("Join this group to chat in it.");
    const now = nowMs();
    const r = await db.prepare(
      "INSERT INTO squad_messages (squad_id, profile_id, body, created_at) VALUES (?, ?, ?, ?)",
    ).bind(id, me.id, text, now).run();
    await db.prepare("UPDATE squads SET last_activity_at = ? WHERE id = ?").bind(now, id).run();
    return json({
      ok: true, error: null,
      message: { id: r.meta.last_row_id, profile_id: me.id, username: me.username, body: text, created_at: iso(now) },
    });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail("Group Up isn't set up yet — the shop is still running a quick database update.");
    throw e;
  }
}
