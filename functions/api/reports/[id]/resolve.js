// POST /api/reports/:id/resolve — resolveReport (operator only).
import { json, noDb, getDb, readJson, profileByDevice, isOperator } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me || !isOperator(env, me)) return json({ ok: false, error: "Only the operator can resolve reports." });
  await db.prepare("UPDATE reports SET status = 'reviewed' WHERE id = ?").bind(Number(params.id)).run();
  return json({ ok: true, error: null });
}
