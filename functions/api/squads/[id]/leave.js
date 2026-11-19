// POST /api/squads/:id/leave — leave a squad { device_id }.
// The chat is ephemeral: leaving ends your access to it. If the last
// member leaves, the squad deletes itself (squad + messages + signals).
import { json, noDb, getDb, readJson, profileByDevice } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first — Group Up is for members.");
  const id = Number(params.id);
  try {
    const row = await db.prepare("SELECT id FROM squads WHERE id = ? LIMIT 1").bind(id).first();
    if (!row) return json({ ok: true, error: null, deleted: true });
    await db.prepare("DELETE FROM squad_members WHERE squad_id = ? AND profile_id = ?").bind(id, me.id).run();
    const left = await db.prepare("SELECT COUNT(*) AS n FROM squad_members WHERE squad_id = ?").bind(id).first();
    if ((left?.n ?? 0) === 0) {
      // Last one out — the room is gone for good.
      await db.batch([
        db.prepare("DELETE FROM squad_messages WHERE squad_id = ?").bind(id),
        db.prepare("DELETE FROM squad_signals WHERE squad_id = ?").bind(id),
        db.prepare("DELETE FROM squads WHERE id = ?").bind(id),
      ]);
      return json({ ok: true, error: null, deleted: true });
    }
    return json({ ok: true, error: null, deleted: false });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail("Group Up isn't set up yet — the shop is still running a quick database update.");
    throw e;
  }
}
