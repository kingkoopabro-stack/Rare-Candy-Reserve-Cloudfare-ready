// POST /api/menu/requests/:id/decline — the seller turns down a
// custom request. Single transition: requested → declined. The buyer
// is told; nothing is charged (nothing ever is, until accept + pay).
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
  if (row.seller_id !== me.id) return json({ ok: false, error: "Only the seller declines their own requests." });
  if (row.status !== "requested") return json({ ok: false, error: `That request is already ${row.status} — it can't be declined now.` });
  const now = nowMs();
  await db.prepare("UPDATE creator_requests SET status = 'declined', updated_at = ? WHERE id = ?").bind(now, id).run();
  const item = await db.prepare("SELECT title FROM creator_menu_items WHERE id = ? LIMIT 1").bind(row.menu_item_id).first();
  const title = (item && item.title) || "custom content";
  await createNotification(db, {
    profile_id: row.buyer_id, actor_profile_id: me.id, kind: "menu_request", ref_type: "creator_request",
    ref_id: id, text: `✗ @${me.username} can't make "${title}" right now.`,
    link: "/community.html#/chat",
  });
  await sendDM(db, me, row.buyer_id, `✗ Menu request #${id} declined: I can't make "${title}" right now.`);
  return json({ ok: true, error: null, request_id: id, status: "declined" });
}
