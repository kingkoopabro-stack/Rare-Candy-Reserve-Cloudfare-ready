// POST /api/listings/:id/buy — buyListing. Records a purchase of a sale
// listing (or a flea listing by its high bidder) as an order in the buyer's
// My Orders, and marks the listing sold. Payment itself is arranged
// directly between buyer and seller — no money moves in this app.
// Digital listings also get a CS# in the content-sales log (same as
// private-chat content sales) so the buyer's copy is watermarked to them.
import { json, noDb, getDb, readJson, profileByDevice, nowMs } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, order_id: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to buy — orders live on your profile.");
  const id = Number(params.id);
  const l = await db.prepare("SELECT * FROM listings WHERE id = ? LIMIT 1").bind(id).first();
  if (!l) return fail("That listing is gone.");
  if (l.status !== "active") return fail("That item already sold.");
  if (l.profile_id === me.id) return fail("You can't buy your own listing.");
  if (l.kind === "trade") return fail("Trade listings aren't bought — leave a comment on the listing to offer your trade.");
  let amount = l.price_cents;
  if (l.kind === "flea") {
    const { results } = await db.prepare("SELECT profile_id, amount_cents FROM bids WHERE listing_id = ?").bind(id).all();
    const lb = results || [];
    const top = lb.length ? Math.max(...lb.map((b) => b.amount_cents)) : null;
    if (top == null || !lb.some((b) => b.profile_id === me.id && b.amount_cents === top)) {
      return fail("Only the high bidder can complete a flea-market purchase.");
    }
    amount = top;
  }
  const listingType = l.listing_type ?? "physical";
  const shipCents = listingType === "digital" ? 0 : Math.round(Number(l.shipping_cents) || 0);
  const now = nowMs();
  let r;
  try {
    r = await db.prepare(
      "INSERT INTO orders (listing_id, buyer_id, seller_id, item_title, amount_cents, shipping_cents, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?)",
    ).bind(id, me.id, l.profile_id, l.title, amount, shipCents, now, now).run();
  } catch (e) {
    // The tax migration hasn't run yet (no shipping_cents on orders) —
    // save without it; the read side defaults shipping to 0.
    if (!/no such column|no column named/i.test(String((e && e.message) || e))) throw e;
    r = await db.prepare(
      "INSERT INTO orders (listing_id, buyer_id, seller_id, item_title, amount_cents, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)",
    ).bind(id, me.id, l.profile_id, l.title, amount, now, now).run();
  }
  await db.prepare("UPDATE listings SET status = 'sold', updated_at = ? WHERE id = ?").bind(now, id).run();
  // CS# for digital listings — same log as private-chat content sales
  // (receipts.js): a sequential number, the buyer IP server-side only,
  // and the watermark line for the buyer's copy. Physical buys stay on
  // the orders table only. If the content-sales table isn't there yet
  // the order still saves and cs_number comes back null.
  let csNumber = null;
  let watermarkText = "";
  if (listingType === "digital") {
    const seller = await db.prepare("SELECT id, username FROM profiles WHERE id = ? LIMIT 1").bind(l.profile_id).first();
    const buyerIp = request.headers.get("cf-connecting-ip") || "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const mx = await db.prepare("SELECT MAX(cs_number) AS m FROM content_sales").first();
        const next = (mx && mx.m ? mx.m : 0) + 1;
        const wm = "RareCandyReserve.org • @" + me.username + " • CS#" + next + " • redistribution of this is punishable by law";
        await db.prepare(
          `INSERT INTO content_sales (cs_number, listing_id, buyer_id, buyer_username, seller_id, seller_username, item_title, amount_cents, buyer_ip, watermark_text, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(next, id, me.id, me.username, l.profile_id, (seller && seller.username) || "", l.title, amount, buyerIp, wm, now).run();
        csNumber = next;
        watermarkText = wm;
        break;
      } catch (e2) {
        const msg2 = String((e2 && e2.message) || e2);
        if (/no such table/i.test(msg2)) { csNumber = null; watermarkText = ""; break; }
        if (/UNIQUE constraint failed/i.test(msg2) && attempt === 0) continue;
        csNumber = null;
        watermarkText = "";
        break;
      }
    }
  }
  return json({ ok: true, error: null, order_id: r.meta.last_row_id, cs_number: csNumber, watermark_text: watermarkText });
}
