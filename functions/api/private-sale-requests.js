// POST /api/private-sale-requests — send a BUY request to another
// member from a DM: "I want to buy X for $Y."
//
// Durable row, NOT just a chat message: DMs auto-delete after a day,
// and a request has to outlive the thread (it lasts 3 days, like a
// Flea Market offer). The seller accepts or declines from the DM.
// Accepting does NOT charge anyone — it just opens the seller's sale
// setup (the normal private-sale form, where physical/digital +
// shipping are picked and the bank gate runs, same as any private
// sale). The buyer pays on Stripe Checkout only after the seller
// lists it. The DM the seller gets carries the request id in its
// text ("Buy request #N: ...") so the chat can render Accept/Decline
// on it; the exact body format is the contract with renderIMLog —
// change it there too if it ever changes.
import { json, noDb, getDb, readJson, profileByDevice, nowMs, bannedCheck, sendDM, createNotification, money } from "./_lib.js";

const REQ_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function notSetup() {
  return json({ ok: false, error: "Buy requests aren't switched on yet — the shop is still running a quick database update. Try again in a bit." });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first to send a buy request." });
  const sellerId = Number(a.seller_id || 0);
  if (!sellerId || sellerId === me.id) return json({ ok: false, error: "Pick someone else to buy from." });
  const title = String(a.title || "").trim().replace(/\s+/g, " ");
  if (title.length < 3 || title.length > 120) return json({ ok: false, error: "Say what you want to buy (3–120 characters)." });
  if (bannedCheck(title)) return json({ ok: false, error: "That item mentions something that isn't allowed here." });
  const priceCents = Math.round(Number(a.price_cents) || 0);
  if (priceCents <= 0 || priceCents > 100000000) return json({ ok: false, error: "Offer an amount above $0." });
  const seller = await db.prepare("SELECT id, username FROM profiles WHERE id = ? LIMIT 1").bind(sellerId).first();
  if (!seller) return json({ ok: false, error: "That member doesn't exist." });
  let sourceListingId = null;
  if (a.source_listing_id != null) {
    const sl = await db.prepare("SELECT * FROM listings WHERE id = ? LIMIT 1").bind(Number(a.source_listing_id)).first();
    if (!sl) return json({ ok: false, error: "The listing this request started from is gone — type the item in manually instead." });
    if (sl.profile_id !== sellerId) return json({ ok: false, error: "That listing isn't theirs." });
    if (sl.status !== "active") return json({ ok: false, error: "That listing already sold — type the item in manually instead." });
    if (sl.is_private === 1) return json({ ok: false, error: "That listing is already a private sale." });
    sourceListingId = sl.id;
  }
  const now = nowMs();
  let r;
  try {
    r = await db.prepare(
      "INSERT INTO private_sale_requests (buyer_id, seller_id, title, price_cents, status, source_listing_id, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)",
    ).bind(me.id, sellerId, title, priceCents, sourceListingId, now, now, now + REQ_TTL_MS).run();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return notSetup();
    throw e;
  }
  const reqId = r.meta.last_row_id;
  const cleanTitle = title.replace(/"/g, "'");
  // Tell the seller two ways: the in-app notification + the DM itself
  // (the DM is what the seller actually reads in the chat window).
  await createNotification(db, {
    profile_id: sellerId, actor_profile_id: me.id, kind: "buy_request", ref_type: "private_sale_request",
    ref_id: reqId, text: `🛒 Buy request: @${me.username} wants "${cleanTitle}" — ${money(priceCents)}.`,
    link: "/community.html#/chat",
  });
  await sendDM(db, me, sellerId, `🛒 Buy request #${reqId}: I want to buy "${cleanTitle}" — offering ${money(priceCents)}. Tap "Accept — set up the sale" below if you're selling it.`);
  return json({ ok: true, error: null, request_id: reqId });
}
