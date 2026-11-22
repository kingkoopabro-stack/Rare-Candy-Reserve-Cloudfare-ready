// POST /api/menu/:id/buy — buy one menu item.
//
// { device_id, payment_method: "stripe"|"manual", request_id? }
// The price is ALWAYS re-read from the menu row — never trusted
// from the client. Stripe: a pending_payment order + a Checkout
// Session (destination charge to the seller's Connect account, 6% on
// the item price only) — nothing is charged here, and nothing unlocks
// until /api/checkout/confirm or the webhook verifies the payment.
// Manual: a pending_payment order with payment_method 'manual' — the
// light stays RED until the seller/team marks it paid; the buyer pays
// the seller outside the site (Cash App / PayPal / Venmo handle from
// the seller's profile, or the per-item methods).
// Custom items can't be bought outright — they need an accepted
// request first (pass its request_id). The seller must have a linked
// bank for Stripe buys, and content sales switched on.
import { json, noDb, getDb, readJson, profileByDevice, nowMs, money, notifyBuyerSeller } from "../../_lib.js";
import { platformFeeCents } from "../../_stripe.js";
import {
  ADULT_AREA_MSG, CREATOR_NOT_SETUP_MSG, creatorSalesGate,
  insertMenuOrder, startMenuCheckout,
} from "../../_creator.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, order_id: null, checkout_url: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to buy — orders live on your profile.");
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
  if (item.profile_id === me.id) return fail("You can't buy your own menu item.");
  const seller = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(item.profile_id).first();
  if (!seller) return fail("That seller is gone.");
  const gate = creatorSalesGate(seller);
  if (gate) return fail("That creator isn't taking content sales right now.");
  const paymentMethod = a.payment_method === "manual" ? "manual" : "stripe";
  // Custom work is made on request: an accepted request is the ticket
  // to pay. Existing items sell instantly, no request needed.
  let reqRow = null;
  if (item.kind === "custom") {
    const reqId = Number(a.request_id || 0);
    if (!reqId) return fail("Custom content is made on request — send a request first and wait for the seller to accept it.");
    try {
      reqRow = await db.prepare("SELECT * FROM creator_requests WHERE id = ? LIMIT 1").bind(reqId).first();
    } catch (e) {
      if (/no such table/i.test(String((e && e.message) || e))) return fail(CREATOR_NOT_SETUP_MSG);
      throw e;
    }
    if (!reqRow || reqRow.menu_item_id !== item.id || reqRow.buyer_id !== me.id) {
      return fail("That request doesn't match this item — send a fresh request from the seller's menu.");
    }
    if (reqRow.status !== "accepted") return fail("That request isn't accepted yet — the seller still has to tap Accept.");
    if (reqRow.order_id) return fail("That request already has an order — pay from My Orders instead.");
  }
  if (paymentMethod === "stripe" && !seller.connect_account_id) {
    return fail("This seller hasn't linked their bank yet, so checkout can't run — the sale waits until they do (one-time setup in Payouts). Nothing was charged.");
  }
  const now = nowMs();
  let order;
  try {
    order = await insertMenuOrder(db, item, me.id, paymentMethod);
  } catch (e) {
    if (String((e && e.message) || e) === "MENU_NOT_SETUP") return fail(CREATOR_NOT_SETUP_MSG);
    throw e;
  }
  const orderId = order.orderId;
  if (reqRow) {
    await db.prepare("UPDATE creator_requests SET order_id = ?, updated_at = ? WHERE id = ?").bind(orderId, now, reqRow.id).run();
  }
  const fee = platformFeeCents(item.price_cents);
  if (paymentMethod === "manual") {
    // No Stripe session: the buyer pays outside the site, and the
    // seller marks it paid when the money lands. Tell the seller now
    // so they know to watch for it.
    await notifyBuyerSeller(db, seller, me, "order",
      "📩 @" + me.username + " placed a manual order for your \"" + item.title + "\" (" + money(item.price_cents) + ") — they pay you outside the site. Mark it paid in the transactions queue once the money lands, and their copy unlocks.",
      "#/orders", "order", orderId);
    return json({
      ok: true, error: null, order_id: orderId, checkout_url: null,
      payment_method: "manual", amount_cents: item.price_cents,
      fee_cents: fee, seller_gets_cents: item.price_cents - fee,
      message: "Manual order recorded — pay the seller outside the site (Cash App / PayPal / Venmo). The light stays red until the seller marks it paid, and the content stays locked until then.",
    });
  }
  const checkout = await startMenuCheckout(env, db, request, { orderId }, item, seller);
  if (checkout.error) {
    // The order stays pending_payment — the buyer can retry from
    // My Orders, and the seller sees it as unpaid, never as sold.
    return json({ ok: false, error: checkout.error, order_id: orderId, checkout_url: null });
  }
  return json({
    ok: true, error: null, order_id: orderId, checkout_url: checkout.url,
    payment_method: "stripe", amount_cents: item.price_cents,
    fee_cents: fee, seller_gets_cents: item.price_cents - fee,
  });
}
