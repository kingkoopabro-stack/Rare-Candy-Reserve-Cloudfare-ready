// Group Up voice-chat signaling (WebRTC mesh, REST polling).
// GET /api/squads/:id/signals?device_id=&since= — signals addressed to the
//   caller, oldest first, limit 50. Signals older than 10 minutes are
//   pruned on read (signaling is transient — stale offers are useless).
// POST /api/squads/:id/signals — send { device_id, to_profile_id, type,
//   payload }. type is offer | answer | ice-candidate; payload is the
//   JSON-stringified RTCSessionDescription / RTCIceCandidate. Members only,
//   and the recipient must be in the same squad.
import { json, noDb, getDb, readJson, profileByDevice, iso, nowMs } from "../../_lib.js";

const SIGNAL_TTL_MS = 10 * 60 * 1000;
const SIGNAL_TYPES = ["offer", "answer", "ice-candidate"];

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
    if (!(await isMember(db, id, me.id))) return json({ ok: false, error: "Join this group to use voice chat." });
    // Prune stale signals for this squad (older than 10 minutes).
    await db.prepare("DELETE FROM squad_signals WHERE squad_id = ? AND created_at < ?").bind(id, nowMs() - SIGNAL_TTL_MS).run();
    const { results } = await db.prepare(
      "SELECT s.*, p.username AS from_username FROM squad_signals s JOIN profiles p ON p.id = s.from_profile_id WHERE s.squad_id = ? AND s.to_profile_id = ? AND s.id > ? ORDER BY s.id ASC LIMIT 50",
    ).bind(id, me.id, since).all();
    return json({
      signals: (results || []).map((r) => ({
        id: r.id, from_profile_id: r.from_profile_id, from_username: r.from_username,
        type: r.type, payload: r.payload, created_at: iso(r.created_at),
      })),
    });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ signals: [], error: "Group Up isn't set up yet — the shop is still running a quick database update." });
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
  const type = String(a.type || "");
  if (!SIGNAL_TYPES.includes(type)) return fail("Bad signal type.");
  const payload = String(a.payload || "");
  if (!payload || payload.length > 12000) return fail("Bad signal payload.");
  const toId = Number(a.to_profile_id || 0);
  if (!toId || toId === me.id) return fail("Pick another member of the group to signal.");
  const id = Number(params.id);
  try {
    if (!(await isMember(db, id, me.id))) return fail("Join this group to use voice chat.");
    if (!(await isMember(db, id, toId))) return fail("That member isn't in this group.");
    const r = await db.prepare(
      "INSERT INTO squad_signals (squad_id, from_profile_id, to_profile_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(id, me.id, toId, type, payload, nowMs()).run();
    return json({ ok: true, error: null, id: r.meta.last_row_id });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail("Group Up isn't set up yet — the shop is still running a quick database update.");
    throw e;
  }
}
