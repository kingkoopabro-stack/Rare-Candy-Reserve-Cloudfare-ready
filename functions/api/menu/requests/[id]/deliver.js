// POST /api/menu/requests/:id/deliver — the seller delivers finished
// custom work for a PAID request.
//
// ADDITION beyond the brief's endpoint list (flagged in the build
// report): the brief's status machine runs requested → accepted →
// paid → making → delivered → completed, but no endpoint reached
// 'delivered'. This is it: { device_id, package_id }. The package
// must be the seller's, with its zip uploaded; the request must be
// 'paid'. The buyer is told the piece is in their My stuff, and the
// order's "I got it" confirm moves the request to 'completed'.
// Delivery is never a DM attachment (DMs auto-delete in 24h) — the
// package zip is the product, reached through the CS# record.
import { json, noDb, getDb, readJson, profileByDevice, nowMs, sendDM, createNotification } from "../../../_lib.js";
import { CREATOR_NOT_SETUP_MSG } from "../../../_creator.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  const id = Number(params.id);
  let row = null;
  try {
    row = await db.prepare("SELECT * FROM creator_requests WHERE id = ? LIMIT 1").bind(id).first();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG });
    throw e;
  }
  if (!row) return json({ ok: false, error: "That request is gone." });
  if (row.seller_id !== me.id) return json({ ok: false, error: "Only the seller delivers their own requests." });
  if (row.status !== "paid") return json({ ok: false, error: `That request is ${row.status} — deliver it once it's paid.` });
  const packageId = Number(a.package_id || 0);
  if (!packageId) return json({ ok: false, error: "Pick the finished package to deliver." });
  const pkg = await db.prepare("SELECT * FROM creator_packages WHERE id = ? LIMIT 1").bind(packageId).first();
  if (!pkg) return json({ ok: false, error: "That package is gone." });
  if (pkg.profile_id !== me.id) return json({ ok: false, error: "That package isn't yours." });
  if (!pkg.zip_key) return json({ ok: false, error: "That package has no uploaded zip yet — upload it in your vault first." });
  const now = nowMs();
  await db.prepare("UPDATE creator_requests SET status = 'delivered', package_id = ?, updated_at = ? WHERE id = ?").bind(packageId, now, id).run();
  const item = await db.prepare("SELECT title FROM creator_menu_items WHERE id = ? LIMIT 1").bind(row.menu_item_id).first();
  const title = (item && item.title) || "custom content";
  await createNotification(db, {
    profile_id: row.buyer_id, actor_profile_id: me.id, kind: "menu_request", ref_type: "creator_request",
    ref_id: id, text: `📦 @${me.username} delivered your "${title}" — it's in your My stuff now.`,
    link: "/community.html#/chat",
  });
  await sendDM(db, me, row.buyer_id, `📦 Menu request #${id} delivered: your "${title}" is in My stuff now — tap "I got it" on the order to complete it.`);
  return json({ ok: true, error: null, request_id: id, status: "delivered", package_id: packageId });
}
