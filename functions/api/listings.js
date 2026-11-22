// GET /api/listings — listListings (kind / category; active only).
// POST /api/listings — createListing (sale / trade / flea, up to 3 photos;
// listing_type physical / digital / dropship; adult listings need
// age_verified, sale only).
// Requires a payout method on the seller profile. Blocks the banned-term
// list. Trade listings need a photo + a completed AI check; a
// likely-fake/proxy check blocks trades AND card listings of any kind.
import {
  json, noDb, getDb, readJson, profileByDevice, shapeListing,
  LISTING_CATEGORIES, sanitizeListingHtml, bannedCheck, putImage, putVideo, nowMs,
  awardLucre, LUCRE_AWARDS, isOperator,
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
            s.avatar_blob_key AS seller_avatar, s.payout_method AS seller_payout_method, s.payout_handle AS seller_payout_handle,
            s.connect_onboarded AS seller_connect_onboarded
     FROM listings l JOIN profiles s ON s.id = l.profile_id ORDER BY l.id DESC LIMIT 200`,
  ).all();
  const out = [];
  for (const r of (results || [])) {
    if (r.status !== "active") continue;
    // Private sales are invisible to everyone except the seller, the
    // one buyer, and the operator (who sees every sale).
    if (r.is_private === 1 && !(caller && (caller.id === r.profile_id || caller.id === r.private_buyer_id || isOperator(env, caller)))) continue;
    if (r.is_adult === 1 && !callerVerified) continue;
    if (kind && r.kind !== kind) continue;
    if (category && r.category !== category) continue;
    if (profileId && r.profile_id !== profileId) continue;
    out.push(await shapeListing(db, r, {
      id: r.seller_id, username: r.seller_username, occupation: r.seller_occupation,
      avatar_blob_key: r.seller_avatar, payout_method: r.seller_payout_method, payout_handle: r.seller_payout_handle,
      connect_onboarded: r.seller_connect_onboarded,
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
  if (!["sale", "trade", "flea"].includes(a.kind)) return fail("Pick sale, trade, or flea.");
  // Flea Market money path: a sale or auction listing can only take
  // payments through Stripe Checkout, and Checkout can only pay a
  // seller whose bank is linked (Connect). No bank link, no listing —
  // otherwise a buyer could pay and the money would have nowhere
  // automatic to go. Trades involve no money, so they skip this gate.
  // (If you just linked your bank and it still says this, the shop is
  // still running a quick database update — try again in a bit.)
  if (a.kind !== "trade" && (!me.connect_account_id || me.connect_onboarded !== 1)) {
    return fail("Link your bank first — one-time setup in Payouts (Stripe Connect). Buyers pay by card at checkout and the money lands in your bank automatically; until your bank is linked, listings can't take payments.");
  }
  if (!LISTING_CATEGORIES.includes(a.category)) return fail("Pick a category for the listing.");
  // Private sales (DMs) — same Stripe system as the Flea Market, one
  // buyer only. source_listing_id = AUTO-ATTACH (the primary path): the
  // sale started from a listing, so the title, price, description, and
  // photos carry over exactly — no retyping, no mistyped price, the
  // Stripe product is right. Manual entry (title + price typed in) is
  // the fallback when no listing is attached. Before payment the seller
  // must pick PHYSICAL or DIGITAL — that choice drives Stripe
  // (physical: item + shipping + tax; digital: no shipping, no sales
  // tax, "Digital Asset" label + CS# + watermarked copy).
  let privateBuyerId = null;
  let isPrivate = false;
  let sourceListing = null;
  if (a.private_buyer_id != null) {
    isPrivate = true;
    privateBuyerId = Number(a.private_buyer_id);
    if (!privateBuyerId || privateBuyerId === me.id) return fail("A private sale needs a real buyer — someone other than you.");
    const pb = await db.prepare("SELECT id FROM profiles WHERE id = ? LIMIT 1").bind(privateBuyerId).first();
    if (!pb) return fail("That buyer doesn't exist.");
    if (a.kind !== "sale") return fail("Private sales are sale listings — trades and auctions stay public.");
    if (a.source_listing_id != null) {
      sourceListing = await db.prepare("SELECT * FROM listings WHERE id = ? LIMIT 1").bind(Number(a.source_listing_id)).first();
      if (!sourceListing) return fail("The listing this sale started from is gone — type the item in manually instead.");
      if (sourceListing.profile_id !== me.id) return fail("You can only attach your own listing to a private sale.");
      if (sourceListing.status !== "active") return fail("That listing already sold — type the item in manually instead.");
      if (sourceListing.is_private === 1) return fail("That listing is already a private sale — start from a public listing instead.");
    }
  }
  const title = sourceListing ? sourceListing.title : String(a.title || "").trim();
  if (title.length < 3 || title.length > 120) return fail("Title needs 3–120 characters.");
  const rawDescription = sourceListing ? sourceListing.description : String(a.description || "").trim();
  const description = sanitizeListingHtml(rawDescription);
  if (description.length < 1 || rawDescription.length > 6000) return fail("Description needs 1–6000 characters.");
  const priceCents = sourceListing ? sourceListing.price_cents : Math.round(Number(a.price_cents) || 0);
  if (priceCents < 0 || priceCents > 100000000) return fail("Price has to be between $0 and $1,000,000.");
  const banned = bannedCheck(`${title} ${description}`);
  if (banned) return fail(`That listing mentions "${banned}", which is not allowed here. No firearms, ammunition, or illegal items — ever.`);
  // Member shops — listing type: physical (ships), digital (the photos
  // ARE the product — watermarked + CS#-logged on sale), or dropship
  // (seller ships from their supplier; no supplier integration — the
  // seller fulfils and states the handling time).
  const listingType = ["physical", "digital", "dropship"].includes(a.listing_type) ? a.listing_type : "physical";
  if (isPrivate && listingType === "dropship") return fail("Private sales are physical or digital only — pick one before payment.");
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
  // The seller's own Stripe Payment Link is retired for member
  // listings: Flea Market buys run through platform Checkout now (the
  // money lands in the seller's linked bank automatically, minus the
  // 6% cut). A hand-pasted link would bypass the cut and the automatic
  // payout, so incoming stripe_link values are ignored. The operator's
  // own catalog (shop-listings.js) is untouched.
  const stripeLink = null;
  const handlingTime = String(a.handling_time || "").trim().slice(0, 120);
  // Best Offer: sale listings take offers unless the seller opts out.
  const allowsOffers = a.kind === "sale" && a.allows_offers !== false && a.allows_offers !== 0 ? 1 : 0;
  const allowsOffersOptOut = a.kind === "sale" && (a.allows_offers === false || a.allows_offers === 0);
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
  // Auto-attach: no fresh photos on the form means the source listing's
  // photos carry over (same R2 objects — no bytes copied).
  if (sourceListing && photoInputs.length === 0) {
    photoKeys[0] = sourceListing.image_blob_key ?? null;
    photoKeys[1] = sourceListing.image2_blob_key ?? null;
    photoKeys[2] = sourceListing.image3_blob_key ?? null;
  }
  // One short video clip: max 30 seconds (checked in the browser before
  // upload) and 15 MB (checked here) — enough to show the item moving,
  // light enough not to eat data. Stored in the same IMAGES R2 bucket
  // under "listing-videos/" — no new bucket.
  let videoClipKey = null;
  if (a.video_clip) {
    const vup = await putVideo(env, "listing-videos", String(a.device_id), a.video_clip, 15000000);
    if (!vup.ok) return fail(vup.error);
    videoClipKey = vup.key;
  }
  const now = nowMs();
  const insertVals = [me.id, a.kind, a.category, title, description, priceCents,
    String(a.trade_wanted || "").trim().slice(0, 500), a.allow_comments === false ? 0 : 1,
    photoKeys[0], photoKeys[1], photoKeys[2],
    a.gif_url ? String(a.gif_url).slice(0, 500) : null,
    vs.slice(0, 40), String(a.verification_summary || "").slice(0, 800), "active", now, now,
    listingType, shippingCents, isAdult ? 1 : 0, stripeLink, handlingTime, allowsOffers, videoClipKey, isPrivate ? 1 : 0, privateBuyerId];
  let r;
  try {
    r = await db.prepare(
      `INSERT INTO listings (profile_id, kind, category, title, description, price_cents, trade_wanted, allow_comments,
         image_blob_key, image2_blob_key, image3_blob_key, gif_url, verification_status, verification_summary, status, created_at, updated_at,
         listing_type, shipping_cents, is_adult, stripe_link, handling_time, allows_offers, video_clip_key, is_private, private_buyer_id)
       VALUES (${insertVals.map(() => "?").join(", ")})`,
    ).bind(...insertVals).run();
  } catch (e) {
    if (!/no such column|no column named/i.test(String((e && e.message) || e))) throw e;
    // The member-shops migration hasn't run yet. Saving without the
    // new columns would silently lose the type/shipping/adult/Stripe/
    // handling — and an adult listing saved unflagged would show to
    // everyone. So when any of them is set, fail plainly instead of
    // saving a wrong listing; a plain physical listing saves as before.
    // A private listing MUST fail here — saved without is_private it
    // would show publicly to everyone.
    if (isAdult || listingType !== "physical" || shippingCents > 0 || stripeLink || handlingTime || allowsOffersOptOut || videoClipKey || isPrivate) {
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
