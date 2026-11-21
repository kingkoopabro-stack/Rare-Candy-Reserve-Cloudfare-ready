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

export const CATEGORIES = ["General", "News", "Question", "Questions & Help", "Shop Talk", "Music", "Video", "Plants & Garden", "Tech & Builds", "Dank Meme", "Off Topic"];

// Group Up — Nerd Hub squad finder. Small 4-person gaming groups with an
// ephemeral text chat room and optional voice chat. Tables: squads,
// squad_members, squad_messages, squad_signals (groups-migration.sql).
// NOTE: these are NOT the Community Groups (functions/api/groups.js +
// the v3.6 groups/group_members tables) — different feature, different
// tables, so the two never collide.
export const SQUAD_PLATFORMS = ["Switch", "Switch 2", "PS4", "PS5", "PC", "Xbox One", "Retro gaming", "Stream", "Crossplay"];
export const SQUAD_PLAYTIMES = ["An hour or two", "A few hours", "Campaign length"];
export const SQUAD_PLAYTIME_MS = { "An hour or two": 2 * 3600 * 1000, "A few hours": 5 * 3600 * 1000, "Campaign length": 24 * 3600 * 1000 };
export const SQUAD_MAX_PLAYERS = 4;
export function squadExpiresAt(row) {
  const dur = SQUAD_PLAYTIME_MS[row.playtime] || SQUAD_PLAYTIME_MS["A few hours"];
  return Number(row.created_at || 0) + dur;
}
export function squadIsExpired(row, now) { return (now || Date.now()) > squadExpiresAt(row); }
// Public shape for a squad row + its members. Never leaks device ids or
// the private PIN (the PIN is only ever checked server-side, never sent).
export async function shapeSquad(db, row, meId) {
  const { results: members } = await db.prepare(
    `SELECT p.id, p.username FROM squad_members sm JOIN profiles p ON p.id = sm.profile_id WHERE sm.squad_id = ? ORDER BY sm.joined_at ASC`,
  ).bind(row.id).all();
  const creator = await db.prepare("SELECT username FROM profiles WHERE id = ? LIMIT 1").bind(row.creator_profile_id).first();
  const list = (members || []).map((m) => ({ id: m.id, username: m.username }));
  return {
    id: row.id, platform: row.platform, game: row.game, title: row.title,
    description: row.description ?? "", is_private: row.is_private === 1,
    playtime: row.playtime, max_players: row.max_players || SQUAD_MAX_PLAYERS,
    member_count: list.length, members: list,
    creator_id: row.creator_profile_id, creator_username: creator?.username ?? "member",
    created_at: iso(row.created_at), expires_at: iso(squadExpiresAt(row)),
    expired: squadIsExpired(row), is_member: meId ? list.some((m) => m.id === meId) : false,
    is_creator: meId ? row.creator_profile_id === meId : false,
  };
}

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
export const CREATOR_GENRES = ["Photos", "Videos", "Custom Content", "Audio", "3D Models", "3D Print Files", "Developer Files", "Designs", "Art", "Apps", "Game Assets", "Adult Content", "Video games", "Refurbished tech", "3D prints", "Car parts", "Collectibles", "Tutor work", "Other"];
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

// --- Notifications (v3.8) ------------------------------------------------
// createNotification inserts one row into the notifications table. It
// never throws and never notifies the actor about their own action, so a
// missing table (migration not run yet) can never break posting, liking,
// or messaging — the notification is just skipped.
export async function createNotification(db, n) {
  if (!db || !n || !n.profile_id) return;
  if (n.actor_profile_id && n.actor_profile_id === n.profile_id) return;
  try {
    await db.prepare(
      "INSERT INTO notifications (profile_id, actor_profile_id, kind, ref_type, ref_id, text, link, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
    ).bind(
      n.profile_id, n.actor_profile_id || null,
      String(n.kind || "comment").slice(0, 30),
      n.ref_type ? String(n.ref_type).slice(0, 30) : null,
      n.ref_id || null,
      String(n.text || "").slice(0, 200),
      n.link ? String(n.link).slice(0, 300) : null,
      nowMs(),
    ).run();
  } catch { /* notifications table not there yet — skip quietly */ }
}

// notifyMentions scans a body for @username mentions and notifies each
// matching profile (once each, never the author). Simple scan: @ followed
// by the username characters the signup form allows. Returns the set of
// profile ids that were notified, so callers can skip a second
// owner/author notification for someone the mention already covered.
export async function notifyMentions(db, actor, body, opts) {
  const notified = new Set();
  if (!db || !actor || !body) return notified;
  const names = [...new Set([...String(body).matchAll(/@([A-Za-z0-9_.-]{2,24})/g)].map((m) => m[1]))];
  if (!names.length) return notified;
  const o = opts || {};
  for (const name of names) {
    try {
      const target = await db.prepare("SELECT id, username FROM profiles WHERE username = ? COLLATE NOCASE LIMIT 1").bind(name).first();
      if (!target || target.id === actor.id) continue;
      await createNotification(db, {
        profile_id: target.id, actor_profile_id: actor.id, kind: "mention",
        ref_type: o.ref_type, ref_id: o.ref_id,
        text: `@${actor.username} mentioned you${o.label ? " " + o.label : ""}`,
        link: o.link,
      });
      notified.add(target.id);
    } catch { /* keep going — one bad lookup never blocks the rest */ }
  }
  return notified;
}

// notifyTeam notifies every OTHER team member (operator / admin / mod)
// with one high-priority "team" notification. The poster is never
// notified about their own message. kind "team" is the priority marker
// the bell and the Alerts app sort first — no schema change needed.
export async function notifyTeam(db, actor, text, link, refId) {
  if (!db || !actor) return 0;
  let rows = [];
  try {
    const { results } = await db.prepare(
      "SELECT id FROM profiles WHERE role IN ('operator', 'admin', 'mod') OR is_operator = 1",
    ).all();
    rows = results || [];
  } catch { return 0; /* profiles table not there yet */ }
  let n = 0;
  for (const r of rows) {
    if (!r || r.id === actor.id) continue;
    await createNotification(db, {
      profile_id: r.id, actor_profile_id: actor.id, kind: "team",
      ref_type: "team_chat", ref_id: refId || null,
      text: String(text || "").slice(0, 200), link: link || "#/team",
    });
    n++;
  }
  return n;
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

// Custom-page HTML sanitizer (v3.20) — website mode lets a member's own
// HTML BE their page, but scripts and iframes stay stripped (one
// person's script could steal another's login — a safety rule, not a
// missing feature). Allows a small set of plain layout/text tags; drops
// script/iframe/object/embed/form/input (with their contents); strips
// on* handlers + inline styles (all styling lives in the CSS box);
// kills javascript:/vbscript:/data: links; images keep only https:// or
// site-relative / sources. Returns clean HTML (max 8000 chars).
const CUSTOM_PAGE_TAGS = new Set(["div", "section", "article", "header", "footer", "nav", "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "img", "ul", "ol", "li", "span", "strong", "em", "b", "i", "u", "small", "br", "hr", "blockquote", "figure", "figcaption"]);
export function sanitizeCustomPageHtml(input) {
  var html = String(input || "").slice(0, 8000);
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  // Drop dangerous blocks WITH their contents (a lazy match on the
  // opening tag alone would leave a script's body behind).
  html = html.replace(/<(script|style|iframe|object|embed|form|textarea|select|button)[\s\S]*?<\/\1\s*>/gi, "");
  html = html.replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form|input|textarea|select|button|title)\b[^>]*>/gi, "");
  // Event handlers + inline styles go (styling lives in the CSS box).
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Links: kill javascript:/vbscript:/data: schemes. Images: keep only
  // https:// or site-relative / sources.
  html = html.replace(/href\s*=\s*"\s*(javascript|vbscript|data)\s*:[^"]*"/gi, 'href="#"');
  html = html.replace(/href\s*=\s*'\s*(javascript|vbscript|data)\s*:[^']*'/gi, "href='#'");
  html = html.replace(/href\s*=\s*(javascript|vbscript|data)\s*:[^\s>]*/gi, 'href="#"');
  html = html.replace(/src\s*=\s*"([^"]*)"/gi, function (_m, v) {
    var u = String(v || "").trim();
    return (/^https:\/\//i.test(u) || u.startsWith("/")) ? 'src="' + u.replace(/"/g, "") + '"' : 'src=""';
  });
  html = html.replace(/src\s*=\s*'([^']*)'/gi, function (_m, v) {
    var u = String(v || "").trim();
    return (/^https:\/\//i.test(u) || u.startsWith("/")) ? "src='" + u.replace(/'/g, "") + "'" : "src=''";
  });
  // Unwrap any tag not on the allowlist (keep its inner text).
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, function (m, tag) {
    return CUSTOM_PAGE_TAGS.has(tag.toLowerCase()) ? m : "";
  });
  return html.trim();
}

// Top Friends: stored as a comma-separated list of profile IDs, max 8.
export function parseTopFriendIds(stored) {
  if (!stored) return [];
  var out = [];
  for (const part of String(stored).split(",")) {
    const n = parseInt(part.trim(), 10);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
    if (out.length >= 10) break;
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
  const list = (ids || []).filter((n) => Number.isInteger(n) && n > 0).slice(0, 10);
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
    // v3.9 — website look: the five website fields + which ones show.
    // Columns may not exist yet (migration pending) — read defensively.
    website_mode: row.website_mode === 1,
    hobbies: row.hobbies ?? "",
    workplace: row.workplace ?? "",
    relationship_status: row.relationship_status ?? "",
    birthsign: row.birthsign ?? "",
    accomplishments: row.accomplishments ?? "",
    website_show: parseWebsiteShow(row.website_show),
    // Professional mode (2026-11-21) — contact email, shown on the
    // page only when the member opted in. Columns may not exist yet
    // (migration pending) — read defensively.
    contact_email: row.contact_email ?? "",
    show_contact_email: row.show_contact_email === 1,
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
    // v3.9 — website look (public): the five website fields + show flags.
    website_mode: row.website_mode === 1,
    hobbies: row.hobbies ?? "",
    workplace: row.workplace ?? "",
    relationship_status: row.relationship_status ?? "",
    birthsign: row.birthsign ?? "",
    accomplishments: row.accomplishments ?? "",
    website_show: parseWebsiteShow(row.website_show),
    // Professional mode (2026-11-21) — contact email, shown on the
    // page only when the member opted in. Columns may not exist yet
    // (migration pending) — read defensively.
    contact_email: row.contact_email ?? "",
    show_contact_email: row.show_contact_email === 1,
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

// --- Team moderation (v3.18): silence / mute --------------------------
// A silenced member cannot post or comment until muted_until passes.
// "permanent" is not a mute — it is the existing banned flag, and only
// the operator may set it. Durations are fixed keys so the client
// dropdown and the server can never disagree about what a label means.
// "3mo" is 90 days (calendar months vary — 90 days is the working
// definition, flagged for Chris to correct). "A few days" is 3 days
// (also Chris's call — flagged in the build log).
export const SILENCE_DURATIONS = [
  { key: "1d", label: "1 day", ms: 86400000 },
  { key: "3d", label: "A few days (3 days)", ms: 3 * 86400000 },
  { key: "1w", label: "1 week", ms: 7 * 86400000 },
  { key: "2w", label: "2 weeks", ms: 14 * 86400000 },
  { key: "6w", label: "6 weeks", ms: 42 * 86400000 },
  { key: "3mo", label: "3 months", ms: 90 * 86400000 },
  { key: "permanent", label: "Permanently", ms: null },
];
// Longest silence each role may hand out. Mods are capped at 1 week
// (PROPOSED default — Chris to correct); admins at 3 months; only the
// operator may go permanent. Server-enforced everywhere it matters.
export const SILENCE_MAX_BY_ROLE = { operator: "permanent", admin: "3mo", mod: "1w" };
export function canSilenceFor(role, key) {
  const order = SILENCE_DURATIONS.map((d) => d.key);
  const max = SILENCE_MAX_BY_ROLE[role] || null;
  if (!max) return false;
  return order.indexOf(key) >= 0 && order.indexOf(key) <= order.indexOf(max);
}
// Returns the plain-language block for a silenced member, or null when
// they are free to post. Reads muted_until/muted_reason off the profile
// row (profileByDevice does SELECT *, so the columns are simply absent
// — undefined, never a crash — when the migration hasn't run yet).
export function silenceCheck(me, now) {
  if (!me) return null;
  const until = Number(me.muted_until || 0);
  if (until && until > (now || Date.now())) {
    const when = new Date(until).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const reason = String(me.muted_reason || "").trim();
    return `You're silenced until ${when}${reason ? " — " + reason : ""}. You can't post or comment until then.`;
  }
  return null;
}
// Ban (v3.18) — a banned member can't post or comment at all. The ban flag
// is the permanent ban (operator-only); without this check a banned member
// who isn't also muted could still post, because silence and ban are separate.
export function bannedMemberCheck(me) {
  if (!me) return null;
  if (me.banned === 1) return "Your account is banned — you can't post or comment. If you think that's a mistake, contact the team.";
  return null;
}
// Admins (and the operator) may delete other people's posts/comments;
// mods may not. Server-enforced in the delete endpoints, never just UI.
export function canDeleteContent(role) {
  return role === "operator" || role === "admin";
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

// --- Feed redesign (v3.14): post visibility ---------------------------
// "public" = everyone (including guests). "friends" = only the author,
// their friends (either direction in the friends table — friendships are
// stored both ways), and the operator. Guests see public posts only.
// Used by the posts list, single-post view, and Headlines so a
// friends-only post never leaks to strangers through any listing.
export async function canSeePost(db, caller, post) {
  if ((post.visibility ?? "public") !== "friends") return true;
  if (!caller) return false;
  if (caller.id === post.profile_id) return true;
  if (caller.is_operator === 1) return true;
  return isFriendWith(db, post.profile_id, caller.id);
}
// Are two members friends (either direction)? Defensive: a missing
// friends table just reads as false, never a crash.
export async function isFriendWith(db, aId, bId) {
  try {
    const r = await db.prepare(
      "SELECT 1 AS n FROM friends WHERE (profile_id = ? AND friend_id = ?) OR (profile_id = ? AND friend_id = ?) LIMIT 1",
    ).bind(aId, bId, bId, aId).first();
    return !!r;
  } catch { return false; }
}
export async function filterVisiblePosts(db, caller, rows) {
  const out = [];
  for (const r of (rows || [])) if (await canSeePost(db, caller, r)) out.push(r);
  return out;
}

// --- Reactions (v3.15): heart + sad + confused ------------------------
// One reaction per person per target; tapping the same kind again takes
// it off, tapping another kind switches. Heart is the neon star; sad
// and confused are silent (no notification, no Lucre). Only hearts
// notify and pay the 5 Lucre, exactly as before.
// Posts live in post_reactions; every comment surface (thread, listing,
// profile-page, picture) lives in comment_reactions with a target_type
// so ids can't collide across the three comment tables. All helpers are
// defensive: a missing table reads as all zeros / null, so an un-run
// migration never crashes a fetch.
export const REACTION_KINDS = ["heart", "sad", "confused"];

export async function postReactionCounts(db, postId) {
  const out = { heart: 0, sad: 0, confused: 0 };
  try {
    const { results } = await db.prepare("SELECT kind, COUNT(*) AS n FROM post_reactions WHERE post_id = ? GROUP BY kind").bind(postId).all();
    for (const r of (results || [])) if (r.kind in out) out[r.kind] = Number(r.n || 0);
    // Legacy hearts (rows not yet copied by the migration) count too —
    // UNION keeps a copied heart from counting twice.
    try {
      const legacy = await db.prepare("SELECT COUNT(*) AS n FROM (SELECT profile_id FROM post_votes WHERE post_id = ? AND value = 1 UNION SELECT profile_id FROM post_reactions WHERE post_id = ? AND kind = 'heart')").bind(postId, postId).first();
      out.heart = Number(legacy?.n || 0);
    } catch { /* legacy table gone — new counts stand */ }
  } catch {
    // Reactions table not there yet — hearts the old way.
    try {
      const row = await db.prepare("SELECT COUNT(*) AS n FROM post_votes WHERE post_id = ? AND value = 1").bind(postId).first();
      out.heart = Number(row?.n || 0);
    } catch { /* nothing to count */ }
  }
  return out;
}

export async function commentReactionCounts(db, targetType, targetId) {
  const out = { heart: 0, sad: 0, confused: 0 };
  try {
    const { results } = await db.prepare("SELECT kind, COUNT(*) AS n FROM comment_reactions WHERE target_type = ? AND target_id = ? GROUP BY kind").bind(targetType, targetId).all();
    for (const r of (results || [])) if (r.kind in out) out[r.kind] = Number(r.n || 0);
    // Thread comments had a legacy heart table (comment_votes) — merge
    // it the same UNION way so a copied heart never counts twice.
    // Listing + profile comments never had votes, so nothing to merge.
    if (targetType === "post") {
      try {
        const legacy = await db.prepare("SELECT COUNT(*) AS n FROM (SELECT profile_id FROM comment_votes WHERE comment_id = ? AND value = 1 UNION SELECT profile_id FROM comment_reactions WHERE target_type = 'post' AND target_id = ? AND kind = 'heart')").bind(targetId, targetId).first();
        out.heart = Number(legacy?.n || 0);
      } catch { /* legacy table gone — new counts stand */ }
    }
  } catch {
    // Reactions table not there yet — thread hearts the old way.
    if (targetType === "post") {
      try {
        const row = await db.prepare("SELECT COUNT(*) AS n FROM comment_votes WHERE comment_id = ? AND value = 1").bind(targetId).first();
        out.heart = Number(row?.n || 0);
      } catch { /* nothing to count */ }
    }
  }
  return out;
}

// Toggle one member's reaction. Returns { counts, my_reaction } where
// my_reaction is the kind now held, or null when it was taken off.
// Returns null when the reactions table isn't there yet — the caller
// falls back to the legacy heart-only tables for hearts.
export async function togglePostReaction(db, me, postId, kind) {
  try {
    const existing = await db.prepare("SELECT kind FROM post_reactions WHERE post_id = ? AND profile_id = ? LIMIT 1").bind(postId, me.id).first();
    let my = null;
    if (existing && existing.kind === kind) {
      await db.prepare("DELETE FROM post_reactions WHERE post_id = ? AND profile_id = ?").bind(postId, me.id).run();
    } else if (existing) {
      await db.prepare("UPDATE post_reactions SET kind = ?, created_at = ? WHERE post_id = ? AND profile_id = ?").bind(kind, nowMs(), postId, me.id).run();
      my = kind;
    } else {
      await db.prepare("INSERT INTO post_reactions (post_id, profile_id, kind, created_at) VALUES (?, ?, ?, ?)").bind(postId, me.id, kind, nowMs()).run();
      my = kind;
    }
    return { counts: await postReactionCounts(db, postId), my_reaction: my };
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return null;
    throw e;
  }
}

export async function toggleCommentReaction(db, me, targetType, targetId, kind) {
  try {
    const existing = await db.prepare("SELECT kind FROM comment_reactions WHERE target_type = ? AND target_id = ? AND profile_id = ? LIMIT 1").bind(targetType, targetId, me.id).first();
    let my = null;
    if (existing && existing.kind === kind) {
      await db.prepare("DELETE FROM comment_reactions WHERE target_type = ? AND target_id = ? AND profile_id = ?").bind(targetType, targetId, me.id).run();
    } else if (existing) {
      await db.prepare("UPDATE comment_reactions SET kind = ?, created_at = ? WHERE target_type = ? AND target_id = ? AND profile_id = ?").bind(kind, nowMs(), targetType, targetId, me.id).run();
      my = kind;
    } else {
      await db.prepare("INSERT INTO comment_reactions (target_type, target_id, profile_id, kind, created_at) VALUES (?, ?, ?, ?, ?)").bind(targetType, targetId, me.id, kind, nowMs()).run();
      my = kind;
    }
    return { counts: await commentReactionCounts(db, targetType, targetId), my_reaction: my };
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return null;
    throw e;
  }
}

// Picture hearts (v3.16) — heart or nothing on actual pictures
// (profile picture + public gallery photos, as seen in the picture
// viewer). A picture is (owner_id, subject) where subject is "avatar"
// or "gallery:<id>" — the same key the picture comments use, so the
// heart always follows the same picture the comments do. One heart per
// person per picture, enforced by the primary key. No legacy table:
// pictures never had likes before, so a missing table just means the
// migration hasn't run yet — counts read as 0, never a crash.
export async function pictureHeartCounts(db, ownerId, subject) {
  try {
    const row = await db.prepare("SELECT COUNT(*) AS n FROM picture_hearts WHERE owner_id = ? AND subject = ?").bind(ownerId, subject).first();
    return Number(row?.n || 0);
  } catch { return 0; }
}

export async function pictureMyHeart(db, ownerId, subject, profileId) {
  if (!profileId) return false;
  try {
    const row = await db.prepare("SELECT 1 AS x FROM picture_hearts WHERE owner_id = ? AND subject = ? AND profile_id = ? LIMIT 1").bind(ownerId, subject, profileId).first();
    return !!row;
  } catch { return false; }
}

// Toggle one member's heart on a picture. Returns
// { hearts, my_heart } or null when the table isn't there yet.
export async function togglePictureHeart(db, me, ownerId, subject) {
  try {
    const existing = await db.prepare("SELECT 1 AS x FROM picture_hearts WHERE owner_id = ? AND subject = ? AND profile_id = ? LIMIT 1").bind(ownerId, subject, me.id).first();
    let myHeart;
    if (existing) {
      await db.prepare("DELETE FROM picture_hearts WHERE owner_id = ? AND subject = ? AND profile_id = ?").bind(ownerId, subject, me.id).run();
      myHeart = false;
    } else {
      await db.prepare("INSERT INTO picture_hearts (owner_id, subject, profile_id, created_at) VALUES (?, ?, ?, ?)").bind(ownerId, subject, me.id, nowMs()).run();
      myHeart = true;
    }
    return { hearts: await pictureHeartCounts(db, ownerId, subject), my_heart: myHeart };
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return null;
    throw e;
  }
}

export async function shapePost(db, row, author) {
  const rc = await postReactionCounts(db, row.id);
  const hearts = { n: rc.heart };
  const cc = await db.prepare("SELECT COUNT(*) AS n FROM comments WHERE post_id = ?").bind(row.id).first();
  const t = await authTally(db, row.id);
  // Feed redesign (v3.14) — edit count comes from the post_edits log
  // (0 when the migration hasn't run yet — never a crash).
  let editCount = 0;
  try {
    const ec = await db.prepare("SELECT COUNT(*) AS n FROM post_edits WHERE post_id = ?").bind(row.id).first();
    editCount = Number(ec?.n || 0);
  } catch { editCount = 0; }
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
    author_badges: author.badges || [],
    score: hearts?.n ?? 0, comment_count: cc?.n ?? 0,
    // Reactions (v3.15) — heart + sad + confused on every post.
    // score stays the heart count (the "top" sort still ranks by it).
    sad: rc.sad, confused: rc.confused,
    // Feed redesign (v3.14) — visibility + edit count (3-edit limit).
    visibility: row.visibility ?? "public",
    edit_count: editCount,
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
    // Event posts — date/time/place (empty until the migration runs).
    event_date: row.event_date ?? "", event_time: row.event_time ?? "", event_place: row.event_place ?? "",
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
// My links (v3.4, button system v3.12) — stored as JSON
// [{label, url, style}] in profiles.my_links. Label 1–40 chars, URL
// must start with http:// or https://, max 6. style is one of the
// button-style ids ("" = the page's own button look); anything else
// falls back to "". Bad rows are dropped, never stored; a bad stored
// value parses to [].
export function cleanMyLinks(list) {
  const out = [];
  for (const item of (Array.isArray(list) ? list : [])) {
    const label = String((item && item.label) || "").trim().slice(0, 40);
    const url = String((item && item.url) || "").trim().slice(0, 500);
    if (!label || !/^https?:\/\//i.test(url)) continue;
    if (out.some((l) => l.url === url)) continue;
    const style = BUTTON_STYLE_IDS.includes(item && item.style) ? item.style : "";
    out.push({ label, url, style });
    if (out.length >= 6) break;
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
// accent_color, font, name_font}. Every value is validated here, so the CSS the
// frontend builds from it can never carry a script, an @import, or a
// non-https image — same rules as sanitizeLayoutCss, enforced by
// construction: colors must be #rrggbb, the background image must be
// https://, and the font must be one of the fixed allowlisted stacks.
// Profile fonts (v3.13) — TWO picks sharing one allowlist: `font` is the
// page text font, `name_font` is the display-name font. The list is the
// fixed allowlist: 5 system stacks kept for back-compat ("" / serif /
// typewriter / comic / rounded) + 9 webfonts (4 elegant, 5 cool). The
// client map (community.js THEME_FONTS) carries the matching stacks and
// Google family params — the two lists must stay in sync (the smoke test
// checks it). Webfonts load only from that map, never from user input.
export const THEME_FONTS = ["", "serif", "typewriter", "comic", "rounded", "playfair", "cormorant", "vibes", "cinzel", "orbitron", "bangers", "pressstart", "monoton", "creepster"];
export const BUTTON_STYLE_IDS = ["", "neon", "arcade", "gradient", "rounded", "retro", "gold", "ghost", "insert-coin"];
// Taffy Layout Builder vibes (v3.10) — one of the fixed vibe ids, or "".
export const VIBE_IDS = ["", "neon", "midnight", "candy", "classic", "forest", "sunset", "ocean", "bubblegum", "gold", "dark"];
export const MYSPACE_EFFECT_IDS = ["animated-bg", "sparkle", "marquee", "glow-text", "sparkle-name", "sparkle-banner", "ticker-effect", "rgb-comment-border"];
// Profile customization (v3.9) — preset backgrounds, picture size /
// position / frame, comment-picture border color. All live in the theme
// JSON (validated by parseTheme, same as the other theme fields).
export const PRESET_BG_IDS = ["", "vaporwave", "rgb-gradient", "midnight-neon", "sunset-drive", "cotton-candy", "blackout"];
export const PIC_SIZE_IDS = ["bigger", "smaller"];
export const PIC_POSITION_IDS = ["normal", "top"];
export const PIC_FRAME_IDS = ["none", "neon", "rgb", "rgb-rotating", "gold", "black", "wooden", "gothic", "blood", "gb", "gba", "vita-nova"];
export const GB_FRAME_MODES = ["", "gamecube", "gb", "gba", "custom"];
// Zodiac signs for the website-look "Sign" field (id, symbol, name).
export const ZODIAC_IDS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
export const RELATIONSHIP_IDS = ["", "Single", "In a relationship", "It's complicated", "Prefer not to say"];
// --- Frame unlocks (v3.9) -----------------------------------------------
// Picture frames unlock with engagement + daily usage. The registry is
// the single source of truth — add a row here (and a frame id below) to
// unlock more things later; nothing else is hard-coded to frames.
// kind: which count the threshold reads. "posts_days" needs both
// threshold (posts) and threshold2 (days).
export const FRAME_IDS = ["none", "neon", "rgb", "rgb-rotating", "gold", "black", "wooden", "gothic", "blood", "gb", "gba", "vita-nova"];
export const FREE_FRAMES = ["none", "neon", "rgb", "gold", "black"];
export const FRAME_UNLOCK_KEY = {
  "rgb-rotating": "frame-rgb-rotating", "wooden": "frame-wooden",
  "gothic": "frame-gothic", "blood": "frame-blood",
  "gb": "frame-gb", "gba": "frame-gba",
  "vita-nova": "frame-vita-nova",
};
export const UNLOCKS = [
  { key: "frame-rgb-rotating", label: "RGB Rotating frame", requirement: "Use the site 7 different days", kind: "days", threshold: 7 },
  { key: "frame-wooden", label: "Wooden frame", requirement: "Post 10 times", kind: "posts", threshold: 10 },
  { key: "frame-gothic", label: "Gothic frame", requirement: "Leave 25 comments", kind: "comments", threshold: 25 },
  { key: "frame-blood", label: "Blood dripping frame", requirement: "Give or get 25 hearts", kind: "hearts", threshold: 25 },
  { key: "frame-gb", label: "GB frame", requirement: "Post 25 times", kind: "posts", threshold: 25 },
  { key: "frame-gba", label: "GBA frame", requirement: "Post 50 times and use the site 14 different days", kind: "posts_days", threshold: 50, threshold2: 14 },
  { key: "frame-vita-nova", label: "VITA NOVA frame", requirement: "Fully set up your profile", kind: "profile_complete", threshold: 1 },
];
// --- Dividers (v3.20) -------------------------------------------------------
// The line between Top Friends and Page comments on a member page.
// Free designs are always pickable; locked ones need the unlock key
// (Lucre purchase or achievement — the purchase flow isn't built yet,
// so locked designs are listed but not selectable). The registry is the
// single source of truth — the client renders the same ids.
export const DIVIDER_IDS = ["line", "dots", "double", "stars", "goldswirl", "neonwave", "hearts"];
export const FREE_DIVIDERS = ["line", "dots", "double", "stars", "goldswirl"];
export const DIVIDER_UNLOCK_KEY = {
  "neonwave": "divider:neonwave",
  "hearts": "divider:hearts",
};
export function unlockForDivider(dividerId) {
  return DIVIDER_UNLOCK_KEY[dividerId] || null;
}
export function isFreeDivider(dividerId) {
  return FREE_DIVIDERS.includes(dividerId);
}
// --- Badges (v3.9) ---------------------------------------------------------
// Achievement badges live in the SAME profile_unlocks table as frames
// (badge keys are prefixed "badge:" so they never collide with frame
// keys). They are granted by the same grantUnlocks() pass — add a row
// here and the badge is earned, stored, and shown everywhere names
// appear. kind: which count the threshold reads. "sales" counts completed
// orders (status paid/shipped/delivered) where the member is the seller.
// "member_days" counts days since the profile was created. "verified"
// is earned by being age-verified (age_verified = 1). "granted" is NEVER
// auto-earned — it only exists when the shop grants it (D1 INSERT into
// profile_unlocks), so real press/journalists can earn the same badge
// later without any code change. Reporter sits FIRST in this list on
// purpose: displayBadgesFor() falls back to the first earned badge when
// a member hasn't picked a display badge, so a Reporter always shows
// their press badge by default (they can still pick a different one).
export const BADGES = [
  { key: "badge:reporter", icon: "📰", label: "Reporter", requirement: "Granted by the shop — posts news for the community", kind: "granted", threshold: 0 },
  { key: "badge:first-post", icon: "📝", label: "First Post", requirement: "Post your first post", kind: "posts", threshold: 1 },
  { key: "badge:first-comment", icon: "💬", label: "First Comment", requirement: "Leave your first comment", kind: "comments", threshold: 1 },
  { key: "badge:comments-25", icon: "🗨️", label: "Chatty", requirement: "Leave 25 comments", kind: "comments", threshold: 25 },
  { key: "badge:hearts-25", icon: "❤️", label: "Well Loved", requirement: "Give or get 25 hearts", kind: "hearts", threshold: 25 },
  { key: "badge:streak-7", icon: "🔥", label: "7-Day Streak", requirement: "Use the site 7 different days", kind: "days", threshold: 7 },
  { key: "badge:first-sale", icon: "💰", label: "First Sale", requirement: "Make your first sale", kind: "sales", threshold: 1 },
  { key: "badge:sales-5", icon: "🛍️", label: "Regular Seller", requirement: "Make 5 sales", kind: "sales", threshold: 5 },
  { key: "badge:sales-10", icon: "🏆", label: "10 Sales", requirement: "Make 10 sales", kind: "sales", threshold: 10 },
  { key: "badge:member-7d", icon: "🌱", label: "First Week", requirement: "Be a member for 7 days", kind: "member_days", threshold: 7 },
  { key: "badge:member-1mo", icon: "📅", label: "1 Month", requirement: "Be a member for 1 month", kind: "member_days", threshold: 30 },
  { key: "badge:member-3mo", icon: "📆", label: "3 Months", requirement: "Be a member for 3 months", kind: "member_days", threshold: 90 },
  { key: "badge:member-6mo", icon: "🗓️", label: "6 Months", requirement: "Be a member for 6 months", kind: "member_days", threshold: 180 },
  { key: "badge:member-1yr", icon: "🎂", label: "1 Year", requirement: "Be a member for 1 year", kind: "member_days", threshold: 365 },
  { key: "badge:adult-approved", icon: "🔞", label: "Adult Approved", requirement: "Get approved for adult content", kind: "verified", threshold: 1 },
  { key: "badge:rcr-candy", icon: "🍬", label: "Rare Candy", requirement: "Fully set up your profile", kind: "profile_complete", threshold: 1 },
];
export const BADGE_KEYS = BADGES.map((b) => b.key);
export function badgeByKey(key) {
  return BADGES.find((b) => b.key === key) || null;
}
// Full badge list with an earned flag for a member's unlocked keys.
// Used by Edit Profile ("Badge display") and the phone Badges view.
export function badgeListFor(unlockedKeys) {
  const have = new Set(unlockedKeys || []);
  return BADGES.map((b) => ({ key: b.key, icon: b.icon, label: b.label, requirement: b.requirement, earned: have.has(b.key) }));
}
// An "adult content seller" is a member who sells adult content: they
// ticked the "Adult Content" seller type, or they have an adult creator
// post (kind=adult, is_creator=1). Used for the mandatory 18+ display
// badge and for the profile-page age gate.
export async function adultCreatorIds(db, profileIds) {
  const out = new Set();
  if (!profileIds || !profileIds.length) return out;
  try {
    const ph = profileIds.map(() => "?").join(",");
    const { results } = await db.prepare(
      `SELECT id, seller_types FROM profiles WHERE id IN (${ph})`,
    ).bind(...profileIds).all();
    for (const r of (results || [])) {
      if (parsePrefs(r.seller_types).includes("Adult Content")) out.add(r.id);
    }
    const { results: posts } = await db.prepare(
      `SELECT DISTINCT profile_id FROM posts WHERE profile_id IN (${ph}) AND kind = 'adult' AND is_creator = 1`,
    ).bind(...profileIds).all();
    for (const r of (posts || [])) out.add(r.profile_id);
  } catch { /* tables not there yet — nobody counts as an adult seller */ }
  return out;
}
// Which badges show next to a member's name (the display rule):
// default ONE chosen badge; adult sellers ALWAYS show the 18+ badge
// plus ONE chosen badge; regular sellers who display Regular Seller may
// add ONE optional secondary badge. An adult seller who is also a
// regular seller follows the adult rule (never three). storedDisplay is
// the member's chosen display_badges from their theme (may be empty);
// unlockedKeys are their earned badge keys. Returns 1–2 badge objects.
export function displayBadgesFor(unlockedKeys, storedDisplay, isAdultSeller, isRegularSeller) {
  const have = new Set(unlockedKeys || []);
  const earned = BADGES.filter((b) => have.has(b.key));
  const chosen = (Array.isArray(storedDisplay) ? storedDisplay : [])
    .map((k) => badgeByKey(k)).filter((b) => b && have.has(b.key));
  const first = earned[0] || null;
  if (isAdultSeller) {
    const adult = badgeByKey("badge:adult-approved");
    if (!have.has("badge:adult-approved")) return first ? [first] : [];
    const other = chosen.find((b) => b.key !== "badge:adult-approved") || earned.find((b) => b.key !== "badge:adult-approved") || null;
    return other ? [adult, other] : [adult];
  }
  if (isRegularSeller && chosen[0] && chosen[0].key === "badge:sales-5") {
    const second = chosen[1] || earned.find((b) => b.key !== "badge:sales-5") || null;
    return second ? [chosen[0], second] : [chosen[0]];
  }
  if (chosen[0]) return [chosen[0]];
  return first ? [first] : [];
}
// Validate a submitted display_badges array against the slot rules and
// the member's earned badges. Repairs instead of rejecting: an adult
// seller always keeps the 18+ badge in slot 1; a non-seller keeps at
// most one badge; a regular seller keeps Regular Seller + at most one
// more. Returns the repaired array (0–2 keys).
export function cleanDisplayBadges(input, unlockedKeys, isAdultSeller, isRegularSeller) {
  const have = new Set(unlockedKeys || []);
  const picked = (Array.isArray(input) ? input : [])
    .map((k) => String(k || "")).filter((k) => BADGE_KEYS.includes(k) && have.has(k));
  const dedup = [...new Set(picked)];
  if (isAdultSeller) {
    if (!have.has("badge:adult-approved")) return dedup.slice(0, 1);
    const other = dedup.find((k) => k !== "badge:adult-approved") || null;
    return other ? ["badge:adult-approved", other] : ["badge:adult-approved"];
  }
  if (isRegularSeller && dedup[0] === "badge:sales-5") {
    return dedup.slice(0, 2);
  }
  return dedup.slice(0, 1);
}
// Batch badge lookup for author lists (posts, comments, chat): returns a
// Map(profileId → [badge objects]) of DISPLAY badges only, per the
// display rule above. Defensive: a missing table just yields empty lists.
export async function badgesForProfiles(db, profileIds) {
  const out = new Map();
  const ids = [...new Set((profileIds || []).filter((n) => Number(n) > 0))];
  if (!ids.length) return out;
  for (const id of ids) out.set(id, []);
  try {
    const ph = ids.map(() => "?").join(",");
    const { results: rows } = await db.prepare(
      `SELECT id, profile_theme, seller_types FROM profiles WHERE id IN (${ph})`,
    ).bind(...ids).all();
    const { results: unlockRows } = await db.prepare(
      `SELECT profile_id, unlock_key FROM profile_unlocks WHERE profile_id IN (${ph})`,
    ).bind(...ids).all();
    const unlockedById = new Map();
    for (const r of (unlockRows || [])) {
      if (!unlockedById.has(r.profile_id)) unlockedById.set(r.profile_id, []);
      unlockedById.get(r.profile_id).push(r.unlock_key);
    }
    const adultIds = await adultCreatorIds(db, ids);
    for (const r of (rows || [])) {
      const unlocked = unlockedById.get(r.id) || [];
      const stored = parseTheme(r.profile_theme).display_badges;
      const isRegular = unlocked.includes("badge:sales-5");
      out.set(r.id, displayBadgesFor(unlocked, stored, adultIds.has(r.id), isRegular));
    }
  } catch { /* tables not there yet — empty badge lists */ }
  return out;
}
export function unlockForFrame(frameId) {
  return FRAME_UNLOCK_KEY[frameId] || null;
}
export function isFreeFrame(frameId) {
  return FREE_FRAMES.includes(frameId);
}
// Daily usage — one row per profile per UTC calendar day. Recorded when
// a signed-in profile loads the community (the profile GET). INSERT OR
// IGNORE makes it a no-op when the day is already recorded.
export async function recordActivityDay(db, profileId) {
  if (!profileId) return;
  const day = new Date().toISOString().slice(0, 10);
  try {
    await db.prepare("INSERT OR IGNORE INTO profile_activity_days (profile_id, day) VALUES (?, ?)").bind(profileId, day).run();
  } catch { /* table not there yet — migration pending */ }
}
// Count the engagement a member has earned. Every count is defensive:
// a missing table just reads as 0, so unlocks never crash a fetch.
export async function computeUnlockCounts(db, profileId) {
  const counts = { posts: 0, comments: 0, hearts: 0, days: 0, sales: 0, memberDays: 0, verified: 0, profile_complete: 0 };
  const count = async (sql, ...binds) => {
    try {
      const r = await db.prepare(sql).bind(...binds).first();
      return Number(r?.n || 0);
    } catch { return 0; }
  };
  counts.posts = await count("SELECT COUNT(*) AS n FROM posts WHERE profile_id = ?", profileId);
  const pageComments = await count("SELECT COUNT(*) AS n FROM profile_comments WHERE author_id = ?", profileId);
  const postComments = await count("SELECT COUNT(*) AS n FROM comments WHERE profile_id = ?", profileId);
  counts.comments = pageComments + postComments;
  // Hearts (v3.15) — read from the reaction tables. The migration
  // copies every legacy heart row into them first, so new-only counts
  // are exact once it has run. Before that the tables are missing and
  // these read 0 (grants are insert-only, so nothing already earned is
  // ever lost — new heart badges just wait for the migration).
  const heartsGiven = (await count("SELECT COUNT(*) AS n FROM post_reactions WHERE profile_id = ? AND kind = 'heart'", profileId))
    + (await count("SELECT COUNT(*) AS n FROM comment_reactions WHERE profile_id = ? AND kind = 'heart'", profileId));
  const heartsOnPosts = await count("SELECT COUNT(*) AS n FROM post_reactions pr JOIN posts p ON p.id = pr.post_id WHERE p.profile_id = ? AND pr.kind = 'heart'", profileId);
  const heartsOnComments = await count("SELECT COUNT(*) AS n FROM comment_reactions cr JOIN comments c ON c.id = cr.target_id WHERE cr.target_type = 'post' AND c.profile_id = ? AND cr.kind = 'heart'", profileId);
  counts.hearts = heartsGiven + heartsOnPosts + heartsOnComments;
  counts.days = await count("SELECT COUNT(*) AS n FROM profile_activity_days WHERE profile_id = ?", profileId);
  // Completed sales: orders where this member is the seller and the
  // order reached paid/shipped/delivered. "Regular Seller" is 5 sales.
  counts.sales = await count("SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND status IN ('paid', 'shipped', 'delivered')", profileId);
  // Membership age + age verification come from the profile row itself.
  // "Fully set up" (v3.11) — avatar + bio + occupation + at least one
  // link + at least one Top Friend. Unlocks the VITA NOVA frame and the
  // RCR rare-candy badge, and pays 10 Lucre (awarded on profile save).
  try {
    const row = await db.prepare("SELECT age_verified, created_at, avatar_blob_key, bio, occupation, my_links, top_friends FROM profiles WHERE id = ? LIMIT 1").bind(profileId).first();
    if (row) {
      counts.verified = row.age_verified === 1 ? 1 : 0;
      const created = Number(row.created_at || 0);
      counts.memberDays = created > 0 ? Math.max(0, Math.floor((nowMs() - created) / 86400000)) : 0;
      let links = 0;
      try { const parsed = JSON.parse(row.my_links || "[]"); if (Array.isArray(parsed)) links = parsed.filter((l) => l && l.url).length; } catch { links = 0; }
      const friends = String(row.top_friends || "").split(",").map((s) => s.trim()).filter(Boolean).length;
      counts.profile_complete = (row.avatar_blob_key && String(row.bio || "").trim() && String(row.occupation || "").trim() && links >= 1 && friends >= 1) ? 1 : 0;
    }
  } catch { /* profile row unreadable — member badges stay unearned */ }
  return counts;
}
function unlockEarned(unlock, counts) {
  if (unlock.kind === "days") return counts.days >= unlock.threshold;
  if (unlock.kind === "posts") return counts.posts >= unlock.threshold;
  if (unlock.kind === "comments") return counts.comments >= unlock.threshold;
  if (unlock.kind === "hearts") return counts.hearts >= unlock.threshold;
  if (unlock.kind === "posts_days") return counts.posts >= unlock.threshold && counts.days >= (unlock.threshold2 || 0);
  if (unlock.kind === "sales") return counts.sales >= unlock.threshold;
  if (unlock.kind === "member_days") return counts.memberDays >= unlock.threshold;
  if (unlock.kind === "verified") return counts.verified >= 1;
  if (unlock.kind === "profile_complete") return (counts.profile_complete || 0) >= 1;
  return false;
}
// Compute what's earned, insert any newly-earned rows, and return the
// full unlocked key list for the profile (stored + just earned). Frames
// and badges share this pass — UNLOCKS and BADGES are checked together.
export async function grantUnlocks(db, profileId) {
  if (!profileId) return [];
  const counts = await computeUnlockCounts(db, profileId);
  let stored = [];
  try {
    const r = await db.prepare("SELECT unlock_key FROM profile_unlocks WHERE profile_id = ?").bind(profileId).all();
    stored = (r.results || []).map((x) => x.unlock_key);
  } catch { stored = []; /* table not there yet */ }
  const have = new Set(stored);
  for (const u of [...UNLOCKS, ...BADGES]) {
    if (!have.has(u.key) && unlockEarned(u, counts)) {
      try {
        await db.prepare("INSERT OR IGNORE INTO profile_unlocks (profile_id, unlock_key, unlocked_at) VALUES (?, ?, ?)").bind(profileId, u.key, nowMs()).run();
        have.add(u.key);
      } catch { /* table not there yet */ }
    }
  }
  return { unlocked: [...have], counts };
}
// --- Lucre (v3.11) -------------------------------------------------------
// The site-only currency. Lucre is NOT real money, NOT crypto, and NOT
// redeemable for cash — it only buys layouts and frames in Taffy's
// Layout Store. Every balance lives server-side in the lucre_ledger;
// the client never sends a balance, it only triggers actions, and the
// server computes what was earned. Every award is one row per
// (profile, reason, ref) — the UNIQUE index makes double-crediting
// impossible even if an action is retried or double-tapped. All helpers
// are defensive: a missing table reads as 0 / no award, never a crash.
export const LUCRE_SYMBOL = "◈";
export const LUCRE_AWARDS = {
  post: 10, listing: 10, profile: 10, comment: 10, heart: 5,
  transaction: 40, suggestion: 40, friend: 5, favorite: 5, share: 5,
  song: 10, radio_first: 10, profile_complete: 10, checkin: 5, checkin_bonus: 50,
};
// Priced Layout Store items (server-side source of truth for purchase —
// the client catalog must match these ids and prices; the client never
// sends a price). Free layouts (price 0) are not listed here.
export const LUCRE_STORE_PRICES = {
  "store:neon-rain": 20,
  "store:golden-shrine": 20,
  "store:shopfront": 20,
  "store:band-stand": 20,
  "store:portfolio": 20,
};
export const LUCRE_CHECKIN_BONUS_STREAK = 7; // 7th consecutive weekly check-in pays the bonus
export const LUCRE_CHECKIN_MIN_MS = 7 * 86400000; // one check-in per week, rolling 7-day window
export const LUCRE_CHECKIN_STREAK_MS = 14 * 86400000; // check in within 14 days to keep the streak

export async function lucreBalance(db, profileId) {
  if (!profileId) return 0;
  try {
    const r = await db.prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM lucre_ledger WHERE profile_id = ?").bind(profileId).first();
    return Number(r?.n || 0);
  } catch { return 0; }
}
// Award Lucre once for one action. Returns { awarded, balance } —
// awarded is false when this exact (reason, ref) was already paid or
// the ledger table isn't there yet. Never throws.
export async function awardLucre(db, profileId, amount, reason, refId) {
  if (!profileId || !Number.isFinite(amount) || amount === 0) return { awarded: false, balance: await lucreBalance(db, profileId) };
  const ref = String(refId ?? "");
  try {
    const r = await db.prepare(
      "INSERT OR IGNORE INTO lucre_ledger (profile_id, amount, reason, ref_id, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(profileId, Math.round(amount), String(reason).slice(0, 40), ref.slice(0, 120), nowMs()).run();
    const awarded = Number(r?.meta?.changes || 0) > 0;
    return { awarded, balance: await lucreBalance(db, profileId) };
  } catch { return { awarded: false, balance: await lucreBalance(db, profileId) }; }
}
export async function lucreLedger(db, profileId, limit = 20) {
  if (!profileId) return [];
  try {
    const { results } = await db.prepare(
      "SELECT amount, reason, ref_id, created_at FROM lucre_ledger WHERE profile_id = ? ORDER BY id DESC LIMIT ?",
    ).bind(profileId, Math.max(1, Math.min(limit, 50))).all();
    return (results || []).map((e) => ({ amount: e.amount, reason: e.reason, ref_id: e.ref_id ?? "", created_at: iso(e.created_at) }));
  } catch { return []; }
}
export async function lucreOwned(db, profileId) {
  if (!profileId) return [];
  try {
    const { results } = await db.prepare("SELECT item_id FROM lucre_owned WHERE profile_id = ?").bind(profileId).all();
    return (results || []).map((r) => r.item_id);
  } catch { return []; }
}
// Weekly check-in state. A check-in is allowed once per rolling 7 days.
// The streak counts consecutive weekly check-ins; a gap over 14 days
// resets it. The 7th consecutive check-in pays the 50 Lucre bonus and
// the streak starts over.
export async function lucreCheckinState(db, profileId) {
  const empty = { streak: 0, total_checkins: 0, last_checkin_at: 0, can_check_in: true, next_checkin_at: 0, bonus_at_streak: LUCRE_CHECKIN_BONUS_STREAK };
  if (!profileId) return empty;
  try {
    const row = await db.prepare("SELECT streak, total_checkins, last_checkin_at FROM lucre_checkins WHERE profile_id = ? LIMIT 1").bind(profileId).first();
    if (!row) return empty;
    const last = Number(row.last_checkin_at || 0);
    const can = last === 0 || (nowMs() - last) >= LUCRE_CHECKIN_MIN_MS;
    return {
      streak: Number(row.streak || 0), total_checkins: Number(row.total_checkins || 0), last_checkin_at: last,
      can_check_in: can, next_checkin_at: can ? 0 : last + LUCRE_CHECKIN_MIN_MS,
      bonus_at_streak: LUCRE_CHECKIN_BONUS_STREAK,
    };
  } catch { return empty; }
}
export async function lucreDoCheckin(db, profileId) {
  const state = await lucreCheckinState(db, profileId);
  if (!state.can_check_in) return { ok: false, error: "Already checked in this week — come back after 7 days.", state };
  const now = nowMs();
  let streak = 1;
  if (state.last_checkin_at > 0 && (now - state.last_checkin_at) <= LUCRE_CHECKIN_STREAK_MS) streak = state.streak + 1;
  const paysBonus = streak >= LUCRE_CHECKIN_BONUS_STREAK;
  const newStreak = paysBonus ? 0 : streak;
  try {
    await db.prepare(
      "INSERT INTO lucre_checkins (profile_id, streak, total_checkins, last_checkin_at) VALUES (?, ?, 1, ?) ON CONFLICT(profile_id) DO UPDATE SET streak = excluded.streak, total_checkins = total_checkins + 1, last_checkin_at = excluded.last_checkin_at",
    ).bind(profileId, newStreak, now).run();
  } catch { return { ok: false, error: "Check-ins aren't switched on yet — the shop is still running a quick database update. Try again later.", state }; }
  const base = await awardLucre(db, profileId, LUCRE_AWARDS.checkin, "checkin", String(Math.floor(now / LUCRE_CHECKIN_MIN_MS)));
  let bonus = { awarded: false, balance: base.balance };
  // Bonus ref includes the week number, so the next 7-week cycle pays
  // again — a bare "streak-7" ref would collide and block it forever.
  if (paysBonus) bonus = await awardLucre(db, profileId, LUCRE_AWARDS.checkin_bonus, "checkin_bonus", "streak-" + streak + ":" + String(Math.floor(now / LUCRE_CHECKIN_MIN_MS)));
  return { ok: true, error: null, streak: newStreak, bonus_paid: paysBonus, awarded: base.awarded, balance: bonus.balance, state: await lucreCheckinState(db, profileId) };
}
// Website-look "show" flags — which of the five website fields display.
// Stored as a JSON blob; cleanWebsiteShow keeps only known keys as 0/1.
export function parseWebsiteShow(stored) {
  const empty = { hobbies: 0, workplace: 0, relationship: 0, sign: 0, accomplishments: 0 };
  if (!stored) return empty;
  let obj;
  try { obj = typeof stored === "string" ? JSON.parse(stored) : stored; } catch { return empty; }
  if (!obj || typeof obj !== "object") return empty;
  const out = { ...empty };
  for (const k of Object.keys(empty)) out[k] = obj[k] === 1 || obj[k] === true ? 1 : 0;
  return out;
}
export function cleanWebsiteShow(input) {
  return JSON.stringify(parseWebsiteShow(input));
}
export const SECTION_HIDE_IDS = ["top8", "links", "seller", "about", "comments", "radio", "video", "relationship", "occupation", "listings"];
const YOUTUBE_ID_RE = /(?:youtube\.com\/(?:watch\?[^#\s]*?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
export function extractYouTubeId(str) {
  if (!str) return "";
  const m = String(str).match(YOUTUBE_ID_RE);
  return m ? m[1] : "";
}
export function parseTheme(stored) {
  const empty = { bg_color: "", bg_image_url: "", text_color: "", accent_color: "", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", vibe: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", gb_mode: "", gb_colors: [], display_badges: [], buttons_side: "", buttons_show: true, button_size: "", buttons_visible: null, pro_button_side: "", pro_button_color: "", video_url: "", video_file_url: "", ticker_source: "", hide_sections: [], topfriends_count: 8, topfriends_side: "", feed_privacy: "public", divider: "", divider_color: "", divider_unlocks: [], website_buttons: false, custom_page_html: "" };
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
  // Display-name font (v3.13) — same allowlist as the page text font.
  // `font` stays the page text font, so existing profiles keep their pick.
  out.name_font = THEME_FONTS.includes(obj.name_font) ? obj.name_font : "";
  // Font glow (v3.19) — checkbox + two hex colors; rides in the theme
  // JSON, so no migration. Colors are hex-validated; empty = not picked.
  out.glow = obj.glow === true;
  out.glow_color = hex(obj.glow_color);
  out.outline_color = hex(obj.outline_color);
  out.button_style = BUTTON_STYLE_IDS.includes(obj.button_style) ? obj.button_style : "";
  // Vibe (v3.10) — a full look, one of the fixed ids.
  out.vibe = VIBE_IDS.includes(String(obj.vibe || "")) ? String(obj.vibe || "") : "";
  out.button_css = sanitizeLayoutCss(String(obj.button_css || "")).slice(0, 4000);
  const eff = Array.isArray(obj.effects) ? obj.effects : [];
  out.effects = eff.filter((e) => MYSPACE_EFFECT_IDS.includes(e)).slice(0, 8);
  // Preset background (v3.9) — one of the fixed preset ids, or "" for none.
  out.bg_preset = PRESET_BG_IDS.includes(String(obj.bg_preset || "")) ? String(obj.bg_preset || "") : "";
  // Background choices are either/or (v3.20): a custom picture and a
  // preset can never both be on — the picture wins, so a preset can
  // never silently sit on top of it again. The form enforces the same
  // rule live; this is the backstop for stale or forged saves.
  if (out.bg_image_url) out.bg_preset = "";
  // Comment-picture border color (v3.9) — any #rrggbb the member picks.
  // Mutually exclusive with the RGB comment-border effect: the RGB
  // effect wins when both are set, so the saved color is dropped.
  out.comment_border_color = hex(obj.comment_border_color);
  if (out.effects.includes("rgb-comment-border")) out.comment_border_color = "";
  // Animated rainbow background (v3.20) — the effect IS the background,
  // so it wins over a picture or a preset. The form says so when the
  // effect is ticked; this is the backstop for stale or forged saves.
  if (out.effects.includes("animated-bg")) { out.bg_preset = ""; out.bg_image_url = ""; }
  // Picture size / position / frame (v3.9) — fixed ids, "" = default.
  out.pic_size = PIC_SIZE_IDS.includes(String(obj.pic_size || "")) ? String(obj.pic_size) : "";
  out.pic_position = PIC_POSITION_IDS.includes(String(obj.pic_position || "")) ? String(obj.pic_position) : "";
  out.pic_frame = PIC_FRAME_IDS.includes(String(obj.pic_frame || "")) ? String(obj.pic_frame) : "";
  // Blood-drip color (v3.9) — the drip color for the Blood frame.
  out.blood_color = hex(obj.blood_color);
  // GB/GBA frame colors (v3.9) — handheld body mode + up to 3 custom
  // gradient colors (only used when mode is "custom").
  out.gb_mode = GB_FRAME_MODES.includes(String(obj.gb_mode || "")) ? String(obj.gb_mode || "") : "";
  const gbCols = Array.isArray(obj.gb_colors) ? obj.gb_colors : [];
  out.gb_colors = gbCols.map((c) => hex(c)).filter(Boolean).slice(0, 3);
  // Chosen display badges (v3.9) — up to 2 badge keys the member picked
  // to show next to their name. Slot rules are enforced on save
  // (cleanDisplayBadges); parsing only keeps known badge keys.
  const db = Array.isArray(obj.display_badges) ? obj.display_badges : [];
  out.display_badges = [...new Set(db.map((k) => String(k || "")))].filter((k) => BADGE_KEYS.includes(k)).slice(0, 2);
  // Action buttons (v3.10) — which side they sit on ("" = left default)
  // and whether they show at all (default true — hiding is opt-in).
  out.buttons_side = (String(obj.buttons_side || "") === "right") ? "right" : "";
  out.buttons_show = obj.buttons_show === false ? false : true;
  // Button size + which buttons show + professional-mode button
  // (v3.21) — the Buttons group in Edit Profile. Size "" = M, the
  // current size; "s" is the smallest clearly readable, "xl" decently
  // large. buttons_visible null = all show; an array lists exactly
  // which of add/message/favorite/group/subscribe show. pro_button_side
  // "" = left, "center" / "right" under the picture in professional
  // mode. pro_button_color any #rrggbb, "" = default.
  out.button_size = ["s", "l", "xl"].includes(String(obj.button_size || "")) ? String(obj.button_size) : "";
  const bv = Array.isArray(obj.buttons_visible) ? obj.buttons_visible : null;
  out.buttons_visible = bv === null ? null : [...new Set(bv.map((k) => String(k || "")))].filter((k) => ["add", "message", "favorite", "group", "subscribe"].includes(k));
  out.pro_button_side = (String(obj.pro_button_side || "") === "center" || String(obj.pro_button_side || "") === "right") ? String(obj.pro_button_side) : "";
  out.pro_button_color = hex(obj.pro_button_color);
  // One video per profile (v3.10) — a YouTube link (validated: must
  // carry a real 11-char video id) or an uploaded clip served from R2
  // (/api/files?key=... or https://). The two are exclusive: an upload
  // clears the YouTube link on save.
  const vu = String(obj.video_url || "").trim().slice(0, 500);
  out.video_url = extractYouTubeId(vu) ? vu : "";
  const vf = String(obj.video_file_url || "").trim().slice(0, 500);
  out.video_file_url = (/^\/api\/files\?key=/i.test(vf) || /^https:\/\//i.test(vf)) ? vf : "";
  // Ticker source (v3.10) — "" = the member's own text, "btc" = live
  // Bitcoin price from CoinGecko (free, no key, fetched client-side).
  out.ticker_source = (String(obj.ticker_source || "") === "btc") ? "btc" : "";
  // Hidden page sections (v3.10) — which card sections the member chose
  // to hide on their page (MySpace-style: show only what you want).
  const hs = Array.isArray(obj.hide_sections) ? obj.hide_sections : [];
  out.hide_sections = [...new Set(hs.map((k) => String(k || "")))].filter((k) => SECTION_HIDE_IDS.includes(k)).slice(0, 10);
  // Member page layout (v3.20) — how many Top Friends show (3/4/5/8/10,
  // default 8), which side the Top Friends column sits on ("" = right
  // default, "left" swaps it with the info column), and who can see the
  // member's post feed on their page (public / friends / private).
  const tfc = Number(obj.topfriends_count);
  out.topfriends_count = [3, 4, 5, 8, 10].includes(tfc) ? tfc : 8;
  out.topfriends_side = (String(obj.topfriends_side || "") === "left") ? "left" : "";
  out.feed_privacy = ["public", "friends", "private"].includes(obj.feed_privacy) ? obj.feed_privacy : "public";
  // Website look (v3.20) — the Add me / Favorite / Add to group
  // buttons on a professional page are the member's choice: off by
  // default (contact is just the message link), on when they tick
  // "Show the buttons too" in the Website look box.
  out.website_buttons = obj.website_buttons === true;
  // Dividers (v3.20) — the line between Top Friends and Page comments.
  // Any known id parses; the save path (profile.js) enforces the unlock,
  // so a locked divider can't be smuggled in by a forged request.
  out.divider = DIVIDER_IDS.includes(String(obj.divider || "")) ? String(obj.divider) : "";
  out.divider_color = hex(obj.divider_color);
  const du = Array.isArray(obj.divider_unlocks) ? obj.divider_unlocks : [];
  out.divider_unlocks = [...new Set(du.map((k) => String(k || "")))].filter((k) => DIVIDER_IDS.includes(k));
  // Custom page (v3.20) — the member's own HTML as their website-mode
  // page. Sanitized on the way in (scripts/iframes stripped); renders
  // only when website_mode is on.
  out.custom_page_html = sanitizeCustomPageHtml(obj.custom_page_html);
  return out;
}
// Validate + normalize a theme from a client save. Returns the JSON string
// to store ("" when nothing is set).
export function cleanTheme(input) {
  const t = parseTheme(input);
  if (!t.bg_color && !t.bg_image_url && !t.text_color && !t.accent_color && !t.font && !t.name_font && !t.glow && !t.glow_color && !t.outline_color && !t.vibe && !t.button_style && !t.button_css && !(t.effects && t.effects.length) && !t.bg_preset && !t.comment_border_color && !t.pic_size && !t.pic_position && !t.pic_frame && !t.blood_color && !t.gb_mode && !(t.gb_colors && t.gb_colors.length) && !(t.display_badges && t.display_badges.length) && t.buttons_side === "" && t.buttons_show !== false && t.button_size === "" && t.buttons_visible === null && t.pro_button_side === "" && !t.pro_button_color && !t.video_url && !t.video_file_url && t.ticker_source === "" && !(t.hide_sections && t.hide_sections.length) && t.topfriends_count === 8 && t.topfriends_side === "" && t.feed_privacy === "public" && !t.divider && !t.divider_color && !(t.divider_unlocks && t.divider_unlocks.length) && !t.website_buttons && !t.custom_page_html) return "";
  return JSON.stringify(t);
}
// Profile action buttons (v3.6) — one JSON blob describing the button
// block on the owner's page: { mode: "buttons"|"image", image_url, buttons:
// { add/message/favorite/group/report: { label, bg, color } } }.
// Labels are plain text, max 30 chars; colors must be #rrggbb; the solid
// image (mode "image") must be https://. Only keys the owner actually
// set are kept; returns "" when nothing is set.
export const PROFILE_BUTTON_IDS = ["add", "message", "favorite", "group"];
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
