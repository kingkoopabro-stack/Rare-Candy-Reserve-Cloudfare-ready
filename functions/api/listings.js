// GET /api/listings — listListings (kind / category; active only).
// POST /api/listings — createListing (sale / trade / flea, up to 3 photos;
// listing_type physical / digital / dropship; adult listings need
// age_verified, sale only).
// Requires a payout method on the seller profile. Blocks the banned-term
// list. Trade listings need a photo + a completed AI check; a
// likely-fake/proxy check blocks trades AND card listings of any kind.
import {
  json, noDb, getDb, readJson, profileByDevice, shapeListing,
  LISTING_CATEGORIES, sanitizeListingHtml, bannedCheck, putImage, nowMs,
  awardLucre, LUCRE_AWARDS,
} from "./_lib.js";

const CARD_CATEGORIES = ["Pokemon Cards", "Sports Cards", "Other TCG", "Graded Slabs"];

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const kind = q.get("kind") || null;
  const category = q.get("category") || null;
  const profileId = q.get("profile_id") ? Number(q.get("profile_id")) : null;
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "60", 10) || 60, 1), 100);
  // Adult listings stay hidden unless the caller is age-verified —
  // same gate as the 18+ forum (posts.js). Anonymous callers see
  // no adult listings at all, including on a member's shop page.
  const caller = q.get("device_id") ? await profileByDevice(db, String(q.get("device_id"))) : null;
  const callerVerified = !!caller && caller.age_verified === 1;
  const { results } = await db.prepare(
    `SELECT l.*, s.id AS seller_id, s.username AS seller_username, s.occupation AS seller_occupation,
            s.avatar_blob_key AS seller_avatar, s.payout_method AS seller_payout_method, s.payout_handle AS seller_payout_handle
     FROM listings l JOIN profiles s ON s.id = l.profile_id ORDER BY l.id DESC LIMIT 200`,
  ).all();
  const out = [];
  for (const r of (results || [])) {
    if (r.status !== "active") continue;
    if (r.is_adult === 1 && !callerVerified) continue;
    if (kind && r.kind !== kind) continue;
    if (category && r.category !== category) continue;
    if (profileId && r.profile_id !== profileId) continue;
    out.push(await shapeListing(db, r, {
      id: r.seller_id, username: r.seller_username, occupation: r.seller_occupation,
      avatar_blob_key: r.seller_avatar, payout_method: r.seller_payout_method, payout_handle: r.seller_payout_handle,
    }));
    if (out.length >= limit) break;
  }
  return json({ listings: out });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, listing_id: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first — selling needs a storefront.");
  if (!me.payout_method || !me.payout_handle) return fail("Add a payout method in your profile first (e.g. Chime, PayPal, Cash App) so buyers know how you'd get paid. Payments happen between buyer and seller — this app does not hold money.");
  if (!["sale", "trade", "flea"].includes(a.kind)) return fail("Pick sale, trade, or flea.");
  if (!LISTING_CATEGORIES.includes(a.category)) return fail("Pick a category for the listing.");
  const title = String(a.title || "").trim();
  if (title.length < 3 || title.length > 120) return fail("Title needs 3–120 characters.");
  const description = sanitizeListingHtml(String(a.description || "").trim());
  if (description.length < 1 || String(a.description || "").trim().length > 6000) return fail("Description needs 1–6000 characters.");
  const priceCents = Math.round(Number(a.price_cents) || 0);
  if (priceCents < 0 || priceCents > 100000000) return fail("Price has to be between $0 and $1,000,000.");
  const banned = bannedCheck(`${title} ${description}`);
  if (banned) return fail(`That listing mentions "${banned}", which is not allowed here. No firearms, ammunition, or illegal items — ever.`);
  // Member shops — listing type: physical (ships), digital (the photos
  // ARE the product — watermarked + CS#-logged on sale), or dropship
  // (seller ships from their supplier; no supplier integration — the
  // seller fulfils and states the handling time).
  const listingType = ["physical", "digital", "dropship"].includes(a.listing_type) ? a.listing_type : "physical";
  const isAdult = a.is_adult === true || a.is_adult === 1;
  if (isAdult) {
    // Same gate as adult posts (posts.js): operator-reviewed photo ID
    // only — a typed birthday alone is never enough. Adult listings
    // are sale listings only (no adult trades or auctions).
    if (me.age_verified !== 1) return fail("Adult listings need age verification first — verify your age with a photo ID (Rules & After Dark). A typed birthday alone is never enough.");
    if (a.kind !== "sale") return fail("Adult content lists as a sale listing only — no adult trades or auctions.");
  }
  let shippingCents = Math.round(Number(a.shipping_cents) || 0);
  if (shippingCents < 0 || shippingCents > 999900) return fail("Shipping has to be between $0 and $9,999.");
  if (listingType === "digital") {
    shippingCents = 0; // digital content has no shipping
  } else if (shippingCents <= 0) {
    // Buyer always pays shipping on physical goods — never free shipping.
    return fail("Set a shipping charge — the buyer pays shipping on physical items, never free shipping.");
  }
  let stripeLink = null;
  if (a.stripe_link != null && String(a.stripe_link).trim() !== "") {
    const s = String(a.stripe_link).trim();
    if (!/^https:\/\/[^\s"'<>]+$/.test(s)) return fail("Stripe link must be a valid https:// URL — your own Stripe Payment Link, or leave it blank.");
    stripeLink = s;
  }
  const handlingTime = String(a.handling_time || "").trim().slice(0, 120);
  const photoInputs = [...(a.images || [])];
  if (a.image && photoInputs.length === 0) photoInputs.push(a.image);
  const firstPhoto = photoInputs[0] ?? null;
  if (listingType === "digital" && !firstPhoto) return fail("Digital listings need at least one photo — the photos are the product the buyer gets.");
  const vs = String(a.verification_status || "not_checked");
  if (a.kind === "trade") {
    if (!firstPhoto) return fail("Trades need a clear photo of the actual item — verification before trade is the rule here, so a photo is required.");
    if (!vs || vs === "not_checked") return fail("Run the AI authenticity check on the photo first — trade listings can't go live unverified (not_checked).");
    if (vs === "likely_fake_or_proxy") return fail("The AI check flagged this photo as likely fake or a proxy, so it can't be offered for trade. If you think that's wrong, post it in Card Check first and let the community vote, then try again with their verdict in the description.");
    if (vs === "needs_clearer_photo") return fail("The AI check couldn't judge that photo — retake it clearer (front, straight-on, good light) and run the check again before listing for trade.");
  }
  if (CARD_CATEGORIES.includes(a.category) && vs === "likely_fake_or_proxy") {
    return fail("The AI check flagged this photo as likely fake or a proxy, so it can't be listed for sale or auction either. Post it in Card Check for a community verdict first.");
  }
  if (a.kind !== "trade" && priceCents <= 0) return fail("Set a starting price above $0.");
  const photoKeys = [null, null, null];
  for (let i = 0; i < photoInputs.length && i < 3; i++) {
    const up = await putImage(env, "listing-images", String(a.device_id), photoInputs[i], 2500000);
    if (!up.ok) return fail(up.error);
    photoKeys[i] = up.key;
  }
  const now = nowMs();
  const insertVals = [me.id, a.kind, a.category, title, description, priceCents,
    String(a.trade_wanted || "").trim().slice(0, 500), a.allow_comments === false ? 0 : 1,
    photoKeys[0], photoKeys[1], photoKeys[2],
    a.gif_url ? String(a.gif_url).slice(0, 500) : null,
    vs.slice(0, 40), String(a.verification_summary || "").slice(0, 800), "active", now, now,
    listingType, shippingCents, isAdult ? 1 : 0, stripeLink, handlingTime];
  let r;
  try {
    r = await db.prepare(
      `INSERT INTO listings (profile_id, kind, category, title, description, price_cents, trade_wanted, allow_comments,
         image_blob_key, image2_blob_key, image3_blob_key, gif_url, verification_status, verification_summary, status, created_at, updated_at,
         listing_type, shipping_cents, is_adult, stripe_link, handling_time)
       VALUES (${insertVals.map(() => "?").join(", ")})`,
    ).bind(...insertVals).run();
  } catch (e) {
    if (!/no such column|no column named/i.test(String((e && e.message) || e))) throw e;
    // The member-shops migration hasn't run yet. Saving without the
    // new columns would silently lose the type/shipping/adult/Stripe/
    // handling — and an adult listing saved unflagged would show to
    // everyone. So when any of them is set, fail plainly instead of
    // saving a wrong listing; a plain physical listing saves as before.
    if (isAdult || listingType !== "physical" || shippingCents > 0 || stripeLink || handlingTime) {
      return fail("The shop is still running a quick database update — try listing again in a bit. Nothing saved yet.");
    }
    r = await db.prepare(
      `INSERT INTO listings (profile_id, kind, category, title, description, price_cents, trade_wanted, allow_comments,
         image_blob_key, image2_blob_key, image3_blob_key, gif_url, verification_status, verification_summary, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).bind(me.id, a.kind, a.category, title, description, priceCents,
      String(a.trade_wanted || "").trim().slice(0, 500), a.allow_comments === false ? 0 : 1,
      photoKeys[0], photoKeys[1], photoKeys[2],
      a.gif_url ? String(a.gif_url).slice(0, 500) : null,
      vs.slice(0, 40), String(a.verification_summary || "").slice(0, 800), now, now).run();
  }
  // Lucre (v3.11) — 10 for putting up a listing, once per listing.
  const lw = await awardLucre(db, me.id, LUCRE_AWARDS.listing, "listing", String(r.meta.last_row_id));
  const out = { ok: true, error: null, listing_id: r.meta.last_row_id };
  if (lw.awarded) out.lucre = { awarded: true, balance: lw.balance };
  return json(out);
}
