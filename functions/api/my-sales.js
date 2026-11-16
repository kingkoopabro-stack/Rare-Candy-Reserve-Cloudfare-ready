// GET /api/my-sales — listMySales (orders where the caller is the seller).
import { json, noDb, getDb, profileByDevice, shapeOrder, profilesMap } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me) return json({ orders: [] });
  const { results } = await db.prepare("SELECT * FROM orders WHERE seller_id = ? ORDER BY id DESC").bind(me.id).all();
  const byId = await profilesMap(db);
  const out = [];
  for (const o of (results || [])) out.push(await shapeOrder(db, o, byId));
  return json({ orders: out });
}
