// GET /api/my-listings — listMyListings (caller's own listings, all statuses).
import { json, noDb, getDb, profileByDevice, shapeListing } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me) return json({ listings: [] });
  const { results } = await db.prepare("SELECT * FROM listings WHERE profile_id = ? ORDER BY id DESC").bind(me.id).all();
  const out = [];
  for (const r of (results || [])) out.push(await shapeListing(db, r, me));
  return json({ listings: out });
}
