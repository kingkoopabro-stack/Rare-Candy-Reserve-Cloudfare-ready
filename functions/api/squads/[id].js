// GET /api/squads/:id?device_id= — one squad + its members.
// Open squads are public; private squads only show to their members.
import { json, noDb, getDb, profileByDevice, shapeSquad } from "../_lib.js";

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const id = Number(params.id);
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = deviceId ? await profileByDevice(db, deviceId) : null;
  try {
    const row = await db.prepare("SELECT * FROM squads WHERE id = ? LIMIT 1").bind(id).first();
    if (!row) return json({ squad: null, error: "That group is gone." });
    const shaped = await shapeSquad(db, row, me?.id || null);
    if (shaped.is_private && !shaped.is_member) return json({ squad: null, error: "That group is private — join it with its PIN code." });
    return json({ squad: shaped });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ squad: null, error: "Group Up isn't set up yet — the shop is still running a quick database update." });
    throw e;
  }
}
