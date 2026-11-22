// Content sales log (CS#) — every digital-content sale in a private chat
// gets a sequential sale number (CS#1, CS#2, …) so a leaked copy can be
// traced to the buyer who bought it. Rows are created server-side inside
// POST /api/receipts (the sale confirmation) — never by the client.
// GET /api/content-sales?device_id= — my own purchases (no IP).
// GET /api/content-sales?device_id=&cs=N — operator-only lookup: the full
// row for one sale number, including the buyer IP. The IP is operator
// eyes only — it is never returned to anyone else, and whether it goes
// to the person whose content was shared is the operator's call,
// case by case. If the migration hasn't run yet, both answer a clean
// "not set up yet" instead of crashing.
import { json, noDb, getDb, profileByDevice, isOperator, money, iso } from "./_lib.js";

function notSetup() {
  return json({ ok: false, error: "Content sales aren't set up yet — the shop is still running a quick database update." });
}

function shapeSale(row, full) {
  var s = {
    cs_number: row.cs_number,
    post_id: row.post_id ?? null,
    conversation_id: row.conversation_id ?? null,
    item_title: row.item_title ?? "",
    buyer_username: row.buyer_username ?? "",
    seller_username: row.seller_username ?? "",
    amount_cents: row.amount_cents,
    amount: money(row.amount_cents),
    watermark_text: row.watermark_text ?? "",
    created_at: iso(row.created_at),
  };
  if (full) {
    s.buyer_id = row.buyer_id;
    s.seller_id = row.seller_id;
    s.buyer_ip = row.buyer_ip ?? "";
  }
  return s;
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first.", sales: [] });
  const cs = Number(q.get("cs") || 0);
  try {
    if (cs) {
      if (!isOperator(env, me)) return json({ ok: false, error: "Only the operator can look up a sale by number." });
      const row = await db.prepare("SELECT * FROM content_sales WHERE cs_number = ? LIMIT 1").bind(cs).first();
      if (!row) return json({ ok: false, error: "No sale with that number yet.", sale: null });
      return json({ ok: true, sale: shapeSale(row, true) });
    }
    const { results } = await db.prepare(
      "SELECT * FROM content_sales WHERE buyer_id = ? ORDER BY cs_number DESC LIMIT 100",
    ).bind(me.id).all();
    return json({ sales: (results || []).map((r) => shapeSale(r, false)) });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return notSetup();
    throw e;
  }
}
