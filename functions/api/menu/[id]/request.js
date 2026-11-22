// POST /api/menu/:id/request — ask a creator to make custom content.
//
// { device_id, payment_method: "stripe"|"manual" }. Creates a durable
// creator_requests row (DMs auto-delete in 24h — the row is the truth,
// the DM is only the surface) + a DM card to the seller with the
// request id in its text, exactly like the DM buy-request flow.
// Auto-accept ON means the request is created already-accepted
// (auto_accepted=1) and the buyer is told to pay straight away.
// Existing items never need a request — they sell instantly, so a
// request for one is refused plainly. Nobody is charged here: payment
// happens after accept, through POST /api/menu/:id/buy with the
// request_id (pay at accept, never authorize-then-capture).
import { json, noDb, getDb, readJson, profileByDevice, nowMs, money, sendDM, createNotification } from "../../_lib.js";
import { ADULT_AREA_MSG, CREATOR_NOT_SETUP_MSG, creatorSalesGate } from "../../_creator.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, request_id: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your account first to send a request.");
  if (me.age_verified !== 1) return fail(ADULT_AREA_MSG);
  const id = Number(params.id);
  let item = null;
  try {
    item = await db.prepare("SELECT * FROM creator_menu_items WHERE id = ? LIMIT 1").bind(id).first();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail(CREATOR_NOT_SETUP_MSG);
    throw e;
  }
  if (!item) return fail("That menu item is gone.");
  if (item.profile_id === me.id) return fail("You can't request your own menu item.");
  if (item.kind !== "custom") return fail("That item sells instantly — tap buy on the seller's menu instead of requesting it.");
  const seller = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(item.profile_id).first();
  if (!seller) return fail("That seller is gone.");
  const gate = creatorSalesGate(seller);
  if (gate) return fail("That creator isn't taking content sales right now.");
  const paymentMethod = a.payment_method === "manual" ? "manual" : "stripe";
  // One open request per buyer per item — the buyer pays or cancels
  // the first one before opening a second.
  try {
    const open = await db.prepare(
      "SELECT id, status FROM creator_requests WHERE menu_item_id = ? AND buyer_id = ? AND status IN ('requested', 'accepted') ORDER BY id DESC LIMIT 1",
    ).bind(item.id, me.id).first();
    if (open) return json({ ok: false, error: "You already have an open request for this item.", request_id: open.id, status: open.status });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail(CREATOR_NOT_SETUP_MSG);
    throw e;
  }
  const autoAccepted = item.auto_accept === 1 ? 1 : 0;
  const status = autoAccepted ? "accepted" : "requested";
  const now = nowMs();
  const r = await db.prepare(
    "INSERT INTO creator_requests (menu_item_id, buyer_id, seller_id, kind, amount_cents, status, auto_accepted, payment_method, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(item.id, me.id, item.profile_id, item.kind, item.price_cents, status, autoAccepted, paymentMethod, now, now).run();
  const reqId = r.meta.last_row_id;
  const cleanTitle = String(item.title || "").replace(/"/g, "'");
  await createNotification(db, {
    profile_id: item.profile_id, actor_profile_id: me.id, kind: "menu_request", ref_type: "creator_request",
    ref_id: reqId,
    text: autoAccepted
      ? `📩 Auto-accepted request: @${me.username} wants "${cleanTitle}" — ${money(item.price_cents)}.`
      : `📩 Request: @${me.username} wants "${cleanTitle}" — ${money(item.price_cents)}.`,
    link: "/community.html#/chat",
  });
  // The DM body carries the request id — the chat renders Accept /
  // Decline on it (same marker contract as the DM buy-request flow).
  await sendDM(db, me, item.profile_id,
    autoAccepted
      ? `📩 Menu request #${reqId}: I want "${cleanTitle}" — ${money(item.price_cents)}. Auto-accepted — I'll pay from your menu.`
      : `📩 Menu request #${reqId}: I want "${cleanTitle}" — ${money(item.price_cents)}. Tap "Accept" below to take it on, or "Decline".`);
  return json({ ok: true, error: null, request_id: reqId, status, auto_accepted: autoAccepted === 1 });
}
