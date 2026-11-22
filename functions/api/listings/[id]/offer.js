// POST /api/listings/:id/offer — make a Best Offer on a sale listing.
// GET /api/listings/:id/offer — the offers on a listing (seller sees
// all, a buyer sees only their own).
// An offer is a price, not a payment. The buyer MAY save their card
// with the offer (payment_method_id from a Stripe SetupIntent — the
// card is saved, nothing is charged): if the seller accepts, the saved
// card is charged automatically (see /api/offers/:id/respond). Without
// a saved card, an accepted offer sends the buyer a Checkout link to
// pay — still no charge until the buyer pays. Declined or countered:
// nothing is ever charged. Offers live 3 days, then expire.
import { json, noDb, getDb, readJson, profileByDevice, nowMs, notifyBuyerSeller, money } from "../../_lib.js";
import { stripePlatformConfigured, stripePlatformCall } from "../../_stripe.js";

const OFFER_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first.", offers: [] });
  const id = Number(params.id);
  const l = await db.prepare("SELECT profile_id FROM listings WHERE id = ? LIMIT 1").bind(id).first();
  if (!l) return json({ ok: false, error: "That listing is gone.", offers: [] });
  const isSeller = l.profile_id === me.id;
  let rows = [];
  try {
    const { results } = await db.prepare(
      "SELECT o.*, p.username AS buyer_username FROM listing_offers o JOIN profiles p ON p.id = o.buyer_id WHERE o.listing_id = ? ORDER BY o.created_at DESC, o.id DESC",
    ).bind(id).all();
    rows = results || [];
  } catch { return json({ ok: true, offers: [] }); /* offers table not there yet */ }
  const out = rows
    .filter((o) => isSeller || o.buyer_id === me.id)
    .map((o) => ({
      id: o.id, listing_id: o.listing_id, buyer_id: o.buyer_id, buyer_username: o.buyer_username,
      amount_cents: o.amount_cents, status: o.status, message: o.message ?? "",
      has_saved_card: !!(o.payment_method_id), parent_offer_id: o.parent_offer_id ?? null,
      created_at: o.created_at, expires_at: o.expires_at,
    }));
  return json({ ok: true, offers: out });
}

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, offer_id: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your account first to make an offer.");
  const id = Number(params.id);
  const l = await db.prepare("SELECT * FROM listings WHERE id = ? LIMIT 1").bind(id).first();
  if (!l) return fail("That listing is gone.");
  if (l.status !== "active") return fail("That item already sold.");
  if (l.kind !== "sale") return fail("Offers are for sale listings — trades and auctions work differently.");
  if (l.profile_id === me.id) return fail("You can't offer on your own listing.");
  if ((l.allows_offers ?? 1) === 0) return fail("This seller isn't taking offers — the listed price is the price.");
  const amount = Math.round(Number(a.amount_cents) || 0);
  if (amount <= 0) return fail("Offer an amount above $0.");
  if (amount >= l.price_cents) return fail("That's at or above the listed price — just buy it at the listed price instead.");
  // One open offer per buyer per listing — a new offer replaces the old one.
  const now = nowMs();
  const paymentMethodId = String(a.payment_method_id || "").trim();
  let customerId = me.stripe_customer_id || null;
  if (paymentMethodId) {
    // Attach the saved card to the buyer's Stripe Customer so an
    // accepted offer can charge it off-session. Without a platform key
    // the card can't be saved — the offer still goes in, cardless, and
    // an acceptance sends a Checkout link instead.
    if (stripePlatformConfigured(env)) {
      if (!customerId) {
        const c = await stripePlatformCall(env, "POST", "/customers", { email: me.contact_email || undefined, "metadata[profile_id]": String(me.id) }, "rcr-customer-" + me.id);
        if (c.ok && c.data && c.data.id) {
          customerId = c.data.id;
          try { await db.prepare("UPDATE profiles SET stripe_customer_id = ? WHERE id = ?").bind(customerId, me.id).run(); } catch { /* column not there yet */ }
        }
      }
      if (customerId) {
        const attach = await stripePlatformCall(env, "POST", "/payment_methods/" + encodeURIComponent(paymentMethodId) + "/attach", { customer: customerId }, null);
        if (!attach.ok) return fail("That card couldn't be saved (" + attach.error + ") — try again, or offer without a saved card and pay by Checkout if it's accepted.");
      }
    }
  }
  let r;
  try {
    // A fresh offer supersedes the buyer's earlier open one on this listing.
    await db.prepare("UPDATE listing_offers SET status = 'superseded', updated_at = ? WHERE listing_id = ? AND buyer_id = ? AND status = 'open'").bind(now, id, me.id).run();
    r = await db.prepare(
      "INSERT INTO listing_offers (listing_id, buyer_id, seller_id, amount_cents, status, payment_method_id, message, parent_offer_id, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)",
    ).bind(id, me.id, l.profile_id, amount, paymentMethodId, String(a.message || "").trim().slice(0, 500), null, now, now, now + OFFER_TTL_MS).run();
  } catch (e) {
    if (/no such table|no such column/i.test(String((e && e.message) || e))) return fail("Offers aren't switched on yet — the shop is still running a quick database update. Try again in a bit.");
    throw e;
  }
  const sellerProfile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(l.profile_id).first();
  await notifyBuyerSeller(db, sellerProfile, me, "offer",
    "🤝 @" + me.username + " offered " + money(amount) + " for your \"" + l.title + "\" (listed at " + money(l.price_cents) + "). It lasts 3 days — accept, decline, or counter from the listing." + (paymentMethodId ? " Their card is saved, so accepting charges it automatically." : ""),
    "#/listing/" + id, "offer", r.meta.last_row_id);
  return json({ ok: true, error: null, offer_id: r.meta.last_row_id, has_saved_card: !!paymentMethodId, expires_at: now + OFFER_TTL_MS });
}
