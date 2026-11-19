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
    updated_at: row.updated_at,
  };
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
    if (out.length >= 3) break;
    const s = String(u || "").trim();
    if (URL_RE.test(s)) out.push(s);
  }
  return out;
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
  let stripeLink = null;
  if (a.stripe_link != null && String(a.stripe_link).trim() !== "") {
    const s = String(a.stripe_link).trim();
    if (!ABSOLUTE_URL_RE.test(s)) return json({ ok: false, error: "Stripe link must be a valid https:// URL." });
    stripeLink = s;
  }
  await db.prepare(
    `INSERT INTO shop_listing_overrides (id, name, price, description, photos, options, video, stripe_link, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, price=excluded.price, description=excluded.description, photos=excluded.photos, options=excluded.options, video=excluded.video, stripe_link=excluded.stripe_link, updated_at=excluded.updated_at`,
  ).bind(id, name, Math.round(price * 100) / 100, description, JSON.stringify(photos), JSON.stringify(options), video, stripeLink, nowMs()).run();
  const row = await db.prepare("SELECT * FROM shop_listing_overrides WHERE id = ? LIMIT 1").bind(id).first();
  return json({ ok: true, listing: row ? shapeOverride(row) : null });
}
