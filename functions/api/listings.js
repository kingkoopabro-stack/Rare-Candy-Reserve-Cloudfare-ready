// GET /api/listings — listListings (kind / category; active only).
// POST /api/listings — createListing (sale / trade / flea, up to 3 photos).
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
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "60", 10) || 60, 1), 100);
  const { results } = await db.prepare(
    `SELECT l.*, s.id AS seller_id, s.username AS seller_username, s.occupation AS seller_occupation,
            s.avatar_blob_key AS seller_avatar, s.payout_method AS seller_payout_method, s.payout_handle AS seller_payout_handle
     FROM listings l JOIN profiles s ON s.id = l.profile_id ORDER BY l.id DESC LIMIT 200`,
  ).all();
  const out = [];
  for (const r of (results || [])) {
    if (r.status !== "active") continue;
    if (kind && r.kind !== kind) continue;
    if (category && r.category !== category) continue;
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
  const photoInputs = [...(a.images || [])];
  if (a.image && photoInputs.length === 0) photoInputs.push(a.image);
  const firstPhoto = photoInputs[0] ?? null;
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
  const r = await db.prepare(
    `INSERT INTO listings (profile_id, kind, category, title, description, price_cents, trade_wanted, allow_comments,
       image_blob_key, image2_blob_key, image3_blob_key, gif_url, verification_status, verification_summary, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).bind(me.id, a.kind, a.category, title, description, priceCents,
    String(a.trade_wanted || "").trim().slice(0, 500), a.allow_comments === false ? 0 : 1,
    photoKeys[0], photoKeys[1], photoKeys[2],
    a.gif_url ? String(a.gif_url).slice(0, 500) : null,
    vs.slice(0, 40), String(a.verification_summary || "").slice(0, 800), now, now).run();
  // Lucre (v3.11) — 10 for putting up a listing, once per listing.
  const lw = await awardLucre(db, me.id, LUCRE_AWARDS.listing, "listing", String(r.meta.last_row_id));
  const out = { ok: true, error: null, listing_id: r.meta.last_row_id };
  if (lw.awarded) out.lucre = { awarded: true, balance: lw.balance };
  return json(out);
}
