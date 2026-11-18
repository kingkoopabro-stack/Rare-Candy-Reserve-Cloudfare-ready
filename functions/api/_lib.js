// Shared helpers for the Do Whatever Community Pages Functions.
// NOT a route (leading underscore) — imported by every functions/api/*.js file.
//
// Bindings expected on the Pages project (set in the Cloudflare dashboard,
// Production AND Preview):
//   DB        D1 database (required — without it every endpoint returns a
//             clean 503 JSON { error: "db_unavailable" } and the frontend
//             shows "Community is being set up — check back soon").
//   IMAGES    R2 bucket for post/listing/avatar/model/welcome images
//             (optional until bound — image uploads fail cleanly without it).
//   ID_VAULT  R2 bucket for pending ID-review photos (optional until bound —
//             age-verification submit fails cleanly without it).
//   AI        Workers AI binding (optional — enables the Card Check AI
//             first look; without it verifyCardImage answers honestly that
//             the check isn't available yet).
// Variables:
//   OPERATOR_DEVICE_ID  (optional) device id of the operator (Chris) —
//             pins operator rights without a first-run claim.

export const PLATFORM_FEE_PERCENT = 5; // ⚠ UNCONFIRMED by Chris — kept at the artifact's 5%; flag before launch

export const CATEGORIES = ["General", "Questions & Help", "Shop Talk", "Music", "Plants & Garden", "Tech & Builds", "Off Topic"];

// Chris's exact list of 18+ adult forum categories — browsable tiles for
// posts AND models. Brand/category names only; no real model names anywhere.
export const ADULT_CATEGORIES = [
  "Blondes", "Brunettes", "Redheads", "Petite", "Thick", "BBW", "Curvy",
  "Hung", "Female Ass", "Male Ass", "Big Tits", "Small Tits", "Tattoos & Piercings",
  "Nudes Female", "Nudes Guys", "Personal Requests",
  "Gay (Male)", "Gay (Female)",
  "Trio", "DP", "Amateur", "Solo Content",
  "Rising Star", "Noob",
  "Nerdy Girls", "Goth Girls", "Hipster", "Sub", "Dom",
  "Hardcore", "Upskirt", "Anal", "Gangbang", "Teasing", "Stripping",
  "Kawaii", "Cosplay", "Innocent", "Corrupted", "Oral", "Older",
  "18-21", "25-35", "35-45", "45-55", "55-60", "60-65",
  "White", "Black", "Asian", "Native American", "Thai", "Latina",
];

export const FLAIRS = ["Question", "Card Check", "Show & Tell", "Price Check", "Help", "Discussion", "Hype", "Warning"];

// Creator/Seller area (v3) — digital-content genres a seller picks when
// they make a creator post or set up "What I sell" on their profile.
export const CREATOR_GENRES = ["Photos", "Videos", "Custom Content", "Audio", "3D Models", "3D Print Files", "Developer Files", "Designs", "Art", "Apps", "Game Assets", "Adult Content", "Other"];
// One-tap seller tag chips for the creator composer (the seller can also
// type their own tags — these are just the quick ones).
export const CREATOR_TAG_CHIPS = ["Selling Uncensored Nudes", "Selling Videos", "Custom Content", "3D Print Files", "Selling Photos", "Selling 3D Models", "Developer Files", "Designs & Art", "Game Assets"];
// A Steady Heart — "End of the year" (21 tracks, in order). Members pick
// up to 5 to feature on their profile. Track names are exact — never
// re-title or alter them. Chris gives full permission to use all of it.
// (Track names only — no audio player here; the player comes later.)
export const ASH_TRACKS = [
  "Break habits, not hearts", "Untold weapons", "Voice inside my head original",
  "Sunk for you", "I'll prove everything", "Mr.Selfish", "Sweet BBgirl",
  "Let's Travel", "Straight to pieces", "The day she came to be",
  "Djentlemen Thief", "Guess how it ends", "On top of it Feat. Chest Club",
  "Monster in disguise", "Stay until sunrise", "Read between the lines",
  "Introduction to heartache", "We will meet again I swear",
  "Dance till they drop", "Aiming to tease part 2", "Give them the world",
];
// Vita Nova Radio — the live Icecast MP3 stream. The only stream URL the
// site uses; never invent another one.
export const VNR_STREAM_URL = "https://radio.rarecandyreserve.org/vitanova";
export const LISTING_CATEGORIES = ["Pokemon Cards", "Sports Cards", "Other TCG", "Graded Slabs", "Sealed Product", "Figures & Toys", "Video Games", "Plants", "3D Prints & Custom", "Other Collectibles"];
export const SALE_VENUES = ["eBay", "Mercari", "Facebook Marketplace", "This app", "In person", "Other"];
export const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"];
export const MODEL_EYE_COLORS = ["Brown", "Blue", "Green", "Hazel", "Gray", "Other"];
export const MODEL_STYLES = ["Girly", "Tomboy", "Goth", "Hipster", "Kawaii", "Nerdy", "Sporty", "Alt", "Classic", "Baddie"];
export const MODEL_BREAST_SIZES = ["Small", "Medium", "Big"];
export const MODEL_INK_OPTIONS = ["None", "Tattoos", "Piercings", "Tattoos & piercings"];

const BANNED_TERMS = ["firearm", "pistol", "rifle", "shotgun", "handgun", "ammunition", " ammo", "silencer", "suppressor", "ghost gun", "ar-15", "glock", "explosive", "grenade", "cocaine", "heroin", "methamphetamine", "fentanyl", "stolen card", "counterfeit for sale"];
export function bannedCheck(text) {
  const low = ` ${(text || "").toLowerCase()} `;
  for (const t of BANNED_TERMS) if (low.includes(t)) return t.trim();
  return null;
}

// Guest chat is ALWAYS censored server-side before storage; signed-in
// members chat as themselves and are not filtered.
const PROFANITY = ["fuck", "shit", "bitch", "asshole", "bastard", "damn", "dick", "pussy", "whore", "slut", "nigger", "nigga", "faggot", "retard", "cunt", "cock", "porn", "sex"];
export function censorText(text) {
  let censored = false;
  let out = text || "";
  for (const w of PROFANITY) {
    const re = new RegExp(`\\b${w}\\w*`, "gi");
    out = out.replace(re, (m) => { censored = true; return "*".repeat(Math.max(3, m.length)); });
  }
  return { text: out, censored };
}

// --- HTTP helpers --------------------------------------------------------

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

export function noDb() {
  return json({ ok: false, error: "db_unavailable", message: "Community is being set up — check back soon." }, 503);
}

export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

export function getDb(env) { return env.DB || null; }

// --- D1 row helpers ------------------------------------------------------

export async function profileByDevice(db, deviceId) {
  if (!deviceId) return null;
  return await db.prepare("SELECT * FROM profiles WHERE device_id = ? LIMIT 1").bind(deviceId).first();
}

export function isOperator(env, profile) {
  if (!profile) return false;
  if (profile.is_operator === 1) return true;
  if (env.OPERATOR_DEVICE_ID && profile.device_id === env.OPERATOR_DEVICE_ID) return true;
  return false;
}

export const nowMs = () => Date.now();
export const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
export const money = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;

export function trackingUrl(carrier, trackingNumber) {
  const tn = (trackingNumber || "").trim();
  if (!tn) return null;
  const enc = encodeURIComponent(tn);
  switch (carrier) {
    case "USPS": return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${enc}`;
    case "UPS": return `https://www.ups.com/track?tracknum=${enc}`;
    case "FedEx": return `https://www.fedex.com/fedextrack/?trknbr=${enc}`;
    case "DHL": return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${enc}`;
    default: return null;
  }
}

// --- Images (R2) ---------------------------------------------------------

export function imageUrl(blobKey) {
  if (!blobKey) return null;
  return `/api/images?key=${encodeURIComponent(blobKey)}`;
}

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export function decodeImage(img, maxBytes) {
  if (!img || typeof img.dataBase64 !== "string" || !img.mimeType) return { ok: false, error: "No image attached." };
  if (!IMAGE_MIMES.includes(img.mimeType)) return { ok: false, error: "Photo must be JPG, PNG, WebP, or GIF." };
  let bytes;
  try {
    const bin = atob(img.dataBase64.replace(/\s/g, ""));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch { return { ok: false, error: "That photo couldn't be read — try uploading it again." }; }
  if (bytes.length > maxBytes) return { ok: false, error: `That photo is too large — keep it under about ${(maxBytes / 1000000).toFixed(1).replace(".0", "")} MB.` };
  return { ok: true, bytes, mime: img.mimeType };
}

// Stores an image in the IMAGES R2 bucket. Returns { ok, key?, error? }.
// If the bucket is not bound yet, returns a clean error (never a crash).
export async function putImage(env, prefix, deviceId, img, maxBytes = 2500000) {
  const dec = decodeImage(img, maxBytes);
  if (!dec.ok) return dec;
  if (!env.IMAGES) return { ok: false, error: "Image uploads aren't connected yet — the shop is still setting up community photo storage. You can post without a photo for now." };
  const key = `${prefix}/${deviceId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  await env.IMAGES.put(key, dec.bytes, { httpMetadata: { contentType: dec.mime } });
  return { ok: true, key };
}

// --- Short video clips (v3.5) --------------------------------------------
// A post can attach one short video clip: MP4 / WebM / MOV, max 15 MB,
// max 60 seconds (the 60s limit is checked in the browser before upload;
// the server checks type + size, same as photos). Stored in the same
// IMAGES R2 bucket under the "videos/" key prefix (no new bucket needed)
// and served through /api/images like photos, with HTTP Range support
// so <video> can seek.
export const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
export function videoUrl(blobKey) {
  if (!blobKey) return null;
  return `/api/images?key=${encodeURIComponent(blobKey)}`;
}
export function decodeVideo(video, maxBytes = 15000000) {
  if (!video || typeof video.dataBase64 !== "string" || !video.mimeType) return { ok: false, error: "No video attached." };
  if (!VIDEO_MIMES.includes(video.mimeType)) return { ok: false, error: "Video must be MP4, WebM, or MOV." };
  let bytes;
  try {
    const bin = atob(video.dataBase64.replace(/\s/g, ""));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch { return { ok: false, error: "That video couldn't be read — try uploading it again." }; }
  if (bytes.length > maxBytes) return { ok: false, error: `That video is too large — keep it under about ${(maxBytes / 1000000).toFixed(1).replace(".0", "")} MB.` };
  return { ok: true, bytes, mime: video.mimeType };
}

// Stores a video in the IMAGES R2 bucket. Returns { ok, key?, error? }.
// If the bucket is not bound yet, returns a clean error (never a crash).
export async function putVideo(env, prefix, deviceId, video, maxBytes = 15000000) {
  const dec = decodeVideo(video, maxBytes);
  if (!dec.ok) return dec;
  if (!env.IMAGES) return { ok: false, error: "Video uploads aren't connected yet — the shop is still setting up community file storage. You can post without a video for now." };
  const key = `${prefix}/${deviceId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  await env.IMAGES.put(key, dec.bytes, { httpMetadata: { contentType: dec.mime } });
  return { ok: true, key };
}

// --- 3D print files (v3) -------------------------------------------------
// A creator post can attach one 3D print file: .stl / .obj / .3mf, or a
// .zip containing them. Max 25 MB. Stored in the same IMAGES R2 bucket
// under the "3d/" key prefix (no new bucket needed). The file bytes never
// live in D1 — only the R2 key + original name + size on the post row.
export const PRINT_FILE_EXTS = [".stl", ".obj", ".3mf", ".zip"];
export const PRINT_FILE_MIMES = {
  ".stl": "model/stl",
  ".obj": "model/obj",
  ".3mf": "model/3mf",
  ".zip": "application/zip",
};
export function fileUrl(blobKey) {
  if (!blobKey) return null;
  return `/api/files?key=${encodeURIComponent(blobKey)}`;
}
export function decodePrintFile(file, maxBytes = 25000000) {
  if (!file || typeof file.dataBase64 !== "string") return { ok: false, error: "No 3D file attached." };
  const name = String(file.fileName || file.name || "").trim();
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  if (!PRINT_FILE_EXTS.includes(ext)) {
    return { ok: false, error: "That isn't a 3D print file — attach a .stl, .obj, .3mf, or a .zip of them." };
  }
  let bytes;
  try {
    const bin = atob(String(file.dataBase64).replace(/\s/g, ""));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch { return { ok: false, error: "That file couldn't be read — try uploading it again." }; }
  if (bytes.length > maxBytes) return { ok: false, error: "That file is too large — keep 3D print files under 25 MB." };
  if (bytes.length === 0) return { ok: false, error: "That file looks empty." };
  return { ok: true, bytes, ext, mime: PRINT_FILE_MIMES[ext], fileName: name.slice(0, 120) };
}
export async function putPrintFile(env, deviceId, file, maxBytes = 25000000) {
  const dec = decodePrintFile(file, maxBytes);
  if (!dec.ok) return dec;
  if (!env.IMAGES) return { ok: false, error: "File uploads aren't connected yet — the shop is still setting up community file storage. You can post without a file for now." };
  const safeName = dec.fileName.replace(/[^A-Za-z0-9._-]+/g, "_");
  const key = `3d/${deviceId}-${Date.now()}-${Math.floor(Math.random() * 10000)}-${safeName}`;
  await env.IMAGES.put(key, dec.bytes, { httpMetadata: { contentType: dec.mime } });
  return { ok: true, key, fileName: dec.fileName, mime: dec.mime, size: dec.bytes.length };
}

// --- Text normalization ---------------------------------------------------

export function normalizeTag(raw) {
  return (raw || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
}
export function normalizeTags(raw, max = 6) {
  const out = [];
  for (const t of (raw || [])) {
    const n = normalizeTag(t);
    if (n && !out.includes(n)) out.push(n);
    if (out.length >= max) break;
  }
  return out;
}
// Creator-post tags: the seller types their own (comma-separated), max 8,
// each 2–24 chars after normalization. Same normalization as forum tags.
export function normalizeCreatorTags(raw) {
  const out = [];
  for (const t of (raw || [])) {
    const n = normalizeTag(t);
    if (n && n.length >= 2 && !out.includes(n)) out.push(n);
    if (out.length >= 8) break;
  }
  return out;
}
export function parseTags(stored) {
  if (!stored) return [];
  return stored.split(",").map((t) => t.trim()).filter(Boolean);
}
export function normalizeCardKey(name) {
  return (name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
export function cardKeysMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  return a.includes(b) || b.includes(a);
}
export function medianCents(values) {
  if (!values.length) return 0;
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? 0) : Math.round(((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2);
}
export function ageFromBirthday(birthday) {
  if (!birthday) return null;
  const dob = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

// --- Signup human check (stateless math challenge, same as the artifact) ---

function challengeChecksum(a, b) { return (a * 31 + b * 17 + 12345) % 997; }
export function makeChallenge() {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  return { token: `${a}.${b}.${challengeChecksum(a, b)}`, question: `Quick human check: what is ${a} + ${b}?` };
}
export function checkChallenge(token, answer) {
  const parts = String(token || "").split(".").map(Number);
  const [a = -1, b = -1, sum = -1] = parts;
  if (parts.length !== 3 || a < 0 || b < 0) return false;
  if (challengeChecksum(a, b) !== sum) return false;
  return a + b === answer;
}

// --- Listing description HTML sanitizer (artifact rules) ------------------

const ALLOWED_DESC_TAGS = new Set(["b", "strong", "i", "em", "u", "s", "ul", "ol", "li", "br", "p", "a"]);
export function sanitizeListingHtml(input) {
  const noBlocks = (input || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "");
  return noBlocks.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (_match, slash, tagRaw, attrs) => {
      const tag = tagRaw.toLowerCase();
      if (!ALLOWED_DESC_TAGS.has(tag)) return "";
      if (tag === "br") return "<br>";
      if (slash) return `</${tag}>`;
      if (tag === "a") {
        const hrefMatch = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
        const href = (hrefMatch?.[2] ?? hrefMatch?.[3] ?? "").trim();
        if (!/^https?:\/\//i.test(href)) return "<a>";
        const safe = href.replace(/"/g, "%22");
        return `<a href="${safe}" target="_blank" rel="noopener noreferrer nofollow">`;
      }
      return `<${tag}>`;
    },
  );
}

// --- MySpace throwback v2 helpers ---------------------------------------

// Layout CSS sanitizer — custom profile layouts are CSS ONLY. Strips anything
// that could run code or phone home: <script>/<style> blocks, @import and
// @font-face (no external stylesheets or fonts), javascript:/vbscript: URLs,
// CSS expressions and behaviors, and url() pointing anywhere except
// https:// images or data:image/ blobs. position:fixed is downgraded to
// absolute so a layout can't overlay the site chrome. Returns clean CSS
// (max 8000 chars) — never throws.
export function sanitizeLayoutCss(input) {
  var css = String(input || "").slice(0, 8000);
  css = css.replace(/<!--[\s\S]*?-->/g, "");
  // Strip whole <script>/<style>/etc blocks first (through the closing tag),
  // then any leftover lone tags — a lazy match on the opening tag alone
  // would leave the block's contents behind.
  css = css.replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1\s*>/gi, "");
  css = css.replace(/<\/?(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, "");
  css = css.replace(/@import[^;{}]*;?/gi, "");
  css = css.replace(/@font-face[\s\S]*?}/gi, "");
  css = css.replace(/@charset[^;{}]*;?/gi, "");
  css = css.replace(/javascript\s*:/gi, "");
  css = css.replace(/vbscript\s*:/gi, "");
  css = css.replace(/expression\s*\(/gi, "nope(");
  css = css.replace(/behavior\s*:/gi, "nope:");
  css = css.replace(/-moz-binding\s*:/gi, "nope:");
  css = css.replace(/position\s*:\s*fixed/gi, "position:absolute");
  // url(...) — keep only https:// images and data:image/ blobs.
  css = css.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi, function (_m, d, s, u) {
    var v = String(d ?? s ?? u ?? "").trim();
    if (/^https:\/\//i.test(v) || /^data:image\//i.test(v)) return "url(" + v + ")";
    return "url()";
  });
  return css.trim();
}

// Top Friends: stored as a comma-separated list of profile IDs, max 8.
export function parseTopFriendIds(stored) {
  if (!stored) return [];
  var out = [];
  for (const part of String(stored).split(",")) {
    const n = parseInt(part.trim(), 10);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
    if (out.length >= 8) break;
  }
  return out;
}

// My page URL (v3.6) — vanity slug rules. A slug is 3-24 chars of
// letters, numbers, _ . -, unique across members (case-insensitive).
// Changeable only 3 times in a 5-year window, with a 1-year cooldown
// after each change. The first set (from empty) counts as change #1,
// so a member gets 3 slug values per window.
export const SLUG_RE = /^[A-Za-z0-9_.-]{3,24}$/;
export const SLUG_CHANGE_LIMIT = 3;
export const SLUG_WINDOW_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;
export const SLUG_COOLDOWN_MS = 365.25 * 24 * 60 * 60 * 1000;
export function slugChangeCheck(row, newSlug, now) {
  const current = String((row && row.page_slug) || "").trim();
  const next = String(newSlug || "").trim();
  // Unchanged (case-insensitive) — allowed, nothing to do.
  if (next.toLowerCase() === current.toLowerCase()) {
    return { ok: true, changed: false, newChanges: Number(row?.page_slug_changes || 0), newWindowStart: row?.page_slug_window_start ?? null, newChangedAt: row?.page_slug_changed_at ?? null, nextChangeAt: null };
  }
  let changes = Number(row?.page_slug_changes || 0);
  let windowStart = row?.page_slug_window_start ?? null;
  const changedAt = row?.page_slug_changed_at ?? null;
  // Window expired (or never started) — reset the count and start fresh.
  if (!windowStart || now - windowStart > SLUG_WINDOW_MS) {
    changes = 0;
    windowStart = now;
  }
  if (changes >= SLUG_CHANGE_LIMIT) {
    const nextAt = windowStart + SLUG_WINDOW_MS;
    return { ok: false, changed: false, nextChangeAt: nextAt, error: "You've used all 3 page URL changes for this 5-year window. You can pick a new one again on " + new Date(nextAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) + " — or appeal to Chris for another change." };
  }
  if (changedAt && now - changedAt < SLUG_COOLDOWN_MS) {
    const nextAt = changedAt + SLUG_COOLDOWN_MS;
    return { ok: false, changed: false, nextChangeAt: nextAt, error: "You can change your page URL again on " + new Date(nextAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) + " — or appeal to Chris for another change." };
  }
  return { ok: true, changed: true, newChanges: changes + 1, newWindowStart: windowStart, newChangedAt: now, nextChangeAt: null };
}
// When the owner can next change their slug (null = they can now).
// Used so the Edit Profile form can show the date up front.
export function slugNextChangeAt(row, now) {
  const changes = Number(row?.page_slug_changes || 0);
  const windowStart = row?.page_slug_window_start ?? null;
  const changedAt = row?.page_slug_changed_at ?? null;
  if (!windowStart || now - windowStart > SLUG_WINDOW_MS) return null;
  if (changes >= SLUG_CHANGE_LIMIT) return windowStart + SLUG_WINDOW_MS;
  if (changedAt && now - changedAt < SLUG_COOLDOWN_MS) return changedAt + SLUG_COOLDOWN_MS;
  return null;
}

// Effective presence for a profile row: 'away' is explicit; 'online' only
// counts if the heartbeat is fresh (<= 3 minutes); anything else is offline.
export function presenceOf(row) {
  if (!row) return "offline";
  const st = row.presence_status || "offline";
  if (st === "away") return "away";
  if (st === "online") {
    const seen = Number(row.last_seen || 0);
    if (seen && Date.now() - seen <= 180000) return "online";
    return "offline";
  }
  return "offline";
}

// Resolve Top Friend IDs to public cards, in the member's chosen order.
export async function topFriendCards(db, ids) {
  const list = (ids || []).filter((n) => Number.isInteger(n) && n > 0).slice(0, 8);
  if (!list.length) return [];
  const placeholders = list.map(() => "?").join(",");
  const { results } = await db.prepare(
    `SELECT id, username, avatar_blob_key FROM profiles WHERE id IN (${placeholders})`,
  ).bind(...list).all();
  const byId = new Map((results || []).map((r) => [r.id, r]));
  return list.filter((id) => byId.has(id)).map((id) => {
    const r = byId.get(id);
    return { id: r.id, username: r.username, avatar_url: imageUrl(r.avatar_blob_key) };
  });
}

// --- Row shaping (public shapes; never leak full_name, payout handle, or device id) ---

export function shapeProfile(row) {
  if (!row) return null;
  return {
    id: row.id, username: row.username, full_name: row.full_name ?? "",
    birthday: row.birthday ?? null, terms_agreed: !!row.terms_agreed_at,
    age_verified: row.age_verified === 1, is_operator: row.is_operator === 1,
    chat_name: row.chat_name ?? "", occupation: row.occupation ?? "", bio: row.bio ?? "",
    avatar_url: imageUrl(row.avatar_blob_key),
    payout_method: row.payout_method ?? "", payout_handle: row.payout_handle ?? "",
    // MySpace throwback v2 — Top Friends, custom layout, presence.
    top_friend_ids: parseTopFriendIds(row.top_friends),
    layout_css: row.layout_css ?? "", layout_preset: row.layout_preset ?? "",
    presence: presenceOf(row), away_message: row.away_message ?? "",
    is_model: row.is_model === 1, model_bio: row.model_bio ?? "",
    model_categories: parseTags(row.model_categories),
    model_display_url: imageUrl(row.model_display_blob_key),
    model_gender: row.model_gender ?? "", model_eye_color: row.model_eye_color ?? "",
    model_weight_lbs: row.model_weight_lbs ?? null,
    model_styles: parseTags(row.model_styles),
    model_music: row.model_music ?? "", model_gamer: row.model_gamer ?? "",
    model_breast: row.model_breast ?? "", model_ink: row.model_ink ?? "",
    // Creator/Seller area (v3) — "What I sell" / "What I'm after". Public
    // by design: the seller card on the member page and the Find results
    // show exactly these fields (never payout handle or full name).
    seller_types: parsePrefs(row.seller_types),
    seller_tags: parsePrefs(row.seller_tags),
    seller_open_to: row.seller_open_to ?? "",
    seller_price_min_cents: row.seller_price_min_cents ?? 0,
    seller_price_max_cents: row.seller_price_max_cents ?? 0,
    buyer_types: parsePrefs(row.buyer_types),
    buyer_tags: parsePrefs(row.buyer_tags),
    buyer_budget_max_cents: row.buyer_budget_max_cents ?? 0,
    // Music (v3.1) — A Steady Heart track picks (track numbers 1–21, max
    // 5; titles come from ASH_TRACKS) + the opt-in Vita Nova Radio
    // player. Independent options: either, both, or neither.
    ash_tracks: parseAshTracks(row.ash_tracks),
    show_vnr_player: row.show_vnr_player === 1,
    // v3.3 — autoplay the Steady Wave player on the member page (only
    // meaningful when show_vnr_player is on; browsers still gate sound
    // autoplay behind a visitor interaction).
    autoplay_vnr: row.autoplay_vnr === 1,
    // v3.4 — My links (buttons on the member page).
    my_links: parseMyLinks(row.my_links),
    // v3.2 — custom "Subscribe to my page" button text + member-page theme.
    subscribe_label: row.subscribe_label ?? "Subscribe to my page",
    profile_theme: parseTheme(row.profile_theme),
    // v3.6 — custom page URL + action-button customization.
    page_slug: row.page_slug ?? "",
    page_slug_changes: Number(row.page_slug_changes || 0),
    page_slug_next_change_at: iso(slugNextChangeAt(row, Date.now())),
    profile_buttons: parseProfileButtons(row.profile_buttons),
    // v3.7 — role/badges, banner/cover photo, custom ticker, bans.
    role: row.role ?? (row.is_operator === 1 ? "operator" : "member"),
    banner_url: imageUrl(row.banner_blob_key ?? null),
    ticker_text: row.ticker_text ?? "",
    ticker_enabled: row.ticker_enabled === 1,
    ticker_color: row.ticker_color ?? "",
    banned: row.banned === 1,
    created_at: iso(row.created_at),
  };
}

export function shapeMember(row) {
  return {
    id: row.id, username: row.username,
    birthday: row.birthday ? row.birthday.slice(5) : null, // month-day only, never the year
    occupation: row.occupation ?? "", bio: row.bio ?? "",
    avatar_url: imageUrl(row.avatar_blob_key),
    payout_ready: !!(row.payout_method && row.payout_handle),
    // MySpace throwback v2 — presence for the AIM buddy list.
    presence: presenceOf(row), away_message: row.away_message ?? "",
    // Creator/Seller area (v3) — public seller card + Find results.
    seller_types: parsePrefs(row.seller_types),
    seller_tags: parsePrefs(row.seller_tags),
    seller_open_to: row.seller_open_to ?? "",
    seller_price_min_cents: row.seller_price_min_cents ?? 0,
    seller_price_max_cents: row.seller_price_max_cents ?? 0,
    buyer_types: parsePrefs(row.buyer_types),
    buyer_tags: parsePrefs(row.buyer_tags),
    buyer_budget_max_cents: row.buyer_budget_max_cents ?? 0,
    // Music (v3.1) — A Steady Heart picks + Vita Nova Radio player toggle.
    ash_tracks: parseAshTracks(row.ash_tracks),
    show_vnr_player: row.show_vnr_player === 1,
    // v3.3 — autoplay the Steady Wave player on the member page.
    autoplay_vnr: row.autoplay_vnr === 1,
    // v3.4 — My links (buttons on the member page).
    my_links: parseMyLinks(row.my_links),
    // v3.2 — custom "Subscribe to my page" button text + member-page theme.
    subscribe_label: row.subscribe_label ?? "Subscribe to my page",
    profile_theme: parseTheme(row.profile_theme),
    // v3.6 — custom page URL + action-button customization (public).
    page_slug: row.page_slug ?? "",
    profile_buttons: parseProfileButtons(row.profile_buttons),
    // v3.7 — role/badges, banner/cover photo, custom ticker, bans (public).
    role: row.role ?? (row.is_operator === 1 ? "operator" : "member"),
    banner_url: imageUrl(row.banner_blob_key ?? null),
    ticker_text: row.ticker_text ?? "",
    ticker_enabled: row.ticker_enabled === 1,
    ticker_color: row.ticker_color ?? "",
    banned: row.banned === 1,
    created_at: iso(row.created_at),
  };
}

// --- v3.7 roles ------------------------------------------------------------
// role is 'operator' | 'admin' | 'mod' | 'member'. is_operator stays as the
// legacy operator flag; role is the source of truth for badges + access.
export function roleOf(row) {
  if (!row) return "member";
  const r = String(row.role || "").toLowerCase();
  if (r === "operator" || r === "admin" || r === "mod") return r;
  return row.is_operator === 1 ? "operator" : "member";
}
export function isTeamRole(role) {
  return role === "operator" || role === "admin" || role === "mod";
}
export function isOperatorRow(row) {
  return roleOf(row) === "operator";
}

export function shapeModelCard(row) {
  return {
    id: row.id, username: row.username, model_bio: row.model_bio ?? "",
    categories: parseTags(row.model_categories),
    display_url: imageUrl(row.model_display_blob_key ?? row.avatar_blob_key ?? null),
    gender: row.model_gender ?? "", eye_color: row.model_eye_color ?? "",
    weight_lbs: row.model_weight_lbs ?? null,
    styles: parseTags(row.model_styles),
    music: row.model_music ?? "", gamer: row.model_gamer ?? "",
    breast: row.model_breast ?? "", ink: row.model_ink ?? "",
    created_at: iso(row.created_at),
  };
}

export async function authTally(db, postId) {
  const { results } = await db.prepare("SELECT verdict FROM auth_votes WHERE post_id = ?").bind(postId).all();
  const t = { real: 0, fake: 0, unsure: 0 };
  for (const v of (results || [])) { if (v.verdict === "real") t.real++; else if (v.verdict === "fake") t.fake++; else t.unsure++; }
  return t;
}

export async function shapePost(db, row, author) {
  const hearts = await db.prepare("SELECT COUNT(*) AS n FROM post_votes WHERE post_id = ? AND value = 1").bind(row.id).first();
  const cc = await db.prepare("SELECT COUNT(*) AS n FROM comments WHERE post_id = ?").bind(row.id).first();
  const t = await authTally(db, row.id);
  return {
    id: row.id, title: row.title, body: row.body, category: row.category,
    kind: row.kind ?? "forum", flair: row.flair ?? "", tags: parseTags(row.tags),
    allow_comments: row.allow_comments === 1,
    image_url: imageUrl(row.image_blob_key), video_url: videoUrl(row.video_blob_key ?? null), gif_url: row.gif_url ?? null, gif_label: row.gif_label ?? "",
    verification_status: row.verification_status ?? "not_checked",
    verification_summary: row.verification_summary ?? "",
    auth_real: t.real, auth_fake: t.fake, auth_unsure: t.unsure,
    author_id: author.id, author_username: author.username, author_occupation: author.occupation ?? "",
    author_avatar_url: imageUrl(author.avatar_blob_key),
    score: hearts?.n ?? 0, comment_count: cc?.n ?? 0,
    // Creator/Seller area (v3) — only set on creator posts; plain posts
    // carry the defaults (is_creator 0, free, no genre, no file).
    is_creator: row.is_creator === 1,
    content_genre: row.content_genre ?? "",
    price_cents: row.price_cents ?? 0,
    // v3.2 — blur + pay-to-unlock are OPT-IN ONLY (both default 0/off).
    // A photo is never blurred or paywalled unless the poster/seller
    // explicitly ticked the box when posting.
    blur_photo: row.blur_photo === 1,
    pay_unlock: row.pay_unlock === 1,
    file_url: fileUrl(row.file_blob_key ?? null),
    file_name: row.file_name ?? "", file_mime: row.file_mime ?? "",
    file_size: row.file_size ?? 0,
    created_at: iso(row.created_at),
  };
}

// --- Creator/Seller matching (v3, pure + testable) -----------------------
// Score a candidate against a seeker's wants. Content-type overlap counts
// most (+2 each), shared tags +1 each, and a price/budget fit +1.
// Returns 0 when there is nothing in common (no match at all).
export function matchScore(candidateTypes, candidateTags, seekerTypes, seekerTags, candidatePriceCents, seekerBudgetCents) {
  const ct = new Set((candidateTypes || []).map((t) => String(t).toLowerCase()));
  const st = new Set((seekerTypes || []).map((t) => String(t).toLowerCase()));
  const cg = new Set((candidateTags || []).map((t) => String(t).toLowerCase()));
  const sg = new Set((seekerTags || []).map((t) => String(t).toLowerCase()));
  let score = 0;
  for (const t of st) if (ct.has(t)) score += 2;
  for (const t of sg) if (cg.has(t)) score += 1;
  // Price fit: the seeker's budget covers the candidate's price (or the
  // candidate is free), or the candidate's range overlaps the budget.
  if (typeof seekerBudgetCents === "number" && seekerBudgetCents > 0) {
    const price = typeof candidatePriceCents === "number" ? candidatePriceCents : 0;
    if (price <= seekerBudgetCents) score += 1;
  }
  return score;
}
// Split a stored comma-separated pref field back into a list.
export function parsePrefs(stored) {
  if (!stored) return [];
  return String(stored).split(",").map((t) => t.trim()).filter(Boolean);
}
// My links (v3.4) — stored as JSON [{label, url}] in profiles.my_links.
// Label 1–40 chars, URL must start with http:// or https://, max 5.
// Bad rows are dropped, never stored; a bad stored value parses to [].
export function cleanMyLinks(list) {
  const out = [];
  for (const item of (Array.isArray(list) ? list : [])) {
    const label = String((item && item.label) || "").trim().slice(0, 40);
    const url = String((item && item.url) || "").trim().slice(0, 500);
    if (!label || !/^https?:\/\//i.test(url)) continue;
    if (out.some((l) => l.url === url)) continue;
    out.push({ label, url });
    if (out.length >= 5) break;
  }
  return out;
}
export function parseMyLinks(stored) {
  if (!stored) return [];
  try {
    return cleanMyLinks(JSON.parse(stored));
  } catch { return []; }
}
// Clean a seller/buyer content-type list: keep only real genres, dedupe.
export function cleanCreatorTypes(list) {
  const out = [];
  for (const t of (Array.isArray(list) ? list : [])) {
    const v = String(t || "").trim();
    if (v && CREATOR_GENRES.includes(v) && !out.includes(v)) out.push(v);
  }
  return out;
}
// A Steady Heart track picks (v3.1) — stored as comma-separated track
// numbers (1–21, in the member's chosen order), max 5. Titles come from
// ASH_TRACKS — never stored, never re-titled.
export function parseAshTracks(stored) {
  if (!stored) return [];
  const out = [];
  for (const part of String(stored).split(",")) {
    const n = parseInt(part.trim(), 10);
    if (Number.isInteger(n) && n >= 1 && n <= ASH_TRACKS.length && !out.includes(n)) out.push(n);
    if (out.length >= 5) break;
  }
  return out;
}

// Member-page theme (v3.2) — JSON {bg_color, bg_image_url, text_color,
// accent_color, font}. Every value is validated here, so the CSS the
// frontend builds from it can never carry a script, an @import, or a
// non-https image — same rules as sanitizeLayoutCss, enforced by
// construction: colors must be #rrggbb, the background image must be
// https://, and the font must be one of the fixed allowlisted stacks.
export const THEME_FONTS = ["", "comic", "typewriter", "serif", "rounded"];
export const BUTTON_STYLE_IDS = ["", "neon", "arcade", "gradient", "rounded", "retro", "gold", "ghost"];
export const MYSPACE_EFFECT_IDS = ["animated-bg", "sparkle", "marquee", "glow-text"];
export function parseTheme(stored) {
  const empty = { bg_color: "", bg_image_url: "", text_color: "", accent_color: "", font: "", button_style: "", button_css: "", effects: [] };
  if (!stored) return empty;
  let obj;
  try { obj = typeof stored === "string" ? JSON.parse(stored) : stored; } catch { return empty; }
  if (!obj || typeof obj !== "object") return empty;
  const hex = (v) => /^#[0-9a-fA-F]{6}$/.test(String(v || "").trim()) ? String(v).trim() : "";
  const out = { ...empty };
  out.bg_color = hex(obj.bg_color);
  out.text_color = hex(obj.text_color);
  out.accent_color = hex(obj.accent_color);
  const img = String(obj.bg_image_url || "").trim().slice(0, 500);
  out.bg_image_url = /^https:\/\//i.test(img) ? img : "";
  out.font = THEME_FONTS.includes(obj.font) ? obj.font : "";
  out.button_style = BUTTON_STYLE_IDS.includes(obj.button_style) ? obj.button_style : "";
  out.button_css = sanitizeLayoutCss(String(obj.button_css || "")).slice(0, 4000);
  const eff = Array.isArray(obj.effects) ? obj.effects : [];
  out.effects = eff.filter((e) => MYSPACE_EFFECT_IDS.includes(e)).slice(0, 4);
  return out;
}
// Validate + normalize a theme from a client save. Returns the JSON string
// to store ("" when nothing is set).
export function cleanTheme(input) {
  const t = parseTheme(input);
  if (!t.bg_color && !t.bg_image_url && !t.text_color && !t.accent_color && !t.font && !t.button_style && !t.button_css && !(t.effects && t.effects.length)) return "";
  return JSON.stringify(t);
}
// Profile action buttons (v3.6) — one JSON blob describing the button
// block on the owner's page: { mode: "buttons"|"image", image_url, buttons:
// { add/message/favorite/group/report: { label, bg, color } } }.
// Labels are plain text, max 30 chars; colors must be #rrggbb; the solid
// image (mode "image") must be https://. Only keys the owner actually
// set are kept; returns "" when nothing is set.
export const PROFILE_BUTTON_IDS = ["add", "message", "favorite", "group", "report"];
export function cleanProfileButtons(input) {
  let obj = null;
  try { obj = typeof input === "string" ? JSON.parse(input) : input; } catch { return ""; }
  if (!obj || typeof obj !== "object") return "";
  const hex = (v) => /^#[0-9a-fA-F]{6}$/.test(String(v || "").trim()) ? String(v).trim() : "";
  const out = { mode: "buttons", image_url: "", buttons: {} };
  if (obj.mode === "image") out.mode = "image";
  const img = String(obj.image_url || "").trim().slice(0, 500);
  if (/^https:\/\//i.test(img)) out.image_url = img;
  const src = (obj.buttons && typeof obj.buttons === "object") ? obj.buttons : {};
  for (const key of PROFILE_BUTTON_IDS) {
    const b = src[key];
    if (!b || typeof b !== "object") continue;
    const label = String(b.label || "").replace(/[<>\n\r]/g, "").trim().slice(0, 30);
    const bg = hex(b.bg);
    const color = hex(b.color);
    if (!label && !bg && !color) continue;
    out.buttons[key] = { label, bg, color };
  }
  const anyButton = Object.keys(out.buttons).length > 0;
  if (out.mode === "buttons" && !out.image_url && !anyButton) return "";
  if (out.mode === "image" && !out.image_url && !anyButton) return "";
  return JSON.stringify(out);
}
export function parseProfileButtons(stored) {
  if (!stored) return null;
  const cleaned = cleanProfileButtons(stored);
  if (!cleaned) return null;
  try { return JSON.parse(cleaned); } catch { return null; }
}
export function cleanAshTracks(list) {
  const out = [];
  for (const t of (Array.isArray(list) ? list : [])) {
    const n = Number(t);
    if (Number.isInteger(n) && n >= 1 && n <= ASH_TRACKS.length && !out.includes(n)) out.push(n);
    if (out.length >= 5) break;
  }
  return out;
}
// Clean a seller/buyer custom-tag list: normalized, 2–24 chars, max 8.
export function cleanPrefTags(list) {
  const out = [];
  for (const t of (Array.isArray(list) ? list : [])) {
    const n = normalizeTag(t);
    if (n && n.length >= 2 && !out.includes(n)) out.push(n);
    if (out.length >= 8) break;
  }
  return out;
}

export async function shapeListing(db, row, seller) {
  const bids = await db.prepare("SELECT amount_cents FROM bids WHERE listing_id = ?").bind(row.id).all();
  const lb = bids.results || [];
  const current = lb.length ? Math.max(...lb.map((b) => b.amount_cents)) : null;
  const tv = await db.prepare("SELECT verdict FROM trade_votes WHERE listing_id = ?").bind(row.id).all();
  const votes = tv.results || [];
  const cc = await db.prepare("SELECT COUNT(*) AS n FROM listing_comments WHERE listing_id = ?").bind(row.id).first();
  const effective = current ?? row.price_cents;
  const fee = Math.round(effective * (PLATFORM_FEE_PERCENT / 100));
  return {
    id: row.id, title: row.title, description: row.description, price_cents: row.price_cents,
    category: row.category, kind: row.kind,
    image_url: imageUrl(row.image_blob_key), image2_url: imageUrl(row.image2_blob_key),
    image3_url: imageUrl(row.image3_blob_key), gif_url: row.gif_url ?? null,
    trade_wanted: row.trade_wanted ?? "", allow_comments: row.allow_comments === 1,
    verification_status: row.verification_status ?? "not_checked",
    verification_summary: row.verification_summary ?? "", status: row.status,
    seller_id: seller.id, seller_username: seller.username, seller_occupation: seller.occupation ?? "",
    seller_avatar_url: imageUrl(seller.avatar_blob_key),
    seller_payout_ready: !!(seller.payout_method && seller.payout_handle),
    current_bid_cents: current, bid_count: lb.length,
    trade_good: votes.filter((v) => v.verdict === "good").length,
    trade_fair: votes.filter((v) => v.verdict === "fair").length,
    trade_bad: votes.filter((v) => v.verdict === "bad").length,
    comment_count: cc?.n ?? 0,
    fee_cents: fee, seller_gets_cents: effective - fee,
    created_at: iso(row.created_at),
  };
}

export async function shapeOrder(db, row, profilesById) {
  const fee = Math.round((row.amount_cents * PLATFORM_FEE_PERCENT) / 100);
  const listing = await db.prepare("SELECT image_blob_key FROM listings WHERE id = ? LIMIT 1").bind(row.listing_id).first();
  return {
    id: row.id, listing_id: row.listing_id, item_title: row.item_title,
    amount_cents: row.amount_cents, status: row.status, carrier: row.carrier ?? "",
    tracking_number: row.tracking_number ?? "",
    tracking_url: trackingUrl(row.carrier, row.tracking_number),
    tracking_alerts: row.tracking_alerts === 1,
    fee_cents: fee, seller_gets_cents: row.amount_cents - fee,
    buyer_id: row.buyer_id, buyer_username: profilesById.get(row.buyer_id)?.username ?? "member",
    seller_id: row.seller_id, seller_username: profilesById.get(row.seller_id)?.username ?? "member",
    image_url: imageUrl(listing?.image_blob_key ?? null),
    created_at: iso(row.created_at), updated_at: iso(row.updated_at),
  };
}

export async function profilesMap(db) {
  const { results } = await db.prepare("SELECT id, username FROM profiles").all();
  return new Map((results || []).map((p) => [p.id, p]));
}
