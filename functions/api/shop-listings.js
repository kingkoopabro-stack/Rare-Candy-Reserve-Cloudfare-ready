// Shop listing overrides (listing editor) — GET /api/shop-listings
// (public: all override rows) and POST /api/shop-listings (operator
// only: create/replace one override).
// The overrides layer over the hardcoded PRODUCTS/CATALOG in site.js:
// same id → name/price/description/photos/options/video/stripe link
// replaced; unknown id → a brand-new listing. The table holds edits
// only, so an empty or missing table changes nothing on the shop —
// GET answers { listings: [] } instead of crashing when the migration
// hasn't run yet.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, nowMs } from "./_lib.js";

const ID_RE = /^[a-z0-9-]{3,60}$/;
// Photos/video: absolute https:// links, or the site's own R2 URLs
// (/api/images?key=...) returned by the upload endpoint.
const URL_RE = /^(https:\/\/[^\s"'<>]+|\/api\/images\?key=[^\s"'<>]+)$/;
const ABSOLUTE_URL_RE = /^https:\/\/[^\s"'<>]+$/;

function parseJsonArray(stored) {
  if (!stored) return [];
  try {
    const v = JSON.parse(stored);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function shapeOverride(row) {
  return {
    id: row.id, name: row.name, price: row.price, description: row.description ?? "",
    photos: parseJsonArray(row.photos), options: parseJsonArray(row.options),
    video: row.video || null, stripe_link: row.stripe_link || null,
    shipping: (typeof row.shipping === "number" ? row.shipping : null),
    // Sold flag (listing-sold-flag migration). Null when the column
    // hasn't been added yet — the shop then leaves the hardcoded
    // outOfStock value alone instead of wrongly clearing it.
    out_of_stock: (typeof row.out_of_stock === "number" ? row.out_of_stock : null),
    updated_at: row.updated_at,
  };
}

// True when the shop_listing_overrides table has the out_of_stock
// column (listing-sold-flag migration). The editor code goes live
// before Chris runs the migration, so the save must not break over a
// missing column — it just saves without the sold flag and says so.
async function hasOutOfStockColumn(db) {
  try {
    const r = await db.prepare("PRAGMA table_info(shop_listing_overrides)").all();
    return (r.results || []).some((c) => c && c.name === "out_of_stock");
  } catch { return false; }
}

// Clean an options array from the editor into the stored shape:
// [{label, options:[{label, price_delta}]}]. Max 4 groups, max 12
// options per group. Bad groups/options are dropped, never stored.
export function cleanOptions(input) {
  const out = [];
  if (!Array.isArray(input)) return out;
  for (const g of input) {
    if (out.length >= 4) break;
    if (!g || typeof g !== "object") continue;
    const label = String(g.label || "").trim().slice(0, 40);
    if (!label) continue;
    const opts = [];
    for (const o of (Array.isArray(g.options) ? g.options : [])) {
      if (opts.length >= 12) break;
      if (!o || typeof o !== "object") continue;
      const ol = String(o.label || "").trim().slice(0, 60);
      if (!ol) continue;
      let delta = Number(o.price_delta);
      if (!Number.isFinite(delta)) delta = 0;
      delta = Math.round(delta * 100) / 100;
      opts.push({ label: ol, price_delta: delta });
    }
    if (!opts.length) continue;
    out.push({ label, options: opts });
  }
  return out;
}

function cleanPhotos(input) {
  const out = [];
  if (!Array.isArray(input)) return out;
  for (const u of input) {
    if (out.length >= 4) break;
    const s = String(u || "").trim();
    if (URL_RE.test(s)) out.push(s);
  }
  return out;
}

// --- Stripe auto checkout links (v3.19) ---------------------------------
// When a listing is saved with no Stripe link, the server makes one
// itself: a Stripe Price for the base price + a Payment Link, and stores
// the buy.stripe.com URL in stripe_link. The secret key lives ONLY in
// the Cloudflare Pages env var STRIPE_SECRET_KEY — never in code.
// A Payment Link's price can never change, so when the price changes on
// an auto-made link the old link is deactivated and a new one is made.
// A link the operator pasted by hand is NEVER overwritten or deactivated:
// auto-made links carry metadata auto=1 on the Payment Link, and only
// those are ever regenerated. Every Stripe call is a single attempt —
// never retried (a retry could double-create, and a restricted account
// must fail plainly, once). The listing save NEVER fails because Stripe
// is unavailable: Stripe work happens after the upsert, and any Stripe
// problem is reported in stripe_status / stripe_message while the save
// stands.
const STRIPE_MIN_CENTS = 50; // Stripe's minimum for a USD payment link
const STRIPE_API = "https://api.stripe.com/v1";

function fmtMoneyCents(cents) { return "$" + (cents / 100).toFixed(2); }

// One Stripe API call. Returns { ok, data } or { ok: false, error } with
// Stripe's own message, plain. Single attempt, 15s timeout, no retries.
async function stripeCall(env, method, path, params, idemKey) {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, error: "Stripe isn't connected yet." };
  let res;
  try {
    const headers = { authorization: "Bearer " + key, "content-type": "application/x-www-form-urlencoded" };
    if (idemKey) headers["idempotency-key"] = idemKey;
    const init = { method, headers, signal: AbortSignal.timeout(15000) };
    if (params) init.body = new URLSearchParams(params);
    res = await fetch(STRIPE_API + path, init);
  } catch (e) {
    return { ok: false, error: "Couldn't reach Stripe — the listing still saved." };
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || ("Stripe returned an error (" + res.status + ").");
    return { ok: false, error: msg };
  }
  return { ok: true, data };
}

// Stripe Tax is OFF until Chris turns it on in the Stripe Dashboard
// (Tax settings + a Florida registration) AND sets STRIPE_TAX_ENABLED=1
// in Cloudflare. Until then every link is made exactly as before —
// no tax, no address collection, no behavior change while he is
// adding links live in the editor.
function taxEnabled(env) { return String(env.STRIPE_TAX_ENABLED || "") === "1"; }

// Create a Price for the base price, then a Payment Link for it.
// shippingCents (0 = none) rides as a SECOND line item — a Price
// named "Shipping" carrying Stripe's shipping tax code — NOT a
// Shipping Rate object, so this works with the current restricted
// key (Prices + Payment Links write). A real Shipping Rate would
// need "Shipping Rates: Write" added to the key (patch doc, option A).
// Returns { url, linkId } or { error }.
async function createStripePaymentLink(env, listingId, name, priceCents, shippingCents) {
  const ship = Number(shippingCents) > 0 ? Math.round(Number(shippingCents)) : 0;
  const priceRes = await stripeCall(env, "POST", "/prices",
    { currency: "usd", unit_amount: String(priceCents), tax_behavior: "exclusive", "product_data[name]": name },
    "rcr-price-" + listingId + "-" + priceCents);
  if (!priceRes.ok) return { error: priceRes.error };
  const priceId = priceRes.data && priceRes.data.id;
  if (!priceId) return { error: "Stripe made a price but didn't return its id." };
  const linkParams = {
    "line_items[0][price]": priceId, "line_items[0][quantity]": "1",
    "metadata[listing_id]": listingId, "metadata[auto]": "1",
    "metadata[base_price_cents]": String(priceCents),
  };
  if (ship > 0) {
    const shipRes = await stripeCall(env, "POST", "/prices",
      { currency: "usd", unit_amount: String(ship), tax_behavior: "exclusive", "product_data[name]": "Shipping", "product_data[tax_code]": "txcd_92010001" },
      "rcr-ship-" + listingId + "-" + ship);
    if (!shipRes.ok) return { error: shipRes.error };
    const shipPriceId = shipRes.data && shipRes.data.id;
    if (!shipPriceId) return { error: "Stripe made a shipping price but didn't return its id." };
    linkParams["line_items[1][price]"] = shipPriceId;
    linkParams["line_items[1][quantity]"] = "1";
    linkParams["metadata[shipping_cents]"] = String(ship);
  }
  if (taxEnabled(env)) {
    // Stripe works the rate out from the buyer's address, so collect
    // the shipping address — without it there is no destination to
    // tax. Tax is only charged where we're registered (Florida);
    // everywhere else it comes back $0.
    linkParams["automatic_tax[enabled]"] = "true";
    linkParams["shipping_address_collection[allowed_countries][0]"] = "US";
  }
  // Idempotency key keeps the old shape when nothing new applies, so
  // a link made before this patch retries exactly as before.
  const linkKey = "rcr-link-" + listingId + "-" + priceCents + (ship > 0 ? "-" + ship : "") + (taxEnabled(env) ? "-tax" : "");
  const linkRes = await stripeCall(env, "POST", "/payment_links", linkParams, linkKey);
  if (!linkRes.ok) return { error: linkRes.error };
  const url = linkRes.data && linkRes.data.url;
  if (!url) return { error: "Stripe made a link but didn't return its URL." };
  return { url, linkId: linkRes.data.id };
}

// Turn a Payment Link off. Best-effort: failures are swallowed, because
// deactivation is cleanup, never part of the save.
async function deactivateStripePaymentLink(env, linkId) {
  try { await stripeCall(env, "POST", "/payment_links/" + encodeURIComponent(linkId), { active: "false" }, null); } catch {}
}

// Find a Payment Link by its buy.stripe.com URL (to read its metadata
// and learn whether it is one of ours). Returns { id, metadata } or
// null when not found or Stripe can't be reached.
async function findStripePaymentLink(env, url) {
  const res = await stripeCall(env, "GET", "/payment_links?limit=100", null, null);
  if (!res.ok || !res.data || !Array.isArray(res.data.data)) return null;
  const hit = res.data.data.find((l) => l && l.url === url);
  return hit ? { id: hit.id, metadata: hit.metadata || {}, automatic_tax: hit.automatic_tax || null } : null;
}

// Turn automatic tax on for an existing auto-made Payment Link (one
// made before Stripe Tax was switched on). Best-effort: returns true
// when Stripe accepted it, false otherwise — the save never fails
// over this.
async function enableTaxOnLink(env, linkId) {
  const res = await stripeCall(env, "POST", "/payment_links/" + encodeURIComponent(linkId),
    { "automatic_tax[enabled]": "true", "shipping_address_collection[allowed_countries][0]": "US" }, null);
  return res.ok;
}

// Decide what happens to the Stripe link on a save. `incoming` is the
// link the editor sent (null when the field is blank); `stored` is the
// override row before this save (null for a first save). Returns
// { link, status, message } — `link` is the final stripe_link value.
// The caller writes `link` back to the row when it differs from
// `incoming`. Never throws for Stripe reasons.
async function autoStripeForSave(env, { id, name, priceCents, shippingCents, incoming, stored }) {
  const money = fmtMoneyCents(priceCents);
  if (incoming) {
    const storedShipCents = (stored && typeof stored.shipping === "number") ? Math.round(stored.shipping * 100) : 0;
    const shipChanged = stored && storedShipCents !== (Number(shippingCents) || 0);
    if (stored && stored.stripe_link === incoming && (Math.round(Number(stored.price) * 100) !== priceCents || shipChanged)) {
      // Same link, price changed: only regenerate it if it is one of
      // ours (metadata auto=1). A hand-made Dashboard link stays put.
      if (!env.STRIPE_SECRET_KEY) {
        return { link: incoming, status: "manual_check_needed", message: "Price changed, but Stripe isn't connected yet, so the old link stays as-is. Add STRIPE_SECRET_KEY in Cloudflare and save again, or make a new link in the Stripe Dashboard." };
      }
      const found = await findStripePaymentLink(env, incoming);
      if (!found) {
        return { link: incoming, status: "manual_check_needed", message: "Price changed, but the old link couldn't be checked in Stripe — it may be a hand-made Dashboard link, or Stripe couldn't be reached. Make a new link for the new price in the Dashboard and paste it, or clear the field and save to auto-create one." };
      }
      if (!found.metadata || found.metadata.auto !== "1") {
        return { link: incoming, status: "manual_link", message: "Price changed, but this link was made by hand in the Dashboard, so it was left alone. Make a new link for " + money + " in the Dashboard and paste it — or clear the field and save to auto-create one." };
      }
      if (priceCents < STRIPE_MIN_CENTS) {
        return { link: incoming, status: "price_too_low", message: "Price changed below Stripe's $0.50 minimum — the old link stays as-is." };
      }
      const created = await createStripePaymentLink(env, id, name, priceCents, shippingCents);
      if (created.error) {
        return { link: incoming, status: "error", message: "Stripe said: " + created.error + " The old link stays as-is." };
      }
      await deactivateStripePaymentLink(env, found.id);
      return { link: created.url, status: "recreated", message: "Price or shipping changed — made a new Stripe link for " + money + " and turned the old one off." };
    }
    if (!stored || (stored.stripe_link && stored.stripe_link !== incoming)) {
      return { link: incoming, status: "manual", message: "Stripe link saved as pasted — it won't be replaced automatically." };
    }
    // Same link, same price, same shipping: keep it — but if Stripe
    // Tax has just been switched on, flip it on for this auto-made
    // link too (otherwise links made before tax day would never
    // collect tax). Only when the flag is on, only for our links.
    if (taxEnabled(env) && env.STRIPE_SECRET_KEY) {
      const found = await findStripePaymentLink(env, incoming);
      if (found && found.metadata && found.metadata.auto === "1" && (!found.automatic_tax || found.automatic_tax.enabled !== true)) {
        if (await enableTaxOnLink(env, found.id)) {
          return { link: incoming, status: "kept", message: "Stripe Tax switched on for this link — Florida buyers now pay tax at checkout." };
        }
      }
    }
    return { link: incoming, status: "kept", message: "" };
  }
  // Field is blank.
  if (stored && stored.stripe_link) {
    // Operator cleared the field: remove the link. Turn the old one off
    // only when it is provably one of ours — a hand-made link is left
    // alone in Stripe, in case it is reused elsewhere.
    if (env.STRIPE_SECRET_KEY) {
      const found = await findStripePaymentLink(env, stored.stripe_link);
      if (found && found.metadata && found.metadata.auto === "1") {
        await deactivateStripePaymentLink(env, found.id);
        return { link: null, status: "cleared", message: "Stripe link removed — the old auto-made link was turned off too." };
      }
    }
    return { link: null, status: "cleared", message: "Stripe link removed from this listing." };
  }
  // No link at all: make one.
  if (priceCents < STRIPE_MIN_CENTS) {
    return { link: null, status: "price_too_low", message: "No Stripe link — the price is below Stripe's $0.50 minimum for a payment link." };
  }
  if (!env.STRIPE_SECRET_KEY) {
    return { link: null, status: "not_configured", message: "Stripe isn't connected yet — add STRIPE_SECRET_KEY in the Cloudflare dashboard and save again, or paste a link by hand." };
  }
  const created = await createStripePaymentLink(env, id, name, priceCents, shippingCents);
  if (created.error) {
    return { link: null, status: "error", message: "Stripe said: " + created.error };
  }
  return { link: created.url, status: "created", message: "Stripe link created for " + money + (Number(shippingCents) > 0 ? " + shipping" : "") + " — buyers can check out with Stripe now." };
}

// POST action=stripe-create: make a link on demand for an existing
// listing that has none yet (the editor's "Create Stripe checkout
// link" button). Operator only. Never overwrites an existing link.
async function stripeCreateAction(db, env, a) {
  const id = String(a.id || "").trim().toLowerCase();
  if (!ID_RE.test(id)) return json({ ok: false, error: "Pick a listing first." });
  const row = await db.prepare("SELECT * FROM shop_listing_overrides WHERE id = ? LIMIT 1").bind(id).first();
  if (!row) {
    return json({ ok: false, error: "Save this listing first — the Stripe link is created automatically when you save.", stripe_status: "not_saved" });
  }
  if (row.stripe_link) {
    return json({ ok: true, listing: shapeOverride(row), stripe_status: "already_has_link", stripe_message: "This listing already has a Stripe link." });
  }
  const priceCents = Math.round(Number(row.price) * 100);
  if (priceCents < STRIPE_MIN_CENTS) {
    return json({ ok: true, listing: shapeOverride(row), stripe_status: "price_too_low", stripe_message: "No Stripe link — the price is below Stripe's $0.50 minimum for a payment link." });
  }
  if (!env.STRIPE_SECRET_KEY) {
    return json({ ok: true, listing: shapeOverride(row), stripe_status: "not_configured", stripe_message: "Stripe isn't connected yet — add STRIPE_SECRET_KEY in the Cloudflare dashboard and try again, or paste a link by hand." });
  }
  const created = await createStripePaymentLink(env, row.id, row.name, priceCents, Math.round(Number(row.shipping || 0) * 100));
  if (created.error) {
    return json({ ok: true, listing: shapeOverride(row), stripe_status: "error", stripe_message: "Stripe said: " + created.error });
  }
  await db.prepare("UPDATE shop_listing_overrides SET stripe_link = ? WHERE id = ?").bind(created.url, row.id).run();
  const fresh = await db.prepare("SELECT * FROM shop_listing_overrides WHERE id = ? LIMIT 1").bind(row.id).first();
  return json({ ok: true, listing: fresh ? shapeOverride(fresh) : shapeOverride(row), stripe_status: "created", stripe_message: "Stripe link created for " + fmtMoneyCents(priceCents) + " — buyers can check out with Stripe now." });
}

export async function onRequestGet({ env }) {
  const db = getDb(env);
  if (!db) return noDb();
  let rows;
  try {
    const q = await db.prepare("SELECT * FROM shop_listing_overrides ORDER BY updated_at DESC").all();
    rows = q.results || [];
  } catch (e) {
    // Table not created yet (migration not run) — the shop falls back
    // to its hardcoded data; never crash the shop over this.
    return json({ ok: true, listings: [], setup: false, note: "Shop listing edits aren't set up yet." });
  }
  return json({ ok: true, listings: rows.map(shapeOverride), setup: true });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!me || !isOperator(env, me)) return json({ ok: false, error: "Operator only." });
  if (a.action === "stripe-create") return stripeCreateAction(db, env, a);
  const id = String(a.id || "").trim().toLowerCase();
  if (!ID_RE.test(id)) return json({ ok: false, error: "Listing id must be 3–60 characters of lowercase letters, numbers, and dashes." });
  const name = String(a.name || "").trim().slice(0, 120);
  if (name.length < 3) return json({ ok: false, error: "Name must be at least 3 characters." });
  const price = Number(a.price);
  if (!Number.isFinite(price) || price < 0) return json({ ok: false, error: "Price must be a number, 0 or more." });
  const description = String(a.description || "").slice(0, 4000);
  const photos = cleanPhotos(a.photos);
  const options = cleanOptions(a.options);
  let video = null;
  if (a.video != null && String(a.video).trim() !== "") {
    const v = String(a.video).trim();
    if (!URL_RE.test(v)) return json({ ok: false, error: "Video must be a valid https:// URL." });
    video = v;
  }
  let shipping = null;
  if (a.shipping != null && String(a.shipping).trim() !== "") {
    const s = Number(a.shipping);
    if (!Number.isFinite(s) || s < 0 || s > 9999) return json({ ok: false, error: "Shipping must be $0 or more (blank = no shipping charge)." });
    shipping = Math.round(s * 100) / 100;
  }
  let stripeLink = null;
  if (a.stripe_link != null && String(a.stripe_link).trim() !== "") {
    const s = String(a.stripe_link).trim();
    if (!ABSOLUTE_URL_RE.test(s)) return json({ ok: false, error: "Stripe link must be a valid https:// URL." });
    stripeLink = s;
  }
  // Mark-sold flag (listing-sold-flag migration). 1 = sold out,
  // 0 = for sale. Null when the editor didn't send one.
  let outOfStock = null;
  if (a.out_of_stock != null && a.out_of_stock !== "") {
    const v = Number(a.out_of_stock);
    if (Number.isFinite(v)) outOfStock = v ? 1 : 0;
  }
  // Rename: the editor sends original_id when the listing id was
  // changed (e.g. a repurposed listing getting an id that matches its
  // new name). The old override row is removed after the new one
  // saves, so the old id doesn't linger as a second listing.
  const originalId = String(a.original_id || "").trim().toLowerCase();
  const isRename = ID_RE.test(originalId) && originalId !== id;
  // The row before this save: the auto-Stripe step compares against it
  // (same link + price changed = regenerate an auto link; a pasted link
  // is never touched). The save itself never depends on Stripe.
  const existing = await db.prepare("SELECT * FROM shop_listing_overrides WHERE id = ? LIMIT 1").bind(id).first();
  const hasSoldCol = await hasOutOfStockColumn(db);
  const soldUnsupported = outOfStock != null && !hasSoldCol;
  if (hasSoldCol && outOfStock != null) {
    await db.prepare(
      `INSERT INTO shop_listing_overrides (id, name, price, description, photos, options, video, stripe_link, shipping, out_of_stock, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, price=excluded.price, description=excluded.description, photos=excluded.photos, options=excluded.options, video=excluded.video, stripe_link=excluded.stripe_link, shipping=excluded.shipping, out_of_stock=excluded.out_of_stock, updated_at=excluded.updated_at`,
    ).bind(id, name, Math.round(price * 100) / 100, description, JSON.stringify(photos), JSON.stringify(options), video, stripeLink, shipping, outOfStock, nowMs()).run();
  } else {
    await db.prepare(
      `INSERT INTO shop_listing_overrides (id, name, price, description, photos, options, video, stripe_link, shipping, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, price=excluded.price, description=excluded.description, photos=excluded.photos, options=excluded.options, video=excluded.video, stripe_link=excluded.stripe_link, shipping=excluded.shipping, updated_at=excluded.updated_at`,
    ).bind(id, name, Math.round(price * 100) / 100, description, JSON.stringify(photos), JSON.stringify(options), video, stripeLink, shipping, nowMs()).run();
  }
  if (isRename) {
    await db.prepare("DELETE FROM shop_listing_overrides WHERE id = ?").bind(originalId).run();
  }
  let stripeStatus = "kept", stripeMessage = "";
  try {
    const auto = await autoStripeForSave(env, {
      id, name, priceCents: Math.round(price * 100), shippingCents: Math.round((shipping || 0) * 100), incoming: stripeLink, stored: existing,
    });
    stripeStatus = auto.status;
    stripeMessage = auto.message;
    if (auto.link !== stripeLink) {
      await db.prepare("UPDATE shop_listing_overrides SET stripe_link = ? WHERE id = ?").bind(auto.link, id).run();
    }
  } catch (e) {
    // Stripe work must never break the save.
    stripeStatus = "error";
    stripeMessage = "Stripe couldn't be reached — the listing saved, but no link was made. Try saving again or paste a link by hand.";
  }
  const row = await db.prepare("SELECT * FROM shop_listing_overrides WHERE id = ? LIMIT 1").bind(id).first();
  return json({ ok: true, listing: row ? shapeOverride(row) : null, stripe_status: stripeStatus, stripe_message: stripeMessage, sold_unsupported: soldUnsupported });
}
