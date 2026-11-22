// GET /api/orders/:id/tracking?device_id= — the tracking view both
// sides can follow: carrier, tracking number, carrier link, and a
// timeline built from the order's own record (placed → paid → shipped
// → delivered → confirmed). Live carrier status still lives on the
// carrier's page — tap "Track with carrier". A live carrier API
// (USPS/UPS/FedEx) is the follow-up; it needs a carrier account and
// is not wired yet.
import { json, noDb, getDb, profileByDevice, iso, money, trackingUrl } from "../../_lib.js";

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first." });
  const id = Number(params.id);
  const o = await db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1").bind(id).first();
  if (!o) return json({ ok: false, error: "That order is gone." });
  if (o.buyer_id !== me.id && o.seller_id !== me.id) return json({ ok: false, error: "That's not your order." });
  const buyer = await db.prepare("SELECT username FROM profiles WHERE id = ? LIMIT 1").bind(o.buyer_id).first();
  const seller = await db.prepare("SELECT username FROM profiles WHERE id = ? LIMIT 1").bind(o.seller_id).first();
  const timeline = [
    { label: "Order placed", at: iso(o.created_at), done: true },
    { label: "Payment captured", at: o.status === "pending_payment" ? null : iso(o.created_at), done: o.status !== "pending_payment", note: o.status === "pending_payment" ? "Waiting on the card payment — the buyer pays by card at checkout." : null },
    { label: "Shipped" + (o.carrier ? " — " + o.carrier : ""), at: (o.status === "shipped" || o.status === "delivered") ? iso(o.updated_at) : null, done: o.status === "shipped" || o.status === "delivered" },
    { label: "Delivered", at: o.status === "delivered" ? iso(o.updated_at) : null, done: o.status === "delivered" },
    { label: "Buyer confirmed receipt", at: iso(o.buyer_confirmed_at ?? null), done: !!o.buyer_confirmed_at },
  ];
  return json({
    ok: true,
    order: {
      id: o.id, item_title: o.item_title, status: o.status,
      amount_cents: o.amount_cents, shipping_cents: o.shipping_cents ?? 0,
      amount: money(o.amount_cents), shipping: money(o.shipping_cents ?? 0),
      carrier: o.carrier ?? "", tracking_number: o.tracking_number ?? "",
      tracking_url: trackingUrl(o.carrier, o.tracking_number),
      buyer_username: (buyer && buyer.username) || "member",
      seller_username: (seller && seller.username) || "member",
      created_at: iso(o.created_at), updated_at: iso(o.updated_at),
      buyer_confirmed_at: iso(o.buyer_confirmed_at ?? null),
      timeline,
    },
  });
}
