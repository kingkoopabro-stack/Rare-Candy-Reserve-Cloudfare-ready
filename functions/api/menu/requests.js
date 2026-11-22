// GET /api/menu/requests — my creator requests, as buyer or seller.
// ?device_id=&as=buyer|seller — omit `as` to get both lists.
// Durable rows (DMs auto-delete in 24h); the DM card is only the
// surface where they are seen and answered.
import { json, noDb, getDb, profileByDevice, profilesMap, iso, money } from "../_lib.js";
import { CREATOR_NOT_SETUP_MSG } from "../_creator.js";

function shapeRequest(row, names) {
  return {
    id: row.id, menu_item_id: row.menu_item_id,
    buyer_id: row.buyer_id, buyer_username: names.get(row.buyer_id) ?? "member",
    seller_id: row.seller_id, seller_username: names.get(row.seller_id) ?? "member",
    kind: row.kind ?? "custom",
    amount_cents: row.amount_cents ?? 0, amount: money(row.amount_cents ?? 0),
    status: row.status ?? "requested",
    auto_accepted: row.auto_accepted === 1,
    order_id: row.order_id ?? null,
    payment_method: row.payment_method ?? "stripe",
    package_id: row.package_id ?? null,
    created_at: iso(row.created_at), updated_at: iso(row.updated_at),
  };
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first.", requests: [] });
  const as = q.get("as") || "";
  if (as && as !== "buyer" && as !== "seller") return json({ ok: false, error: "Ask for as=buyer or as=seller.", requests: [] });
  let rows;
  try {
    if (as === "buyer") {
      ({ results: rows } = await db.prepare("SELECT * FROM creator_requests WHERE buyer_id = ? ORDER BY updated_at DESC LIMIT 100").bind(me.id).all());
    } else if (as === "seller") {
      ({ results: rows } = await db.prepare("SELECT * FROM creator_requests WHERE seller_id = ? ORDER BY updated_at DESC LIMIT 100").bind(me.id).all());
    } else {
      ({ results: rows } = await db.prepare("SELECT * FROM creator_requests WHERE buyer_id = ? OR seller_id = ? ORDER BY updated_at DESC LIMIT 100").bind(me.id, me.id).all());
    }
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG, requests: [] });
    throw e;
  }
  const names = await profilesMap(db);
  const list = (rows || []).map((r) => shapeRequest(r, names));
  if (as) return json({ ok: true, as, requests: list });
  return json({
    ok: true,
    requests: list,
    as_buyer: list.filter((r) => r.buyer_id === me.id),
    as_seller: list.filter((r) => r.seller_id === me.id),
  });
}
