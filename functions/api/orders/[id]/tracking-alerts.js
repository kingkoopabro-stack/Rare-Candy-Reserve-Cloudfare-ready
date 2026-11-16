// POST /api/orders/:id/tracking-alerts — setOrderTrackingAlerts (buyer only).
// The preference is saved on the order; actual alert emails send once the
// street's mail connection is live (labeled in the UI until then).
import { json, noDb, getDb, readJson, profileByDevice, nowMs } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "No profile on this device.", tracking_alerts: false });
  const id = Number(params.id);
  const o = await db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1").bind(id).first();
  if (!o) return json({ ok: false, error: "That order is gone.", tracking_alerts: false });
  if (o.buyer_id !== me.id) return json({ ok: false, error: "Tracking alerts are set by the buyer on their own orders.", tracking_alerts: false });
  const enabled = !!a.enabled;
  await db.prepare("UPDATE orders SET tracking_alerts = ?, updated_at = ? WHERE id = ?").bind(enabled ? 1 : 0, nowMs(), id).run();
  return json({ ok: true, error: null, tracking_alerts: enabled });
}
