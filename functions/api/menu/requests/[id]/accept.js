// POST /api/menu/requests/:id/accept — the seller takes on a custom
// request. Single transition: requested → accepted. Nothing is
// charged here — the buyer pays next, through POST /api/menu/:id/buy
// with this request_id (pay at accept, never authorize-then-capture).
// Auto-accepted requests are created already-accepted and never
// reach this endpoint.
import { json, noDb, getDb, readJson, profileByDevice, nowMs, money, sendDM, createNotification } from "../../../_lib.js";
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
  if (row.seller_id !== me.id) return json({ ok: false, error: "Only the seller accepts their own requests." });
  if (row.status !== "requested") return json({ ok: false, error: `That request is already ${row.status} — it can't be accepted now.` });
  const now = nowMs();
  await db.prepare("UPDATE creator_requests SET status = 'accepted', updated_at = ? WHERE id = ?").bind(now, id).run();
  const item = await db.prepare("SELECT title FROM creator_menu_items WHERE id = ? LIMIT 1").bind(row.menu_item_id).first();
  const title = (item && item.title) || "custom content";
  await createNotification(db, {
    profile_id: row.buyer_id, actor_profile_id: me.id, kind: "menu_request", ref_type: "creator_request",
    ref_id: id, text: `✅ @${me.username} accepted your request for "${title}" — ${money(row.amount_cents)}. Tap Pay on their menu to pay.`,
    link: "/community.html#/chat",
  });
  await sendDM(db, me, row.buyer_id, `✅ Menu request #${id} accepted: I'm making "${title}" for you — pay from my menu (tap the item) and the light goes green once it's confirmed.`);
  return json({ ok: true, error: null, request_id: id, status: "accepted" });
}
