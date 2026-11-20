// Taffy Phone Notes (v3.10) — one persistent note per member.
// The phone's Notes app used to be session-only (gone when you leave
// the tab). Now the note lives in D1 under the member's profile, so it
// is still there when they come back. One note at a time, 500 chars max.
// Auth is the same per-browser device_id as the profile itself —
// profiles don't roam across browsers, and neither does the note.
// GET /api/notes?device_id= — { ok, note }
// POST /api/notes { device_id, note } — { ok, note }
import { json, noDb, getDb, readJson, profileByDevice, nowMs } from "./_lib.js";

const MAX_NOTE = 500;

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = deviceId ? await profileByDevice(db, deviceId) : null;
  if (!me) return json({ ok: false, error: "Sign in to keep notes.", note: "" });
  let note = "";
  try {
    const row = await db.prepare("SELECT note_text FROM profile_notes WHERE profile_id = ? LIMIT 1").bind(me.id).first();
    note = row ? String(row.note_text || "") : "";
  } catch { return json({ ok: true, note: "" }); /* table not there yet — run the migration */ }
  return json({ ok: true, note });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!me) return json({ ok: false, error: "Sign in to keep notes." });
  const note = String(a.note || "").slice(0, MAX_NOTE);
  try {
    await db.prepare(
      "INSERT INTO profile_notes (profile_id, note_text, updated_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(profile_id) DO UPDATE SET note_text = excluded.note_text, updated_at = excluded.updated_at",
    ).bind(me.id, note, nowMs()).run();
  } catch {
    return json({ ok: false, error: "Notes aren't switched on yet — run the profile-notes update first." });
  }
  return json({ ok: true, note });
}
