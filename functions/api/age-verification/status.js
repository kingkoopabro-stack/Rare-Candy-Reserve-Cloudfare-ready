// GET /api/age-verification/status?device_id= — the caller's verification
// state: age_verified flag + whether an ID review is pending.
import { json, noDb, getDb, profileByDevice } from "../_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me) return json({ age_verified: false, pending: false });
  const pending = await db.prepare(
    "SELECT id FROM age_verification_requests WHERE profile_id = ? AND status = 'pending' LIMIT 1",
  ).bind(me.id).first();
  return json({ age_verified: me.age_verified === 1, pending: !!pending });
}
