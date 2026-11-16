/* ============================================================
   Do Whatever Community — site app (vanilla JS, talks to /api/*)
   Community lives on community.html; routes are hash routes:
   #/street #/cardcheck #/market #/trade #/flea #/orders #/payouts
   #/members #/member/<id> #/chat #/reports #/rules #/adult #/tag/<tag>
   #/tag/adult/<tag> #/post/<id> #/listing/<id> #/find #/headlines
   #/receipts
   Identity: device id in localStorage (dwc-device-id); heart state in
   dwc-my-votes; adult welcome seen flag in dwc-adult-welcomed.
   MySpace throwback v2: AIM-style buddy list + 1:1 IMs (#/chat), Top 8
   friends + custom profile layouts + Layout Bot (member pages #/member),
   presence heartbeat (online/away/offline + away message).
   Creator/Seller area v3: creator posts in the 18+ forum (emoji titles,
   genre picker, custom tags, price, 3D print files), Find a Seller /
   Find a Buyer (#/find), and ephemeral private chats (private, deletes
   when closed — NOT end-to-end encrypted) between seller and buyer.
   v3.1 refinements: private chats say just "Private chat" (no
   encryption wording in the UI); transactions in a private chat save a
   receipt (My receipts, #/receipts) that survives the message delete;
   Headlines (#/headlines) surfaces the Community's top posts by
   engagement; member pages can show A Steady Heart track picks (max 5)
   and an opt-in Steady Wave player (live stream only, no player
   for individual tracks yet).
   When the D1 binding is absent the API answers { error:
   "db_unavailable" } and the app shows "Community is being set up —
   check back soon" instead of crashing.
   ============================================================ */
(function () {
"use strict";

var API = "/api";
var DEVICE_KEY = "dwc-device-id";
var VOTES_KEY = "dwc-my-votes";
var ADULT_KEY = "dwc-adult-welcomed";

var CATEGORIES = ["General", "Questions & Help", "Shop Talk", "Music", "Plants & Garden", "Tech & Builds", "Off Topic"];
var FLAIRS = ["Question", "Card Check", "Show & Tell", "Price Check", "Help", "Discussion", "Hype", "Warning"];
var LISTING_CATEGORIES = ["Pokemon Cards", "Sports Cards", "Other TCG", "Graded Slabs", "Sealed Product", "Figures & Toys", "Video Games", "Plants", "3D Prints & Custom", "Other Collectibles"];
var SALE_VENUES = ["eBay", "Mercari", "Facebook Marketplace", "This app", "In person", "Other"];
var CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"];
var ADULT_CATEGORIES = [
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
var MODEL_EYE_COLORS = ["Brown", "Blue", "Green", "Hazel", "Gray", "Other"];
var MODEL_STYLES = ["Girly", "Tomboy", "Goth", "Hipster", "Kawaii", "Nerdy", "Sporty", "Alt", "Classic", "Baddie"];
var MODEL_INK_OPTIONS = ["None", "Tattoos", "Piercings", "Tattoos & piercings"];

// Creator/Seller area (v3) — digital-content genres, one-tap seller tag
// chips, and the emoji flair row for creator-post titles. Titles keep
// emojis as-is (never stripped); the picker just inserts them.
var CREATOR_GENRES = ["Photos", "Videos", "Custom Content", "Audio", "3D Print Files", "Other"];
var CREATOR_TAG_CHIPS = ["Selling Uncensored Nudes", "Selling Videos", "Custom Content", "3D Print Files", "Selling Photos"];
var TITLE_EMOJIS = ["🔥", "💖", "✨", "🌙", "🍬", "💋", "😈", "😘", "🎀", "🌸", "💎", "👑", "🍓", "🍑", "🌶️", "💦", "🎥", "📸", "🖨️", "🎵"];

// A Steady Heart — "End of the year" (21 tracks, in order). Chris gives
// full permission to use all of it. Track names are exact — never
// re-title or alter them. Members pick up to 5 to show on their profile.
// (Track names only — no audio player for individual tracks yet; the
// player comes later. The Steady Wave player below is the live
// station stream, not per-track audio.)
var ASH_TRACKS = [
  "Break habits, not hearts", "Untold weapons", "Voice inside my head original",
  "Sunk for you", "I'll prove everything", "Mr.Selfish", "Sweet BBgirl",
  "Let's Travel", "Straight to pieces", "The day she came to be",
  "Djentlemen Thief", "Guess how it ends", "On top of it Feat. Chest Club",
  "Monster in disguise", "Stay until sunrise", "Read between the lines",
  "Introduction to heartache", "We will meet again I swear",
  "Dance till they drop", "Aiming to tease part 2", "Give them the world",
];
// Steady Wave — the live Icecast MP3 stream. The only stream URL the
// site uses; never invent another one.
var VNR_STREAM_URL = "https://radio.rarecandyreserve.org/vitanova";

// GIF library — real GIFs on GIPHY (official Pokémon channel and creators).
var GIFS = [
  { id: "gaS0ex2BtbyvnhRW1s", label: "Pikachu dance", group: "Pokemon", pageUrl: "https://giphy.com/gifs/hamlet-pikachu-gaS0ex2BtbyvnhRW1s" },
  { id: "xRXF6FBfLNYjinzOuG", label: "Happy dance — Pokémon", group: "Pokemon", pageUrl: "https://giphy.com/gifs/pokemon-anime-xRXF6FBfLNYjinzOuG" },
  { id: "HJkV7TjiTrjJWzbHN2", label: "Pikachu dancing — Pokémon", group: "Pokemon", pageUrl: "https://giphy.com/gifs/HJkV7TjiTrjJWzbHN2" },
  { id: "vnGlErQHuF9BK", label: "Pokemon dancing", group: "Pokemon", pageUrl: "https://giphy.com/gifs/pokemon-dancing-pikachu-vnGlErQHuF9BK" },
  { id: "tJu8Db1VNFgsL4lXI7", label: "Pokemon 25 dance", group: "Pokemon", pageUrl: "https://giphy.com/gifs/pokemon-pokemon-25-25th-yaffle-tJu8Db1VNFgsL4lXI7" },
  { id: "AadiJtWr5eOFXx0otR", label: "Happy jump — Pokémon", group: "Pokemon", pageUrl: "https://giphy.com/gifs/pokemon-AadiJtWr5eOFXx0otR" },
  { id: "iwSO6xWFvHUYw", label: "Pokemon Go dancing", group: "Pokemon", pageUrl: "https://giphy.com/gifs/vidme-pokemon-instinct-team-iwSO6xWFvHUYw" },
  { id: "8UGGp7rQvfhe63HrFq", label: "So excited cheers — Pokémon", group: "Pokemon", pageUrl: "https://giphy.com/gifs/reaction-mood-8UGGp7rQvfhe63HrFq" },
  { id: "KG3V9GaVHZLpPvLoCu", label: "Kakashi thumbs up — Naruto Shippuden", group: "Anime", pageUrl: "https://giphy.com/gifs/naruto-shippuden-KG3V9GaVHZLpPvLoCu" },
  { id: "14ubGFMWtxBiVy", label: "Naruto fist bump", group: "Anime", pageUrl: "http://giphy.com/gifs/fist-bump-naruto-uzumaki-14ubGFMWtxBiVy" },
  { id: "1YI48cB3IHJJu", label: "Naruto run", group: "Anime", pageUrl: "https://giphy.com/gifs/runner-1YI48cB3IHJJu" },
  { id: "g4N6wTrf1v6yQ", label: "Naruto — anime", group: "Anime", pageUrl: "https://giphy.com/gifs/g4N6wTrf1v6yQ" },
  { id: "D8HlsB41hlmEM", label: "Goku running — Dragon Ball (Funimation)", group: "Anime", pageUrl: "https://giphy.com/gifs/D8HlsB41hlmEM" },
  { id: "11YMhfLfGoq5Gg", label: "Goku thumbs up — Dragon Ball Z", group: "Anime", pageUrl: "https://giphy.com/gifs/11YMhfLfGoq5Gg" },
  { id: "3o7abz7dhJ17F7y4Le", label: "Star Wars hologram — official Star Wars", group: "Geek", pageUrl: "https://giphy.com/gifs/starwars-movie-star-wars-3o7abz7dhJ17F7y4Le" },
  { id: "l1KukwtKoeWV8sPWE", label: "Han Solo — Star Wars", group: "Geek", pageUrl: "https://giphy.com/gifs/starwars-star-wars-han-solo-l1KukwtKoeWV8sPWE" },
  { id: "3ohuPmWJCB8CHAjSmc", label: "Luke Skywalker — Star Wars", group: "Geek", pageUrl: "https://giphy.com/gifs/starwars-star-wars-luke-3ohuPmWJCB8CHAjSmc" },
];
function gifEmbedUrl(id) { return "https://giphy.com/embed/" + id; }

// Chris's approved Age Verification Notice — VERBATIM. Shown wherever the
// ID upload appears and in the rules. Do not edit the wording.
var AGE_NOTICE_HTML =
  '<div class="dwc-age-notice" role="note" aria-label="Age Verification Notice">' +
  '<p class="dwc-age-title">Age Verification Notice —</p>' +
  '<p>You must be 18 years or older to sell adult content or enter the 18+ area. To confirm your age, upload a clear photo of your government-issued photo ID (driver’s license, state ID, or passport).</p>' +
  '<p><strong>How your information is handled:</strong></p>' +
  '<ul><li>Your ID is used for one purpose only — to verify that you are 18 or older.</li>' +
  '<li>It is never stored, shared, sold, or kept anywhere, by us or by anyone else. Once your age is confirmed, the copy is permanently deleted.</li>' +
  '<li>The only record we keep is a simple \'age verified\' mark on your account. We do not keep your name, birthdate, ID number, or photo from the ID.</li></ul>' +
  '<p>By submitting your ID, you confirm that you are at least 18 years old and that the ID is genuine and belongs to you. Submitting a fake ID or lying about your age will get your account permanently banned.</p>' +
  '<p><strong>Why we check:</strong> verifying age keeps this platform safe and legal. It is how we make sure no one under 18 can sell or access adult content here, and it protects the platform from liability for underage users.</p>' +
  '</div>';

// Operator-review addendum (separate from the verbatim notice): on this
// site a human — Chris, the operator — reviews the ID himself, so the
// photo is held privately in an encrypted vault ONLY until he decides,
// then permanently deleted. It is never written to the database.
var AGE_REVIEW_NOTE =
  '<p class="dwc-review-note">🔒 <strong>How the review works here:</strong> your ID photo is held privately in an encrypted vault for Chris (the operator) to review — and permanently deleted the moment he approves or rejects it. It is never written to the database, and nobody else sees it.</p>';

var OFFSITE_ADVISORY_HTML =
  '<p class="dwc-advisory" role="note">⚠ <strong>Keep the deal on the platform.</strong> Selling off site is discouraged for a reason: here, every member is a verified account, orders and tracking are recorded, and there’s a report trail if anything goes wrong. Take a deal off site and you lose all of that protection — no record, no verified buyer, no help if it goes bad.</p>';

var THEFT_NOTICE_HTML =
  '<p class="dwc-theft" role="note">⚖ <strong>Stealing content is theft.</strong> Anyone who takes a member’s content and redistributes it — in any form — will be held liable in court for money owed due to damages, and more. Don’t do it, and report it if you see it.</p>';

// ---------- state ----------
var state = {
  profile: null,
  stats: null,
  dbDown: false,
  notice: null,
  category: null,
  sort: "new",
  editingProfile: false,
  signupOpen: false,
  challenge: null, // { token, question }
  checkResult: null, // card-check AI result (composer)
  listingCheck: null, // card-check AI result (listing form)
  chatTimer: null,
  presenceTimer: null,
  presence: "online", // online | away (own presence; heartbeat keeps it fresh)
  awayMessage: "",
  buddies: [],
  inbox: [],
  openIMs: [], // [{ id, username }]
  imCache: {}, // profileId -> [messages]
  // Creator/Seller area (v3) — one ephemeral private chat at a time.
  eph: null, // { conversation_id, partner_id, partner_username, post_id }
  ephMessages: [], // messages in the open ephemeral chat
  ephInbox: [], // my open ephemeral conversations
  ephTxnMsg: null, // confirmation after a transaction is marked done
  receipts: [], // my receipts (My receipts view)
  findRole: "seller", // "seller" = I'm buying, looking for a seller; "buyer" = I'm selling, looking for a buyer
  findResults: [],
  headlines: [], // top posts by engagement (Headlines view / Street strip)
  route: null,
  // Taffy Phone — the iPhone-like popup phone window Taffy lives in.
  // The phone root lives on document.body (outside #dwc-app) so route
  // changes never rebuild it (that keeps the radio playing and the notes
  // textarea focused). All phone data is in-memory / this session only.
  phone: { open: false, app: "home", wallpaper: "vaporwave" },
  phoneGallery: [], // [{ url, name, timer }] — session only, auto-deleted after 10 min
  phoneNotes: "", // session notes — this tab only, gone when you leave
  phoneMsgList: null, // cached member list for the MSG contacts view
  phoneChat: [], // [{ who: "me"|"taffy", text, emoji }] — session only, gone when you leave
  phoneChatOpen: false, // chat bar expanded (tap-to-reveal); conversation stays in phoneChat when closed
  phoneRenderedKey: "", // app|open|wallpaper|galleryCount — avoids rebuilding the radio
};

function deviceId() {
  try {
    var existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    var id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID()
      : "dev-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch (e) { return "dev-shared-fallback"; }
}
function loadVotes() {
  try { return JSON.parse(localStorage.getItem(VOTES_KEY) || "{}"); } catch (e) { return {}; }
}
function saveVotes(v) { try { localStorage.setItem(VOTES_KEY, JSON.stringify(v)); } catch (e) {} }
function myHeart(key) { return !!loadVotes()[key]; }
function setHeart(key, on) {
  var v = loadVotes();
  if (on) v[key] = 1; else delete v[key];
  saveVotes(v);
}

// ---------- helpers ----------
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function money(cents) { return "$" + ((cents || 0) / 100).toFixed(2); }
function fmtDate(isoStr) {
  if (!isoStr) return "";
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function $(id) { return document.getElementById(id); }
function setNotice(msg) { state.notice = msg || null; renderNotice(); }
function renderNotice() {
  var el = $("dwc-notice");
  if (!el) return;
  el.style.display = state.notice ? "" : "none";
  if (state.notice) el.innerHTML = esc(state.notice) + ' <button type="button" class="dwc-linklike" onclick="DWC.dismissNotice()">✕</button>';
}
function markDbDown() {
  if (!state.dbDown) { state.dbDown = true; render(); }
}

async function apiGet(path) {
  try {
    var res = await fetch(API + path);
    var data = await res.json().catch(function () { return null; });
    if (data && data.error === "db_unavailable") { markDbDown(); return data; }
    if (!res.ok) return data || { ok: false, error: "Request failed." };
    return data;
  } catch (e) { return { ok: false, error: "Couldn't reach the Community — check your connection and try again." }; }
}
async function apiPost(path, body) {
  try {
    var res = await fetch(API + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    var data = await res.json().catch(function () { return null; });
    if (data && data.error === "db_unavailable") { markDbDown(); return data; }
    return data || { ok: false, error: "Request failed." };
  } catch (e) { return { ok: false, error: "Couldn't reach the Community — check your connection and try again." }; }
}
async function apiDelete(path, body) {
  try {
    var res = await fetch(API + path, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    var data = await res.json().catch(function () { return null; });
    if (data && data.error === "db_unavailable") { markDbDown(); return data; }
    return data || { ok: false, error: "Request failed." };
  } catch (e) { return { ok: false, error: "Couldn't reach the Community — check your connection and try again." }; }
}
var IMAGE_MIMES_CLIENT = ["image/jpeg", "image/png", "image/webp"];
function fileToImage(file, maxBytes) {
  return new Promise(function (resolve) {
    if (!file) return resolve(null);
    // Wrong file type (e.g. iPhone HEIC) — say so plainly instead of
    // letting the server reject the whole save.
    if (file.type && IMAGE_MIMES_CLIENT.indexOf(file.type) === -1) {
      return resolve({ error: "That photo isn't a JPG, PNG, or WebP — iPhone photos often save as HEIC. Pick a JPG, PNG, or WebP, or screenshot the photo and use that." });
    }
    var limitMB = ((maxBytes || 2500000) / 1000000).toFixed(1).replace(".0", "");
    if (file.size > (maxBytes || 2500000)) return resolve({ error: "That photo is too large — keep it under about " + limitMB + " MB." });
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = String(reader.result || "");
      var parts = dataUrl.split(",");
      resolve({ dataBase64: parts[1] || "", mimeType: file.type });
    };
    reader.onerror = function () { resolve({ error: "That photo couldn't be read — try again." }); };
    reader.readAsDataURL(file);
  });
}
// 3D print file reader (v3) — .stl / .obj / .3mf / .zip, under 25 MB.
// Returns { dataBase64, fileName } (the server checks the extension).
function fileToPrintFile(file, maxBytes) {
  return new Promise(function (resolve) {
    if (!file) return resolve(null);
    if (file.size > (maxBytes || 25000000)) return resolve({ error: "That file is too large — keep 3D print files under 25 MB." });
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = String(reader.result || "");
      var parts = dataUrl.split(",");
      resolve({ dataBase64: parts[1] || "", fileName: file.name || "print-file" });
    };
    reader.onerror = function () { resolve({ error: "That file couldn't be read — try again." }); };
    reader.readAsDataURL(file);
  });
}
function copyLink(url, btn) {
  var done = function () {
    if (btn) {
      var old = btn.textContent;
      btn.textContent = "Copied ✓";
      setTimeout(function () { btn.textContent = old; }, 1600);
    }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
  } else { fallbackCopy(url); done(); }
}
function fallbackCopy(text) {
  var ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
}
function postLink(id) { return location.origin + location.pathname + "#/post/" + id; }
function listingLink(id) { return location.origin + location.pathname + "#/listing/" + id; }
// 3D print file downloads are age-gated server-side — the link carries
// this device's id so /api/files can check the caller is age-verified.
function fileDownloadUrl(url) {
  if (!url) return "";
  return url + (url.indexOf("?") >= 0 ? "&" : "?") + "device_id=" + encodeURIComponent(deviceId());
}

// ---------- routing ----------
var NAV = [
  ["street", "The Street"], ["chat", "💬 Live Chat"], ["market", "Market"],
  ["trade", "⇄ Up for Trade"], ["flea", "🔨 Flea Market"], ["cardcheck", "🔍 Card Check"],
  ["adult", "🌙 After Dark 18+"], ["find", "✨ Find Seller / Buyer"], ["headlines", "🔥 Headlines"], ["receipts", "🧾 My receipts"], ["orders", "📦 My Orders"], ["payouts", "💰 Payouts"],
  ["members", "Members"], ["reports", "🚩 Reports"], ["rules", "Rules & After Dark"],
];
function parseRoute() {
  var h = (location.hash || "").replace(/^#\/?/, "");
  var parts = h.split("/").filter(Boolean);
  if (!parts.length) return { name: "street" };
  var n = parts[0];
  if (n === "post" && parts[1]) return { name: "thread", postId: parts[1] };
  if (n === "listing" && parts[1]) return { name: "listing", listingId: parts[1] };
  if (n === "member" && parts[1]) return { name: "member", memberId: parts[1] };
  if (n === "tag" && parts[1] === "adult" && parts[2]) return { name: "tag", tag: decodeURIComponent(parts[2]), adult: true };
  if (n === "tag" && parts[1]) return { name: "tag", tag: decodeURIComponent(parts[1]), adult: false };
  if (NAV.some(function (x) { return x[0] === n; })) return { name: n };
  return { name: "street" };
}
function go(route) { location.hash = "#/" + route; }

function render() {
  var app = $("dwc-app");
  if (!app) return;
  state.route = parseRoute();
  var r = state.route;
  var active = r.name;
  if (r.name === "thread") active = (window.__dwcThreadKind === "adult") ? "adult" : "street";
  if (r.name === "listing") active = window.__dwcListingKind || "market";
  if (r.name === "tag") active = r.adult ? "adult" : "street";
  var html = "";
  if (state.dbDown) {
    html += '<div class="dwc-setup-note" role="status"><strong>Community is being set up — check back soon.</strong><br>The shop is still connecting the Community database. Everything you see below is the real Community — it will come alive once the setup is done.</div>';
  }
  if (state.stats) {
    var s = state.stats;
    html += '<p class="dwc-stats"><span>' + s.members + '</span> ' + (s.members === 1 ? "member" : "members") + ' · <span>' + s.posts + '</span> posts · <span>' + s.comments + '</span> comments · <span>' + s.card_checks + '</span> card checks · <span>' + s.listings + '</span> listings</p>';
  }
  html += '<div id="dwc-notice" class="dwc-notice" role="status" style="display:' + (state.notice ? "" : "none") + '">' + (state.notice ? esc(state.notice) : "") + '</div>';
  html += '<div id="dwc-account"></div>';
  html += '<nav class="dwc-pills" aria-label="Community sections">' + NAV.map(function (item) {
    var label = item[1];
    if (item[0] === "reports" && state.stats && state.stats.open_reports > 0) label = "🚩 Reports (" + state.stats.open_reports + ")";
    return '<button type="button" class="dwc-pill' + (active === item[0] ? " active" : "") + (item[0] === "find" ? " dwc-pill-find" : "") + '" onclick="DWC.go(\'' + item[0] + '\')">' + esc(label) + "</button>";
  }).join("") + "</nav>";
  html += '<div id="dwc-view"></div>';
  html += '<div id="dwc-ephwins"></div>';
  app.innerHTML = html;
  renderAccount();
  renderView();
  renderNotice();
  renderEphWin();
}

function renderAccount() {
  var el = $("dwc-account");
  if (!el) return;
  // The layout preview style only lives while the profile form is open —
  // otherwise it would leak onto member pages (same .dwc-myprofile hooks).
  var showingForm = (state.profile && state.editingProfile) || (!state.profile && state.signupOpen);
  if (!showingForm) {
    var ps = document.getElementById("dwc-layout-preview-style");
    if (ps) ps.remove();
  }
  if (state.profile && !state.editingProfile) {
    var p = state.profile;
    el.innerHTML =
      '<section class="card dwc-profile-card"><div class="dwc-profile-row">' +
      (p.avatar_url ? '<img class="dwc-avatar" src="' + esc(p.avatar_url) + '" alt="">' : '<span class="dwc-avatar dwc-avatar-none">🍬</span>') +
      '<div><h3 style="margin:0">✓ You’re on the street as @' + esc(p.username) + '</h3>' +
      '<p style="margin:4px 0 0">Buyer &amp; seller in one account.' +
      (p.age_verified ? ' <strong style="color:var(--green)">· Age verified ✓</strong>' : "") +
      (p.is_operator ? ' <strong style="color:var(--amber)">· Operator</strong>' : "") + "</p>" +
      (p.payout_method && p.payout_handle
        ? '<p style="margin:4px 0 0;color:var(--green)">✓ Payout ready — you can list in the Market, Trades, and Flea Market.</p>'
        : '<p style="margin:4px 0 0">Add a payout method + handle whenever you’re ready to sell — buying and posting never need it.</p>') +
      '<p style="margin:8px 0 0"><button type="button" class="btn ghost small" onclick="DWC.go(\'member/' + p.id + '\')">View my page →</button>' +
      ((p.top_friend_ids && p.top_friend_ids.length) ? ' <span style="color:var(--muted);font-size:13px">🌟 Top 8: ' + p.top_friend_ids.length + "/8 picked</span>" : "") +
      (p.layout_preset ? ' <span style="color:var(--muted);font-size:13px">· 🎨 layout: ' + esc(p.layout_preset) + "</span>" : "") + "</p>" +
      "</div>" +
      '<div style="margin-left:auto"><button type="button" class="btn ghost small" onclick="DWC.editProfile()">Edit profile</button></div>' +
      "</div></section>";
    return;
  }
  if (!state.profile && !state.signupOpen) {
    el.innerHTML =
      '<section class="card" style="text-align:center"><h3 style="margin-top:0">New here?</h3>' +
      '<p style="max-width:520px;margin:0 auto">One free account — buyer and seller in one. Name, username, date of birth, one tiny sum to prove you’re human, agree to the rules below. That’s it — then post, ask, chat, buy, and sell.</p>' +
      '<p style="margin-top:14px"><button type="button" class="btn" onclick="DWC.openSignup()">Create Account — it’s free</button></p>' +
      '<div class="dwc-coin-row"><span class="dwc-insert-coin">⬇ Insert coin ⬇</span><span class="dwc-coin" aria-hidden="true">¢</span></div>' +
      '<p style="font-size:13px">Just looking? The chat window works as a guest, too — guests are auto-censored, members aren’t.</p></section>';
    return;
  }
  el.innerHTML = profileFormHTML(state.profile);
  if (!state.challenge) loadChallenge();
  if (state.editingProfile) loadTopFriendPicker();
  initLayoutEditor();
}

// ---------- Taffy — the little site helper (ONE helper, v5) ----------
// v5: ASCENSION — inspired by Shawn Hocking's astral artwork (the reference
// Chris sent): a glowing figure, arms OUTSTRETCHED to the sides, radiant
// head, inside a big glowing rune mandala, energy streaming up and down in
// purple and gold. KEEP Taffy's v4 look (Game Boy-type creature, ORIGINAL
// RGB GRADIENT like Slabb's avatar — pink → purple → blue, cyan accents,
// hand-drawn show style, cute, hands and feet). NO PC AT ALL — the laptop,
// keyboard, keys and cursor are GONE.
// Idle/talking: adorable and helpful — smiling, winking, mouth moving when
// talking, arms waving around a bit. Friendly, alive.
// Working (loading information): ASCENSION. Taffy floats in a meditation
// pose, a radiant glowing mandala behind him, light rays streaming up and
// down, and his ASTRAL FORM — a glowing spirit with arms OUTSTRETCHED and a
// radiant head, just like the figure in the reference — rises out of him and
// bobs up a bit, down, up, down, like he's stuck ascending while he loads
// the information. The astral form shows the "904 Lokos" prison tattoos.
// That is the .taffy-working loop. CSS only.
// Mood swings are a FUTURE step.
// The standalone asset lives at images/taffy-helper.svg.
// uid keeps the gradient ids unique when Taffy appears twice on a page.
function taffySVG(cls, uid) {
  var u = uid || "a";
  return '<svg class="' + (cls || "taffy") + '" viewBox="0 0 240 210" role="img" aria-label="Taffy, the little site helper">' +
    '<defs>' +
    '<linearGradient id="taffy-body-' + u + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff2ea6"/><stop offset=".35" stop-color="#e060f0"/><stop offset=".6" stop-color="#7c4dff"/><stop offset="1" stop-color="#0066ff"/></linearGradient>' +
    '<linearGradient id="taffy-screen-' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8f7ff"/><stop offset="1" stop-color="#5ee6ff"/></linearGradient>' +
    '<linearGradient id="taffy-astral-' + u + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9de2" stop-opacity=".92"/><stop offset=".5" stop-color="#c9a6ff" stop-opacity=".8"/><stop offset="1" stop-color="#7dd7ff" stop-opacity=".92"/></linearGradient>' +
    '<linearGradient id="taffy-gold-' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe98a"/><stop offset=".55" stop-color="#d4af37"/><stop offset="1" stop-color="#b8860b"/></linearGradient>' +
    '<filter id="taffy-glow-' + u + '" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '</defs>' +
    '<g class="taffy-energy" filter="url(#taffy-glow-' + u + ')">' +
    '<g class="taffy-mandala">' +
    '<circle cx="120" cy="105" r="95" fill="#7c4dff" opacity=".08"/>' +
    '<circle cx="120" cy="105" r="92" fill="none" stroke="url(#taffy-gold-' + u + ')" stroke-width="1.5" opacity=".8"/>' +
    '<circle cx="120" cy="105" r="86" fill="none" stroke="#e8d9a0" stroke-width="5" stroke-dasharray="2 9.5" opacity=".75"/>' +
    '<circle cx="120" cy="105" r="80" fill="none" stroke="#7c4dff" stroke-width="1.5" opacity=".8"/>' +
    '<path d="M120 14 L196 152 L44 152 Z" fill="none" stroke="#ffd75e" stroke-width="1.2" opacity=".45"/>' +
    '<path d="M120 26 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 Z" fill="#ffe98a" opacity=".8"/>' +
    '<path d="M120 184 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 Z" fill="#ffe98a" opacity=".8"/>' +
    '<path d="M42 105 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 Z" fill="#ffe98a" opacity=".8"/>' +
    '<path d="M198 105 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 Z" fill="#ffe98a" opacity=".8"/>' +
    '</g>' +
    '<g class="taffy-rays" fill="#ffe98a">' +
    '<polygon points="108,0 132,0 120,62" opacity=".3"/>' +
    '<polygon points="82,0 98,0 116,58" opacity=".22"/>' +
    '<polygon points="142,0 158,0 124,58" opacity=".22"/>' +
    '<polygon points="108,210 132,210 120,158" opacity=".26"/>' +
    '<polygon points="82,210 98,210 116,162" opacity=".18"/>' +
    '<polygon points="142,210 158,210 124,162" opacity=".18"/>' +
    '</g>' +
    '<circle class="taffy-ring taffy-ring-1" cx="120" cy="92" r="60" fill="none" stroke="#00e5ff" stroke-width="2"/>' +
    '<circle class="taffy-ring taffy-ring-2" cx="120" cy="92" r="72" fill="none" stroke="#ff2ea6" stroke-width="1.5"/>' +
    '<g class="taffy-orbit"><circle cx="120" cy="24" r="5" fill="#00e5ff"/><circle cx="184" cy="96" r="4" fill="#ff2ea6"/><circle cx="56" cy="96" r="4" fill="#aaff00"/></g>' +
    '<path class="taffy-sparkle" d="M58 48 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#ffffff"/>' +
    '<path class="taffy-sparkle taffy-sparkle-2" d="M182 42 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#ffffff"/>' +
    '<path class="taffy-sparkle taffy-sparkle-3" d="M196 142 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#ffffff"/>' +
    '<path class="taffy-sparkle taffy-sparkle-4" d="M44 150 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#ffd75e"/>' +
    '</g>' +
    '<g class="taffy-body">' +
    '<path d="M80 44 Q74 38 82 37 L158 36 Q167 37 167 47 L167 120 L150 139 L90 140 Q74 139 73 125 L72 50 Q72 44 80 44 Z" fill="url(#taffy-body-' + u + ')" stroke="#2a0a4a" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<path d="M82 47 Q77 42 84 41 L156 40 Q164 41 164 49 L164 118 L148 135 L92 136 Q77 135 76 123 L75 52 Q75 48 82 47 Z" fill="none" stroke="#2a0a4a" stroke-width="1" opacity=".3" stroke-linejoin="round"/>' +
    '<g class="taffy-front">' +
    '<path d="M84 52 Q83 50 88 50 L152 49 Q157 50 157 56 L157 94 Q156 101 149 101 L90 102 Q83 101 83 95 Q82 66 84 52 Z" fill="url(#taffy-screen-' + u + ')" stroke="#10203a" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<g class="taffy-face">' +
    '<g class="taffy-eye"><circle cx="108" cy="72" r="9" fill="#10203a"/><circle cx="111" cy="69" r="3" fill="#ffffff"/></g>' +
    '<g class="taffy-eye taffy-eye-wink"><circle cx="132" cy="73" r="8.5" fill="#10203a"/><circle cx="135" cy="70" r="2.8" fill="#ffffff"/></g>' +
    '<path class="taffy-mouth-smile" d="M110 86 Q115 93 120 89 Q125 94 130 86" fill="none" stroke="#10203a" stroke-width="3" stroke-linecap="round"/>' +
    '<ellipse class="taffy-mouth-talk" cx="120" cy="89" rx="5.5" ry="3.5" fill="#10203a"/>' +
    '<path d="M92 82 q3 4 8 2" fill="none" stroke="#f2a18e" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>' +
    '<path d="M140 83 q3 4 8 2" fill="none" stroke="#f2a18e" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>' +
    '</g>' +
    '<g class="taffy-face-meditate">' +
    '<path d="M100 72 q8 6 16 0" fill="none" stroke="#10203a" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M124 73 q8 6 16 0" fill="none" stroke="#10203a" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M113 88 Q120 92 127 88" fill="none" stroke="#10203a" stroke-width="3" stroke-linecap="round"/>' +
    '</g>' +
    '<g fill="#1f3a4d" transform="rotate(-3 96 116)"><rect x="91" y="106" width="10" height="20" rx="3"/><rect x="86" y="111" width="20" height="10" rx="3"/></g>' +
    '<circle cx="146" cy="112" r="6" fill="#2fbf4a" stroke="#10203a" stroke-width="1.5"/>' +
    '<circle cx="132" cy="122" r="5" fill="#e53935" stroke="#10203a" stroke-width="1.5"/>' +
    '<rect x="108" y="131" width="10" height="4" rx="2" fill="#1f3a4d" transform="rotate(-12 113 133)"/>' +
    '<rect x="124" y="131" width="10" height="4" rx="2" fill="#1f3a4d" transform="rotate(-12 129 133)"/>' +
    '<path d="M142 134 l5 -4 M146 137 l5 -4 M150 140 l5 -4" fill="none" stroke="#2a0a4a" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>' +
    '</g>' +
    '<ellipse cx="88" cy="148" rx="11" ry="5" fill="#7c4dff"/>' +
    '<ellipse cx="152" cy="148" rx="10" ry="5" fill="#7c4dff"/>' +
    '</g>' +
    '<g class="taffy-arms">' +
    '<g class="taffy-arm taffy-arm-l"><path d="M72 102 Q76 124 90 138" fill="none" stroke="#e060f0" stroke-width="9" stroke-linecap="round"/><circle cx="92" cy="140" r="8" fill="#fff3d6" stroke="#2a0a4a" stroke-width="2"/></g>' +
    '<g class="taffy-arm taffy-arm-r"><path d="M168 102 Q164 124 150 138" fill="none" stroke="#e060f0" stroke-width="9" stroke-linecap="round"/><circle cx="148" cy="140" r="8" fill="#fff3d6" stroke="#2a0a4a" stroke-width="2"/></g>' +
    '</g>' +
    '<g class="taffy-astral" filter="url(#taffy-glow-' + u + ')">' +
    '<g stroke="url(#taffy-astral-' + u + ')" stroke-width="7" stroke-linecap="round" fill="none">' +
    '<path d="M102 36 L70 48"/>' +
    '<path d="M138 36 L170 48"/>' +
    '</g>' +
    '<circle cx="68" cy="49" r="6" fill="#fff7c0" stroke="#ffffff" stroke-width="1.5"/>' +
    '<circle cx="172" cy="49" r="6" fill="#fff7c0" stroke="#ffffff" stroke-width="1.5"/>' +
    '<path d="M96 34 Q120 26 144 34 L140 46 Q132 52 120 54 Q108 52 100 46 Z" fill="url(#taffy-astral-' + u + ')" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<circle cx="120" cy="22" r="8" fill="#fff7c0" stroke="#ffffff" stroke-width="1.5"/>' +
    '<circle cx="120" cy="22" r="12" fill="none" stroke="#ffe98a" stroke-width="1.5" opacity=".7"/>' +
    '<text x="120" y="44" font-family="\'Comic Sans MS\', \'Chalkboard SE\', cursive" font-size="7.5" font-weight="bold" fill="#1a1030" text-anchor="middle" transform="rotate(-3 120 44)">904 Lokos</text>' +
    '<path d="M120 48 q2.5 4 0 6 q-2.5 -2 0 -6" fill="#1a1030" opacity=".8"/>' +
    '</g>' +
    '</svg>';
}
// Taffy's quick-help buttons — every one uses a route or action the
// Community already has. No new endpoints, no chatbot.
// - File a report → Reports route (members file reports from there).
// - Block a member → Reports route too: there is no block button yet, so
//   blocking goes through reporting and the operator (Chris) removes them.
// - FAQ → Rules route. - Contact support → IM to the operator (Chris,
//   @RareCandyReserve, member 1) via the existing openIM.
// - Email an admin / mod → opens the visitor's mail client addressed to
//   TheRarecandyreserve@proton.me with a pre-filled subject. Texts come
//   later; nothing here claims texts are set up.
// Comments are NOT auto-forwarded to email — there is no server-side email
// service configured, so comments live on the posts and the operator sees
// them in the Community. That needs an email service to change.
function taffyHelpHTML(inPhone) {
  return '<div class="taffy-help">' +
    '<button type="button" class="btn ghost small" onclick="DWC.go(\'reports\')">🚩 File a report</button>' +
    '<button type="button" class="btn ghost small" onclick="DWC.go(\'reports\')">🚫 Block a member</button>' +
    '<button type="button" class="btn ghost small" onclick="DWC.go(\'rules\')">❓ FAQ</button>' +
    '<button type="button" class="btn ghost small" onclick="DWC.imMember(1, \'RareCandyReserve\')">💬 Contact support</button>' +
    '<a class="btn ghost small" href="mailto:TheRarecandyreserve@proton.me?subject=Community%20%E2%80%94%20contact%20an%20admin%20or%20mod">✉️ Email an admin / mod</a>' +
    (inPhone ? "" : '<button type="button" class="btn ghost small" onclick="DWC.phoneOpen()">📱 Open Taffy’s phone</button>') +
    '</div>' +
    '<p class="taffy-help-note">Flag and report any comment or profile, as well as messages or content you see, if it does not belong — an admin will see it and action will be taken. For further issues unresolved, reach out to TheRarecandyreserve@proton.me or leave a message for the owner of this website or its agents or employees.</p>' +
    '<p class="taffy-help-note">Blocking happens through reports — report someone and Chris (the operator) can remove them. Contact support messages Chris directly. Email an admin / mod goes to TheRarecandyreserve@proton.me. Comments live on the posts — Chris sees them in the Community; email forwarding of every comment isn’t set up yet.</p>';
}

function copyTextToClipboard(text) {
  var ta = document.createElement("textarea");
  ta.value = text || "";
  ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
}

// ---------- Taffy Phone — the iPhone-like popup phone window ----------
// The green call/text button (bottom-right) opens a little iPhone-style
// popup: rounded frame, dynamic island, status bar, home screen with apps.
// Taffy lives inside it. Each app wires to a Community feature that
// already exists, or is honestly labeled in-session / coming soon.
// No new API endpoints.
// Apps: Vita Nova (Taffy), MSG (contacts — Taffy first, then friends),
// Gallery (session-only, auto-deletes after 10 min), SOS (help),
// Notes (session-only), radio (Steady Wave stream), Code (the layout/CSS
// editor in Edit profile), Tutorial (coming soon — Chris adds the video).
// The phone root lives on document.body, OUTSIDE #dwc-app, so route
// changes never rebuild it — the radio keeps playing and the notes
// textarea keeps focus. renderPhone() only rebuilds when the app, open
// state, wallpaper, gallery count, or MSG list changes.
var PHONE_WALLPAPERS = [
  { id: "vaporwave", label: "Vaporwave", bg: "linear-gradient(160deg,#2b1055 0%,#7597de 42%,#ff2ea6 78%,#ff9a00 100%)" },
  { id: "retro80s", label: "Retro 80s", bg: "radial-gradient(circle at 50% 36%,#ffd75e 0%,#ff9a3d 16%,#ff5e62 32%,transparent 34%),linear-gradient(180deg,#1a0b2e 0%,#3b1d5e 45%,#ff6b35 75%,#2b1055 100%)" },
  { id: "neon", label: "Neon", bg: "radial-gradient(circle at 22% 18%,rgba(0,229,255,.4),transparent 55%),radial-gradient(circle at 82% 82%,rgba(255,46,166,.4),transparent 55%),#05050a" },
  { id: "goth", label: "Goth", bg: "radial-gradient(circle at 50% 0%,rgba(124,77,255,.35),transparent 60%),linear-gradient(160deg,#000000 0%,#1a0b2e 55%,#3b0a3b 100%)" },
];
var PHONE_WALLPAPER_KEY = "dwc-phone-wallpaper";
function phoneWallpaperBg(id) {
  var found = null;
  PHONE_WALLPAPERS.forEach(function (x) { if (x.id === id) found = x; });
  return found ? found.bg : PHONE_WALLPAPERS[0].bg;
}
function loadPhoneWallpaper() {
  try { var w = localStorage.getItem(PHONE_WALLPAPER_KEY); if (w) state.phone.wallpaper = w; } catch (e) {}
}
function savePhoneWallpaper(id) {
  try { localStorage.setItem(PHONE_WALLPAPER_KEY, id); } catch (e) {}
}
function phoneTime() {
  var d = new Date();
  var h = d.getHours();
  var ap = h >= 12 ? " PM" : " AM";
  h = h % 12 || 12;
  var m = d.getMinutes();
  return h + ":" + (m < 10 ? "0" : "") + m + ap;
}
function phoneDate() {
  var d = new Date();
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[d.getMonth()] + " " + d.getDate();
}
function phoneClockText() { return phoneDate() + "  " + phoneTime(); }
function phoneTickClock() {
  var el = document.getElementById("tp-clock");
  if (el) el.textContent = phoneClockText();
}
var TP_SIGNAL_BARS =
  '<svg width="17" height="11" viewBox="0 0 17 11" aria-hidden="true"><rect x="0" y="7" width="3" height="4" rx="0.5" fill="#fff"/><rect x="4.5" y="5" width="3" height="6" rx="0.5" fill="#fff"/><rect x="9" y="2.5" width="3" height="8.5" rx="0.5" fill="#fff"/><rect x="13.5" y="0" width="3" height="11" rx="0.5" fill="#fff"/></svg>';
var TP_STATUS_ICONS =
  '<svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M1.5 4.5a9 9 0 0 1 13 0"/><path d="M4 7.5a5.5 5.5 0 0 1 8 0"/><circle cx="8" cy="10" r="1.2" fill="#fff" stroke="none"/></svg>' +
  '<svg width="25" height="12" viewBox="0 0 25 12" aria-hidden="true"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".5"/><rect x="2" y="2" width="16" height="8" rx="2" fill="#fff"/><path d="M23.5 4v4a2 2 0 0 0 0-4z" fill="#fff" fill-opacity=".5"/></svg>';
var TP_ICON_MSG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.5 2 2 5.9 2 10.8c0 2.8 1.5 5.2 3.8 6.8L4.5 22l5-2.7c.8.2 1.6.3 2.5.3 5.5 0 10-3.9 10-8.8S17.5 2 12 2z" fill="#fff"/></svg>';
var TP_ICON_GALLERY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" fill="#fff"/><path d="M5 17l4.5-4.5L12 15l3-3 4 4" stroke="#f59e0b" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="9" r="1.6" fill="#f59e0b"/></svg>';
var TP_ICON_NOTES = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" fill="#fff"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round"/></svg>';
var TP_ICON_TUTORIAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="#fff"/></svg>';

function phoneTopbarHTML(title) {
  return '<div class="tp-topbar"><button type="button" class="tp-back" onclick="DWC.phoneGo(\'home\')">‹ Home</button><strong>' + esc(title) + '</strong><button type="button" class="tp-min" onclick="DWC.phoneMinimize()" title="Minimize the phone">—</button></div>';
}
function phoneAppTile(app, label, iconHTML) {
  return '<button type="button" class="tp-app" onclick="DWC.phoneGo(\'' + app + '\')">' + iconHTML + '<span>' + esc(label) + '</span></button>';
}
function phoneHomeHTML() {
  var name = state.profile ? "@" + state.profile.username : "friend";
  return '<div class="tp-home">' +
    '<p class="tp-hello">Hi, ' + esc(name) + ' 🍬</p>' +
    '<p class="tp-sub">Taffy lives in the Vita Nova app.</p>' +
    '<div class="tp-grid">' +
    phoneAppTile("vitanova", "Vita Nova", '<span class="tp-icon tp-icon-vitanova">' + taffySVG("taffy-appicon", "phone") + '</span>') +
    phoneAppTile("msg", "MSG", '<span class="tp-icon tp-icon-msg">' + TP_ICON_MSG + '</span>') +
    phoneAppTile("gallery", "Gallery", '<span class="tp-icon tp-icon-gallery">' + TP_ICON_GALLERY + '</span>') +
    phoneAppTile("sos", "SOS", '<span class="tp-icon tp-icon-sos"><span class="tp-glyph">SOS</span></span>') +
    phoneAppTile("notes", "Notes", '<span class="tp-icon tp-icon-notes">' + TP_ICON_NOTES + '</span>') +
    phoneAppTile("radio", "radio", '<span class="tp-icon tp-icon-radio"><span class="tp-glyph">♪</span></span>') +
    phoneAppTile("code", "Code", '<span class="tp-icon tp-icon-code"><span class="tp-glyph">&lt;/&gt;</span></span>') +
    phoneAppTile("tutorial", "Available soon — check back later!", '<span class="tp-icon tp-icon-tutorial">' + TP_ICON_TUTORIAL + '</span>') +
    '</div>' +
    '<div class="tp-wall"><span>Wallpaper</span><div class="tp-wall-swatches">' +
    PHONE_WALLPAPERS.map(function (w) {
      return '<button type="button" class="tp-wall-sw' + (state.phone.wallpaper === w.id ? " active" : "") + '" style="background:' + w.bg + '" title="' + esc(w.label) + '" aria-label="' + esc(w.label) + ' wallpaper" onclick="DWC.phoneWallpaper(\'' + w.id + '\')"></button>';
    }).join("") +
    '</div></div>' +
    '<p class="tp-note">Tap an app to open it. The — button (top right) minimizes the phone back to the green button.</p>' +
    '</div>';
}
// ---------- Taffy chat — lightweight, client-side only ----------
// No AI API, no network, no heavy model. Pure keyword/pattern matching
// over a small intent table. Fast, tiny, and honest about what it knows.
// Returns { text, emoji, ascend }. `ascend` = play the ascension loop
// while Taffy "thinks" (layout builds + code questions).
var TAFFY_EMOJI_IDX = 0;
function taffyPickEmoji(list) {
  if (!list || !list.length) return "";
  var e = list[TAFFY_EMOJI_IDX % list.length];
  TAFFY_EMOJI_IDX++;
  return e;
}
var TAFFY_REPLY_IDX = 0;
function taffyPick(list) {
  if (!list || !list.length) return "";
  var r = list[TAFFY_REPLY_IDX % list.length];
  TAFFY_REPLY_IDX++;
  return r;
}
// One meaningful word out of what they typed, for the fallback echo.
function taffyKeyWord(raw) {
  var stop = { how: 1, do: 1, i: 1, the: 1, a: 1, an: 1, can: 1, you: 1, what: 1, is: 1, to: 1, my: 1, it: 1, and: 1, me: 1, please: 1, hey: 1, hi: 1, taffy: 1, dont: 1, of: 1, in: 1, on: 1, for: 1, with: 1, this: 1, that: 1, there: 1, about: 1, get: 1, make: 1, want: 1, need: 1, help: 1, does: 1, did: 1, are: 1, was: 1, were: 1, will: 1, would: 1, should: 1, could: 1 };
  var words = String(raw || "").toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(function (w) { return w.length > 2 && !stop[w]; });
  words.sort(function (a, b) { return b.length - a.length; });
  return words[0] || "";
}
function taffyColorWord(t) {
  var m = t.match(/\b(pink|blue|purple|green|red|orange|gold|yellow|black|white|teal|cyan|magenta|violet)\b/);
  return m ? m[1] : "";
}
function taffyReply(raw) {
  var t = (" " + (raw || "").toLowerCase().replace(/[^a-z0-9' ]/g, " ") + " ");
  var has = function (re) { return re.test(t); };
  var wordCount = t.trim().split(/\s+/).filter(function (w) { return !!w; }).length;
  // Greeting (only when that's basically all they said)
  if (wordCount <= 4 && has(/\b(hi|hello|hey|yo|hiya|howdy|good morning|good afternoon|good evening|sup)\b/))
    return { text: taffyPick(["Hey hey! Good to see you. Ask me about layouts, selling, reports, music, or code — or just say hi back.", "Hey! Taffy here. What's on your mind — a layout, selling something, or just saying hi?", "Hi hi! I'm all ears. Try \u201cbuild me a layout\u201d or \u201chow do I sell?\u201d — or just chat."]), emoji: taffyPickEmoji(["👋", "😊", "✨"]), ascend: false };
  // Who is Taffy / tattoos
  if (has(/\b(who are you|your name|what are you|what's your name)\b/) || has(/\btattoo|904|lokos|prison|jail\b/))
    return { text: taffyPick(["I'm Taffy — your little site helper. Cute up front, and yes… my astral form has the 904 Lokos tattoos. Don't judge, I earned them. Ask me to build you a layout and watch me ascend.", "That's me — Taffy, the little helper that lives in the phone. I build layouts, help with code, and answer site questions. The tattoos are on my astral form, long story."]), emoji: taffyPickEmoji(["🍬", "😎"]), ascend: false };
  // Joke
  if (has(/\bjoke|funny|make me laugh\b/))
    return { text: taffyPick(["Okay, one: why did the Game Boy go to therapy? It had too many unresolved pixels. …I'll stick to layouts.", "What do you call a candy that fixes your page? Taffy — that's literally my job. …Okay, I'll keep the day job."]), emoji: taffyPickEmoji(["😄", "🤣"]), ascend: false };
  // Report / flag / block / bothering
  if (has(/\breport|flag|block|bother|harass|spam|scam|abuse|rude|mean to me|stalking\b/))
    return { text: taffyPick(["Got it — flag it and an admin will see it. Tap \u201cFile a report\u201d below (or head to Reports), and tell them the comment, profile, or message that doesn't belong. For anything still unresolved, email TheRarecandyreserve@proton.me.", "Say no more — that's what Reports is for. Tap \u201cFile a report\u201d, say what happened and where, and Chris will see it in the operator inbox. Blocking happens through reports too."]), emoji: taffyPickEmoji(["🛡️", "🚩"]), ascend: false };
  // Contact admin / support / email / mod
  if (has(/\b(admin|support|contact|email|mod|moderator|owner|human|someone real)\b/))
    return { text: taffyPick(["You can reach an admin two ways: tap \u201cEmail an admin / mod\u201d below (TheRarecandyreserve@proton.me), or \u201cContact support\u201d to message Chris directly. For reports, use the Reports area — that's the operator flag inbox.", "Chris is the one who runs this place. \u201cContact support\u201d messages him directly, or email TheRarecandyreserve@proton.me. If something doesn't belong on the site, file a report instead — that's the fastest way to an admin."]), emoji: taffyPickEmoji(["✉️", "💬"]), ascend: false };
  // Profile picture
  if (has(/\b(profile picture|pfp|avatar|change my picture|upload a photo|upload a picture|profile pic|change my pfp)\b/))
    return { text: taffyPick(["Edit Profile, tap the picture box, pick a JPG, PNG, or WebP under 1.5 MB, and hit Save. If your photo's too big, a screenshot of it is usually small enough.", "Your picture lives in Edit Profile — pick a file under 1.5 MB (JPG, PNG, or WebP) and save. It'll show on your page right away. Too big? Screenshot it first."]), emoji: taffyPickEmoji(["🖼️", "✨"]), ascend: false };
  // My links
  if (has(/\b(add a link|my links|links on my page|attach a link|add links|add a button)\b/))
    return { text: taffyPick(["Edit Profile, find \u201cMy links\u201d, type a label and a URL, hit \u201c+ Add a link\u201d, and save — they show up as buttons on your page. Up to 5.", "Adding a link is easy: Edit Profile \u2192 My links \u2192 label + URL \u2192 save. They show as clean buttons on your page. You can have up to 5."]), emoji: taffyPickEmoji(["🔗", "✨"]), ascend: false };
  // Delete a post (before the post intent)
  if (has(/\b(delete|remove) (a |my |the )?post\b/))
    return { text: taffyPick(["Open your own post and hit Delete — it's yours, it goes away. If it's someone else's post that doesn't belong, report it instead.", "Your post, your call — open it and delete it. Someone else's post bothering you? That's a report, not a delete."]), emoji: taffyPickEmoji(["🗑️", "✨"]), ascend: false };
  // 18+ post (before the general post intent)
  if (has(/\b(18\+|adult|after dark)\b/))
    return { text: taffyPick(["You need to be age-verified first — that's an ID check Chris reviews. Once you're verified, the 18+ area lets you Create a post with a genre and a price.", "The 18+ area is age-verified only. Get verified, then hit Create, pick Photos, Videos, or whatever you're selling, set a price, and post."]), emoji: taffyPickEmoji(["🔞", "✨"]), ascend: false };
  // Post / list an item
  if (has(/\b(post|create a post|make a post|list an item|list something|make a listing|create a listing|how do i list)\b/))
    return { text: taffyPick(["To list something, go to the 18+ area and hit Create — pick Photos, Videos, or whatever you're selling, add a price (0 is free), and post it. Buyers find you through Find a Seller.", "Posting is simple: in the 18+ area, hit Create, pick a genre, set your price, add your tags, and post. Age-verified members only."]), emoji: taffyPickEmoji(["📝", "✨"]), ascend: false };
  // Buy
  if (has(/\b(buy|purchase|how do i buy|buying)\b/))
    return { text: taffyPick(["Find a post you like, tap it, and message the seller in a private chat to sort out payment. Once it's done, tap \u201cTransaction done\u201d in the chat so you both get a receipt.", "Buying works through private chat — find the post, message the seller, agree on payment, and mark it done with the receipt button so there's a record."]), emoji: taffyPickEmoji(["🛒", "💰"]), ascend: false };
  // Pay / payment
  if (has(/\b(pay|payment|paypal|stripe|checkout|how do i pay)\b/))
    return { text: taffyPick(["The shop takes PayPal and Stripe — hit Buy with PayPal or the Stripe button on any listing. In the Community, you and the seller agree payment in private chat.", "For shop stuff, it's PayPal or Stripe right on the listing. For Community sales, you pay the seller however you both agree in private chat — then mark the receipt done."]), emoji: taffyPickEmoji(["💳", "💰"]), ascend: false };
  // Find a seller / buyer
  if (has(/\b(find a seller|find a buyer|find someone|find sellers|find buyers|find a match)\b/))
    return { text: taffyPick(["Hit Find (or Find a Seller / Find a Buyer) and tell it what you want or what you sell — it matches you up and you message them privately.", "The Find area is your matchmaker — set what you're after or what you sell, and it shows you the best matches. Message them privately from there."]), emoji: taffyPickEmoji(["🔍", "✨"]), ascend: false };
  // Payout / get paid
  if (has(/\b(payout|get paid|receive money|how do i get paid|how do i receive)\b/))
    return { text: taffyPick(["Set your payout method and handle in Edit Profile — that's how sellers get paid. The Community takes 1.5% once when the sale completes and you're paid.", "Getting paid starts in Edit Profile — put in your payout method and handle. When a sale completes, the buyer pays you, and the Community takes its 1.5% once."]), emoji: taffyPickEmoji(["💰", "✨"]), ascend: false };
  // Fee
  if (has(/\b(fee|fees|1\.5|commission|what do you take|how much does it cost)\b/))
    return { text: taffyPick(["The Community takes 1.5% once — and only once — when a sale completes and you've been paid. No monthly fee, no listing fee, no cut on the way in.", "Just 1.5%, once, when the sale is done and you're paid. That's it — no listing fees, no monthly fees."]), emoji: taffyPickEmoji(["💰", "🍬"]), ascend: false };
  // Receipts
  if (has(/\b(receipt|receipts|proof of purchase|transaction done)\b/))
    return { text: taffyPick(["In a private chat, tap \u201cTransaction done\u201d, put in the amount and whether you bought or sold — it saves a receipt for both of you before the chat deletes. You can see yours under My receipts.", "Receipts live in the chat — tap \u201cTransaction done\u201d, add the amount, and it records it for both sides. Find all your receipts under My receipts."]), emoji: taffyPickEmoji(["🧾", "✨"]), ascend: false };
  // Change name / bio
  if (has(/\b(change my name|change my bio|edit my bio|change my username|change my chat name|update my bio)\b/))
    return { text: taffyPick(["Edit Profile — your chat name, bio, and occupation are all right there. Save and it updates everywhere.", "All in Edit Profile: chat name, bio, occupation, even your birthday. Change it, save it, done."]), emoji: taffyPickEmoji(["✏️", "✨"]), ascend: false };
  // Subscribe
  if (has(/\b(subscribe|follow a seller|subscribe to)\b/))
    return { text: taffyPick(["On a seller's page, hit their Subscribe button — the label is theirs, so it might say something custom. It's how you follow a seller.", "Find a seller you like and tap Subscribe on their page. The button text is theirs, so it might say anything — but it means follow them."]), emoji: taffyPickEmoji(["⭐", "✨"]), ascend: false };
  // Top Friends
  if (has(/\b(top friends|top 8|top eight)\b/))
    return { text: taffyPick(["Edit Profile, pick up to 8 Top Friends — they show up as tiles on your page, MySpace-style. Your friends, front and center.", "Top Friends are your Top 8 — pick them in Edit Profile and they show as tiles on your page. Change them anytime."]), emoji: taffyPickEmoji(["🌟", "✨"]), ascend: false };
  // Phone
  if (has(/\b(phone|my phone|the phone|apps|gallery|notes app)\b/))
    return { text: taffyPick(["The green button opens my phone — 8 apps: me, MSG for friends, Gallery, SOS, Notes, radio, Code, and Tutorial. Tap the \u2014 to minimize me back to the button.", "My phone has 8 apps — Vita Nova (me!), MSG, Gallery, SOS, Notes, radio, Code, and Tutorial. The green call button opens it, the \u2014 button closes it."]), emoji: taffyPickEmoji(["📱", "✨"]), ascend: false };
  // Shop (where is it)
  if (has(/\bwhere\b.{0,15}\b(shop|store)\b|\b(go to|take me to|visit|open)\b.{0,15}\b(shop|store)\b|\b(shop|store) page\b/))
    return { text: taffyPick(["Hit Shop in the top nav — that's the Rare Candy Reserve store, cards, handhelds, and all.", "The shop is one tap away — Shop in the top nav takes you to the store. Cards, pins, handhelds, the lot."]), emoji: taffyPickEmoji(["🛍️", "🍬"]), ascend: false };
  // Donate
  if (has(/\b(donate|donation|donations)\b/))
    return { text: taffyPick(["Hit Donate in the top nav — it goes to the shop and keeps this place running. Early supporters get first access to new drops.", "Donate in the top nav. It keeps the lights on here, and early supporters get first access to new drops."]), emoji: taffyPickEmoji(["❤️", "🍬"]), ascend: false };
  // Layout / theme / customize my page (echoes a color word when they name one)
  if (has(/\blayout|theme|customi[sz]e|my page|profile.*(look|design|color|style)|background|wallpaper\b/)) {
    var cw = taffyColorWord(t);
    if (cw) {
      var cap = cw.charAt(0).toUpperCase() + cw.slice(1);
      return { text: cap + ", got it — that's a great pick. Type it into the mood box in the Layout Bot (like \u201c" + cw + " background\u201d or \u201c" + cw + " buttons\u201d) and I'll build your theme around it. Hit \u201cOpen the Layout Bot\u201d and I'll do the rest.", emoji: taffyPickEmoji(["🎨", "✨"]), ascend: true };
    }
    return { text: taffyPick(["Let's make your page yours! Hit \u201cOpen the Layout Bot\u201d and I'll build you a theme — pick a vibe, an accent color, and a few mood words. Or open Edit Profile and use the layout presets and custom CSS yourself.", "Oh, I love this part — tell me the vibe and the mood and I'll build you a whole theme. \u201cDark blue background, big headings, round buttons\u201d — that kind of thing. The Layout Bot does the writing."]), emoji: taffyPickEmoji(["🎨", "✨"]), ascend: true };
  }
  // Code / CSS
  if (has(/\bcode|css|html|javascript|js\b|script|program|develop/))
    return { text: taffyPick(["Code time! Open the Code app on the phone home screen — it opens the layout and custom-CSS editor — and I'll stay open alongside you. Tell me what you're trying to build and I'll point you to the right spot.", "The code editor lives in Edit Profile — your MySpace layout box, with custom CSS and a live preview. Open it from the phone's Code app and I'll hang out while you work."]), emoji: taffyPickEmoji(["💻", "💡"]), ascend: true };
  // Sell / list / price / money (general)
  if (has(/\bsell|listing|list it|price|pricing|how much|shop|store|earn|make money|marketplace\b/))
    return { text: taffyPick(["Selling here is simple: your page is free, you list what you make or collect, and buyers find you. The Community takes just 1.5% once — and only once — when the sale completes and you're paid. Need a price? Tell me the item and I'll help you think it through.", "List it, sell it, get paid — that's the whole deal. Your page is free, the Community takes 1.5% once when the sale completes. If you're stuck on a price, tell me the item and we'll figure it out."]), emoji: taffyPickEmoji(["💰", "🍬"]), ascend: false };
  // Music / radio / songs
  if (has(/\bmusic|radio|song|track|playlist|listen|play.*music|steady wave|vita nova\b/))
    return { text: taffyPick(["Turn it up! The radio app on the phone plays Steady Wave live, and on your profile you can pick up to 5 A Steady Heart tracks to show off. More licensed songs and public-domain pieces like Canon in D are coming too.", "Steady Wave is live on the radio app — 24/7. And your profile can show off up to 5 A Steady Heart tracks. More songs are coming, licensed and public domain."]), emoji: taffyPickEmoji(["🎵", "🎶"]), ascend: false };
  // Help (narrowed — specific "how to" questions hit their own intent above)
  if (has(/\bhelp|what can you do|commands|what do you do\b/))
    return { text: taffyPick(["Here's what I'm good at: building layouts and themes, helping with code, showing you how to sell and get paid, filing reports, and playing the radio. Try \u201cbuild me a layout\u201d or \u201chow do I sell?\u201d", "I can build you a layout, help with code, explain selling and payouts, point you to reports, or play the radio. Just ask — \u201chow do I add a link?\u201d works too."]), emoji: taffyPickEmoji(["💡", "✨"]), ascend: false };
  // Thanks (only when that's basically all they said)
  if (wordCount <= 4 && has(/\bthank|thanks|thx|\bty\b|appreciated\b/))
    return { text: taffyPick(["Anytime! That's what I'm here for. Go make something cool.", "You got it! Now go make your page look amazing."]), emoji: taffyPickEmoji(["😊", "💜"]), ascend: false };
  // Bye (only when that's basically all they said)
  if (wordCount <= 4 && has(/\bbye|goodbye|good night|see you|later|gtg\b/))
    return { text: taffyPick(["Bye for now! I'll be right here in the phone whenever you need me.", "See you soon! I'll be here, probably ascending."]), emoji: taffyPickEmoji(["👋", "🌙"]), ascend: false };
  // Fallback — honest, never "I can only help with X, Y, Z."
  // Echo a word they actually said, steer to the closest place, offer Chris.
  var kw = taffyKeyWord(raw);
  var steer = "the FAQ (tap \u2753) or the Reports area is a good place to look";
  if (has(/money|pay|price|cost|fee|payout|sell|buy|shop/)) steer = "for money stuff, Edit Profile holds your payout info and the Find area is where buyers and sellers meet — or ask me \u201chow do I sell?\u201d";
  else if (has(/picture|photo|image|avatar|pfp|profile|link|bio|name/)) steer = "Edit Profile is where pictures, links, and your bio live";
  else if (has(/layout|color|design|theme|page|background|css|code/)) steer = "the code editor (Open the code editor in the phone) is where that gets changed";
  else if (has(/post|sell|list|18|adult/)) steer = "the 18+ area is where posts live — you need to be age-verified first";
  var qw = kw || "that";
  return { text: taffyPick([
    "Hmm, \u201c" + qw + "\u201d — that's a new one for me. " + steer + ". Or tap Contact support and Chris will sort you out.",
    "You got me on that one — I don't have \u201c" + qw + "\u201d in my little brain yet. " + steer + ".",
    "I'm not sure about \u201c" + qw + "\u201d yet, but I'm learning. " + steer + " — or ask Chris, he runs this place.",
    "Good question, and I don't want to guess — \u201c" + qw + "\u201d isn't something I know yet. " + steer + ". If it's urgent, the Reports area reaches an admin."
  ]), emoji: taffyPickEmoji(["🤔", ""]), ascend: false };
}
function phoneChatBubbleHTML(m) {
  var cls = m.who === "me" ? "tp-bubble-me" : "tp-bubble-taffy";
  var body = (m.emoji ? esc(m.emoji) + " " : "") + esc(m.text);
  return '<div class="tp-bubble ' + cls + '">' + body + '</div>';
}
function phoneChatLogHTML() {
  return state.phoneChat.map(phoneChatBubbleHTML).join("");
}
function phoneChatAdd(who, text, emoji) {
  state.phoneChat.push({ who: who, text: text, emoji: emoji || "" });
  if (state.phoneChat.length > 60) state.phoneChat.splice(0, state.phoneChat.length - 60);
  var log = document.getElementById("tp-chat-log");
  if (log) {
    log.insertAdjacentHTML("beforeend", phoneChatBubbleHTML({ who: who, text: text, emoji: emoji || "" }));
    while (log.children.length > state.phoneChat.length) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }
}
function phoneTaffyHTML() {
  var chatOpen = !!state.phoneChatOpen;
  return phoneTopbarHTML("Vita Nova") + '<div class="tp-appview tp-taffy-full">' +
    '<div class="tp-taffy" id="dwc-phone-taffy" onclick="DWC.phoneChatClose()">' + taffySVG("taffy", "phone") + '</div>' +
    '<p class="tp-note">Hi, I’m Taffy! I build layouts, help with code, and answer questions about building your site.</p>' +
    '<p><button type="button" class="btn small" onclick="DWC.phoneAscend()">✨ Make Taffy ascend</button> <button type="button" class="btn ghost small" onclick="DWC.phoneOpenEditor()">Open the code editor →</button></p>' +
    taffyHelpHTML(true) +
    '<div class="tp-chat' + (chatOpen ? " open" : "") + '" id="tp-chat">' +
    '<button type="button" class="tp-chat-head" onclick="DWC.phoneChatToggle()"><span>💬 ' + (chatOpen ? "Chat with Taffy" : "Tap to chat with Taffy") + '</span><span class="tp-chat-chev">' + (chatOpen ? "⌄" : "⌃") + '</span></button>' +
    '<div class="tp-chat-log" id="tp-chat-log">' + phoneChatLogHTML() + '</div>' +
    '<div class="tp-chat-bar"><input id="tp-chat-input" type="text" placeholder="Message Taffy…" autocomplete="off" maxlength="300" onkeydown="if(event.key===\'Enter\'){DWC.phoneChatSend();}"><button type="button" class="tp-chat-send" onclick="DWC.phoneChatSend()" aria-label="Send message to Taffy">➤</button></div>' +
    '</div>' +
    '</div>';
}
async function loadPhoneMsgList() {
  if (!state.profile || state.phoneMsgList) return;
  var data = await apiGet("/members?limit=60");
  var members = (data && data.members) || [];
  var mine = state.profile.id;
  var tops = {};
  (state.profile.top_friend_ids || []).forEach(function (id) { tops[id] = true; });
  members = members.filter(function (m) { return m.id !== mine; });
  members.sort(function (a, b) { return ((tops[b.id] ? 1 : 0) - (tops[a.id] ? 1 : 0)); });
  state.phoneMsgList = members;
  if (state.phone.open && state.phone.app === "msg") renderPhone();
}
function phoneMsgHTML() {
  // Taffy is IN the contacts, first — tap him and he opens in the phone,
  // same as the Vita Nova app on the home screen. Both paths lead to Taffy.
  var rows = '<button type="button" class="tp-contact" onclick="DWC.phoneGo(\'vitanova\')">' +
    '<span class="tp-contact-face">' + taffySVG("taffy-contact", "phone2") + '</span>' +
    '<span><strong>Taffy</strong><em>Your little site helper — tap to message him</em></span><span class="tp-contact-go">›</span></button>';
  if (!state.profile) {
    rows += '<p class="tp-note">Create your account to message friends — Taffy is here either way.</p><p><button type="button" class="btn small" onclick="DWC.phoneMinimize();DWC.openSignup()">Create account — it’s free</button></p>';
  } else if (!state.phoneMsgList) {
    rows += '<p class="tp-note">Loading friends…</p>';
    loadPhoneMsgList();
  } else if (!state.phoneMsgList.length) {
    rows += '<p class="tp-note">No other members yet — you’re the first one here. Add friends in Edit profile (Top 8) and they’ll show up here.</p>';
  } else {
    rows += state.phoneMsgList.map(function (m) {
      return '<button type="button" class="tp-contact" onclick="DWC.phoneMsgMember(' + m.id + ', \'' + esc(m.username.replace(/'/g, "")) + '\')">' +
        '<span class="tp-contact-av">' + esc((m.username || "?").slice(0, 1).toUpperCase()) + '</span>' +
        '<span><strong>@' + esc(m.username) + '</strong><em>Tap to message</em></span><span class="tp-contact-go">›</span></button>';
    }).join("");
  }
  return phoneTopbarHTML("MSG — Contacts") + '<div class="tp-appview">' + rows + '</div>';
}
function phoneGalleryHTML() {
  var items = state.phoneGallery;
  var thumbs = items.length
    ? '<div class="tp-gallery">' + items.map(function (it, i) {
        return '<figure><img src="' + esc(it.url) + '" alt="" onclick="DWC.phoneGalleryOpen(' + i + ')"><button type="button" onclick="DWC.phoneGalleryDel(' + i + ')" title="Delete">✕</button><figcaption>' + esc(it.name) + '</figcaption></figure>';
      }).join("") + '</div>'
    : '<p class="tp-note">No photos here yet — add one below.</p>';
  return phoneTopbarHTML("Gallery") + '<div class="tp-appview">' +
    '<p class="tp-note">Session gallery — photos live here for 10 minutes, then they’re gone. Nothing is uploaded to the site.</p>' +
    thumbs +
    '<label class="btn small tp-filebtn">+ Add a photo<input type="file" accept="image/*" hidden onchange="DWC.phoneGalleryAdd(this)"></label>' +
    '<p class="tp-note">' + items.length + ' / 6 photos</p></div>';
}
function phoneSosHTML() {
  return phoneTopbarHTML("SOS") + '<div class="tp-appview tp-sosview">' +
    '<p class="tp-sos-title">Need help right now?</p>' +
    '<p class="tp-note">Something doesn’t belong? File a report — it goes straight to Chris, the operator.</p>' +
    '<button type="button" class="tp-sosbtn" onclick="DWC.phoneSos()">SOS</button>' +
    '<p class="tp-note">For anything unresolved, email <a href="mailto:TheRarecandyreserve@proton.me">TheRarecandyreserve@proton.me</a> or leave a message for the owner of this website or its agents or employees.</p>' +
    '</div>';
}
function phoneNotesHTML() {
  return phoneTopbarHTML("Notes") + '<div class="tp-appview">' +
    '<p class="tp-note">Jot down code or anything — saved in this tab only, gone when you leave. Copy it out before you go.</p>' +
    '<textarea class="tp-notes" rows="10" maxlength="4000" placeholder="Paste or write code here…" oninput="DWC.phoneNotesInput(this)">' + esc(state.phoneNotes) + '</textarea>' +
    '<p><button type="button" class="btn small" onclick="DWC.phoneNotesCopy()">Copy notes</button> <button type="button" class="btn ghost small" onclick="DWC.phoneNotesClear()">Clear</button></p>' +
    '</div>';
}
function phoneRadioHTML() {
  var picks = (state.profile && state.profile.ash_tracks) || [];
  var picksHTML = picks.length
    ? '<ol class="tp-picks">' + picks.map(function (n) { return '<li>' + esc(ASH_TRACKS[n - 1] || ("Track " + n)) + '</li>'; }).join("") + '</ol>'
    : '<p class="tp-note">No picks yet — pick up to 5 A Steady Heart tracks in Edit profile.</p>';
  return phoneTopbarHTML("radio") + '<div class="tp-appview">' +
    '<div class="tp-radio-logo">♪</div>' +
    '<p class="tp-radio-name">Steady Wave</p>' +
    '<p class="tp-note" style="text-align:center">Chris’s station — live, 24/7.</p>' +
    '<audio controls preload="none" src="' + VNR_STREAM_URL + '"></audio>' +
    '<p class="tp-note"><a href="' + VNR_STREAM_URL + '" target="_blank" rel="noopener">Open the stream in a new tab ↗</a></p>' +
    '<h4 style="margin:14px 0 6px">🎵 Your A Steady Heart picks</h4>' +
    '<p class="tp-note">Track names only for now — the individual-track player comes later.</p>' +
    picksHTML +
    '</div>';
}
function phoneCodeHTML() {
  return phoneTopbarHTML("Code") + '<div class="tp-appview">' +
    '<p class="tp-note">The code editor lives in Edit profile — your MySpace layout box, with custom CSS and a live preview.</p>' +
    '<p><button type="button" class="btn" onclick="DWC.phoneOpenEditor()">Open the code editor →</button></p>' +
    '<p><button type="button" class="btn ghost small" onclick="DWC.phoneGo(\'vitanova\')">Keep Taffy open alongside →</button></p>' +
    '<p class="tp-note">Taffy can sit in the phone while you code — or minimize the phone and he’ll wait for you.</p>' +
    '</div>';
}
function phoneTutorialHTML() {
  return phoneTopbarHTML("Tutorial") + '<div class="tp-appview">' +
    '<p class="tp-note"><strong>Available soon — check back later!</strong></p>' +
    '<p class="tp-note">A short video tour of everything Taffy can do is coming — Chris will add it here. It won’t be long, just the gist.</p>' +
    '</div>';
}
function phoneScreenHTML() {
  var app = state.phone.app;
  var inner = "";
  if (app === "vitanova") inner = phoneTaffyHTML();
  else if (app === "msg") inner = phoneMsgHTML();
  else if (app === "gallery") inner = phoneGalleryHTML();
  else if (app === "sos") inner = phoneSosHTML();
  else if (app === "notes") inner = phoneNotesHTML();
  else if (app === "radio") inner = phoneRadioHTML();
  else if (app === "code") inner = phoneCodeHTML();
  else if (app === "tutorial") inner = phoneTutorialHTML();
  else inner = phoneHomeHTML();
  return '<div class="tp-screen" style="background:' + phoneWallpaperBg(state.phone.wallpaper) + '">' +
    '<div class="tp-island"></div>' +
    '<div class="tp-status"><span id="tp-clock">' + phoneClockText() + '</span><span class="tp-status-right"><span class="tp-carrier">VNwireless ' + TP_SIGNAL_BARS + '</span><span class="tp-status-icons">' + TP_STATUS_ICONS + '</span></span></div>' +
    '<div class="tp-body">' + inner + '</div>' +
    '<div class="tp-homebar" onclick="DWC.phoneGo(\'home\')" title="Home"></div>' +
    '</div>';
}
function phoneRenderedKey() {
  return (state.phone.open ? "1" : "0") + "|" + state.phone.app + "|" + state.phone.wallpaper + "|" + state.phoneGallery.length + "|" + (state.phoneMsgList ? state.phoneMsgList.length : "x");
}
function renderPhone() {
  var root = $("dwc-phone-root");
  var btn = $("dwc-phone-btn");
  if (!root) { ensurePhoneRoot(); root = $("dwc-phone-root"); btn = $("dwc-phone-btn"); if (!root) return; }
  if (!state.phone.open) {
    if (state.phoneRenderedKey !== "") { root.innerHTML = ""; state.phoneRenderedKey = ""; }
    if (btn) btn.style.display = "";
    return;
  }
  if (btn) btn.style.display = "none";
  var key = phoneRenderedKey();
  if (key === state.phoneRenderedKey) return; // already showing this — keeps the radio playing + notes focused
  state.phoneRenderedKey = key;
  root.innerHTML = '<div class="tp-phone" role="dialog" aria-label="Taffy’s phone">' + phoneScreenHTML() + '</div>';
}
function ensurePhoneRoot() {
  if ($("dwc-phone-root")) return;
  var root = document.createElement("div");
  root.id = "dwc-phone-root";
  document.body.appendChild(root);
  var btn = document.createElement("button");
  btn.id = "dwc-phone-btn";
  btn.type = "button";
  btn.className = "tp-btn";
  btn.title = "Message Taffy";
  btn.setAttribute("aria-label", "Message Taffy");
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="#fff"/></svg>';
  btn.onclick = function () { DWC.phoneOpen(); };
  document.body.appendChild(btn);
  if (!state.phoneClockStarted) {
    state.phoneClockStarted = true;
    setInterval(phoneTickClock, 30000);
  }
}

function profileFormHTML(p) {
  var isNew = !p;
  var v = function (k) { return p ? esc(p[k] || "") : ""; };
  // v3.2 theme pickers — parsed + validated (hex colors, https image,
  // allowlisted font); all empty unless the member opted in.
  var th = parseThemeClient(p && p.profile_theme);
  return '<section class="card" aria-label="' + (isNew ? "Create your account" : "Edit your profile") + '">' +
    "<h3 style=\"margin-top:0\">" + (isNew ? "Create your account — it’s free" : "Edit your profile") + "</h3>" +
    '<form onsubmit="return DWC.saveProfile(this)">' +
    '<label>Username (2–24 letters, numbers, _ . -)</label>' +
    '<input name="username" required minlength="2" maxlength="24" value="' + v("username") + '" placeholder="Your shop name / username">' +
    '<label>Chat name (shown in Live Chat — defaults to your username)</label>' +
    '<input name="chat_name" maxlength="24" value="' + v("chat_name") + '" placeholder="What should chat call you?">' +
    '<label>Occupation (optional)</label>' +
    '<input name="occupation" maxlength="60" value="' + v("occupation") + '" placeholder="What do you do?">' +
    '<label>About you / your shop</label>' +
    '<textarea name="bio" maxlength="280" placeholder="What do you collect and sell?">' + v("bio") + "</textarea>" +
    '<label>Birthday — month / day only shows publicly, never the year' + (isNew ? " (required — one account per person)" : "") + "</label>" +
    '<input name="birthday" type="date" value="' + (p && p.birthday ? esc(p.birthday) : "") + '"' + (isNew ? " required" : "") + ">" +
    '<label>Payout method (how you want to be paid — needed to sell)</label>' +
    '<input name="payout_method" maxlength="40" value="' + v("payout_method") + '" placeholder="e.g. PayPal, Cash App, Chime…">' +
    '<label>Payout handle</label>' +
    '<input name="payout_handle" maxlength="80" value="' + v("payout_handle") + '" placeholder="Your handle / address on that method">' +
    '<label>Profile picture (JPG, PNG, or WebP, under 1.5 MB — optional; a personal photo is optional, an avatar or none is fine)</label>' +
    '<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" onchange="DWC.avatarPicked(this)">' +
    '<p id="dwc-avatar-note" style="margin:4px 0 0;color:var(--muted);font-size:13px"></p>' +
    (p && p.avatar_url ? '<label><input type="checkbox" name="remove_avatar" style="width:auto"> Remove my current picture</label>' : "") +
    (isNew ? "" :
    '<div class="dwc-layoutbox"><h4 style="margin:0 0 6px">🔗 My links — buttons on your page</h4>' +
    "<p style=\"margin:0 0 8px\">Add links that show as buttons on your member page — your shop, Instagram, whatever. Up to 5. A label and a full link starting with http:// or https://.</p>" +
    '<div id="dwc-links-list">' + myLinksRowsHTML(p ? (p.my_links || []) : []) + '</div>' +
    '<p style="margin:8px 0 0"><button type="button" class="btn ghost small" onclick="DWC.addLinkRow()">+ Add a link</button> <span id="dwc-links-count" style="color:var(--muted);font-size:13px">' + ((p && p.my_links || []).length) + '/5</span></p></div>') +
    (isNew ? "" :
      '<div class="dwc-layoutbox"><h4 style="margin:0 0 6px">🌟 Top 8 — your Top Friends</h4>' +
      "<p style=\"margin:0 0 8px\">MySpace-style: pick up to 8 friends to show on your page. Thanks for the add — now show it off.</p>" +
      '<div id="dwc-topfriends-picker"><p style="color:var(--muted)">Loading members…</p></div>' +
      '<p class="dwc-minihead">Picked: <span id="dwc-top8-count">0</span>/8</p></div>') +
    '<div class="dwc-layoutbox"><h4 style="margin:0 0 6px">🎨 What I sell — your creator card</h4>' +
    "<p style=\"margin:0 0 8px\">This shows on your member page as a seller card, and powers Find a Seller. Only these fields are shown — never your payout handle or real name.</p>" +
    '<label>Content types I sell</label><div class="dwc-checkgrid">' + CREATOR_GENRES.map(function (g) {
      return '<label><input type="checkbox" name="seller_types" value="' + esc(g) + '" style="width:auto"' + ((p && p.seller_types || []).includes(g) ? " checked" : "") + "> " + esc(g) + "</label>";
    }).join("") + "</div>" +
    '<label>My seller tags (comma separated, up to 8 — buyers find you by these)</label>' +
    '<input name="seller_tags" maxlength="240" value="' + esc(p ? (p.seller_tags || []).join(", ") : "") + '" placeholder="e.g. cosplay, custom">' +
    '<label>Open to… (one line, up to 140 characters)</label>' +
    '<input name="seller_open_to" maxlength="140" value="' + v("seller_open_to") + '" placeholder="e.g. custom sets on request">' +
    '<div class="dwc-rowform"><label style="flex:1">My price from ($)<input name="seller_price_min" type="number" step="1" min="0" max="100000" value="' + Math.round(((p && p.seller_price_min_cents) || 0) / 100) + '"></label>' +
    '<label style="flex:1">My price to ($)<input name="seller_price_max" type="number" step="1" min="0" max="100000" value="' + Math.round(((p && p.seller_price_max_cents) || 0) / 100) + '"></label></div>' +
    '<label>Subscribe button text — what the button on your page says (up to 40 characters; default “Subscribe to my page”)</label>' +
    '<input name="subscribe_label" maxlength="40" value="' + esc(p ? (p.subscribe_label || "Subscribe to my page") : "Subscribe to my page") + '" placeholder="Subscribe to my page"></div>' +
    '<div class="dwc-layoutbox"><h4 style="margin:0 0 6px">🔍 What I’m after — as a buyer</h4>' +
    "<p style=\"margin:0 0 8px\">Powers Find a Buyer. Same deal — only these fields are shown.</p>" +
    '<label>Content types I want</label><div class="dwc-checkgrid">' + CREATOR_GENRES.map(function (g) {
      return '<label><input type="checkbox" name="buyer_types" value="' + esc(g) + '" style="width:auto"' + ((p && p.buyer_types || []).includes(g) ? " checked" : "") + "> " + esc(g) + "</label>";
    }).join("") + "</div>" +
    '<label>Tags I’m after (comma separated, up to 8)</label>' +
    '<input name="buyer_tags" maxlength="240" value="' + esc(p ? (p.buyer_tags || []).join(", ") : "") + '" placeholder="e.g. cosplay, amateur">' +
    '<label>My budget — up to ($)</label>' +
    '<input name="buyer_budget" type="number" step="1" min="0" max="100000" value="' + Math.round(((p && p.buyer_budget_max_cents) || 0) / 100) + '"></div>' +
    (isNew ? "" :
      '<div class="dwc-layoutbox"><h4 style="margin:0 0 6px">🎵 Music — A Steady Heart + Steady Wave</h4>' +
      "<p style=\"margin:0 0 8px\">Feature A Steady Heart on your page — pick up to 5 tracks from “End of the year”. Track names only, no audio player for individual tracks yet. The radio player is the live station stream. Either, both, or neither — your call.</p>" +
      '<label>My A Steady Heart tracks (pick up to 5)</label><div class="dwc-checkgrid dwc-trackgrid">' + ASH_TRACKS.map(function (t, i) {
        var n = i + 1;
        return '<label><input type="checkbox" name="ash_tracks" value="' + n + '" style="width:auto"' + ((p && p.ash_tracks || []).includes(n) ? " checked" : "") + ' onchange="DWC.ashTrackChanged(this)"> ' + n + ". " + esc(t) + "</label>";
      }).join("") + "</div>" +
      '<p class="dwc-minihead">Picked: <span id="dwc-ash-count">' + ((p && p.ash_tracks || []).length) + "</span>/5</p>" +
      '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">More songs coming — I’ll keep adding legally available, licensed songs besides my own, from other artists with secured licenses and public domain pieces like Canon in D. I like working to stuff like that.</p>' +
      '<label><input type="checkbox" name="show_vnr_player" style="width:auto"' + (p && p.show_vnr_player ? " checked" : "") + '> 📻 Show Steady Wave player on my profile</label>' +
      '<label><input type="checkbox" name="autoplay_vnr" style="width:auto"' + (p && p.autoplay_vnr ? " checked" : "") + '> ▶️ Autoplay the Steady Wave player when someone visits my page</label>' +
      '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">A small live player for the Steady Wave stream shows on your page. It just streams the station — no track selection, no playlist.</p></div>') +
    '<div class="dwc-layoutbox"><h4 style="margin:0 0 6px">🎨 MySpace layout — make this page yours</h4>' +
    "<p style=\"margin:0 0 8px\">Pick a preset, or paste your own CSS. Your layout shows on <strong>your page only</strong> — it never touches anyone else's.</p>" +
    '<div class="dwc-presets">' +
    '<button type="button" class="dwc-pill' + (v("layout_preset") === "" ? " active" : "") + '" data-presetbtn="" onclick="DWC.applyLayoutPreset(\'\')">None</button>' +
    LAYOUT_PRESETS.map(function (pr) {
      return '<button type="button" class="dwc-pill' + (v("layout_preset") === pr.id ? " active" : "") + '" data-presetbtn="' + pr.id + '" onclick="DWC.applyLayoutPreset(\'' + pr.id + '\')">' + esc(pr.name) + "</button>";
    }).join("") + "</div>" +
    '<label>Custom CSS — paste a MySpace layout’s CSS here, or tweak a preset</label>' +
    '<textarea name="layout_css" rows="8" maxlength="8000" placeholder="e.g. .dwc-myprofile{background:#003399;} .dwc-myprofile .card{border:2px solid #fff;}" oninput="DWC.layoutCssEdited(this)">' + v("layout_css") + "</textarea>" +
    '<input type="hidden" name="layout_preset" value="' + v("layout_preset") + '">' +
    "<p class=\"dwc-limits\">Limits, plain and simple: <strong>CSS only</strong> — no &lt;script&gt;, no @import, no external stylesheets or fonts. Images inside url() must be https://. position:fixed is treated as absolute so a layout can't cover the site. An old MySpace layout's CSS works as far as plain CSS goes — anything that needs scripts or outside files won't. Your layout targets the hooks <code>.dwc-myprofile</code>, <code>.card</code>, <code>h2/h3</code>, <code>a</code>, <code>.dwc-avatar</code>, <code>.btn</code>, <code>.dwc-topfriend</code>.</p>" +
    '<h4 style="margin:14px 0 6px">🎨 My page theme — colors, background &amp; font</h4>' +
    "<p style=\"margin:0 0 8px\">Pickers only — nothing changes unless you tick a box or pick something. These sit on top of your preset; your custom CSS can still override them with !important.</p>" +
    '<div class="dwc-themebox">' +
    '<label><input type="checkbox" name="theme_bg_use" style="width:auto"' + (th.bg_color ? " checked" : "") + '> Use a custom background color</label>' +
    '<input type="color" name="theme_bg_color" value="' + (th.bg_color || "#12002e") + '" style="width:64px;height:40px;padding:2px">' +
    '<label>Background image URL (https:// — optional, shows behind everything on your page)</label>' +
    '<input name="theme_bg_image" maxlength="500" value="' + esc(th.bg_image_url) + '" placeholder="https://…">' +
    '<label><input type="checkbox" name="theme_text_use" style="width:auto"' + (th.text_color ? " checked" : "") + '> Use a custom text color</label>' +
    '<input type="color" name="theme_text_color" value="' + (th.text_color || "#f2f2f8") + '" style="width:64px;height:40px;padding:2px">' +
    '<label><input type="checkbox" name="theme_accent_use" style="width:auto"' + (th.accent_color ? " checked" : "") + '> Use a custom accent color (links, headings, friend borders)</label>' +
    '<input type="color" name="theme_accent_color" value="' + (th.accent_color || "#ff2d95") + '" style="width:64px;height:40px;padding:2px">' +
    '<label>Font</label><select name="theme_font">' + THEME_FONTS.map(function (f) { return '<option value="' + f.id + '"' + (th.font === f.id ? " selected" : "") + ">" + esc(f.name) + "</option>"; }).join("") + "</select>" +
    "</div>" +
    '<h4 style="margin:12px 0 6px">Live preview</h4><div id="dwc-layout-preview">' + layoutPreviewInnerHTML(p) + "</div></div>" +
    '<div class="dwc-layoutbox dwc-bot"><div class="taffy-row"><div id="dwc-taffy">' + taffySVG("taffy", "bot") + '</div><div><h4 style="margin:0 0 6px">🍬 Meet Taffy — your little site helper</h4>' +
    "<p style=\"margin:0\">Hi, I'm Taffy! I build layouts, help with code, and answer questions about building your site. I can also help with support, reports, blocking, and FAQ — anything site-related, I'm on it.</p></div></div>" +
    "<p style=\"margin:8px 0\">Pick a vibe, pick a color, then describe what you want in plain words — a color for the background, bigger headings, round buttons, no borders — and I'll write the whole theme for you. Preview it, then hit “Use this layout”. No AI service involved — I build it right here from real palettes.</p>" +
    '<label>Vibe</label><select id="dwc-bot-vibe">' + Object.keys(LAYOUT_VIBES).map(function (k) { return '<option value="' + k + '">' + esc(LAYOUT_VIBES[k].label) + "</option>"; }).join("") + "</select>" +
    '<label>Accent color</label><div class="dwc-rowform"><input type="color" id="dwc-bot-accent" value="#ff2d95" style="flex:0 0 auto;width:64px;height:40px;padding:2px">' +
    ["#ff2d95", "#00e5ff", "#7c4dff", "#39ff88", "#ff9a00", "#d4af37"].map(function (c) {
      return '<button type="button" class="dwc-swatch" style="background:' + c + '" title="' + c + '" onclick="DWC.botAccent(\'' + c + '\')">&nbsp;</button>';
    }).join("") + "</div>" +
    '<label>Mood — describe it your way (optional)</label>' +
    '<input id="dwc-bot-mood" maxlength="80" placeholder="e.g. dark blue background, big headings, round buttons">' +
    '<p style="margin-top:12px"><button type="button" class="btn" onclick="DWC.runLayoutBot()">Generate my layout →</button></p>' +
    taffyHelpHTML() +
    '<div id="dwc-bot-result"></div></div>' +
    (isNew ?
      '<label>Full name (required — one account per person; never shown publicly)</label>' +
      '<input name="full_name" required minlength="2" maxlength="80" placeholder="Your full name">' +
      '<div id="dwc-challenge" class="dwc-challenge">Loading human check…</div>' +
      '<label>Human check answer</label>' +
      '<input name="bot_answer" type="number" min="0" max="999" placeholder="Your answer" required>' +
      '<label><input type="checkbox" name="terms_agreed" required style="width:auto"> I agree to the street rules (see Rules &amp; After Dark).</label>' : "") +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">' + (isNew ? "Create my account →" : "Save profile →") + "</button> " +
    '<button type="button" class="btn ghost" onclick="DWC.cancelProfileForm()">Cancel</button></p>' +
    "</form></section>";
}

async function loadChallenge() {
  var data = await apiGet("/challenge");
  state.challenge = data && data.token ? data : null;
  var el = $("dwc-challenge");
  if (el) el.innerHTML = state.challenge ? esc(state.challenge.question) : "Human check couldn't load — try again.";
}

// ---------- MySpace throwback v2: Top Friends picker + layout editor ----------
var botLayoutCSS = ""; // Layout Bot's latest generated theme (until "Use this layout")

async function loadTopFriendPicker() {
  var host = $("dwc-topfriends-picker");
  if (!host) return;
  var data = await apiGet("/members?limit=60");
  var members = (data && data.members) || [];
  var picked = new Set((state.profile && state.profile.top_friend_ids) || []);
  var mine = state.profile ? state.profile.id : null;
  var others = members.filter(function (m) { return m.id !== mine; });
  if (!others.length) { host.innerHTML = '<p style="color:var(--muted)">No other members to pick from yet — you’re the first one here.</p>'; return; }
  host.innerHTML = '<div class="dwc-checkgrid">' + others.map(function (m) {
    return '<label><input type="checkbox" name="top_friend" value="' + m.id + '" style="width:auto"' + (picked.has(m.id) ? " checked" : "") + ' onchange="DWC.topFriendChanged(this)"> @' + esc(m.username) + "</label>";
  }).join("") + "</div>";
  updateTop8Count();
}
function updateTop8Count() {
  var el = $("dwc-top8-count");
  if (!el) return;
  el.textContent = document.querySelectorAll('input[name="top_friend"]:checked').length;
}
// A Steady Heart picker — max 5 tracks. If a 6th is ticked, untick it
// and say so (the server also caps at 5, so nothing can sneak through).
function updateAshCount() {
  var el = $("dwc-ash-count");
  if (!el) return;
  el.textContent = document.querySelectorAll('input[name="ash_tracks"]:checked').length;
}
function updateLinksCount() {
  var el = $("dwc-links-count");
  if (!el) return;
  el.textContent = document.querySelectorAll('#dwc-links-list .dwc-linkrow').length + "/5";
}
function initLayoutEditor() {
  var ta = document.querySelector('textarea[name="layout_css"]');
  if (ta) applyPreviewCSS(ta.value);
}

// ---------- GIF picker ----------
var gifPick = {}; // formKey -> { url, label }
function gifPickerHTML(formKey) {
  var sel = gifPick[formKey];
  var html = '<div class="dwc-gifbox" data-gifbox="' + esc(formKey) + '">' +
    '<button type="button" class="btn ghost small" onclick="DWC.toggleGifPicker(\'' + esc(formKey) + '\')">🎬 GIF</button> ' +
    (sel ? '<span class="dwc-gif-picked">Picked: ' + esc(sel.label) + ' <button type="button" class="dwc-linklike" onclick="DWC.clearGif(\'' + esc(formKey) + '\')">✕</button></span>' : "") +
    '<div class="dwc-gifgrid" hidden>' +
    GIFS.map(function (g) {
      return '<button type="button" class="dwc-gif" onclick="DWC.pickGif(\'' + esc(formKey) + '\', \'' + gifEmbedUrl(g.id) + '\', \'' + esc(g.label.replace(/'/g, "")) + '\')" title="' + esc(g.label) + '">' +
        '<iframe src="' + gifEmbedUrl(g.id) + '" loading="lazy" title="' + esc(g.label) + '" sandbox="allow-scripts allow-same-origin"></iframe>' +
        '<span>' + esc(g.label) + '</span></button>';
    }).join("") +
    '<p class="dwc-gif-note">GIFs are hosted by GIPHY and link back to their pages. More added over time.</p>' +
    "</div></div>";
  return html;
}
function gifEmbedHTML(url, label) {
  if (!url) return "";
  return '<div class="dwc-gifview"><iframe src="' + esc(url) + '" loading="lazy" title="' + esc(label || "GIF") + '" sandbox="allow-scripts allow-same-origin"></iframe>' +
    '<p>GIF via GIPHY' + (label ? " · " + esc(label) : "") + "</p></div>";
}

// ---------- MySpace layouts: presets + Layout Bot ----------
// Layout CSS targets the .dwc-myprofile hooks only, so a member's layout
// styles THEIR page and nothing else:
//   .dwc-myprofile            the page wrapper (background)
//   .dwc-myprofile .card      panels  ·  h2/h3 headings  ·  a links
//   .dwc-myprofile .dwc-avatar  avatar ring  ·  .btn buttons
//   .dwc-myprofile .dwc-topfriend  Top 8 tiles  ·  .dwc-mypage-head header
var LAYOUT_PRESETS = [
  { id: "classic", name: "Classic MySpace (2005)", css:
    ".dwc-myprofile{background:#fff;font-family:Verdana,Tahoma,Arial,sans-serif;}" +
    ".dwc-myprofile .card{background:#fff;border:1px solid #6699cc;border-radius:4px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#003399;font-family:Verdana,Tahoma,Arial,sans-serif;text-shadow:none;}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#000;}" +
    ".dwc-myprofile .dwc-meta{color:#666;}" +
    ".dwc-myprofile a{color:#003399;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #003399;box-shadow:none;}" +
    ".dwc-myprofile .btn{background:#003399;color:#fff;}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #6699cc;border-radius:4px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #003399;}" },
  { id: "neon", name: "Neon Vaporwave", css:
    ".dwc-myprofile{background:linear-gradient(160deg,#12002e 0%,#2b0057 55%,#0a2a4a 100%);}" +
    ".dwc-myprofile .card{background:rgba(20,0,50,.82);border:1px solid #ff2d95;border-radius:16px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#ff5cb8;text-shadow:0 0 12px rgba(255,45,149,.8);}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#f2f2f8;}" +
    ".dwc-myprofile .dwc-meta{color:#c9b8ff;}" +
    ".dwc-myprofile a{color:#00e5ff;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #ff2d95;box-shadow:0 0 12px rgba(255,45,149,.8);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#ff2d95,#00e5ff);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #ff2d95;border-radius:16px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #ff2d95;}" },
  { id: "midnight", name: "Midnight", css:
    ".dwc-myprofile{background:linear-gradient(160deg,#05050a 0%,#0d0d1f 100%);}" +
    ".dwc-myprofile .card{background:#12122a;border:1px solid #2a2a44;border-radius:12px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#00e5ff;text-shadow:0 0 10px rgba(0,229,255,.6);}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#e8e8f5;}" +
    ".dwc-myprofile .dwc-meta{color:#8a8aa8;}" +
    ".dwc-myprofile a{color:#00e5ff;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #00e5ff;box-shadow:0 0 10px rgba(0,229,255,.6);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#00a8cc,#7c4dff);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #2a2a44;border-radius:12px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #00e5ff;}" },
  { id: "candy", name: "Candy Pop", css:
    ".dwc-myprofile{background:linear-gradient(160deg,#ffd7ef 0%,#e9d5ff 55%,#bff3ff 100%);}" +
    ".dwc-myprofile .card{background:rgba(255,255,255,.9);border:2px solid #ff2d95;border-radius:24px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#d6007a;text-shadow:none;}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#3a0a2a;}" +
    ".dwc-myprofile .dwc-meta{color:#8a5a7a;}" +
    ".dwc-myprofile a{color:#d6007a;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #ff2d95;box-shadow:0 0 12px rgba(255,45,149,.45);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#ff2d95,#ff9a00);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #ff9a00;border-radius:24px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #ff2d95;}" },
  { id: "afterdark", name: "After Dark 🌙", css:
    ".dwc-myprofile{background:linear-gradient(160deg,#0a0014 0%,#1a002e 50%,#2b001f 100%);}" +
    ".dwc-myprofile .card{background:rgba(26,0,46,.88);border:1px solid #ff2ea6;border-radius:16px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#ff5cb8;text-shadow:0 0 14px rgba(255,46,166,.9);}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#f5e8f5;}" +
    ".dwc-myprofile .dwc-meta{color:#c9a8d8;}" +
    ".dwc-myprofile a{color:#ff2ea6;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #ff2ea6;box-shadow:0 0 14px rgba(255,46,166,.9);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#ff2ea6,#7c4dff);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #ff2ea6;border-radius:16px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #ff2ea6;}" },
  { id: "creatorgold", name: "Creator Gold 👑", css:
    ".dwc-myprofile{background:linear-gradient(160deg,#0d0a02 0%,#241a05 55%,#3a2c08 100%);}" +
    ".dwc-myprofile .card{background:#1a1405;border:1px solid #d4af37;border-radius:12px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#f5d76e;text-shadow:0 0 12px rgba(212,175,55,.7);}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#f5eed8;}" +
    ".dwc-myprofile .dwc-meta{color:#b8a468;}" +
    ".dwc-myprofile a{color:#f5d76e;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #d4af37;box-shadow:0 0 12px rgba(212,175,55,.7);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#d4af37,#ffec99);color:#1a1405;}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #d4af37;border-radius:12px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #d4af37;}" },
  { id: "candyshop", name: "Candy Shop 🍬", css:
    ".dwc-myprofile{background:linear-gradient(160deg,#fff0f7 0%,#ffe3f2 40%,#d8f3ff 75%,#e9d5ff 100%);}" +
    ".dwc-myprofile .card{background:rgba(255,255,255,.92);border:2px solid #ff5cb8;border-radius:22px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#c4007a;text-shadow:none;}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#3a0a2a;}" +
    ".dwc-myprofile .dwc-meta{color:#9a5a8a;}" +
    ".dwc-myprofile a{color:#c4007a;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #ff5cb8;box-shadow:0 0 14px rgba(255,92,184,.5);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#ff5cb8,#00c8ff);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #00c8ff;border-radius:22px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #ff5cb8;}" },
  { id: "arcade", name: "Retro Arcade 🕹️", css:
    ".dwc-myprofile{background:linear-gradient(160deg,#0a0a12 0%,#1a0b2e 55%,#0b1a2e 100%);font-family:'Courier New',Courier,monospace;}" +
    ".dwc-myprofile .card{background:#120a24;border:2px solid #00e5ff;border-radius:8px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#ffe600;text-shadow:0 0 12px rgba(255,230,0,.7);}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#e8f6ff;}" +
    ".dwc-myprofile .dwc-meta{color:#8ab8d8;}" +
    ".dwc-myprofile a{color:#00e5ff;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #ffe600;box-shadow:0 0 12px rgba(255,230,0,.6);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#ff2d95,#ffe600);color:#0a0a12;}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #ffe600;border-radius:8px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #00e5ff;}" },
  { id: "ocean", name: "Ocean Deep 🌊", css:
    ".dwc-myprofile{background:linear-gradient(160deg,#001a2e 0%,#003a5c 55%,#005c5c 100%);}" +
    ".dwc-myprofile .card{background:rgba(0,40,70,.85);border:1px solid #4dd8ff;border-radius:16px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#7de8ff;text-shadow:0 0 12px rgba(77,216,255,.7);}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#e8f8ff;}" +
    ".dwc-myprofile .dwc-meta{color:#8ab8d8;}" +
    ".dwc-myprofile a{color:#4dd8ff;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #4dd8ff;box-shadow:0 0 12px rgba(77,216,255,.6);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#0077b6,#00c8a8);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #4dd8ff;border-radius:16px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #4dd8ff;}" },
];
function layoutPresetCSS(id) {
  for (var i = 0; i < LAYOUT_PRESETS.length; i++) if (LAYOUT_PRESETS[i].id === id) return LAYOUT_PRESETS[i].css;
  return "";
}

// ---------- Member-page theme pickers (v3.2) ----------
// Background color/image, text + accent colors, and a font — all optional,
// all validated (hex colors, https:// image, allowlisted font stacks), so
// the CSS built from them can never carry a script or an @import. The
// theme style is injected AFTER the member's layout CSS on their page, so
// the pickers win over a preset for the properties they set; custom CSS
// can still override them with !important.
var THEME_FONTS = [
  { id: "", name: "System default" },
  { id: "comic", name: "Comic / Chalkboard", css: '"Comic Sans MS","Chalkboard SE","Comic Neue",cursive' },
  { id: "typewriter", name: "Typewriter", css: '"Courier New",Courier,monospace' },
  { id: "serif", name: "Classic serif", css: 'Georgia,"Times New Roman",serif' },
  { id: "rounded", name: "Rounded", css: '"Trebuchet MS",Verdana,sans-serif' },
];
function themeFontCSS(id) {
  for (var i = 0; i < THEME_FONTS.length; i++) if (THEME_FONTS[i].id === id) return THEME_FONTS[i].css || "";
  return "";
}
function parseThemeClient(stored) {
  var empty = { bg_color: "", bg_image_url: "", text_color: "", accent_color: "", font: "" };
  if (!stored) return empty;
  var obj;
  try { obj = typeof stored === "string" ? JSON.parse(stored) : stored; } catch (e) { return empty; }
  if (!obj || typeof obj !== "object") return empty;
  var hex = function (v) { return /^#[0-9a-fA-F]{6}$/.test(String(v || "").trim()) ? String(v).trim() : ""; };
  var out = { bg_color: hex(obj.bg_color), bg_image_url: "", text_color: hex(obj.text_color), accent_color: hex(obj.accent_color), font: "" };
  var img = String(obj.bg_image_url || "").trim().slice(0, 500);
  out.bg_image_url = /^https:\/\//i.test(img) ? img : "";
  out.font = themeFontCSS(obj.font) ? obj.font : "";
  return out;
}
function themeCSS(theme) {
  var t = parseThemeClient(theme);
  var css = "";
  if (t.bg_color) css += ".dwc-myprofile{background-color:" + t.bg_color + ";}";
  if (t.bg_image_url) css += '.dwc-myprofile{background-image:url("' + t.bg_image_url.replace(/"/g, "") + '");background-size:cover;background-position:center;background-repeat:no-repeat;}';
  if (t.text_color) css += ".dwc-myprofile{color:" + t.text_color + ";}.dwc-myprofile p,.dwc-myprofile li{color:" + t.text_color + ";}";
  if (t.accent_color) css += ".dwc-myprofile a{color:" + t.accent_color + ";}.dwc-myprofile h2,.dwc-myprofile h3{color:" + t.accent_color + ";}.dwc-myprofile .dwc-topfriend{border-color:" + t.accent_color + ";}";
  if (t.font) css += ".dwc-myprofile{font-family:" + themeFontCSS(t.font) + ";}";
  return css;
}

// Layout Bot vibes — real palettes the bot builds a full theme from.
// No AI API is involved: this is a client-side generator (vibe template
// + accent color + mood keywords). It still writes a complete, working
// theme — background, cards, headings, links, avatar ring, buttons.
var LAYOUT_VIBES = {
  neon: { label: "Neon Vaporwave", bg: "#12002e", bg2: "#2b0057", card: "rgba(20,0,50,.82)", cardBorder: "#ff2d95", accent: "#ff2d95", accent2: "#00e5ff", heading: "#ff5cb8", text: "#f2f2f8", muted: "#c9b8ff", link: "#00e5ff", font: "'Segoe UI', system-ui, sans-serif", radius: "16px", glow: "0 0 12px rgba(255,45,149,.8)" },
  midnight: { label: "Midnight", bg: "#05050a", bg2: "#0d0d1f", card: "#12122a", cardBorder: "#2a2a44", accent: "#00e5ff", accent2: "#7c4dff", heading: "#00e5ff", text: "#e8e8f5", muted: "#8a8aa8", link: "#00e5ff", font: "'Segoe UI', system-ui, sans-serif", radius: "12px", glow: "0 0 10px rgba(0,229,255,.6)" },
  candy: { label: "Candy Pop", bg: "#ffd7ef", bg2: "#e9d5ff", card: "rgba(255,255,255,.9)", cardBorder: "#ff2d95", accent: "#ff2d95", accent2: "#ff9a00", heading: "#d6007a", text: "#3a0a2a", muted: "#8a5a7a", link: "#d6007a", font: "'Trebuchet MS','Segoe UI',sans-serif", radius: "24px", glow: "0 0 12px rgba(255,45,149,.45)" },
  classic: { label: "Classic MySpace (2005)", bg: "#ffffff", bg2: "#e6f0ff", card: "#ffffff", cardBorder: "#6699cc", accent: "#003399", accent2: "#6699cc", heading: "#003399", text: "#000000", muted: "#666666", link: "#003399", font: "Verdana,Tahoma,Arial,sans-serif", radius: "4px", glow: "none" },
  forest: { label: "Forest", bg: "#07130b", bg2: "#14301d", card: "#10231a", cardBorder: "#39ff88", accent: "#39ff88", accent2: "#a8ffce", heading: "#7dffb0", text: "#e8f5ec", muted: "#8ab89a", link: "#7dffb0", font: "Georgia,'Times New Roman',serif", radius: "14px", glow: "0 0 10px rgba(57,255,136,.5)" },
  sunset: { label: "Sunset", bg: "#2b0a1e", bg2: "#7a2a00", card: "rgba(60,16,8,.85)", cardBorder: "#ff9a00", accent: "#ff9a00", accent2: "#ff2d95", heading: "#ffb347", text: "#fff2e8", muted: "#d8a888", link: "#ffb347", font: "'Segoe UI', system-ui, sans-serif", radius: "18px", glow: "0 0 14px rgba(255,154,0,.6)" },
  ocean: { label: "Ocean", bg: "#02131f", bg2: "#083a5c", card: "#0a2438", cardBorder: "#00a8ff", accent: "#00a8ff", accent2: "#00e5ff", heading: "#7dd8ff", text: "#e8f6ff", muted: "#7aa8c8", link: "#7dd8ff", font: "'Segoe UI', system-ui, sans-serif", radius: "14px", glow: "0 0 10px rgba(0,168,255,.55)" },
  bubblegum: { label: "Bubblegum", bg: "#ffe3f2", bg2: "#ffc2e8", card: "#fff5fb", cardBorder: "#ff7ac0", accent: "#ff5cb8", accent2: "#b388ff", heading: "#e6007e", text: "#4a1030", muted: "#a86a90", link: "#e6007e", font: "'Comic Sans MS','Chalkboard SE','Segoe UI',sans-serif", radius: "26px", glow: "none" },
  gold: { label: "Gold Luxe", bg: "#0d0a02", bg2: "#2a1f05", card: "#171204", cardBorder: "#d4af37", accent: "#d4af37", accent2: "#ffec99", heading: "#f5d76e", text: "#f5eed8", muted: "#a89468", link: "#f5d76e", font: "Georgia,'Times New Roman',serif", radius: "10px", glow: "0 0 12px rgba(212,175,55,.55)" },
  dark: { label: "Dark Mode", bg: "#0b0b14", bg2: "#141424", card: "#141424", cardBorder: "#2a2a44", accent: "#7c4dff", accent2: "#00e5ff", heading: "#e8e8f5", text: "#f2f2f8", muted: "#a9a9c0", link: "#00e5ff", font: "'Segoe UI', system-ui, sans-serif", radius: "16px", glow: "none" },
};
// Named background colors — [bg, bg2, light?] so a member can say
// "dark blue background" or "pink background" and actually get it.
// Light backgrounds flip the text dark so it stays readable.
var NAMED_BG = {
  "dark blue": ["#0a2a5e", "#061a3d", false], "light blue": ["#a8d8ff", "#7ab8f0", true],
  "blue": ["#1a5fb4", "#0d3f8a", false], "pink": ["#ff2d95", "#c40e6e", false],
  "purple": ["#7c4dff", "#4d1fc0", false], "violet": ["#7c4dff", "#4d1fc0", false],
  "green": ["#1e7a3c", "#0f4d24", false], "red": ["#c41e1e", "#8a1010", false],
  "orange": ["#e67e00", "#a85a00", false], "gold": ["#b8962e", "#7a6116", true],
  "yellow": ["#e6c200", "#a88f00", true], "black": ["#0b0b14", "#05050a", false],
  "white": ["#ffffff", "#e8e8f0", true], "teal": ["#0a7a7a", "#055252", false],
  "cyan": ["#00a8c8", "#007a94", false], "magenta": ["#d6007a", "#a3005e", false]
};
var NAMED_ACCENT = {
  "pink": "#ff2d95", "blue": "#00a8ff", "purple": "#7c4dff", "violet": "#7c4dff",
  "green": "#39ff88", "red": "#ff3b30", "gold": "#d4af37", "yellow": "#e6c200",
  "orange": "#ff9a00", "teal": "#00c8a8", "cyan": "#00e5ff", "magenta": "#ff2da8",
  "black": "#1a1a2e", "white": "#f2f2f8"
};
function buildLayoutFromVibe(vibeId, accent, mood) {
  var v = LAYOUT_VIBES[vibeId] || LAYOUT_VIBES.neon;
  var acc = /^#[0-9a-fA-F]{6}$/.test(accent || "") ? accent : v.accent;
  var m = String(mood || "").toLowerCase();
  // --- buttons first: "round buttons" / "square buttons" / "<color> buttons" / "big buttons" ---
  // (strip them from the card-radius check so "round buttons" doesn't also round the cards)
  var btnRadius = "", btnSize = "", btnPad = "", btnAcc = null;
  if (/\bround buttons?\b/.test(m)) btnRadius = "999px";
  if (/\bsquare buttons?\b/.test(m)) btnRadius = "4px";
  if (/\bbig buttons?\b/.test(m)) { btnSize = "18px"; btnPad = "12px 22px"; }
  if (/\bsmall buttons?\b/.test(m)) { btnSize = "13px"; btnPad = "6px 12px"; }
  var mCard = m.replace(/\b(round|square|big|small) buttons?\b/g, " ");
  // --- card radius ---
  var radius = v.radius;
  if (/\bround|bubbly|soft|curvy\b/.test(mCard)) radius = "26px";
  if (/\bsharp|square|edgy|brutal\b/.test(mCard)) radius = "4px";
  // --- glow ---
  var glow = v.glow;
  if (/\bglow|neon|bright|shine|lit\b/.test(m)) glow = "0 0 18px " + acc + ", 0 0 34px " + acc;
  if (/\bno glow|flat|plain|matte\b/.test(m)) glow = "none";
  // --- background color by name ("dark blue background", "pink bg", "background red") ---
  var bg = v.bg, bg2 = v.bg2, text = v.text, muted = v.muted, link = v.link, heading = v.heading;
  var bgKey = null;
  var colorNames = Object.keys(NAMED_BG).sort(function (a, b) { return b.length - a.length; });
  for (var ci = 0; ci < colorNames.length; ci++) {
    var cn = colorNames[ci];
    var re = new RegExp("\\b" + cn.replace(/ /g, "\\s+") + "\\s+(background|bg)\\b|\\b(background|bg)\\s+" + cn.replace(/ /g, "\\s+") + "\\b");
    if (re.test(m)) { bgKey = cn; break; }
  }
  if (bgKey) {
    bg = NAMED_BG[bgKey][0]; bg2 = NAMED_BG[bgKey][1];
    if (NAMED_BG[bgKey][2]) { text = "#1a1a2e"; muted = "#5a5a6a"; link = NAMED_ACCENT[bgKey] || v.link; heading = link; }
  } else {
    if (/\bdark|black|midnight|night\b/.test(m)) { bg = "#05050a"; bg2 = "#0d0d1f"; }
    if (/\blight|bright|white|day\b/.test(m) && v !== LAYOUT_VIBES.classic) { bg = "#f5f0ff"; bg2 = "#d8e8ff"; text = "#1a1a2e"; muted = "#5a5a6a"; }
  }
  // --- solid vs gradient background ---
  if (/\bsolid background|solid bg\b/.test(m)) bg2 = bg;
  // --- accent color by name (keeps the old behavior: "pink" -> pink accent) ---
  Object.keys(NAMED_ACCENT).forEach(function (c) {
    if (new RegExp("\\b" + c + "\\b").test(m)) acc = NAMED_ACCENT[c];
  });
  // --- "<color> buttons" overrides just the buttons, not the whole theme ---
  if (btnAcc === null) {
    Object.keys(NAMED_ACCENT).forEach(function (c) {
      if (new RegExp("\\b" + c + "\\s+buttons?\\b").test(m)) btnAcc = NAMED_ACCENT[c];
    });
  }
  if (btnAcc === null) btnAcc = acc;
  // --- heading size ---
  var headSize = "";
  if (/\b(bigger|big|huge|large) (headings?|text|titles?)\b/.test(m)) headSize = "30px";
  if (/\b(small|smaller|tiny) (headings?|text|titles?)\b/.test(m)) headSize = "18px";
  // --- borders ---
  var borderW = "1px";
  if (/\bthick borders?\b/.test(m)) borderW = "3px";
  if (/\bno borders?|borderless\b/.test(m)) borderW = "0";
  // --- spacing ---
  var cardPad = "";
  if (/\bmore space|roomy|spacious|airy\b/.test(m)) cardPad = "28px";
  if (/\btight|compact|cramped\b/.test(m)) cardPad = "10px";
  // --- font ---
  var font = v.font;
  if (/\bfancy font|serif\b/.test(m)) font = "Georgia,'Times New Roman',serif";
  if (/\bfun font|comic|playful font\b/.test(m)) font = "'Comic Sans MS','Chalkboard SE','Segoe UI',sans-serif";
  if (/\bsimple font|plain font|clean font\b/.test(m)) font = "'Segoe UI',system-ui,sans-serif";
  // --- avatar ring ---
  var avBorder = "3px";
  if (/\bthick avatar ring\b/.test(m)) avBorder = "5px";
  if (/\bno avatar ring\b/.test(m)) avBorder = "0";
  return (
    ".dwc-myprofile{background:linear-gradient(160deg," + bg + " 0%," + bg2 + " 100%);}" +
    ".dwc-myprofile .card{background:" + v.card + ";border:" + borderW + " solid " + v.cardBorder + ";border-radius:" + radius + ";" + (cardPad ? "padding:" + cardPad + ";" : "") + "}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:" + heading + ";font-family:" + font + ";text-shadow:" + glow + ";" + (headSize ? "font-size:" + headSize + ";" : "") + "}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:" + text + ";}" +
    ".dwc-myprofile .dwc-meta{color:" + muted + ";}" +
    ".dwc-myprofile a{color:" + link + ";}" +
    ".dwc-myprofile .dwc-avatar{border:" + avBorder + " solid " + acc + ";box-shadow:" + glow + ";}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg," + btnAcc + "," + v.accent2 + ");" + (btnRadius ? "border-radius:" + btnRadius + ";" : "") + (btnSize ? "font-size:" + btnSize + ";" : "") + (btnPad ? "padding:" + btnPad + ";" : "") + "}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid " + acc + ";border-radius:" + radius + ";}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid " + acc + ";}"
  );
}

// Client-side mirror of the server layout sanitizer (for live preview).
// The server is the enforcement point; this keeps the preview honest.
function sanitizeLayoutCssClient(css) {
  var out = String(css || "").slice(0, 8000);
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1\s*>/gi, "");
  out = out.replace(/<\/?(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, "");
  out = out.replace(/@import[^;{}]*;?/gi, "");
  out = out.replace(/@font-face[\s\S]*?}/gi, "");
  out = out.replace(/@charset[^;{}]*;?/gi, "");
  out = out.replace(/javascript\s*:/gi, "");
  out = out.replace(/vbscript\s*:/gi, "");
  out = out.replace(/expression\s*\(/gi, "nope(");
  out = out.replace(/behavior\s*:/gi, "nope:");
  out = out.replace(/position\s*:\s*fixed/gi, "position:absolute");
  out = out.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi, function (_m, d, s, u) {
    var v = String(d ?? s ?? u ?? "").trim();
    if (/^https:\/\//i.test(v) || /^data:image\//i.test(v)) return "url(" + v + ")";
    return "url()";
  });
  return out.trim();
}

// My links editor rows (v3.4) — one row per link: label + URL + remove.
// Renders the member's real links; a blank row is always available so
// adding the first link is one tap.
function myLinksRowsHTML(links) {
  var rows = (links || []).slice(0, 5).map(function (l) {
    return '<div class="dwc-linkrow"><input name="link_label" maxlength="40" placeholder="Label — e.g. My shop" value="' + esc(l.label || "") + '">' +
      '<input name="link_url" maxlength="500" placeholder="https://…" value="' + esc(l.url || "") + '">' +
      '<button type="button" class="btn ghost small" onclick="DWC.removeLinkRow(this)" title="Remove this link">✕</button></div>';
  }).join("");
  if (!rows) {
    rows = '<div class="dwc-linkrow"><input name="link_label" maxlength="40" placeholder="Label — e.g. My shop">' +
      '<input name="link_url" maxlength="500" placeholder="https://…">' +
      '<button type="button" class="btn ghost small" onclick="DWC.removeLinkRow(this)" title="Remove this link">✕</button></div>';
  }
  return rows;
}
function myLinksButtonsHTML(links) {
  if (!links || !links.length) return "";
  return '<div class="dwc-links">' + links.map(function (l) {
    return '<a class="btn dwc-linkbtn" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + ' ↗</a>';
  }).join("") + "</div>";
}

// The layout preview in Edit Profile — shows the member's REAL page
// (their bio, their Top Friends, their links), never fake demo content.
// Empty sections are left out entirely so the preview is honest.
function layoutPreviewInnerHTML(p) {
  var bio = p && p.bio ? esc(p.bio) : null;
  var friends = p && p.top_friend_ids ? p.top_friend_ids : [];
  var links = p && p.my_links ? p.my_links : [];
  var top8 = "";
  if (friends.length) {
    top8 = '<div class="card"><h3>🌟 Top 8</h3><p style="color:var(--muted)">Your ' + friends.length + ' Top Friend' + (friends.length === 1 ? "" : "s") + ' show here.</p></div>';
  }
  return '<div class="dwc-myprofile dwc-previewbox">' +
    '<div class="dwc-mypage-head">' + (p && p.avatar_url ? '<img class="dwc-avatar" src="' + esc(p.avatar_url) + '" alt="" style="width:64px;height:64px">' : '<span class="dwc-avatar dwc-avatar-none">🍬</span>') + '<div><h3 style="margin:0">@' + esc(p ? (p.username || "yourname") : "yourname") + '</h3><p class="dwc-meta">' + esc(p && p.occupation ? p.occupation : "your vibe here") + "</p></div></div>" +
    '<div class="card"><h3>About me</h3>' + (bio ? '<p style="white-space:pre-wrap">' + bio + "</p>" : '<p style="color:var(--muted)">No bio yet.</p>') + "</div>" +
    top8 +
    myLinksButtonsHTML(links) +
    "</div>";
}
function applyPreviewCSS(css) {
  var clean = sanitizeLayoutCssClient(css || "");
  var st = document.getElementById("dwc-layout-preview-style");
  if (!st) {
    st = document.createElement("style");
    st.id = "dwc-layout-preview-style";
    document.head.appendChild(st);
  }
  st.textContent = clean;
  return clean;
}

// ---------- shared bits ----------
function needProfileHTML() {
  return '<div class="card"><h3 style="margin-top:0">Create your account first</h3><p>That needs a username. It’s free — name, username, date of birth, one tiny sum, agree to the rules.</p><p><button type="button" class="btn" onclick="DWC.openSignup()">Create Account — it’s free</button></p><div class="dwc-coin-row"><span class="dwc-insert-coin">⬇ Insert coin ⬇</span><span class="dwc-coin" aria-hidden="true">¢</span></div></div>';
}
function verificationBadge(p) {
  var st = p.verification_status || "not_checked";
  var labels = {
    not_checked: ["Not checked", "var(--muted)"],
    looks_consistent: ["✓ Looks consistent", "var(--green)"],
    suspicious: ["⚠ Suspicious", "var(--amber)"],
    likely_fake_or_proxy: ["⛔ Likely fake / proxy", "#ff5c7a"],
    needs_clearer_photo: ["📷 Needs a clearer photo", "var(--amber)"],
  };
  var l = labels[st] || labels.not_checked;
  var html = '<span class="dwc-vbadge" style="color:' + l[1] + '">' + esc(l[0]) + "</span>";
  if (p.verification_summary) html += '<p class="dwc-vsum">' + esc(p.verification_summary) + "</p>";
  return html;
}
// ---------- Post photos: blur + pay-to-unlock (v3.2, OPT-IN ONLY) ----------
// Default state for every photo: normal, fully visible, free to view.
// Blur and pay-to-unlock apply ONLY when the poster/seller explicitly
// ticked the box when posting. The author always sees their own photo
// unblurred. A blurred photo shows a blurred preview + a tap-to-reveal
// toggle (a preview control, not DRM). A pay-locked photo stays blurred
// for everyone but the author — the only path is the "Pay to unlock"
// button, which opens a private chat with the seller; the receipt marked
// done in that chat is the unlock record. There is no payment backend and
// no automatic unlock: the image URL itself is still fetchable by anyone
// with the link, so this is a preview control, not access control.
function postPhotoHTML(p) {
  if (!p.image_url) return "";
  var mine = state.profile && state.profile.id === p.author_id;
  var locked = !!p.pay_unlock && p.price_cents > 0 && !mine;
  var blurred = !!p.blur_photo && !mine;
  if (locked) {
    return '<div class="dwc-photowrap"><img class="dwc-post-img dwc-img-locked" src="' + esc(p.image_url) + '" alt="Locked preview photo" loading="lazy">' +
      '<div class="dwc-photo-overlay"><span>🔒 Locked — Pay to unlock · ' + money(p.price_cents) + '</span></div></div>';
  }
  if (blurred) {
    return '<div class="dwc-photowrap"><img class="dwc-post-img dwc-img-blurred" src="' + esc(p.image_url) + '" alt="Blurred photo — tap to reveal" loading="lazy">' +
      '<button type="button" class="dwc-reveal-btn" onclick="DWC.toggleBlur(this)">👁 Blurred photo — tap to reveal</button></div>';
  }
  return '<img class="dwc-post-img" src="' + esc(p.image_url) + '" alt="Post photo" loading="lazy">';
}

function postCardHTML(p) {
  var heartOn = myHeart("post-" + p.id);
  var isCreator = !!p.is_creator;
  var priceLabel = isCreator ? (p.price_cents > 0 ? money(p.price_cents) : "Free") : "";
  return '<article class="card dwc-post">' +
    postPhotoHTML(p) +
    gifEmbedHTML(p.gif_url, p.gif_label) +
    '<div class="tag">' + esc(p.category) + (p.flair ? " · " + esc(p.flair) : "") + (p.kind === "card_auth" ? " · 🔍 Card Check" : p.kind === "adult" ? " · 18+" : "") + (isCreator ? " · 🎨 Creator" : "") + "</div>" +
    '<h3 style="margin:8px 0 4px"><a href="#/post/' + p.id + '" class="dwc-titlelink">' + esc(p.title) + "</a></h3>" +
    (isCreator ? '<p class="dwc-creator-line"><span class="dwc-creator-badge">🎨 ' + esc(p.content_genre || "Creator content") + "</span> " +
      '<strong style="color:var(--green);font-size:17px">' + priceLabel + "</strong>" +
      (p.file_url ? ' <span class="dwc-3d-badge">🖨️ 3D print file</span>' : "") + "</p>" : "") +
    '<p>' + esc(p.body.length > 280 ? p.body.slice(0, 280) + "…" : p.body) + "</p>" +
    (p.kind === "card_auth" ? verificationBadge(p) : "") +
    '<p class="dwc-meta">by @' + esc(p.author_username) + (p.author_occupation ? " · " + esc(p.author_occupation) : "") + " · " + fmtDate(p.created_at) + "</p>" +
    (p.tags && p.tags.length ? '<p class="dwc-tags">' + p.tags.map(function (t) { return '<a href="#/tag/' + (p.kind === "adult" ? "adult/" : "") + encodeURIComponent(t) + '">#' + esc(t) + "</a>"; }).join(" ") + "</p>" : "") +
    '<div class="dwc-actions">' +
    '<button type="button" class="dwc-heart' + (heartOn ? " on" : "") + '" onclick="DWC.heartPost(' + p.id + ', this)">' + (heartOn ? "❤️" : "🤍") + " " + (p.score || 0) + "</button>" +
    '<a href="#/post/' + p.id + '">💬 ' + (p.comment_count || 0) + " comments</a>" +
    (p.kind === "card_auth" ? '<span class="dwc-auth">Real ' + p.auth_real + " · Fake " + p.auth_fake + " · Unsure " + p.auth_unsure + "</span>" : "") +
    (isCreator && state.profile && state.profile.id !== p.author_id
      ? (p.pay_unlock && p.price_cents > 0
        ? '<button type="button" class="btn" onclick="DWC.messageSeller(' + p.author_id + ", '" + esc(p.author_username.replace(/'/g, "")) + "', " + p.id + ')">🔓 Pay to unlock — ' + money(p.price_cents) + '</button>'
        : '<button type="button" class="btn small" onclick="DWC.messageSeller(' + p.author_id + ", '" + esc(p.author_username.replace(/'/g, "")) + "', " + p.id + ')">💬 Buy / Message seller</button>') : "") +
    (isCreator && p.file_url && state.profile
      ? '<a class="btn ghost small" href="' + esc(fileDownloadUrl(p.file_url)) + '" download>⬇ ' + esc(p.file_name || "Download 3D file") + "</a>" : "") +
    '<button type="button" class="dwc-linklike" onclick="DWC.copyLink(\'' + postLink(p.id) + '\', this)">🔗 Copy link</button>' +
    '<button type="button" class="dwc-linklike" onclick="DWC.report(\'post\', ' + p.id + ')">🚩 Report</button>' +
    "</div></article>";
}
function listingCardHTML(l) {
  var price = l.kind === "flea" ? (l.current_bid_cents != null ? l.current_bid_cents : l.price_cents) : l.price_cents;
  var priceLabel = l.kind === "flea" ? (l.current_bid_cents != null ? "High bid" : "Starting bid") : l.kind === "trade" ? "Trade value" : "Price";
  return '<article class="card dwc-listing">' +
    (l.image_url ? '<img class="dwc-post-img" src="' + esc(l.image_url) + '" alt="Listing photo" loading="lazy">' : "") +
    '<div class="tag">' + esc(l.category) + " · " + (l.kind === "sale" ? "For sale" : l.kind === "trade" ? "Up for trade" : "🔨 Flea market") + "</div>" +
    '<h3 style="margin:8px 0 4px"><a href="#/listing/' + l.id + '" class="dwc-titlelink">' + esc(l.title) + "</a></h3>" +
    '<p>' + esc(l.description.replace(/<[^>]*>/g, "").slice(0, 200)) + (l.description.length > 200 ? "…" : "") + "</p>" +
    '<p><strong style="color:var(--green);font-size:18px">' + priceLabel + ": " + money(price) + "</strong>" +
    ' <span style="color:var(--muted);font-size:13px">· seller gets ' + money(l.seller_gets_cents) + " after the 5% street cut</span></p>" +
    (l.kind === "flea" ? "<p>🔨 " + l.bid_count + " bid" + (l.bid_count === 1 ? "" : "s") + "</p>" : "") +
    (l.kind === "trade" ? "<p>👍 Good " + l.trade_good + " · Fair " + l.trade_fair + " · Bad " + l.trade_bad + "</p>" : "") +
    '<p class="dwc-meta">by @' + esc(l.seller_username) + (l.seller_occupation ? " · " + esc(l.seller_occupation) : "") + " · " + fmtDate(l.created_at) + "</p>" +
    '<div class="dwc-actions">' +
    '<a class="btn small" href="#/listing/' + l.id + '">View →</a>' +
    '<button type="button" class="dwc-linklike" onclick="DWC.copyLink(\'' + listingLink(l.id) + '\', this)">🔗 Copy link</button>' +
    '<button type="button" class="dwc-linklike" onclick="DWC.report(\'listing\', ' + l.id + ')">🚩 Report</button>' +
    "</div></article>";
}

// ---------- view dispatcher ----------
function renderView() {
  var el = $("dwc-view");
  if (!el) return;
  var r = state.route;
  stopChatPoll();
  // A member's custom layout only lives on their page — take it down
  // whenever we navigate anywhere else.
  var oldLayout = document.getElementById("dwc-member-layout");
  if (oldLayout) oldLayout.remove();
  if (r.name === "street") return viewStreet(el);
  if (r.name === "cardcheck") return viewCardCheck(el);
  if (r.name === "market" || r.name === "trade" || r.name === "flea") return viewMarket(el, r.name);
  if (r.name === "orders") return viewOrders(el);
  if (r.name === "payouts") return viewPayouts(el);
  if (r.name === "members") return viewMembers(el);
  if (r.name === "member") return viewMember(el, Number(r.memberId));
  if (r.name === "chat") return viewChat(el);
  if (r.name === "find") return viewFind(el);
  if (r.name === "headlines") return viewHeadlines(el);
  if (r.name === "receipts") return viewReceipts(el);
  if (r.name === "reports") return viewReports(el);
  if (r.name === "rules") return viewRules(el);
  if (r.name === "adult") return viewAdult(el);
  if (r.name === "tag") return viewTag(el, r.tag, r.adult);
  if (r.name === "thread") return viewThread(el, Number(r.postId));
  if (r.name === "listing") return viewListing(el, Number(r.listingId));
  viewStreet(el);
}

// ---------- The Street ----------
async function viewStreet(el) {
  el.innerHTML =
    '<section class="card"><h2 style="margin-top:0">How the street works</h2><ul class="dwc-rules-list">' +
    "<li><strong>List it free, sell it fair</strong> — listing costs nothing; a fair 5% cut on a sale keeps the street running.</li>" +
    "<li><strong>Sell anything legal</strong> — not just cards. Adult content too, <em>if</em> you’ve proved your age (only ever asked for that — see Rules &amp; After Dark).</li>" +
    "<li><strong>Ask &amp; learn</strong> — post on any topic, tag it so people can find it, and heart the good stuff (❤️ hearts only — no downvotes here).</li>" +
    "<li><strong>One account per person</strong>, and 🚩 Report on any post sends an alert to the owner.</li></ul>" +
    '<p><button type="button" class="btn ghost small" onclick="DWC.go(\'rules\')">Read the full rules →</button></p></section>' +
    '<section class="card"><div class="taffy-row"><div>' + taffySVG("taffy-small", "street") + '</div><div><h3 style="margin:0">🍬 Meet Taffy — your little site helper</h3>' +
    "<p style=\"margin:6px 0 0\">Hi, I'm Taffy! I build layouts, help with code, and answer questions about building your site. I can also help with support, reports, blocking, and FAQ — anything site-related.</p></div></div>" +
    taffyHelpHTML() + '</section>' +
    '<div id="dwc-headlines-strip"></div>' +
    '<div id="dwc-composer"></div>' +
    '<div class="dwc-filters"><div role="group" aria-label="Filter by corner">' +
    '<button type="button" class="dwc-pill' + (state.category === null ? " active" : "") + '" onclick="DWC.setCategory(null)">All corners</button>' +
    CATEGORIES.map(function (c) {
      return '<button type="button" class="dwc-pill' + (state.category === c ? " active" : "") + '" onclick="DWC.setCategory(\'' + esc(c) + '\')">' + esc(c) + "</button>";
    }).join("") +
    '</div><div role="group" aria-label="Sort posts">' +
    [["new", "Newest"], ["top", "Top hearts"], ["discussed", "Most discussed"]].map(function (s) {
      return '<button type="button" class="dwc-pill' + (state.sort === s[0] ? " active" : "") + '" onclick="DWC.setSort(\'' + s[0] + '\')">' + s[1] + "</button>";
    }).join("") + "</div></div>" +
    '<div id="dwc-feed"><p style="color:var(--muted)">Loading posts…</p></div>' +
    '<div id="dwc-tags"><p style="color:var(--muted)">Loading tags…</p></div>';
  renderComposer("street");
  loadHeadlinesStrip();
  var data = await apiGet("/posts?device_id=" + encodeURIComponent(deviceId()) + "&sort=" + state.sort + "&limit=50" + (state.category ? "&category=" + encodeURIComponent(state.category) : ""));
  var feed = $("dwc-feed");
  if (!feed) return;
  var posts = (data && data.posts) || [];
  feed.innerHTML = posts.length
    ? '<div class="grid">' + posts.map(postCardHTML).join("") + "</div>"
    : '<div class="note">No posts yet — be the first to post on the street.</div>';
  var tags = await apiGet("/tags?scope=general&device_id=" + encodeURIComponent(deviceId()));
  var tagEl = $("dwc-tags");
  if (tagEl) {
    var list = (tags && tags.tags) || [];
    tagEl.innerHTML = list.length
      ? '<h3>Trending tags</h3><p class="dwc-tags">' + list.map(function (t) { return '<a href="#/tag/' + encodeURIComponent(t.tag) + '">#' + esc(t.tag) + " (" + t.count + ")</a>"; }).join(" ") + "</p>"
      : "";
  }
}

// ---------- Headlines (v3.1) ----------
// The Community's own most eye-catching posts, ranked by engagement
// (hearts × 2 + comments). Community posts only — no outside news.
// Adult posts only reach age-verified callers (the endpoint enforces it).
function headlineCardHTML(h) {
  return '<article class="card dwc-headline">' +
    '<div class="dwc-headline-eng">🔥 ' + (h.engagement || 0) + ' · ❤️ ' + (h.score || 0) + ' · 💬 ' + (h.comment_count || 0) + "</div>" +
    '<h3 class="dwc-headline-title" style="margin:8px 0 4px"><a href="#/post/' + h.id + '" class="dwc-titlelink">' + esc(h.title) + "</a></h3>" +
    '<p style="margin:4px 0">by <strong>@' + esc(h.author_username) + "</strong>" + (h.kind === "adult" ? " · 18+" : "") + (h.is_creator ? " · 🎨 Creator" : "") + " · " + fmtDate(h.created_at) + "</p>" +
    (h.body ? "<p>" + esc(h.body.length > 140 ? h.body.slice(0, 140) + "…" : h.body) + "</p>" : "") +
    "</article>";
}
async function loadHeadlinesStrip() {
  var host = $("dwc-headlines-strip");
  if (!host) return;
  var data = await apiGet("/headlines?device_id=" + encodeURIComponent(deviceId()) + "&limit=3");
  var list = (data && data.headlines) || [];
  if (!list.length) { host.innerHTML = ""; return; }
  host.innerHTML =
    '<section class="dwc-headlines-strip"><h2 class="dwc-neon-head" style="margin-top:0">🔥 Headlines</h2>' +
    list.map(function (h) {
      return '<p class="dwc-headline-line"><a href="#/post/' + h.id + '">' + esc(h.title) + "</a> <span>🔥 " + (h.engagement || 0) + " · @" + esc(h.author_username) + "</span></p>";
    }).join("") +
    '<p style="margin:8px 0 0"><button type="button" class="btn ghost small" onclick="DWC.go(\'headlines\')">See all headlines →</button></p></section>';
}
async function viewHeadlines(el) {
  el.innerHTML = '<section class="card"><h2 class="dwc-neon-head" style="margin-top:0">🔥 Headlines</h2><p style="color:var(--muted)">The Community’s own most eye-catching posts — ranked by hearts and comments. No outside news, just what the street is shouting about.</p></section><div id="dwc-headlines-list"><p style="color:var(--muted)">Loading headlines…</p></div>';
  var data = await apiGet("/headlines?device_id=" + encodeURIComponent(deviceId()) + "&limit=10");
  var list = (data && data.headlines) || [];
  state.headlines = list;
  var host = $("dwc-headlines-list");
  if (!host) return;
  if (data && data.error) { host.innerHTML = '<div class="note">' + esc(data.error) + "</div>"; return; }
  host.innerHTML = list.length
    ? '<div class="grid">' + list.map(headlineCardHTML).join("") + "</div>"
    : '<div class="note">No headlines yet — post something worth shouting about and it’ll land here.</div>';
}

// ---------- My receipts (v3.1) ----------
// Each member sees ONLY their own receipts — what they spent (and, for
// sellers, what they received) in private chats. No chat content is ever
// kept; a receipt is just amount + note + the other party + date.
async function viewReceipts(el) {
  if (!state.profile) { el.innerHTML = needProfileHTML(); return; }
  el.innerHTML = '<section class="card"><h2 class="dwc-neon-head" style="margin-top:0">🧾 My receipts</h2><p style="color:var(--muted)">Your invoice history from private chats. When you mark a transaction done in a private chat, the receipt lands here — and it stays even after the chat’s messages are deleted. Only you can see yours.</p></section><div id="dwc-receipts-list"><p style="color:var(--muted)">Loading receipts…</p></div>';
  var data = await apiGet("/receipts?device_id=" + encodeURIComponent(deviceId()));
  var list = (data && data.receipts) || [];
  state.receipts = list;
  var host = $("dwc-receipts-list");
  if (!host) return;
  if (data && data.error) { host.innerHTML = '<div class="note">' + esc(data.error) + "</div>"; return; }
  host.innerHTML = list.length
    ? list.map(function (r) {
        var spent = r.kind === "spent";
        return '<article class="card dwc-receipt' + (spent ? " dwc-receipt-spent" : " dwc-receipt-received") + '">' +
          '<p style="margin:0"><strong style="font-size:19px">' + (spent ? "−" : "+") + esc(r.amount || "") + '</strong> ' +
          '<span class="dwc-receipt-kind">' + (spent ? "💸 Spent" : "💰 Received") + "</span></p>" +
          '<p style="margin:6px 0 0">' + esc(r.note || "") + "</p>" +
          '<p class="dwc-meta" style="margin:4px 0 0">with @' + esc(r.other_username) + " · " + fmtDate(r.created_at) + "</p>" +
          "</article>";
      }).join("")
    : '<div class="note">No receipts yet — when you mark a transaction done in a private chat, your receipt lands here.</div>';
}

function renderComposer(context) {
  var host = $("dwc-composer");
  if (!host) return;
  var isAuth = context === "cardcheck";
  host.innerHTML =
    '<section class="card" aria-label="New post"><h3 style="margin-top:0">' + (isAuth ? "Card Check — real or fake?" : "New post") + "</h3>" +
    (state.profile ? "" : "<p>Posting needs an account — <button type=\"button\" class=\"dwc-linklike\" onclick=\"DWC.openSignup()\">create one, it’s free</button>.</p>") +
    '<form onsubmit="return DWC.submitPost(this, \'' + context + '\')">' +
    '<div class="dwc-kindrow">' +
    '<button type="button" class="dwc-pill' + (!isAuth ? " active" : "") + '" data-kind="forum" onclick="DWC.composerKind(this, \'forum\')">💬 Forum</button>' +
    '<button type="button" class="dwc-pill' + (isAuth ? " active" : "") + '" data-kind="card_auth" onclick="DWC.composerKind(this, \'card_auth\')">🔍 Card Check</button>' +
    "</div>" +
    '<input type="hidden" name="kind" value="' + (isAuth ? "card_auth" : "forum") + '">' +
    '<label>Corner</label><select name="category">' + CATEGORIES.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
    '<label>Flair</label><select name="flair">' + FLAIRS.map(function (f) { return "<option" + (f === (isAuth ? "Card Check" : "Discussion") ? " selected" : "") + ">" + esc(f) + "</option>"; }).join("") + "</select>" +
    '<label>Title (3–120 characters)</label>' +
    '<input name="title" required minlength="3" maxlength="120" placeholder="What’s this about?">' +
    '<label>What’s on your mind? (up to 4000 characters)</label>' +
    '<textarea name="body" required maxlength="4000" placeholder="Write it out…"></textarea>' +
    '<label>Tags (up to 6, comma separated)</label>' +
    '<input name="tags" maxlength="240" placeholder="e.g. charizard, grading, psa">' +
    '<label>Photo (JPG, PNG, or WebP, under 2.5 MB — required for Card Check)</label>' +
    '<input name="photo" type="file" accept="image/jpeg,image/png,image/webp">' +
    '<label><input type="checkbox" name="blur_photo" style="width:auto"> 🙈 Blur this photo — viewers see a blurred preview (they can tap to reveal). Off by default; never on unless you tick it.</label>' +
    '<div class="dwc-checkline"><button type="button" class="btn ghost small" onclick="DWC.runCardCheck(this.form)">🔍 Run AI authenticity + price check on photo</button> <span data-checkresult></span></div>' +
    gifPickerHTML("composer-" + context) +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">Post it →</button></p>' +
    "</form></section>";
}

async function viewCardCheck(el) {
  el.innerHTML =
    '<section class="card"><h2 style="margin-top:0">🔍 Card Check — real or fake?</h2>' +
    "<p>Post a picture of a card and the community weighs in. Every post carries a title, a description, and flair — and the shop gives it an AI first look (advisory only, never a guarantee) before the votes come in. A clear, well-lit front-and-back photo gets the best answers. Blurry photos get asked for a reshoot.</p>" +
    "<p><strong>Real · Looks Fake · Not Sure</strong> — members vote, and the votes stay on the post so the next person can learn from it.</p></section>" +
    '<div id="dwc-composer"></div>' +
    '<div id="dwc-pricechart"></div>' +
    '<div id="dwc-ccfeed"><p style="color:var(--muted)">Loading Card Check posts…</p></div>';
  renderComposer("cardcheck");
  renderPriceChart($("dwc-pricechart"));
  var data = await apiGet("/posts?kind=card_auth&sort=new&limit=50&device_id=" + encodeURIComponent(deviceId()));
  var feed = $("dwc-ccfeed");
  if (!feed) return;
  var posts = (data && data.posts) || [];
  feed.innerHTML = posts.length
    ? "<h3>Card Check posts</h3><div class=\"grid\">" + posts.map(postCardHTML).join("") + "</div>"
    : '<div class="note">No Card Check posts yet — post the first card.</div>';
}

function priceChartHTML() {
  return '<article class="card" aria-label="Price chart lookup — actual member-reported sales">' +
    "<h3 style=\"margin-top:0\">📈 Price chart — real reported sales</h3>" +
    "<p>Look up any card to see what it has <strong>actually sold for</strong>, as reported by the members who sold it — the chart the AI estimate can’t fake. Sold a card yourself? Open its chart and log the sale.</p>" +
    '<form class="dwc-rowform" onsubmit="return DWC.lookupPrice(this)">' +
    '<input name="card" required minlength="2" maxlength="120" placeholder="Card name — e.g. Charizard" style="flex:1">' +
    '<button type="submit" class="btn ghost">Show chart</button></form>' +
    '<div id="dwc-recent-sales"><p style="color:var(--muted)">Loading recent sales…</p></div>' +
    '<div id="dwc-chart-result"></div>' +
    "</article>";
}
async function renderPriceChart(host) {
  if (!host) return;
  host.innerHTML = priceChartHTML();
  var data = await apiGet("/card-sales/recent?limit=10");
  var el = $("dwc-recent-sales");
  if (!el) return;
  var sales = (data && data.sales) || [];
  el.innerHTML = sales.length
    ? '<p class="dwc-minihead">FRESHEST REPORTED SALES — TAP ONE FOR ITS CHART</p><ul class="dwc-salelist">' +
      sales.map(function (s) {
        return '<li><button type="button" onclick="DWC.lookupPriceName(\'' + esc(s.card_name.replace(/'/g, "")) + '\')"><span class="dwc-sale-name">' + esc(s.card_name) + '</span><span class="dwc-sale-price">' + money(s.price_cents) + '</span><span class="dwc-sale-meta">' + esc(s.sold_date) + " · " + esc(s.venue) + " · @" + esc(s.reporter_username) + "</span></button></li>";
      }).join("") + "</ul>"
    : "";
}
async function showPriceChart(cardName) {
  var host = $("dwc-chart-result");
  if (!host) return;
  host.innerHTML = "<p>Loading chart…</p>";
  var data = await apiGet("/card-sales?card_name=" + encodeURIComponent(cardName) + "&limit=40");
  if (!data || !data.sales) { host.innerHTML = '<p class="dwc-form-err">The chart didn’t load.</p>'; return; }
  var sales = data.sales;
  var max = data.max_cents || 1;
  var rows = sales.map(function (s) {
    var w = Math.max(4, Math.round((s.price_cents / max) * 100));
    return '<div class="dwc-bar-row"><span class="dwc-bar-label">' + esc(s.card_name) + " · " + esc(s.sold_date) + " · " + esc(s.venue) + " · @" + esc(s.reporter_username) + '</span><div class="dwc-bar-track"><div class="dwc-bar-fill" style="width:' + w + '%"></div></div><span class="dwc-bar-price">' + money(s.price_cents) + "</span></div>";
  }).join("");
  host.innerHTML =
    '<div class="dwc-chart"><h4 style="margin:0 0 8px">Price chart — ' + esc(cardName) + "</h4>" +
    (sales.length
      ? '<p class="dwc-chart-stats">' + data.count + " reported sale" + (data.count === 1 ? "" : "s") +
        " · Median <strong>" + money(data.median_cents) + "</strong> · Latest <strong>" + money(data.latest_cents) + "</strong> · Low " + money(data.min_cents) + " · High " + money(data.max_cents) + "</p>" +
        rows
      : "<p>No member-reported sales for that card yet — log the first one below.</p>") +
    (state.profile
      ? '<form class="dwc-logsale" onsubmit="return DWC.logCardSale(this)"><input type="hidden" name="card_name" value="' + esc(cardName) + '">' +
        "<strong>Log a sale you actually made:</strong> " +
        '<input name="price" type="number" step="0.01" min="0.01" required placeholder="Price sold for ($)">' +
        '<input name="sold_date" type="date" required>' +
        '<select name="venue">' + SALE_VENUES.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("") + "</select>" +
        '<button class="btn small" type="submit">Log this sale</button></form>'
      : "<p>Log a sale you made — <button type=\"button\" class=\"dwc-linklike\" onclick=\"DWC.openSignup()\">create your account</button> first.</p>") +
    "</div>";
}

// ---------- Market / Trade / Flea ----------
async function viewMarket(el, kind) {
  var titles = {
    market: ["🛒 Market — sell your cards &amp; collectibles", "List it free. <span class=\"grad-text\">Sell it fair.</span>", "Anyone can sell their own Pokémon cards and collectibles here once their account and payout method are set up. Listing is free — a small fair cut goes to Rare Candy Reserve only when the item sells."],
    trade: ["🔄 Up for Trade", "Offer a trade. <span class=\"grad-text\">Let the community weigh in.</span>", "Every trade listing needs a photo and a check first — the shop verifies no fakes or proxies before a trade goes live. Then members vote whether it’s a good trade, a fair one, or a bad deal."],
    flea: ["🔨 Flea Market — simple bidding", "Bid on it. <span class=\"grad-text\">Win it.</span>", "An online flea-market area with simple bidding — cards, collectibles, and whatever else the community’s selling. Bids must beat the high bid. The high bidder completes the purchase."],
  };
  var t = titles[kind];
  el.innerHTML =
    '<section class="card"><div class="kicker">' + t[0] + "</div><h2>" + t[1] + "</h2><p style=\"color:var(--muted)\">" + t[2] + "</p>" +
    OFFSITE_ADVISORY_HTML + THEFT_NOTICE_HTML + "</section>" +
    '<div id="dwc-listing-form"></div>' +
    '<div id="dwc-market-feed"><p style="color:var(--muted)">Loading listings…</p></div>';
  renderListingForm($("dwc-listing-form"), kind);
  var data = await apiGet("/listings?kind=" + kind + "&limit=60");
  var feed = $("dwc-market-feed");
  if (!feed) return;
  var listings = (data && data.listings) || [];
  feed.innerHTML = listings.length
    ? '<div class="grid">' + listings.map(listingCardHTML).join("") + "</div>"
    : '<div class="note">Nothing listed here yet — list the first item below.</div>';
}

function renderListingForm(host, kind) {
  if (!host) return;
  var p = state.profile;
  var kindLabel = kind === "sale" ? "for sale" : kind === "trade" ? "for trade" : "in the flea market";
  host.innerHTML =
    '<section class="card"><div class="tag">List an item ' + kindLabel + '</div><h3 style="margin-top:10px">Put something up ' + kindLabel + "</h3>" +
    (p ? (p.payout_method && p.payout_handle ? "" : '<p class="dwc-warn">You’re not payout-ready yet — add a payout method + handle in your profile before listing, or the listing will be blocked. You can still fill everything in now.</p>')
      : "<p>Listing needs an account + payout method — <button type=\"button\" class=\"dwc-linklike\" onclick=\"DWC.openSignup()\">create your account</button> first.</p>") +
    '<form onsubmit="return DWC.submitListing(this, \'' + kind + '\')">' +
    '<label>Item title (3–120 characters)</label>' +
    '<input name="title" required minlength="3" maxlength="120" placeholder="What are you selling?">' +
    '<label>Category</label><select name="category">' + LISTING_CATEGORIES.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
    '<label>' + (kind === "flea" ? "Starting bid (USD)" : kind === "trade" ? "Trade value (USD — what it’s worth, for the fee split)" : "Price (USD)") + "</label>" +
    '<input name="price" type="number" step="0.01" min="0" required placeholder="e.g. 25.00">' +
    (kind === "trade" ? '<label>What you’re looking for in return</label><input name="trade_wanted" maxlength="500" placeholder="Card(s) you want in return">' : "") +
    '<label>Description &amp; condition (a little formatting is allowed: bold, italic, lists, links)</label>' +
    '<textarea name="description" required maxlength="6000" placeholder="Condition, set, what’s included…"></textarea>' +
    '<label>Photos — up to 3 (JPG, PNG, or WebP, each under 2.5 MB)' + (kind === "trade" ? " — a photo is required for trades" : "") + "</label>" +
    '<input name="photo1" type="file" accept="image/jpeg,image/png,image/webp">' +
    '<input name="photo2" type="file" accept="image/jpeg,image/png,image/webp">' +
    '<input name="photo3" type="file" accept="image/jpeg,image/png,image/webp">' +
    (kind === "trade" ? '<p class="dwc-warn">Trades need a photo AND a completed AI authenticity check on it before they go live — run the check on the cover photo first.</p>' : "") +
    '<div class="dwc-checkline"><button type="button" class="btn ghost small" onclick="DWC.runListingCheck(this.form)">🔍 Run AI authenticity check on cover photo</button> <span data-checkresult></span></div>' +
    '<label><input type="checkbox" name="allow_comments" checked style="width:auto"> Allow comments on this listing</label>' +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">List it →</button></p>' +
    "</form></section>";
}

// ---------- Thread (single post) ----------
async function viewThread(el, postId) {
  el.innerHTML = '<p style="color:var(--muted)">Loading post…</p>';
  var data = await apiGet("/posts/" + postId + "?device_id=" + encodeURIComponent(deviceId()));
  var p = data && data.post;
  if (!p) {
    el.innerHTML = '<div class="note">That post is gone, or it’s in the 18+ area and this account isn’t age-verified.</div><p><button type="button" class="btn ghost" onclick="DWC.go(\'street\')">← Back to The Street</button></p>';
    return;
  }
  window.__dwcThreadKind = p.kind;
  var comments = await apiGet("/posts/" + postId + "/comments?device_id=" + encodeURIComponent(deviceId()));
  var list = (comments && comments.comments) || [];
  var isMine = state.profile && state.profile.id === p.author_id;
  var heartOn = myHeart("post-" + p.id);
  el.innerHTML =
    '<p><button type="button" class="btn ghost small" onclick="DWC.go(\'' + (p.kind === "adult" ? "adult" : "street") + '\')">← Back</button></p>' +
    '<article class="card">' +
    postPhotoHTML(p) +
    gifEmbedHTML(p.gif_url, p.gif_label) +
    '<div class="tag">' + esc(p.category) + (p.flair ? " · " + esc(p.flair) : "") + (p.kind === "card_auth" ? " · 🔍 Card Check" : p.kind === "adult" ? " · 18+" : "") + (p.is_creator ? " · 🎨 Creator" : "") + "</div>" +
    "<h2>" + esc(p.title) + "</h2>" +
    (p.is_creator ? '<p class="dwc-creator-line"><span class="dwc-creator-badge">🎨 ' + esc(p.content_genre || "Creator content") + "</span> " +
      '<strong style="color:var(--green);font-size:20px">' + (p.price_cents > 0 ? money(p.price_cents) : "Free") + "</strong>" +
      (p.file_url ? ' <span class="dwc-3d-badge">🖨️ 3D print file — ' + esc(p.file_name || "download") + "</span>" : "") + "</p>" +
      '<p style="color:var(--muted);font-size:14px">' + (p.pay_unlock && p.price_cents > 0 ? 'This post is pay-to-unlock — hit “Pay to unlock” and sort out payment in a private chat. The receipt marked done in that chat is your proof of purchase.' : 'Payment is arranged privately with the seller — hit “Buy / Message seller” and sort it out in a private chat.') + ' No money moves in this app.</p>' : "") +
    '<p style="white-space:pre-wrap">' + esc(p.body) + "</p>" +
    (p.kind === "card_auth" ? verificationBadge(p) : "") +
    '<p class="dwc-meta">by @' + esc(p.author_username) + (p.author_occupation ? " · " + esc(p.author_occupation) : "") + " · " + fmtDate(p.created_at) + "</p>" +
    (p.tags && p.tags.length ? '<p class="dwc-tags">' + p.tags.map(function (t) { return '<a href="#/tag/' + (p.kind === "adult" ? "adult/" : "") + encodeURIComponent(t) + '">#' + esc(t) + "</a>"; }).join(" ") + "</p>" : "") +
    '<div class="dwc-actions">' +
    '<button type="button" class="dwc-heart' + (heartOn ? " on" : "") + '" onclick="DWC.heartPost(' + p.id + ', this)">' + (heartOn ? "❤️" : "🤍") + " " + (p.score || 0) + "</button>" +
    (p.is_creator && state.profile && state.profile.id !== p.author_id
      ? (p.pay_unlock && p.price_cents > 0
        ? '<button type="button" class="btn" onclick="DWC.messageSeller(' + p.author_id + ", '" + esc(p.author_username.replace(/'/g, "")) + "', " + p.id + ')">🔓 Pay to unlock — ' + money(p.price_cents) + '</button>'
        : '<button type="button" class="btn small" onclick="DWC.messageSeller(' + p.author_id + ", '" + esc(p.author_username.replace(/'/g, "")) + "', " + p.id + ')">💬 Buy / Message seller</button>') : "") +
    (p.is_creator && p.file_url && state.profile
      ? '<a class="btn ghost small" href="' + esc(fileDownloadUrl(p.file_url)) + '" download>⬇ ' + esc(p.file_name || "Download 3D file") + "</a>" : "") +
    '<button type="button" class="dwc-linklike" onclick="DWC.copyLink(\'' + postLink(p.id) + '\', this)">🔗 Copy link</button>' +
    '<button type="button" class="dwc-linklike" onclick="DWC.report(\'post\', ' + p.id + ')">🚩 Report</button>' +
    (isMine ? '<button type="button" class="dwc-linklike" onclick="DWC.deletePost(' + p.id + ')">🗑 Delete my post</button>' +
      '<button type="button" class="dwc-linklike" onclick="DWC.toggleComments(' + p.id + ", " + (!p.allow_comments) + ')">' + (p.allow_comments ? "🔇 Turn comments off" : "🔊 Turn comments on") + "</button>" : "") +
    "</div></article>" +
    (p.kind === "card_auth"
      ? '<section class="card"><h3 style="margin-top:0">Is it real?</h3><p>Vote — Real, Looks Fake, or Not Sure. The votes stay on the post so the next person can learn from it.</p>' +
        '<div class="dwc-actions"><button type="button" class="btn ghost small" onclick="DWC.authVote(' + p.id + ", 'real')\">✓ Real (" + p.auth_real + ')</button>' +
        '<button type="button" class="btn ghost small" onclick="DWC.authVote(' + p.id + ", 'fake')\">✕ Looks Fake (" + p.auth_fake + ')</button>' +
        '<button type="button" class="btn ghost small" onclick="DWC.authVote(' + p.id + ", 'unsure')\">? Not Sure (" + p.auth_unsure + ")</button></div>" +
        (p.verification_status && p.verification_status !== "not_checked" ? "<p style=\"margin-top:10px\">AI first look (advisory only — community votes decide): " + esc(p.verification_summary || "") + "</p>" : "") +
        "</section>" : "") +
    '<section class="card"><h3 style="margin-top:0">Comments (' + list.length + ')' + (p.allow_comments ? "" : ' <span style="color:var(--amber)">— comments are off on this post</span>') + "</h3>" +
    (list.length ? list.map(function (c) {
      var ch = myHeart("comment-" + c.id);
      var mine = state.profile && state.profile.id === c.author_id;
      return '<div class="dwc-comment">' +
        (c.author_avatar_url ? '<img class="dwc-avatar dwc-avatar-sm" src="' + esc(c.author_avatar_url) + '" alt="">' : "") +
        '<div style="flex:1"><p style="margin:0"><strong>@' + esc(c.author_username) + '</strong> <span class="dwc-meta">' + fmtDate(c.created_at) + "</span></p>" +
        (c.body ? '<p style="margin:4px 0;white-space:pre-wrap">' + esc(c.body) + "</p>" : "") +
        gifEmbedHTML(c.gif_url, c.gif_label) +
        '<div class="dwc-actions">' +
        '<button type="button" class="dwc-heart' + (ch ? " on" : "") + '" onclick="DWC.heartComment(' + p.id + ", " + c.id + ', this)">' + (ch ? "❤️" : "🤍") + " " + (c.score || 0) + "</button>" +
        '<button type="button" class="dwc-linklike" onclick="DWC.report(\'comment\', ' + c.id + ')">🚩 Report</button>' +
        (mine ? '<button type="button" class="dwc-linklike" onclick="DWC.deleteComment(' + p.id + ", " + c.id + ')">🗑 Delete</button>' : "") +
        "</div></div></div>";
    }).join("") : "<p>Nothing yet — be the first to say something.</p>") +
    "</section>" +
    (state.profile && (p.allow_comments || isMine)
      ? '<section class="card"><h3 style="margin-top:0">Add a comment</h3><form onsubmit="return DWC.submitComment(this, ' + p.id + ')">' +
        '<textarea name="body" maxlength="2000" placeholder="Say something kind…"></textarea>' +
        gifPickerHTML("comment-" + p.id) +
        '<p class="dwc-form-err" data-err hidden></p>' +
        '<p style="margin-top:14px"><button class="btn" type="submit">Comment →</button></p></form></section>'
      : state.profile ? "" : needProfileHTML());
}

// ---------- Listing detail ----------
async function viewListing(el, listingId) {
  el.innerHTML = '<p style="color:var(--muted)">Loading listing…</p>';
  var data = await apiGet("/listings/" + listingId);
  var l = data && data.listing;
  if (!l) {
    el.innerHTML = '<div class="note">That listing is gone or sold.</div><p><button type="button" class="btn ghost" onclick="DWC.go(\'market\')">← Back to the Market</button></p>';
    return;
  }
  window.__dwcListingKind = l.kind === "sale" ? "market" : l.kind === "trade" ? "trade" : "flea";
  var comments = await apiGet("/listings/" + listingId + "/comments");
  var list = (comments && comments.comments) || [];
  var isMine = state.profile && state.profile.id === l.seller_id;
  var price = l.kind === "flea" ? (l.current_bid_cents != null ? l.current_bid_cents : l.price_cents) : l.price_cents;
  var imgs = [l.image_url, l.image2_url, l.image3_url].filter(Boolean);
  el.innerHTML =
    '<p><button type="button" class="btn ghost small" onclick="DWC.go(\'' + window.__dwcListingKind + '\')">← Back</button></p>' +
    '<article class="card">' +
    (imgs.length ? '<div class="dwc-photos">' + imgs.map(function (u, i) { return '<img src="' + esc(u) + '" alt="Listing photo ' + (i + 1) + '" loading="lazy" onclick="DWC.openLightbox(\'' + esc(u) + '\')">'; }).join("") + "</div>" : "") +
    gifEmbedHTML(l.gif_url, "") +
    '<div class="tag">' + esc(l.category) + " · " + (l.kind === "sale" ? "For sale" : l.kind === "trade" ? "Up for trade" : "🔨 Flea market") + " · " + esc(l.status) + "</div>" +
    "<h2>" + esc(l.title) + "</h2>" +
    '<div class="dwc-desc">' + l.description + "</div>" +
    verificationBadge(l) +
    '<p><strong style="color:var(--green);font-size:20px">' + (l.kind === "flea" ? (l.current_bid_cents != null ? "High bid: " : "Starting bid: ") : l.kind === "trade" ? "Trade value: " : "Price: ") + money(price) + "</strong></p>" +
    '<p style="color:var(--muted);font-size:14px">Platform cut (5%): ' + money(l.fee_cents) + " · Seller gets: " + money(l.seller_gets_cents) + "</p>" +
    (l.kind === "trade" && l.trade_wanted ? "<p><strong>Looking for:</strong> " + esc(l.trade_wanted) + "</p>" : "") +
    '<p class="dwc-meta">by @' + esc(l.seller_username) + (l.seller_occupation ? " · " + esc(l.seller_occupation) : "") + " · " + fmtDate(l.created_at) + (l.seller_payout_ready ? ' · <span style="color:var(--green)">✓ payout ready</span>' : "") + "</p>" +
    OFFSITE_ADVISORY_HTML + THEFT_NOTICE_HTML +
    '<div class="dwc-actions">' +
    '<button type="button" class="dwc-linklike" onclick="DWC.copyLink(\'' + listingLink(l.id) + '\', this)">🔗 Copy link</button>' +
    '<button type="button" class="dwc-linklike" onclick="DWC.report(\'listing\', ' + l.id + ')">🚩 Report</button>' +
    (isMine && l.status !== "sold" ? '<button type="button" class="dwc-linklike" onclick="DWC.deleteListing(' + l.id + ')">🗑 Close my listing</button>' : "") +
    "</div>" +
    (l.status === "active" && !isMine && l.kind !== "trade"
      ? '<p style="margin-top:14px"><button type="button" class="btn" onclick="DWC.buyListing(' + l.id + ')">' + (l.kind === "flea" ? "Complete purchase as high bidder →" : "Buy it →") + "</button> <span style=\"color:var(--muted);font-size:13px\">Payment is arranged directly with the seller — no money moves in this app.</span></p>"
      : "") +
    (l.status === "active" && l.kind === "trade" && !isMine
      ? '<p style="margin-top:14px">Trade listings aren’t bought — leave a comment below to offer your trade.</p>' : "") +
    "</article>" +
    (l.kind === "flea" && l.status === "active"
      ? '<section class="card"><h3 style="margin-top:0">🔨 Place a bid</h3><p>Current high bid: <strong>' + money(l.current_bid_cents != null ? l.current_bid_cents : l.price_cents) + "</strong> · " + l.bid_count + " bid" + (l.bid_count === 1 ? "" : "s") + " — your bid has to beat it.</p>" +
        (state.profile ? '<form class="dwc-rowform" onsubmit="return DWC.placeBid(this, ' + l.id + ')"><input name="bid" type="number" step="0.01" min="0.01" required placeholder="Your bid ($)"><button class="btn" type="submit">Place the bid →</button></form><p class="dwc-form-err" data-err hidden></p>' : needProfileHTML()) +
        "</section>" : "") +
    (l.kind === "trade"
      ? '<section class="card"><h3 style="margin-top:0">Is it a good trade?</h3><div class="dwc-actions">' +
        '<button type="button" class="btn ghost small" onclick="DWC.tradeVote(' + l.id + ", 'good')\">👍 Good (" + l.trade_good + ')</button>' +
        '<button type="button" class="btn ghost small" onclick="DWC.tradeVote(' + l.id + ", 'fair')\">🤝 Fair (" + l.trade_fair + ')</button>' +
        '<button type="button" class="btn ghost small" onclick="DWC.tradeVote(' + l.id + ", 'bad')\">👎 Bad deal (" + l.trade_bad + ")</button></div></section>" : "") +
    '<section class="card"><h3 style="margin-top:0">Comments (' + list.length + ')' + (l.allow_comments ? "" : ' <span style="color:var(--amber)">— comments are off on this listing</span>') + "</h3>" +
    (list.length ? list.map(function (c) {
      return '<div class="dwc-comment"><div style="flex:1"><p style="margin:0"><strong>@' + esc(c.author_username) + '</strong> <span class="dwc-meta">' + fmtDate(c.created_at) + "</span></p>" +
        (c.body ? '<p style="margin:4px 0;white-space:pre-wrap">' + esc(c.body) + "</p>" : "") +
        gifEmbedHTML(c.gif_url, c.gif_label) + "</div></div>";
    }).join("") : "<p>Nothing yet.</p>") +
    "</section>" +
    (state.profile && l.allow_comments
      ? '<section class="card"><h3 style="margin-top:0">Comment on this listing</h3><form onsubmit="return DWC.submitListingComment(this, ' + l.id + ')">' +
        '<textarea name="body" maxlength="2000" placeholder="Say something…"></textarea>' +
        gifPickerHTML("listing-comment-" + l.id) +
        '<p class="dwc-form-err" data-err hidden></p>' +
        '<p style="margin-top:14px"><button class="btn" type="submit">Comment →</button></p></form></section>'
      : state.profile ? "" : needProfileHTML());
}

// ---------- Tag page ----------
async function viewTag(el, tag, adult) {
  if (adult && (!state.profile || !state.profile.age_verified)) {
    el.innerHTML = '<div class="note">That tag lives in the 18+ area — verify your age with a photo ID first (Rules &amp; After Dark).</div><p><button type="button" class="btn ghost" onclick="DWC.go(\'rules\')">Rules &amp; After Dark →</button></p>';
    return;
  }
  el.innerHTML = "<h2>#" + esc(tag) + (adult ? " · 18+" : "") + "</h2><p style=\"color:var(--muted)\">Loading…</p>";
  var data = await apiGet("/posts?tag=" + encodeURIComponent(tag) + "&kind=" + (adult ? "adult" : "forum") + "&limit=50&device_id=" + encodeURIComponent(deviceId()));
  var posts = (data && data.posts) || [];
  el.innerHTML = "<h2>#" + esc(tag) + (adult ? " · 18+" : "") + "</h2>" +
    (posts.length ? '<div class="grid">' + posts.map(postCardHTML).join("") + "</div>" : '<div class="note">No posts with that tag yet.</div>');
}

// ---------- Orders ----------
async function viewOrders(el) {
  if (!state.profile) { el.innerHTML = needProfileHTML(); return; }
  el.innerHTML = '<section aria-label="My Orders"><h2 style="margin-top:0">📦 My Orders</h2><p style="color:var(--muted)">Loading…</p></section>';
  var buying = await apiGet("/my-orders?device_id=" + encodeURIComponent(deviceId()));
  var selling = await apiGet("/my-sales?device_id=" + encodeURIComponent(deviceId()));
  var mine = await apiGet("/my-listings?device_id=" + encodeURIComponent(deviceId()));
  var b = (buying && buying.orders) || [];
  var s = (selling && selling.orders) || [];
  var ml = (mine && mine.listings) || [];
  el.innerHTML =
    '<section aria-label="My Orders"><h2 style="margin-top:0">📦 My Orders</h2>' +
    "<h3>Buying</h3>" + (b.length ? b.map(orderCardHTML).join("") : '<div class="note">No purchases yet.</div>') +
    "<h3>Selling</h3>" + (s.length ? s.map(function (o) { return orderCardHTML(o, true); }).join("") : '<div class="note">No sales yet.</div>') +
    "<h3>My listings</h3>" + (ml.length ? '<div class="grid">' + ml.map(listingCardHTML).join("") + "</div>" : '<div class="note">No listings yet — list something in the Market, Trades, or Flea Market and it shows up here.</div>') +
    "</section>";
}
function orderCardHTML(o, isSeller) {
  var steps = ["paid", "shipped", "delivered"];
  var idx = steps.indexOf(o.status);
  return '<article class="card dwc-order">' +
    (o.image_url ? '<img class="dwc-post-img" src="' + esc(o.image_url) + '" alt="" loading="lazy">' : "") +
    "<h3 style=\"margin:0 0 4px\">" + esc(o.item_title) + "</h3>" +
    '<p style="margin:4px 0"><strong>' + money(o.amount_cents) + "</strong> · " + esc(o.status) + " · " + fmtDate(o.created_at) + "</p>" +
    '<p style="margin:4px 0;color:var(--muted);font-size:14px">' + (isSeller ? "Buyer: @" + esc(o.buyer_username) : "Seller: @" + esc(o.seller_username)) +
    " · Platform cut: " + money(o.fee_cents) + " · Seller gets: " + money(o.seller_gets_cents) + "</p>" +
    '<p class="dwc-order-steps">' + steps.map(function (st, i) { return '<span class="' + (i <= idx ? "done" : "") + '">' + st + "</span>"; }).join(" → ") + "</p>" +
    (o.carrier || o.tracking_number
      ? '<p>🚚 ' + esc(o.carrier || "—") + ' · Tracking: <button type="button" class="dwc-linklike" onclick="DWC.copyLink(\'' + esc(o.tracking_number) + '\', this)">' + esc(o.tracking_number) + " 📋</button>" +
        (o.tracking_url ? ' · <a href="' + esc(o.tracking_url) + '" target="_blank" rel="noopener">Track with carrier ↗</a>' : "") + "</p>"
      : "") +
    (!isSeller
      ? '<label class="dwc-alerts"><input type="checkbox" ' + (o.tracking_alerts ? "checked" : "") + ' onchange="DWC.setAlerts(' + o.id + ', this.checked)" style="width:auto"> Email me tracking alerts on this order <span style="color:var(--muted)">(preference saved — alert emails send once the street’s mail connection is live)</span></label>'
      : '<form class="dwc-shipform" onsubmit="return DWC.updateShipping(this, ' + o.id + ')">' +
        '<select name="status"><option value="paid"' + (o.status === "paid" ? " selected" : "") + ">Paid</option><option value=\"shipped\"" + (o.status === "shipped" ? " selected" : "") + ">Shipped</option><option value=\"delivered\"" + (o.status === "delivered" ? " selected" : "") + ">Delivered</option></select>" +
        '<select name="carrier"><option value="">Carrier…</option>' + CARRIERS.map(function (c) { return '<option' + (o.carrier === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select>" +
        '<input name="tracking_number" maxlength="60" value="' + esc(o.tracking_number) + '" placeholder="Tracking number">' +
        '<button class="btn small" type="submit">Save shipping</button></form>' +
        '<p style="font-size:13px;color:var(--muted)">Marking it <strong>Delivered</strong> credits your wallet with ' + money(o.seller_gets_cents) + " — see the Payouts tab. Your buyer sees the tracking number and carrier link on their order the moment you save.</p>") +
    "</article>";
}

// ---------- Payouts ----------
async function viewPayouts(el) {
  if (!state.profile) { el.innerHTML = needProfileHTML(); return; }
  el.innerHTML = '<section aria-label="Payouts and wallet"><h2 style="margin-top:0">💰 Payouts</h2><p style="color:var(--muted)">Loading wallet…</p></section>';
  var data = await apiGet("/wallet?device_id=" + encodeURIComponent(deviceId()));
  if (!data || !data.ok) {
    el.innerHTML = '<div class="note">' + esc((data && data.error) || "Wallet didn't load.") + "</div>";
    return;
  }
  el.innerHTML =
    '<section aria-label="Payouts and wallet" class="grid gap-3"><div class="card">' +
    "<h3 style=\"margin-top:0\">Your wallet</h3>" +
    "<p>Available: <strong style=\"color:var(--green);font-size:20px\">" + money(data.balance_cents) + "</strong></p>" +
    "<p>Pending (paid/shipped, not yet delivered): <strong>" + money(data.pending_cents) + "</strong> · Lifetime earnings: <strong>" + money(data.lifetime_cents) + "</strong></p>" +
    (data.payout_method ? "<p>Payout method: " + esc(data.payout_method) + " · " + esc(data.payout_handle) + "</p>" : "<p>You haven’t set a payout method yet — add one in your profile.</p>") +
    (data.balance_cents > 0 ? '<p><button type="button" class="btn" onclick="DWC.requestPayout()">Request payout of ' + money(data.balance_cents) + " →</button></p><p style=\"font-size:13px;color:var(--muted)\">The payout is recorded here and sent to your payout method outside the app — no payment processor is connected yet.</p>" : "") +
    "</div>" +
    '<div class="card"><h3 style="margin-top:0">Payout history</h3>' +
    (data.entries.length ? "<ul class=\"dwc-entries\">" + data.entries.map(function (e) {
      return "<li><strong>" + money(e.amount_cents) + "</strong> · " + esc(e.kind) + " · " + esc(e.status) + " · " + esc(e.note || "") + " · " + fmtDate(e.created_at) + "</li>";
    }).join("") + "</ul>" : "<p>No wallet activity yet — it lands here when an order is marked delivered.</p>") +
    "</div></section>";
}

// ---------- Members ----------
async function viewMembers(el) {
  el.innerHTML = '<section aria-label="Community members"><h2 style="margin-top:0">Members</h2><p style="color:var(--muted)">Every member is a buyer <em>and</em> a seller — one account, both hats. “Payout ready” just means they’ve set up how they get paid when they sell.</p><p style="color:var(--muted)">Loading members…</p></section>';
  var data = await apiGet("/members?limit=24");
  var members = (data && data.members) || [];
  el.innerHTML =
    '<section aria-label="Community members"><h2 style="margin-top:0">Members</h2><p style="color:var(--muted)">Every member is a buyer <em>and</em> a seller — one account, both hats. “Payout ready” just means they’ve set up how they get paid when they sell.</p>' +
    (members.length ? '<div class="grid">' + members.map(function (m) {
      return '<article class="card">' +
        (m.avatar_url ? '<img class="dwc-avatar" src="' + esc(m.avatar_url) + '" alt="">' : '<span class="dwc-avatar dwc-avatar-none">🍬</span>') +
        '<h3><a href="#/member/' + m.id + '">@' + esc(m.username) + "</a> " + presenceDot(m) + "</h3>" +
        (m.occupation ? "<p>" + esc(m.occupation) + "</p>" : "") +
        (m.bio ? "<p>" + esc(m.bio) + "</p>" : "") +
        (m.birthday ? "<p>🎂 " + esc(m.birthday) + "</p>" : "") +
        '<p>' + (m.payout_ready ? '<span style="color:var(--green)">✓ Payout ready</span>' : '<span style="color:var(--muted)">Not payout-ready yet</span>') + "</p>" +
        '<p class="dwc-meta">Joined ' + fmtDate(m.created_at) + ' · <a href="#/member/' + m.id + '">View page →</a></p></article>';
    }).join("") + "</div>" : '<div class="note">No members yet.</div>') + "</section>";
}

// ---------- Member page (MySpace profile) ----------
function presenceDot(m) {
  var p = m.presence || "offline";
  var cls = p === "online" ? "dwc-dot-online" : p === "away" ? "dwc-dot-away" : "dwc-dot-offline";
  var label = p === "online" ? "Online" : p === "away" ? "Away" : "Offline";
  return '<span class="dwc-dot ' + cls + '" title="' + label + (m.away_message && p === "away" ? " — " + esc(m.away_message) : "") + '"></span>';
}
function topFriendsRowHTML(friends) {
  if (!friends || !friends.length) return '<p style="color:var(--muted)">No Top 8 yet — pick yours in Edit profile.</p>';
  return '<div class="dwc-top8">' + friends.map(function (f) {
    return '<a class="dwc-topfriend" href="#/member/' + f.id + '">' +
      (f.avatar_url ? '<img class="dwc-avatar" src="' + esc(f.avatar_url) + '" alt="">' : '<span class="dwc-avatar dwc-avatar-none">🍬</span>') +
      "<span>@" + esc(f.username) + "</span></a>";
  }).join("") + "</div>";
}
async function viewMember(el, memberId) {
  el.innerHTML = '<p style="color:var(--muted)">Loading their page…</p>';
  var data = await apiGet("/members/" + memberId + "?device_id=" + encodeURIComponent(deviceId()));
  var m = data && data.member;
  if (!m) {
    el.innerHTML = '<div class="note">That member doesn’t exist.</div><p><button type="button" class="btn ghost" onclick="DWC.go(\'members\')">← Back to Members</button></p>';
    return;
  }
  // Their layout, scoped to this page only (removed on navigation).
  if (m.layout_css) {
    var st = document.createElement("style");
    st.id = "dwc-member-layout";
    st.textContent = m.layout_css;
    document.head.appendChild(st);
  }
  // Their theme pickers (v3.2) — injected AFTER the layout CSS, so the
  // pickers win over a preset for the properties they set; custom CSS
  // can still override them with !important.
  var memberThemeCss = themeCSS(m.profile_theme);
  if (memberThemeCss) {
    var tst = document.createElement("style");
    tst.id = "dwc-member-theme";
    tst.textContent = memberThemeCss;
    document.head.appendChild(tst);
  }
  el.innerHTML =
    '<div class="dwc-myprofile">' +
    '<section class="card dwc-mypage-head"><div class="dwc-profile-row">' +
    (m.avatar_url ? '<img class="dwc-avatar" src="' + esc(m.avatar_url) + '" alt="" style="width:84px;height:84px">' : '<span class="dwc-avatar dwc-avatar-none" style="width:84px;height:84px;font-size:38px">🍬</span>') +
    '<div><h2 style="margin:0">@' + esc(m.username) + " " + presenceDot(m) + "</h2>" +
    (m.occupation ? "<p style=\"margin:4px 0\">" + esc(m.occupation) + "</p>" : "") +
    (m.bio ? '<p style="margin:4px 0;white-space:pre-wrap">' + esc(m.bio) + "</p>" : "") +
    '<p class="dwc-meta" style="margin:4px 0">' +
    (m.birthday ? "🎂 " + esc(m.birthday) + " · " : "") + "Joined " + fmtDate(m.created_at) +
    (m.age_verified ? ' · <span style="color:var(--green)">Age verified ✓</span>' : "") +
    (m.is_operator ? ' · <span style="color:var(--amber)">Operator</span>' : "") +
    (m.payout_ready ? ' · <span style="color:var(--green)">✓ Payout ready</span>' : "") + "</p>" +
    (m.presence === "away" && m.away_message ? '<p style="margin:4px 0">🌙 Away: “' + esc(m.away_message) + "”</p>" : "") +
    "</div></div>" +
    '<div class="dwc-actions" style="margin-top:14px">' +
    (m.is_mine
      ? '<button type="button" class="btn ghost small" onclick="DWC.editProfile()">Edit profile</button>'
      : '<button type="button" class="btn small" onclick="DWC.imMember(' + m.id + ', \'' + esc(m.username.replace(/'/g, "")) + '\')">💬 IM @' + esc(m.username) + "</button>") +
    '<button type="button" class="btn ghost small" onclick="DWC.go(\'members\')">← All members</button>' +
    "</div></section>" +
    // My links (v3.4) — only when the member actually has links.
    // No links, no section, no placeholder.
    (m.my_links && m.my_links.length ? '<section class="card"><h3 style="margin-top:0">🔗 My links</h3>' + myLinksButtonsHTML(m.my_links) + "</section>" : "") +
    // Top 8 — only when the member actually has Top Friends. No
    // friends, no section at all (no placeholder cards, no "pick yours"
    // nudge on someone else's page).
    ((m.top_friends && m.top_friends.length)
      ? '<section class="card"><h3 style="margin-top:0">🌟 Top 8</h3><p style="color:var(--muted);font-size:13px;margin-top:0">Thanks for the add — these are the 8.</p>' + topFriendsRowHTML(m.top_friends) + "</section>"
      : "") +
    ((m.seller_types && m.seller_types.length) || (m.seller_tags && m.seller_tags.length) || m.seller_open_to
      ? '<section class="card dwc-sellercard"><h3 style="margin-top:0">🎨 What I sell</h3>' +
        ((m.seller_types && m.seller_types.length) ? "<p>Sells: <strong>" + esc(m.seller_types.join(", ")) + "</strong></p>" : "") +
        ((m.seller_tags && m.seller_tags.length) ? '<p class="dwc-tags">' + m.seller_tags.map(function (t) { return "<span>#" + esc(t) + "</span>"; }).join(" ") + "</p>" : "") +
        (m.seller_open_to ? "<p>Open to: “" + esc(m.seller_open_to) + "”</p>" : "") +
        ((m.seller_price_min_cents || m.seller_price_max_cents) ? "<p>Price range: <strong>" + money(m.seller_price_min_cents) + " – " + money(m.seller_price_max_cents) + "</strong></p>" : "") +
        (m.is_mine ? "" : '<p><button type="button" class="btn dwc-subscribe" onclick="DWC.messageSeller(' + m.id + ', \'' + esc(m.username.replace(/'/g, "")) + '\', null)">' + esc(m.subscribe_label || "Subscribe to my page") + '</button> <button type="button" class="btn ghost small" onclick="DWC.messageSeller(' + m.id + ', \'' + esc(m.username.replace(/'/g, "")) + '\', null)">💬 Message privately</button></p>') +
        "</section>"
      : "") +
    ((m.ash_tracks && m.ash_tracks.length)
      ? '<section class="card dwc-musiccard"><h3 style="margin-top:0">🎵 A Steady Heart picks</h3><p style="color:var(--muted);font-size:13px;margin-top:0">From “End of the year” — ' + esc(m.username) + '’s picks. Track names only for now; the player comes later.</p><ol class="dwc-music-picks">' +
        m.ash_tracks.map(function (n) {
          var title = ASH_TRACKS[n - 1] || ("Track " + n);
          return '<li><span class="dwc-track-num">' + n + '.</span> ' + esc(title) + "</li>";
        }).join("") +
        "</ol></section>"
      : "") +
    (m.show_vnr_player
      ? '<section class="card dwc-vnrcard"><h3 style="margin-top:0">📻 Steady Wave</h3><p style="color:var(--muted);font-size:13px;margin-top:0">Live from the station — hit play.</p>' +
        '<div class="dwc-vnr-player"><span class="dwc-vnr-label">🎙️ Steady Wave · LIVE</span>' +
        '<audio controls preload="' + (m.autoplay_vnr ? "auto" : "none") + '"' + (m.autoplay_vnr ? " autoplay" : "") + ' src="' + VNR_STREAM_URL + '">Your browser can’t play the stream here — open it in a new tab: ' + VNR_STREAM_URL + "</audio></div>" +
        '<p style="margin:8px 0 0;font-size:13px"><a href="' + VNR_STREAM_URL + '" target="_blank" rel="noopener">Open the stream in a new tab ↗</a></p></section>'
      : "") +
    '<section class="card"><h3 style="margin-top:0">About</h3>' +
    (m.bio ? '<p style="white-space:pre-wrap">' + esc(m.bio) + "</p>" : "<p style=\"color:var(--muted)\">No bio yet.</p>") +
    (m.occupation ? "<p>Does: <strong>" + esc(m.occupation) + "</strong></p>" : "") +
    "</section></div>";
}

// ---------- Live Chat — AIM throwback ----------
function stopChatPoll() {
  if (state.chatTimer) { clearInterval(state.chatTimer); state.chatTimer = null; }
}
function presenceControlsHTML() {
  if (!state.profile) return "";
  return '<div class="dwc-presence">' +
    '<span>You are <strong id="dwc-presence-state">' + (state.presence === "away" ? "🌙 Away" : "🟢 Online") + "</strong></span>" +
    '<button type="button" class="btn ghost small" onclick="DWC.setPresence(\'online\')">🟢 Online</button>' +
    '<button type="button" class="btn ghost small" onclick="DWC.setPresence(\'away\')">🌙 Away</button>' +
    '<input id="dwc-away-msg" maxlength="140" placeholder="Away message — e.g. brb, grabbing snacks" value="' + esc(state.awayMessage) + '" style="flex:1;min-width:180px">' +
    '<button type="button" class="btn ghost small" onclick="DWC.saveAwayMessage()">Save away message</button>' +
    "</div>";
}
async function viewChat(el) {
  el.innerHTML =
    '<section class="card" aria-label="Live chat — AIM style"><h2 style="margin-top:0">💬 Live Chat — The Street, live</h2>' +
    '<p style="color:var(--muted)">📟 AIM throwback — buddy list, away messages, and 1:1 IMs. The main room is still right here. Guests are auto-censored, always. Members chat under their own name uncensored — and own what they say.</p>' +
    presenceControlsHTML() +
    (state.profile
      ? '<p>Signed in as <strong>' + esc(state.profile.chat_name || state.profile.username) + '</strong> · <button type="button" class="dwc-linklike" onclick="DWC.editProfile()">Change chat name in profile</button></p>'
      : '<p>Chatting as a guest — <button type="button" class="dwc-linklike" onclick="DWC.openSignup()">create an account</button> to chat uncensored, get a buddy list, and send IMs.</p>') +
    '<div class="dwc-chatgrid">' +
    '<div class="dwc-buddypanel"><h3 style="margin-top:0">👥 Buddy List</h3><div id="dwc-buddies"><p style="color:var(--muted)">Loading buddies…</p></div>' +
    '<h3>📨 Recent IMs</h3><div id="dwc-inbox"><p style="color:var(--muted)">No IMs yet.</p></div></div>' +
    '<div><div id="dwc-chat-log" class="dwc-chatlog"><p style="color:var(--muted)">Loading chat…</p></div>' +
    '<form class="dwc-rowform" onsubmit="return DWC.sendChat(this)">' +
    (state.profile ? "" : '<input name="guest_name" maxlength="24" placeholder="Guest name (optional)" style="max-width:160px">') +
    '<input name="body" required maxlength="500" placeholder="Say something…" style="flex:1">' +
    '<button class="btn" type="submit">Send</button></form>' +
    '<p class="dwc-form-err" data-err hidden></p></div>' +
    "</div>" +
    '<div id="dwc-imwins"></div>' +
    "</section>";
  syncIMShells();
  await loadChatAim();
  state.chatTimer = setInterval(function () { loadChatAim(); }, 15000);
}
async function loadChatAim() {
  var log = $("dwc-chat-log");
  if (log) {
    var data = await apiGet("/chat?limit=60");
    var msgs = (data && data.messages) || [];
    log.innerHTML = msgs.length
      ? msgs.map(function (m) {
          return '<div class="dwc-chatmsg"><strong>' + esc(m.author_name) + '</strong>' + (m.is_member ? "" : ' <span class="dwc-guest">guest</span>') + ': <span>' + esc(m.body) + '</span> <span class="dwc-meta">' + fmtDate(m.created_at) + "</span></div>";
        }).join("")
      : "<p>No messages yet — say hi.</p>";
    log.scrollTop = log.scrollHeight;
  }
  if (!state.profile) {
    var buddiesHost = $("dwc-buddies");
    if (buddiesHost) buddiesHost.innerHTML = '<p style="color:var(--muted)">Sign in to see who’s online.</p>';
    var inboxHost = $("dwc-inbox");
    if (inboxHost) inboxHost.innerHTML = '<p style="color:var(--muted)">Sign in to send IMs.</p>';
    return;
  }
  var b = await apiGet("/presence?limit=60");
  if (b && b.buddies) { state.buddies = b.buddies; renderBuddies(); }
  var ib = await apiGet("/direct-messages?device_id=" + encodeURIComponent(deviceId()) + "&inbox=1");
  if (ib && ib.inbox) { state.inbox = ib.inbox; renderInbox(); }
  for (var i = 0; i < state.openIMs.length; i++) {
    var im = state.openIMs[i];
    var conv = await apiGet("/direct-messages?device_id=" + encodeURIComponent(deviceId()) + "&with=" + im.id);
    if (conv && conv.messages) {
      state.imCache[im.id] = conv.messages;
      renderIMLog(im.id);
    }
  }
}
function renderBuddies() {
  var host = $("dwc-buddies");
  if (!host) return;
  var groups = { online: [], away: [], offline: [] };
  state.buddies.forEach(function (b) {
    var p = b.presence || "offline";
    (groups[p] || groups.offline).push(b);
  });
  function row(b) {
    var mine = state.profile && b.id === state.profile.id;
    return '<button type="button" class="dwc-buddy"' + (mine ? " disabled" : ' onclick="DWC.openIM(' + b.id + ', \'' + esc(b.username.replace(/'/g, "")) + '\')"') + ">" +
      presenceDot(b) +
      (b.avatar_url ? '<img class="dwc-avatar dwc-avatar-sm" src="' + esc(b.avatar_url) + '" alt="">' : '<span class="dwc-avatar dwc-avatar-none dwc-avatar-sm">🍬</span>') +
      '<span class="dwc-buddy-name">@' + esc(b.username) + (mine ? " (you)" : "") + "</span>" +
      (b.presence === "away" && b.away_message ? '<span class="dwc-buddy-away">“' + esc(b.away_message) + "”</span>" : "") +
      "</button>";
  }
  var html =
    (groups.online.length ? "<p class=\"dwc-minihead\">🟢 ONLINE (" + groups.online.length + ")</p>" + groups.online.map(row).join("") : "") +
    (groups.away.length ? "<p class=\"dwc-minihead\">🌙 AWAY (" + groups.away.length + ")</p>" + groups.away.map(row).join("") : "") +
    (groups.offline.length ? "<p class=\"dwc-minihead\">⚫ OFFLINE (" + groups.offline.length + ")</p>" + groups.offline.map(row).join("") : "");
  host.innerHTML = html || '<p style="color:var(--muted)">No buddies yet.</p>';
}
function renderInbox() {
  var host = $("dwc-inbox");
  if (!host) return;
  if (!state.inbox.length) { host.innerHTML = '<p style="color:var(--muted)">No IMs yet — click a buddy to say hi.</p>'; return; }
  host.innerHTML = state.inbox.map(function (c) {
    return '<button type="button" class="dwc-buddy" onclick="DWC.openIM(' + c.partner_id + ', \'' + esc(c.partner_username.replace(/'/g, "")) + '\')">' +
      (c.partner_avatar_url ? '<img class="dwc-avatar dwc-avatar-sm" src="' + esc(c.partner_avatar_url) + '" alt="">' : '<span class="dwc-avatar dwc-avatar-none dwc-avatar-sm">🍬</span>') +
      '<span class="dwc-buddy-name">@' + esc(c.partner_username) + "</span>" +
      (c.unread ? '<span class="dwc-unread">' + c.unread + " new</span>" : "") +
      '<span class="dwc-buddy-away">' + esc((c.last_from_me ? "You: " : "") + (c.last_body || "").slice(0, 60)) + "</span>" +
      "</button>";
  }).join("");
}
function syncIMShells() {
  var host = $("dwc-imwins");
  if (!host) return;
  var want = {};
  state.openIMs.forEach(function (im) { want[im.id] = im; });
  host.querySelectorAll("[data-imwin]").forEach(function (w) {
    if (!want[w.getAttribute("data-imwin")]) w.remove();
  });
  state.openIMs.forEach(function (im) {
    if (host.querySelector('[data-imwin="' + im.id + '"]')) return;
    var div = document.createElement("div");
    div.className = "dwc-imwin";
    div.setAttribute("data-imwin", String(im.id));
    div.innerHTML =
      '<div class="dwc-imwin-head"><strong>💬 IM — @' + esc(im.username) + '</strong><button type="button" class="dwc-linklike" onclick="DWC.closeIM(' + im.id + ')">✕ Close</button></div>' +
      '<div class="dwc-imlog" id="dwc-imlog-' + im.id + '"><p style="color:var(--muted)">Loading…</p></div>' +
      '<form class="dwc-rowform" onsubmit="return DWC.sendIM(this, ' + im.id + ')">' +
      '<input name="body" required maxlength="500" placeholder="Message @' + esc(im.username) + '…" style="flex:1">' +
      '<button class="btn small" type="submit">Send</button></form>';
    host.appendChild(div);
  });
}
function renderIMLog(id) {
  var log = $("dwc-imlog-" + id);
  if (!log) return;
  var msgs = state.imCache[id] || [];
  log.innerHTML = msgs.length
    ? msgs.map(function (m) {
        return '<div class="dwc-chatmsg"><strong>' + esc(m.from_me ? "You" : m.sender_username) + '</strong>: <span>' + esc(m.body) + '</span> <span class="dwc-meta">' + fmtDate(m.created_at) + "</span></div>";
      }).join("")
    : "<p>No messages yet — say hi.</p>";
  log.scrollTop = log.scrollHeight;
}

// ---------- Find a Seller / Find a Buyer (v3) ----------
function findResultCardHTML(m) {
  var isSeller = state.findRole === "seller";
  return '<article class="card dwc-findcard">' +
    (m.avatar_url ? '<img class="dwc-avatar" src="' + esc(m.avatar_url) + '" alt="">' : '<span class="dwc-avatar dwc-avatar-none">🍬</span>') +
    '<h3><a href="#/member/' + m.id + '">@' + esc(m.username) + "</a> " + presenceDot(m) + "</h3>" +
    '<p class="dwc-match">✨ Matched ' + m.match_score + " — " +
    (m.matched_types.length ? esc(m.matched_types.join(", ")) : "") +
    (m.matched_types.length && m.matched_tags.length ? " · " : "") +
    (m.matched_tags.length ? m.matched_tags.map(function (t) { return "#" + esc(t); }).join(" ") : "") + "</p>" +
    (m.bio ? "<p>" + esc(m.bio) + "</p>" : "") +
    (isSeller
      ? ((m.seller_types && m.seller_types.length) ? "<p>Sells: <strong>" + esc(m.seller_types.join(", ")) + "</strong></p>" : "") +
        ((m.seller_tags && m.seller_tags.length) ? '<p class="dwc-tags">' + m.seller_tags.map(function (t) { return "<span>#" + esc(t) + "</span>"; }).join(" ") + "</p>" : "") +
        (m.seller_open_to ? "<p>Open to: “" + esc(m.seller_open_to) + "”</p>" : "") +
        ((m.seller_price_min_cents || m.seller_price_max_cents) ? "<p>Price range: <strong>" + money(m.seller_price_min_cents) + " – " + money(m.seller_price_max_cents) + "</strong></p>" : "")
      : ((m.buyer_types && m.buyer_types.length) ? "<p>After: <strong>" + esc(m.buyer_types.join(", ")) + "</strong></p>" : "") +
        ((m.buyer_tags && m.buyer_tags.length) ? '<p class="dwc-tags">' + m.buyer_tags.map(function (t) { return "<span>#" + esc(t) + "</span>"; }).join(" ") + "</p>" : "") +
        (m.buyer_budget_max_cents ? "<p>Budget: up to <strong>" + money(m.buyer_budget_max_cents) + "</strong></p>" : "")) +
    '<div class="dwc-actions">' +
    '<button type="button" class="btn small" onclick="DWC.messageSeller(' + m.id + ', \'' + esc(m.username.replace(/'/g, "")) + '\', null)">💬 Message privately</button>' +
    '<a class="btn ghost small" href="#/member/' + m.id + '">View page →</a>' +
    "</div></article>";
}
async function viewFind(el) {
  if (!state.profile) { el.innerHTML = needProfileHTML(); return; }
  if (!state.profile.age_verified) {
    el.innerHTML = '<section class="card"><h2 style="margin-top:0">✨ Find Seller / Buyer</h2><p>Find is 18+ — it matches buyers and sellers of digital content. Verify your age with a photo ID first (Rules &amp; After Dark).</p><p><button type="button" class="btn" onclick="DWC.go(\'rules\')">Rules &amp; After Dark →</button></p></section>';
    return;
  }
  var p = state.profile;
  el.innerHTML =
    '<section class="card"><h2 style="margin-top:0">✨ Find Seller / Buyer</h2>' +
    "<p style=\"color:var(--muted)\">Two sides of the same street. Tell us what you sell and what you're after — then find your match. Only public info is ever shown (username, bio, tags, content types). Nothing about your payouts or your real name.</p>" +
    '<div class="dwc-findbtns">' +
    '<button type="button" class="btn' + (state.findRole === "seller" ? "" : " ghost") + '" onclick="DWC.findRole(\'seller\')">🔍 Find a Seller</button>' +
    '<button type="button" class="btn' + (state.findRole === "buyer" ? "" : " ghost") + '" onclick="DWC.findRole(\'buyer\')">🔍 Find a Buyer</button>' +
    "</div>" +
    '<p style="color:var(--muted)">Right now you’re looking for a <strong>' + (state.findRole === "seller" ? "seller" : "buyer") + '</strong> — matches are best-first, by what you both picked.</p></section>' +
    '<section class="card"><h3 style="margin-top:0">⚙️ My Find prefs — what I sell &amp; what I’m after</h3>' +
    '<form onsubmit="return DWC.saveFindPrefs(this)">' +
    '<h4 style="margin:8px 0 6px">What I sell</h4>' +
    '<label>Content types I sell</label><div class="dwc-checkgrid">' + CREATOR_GENRES.map(function (g) {
      return '<label><input type="checkbox" name="seller_types" value="' + esc(g) + '" style="width:auto"' + ((p.seller_types || []).includes(g) ? " checked" : "") + "> " + esc(g) + "</label>";
    }).join("") + "</div>" +
    '<label>My seller tags (comma separated, up to 8)</label>' +
    '<input name="seller_tags" maxlength="240" value="' + esc((p.seller_tags || []).join(", ")) + '" placeholder="e.g. cosplay, custom">' +
    '<label>Open to… (one line)</label>' +
    '<input name="seller_open_to" maxlength="140" value="' + esc(p.seller_open_to || "") + '" placeholder="e.g. custom sets on request">' +
    '<div class="dwc-rowform"><label style="flex:1">My price from ($)<input name="seller_price_min" type="number" step="1" min="0" max="100000" value="' + Math.round((p.seller_price_min_cents || 0) / 100) + '"></label>' +
    '<label style="flex:1">My price to ($)<input name="seller_price_max" type="number" step="1" min="0" max="100000" value="' + Math.round((p.seller_price_max_cents || 0) / 100) + '"></label></div>' +
    '<h4 style="margin:16px 0 6px">What I’m after</h4>' +
    '<label>Content types I want</label><div class="dwc-checkgrid">' + CREATOR_GENRES.map(function (g) {
      return '<label><input type="checkbox" name="buyer_types" value="' + esc(g) + '" style="width:auto"' + ((p.buyer_types || []).includes(g) ? " checked" : "") + "> " + esc(g) + "</label>";
    }).join("") + "</div>" +
    '<label>Tags I’m after (comma separated, up to 8)</label>' +
    '<input name="buyer_tags" maxlength="240" value="' + esc((p.buyer_tags || []).join(", ")) + '" placeholder="e.g. cosplay, amateur">' +
    '<label>My budget — up to ($)</label>' +
    '<input name="buyer_budget" type="number" step="1" min="0" max="100000" value="' + Math.round((p.buyer_budget_max_cents || 0) / 100) + '">' +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">Save my Find prefs →</button></p></form></section>' +
    '<div id="dwc-find-results"><p style="color:var(--muted)">Loading matches…</p></div>' +
    '<section class="card"><h3 style="margin-top:0">🔒 My private chats</h3><p style="color:var(--muted)">Private chats delete when closed — for both sides. Open one to pick up where you left off.</p><p><button type="button" class="btn ghost small" onclick="DWC.go(\'receipts\')">🧾 My receipts →</button></p><div id="dwc-eph-inbox"><p style="color:var(--muted)">Loading…</p></div></section>';
  await loadFindResults();
  await loadEphInbox();
}
async function loadFindResults() {
  var host = $("dwc-find-results");
  if (!host) return;
  var data = await apiGet("/find?device_id=" + encodeURIComponent(deviceId()) + "&role=" + state.findRole + "&limit=30");
  var results = (data && data.results) || [];
  state.findResults = results;
  if (data && data.error) {
    host.innerHTML = '<div class="note">' + esc(data.error) + "</div>";
    return;
  }
  host.innerHTML = results.length
    ? "<h3>" + (state.findRole === "seller" ? "Sellers for you — best match first" : "Buyers for you — best match first") + '</h3><div class="grid">' + results.map(findResultCardHTML).join("") + "</div>"
    : '<div class="note">' + (state.findRole === "seller"
      ? "No sellers match your wants yet — save your prefs above (what you're after), and check back once sellers set up what they sell."
      : "No buyers match what you sell yet — save your prefs above (what you sell), and check back once buyers say what they're after.") + "</div>";
}
async function loadEphInbox() {
  var host = $("dwc-eph-inbox");
  if (!host) return;
  var data = await apiGet("/ephemeral?device_id=" + encodeURIComponent(deviceId()) + "&inbox=1");
  var inbox = (data && data.inbox) || [];
  state.ephInbox = inbox;
  if (!inbox.length) { host.innerHTML = '<p style="color:var(--muted)">No private chats open — start one from a creator post or a Find result.</p>'; return; }
  host.innerHTML = inbox.map(function (c) {
    return '<button type="button" class="dwc-buddy" onclick="DWC.openEphemeral(' + c.partner_id + ", '" + esc(c.partner_username.replace(/'/g, "")) + "', " + (c.post_id || "null") + ')">' +
      (c.partner_avatar_url ? '<img class="dwc-avatar dwc-avatar-sm" src="' + esc(c.partner_avatar_url) + '" alt="">' : '<span class="dwc-avatar dwc-avatar-none dwc-avatar-sm">🍬</span>') +
      '<span class="dwc-buddy-name">@' + esc(c.partner_username) + "</span>" +
      '<span class="dwc-buddy-away">🔒 ' + esc((c.last_from_me ? "You: " : "") + (c.last_body || "").slice(0, 60)) + "</span>" +
      "</button>";
  }).join("");
}

// ---------- Ephemeral private chat (v3) ----------
// One floating window at a time. Private chat: messages live in the
// database only while the chat is open, and closing it deletes every
// message for both sides. The window says so, plainly — it just says
// "Private chat" and never words it as encrypted. (Developer note: this
// is private + ephemeral, NOT true end-to-end encryption — there is no
// client key exchange on this stack. That limit lives in the code
// comments and the build report, never as a claim in the UI.)
function renderEphWin() {
  var host = $("dwc-ephwins");
  if (!host) return;
  var e = state.eph;
  if (!e) { host.innerHTML = ""; return; }
  host.innerHTML =
    '<div class="dwc-ephwin" role="dialog" aria-label="Private chat">' +
    '<div class="dwc-ephwin-head"><strong>🔒 Private chat — @' + esc(e.partner_username) + '</strong>' +
    '<button type="button" class="dwc-linklike" onclick="DWC.closeEphemeral()">✕ Close &amp; delete</button></div>' +
    '<p class="dwc-eph-note">🔒 <strong>Private chat.</strong> This chat lives only while it’s open — closing it deletes every message for both of you.</p>' +
    '<div class="dwc-ephlog" id="dwc-ephlog">' +
    (state.ephMessages.length
      ? state.ephMessages.map(function (m) {
          return '<div class="dwc-chatmsg"><strong>' + esc(m.from_me ? "You" : m.sender_username) + '</strong>: <span>' + esc(m.body) + '</span> <span class="dwc-meta">' + fmtDate(m.created_at) + "</span></div>";
        }).join("")
      : "<p>No messages yet — say hi. Payment and the file swap happen here, between the two of you.</p>") +
    "</div>" +
    (state.ephTxnMsg ? '<p class="dwc-eph-txn-done">' + esc(state.ephTxnMsg) + "</p>" : "") +
    '<div class="dwc-eph-actions"><button type="button" class="btn ghost small" onclick="DWC.toggleTxnForm()">✓ Transaction done</button> <span style="color:var(--muted);font-size:13px">Mark a sale done — a receipt is saved for both of you, and it stays even after this chat is deleted.</span></div>' +
    '<form id="dwc-txn-form" class="dwc-txn-form" hidden onsubmit="return DWC.saveTransaction(this)">' +
    '<label>Amount — whole dollars ($)</label>' +
    '<input name="amount" type="number" step="1" min="1" max="100000" required placeholder="e.g. 15">' +
    '<label>What was bought (one short line, up to 140 characters)</label>' +
    '<input name="note" maxlength="140" required placeholder="e.g. 20-photo set">' +
    '<div class="dwc-rowform"><label><input type="radio" name="role" value="buyer" checked style="width:auto"> I bought it (I spent)</label>' +
    '<label><input type="radio" name="role" value="seller" style="width:auto"> I sold it (I received)</label></div>' +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:10px"><button class="btn small" type="submit">Save receipt →</button></p></form>' +
    '<form class="dwc-rowform" onsubmit="return DWC.sendEphemeral(this)">' +
    '<input name="body" required maxlength="1000" placeholder="Message @' + esc(e.partner_username) + '…" style="flex:1">' +
    '<button class="btn small" type="submit">Send</button></form>' +
    "</div>";
  var log = $("dwc-ephlog");
  if (log) log.scrollTop = log.scrollHeight;
}
async function openEphemeralChat(partnerId, partnerUsername, postId) {
  if (!state.profile) { setNotice("Create your account first — private chats are for members."); DWC.openSignup(); return; }
  var url = "/ephemeral?device_id=" + encodeURIComponent(deviceId()) + "&with=" + partnerId;
  if (postId) url += "&post_id=" + postId;
  var data = await apiGet(url);
  if (!data || !data.conversation_id) { setNotice((data && data.error) || "Couldn't open that private chat."); return; }
  state.eph = { conversation_id: data.conversation_id, partner_id: data.partner_id, partner_username: data.partner_username || partnerUsername, post_id: data.post_id ?? postId ?? null };
  state.ephMessages = data.messages || [];
  state.ephTxnMsg = null;
  renderEphWin();
  var win = document.querySelector(".dwc-ephwin");
  if (win) win.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ---------- Reports (operator inbox) ----------
async function viewReports(el) {
  if (!state.profile) { el.innerHTML = needProfileHTML(); return; }
  if (!state.profile.is_operator) {
    el.innerHTML = '<section class="card"><h2 style="margin-top:0">🚩 Reports</h2><p>Reports go straight to the operator’s inbox — Chris reviews every one. To file a report, use the 🚩 Report button on any post, comment, or listing.</p><p>Flag and report any comment or profile, as well as messages or content you see, if it does not belong — an admin will see it and action will be taken. For further issues unresolved, reach out to <a href="mailto:TheRarecandyreserve@proton.me">TheRarecandyreserve@proton.me</a> or leave a message for the owner of this website or its agents or employees.</p><p style="color:var(--muted)">Only the operator can see the inbox. (If this is your shop, claim the operator role from your profile — first claim wins, so do it before opening the Community.)</p><p><button type="button" class="btn ghost small" onclick="DWC.claimOperator()">Claim operator role</button></p></section>';
    return;
  }
  el.innerHTML = '<section aria-label="Reports inbox"><h2 style="margin-top:0">🚩 Reports — operator inbox</h2><p style="color:var(--muted)">Loading…</p></section>';
  var reports = await apiGet("/reports?device_id=" + encodeURIComponent(deviceId()));
  var reviews = await apiGet("/age-verification/requests?device_id=" + encodeURIComponent(deviceId()));
  var list = (reports && reports.reports) || [];
  var reqs = (reviews && reviews.requests) || [];
  el.innerHTML =
    '<section aria-label="Reports inbox"><h2 style="margin-top:0">🚩 Reports — operator inbox</h2>' +
    (list.length ? list.map(function (r) {
      return '<article class="card dwc-report"><p style="margin:0"><strong>' + esc(r.target_label) + '</strong> · <span class="dwc-status-' + esc(r.status) + '">' + esc(r.status) + "</span></p>" +
        '<p style="margin:4px 0">Reported by @' + esc(r.reporter_username) + " · " + fmtDate(r.created_at) + "</p>" +
        (r.reason ? '<p style="margin:4px 0">Reason: ' + esc(r.reason) + "</p>" : "") +
        (r.status === "open" ? '<p><button type="button" class="btn ghost small" onclick="DWC.resolveReport(' + r.id + ')">Mark reviewed</button></p>' : "") +
        "</article>";
    }).join("") : '<div class="note">No reports — nothing to review.</div>') +
    "</section>" +
    '<section aria-label="Age verification reviews" class="dwc-age-reviews"><h2 style="margin-top:24px">🪪 Age verification reviews</h2>' +
    "<p>ID photos are held privately for your review only and are permanently deleted the moment you approve or reject. They are never written to the database.</p>" +
    ((reqs || []).length ? reqs.map(function (q) {
      return '<article class="card dwc-report"><p style="margin:0"><strong>@' + esc(q.username) + '</strong> · ' + esc(q.status) + " · " + fmtDate(q.created_at) + "</p>" +
        (q.status === "pending"
          ? '<p><img src="/api/age-verification/id-image?request_id=' + q.id + "&device_id=" + encodeURIComponent(deviceId()) + '" alt="ID photo under review" class="dwc-id-img"></p>' +
            '<p><button type="button" class="btn small" onclick="DWC.decideAge(' + q.id + ', \'approve\')">✓ Approve — age verified</button> ' +
            '<button type="button" class="btn ghost small" onclick="DWC.decideAge(' + q.id + ', \'reject\')">✕ Reject</button></p>' +
            "<p style=\"font-size:13px;color:var(--muted)\">Check: a genuine-looking government photo ID, date of birth showing 18+, and the name + date of birth matching the account. The image is deleted immediately after your decision.</p>"
          : "") +
        "</article>";
    }).join("") : '<div class="note">No ID reviews waiting.</div>') + "</section>";
}

// ---------- Rules & After Dark ----------
function viewRules(el) {
  el.innerHTML =
    '<section class="card"><h2 style="margin-top:0">The deal — in plain language</h2><p style="text-align:center;font-weight:900;color:var(--green);letter-spacing:.14em">LIST IT FREE, SELL IT FAIR</p><ul class="dwc-rules-list">' +
    "<li><strong>This is a general marketplace and community — not just cards.</strong> Buy and sell anything legal: cards and collectibles, plants, video games, tech, figures, custom work, and more. One free account is your buyer <em>and</em> seller account in one.</li>" +
    "<li><strong>Listing is always free.</strong> When something sells, a fair 5% cut goes to Rare Candy Reserve to keep the street running — every listing shows the exact split before you post. Payments go directly between buyer and seller; the app never holds your money.</li>" +
    "<li><strong>You can sell any content — adult content included — IF you prove your age first.</strong> Regular stuff never needs age proof: join, post, buy, and sell with just the signup checks. Adult content and the 18+ area are the only places age verification is asked — and there it takes a <strong>real photo ID check</strong> (see the Age Verification Notice in the After Dark panel below). <strong>A typed birthday alone is never enough.</strong></li>" +
    "<li><strong>Two forums, both with tags.</strong> The general forum is for any topic — gaming, music, plants, tech, life — and every post gets tags; each tag has its own page collecting its posts. The 18+ forum is its twin for adult topics, verified members only, with its own tags and tag pages. Adult content never shows up in the general forum, its tag pages, or the front page.</li>" +
    "<li><strong>Hearts only.</strong> The only reaction anywhere here is a heart — on posts and on comments. There is no downvote, no thumbs-down, no dislike. Heart it or don’t.</li>" +
    "<li><strong>Your post, your call on comments.</strong> Whoever wrote a post can turn its comments off (and back on) any time from the post itself. Existing comments stay visible; new ones pause.</li>" +
    "<li><strong>One account per person.</strong> Your name + date of birth is the pair that keeps it that way. Your full name and birth year are never shown publicly.</li>" +
    "<li><strong>Report anything.</strong> Every post, comment, and listing has a 🚩 Report button. Reports go straight to the owner’s inbox in this app for Chris to review.</li></ul></section>" +
    '<section class="card"><h2 style="margin-top:0">Street rules — keep everyone safe</h2><ul class="dwc-rules-list">' +
    "<li><strong>Sell what you want — legally.</strong> <strong>No firearms, ammunition, or anything illegal, ever.</strong> Listings that mention them are blocked automatically.</li>" +
    "<li><strong>No fakes or proxies passed off as real.</strong> Card trades run an AI first look in the Card Check corner; a likely fake/proxy flag blocks the trade listing until the community weighs in. Proxies must be labeled as proxies if they're ever shown.</li>" +
    "<li><strong>No hate speech</strong> in posts, comments, usernames, or profiles. Pages and posts that break this get removed.</li>" +
    "<li><strong>No outside sales.</strong> Deals that start here stay here. On this platform your content and your deals are protected — verified member accounts, recorded orders and tracking, and a report trail. Take a deal off site and you lose all of that protection. Taking a buyer off-platform to dodge the street cut also risks a <strong>permanent ban of the account</strong> (and, on the public site, the IP).</li>" +
    "<li><strong>Stealing content is theft — and it’s expensive.</strong> Anyone who steals a member’s content and redistributes it, in any form, <strong>will be held liable in court for money owed due to damages, and more</strong>. The platform will pursue content thieves. If you didn’t make it or buy the right to share it, don’t post it anywhere.</li>" +
    "<li><strong>Be honest about condition.</strong> Photos of the actual item, flaws stated up front. The item is the item for sale — extras are courtesies, not the product.</li>" +
    "<li><strong>Chat:</strong> guests are auto-censored, always. Members chat under their own name uncensored — and own what they say.</li>" +
    "<li><strong>Payments &amp; shipping:</strong> buyer and seller arrange payment (the seller's payout method is on their profile) and shipping directly. Every purchase lands in the buyer's <strong>My Orders</strong> with the order status; when the seller ships, they add the carrier + tracking number there and the buyer gets their copy of it (plus a link to the carrier's tracking page). Sellers: your wallet balance and payout history live under <strong>Payouts</strong> — money becomes available when an order is marked delivered. Shipping-label creation through Shippo or a similar service is planned and will be labeled clearly when it actually works — it is not live yet.</li></ul>" +
    OFFSITE_ADVISORY_HTML + THEFT_NOTICE_HTML + "</section>" +
    '<section class="card"><h2 style="margin-top:0">🌙 Adult content &amp; the 18+ area — how age verification works</h2>' +
    "<p>The deal is simple: <strong>you can sell any content, adult or otherwise, if you prove your age.</strong> Adult discussion lives in the <strong>🌙 After Dark 18+</strong> forum inside this app, and adult selling lives in the After Dark market — entering any 18+ area asks for age verification first. Everything else on the street never asks.</p>" +
    "<p><strong>How the check works:</strong> you upload a clear photo of your government-issued photo ID (driver’s license, state ID, or passport). Chris — the operator — reviews it himself: that it’s a genuine-looking government ID, that the date of birth on it shows 18 or older, and that it matches the name and date of birth on your account. <strong>A typed birthday or an “I’m 18” checkbox alone never verifies anyone.</strong> Until the check passes, there is no adult access — no entering the 18+ forum, no adult selling.</p>" +
    AGE_NOTICE_HTML + AGE_REVIEW_NOTE +
    '<div id="dwc-age-block"></div></section>';
  renderAgeBlock();
}

// ---------- Age verification block (used in Rules + Adult) ----------
async function renderAgeBlock() {
  var host = $("dwc-age-block");
  if (!host) return;
  if (!state.profile) { host.innerHTML = needProfileHTML(); return; }
  if (state.profile.age_verified) {
    host.innerHTML = '<p style="color:var(--green);font-weight:800">✓ You’re age verified — the 18+ area is open to you.</p><p><button type="button" class="btn" onclick="DWC.go(\'adult\')">Enter the 18+ area →</button></p>';
    return;
  }
  var st = await apiGet("/age-verification/status?device_id=" + encodeURIComponent(deviceId()));
  var pending = st && st.pending;
  host.innerHTML =
    (pending
      ? '<p class="dwc-info">🕐 Your ID is waiting for review — Chris reviews every ID himself. You’ll see your age-verified mark here once it’s approved. Your photo is deleted the moment he decides.</p>'
      : "") +
    '<form onsubmit="return DWC.submitId(this)">' +
    '<label>Upload a clear photo of your government-issued photo ID (driver’s license, state ID, or passport) — JPG or PNG, under 2.5 MB</label>' +
    '<input name="id_photo" type="file" accept="image/jpeg,image/png" required>' +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">Submit my ID for review →</button></p></form>';
}

// ---------- v3.2: 18+ area banners + Digital File Marketplace ----------
// "Get matched with buyers & sellers fast!" — the area's intro banner,
// right before the "After Dark — 18+" heading.
var MATCH_BANNER_HTML =
  '<div class="dwc-match-banner">Get matched with buyers &amp; sellers fast!</div>';
// "Get your nut, and protect it too!!" + neon 18+ only + a PayPal balance
// rising demo (CSS/SVG animation — clearly labeled EXAMPLE, never a real
// PayPal screenshot). Sits above the main 18+ welcome picture.
var NUT_BANNER_HTML =
  '<div class="dwc-nut-banner"><span class="dwc-nut-line">Get your nut, and protect it too!!</span><span class="dwc-18only">18+ only</span>' +
  '<div class="dwc-paypal-demo"><div class="dwc-paypal-label">Example — illustration only, not a real PayPal screenshot</div>' +
  '<div class="dwc-paypal-balance">$1,240.00 <small>▲ +$12.50 just now</small></div>' +
  '<p class="dwc-paypal-note">PayPal balance rising — sales land here the moment buyers pay.</p>' +
  '<div class="dwc-paypal-bars" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div></div></div>';
// Digital File Marketplace — Chris's words verbatim + featured examples
// (the shop's own 3D prints, clearly labeled EXAMPLE — no fake members,
// no fake sales).
var DFM_HTML =
  '<section class="card dwc-dfm"><h3 class="dwc-neon-head" style="margin-top:0">Digital File Marketplace!</h3>' +
  '<p>They try to download or take a pic/screenshot, IP logged, Perma ban, and their location is offered to you to press charges for IP infringement they sign up for upon the account creation screen, as we don\'t steal here. We help grow the hustle of every single hustler out there working hard but make it easier as we make nothing from these sales, we just keep them from giving your files away for free or copying them. And lets them know not to redistribute any IP from anyone or your account can be suspended indefinitely, it costs nothing to make an sellers/buyers account, but 100 free listings per month reset monthly, to 1.5% only taken ONCE AND ONLY ONCE the sale is complete and you\'ve gotten immediately required payment. We refuse to charge for any of our services as much as other big companies do, and don\'t need to, this place is to keep you, your files, your ideas, your communication, content, livelihood, knowledge, and information safe and ensures top measures taken to ensure this. If you need help reach out to an admin and get to building your space whether it need be a site you code for your business to start or model your photography to the world, RCR is the place to do it all!</p>' +
  '<div class="dwc-examples">' +
  '<div class="dwc-example"><img src="images/octopus-holder.jpg" alt="3D printed octopus holder"><div class="dwc-example-body"><span class="dwc-example-badge">Example</span><h4>3D Printed Octopus Holder</h4><p>Screw / bolt mounted · $15.00</p><p>Example showcase — not a real member listing.</p></div></div>' +
  '<div class="dwc-example"><img src="images/death-whistle.jpg" alt="3D printed Aztec death whistle"><div class="dwc-example-body"><span class="dwc-example-badge">Example</span><h4>Aztec Death Whistle — Replica</h4><p>3D printed · $8.00</p><p>Example showcase — not a real member listing.</p></div></div>' +
  '<div class="dwc-example"><img src="images/gengar-shadow-stand.jpg" alt="3D printed Gengar shadow display stand"><div class="dwc-example-body"><span class="dwc-example-badge">Example</span><h4>Gengar Shadow Display Stand</h4><p>3D printed · $8.00</p><p>Example showcase — not a real member listing.</p></div></div>' +
  '</div></section>';
// Find call-to-action — the unmissable entry to Find a Seller / Buyer +
// private chats, right in the 18+ area. (Find itself is v3 — it only
// appears once v3 is pushed and the v3 migration has run on live D1.)
var FIND_CTA_HTML =
  '<section class="card dwc-find-cta" style="text-align:center"><h3 style="margin-top:0">✨ Find a Seller / Find a Buyer</h3>' +
  '<p style="color:var(--muted)">Looking for a certain type or genre? Find matches you with buyers and sellers by what they sell, what they want, and their price — best matches first.</p>' +
  '<p><button type="button" class="btn" style="font-size:18px;padding:16px 26px" onclick="DWC.go(\'find\')">✨ Find a Seller / Find a Buyer →</button></p>' +
  '<p><button type="button" class="btn ghost" onclick="DWC.go(\'find\')">🔒 My private chats →</button></p></section>';

// ---------- After Dark 18+ ----------
async function viewAdult(el) {
  if (!state.profile) { el.innerHTML = needProfileHTML(); return; }
  if (!state.profile.age_verified) {
    var st = await apiGet("/age-verification/status?device_id=" + encodeURIComponent(deviceId()));
    var welcome = await apiGet("/adult-welcome?device_id=" + encodeURIComponent(deviceId()));
    var wimg = welcome && welcome.image_url;
    el.innerHTML =
      MATCH_BANNER_HTML +
      '<section class="card" style="text-align:center"><h2 style="margin-top:0">🌙 After Dark — 18+ only</h2>' +
      NUT_BANNER_HTML +
      (wimg
        ? '<img src="' + esc(wimg) + '" alt="Welcome to the 18+ area" class="dwc-welcome-img">'
        : '<div class="dwc-welcome-slot"><p>🌙</p><p><strong>Welcome picture slot</strong></p><p style="font-size:13px;color:var(--muted)">Chris uploads his own welcome picture here. The slot is empty until he does — no stock photo.</p></div>') +
      '<p>This area is for age-verified members only. A typed birthday alone is never enough — a real photo ID check is what opens the door.</p>' +
      (st && st.pending ? '<p class="dwc-info">🕐 Your ID is waiting for review — Chris reviews every ID himself.</p>' : "") +
      "</section>" +
      DFM_HTML +
      FIND_CTA_HTML +
      '<section class="card"><h3 style="margin-top:0">Verify your age</h3>' +
      AGE_NOTICE_HTML + AGE_REVIEW_NOTE + '<div id="dwc-age-block"></div></section>';
    renderAgeBlock();
    return;
  }
  try { localStorage.setItem(ADULT_KEY, "1"); } catch (e) {}
  el.innerHTML =
    MATCH_BANNER_HTML +
    '<section class="card" style="text-align:center"><h2 style="margin-top:0">🌙 After Dark — 18+</h2>' + NUT_BANNER_HTML + '<div id="dwc-welcome"></div></section>' +
    DFM_HTML +
    FIND_CTA_HTML +
    '<div class="dwc-adultnav"><button type="button" class="dwc-pill active" data-adulttab="forum" onclick="DWC.adultTab(this, \'forum\')">💬 18+ Forum</button>' +
    '<button type="button" class="dwc-pill" data-adulttab="models" onclick="DWC.adultTab(this, \'models\')">🔍 Model Search</button>' +
    '<button type="button" class="dwc-pill" data-adulttab="finder" onclick="DWC.adultTab(this, \'finder\')">✨ Find My Girl or Guy</button>' +
    '<button type="button" class="dwc-pill" data-adulttab="modelme" onclick="DWC.adultTab(this, \'modelme\')">📸 My Model Listing</button></div>' +
    '<div id="dwc-adult-tab"></div>';
  var w = await apiGet("/adult-welcome?device_id=" + encodeURIComponent(deviceId()));
  var wh = $("dwc-welcome");
  if (wh) {
    if (w && w.image_url) {
      wh.innerHTML = '<img src="' + esc(w.image_url) + '" alt="Welcome to the 18+ area" class="dwc-welcome-img">' +
        (w.can_replace ? '<p><button type="button" class="btn ghost small" onclick="DWC.uploadWelcome()">Replace welcome picture</button></p>' : "");
    } else {
      wh.innerHTML = '<div class="dwc-welcome-slot"><p>🌙</p><p><strong>Welcome picture slot</strong></p><p style="font-size:13px;color:var(--muted)">Chris uploads his own welcome picture here. The slot is empty until he does — no stock photo.</p>' +
        (w && w.can_replace ? '<p><button type="button" class="btn ghost small" onclick="DWC.uploadWelcome()">Upload the welcome picture</button></p>' : "") + "</div>";
    }
  }
  renderAdultForum();
}
function adultTabButtons(tab) {
  document.querySelectorAll("[data-adulttab]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-adulttab") === tab); });
}
async function renderAdultForum() {
  var host = $("dwc-adult-tab");
  if (!host) return;
  adultTabButtons("forum");
  host.innerHTML =
    '<h3 style="margin:18px 0 4px">🗂️ Browse the 18+ categories</h3><div class="dwc-catgrid">' + ADULT_CATEGORIES.map(function (c) {
      return '<button type="button" class="dwc-cattile" onclick="DWC.adultCategory(\'' + esc(c) + '\')">' + esc(c) + "</button>";
    }).join("") + "</div>" +
    '<div id="dwc-adult-composer"></div>' +
    '<div id="dwc-adult-creator"></div>' +
    '<div id="dwc-adult-feed"><p style="color:var(--muted)">Loading the 18+ forum…</p></div>' +
    '<div id="dwc-adult-tags"></div>';
  renderAdultComposer();
  var data = await apiGet("/posts?kind=adult&sort=new&limit=50&device_id=" + encodeURIComponent(deviceId()));
  var feed = $("dwc-adult-feed");
  if (!feed) return;
  var posts = (data && data.posts) || [];
  feed.innerHTML = posts.length
    ? '<div class="grid">' + posts.map(postCardHTML).join("") + "</div>"
    : '<div class="note">The 18+ forum is quiet — post the first one.</div>';
  var tags = await apiGet("/tags?scope=adult&device_id=" + encodeURIComponent(deviceId()));
  var tagEl = $("dwc-adult-tags");
  if (tagEl) {
    var list = (tags && tags.tags) || [];
    tagEl.innerHTML = list.length
      ? '<h3>Trending 18+ tags</h3><p class="dwc-tags">' + list.map(function (t) { return '<a href="#/tag/adult/' + encodeURIComponent(t.tag) + '">#' + esc(t.tag) + " (" + t.count + ")</a>"; }).join(" ") + "</p>"
      : "";
  }
}
function renderAdultComposer() {
  var host = $("dwc-adult-composer");
  if (!host) return;
  host.innerHTML =
    '<section class="card" aria-label="New 18+ post"><h3 style="margin-top:0">New post — 18+ forum</h3>' +
    '<form onsubmit="return DWC.submitPost(this, \'adult\')">' +
    '<input type="hidden" name="kind" value="adult">' +
    '<label>Corner (one of the 53 adult categories)</label><select name="category">' + ADULT_CATEGORIES.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
    '<label>Flair</label><select name="flair">' + FLAIRS.map(function (f) { return "<option>" + esc(f) + "</option>"; }).join("") + "</select>" +
    '<label>Title (3–120 characters)</label>' +
    '<input name="title" required minlength="3" maxlength="120" placeholder="What’s this about?">' +
    '<label>Post (up to 4000 characters)</label>' +
    '<textarea name="body" required maxlength="4000" placeholder="Write it out…"></textarea>' +
    '<label>Tags (up to 6, comma separated)</label>' +
    '<input name="tags" maxlength="240" placeholder="e.g. cosplay, amateur">' +
    '<label>Photo (JPG, PNG, or WebP, under 2.5 MB — optional)</label>' +
    '<input name="photo" type="file" accept="image/jpeg,image/png,image/webp">' +
    '<label><input type="checkbox" name="blur_photo" style="width:auto"> 🙈 Blur this photo — viewers see a blurred preview (they can tap to reveal). Off by default; never on unless you tick it.</label>' +
    gifPickerHTML("composer-adult") +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">Post to the 18+ forum →</button></p>' +
    "</form></section>";
  renderCreatorComposer();
}

// ---------- Creator post composer (v3) ----------
// A creator post is an 18+ forum post that sells digital content: an
// emoji-friendly title, a genre, the seller's own tags, a price (0 =
// free), and an optional 3D print file. It shows up in the adult feed
// and its tag pages like any adult post, with a Creator badge.
function renderCreatorComposer() {
  var host = $("dwc-adult-creator");
  if (!host) return;
  host.innerHTML =
    '<section class="card dwc-creatorbox" aria-label="New creator post"><h3 style="margin-top:0">🎨 Creator post — sell your digital content</h3>' +
    '<p style="color:var(--muted)">Selling photos, videos, custom content, audio, or 3D print files? Post it here. Age-verified members only — your post shows in the 18+ forum and its tag pages, with a Creator badge and your price. Payment is arranged privately with the buyer in a private chat.</p>' +
    '<form onsubmit="return DWC.submitCreatorPost(this)">' +
    '<input type="hidden" name="kind" value="adult">' +
    '<label>Corner (one of the 53 adult categories)</label><select name="category">' + ADULT_CATEGORIES.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
    '<label>Title (3–120 characters) — tap an emoji to add flair</label>' +
    '<input name="title" required minlength="3" maxlength="120" placeholder="e.g. New set — 20 photos 🔥">' +
    '<div class="dwc-emojirow" aria-label="Emoji flair — tap to add to the title">' +
    TITLE_EMOJIS.map(function (e) { return '<button type="button" class="dwc-emoji" onclick="DWC.titleEmoji(this, \'' + e + '\')" title="Add ' + e + ' to the title">' + e + "</button>"; }).join("") +
    "</div>" +
    '<label>What kind of content is this? — tap a card</label>' +
    '<div class="dwc-genregrid" role="group" aria-label="Content genre">' +
    CREATOR_GENRES.map(function (g, i) { return '<button type="button" class="dwc-genrecard' + (i === 0 ? " on" : "") + '" data-genrecard="' + esc(g) + '" onclick="DWC.pickGenre(this, \'' + esc(g.replace(/'/g, "")) + '\')">' + esc(g) + "</button>"; }).join("") +
    "</div>" +
    '<input type="hidden" name="content_genre" value="' + esc(CREATOR_GENRES[0]) + '">' +
    '<label>Description (up to 4000 characters)</label>' +
    '<textarea name="body" required maxlength="4000" placeholder="What’s in it, how many photos/minutes, what makes it yours…"></textarea>' +
    '<label>Your tags (up to 8, comma separated — buyers find you by these)</label>' +
    '<input name="tags" maxlength="240" placeholder="e.g. cosplay, custom, amateur">' +
    '<div class="dwc-chiprow" aria-label="One-tap seller tags">' +
    CREATOR_TAG_CHIPS.map(function (t) { return '<button type="button" class="dwc-chip" onclick="DWC.addTagChip(this, \'' + esc(t.replace(/'/g, "")) + '\')">' + esc(t) + " +</button>"; }).join("") +
    "</div>" +
    '<label>Price (USD — 0 = free). Tick “Pay to unlock” below and viewers see a locked preview with a “Pay to unlock” button at this price.</label>' +
    '<input name="price" type="number" step="1" min="0" max="100000" value="0" required>' +
    '<label>Preview photo (JPG, PNG, or WebP, under 2.5 MB — optional)</label>' +
    '<input name="photo" type="file" accept="image/jpeg,image/png,image/webp">' +
    '<label><input type="checkbox" name="blur_photo" style="width:auto"> 🙈 Blur this photo — viewers see a blurred preview (they can tap to reveal). Off by default; never on unless you tick it.</label>' +
    '<label><input type="checkbox" name="pay_unlock" style="width:auto"> 🔓 Pay to unlock — set a price above and viewers see a locked preview with a “Pay to unlock” button. Only works with a price above $0. Off by default.</label>' +
    '<label>3D print file — .stl, .obj, .3mf, or a .zip of them (under 25 MB — optional, only when the genre is 3D Print Files or you’re including one)</label>' +
    '<input name="print_file" type="file" accept=".stl,.obj,.3mf,.zip">' +
    gifPickerHTML("composer-creator") +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">Post it as a creator post →</button></p>' +
    "</form></section>";
}
async function renderModelSearch() {
  var host = $("dwc-adult-tab");
  if (!host) return;
  adultTabButtons("models");
  host.innerHTML =
    '<section class="card"><h3 style="margin-top:0">🔍 Model Search</h3>' +
    "<p style=\"color:var(--muted)\">Every card here shows ONLY what the model chose to share — their blurb, their chosen categories, and their chosen display picture. Nothing else about them is shown here.</p>" +
    '<form class="dwc-rowform" onsubmit="return DWC.searchModels(this)">' +
    '<input name="query" maxlength="60" placeholder="Search by name or keyword…" style="flex:1">' +
    '<select name="category"><option value="">All categories</option>' + ADULT_CATEGORIES.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
    '<button class="btn" type="submit">Search</button></form>' +
    '<div id="dwc-model-results"><p style="color:var(--muted)">Loading models…</p></div></section>';
  var data = await apiGet("/models?device_id=" + encodeURIComponent(deviceId()) + "&limit=30");
  renderModelCards($("dwc-model-results"), (data && data.models) || []);
}
function modelCardHTML(m) {
  return '<article class="card dwc-model">' +
    (m.display_url ? '<img class="dwc-model-img" src="' + esc(m.display_url) + '" alt="Model display picture" loading="lazy">' : '<span class="dwc-avatar dwc-avatar-none">🌙</span>') +
    "<h3>@" + esc(m.username) + "</h3>" +
    (m.model_bio ? "<p>" + esc(m.model_bio) + "</p>" : "") +
    (m.categories.length ? '<p class="dwc-tags">' + m.categories.map(function (c) { return "<span>#" + esc(c) + "</span>"; }).join(" ") + "</p>" : "") +
    (m.match_count != null ? '<p class="dwc-match">✨ Matched ' + m.match_count + " of your picks</p>" : "") +
    "</article>";
}
function renderModelCards(host, models) {
  if (!host) return;
  host.innerHTML = models.length
    ? '<div class="grid">' + models.map(modelCardHTML).join("") + "</div>"
    : '<div class="note">No models match that — try a different search.</div>';
}
async function renderFinder() {
  var host = $("dwc-adult-tab");
  if (!host) return;
  adultTabButtons("finder");
  host.innerHTML =
    '<section class="card"><h3 style="margin-top:0">✨ Find My Girl or Guy</h3>' +
    "<p style=\"color:var(--muted)\">Pick what you’re looking for. Models are matched ONLY on the details each model chose to share — blank means not shared, and it never counts against them.</p>" +
    '<form onsubmit="return DWC.findMatches(this)">' +
    '<label>I’m looking for</label><select name="gender"><option value="any">Anyone</option><option value="girl">Girl</option><option value="guy">Guy</option></select>' +
    '<div class="dwc-rowform"><label style="flex:1">Age from<input name="age_min" type="number" min="18" max="99" placeholder="18"></label><label style="flex:1">Age to<input name="age_max" type="number" min="18" max="99" placeholder="99"></label></div>' +
    '<label>Eye color</label><select name="eye_color"><option value="">Any</option>' + MODEL_EYE_COLORS.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
    '<label>Weight</label><select name="weight"><option value="any">Any</option><option value="under120">Under 120 lbs</option><option value="120-150">120–150 lbs</option><option value="150-180">150–180 lbs</option><option value="over180">Over 180 lbs</option></select>' +
    '<label>Style</label><select name="style"><option value="">Any</option>' + MODEL_STYLES.map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("") + "</select>" +
    '<label>Music taste</label><input name="music" maxlength="60" placeholder="e.g. metal, k-pop…">' +
    '<label><input type="checkbox" name="gamer" style="width:auto"> Gamer</label>' +
    '<label>Breast size</label><select name="breast"><option value="any">Any</option><option>Small</option><option>Big</option></select>' +
    '<label>Tattoos / piercings</label><select name="ink"><option value="any">Any</option><option value="has">Has tattoos or piercings</option><option value="none">None</option></select>' +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">Find my match →</button></p></form>' +
    '<div id="dwc-finder-results"></div></section>';
}
function renderModelMe() {
  var host = $("dwc-adult-tab");
  if (!host) return;
  adultTabButtons("modelme");
  var p = state.profile;
  host.innerHTML =
    '<section class="card"><h3 style="margin-top:0">📸 My Model Listing</h3>' +
    "<p style=\"color:var(--muted)\">Opt in to the model search. Everything on your card is chosen by you — your blurb, your categories, your display picture, and the match details below. Leave anything blank and it simply isn’t shared.</p>" +
    '<form onsubmit="return DWC.saveModelProfile(this)">' +
    '<label><input type="checkbox" name="opt_in" style="width:auto"' + (p.is_model ? " checked" : "") + "> List me in the model search</label>" +
    '<label>Your public blurb (up to 280 characters)</label>' +
    '<textarea name="model_bio" maxlength="280">' + esc(p.model_bio || "") + "</textarea>" +
    '<label>Categories (up to 6)</label><div class="dwc-checkgrid">' + ADULT_CATEGORIES.map(function (c) {
      return '<label><input type="checkbox" name="model_categories" value="' + esc(c) + '" style="width:auto"' + ((p.model_categories || []).includes(c) ? " checked" : "") + "> " + esc(c) + "</label>";
    }).join("") + "</div>" +
    '<label>Display picture (JPG, PNG, or WebP, under 2.5 MB)</label>' +
    '<input name="display_image" type="file" accept="image/jpeg,image/png,image/webp">' +
    (p.model_display_url ? '<label><input type="checkbox" name="remove_display_image" style="width:auto"> Remove my display picture</label>' : "") +
    '<label>Gender (for the finder)</label><select name="model_gender"><option value="">Prefer not to say</option><option value="girl"' + (p.model_gender === "girl" ? " selected" : "") + ">Girl</option><option value=\"guy\"" + (p.model_gender === "guy" ? " selected" : "") + ">Guy</option></select>" +
    '<label>Eye color</label><select name="model_eye_color"><option value="">Prefer not to say</option>' + MODEL_EYE_COLORS.map(function (c) { return '<option' + (p.model_eye_color === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select>" +
    '<label>Weight (lbs — optional, 70–700)</label><input name="model_weight_lbs" type="number" min="70" max="700" value="' + (p.model_weight_lbs != null ? p.model_weight_lbs : "") + '">' +
    '<label>Styles (up to 3)</label><div class="dwc-checkgrid">' + MODEL_STYLES.map(function (s) {
      return '<label><input type="checkbox" name="model_styles" value="' + esc(s) + '" style="width:auto"' + ((p.model_styles || []).includes(s) ? " checked" : "") + "> " + esc(s) + "</label>";
    }).join("") + "</div>" +
    '<label>Music taste</label><input name="model_music" maxlength="80" value="' + esc(p.model_music || "") + '">' +
    '<label>Gamer?</label><select name="model_gamer"><option value="">Prefer not to say</option><option value="yes"' + (p.model_gamer === "yes" ? " selected" : "") + ">Yes</option><option value=\"no\"" + (p.model_gamer === "no" ? " selected" : "") + ">No</option></select>" +
    '<label>Breast size</label><select name="model_breast"><option value="">Prefer not to say</option>' + ["Small", "Medium", "Big"].map(function (b) { return '<option' + (p.model_breast === b ? " selected" : "") + ">" + esc(b) + "</option>"; }).join("") + "</select>" +
    '<label>Tattoos / piercings</label><select name="model_ink"><option value="">Prefer not to say</option>' + MODEL_INK_OPTIONS.map(function (o) { return '<option' + (p.model_ink === o ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select>" +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">Save my model listing →</button></p></form></section>';
}

// ---------- actions (window.DWC) ----------
function formErr(form, msg) {
  var e = form.querySelector("[data-err]");
  if (e) { e.hidden = !msg; e.textContent = msg || ""; }
  return false;
}
async function refreshProfile() {
  var data = await apiGet("/profile?device_id=" + encodeURIComponent(deviceId()));
  state.profile = (data && data.profile) || null;
}
async function refreshStats() {
  var data = await apiGet("/stats");
  if (data && !data.error) state.stats = data;
}

window.DWC = {
  go: go,
  dismissNotice: function () { setNotice(null); },
  setCategory: function (c) { state.category = c; renderView(); },
  setSort: function (s) { state.sort = s; renderView(); },
  openSignup: function () { state.signupOpen = true; state.editingProfile = false; state.challenge = null; renderAccount(); var el = $("dwc-account"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); },
  editProfile: function () { state.editingProfile = true; state.signupOpen = true; renderAccount(); var el = $("dwc-account"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); },
  cancelProfileForm: function () { state.editingProfile = false; state.signupOpen = false; renderAccount(); },
  copyLink: copyLink,
  openLightbox: function (url) { if (typeof openLightbox === "function") openLightbox(url); else window.open(url, "_blank"); },

  toggleGifPicker: function (key) {
    var box = document.querySelector('[data-gifbox="' + key + '"] .dwc-gifgrid');
    if (box) box.hidden = !box.hidden;
  },
  pickGif: function (key, url, label) {
    gifPick[key] = { url: url, label: label };
    var box = document.querySelector('[data-gifbox="' + key + '"]');
    if (box) {
      var grid = box.querySelector(".dwc-gifgrid");
      if (grid) grid.hidden = true;
      var picked = box.querySelector(".dwc-gif-picked");
      if (picked) picked.innerHTML = "Picked: " + esc(label) + ' <button type="button" class="dwc-linklike" onclick="DWC.clearGif(\'' + esc(key) + '\')">✕</button>';
      else {
        var span = document.createElement("span");
        span.className = "dwc-gif-picked";
        span.innerHTML = "Picked: " + esc(label) + ' <button type="button" class="dwc-linklike" onclick="DWC.clearGif(\'' + esc(key) + '\')">✕</button>';
        box.insertBefore(span, box.children[1] || null);
      }
    }
  },
  clearGif: function (key) { delete gifPick[key]; renderView(); },

  composerKind: function (btn, kind) {
    var form = btn.closest("form");
    if (!form) return;
    form.querySelector('input[name="kind"]').value = kind;
    form.querySelectorAll("[data-kind]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-kind") === kind); });
    var flair = form.querySelector('select[name="flair"]');
    if (flair) flair.value = kind === "card_auth" ? "Card Check" : "Discussion";
  },

  saveProfile: async function (form) {
    var isNew = !state.profile;
    var fd = new FormData(form);
    // Avatar: a bad picture must NEVER kill the whole save. If the pic
    // is too big or the wrong type, we save the rest of the profile and
    // tell the member exactly why the picture didn't stick.
    var avatar = await fileToImage(fd.get("avatar") && fd.get("avatar").size ? fd.get("avatar") : null, 1500000);
    var avatarError = (avatar && avatar.error) || null;
    var avatarUploaded = false;
    var body = {
      device_id: deviceId(),
      username: String(fd.get("username") || "").trim(),
      chat_name: String(fd.get("chat_name") || "").trim(),
      occupation: String(fd.get("occupation") || "").trim(),
      bio: String(fd.get("bio") || "").trim(),
      birthday: fd.get("birthday") || null,
      payout_method: String(fd.get("payout_method") || "").trim(),
      payout_handle: String(fd.get("payout_handle") || "").trim(),
      remove_avatar: !!fd.get("remove_avatar"),
    };
    if (avatar) body.avatar = { dataBase64: avatar.dataBase64, mimeType: avatar.mimeType };
    // MySpace throwback v2 — Top Friends (only if the picker actually
    // rendered, so a failed member load never wipes the list), plus the
    // custom layout CSS + preset.
    if (form.querySelectorAll('input[name="top_friend"]').length) {
      var tf = [];
      form.querySelectorAll('input[name="top_friend"]:checked').forEach(function (cb) {
        var n = parseInt(cb.value, 10);
        if (n > 0 && tf.indexOf(n) === -1) tf.push(n);
      });
      body.top_friends = tf.slice(0, 8);
    }
    var cssEl = form.querySelector('textarea[name="layout_css"]');
    if (cssEl) body.layout_css = cssEl.value;
    var presetEl = form.querySelector('input[name="layout_preset"]');
    if (presetEl) body.layout_preset = presetEl.value;
    // Creator/Seller area (v3) — "What I sell" / "What I'm after".
    var toCents = function (v) {
      var n = parseInt(v, 10);
      return Number.isNaN(n) ? 0 : Math.round(Math.max(0, n) * 100);
    };
    body.seller_types = [];
    form.querySelectorAll('input[name="seller_types"]:checked').forEach(function (cb) { body.seller_types.push(cb.value); });
    body.seller_tags = String(fd.get("seller_tags") || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    body.seller_open_to = String(fd.get("seller_open_to") || "").trim();
    body.seller_price_min_cents = toCents(fd.get("seller_price_min"));
    body.seller_price_max_cents = toCents(fd.get("seller_price_max"));
    body.buyer_types = [];
    form.querySelectorAll('input[name="buyer_types"]:checked').forEach(function (cb) { body.buyer_types.push(cb.value); });
    body.buyer_tags = String(fd.get("buyer_tags") || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    body.buyer_budget_max_cents = toCents(fd.get("buyer_budget"));
    // Subscribe button text (v3.2) — the seller's custom label for the
    // button on their page; empty falls back to "Subscribe to my page".
    if (form.querySelector('input[name="subscribe_label"]')) {
      body.subscribe_label = String(fd.get("subscribe_label") || "").trim().slice(0, 40) || "Subscribe to my page";
    }
    // Member-page theme (v3.2) — only the pickers the member actually
    // opted into (checkbox ticked / URL or font chosen). The server
    // re-validates and stores "" when nothing is set.
    if (form.querySelector('input[name="theme_bg_color"]')) {
      var theme = { bg_color: "", bg_image_url: "", text_color: "", accent_color: "", font: "" };
      var hexOk = function (val) { return /^#[0-9a-fA-F]{6}$/.test(String(val || "").trim()) ? String(val).trim() : ""; };
      if (fd.get("theme_bg_use")) theme.bg_color = hexOk(fd.get("theme_bg_color"));
      var bgImg = String(fd.get("theme_bg_image") || "").trim().slice(0, 500);
      if (/^https:\/\//i.test(bgImg)) theme.bg_image_url = bgImg;
      if (fd.get("theme_text_use")) theme.text_color = hexOk(fd.get("theme_text_color"));
      if (fd.get("theme_accent_use")) theme.accent_color = hexOk(fd.get("theme_accent_color"));
      var fontSel = String(fd.get("theme_font") || "");
      if (themeFontCSS(fontSel)) theme.font = fontSel;
      body.profile_theme = JSON.stringify(theme);
    }
    // Music (v3.1) — A Steady Heart track picks (max 5) + the opt-in
    // Steady Wave player. Edit-only fields (the picker only renders
    // on edit), so only send them when the form has them.
    if (form.querySelectorAll('input[name="ash_tracks"]').length) {
      body.ash_tracks = [];
      form.querySelectorAll('input[name="ash_tracks"]:checked').forEach(function (cb) {
        var n = parseInt(cb.value, 10);
        if (n >= 1 && n <= ASH_TRACKS.length && body.ash_tracks.indexOf(n) === -1) body.ash_tracks.push(n);
      });
      body.ash_tracks = body.ash_tracks.slice(0, 5);
    }
    if (form.querySelector('input[name="show_vnr_player"]')) {
      body.show_vnr_player = !!fd.get("show_vnr_player");
    }
    if (form.querySelector('input[name="autoplay_vnr"]')) {
      body.autoplay_vnr = !!fd.get("autoplay_vnr");
    }
    // My links (v3.4) — label + URL pairs from the "My links" editor.
    // Collected in order; the server validates (label 1-40 chars, URL
    // must start with http:// or https://, max 5) and drops bad rows.
    if (form.querySelectorAll('input[name="link_label"]').length || form.querySelectorAll('input[name="link_url"]').length) {
      var linkLabels = form.querySelectorAll('input[name="link_label"]');
      var linkUrls = form.querySelectorAll('input[name="link_url"]');
      body.my_links = [];
      for (var li = 0; li < linkLabels.length && li < linkUrls.length; li++) {
        body.my_links.push({ label: String(linkLabels[li].value || "").trim(), url: String(linkUrls[li].value || "").trim() });
      }
    }
    if (isNew) {
      body.full_name = String(fd.get("full_name") || "").trim();
      body.terms_agreed = !!fd.get("terms_agreed");
      body.bot_token = state.challenge ? state.challenge.token : "";
      body.bot_answer = parseInt(fd.get("bot_answer"), 10);
      if (Number.isNaN(body.bot_answer)) body.bot_answer = -1;
    }
    var data = await apiPost("/profile", body);
    if (!data || !data.ok) {
      if (isNew) { state.challenge = null; loadChallenge(); }
      return formErr(form, (data && data.error) || "Couldn't save that profile.");
    }
    state.profile = data.profile;
    state.editingProfile = false;
    state.signupOpen = false;
    // Avatar feedback: the picture either saved, or the member gets the
    // exact reason it didn't (too big / wrong type / upload failed) —
    // without losing the rest of the save.
    if (avatar) avatarUploaded = !!(data.profile && data.profile.avatar_url);
    var avatarNote = "";
    if (avatarError) avatarNote = " Your picture didn't save — " + avatarError;
    else if (data.avatar_error) avatarNote = " Your picture didn't save — " + data.avatar_error;
    else if (avatarUploaded) avatarNote = " Picture saved ✓";
    if (data.v2_pending || data.v3_pending) {
      setNotice("Profile saved — but " +
        (data.v2_pending && data.v3_pending ? "your Top Friends / layout and your What I sell / Find prefs / music picks didn't stick yet."
          : data.v2_pending ? "your Top Friends / layout didn't stick yet."
          : "your What I sell / Find prefs / music picks didn't stick yet.") +
        " The shop is still running a quick database update; try saving again later." + avatarNote);
    } else {
      setNotice((isNew ? "Welcome to the street, @" + data.profile.username + " — you're on." : "Profile saved.") + avatarNote);
    }
    render();
    await refreshStats();
    return false;
  },

  claimOperator: async function () {
    var data = await apiPost("/owner/setup", { device_id: deviceId() });
    if (data && data.ok) { await refreshProfile(); setNotice(data.message || "Operator claimed."); render(); }
    else setNotice((data && data.error) || "Couldn't claim the operator role.");
  },

  submitPost: async function (form, context) {
    var fd = new FormData(form);
    var kind = fd.get("kind") || (context === "cardcheck" ? "card_auth" : "forum");
    var photo = await fileToImage(fd.get("photo") && fd.get("photo").size ? fd.get("photo") : null, 2500000);
    if (photo && photo.error) return formErr(form, photo.error);
    var gk = "composer-" + context;
    var gif = gifPick[gk];
    var check = context === "cardcheck" ? state.checkResult : null;
    var body = {
      device_id: deviceId(), kind: kind,
      category: String(fd.get("category") || ""),
      flair: String(fd.get("flair") || ""),
      title: String(fd.get("title") || "").trim(),
      body: String(fd.get("body") || "").trim(),
      tags: String(fd.get("tags") || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean),
      gif_url: gif ? gif.url : null, gif_label: gif ? gif.label : "",
      blur_photo: !!fd.get("blur_photo"),
      verification_status: check ? check.status : "not_checked",
      verification_summary: check ? (check.summary || "") : "",
    };
    if (photo) body.image = { dataBase64: photo.dataBase64, mimeType: photo.mimeType };
    var data = await apiPost("/posts", body);
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't post that.");
    delete gifPick[gk];
    state.checkResult = null;
    setNotice(kind === "adult" ? "Posted to the 18+ forum." : "Posted.");
    if (context === "adult") renderAdultForum();
    else if (context === "cardcheck") renderView();
    else renderView();
    await refreshStats();
    return false;
  },

  submitCreatorPost: async function (form) {
    var fd = new FormData(form);
    var photo = await fileToImage(fd.get("photo") && fd.get("photo").size ? fd.get("photo") : null, 2500000);
    if (photo && photo.error) return formErr(form, photo.error);
    var printFile = await fileToPrintFile(fd.get("print_file") && fd.get("print_file").size ? fd.get("print_file") : null, 25000000);
    if (printFile && printFile.error) return formErr(form, printFile.error);
    var gk = "composer-creator";
    var gif = gifPick[gk];
    var price = parseInt(fd.get("price"), 10);
    if (Number.isNaN(price) || price < 0) price = 0;
    var body = {
      device_id: deviceId(), kind: "adult", is_creator: true,
      category: String(fd.get("category") || ""),
      flair: "",
      title: String(fd.get("title") || "").trim(),
      body: String(fd.get("body") || "").trim(),
      content_genre: String(fd.get("content_genre") || ""),
      price_cents: Math.round(price * 100),
      // v3.2, OPT-IN ONLY — both default off; the server only honors
      // pay_unlock on creator posts with a price above $0.
      blur_photo: !!fd.get("blur_photo"),
      pay_unlock: !!fd.get("pay_unlock"),
      tags: String(fd.get("tags") || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean),
      gif_url: gif ? gif.url : null, gif_label: gif ? gif.label : "",
    };
    if (photo) body.image = { dataBase64: photo.dataBase64, mimeType: photo.mimeType };
    if (printFile) body.print_file = { dataBase64: printFile.dataBase64, fileName: printFile.fileName };
    var data = await apiPost("/posts", body);
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't post that.");
    delete gifPick[gk];
    setNotice("Creator post is live in the 18+ forum.");
    renderAdultForum();
    await refreshStats();
    return false;
  },

  // Emoji flair — tap an emoji to insert it into the title at the cursor
  // (or at the end). Titles keep emojis as-is; nothing strips them.
  titleEmoji: function (btn, emoji) {
    var form = btn.closest("form");
    var input = form && form.querySelector('input[name="title"]');
    if (!input) return;
    var start = input.selectionStart != null ? input.selectionStart : input.value.length;
    var end = input.selectionEnd != null ? input.selectionEnd : input.value.length;
    var next = input.value.slice(0, start) + emoji + input.value.slice(end);
    if (next.length > 120) return;
    input.value = next;
    var pos = start + emoji.length;
    input.focus();
    try { input.setSelectionRange(pos, pos); } catch (e) {}
  },

  // Genre cards (v3.2) — tap a big genre card, it sets the hidden
  // content_genre input and lights up. Default is the first genre.
  pickGenre: function (btn, genre) {
    var form = btn.closest("form");
    var hidden = form && form.querySelector('input[name="content_genre"]');
    if (hidden) hidden.value = genre;
    var cards = form ? form.querySelectorAll("[data-genrecard]") : [];
    for (var i = 0; i < cards.length; i++) cards[i].classList.toggle("on", cards[i].getAttribute("data-genrecard") === genre);
  },

  // Blur toggle (v3.2) — reveal / re-hide a blurred photo preview.
  // This only flips the preview on this screen; it never changes the
  // post itself, and it never un-locks a pay-to-unlock photo.
  toggleBlur: function (btn) {
    var wrap = btn.closest(".dwc-photowrap");
    if (!wrap) return;
    var img = wrap.querySelector("img");
    if (!img) return;
    var hidden = img.classList.toggle("dwc-img-blurred");
    btn.textContent = hidden ? "👁 Blurred photo — tap to reveal" : "🙈 Blur this photo again";
  },
  // One-tap seller tag chip — adds the tag to the tags box (deduped).
  addTagChip: function (btn, tag) {
    var form = btn.closest("form");
    var input = form && form.querySelector('input[name="tags"]');
    if (!input) return;
    var parts = input.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    var norm = tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!parts.some(function (t) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-") === norm; })) {
      if (parts.length >= 8) { setNotice("8 tags max — drop one first."); return; }
      parts.push(tag);
      input.value = parts.join(", ");
    }
    btn.classList.add("on");
  },

  findRole: function (role) {
    state.findRole = role === "buyer" ? "buyer" : "seller";
    renderView();
  },
  saveFindPrefs: async function (form) {
    var fd = new FormData(form);
    var toCents = function (v) {
      var n = parseInt(v, 10);
      return Number.isNaN(n) ? 0 : Math.round(Math.max(0, n) * 100);
    };
    var body = {
      device_id: deviceId(),
      seller: {
        types: fd.getAll("seller_types"),
        tags: String(fd.get("seller_tags") || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean),
        open_to: String(fd.get("seller_open_to") || "").trim(),
        price_min_cents: toCents(fd.get("seller_price_min")),
        price_max_cents: toCents(fd.get("seller_price_max")),
      },
      buyer: {
        types: fd.getAll("buyer_types"),
        tags: String(fd.get("buyer_tags") || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean),
        budget_max_cents: toCents(fd.get("buyer_budget")),
      },
    };
    var data = await apiPost("/find", body);
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't save those prefs.");
    await refreshProfile();
    setNotice("Find prefs saved — matches below are fresh.");
    renderView();
    return false;
  },

  // "Buy / Message seller" — opens a private ephemeral chat with the
  // seller (optionally tied to the creator post). Payment and the file
  // swap are arranged in that chat, between the two of them.
  messageSeller: async function (sellerId, sellerUsername, postId) {
    if (!state.profile) { setNotice("Create your account first — private chats are for members."); DWC.openSignup(); return; }
    if (state.profile && sellerId === state.profile.id) { setNotice("That's your own post."); return; }
    await openEphemeralChat(sellerId, sellerUsername, postId || null);
  },
  openEphemeral: async function (partnerId, partnerUsername, postId) {
    await openEphemeralChat(partnerId, partnerUsername, postId || null);
  },
  // Close & delete — every message in this chat is deleted from the
  // database, for both sides, and the chat can't be reopened.
  closeEphemeral: async function () {
    var e = state.eph;
    if (!e) return;
    if (!confirm("Close this private chat? Every message in it is deleted for both of you, and it can't be reopened. Any receipts you saved are kept in My receipts.")) return;
    var data = await apiDelete("/ephemeral", { device_id: deviceId(), conversation_id: e.conversation_id });
    state.eph = null;
    state.ephMessages = [];
    state.ephTxnMsg = null;
    renderEphWin();
    if (data && data.ok) setNotice("Private chat closed — its messages were deleted. Receipts you saved are kept in My receipts.");
    else if (data && data.error) setNotice(data.error);
    if (state.route && state.route.name === "find") renderView();
  },
  // Transaction done — record a sale in this private chat. Saves a
  // receipt for BOTH parties (buyer "spent", seller "received") that
  // survives the message delete. One transaction per chat.
  toggleTxnForm: function () {
    var f = $("dwc-txn-form");
    if (f) f.hidden = !f.hidden;
  },
  saveTransaction: async function (form) {
    var e = state.eph;
    if (!e) return false;
    var fd = new FormData(form);
    var amount = parseInt(fd.get("amount"), 10);
    var note = String(fd.get("note") || "").trim();
    var role = fd.get("role") === "seller" ? "seller" : "buyer";
    var data = await apiPost("/receipts", { device_id: deviceId(), conversation_id: e.conversation_id, amount_dollars: amount, note: note, role: role });
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't save that receipt.");
    state.ephTxnMsg = "\u2713 Transaction recorded \u2014 " + (data.amount || "") + " for \u201c" + note + "\u201d. Receipts saved for both of you \u2014 see My receipts.";
    renderEphWin();
    return false;
  },
  sendEphemeral: async function (form) {
    var e = state.eph;
    if (!e) return false;
    var fd = new FormData(form);
    var body = String(fd.get("body") || "").trim();
    if (!body) return false;
    var data = await apiPost("/ephemeral", { device_id: deviceId(), conversation_id: e.conversation_id, body: body });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't send that."); return false; }
    form.reset();
    var conv = await apiGet("/ephemeral?device_id=" + encodeURIComponent(deviceId()) + "&conversation_id=" + e.conversation_id);
    if (conv && conv.messages) {
      state.ephMessages = conv.messages;
      renderEphWin();
    }
    return false;
  },

  runCardCheck: async function (form) {
    var slot = form.querySelector("[data-checkresult]");
    var photoInput = form.querySelector('input[name="photo"]');
    var file = photoInput && photoInput.files ? photoInput.files[0] : null;
    if (!file) { if (slot) slot.textContent = "Pick a photo first."; return; }
    if (slot) slot.textContent = "Running AI check…";
    var img = await fileToImage(file, 2500000);
    if (img.error) { if (slot) slot.textContent = img.error; return; }
    var data = await apiPost("/card-check", { image: img, context: (form.querySelector('input[name="title"]') || {}).value || "" });
    if (!data || !data.ok) {
      state.checkResult = null;
      if (slot) slot.textContent = data && data.error ? data.error : "The check didn't run.";
      return;
    }
    state.checkResult = data;
    var labels = { looks_consistent: "✓ Looks consistent", suspicious: "⚠ Suspicious", likely_fake_or_proxy: "⛔ Likely fake / proxy", needs_clearer_photo: "📷 Needs a clearer photo" };
    if (slot) slot.innerHTML = "<strong>" + esc(labels[data.status] || data.status) + "</strong>" +
      (data.summary ? "<br>" + esc(data.summary) : "") +
      (data.card_name ? "<br>Identified: " + esc(data.card_name) : "") +
      (data.raw_price ? "<br>Raw estimate: " + esc(data.raw_price) : "") +
      (data.graded_price ? "<br>Graded estimate: " + esc(data.graded_price) : "") +
      '<br><span style="font-size:12px">AI estimates for entertainment / informational use only — not live sold data, not a professional grade. Community votes decide.</span>';
  },

  runListingCheck: async function (form) {
    var slot = form.querySelector("[data-checkresult]");
    var photoInput = form.querySelector('input[name="photo1"]');
    var file = photoInput && photoInput.files ? photoInput.files[0] : null;
    if (!file) { if (slot) slot.textContent = "Pick the cover photo first."; return; }
    if (slot) slot.textContent = "Running AI check…";
    var img = await fileToImage(file, 2500000);
    if (img.error) { if (slot) slot.textContent = img.error; return; }
    var data = await apiPost("/card-check", { image: img, context: (form.querySelector('input[name="title"]') || {}).value || "" });
    if (!data || !data.ok) {
      state.listingCheck = null;
      if (slot) slot.textContent = data && data.error ? data.error : "The check didn't run.";
      return;
    }
    state.listingCheck = data;
    if (slot) slot.textContent = (data.status === "looks_consistent" ? "✓ Looks consistent" : data.status === "suspicious" ? "⚠ Suspicious" : data.status === "likely_fake_or_proxy" ? "⛔ Likely fake / proxy — this can't be listed for trade" : "📷 Needs a clearer photo") + (data.summary ? " — " + data.summary : "");
  },

  submitListing: async function (form, kind) {
    var fd = new FormData(form);
    var photos = [];
    for (var i = 1; i <= 3; i++) {
      var f = fd.get("photo" + i);
      if (f && f.size) {
        var img = await fileToImage(f, 2500000);
        if (img.error) return formErr(form, img.error);
        photos.push({ dataBase64: img.dataBase64, mimeType: img.mimeType });
      }
    }
    var check = state.listingCheck;
    var body = {
      device_id: deviceId(), kind: kind,
      category: String(fd.get("category") || ""),
      title: String(fd.get("title") || "").trim(),
      description: String(fd.get("description") || "").trim(),
      price_cents: Math.round(parseFloat(fd.get("price") || "0") * 100),
      trade_wanted: String(fd.get("trade_wanted") || "").trim(),
      allow_comments: !!fd.get("allow_comments"),
      images: photos,
      verification_status: check ? check.status : "not_checked",
      verification_summary: check ? (check.summary || "") : "",
    };
    var data = await apiPost("/listings", body);
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't list that.");
    state.listingCheck = null;
    setNotice("Listed — it's live in the " + (kind === "sale" ? "Market" : kind === "trade" ? "Up for Trade" : "Flea Market") + ".");
    go("listing/" + data.listing_id);
    await refreshStats();
    return false;
  },

  heartPost: async function (id, btn) {
    if (!state.profile) { setNotice("Create your account first to heart posts."); DWC.openSignup(); return; }
    var data = await apiPost("/posts/" + id + "/vote", { device_id: deviceId() });
    if (data && data.ok) {
      setHeart("post-" + id, data.my_heart);
      if (btn) { btn.classList.toggle("on", data.my_heart); btn.innerHTML = (data.my_heart ? "❤️" : "🤍") + " " + data.hearts; }
    } else if (data && data.error) setNotice(data.error);
  },
  heartComment: async function (postId, commentId, btn) {
    if (!state.profile) { setNotice("Create your account first to heart comments."); return; }
    var data = await apiPost("/posts/" + postId + "/comments/" + commentId + "/vote", { device_id: deviceId() });
    if (data && data.ok) {
      setHeart("comment-" + commentId, data.my_heart);
      if (btn) { btn.classList.toggle("on", data.my_heart); btn.innerHTML = (data.my_heart ? "❤️" : "🤍") + " " + data.hearts; }
    } else if (data && data.error) setNotice(data.error);
  },
  authVote: async function (postId, verdict) {
    if (!state.profile) { setNotice("Create your account first to vote."); DWC.openSignup(); return; }
    var data = await apiPost("/posts/" + postId + "/auth-vote", { device_id: deviceId(), verdict: verdict });
    if (data && data.ok) { setNotice("Vote counted — Real " + data.real + " · Looks Fake " + data.fake + " · Not Sure " + data.unsure + "."); renderView(); }
    else if (data && data.error) setNotice(data.error);
  },
  deletePost: async function (id) {
    if (!confirm("Delete this post and its comments?")) return;
    var data = await apiDelete("/posts/" + id, { device_id: deviceId() });
    if (data && data.ok) { setNotice("Post deleted."); go("street"); }
    else if (data && data.error) setNotice(data.error);
  },
  toggleComments: async function (id, allow) {
    var data = await apiPost("/posts/" + id + "/toggle-comments", { device_id: deviceId(), allow_comments: allow });
    if (data && data.ok) { setNotice(allow ? "Comments are back on." : "Comments are off — existing comments stay visible."); renderView(); }
    else if (data && data.error) setNotice(data.error);
  },
  submitComment: async function (form, postId) {
    var fd = new FormData(form);
    var gif = gifPick["comment-" + postId];
    var data = await apiPost("/posts/" + postId + "/comments", {
      device_id: deviceId(), body: String(fd.get("body") || "").trim(),
      gif_url: gif ? gif.url : null, gif_label: gif ? gif.label : "",
    });
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't comment.");
    delete gifPick["comment-" + postId];
    renderView();
    return false;
  },
  deleteComment: async function (postId, commentId) {
    if (!confirm("Delete this comment?")) return;
    var data = await apiDelete("/posts/" + postId + "/comments/" + commentId, { device_id: deviceId() });
    if (data && data.ok) renderView();
    else if (data && data.error) setNotice(data.error);
  },
  submitListingComment: async function (form, listingId) {
    var fd = new FormData(form);
    var gif = gifPick["listing-comment-" + listingId];
    var data = await apiPost("/listings/" + listingId + "/comments", {
      device_id: deviceId(), body: String(fd.get("body") || "").trim(),
      gif_url: gif ? gif.url : null, gif_label: gif ? gif.label : "",
    });
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't comment.");
    delete gifPick["listing-comment-" + listingId];
    renderView();
    return false;
  },
  deleteListing: async function (id) {
    if (!confirm("Close this listing? Sold listings stay as the receipt on the buyer's order.")) return;
    var data = await apiDelete("/listings/" + id, { device_id: deviceId() });
    if (data && data.ok) { setNotice("Listing closed."); go("market"); }
    else if (data && data.error) setNotice(data.error);
  },
  placeBid: async function (form, listingId) {
    var fd = new FormData(form);
    var data = await apiPost("/listings/" + listingId + "/bid", {
      device_id: deviceId(),
      amount_cents: Math.round(parseFloat(fd.get("bid") || "0") * 100),
    });
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't place that bid.");
    setNotice("Bid placed — you're the high bidder at " + money(data.current_bid_cents) + ".");
    renderView();
    return false;
  },
  tradeVote: async function (listingId, verdict) {
    if (!state.profile) { setNotice("Create your account first to vote."); DWC.openSignup(); return; }
    var data = await apiPost("/listings/" + listingId + "/trade-vote", { device_id: deviceId(), verdict: verdict });
    if (data && data.ok) { setNotice("Vote counted — Good " + data.good + " · Fair " + data.fair + " · Bad " + data.bad + "."); renderView(); }
    else if (data && data.error) setNotice(data.error);
  },
  buyListing: async function (listingId) {
    if (!state.profile) { setNotice("Create your account first to buy — orders live on your profile."); DWC.openSignup(); return; }
    if (!confirm("Complete this purchase? It lands in your My Orders. Payment is arranged directly with the seller — no money moves in this app.")) return;
    var data = await apiPost("/listings/" + listingId + "/buy", { device_id: deviceId() });
    if (!data || !data.ok) { setNotice((data && data.error) || "Purchase didn't go through."); return; }
    setNotice("Order placed — it's in My Orders, and your copy of the tracking number lands there as soon as the seller ships. Payment is arranged directly with the seller.");
    go("orders");
  },
  updateShipping: async function (form, orderId) {
    var fd = new FormData(form);
    var data = await apiPost("/orders/" + orderId + "/shipping", {
      device_id: deviceId(), status: fd.get("status"),
      carrier: fd.get("carrier") || "", tracking_number: String(fd.get("tracking_number") || "").trim(),
    });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't save shipping."); return false; }
    setNotice(fd.get("status") === "delivered" ? "Marked delivered — your wallet is credited (see Payouts)." : "Shipping saved — your buyer can see it now.");
    renderView();
    return false;
  },
  setAlerts: async function (orderId, enabled) {
    var data = await apiPost("/orders/" + orderId + "/tracking-alerts", { device_id: deviceId(), order_id: orderId, enabled: enabled });
    if (data && data.ok) setNotice(enabled ? "Tracking alerts on for this order." : "Tracking alerts off for this order.");
    else if (data && data.error) setNotice(data.error);
  },
  requestPayout: async function () {
    var data = await apiPost("/wallet/payout", { device_id: deviceId() });
    if (data && data.ok) { setNotice("Payout requested: " + money(data.amount_cents) + " — it goes to your payout method outside the app."); renderView(); }
    else if (data && data.error) setNotice(data.error);
  },
  sendChat: async function (form) {
    var fd = new FormData(form);
    var err = form.parentElement.querySelector("[data-err]");
    var data = await apiPost("/chat", {
      device_id: state.profile ? deviceId() : "",
      guest_name: String(fd.get("guest_name") || "").trim(),
      body: String(fd.get("body") || "").trim(),
    });
    if (!data || !data.ok) { if (err) { err.hidden = false; err.textContent = (data && data.error) || "Couldn't send that."; } return false; }
    form.reset();
    if (data.censored) setNotice("Sent — guests are auto-censored, so a word in your message was starred out.");
    await loadChatAim();
    return false;
  },

  // ---------- MySpace throwback v2 actions ----------
  topFriendChanged: function (cb) {
    var n = document.querySelectorAll('input[name="top_friend"]:checked').length;
    if (n > 8) {
      cb.checked = false;
      setNotice("Top 8 means 8 — unpick one first.");
    }
    updateTop8Count();
  },
  ashTrackChanged: function (cb) {
    var n = document.querySelectorAll('input[name="ash_tracks"]:checked').length;
    if (n > 5) {
      cb.checked = false;
      setNotice("Pick up to 5 tracks — unpick one first.");
    }
    updateAshCount();
  },
  // Avatar picker feedback (v3.4) — the moment Chris picks a file, show
  // its size and whether it will work, instead of failing silently on save.
  avatarPicked: function (input) {
    var note = document.getElementById("dwc-avatar-note");
    if (!note) return;
    var f = input && input.files && input.files[0];
    if (!f) { note.textContent = ""; return; }
    var mb = (f.size / 1000000).toFixed(1).replace(".0", "");
    if (f.type && IMAGE_MIMES_CLIENT.indexOf(f.type) === -1) {
      note.textContent = "Picked “" + f.name + "” — that isn't a JPG, PNG, or WebP. iPhone photos often save as HEIC; pick a JPG/PNG/WebP, or screenshot the photo and use that.";
      note.style.color = "var(--amber)";
    } else if (f.size > 1500000) {
      note.textContent = "Picked “" + f.name + "” — " + mb + " MB, too big. Keep it under 1.5 MB (a screenshot of the photo is usually small enough).";
      note.style.color = "var(--amber)";
    } else {
      note.textContent = "Picked “" + f.name + "” — " + mb + " MB ✓ Good to go — hit Save profile.";
      note.style.color = "var(--green)";
    }
  },
  // My links editor (v3.4) — add a row (max 5) or remove one row.
  addLinkRow: function () {
    var list = document.getElementById("dwc-links-list");
    if (!list) return;
    var rows = list.querySelectorAll(".dwc-linkrow").length;
    if (rows >= 5) { setNotice("Up to 5 links — remove one first."); return; }
    var div = document.createElement("div");
    div.className = "dwc-linkrow";
    div.innerHTML = '<input name="link_label" maxlength="40" placeholder="Label — e.g. My shop">' +
      '<input name="link_url" maxlength="500" placeholder="https://…">' +
      '<button type="button" class="btn ghost small" onclick="DWC.removeLinkRow(this)" title="Remove this link">✕</button>';
    list.appendChild(div);
    updateLinksCount();
    var first = div.querySelector('input[name="link_label"]');
    if (first) first.focus();
  },
  removeLinkRow: function (btn) {
    var list = document.getElementById("dwc-links-list");
    if (!list || !btn) return;
    var row = btn.closest(".dwc-linkrow");
    if (row) row.remove();
    if (!list.querySelectorAll(".dwc-linkrow").length) DWC.addLinkRow();
    updateLinksCount();
  },
  applyLayoutPreset: function (id) {
    var form = document.querySelector("#dwc-account form");
    var ta = form && form.querySelector('textarea[name="layout_css"]');
    var hidden = form && form.querySelector('input[name="layout_preset"]');
    if (id === "") {
      if (ta) ta.value = "";
      if (hidden) hidden.value = "";
    } else {
      if (ta) ta.value = layoutPresetCSS(id);
      if (hidden) hidden.value = id;
    }
    applyPreviewCSS(ta ? ta.value : "");
    document.querySelectorAll("[data-presetbtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-presetbtn") === id);
    });
  },
  layoutCssEdited: function (ta) {
    var form = ta.closest("form");
    var hidden = form && form.querySelector('input[name="layout_preset"]');
    if (hidden) hidden.value = "custom";
    applyPreviewCSS(ta.value);
    document.querySelectorAll("[data-presetbtn]").forEach(function (b) { b.classList.remove("active"); });
  },
  botAccent: function (color) {
    var el = $("dwc-bot-accent");
    if (el) el.value = color;
  },
  runLayoutBot: function () {
    var vibeEl = $("dwc-bot-vibe");
    var accentEl = $("dwc-bot-accent");
    var moodEl = $("dwc-bot-mood");
    var vibe = vibeEl ? vibeEl.value : "neon";
    var accent = accentEl ? accentEl.value : "";
    var mood = moodEl ? moodEl.value : "";
    var tw = $("dwc-taffy");
    // Taffy meditates to work — floats up, astral form leaves his body,
    // pure energy around him while he summons the layout.
    if (tw) tw.classList.add("taffy-working");
    var host = $("dwc-bot-result");
    if (host) host.innerHTML = '<p class="dwc-info">✨ Taffy is ascending… loading your layout.</p>';
    setTimeout(function () {
      botLayoutCSS = buildLayoutFromVibe(vibe, accent, mood);
      applyPreviewCSS(botLayoutCSS);
      if (tw) tw.classList.remove("taffy-working");
      if (host) {
        var v = LAYOUT_VIBES[vibe] || LAYOUT_VIBES.neon;
        host.innerHTML = '<p class="dwc-info">🍬 Taffy built you a <strong>' + esc(v.label) + '</strong> theme' +
          (accent ? ' with your <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:' + esc(accent) + ';vertical-align:-2px"></span> accent' : "") +
          (mood ? ' — mood: "' + esc(mood) + '"' : "") + '. Preview is live above.' +
          ' <button type="button" class="btn small" onclick="DWC.useBotLayout()">Use this layout →</button></p>';
      }
    }, 900);
  },
  useBotLayout: function () {
    if (!botLayoutCSS) return;
    var form = document.querySelector("#dwc-account form");
    var ta = form && form.querySelector('textarea[name="layout_css"]');
    var hidden = form && form.querySelector('input[name="layout_preset"]');
    if (ta) ta.value = botLayoutCSS;
    if (hidden) hidden.value = "custom";
    applyPreviewCSS(botLayoutCSS);
    setNotice("Taffy's theme is in your layout box — hit Save profile to keep it.");
  },
  setPresence: async function (status) {
    if (!state.profile) return;
    state.presence = status;
    var data = await apiPost("/presence", { device_id: deviceId(), status: status, away_message: state.awayMessage });
    if (data && data.ok) {
      var label = $("dwc-presence-state");
      if (label) label.textContent = status === "away" ? "🌙 Away" : "🟢 Online";
      await loadChatAim();
    } else if (data && data.error) setNotice(data.error);
  },
  saveAwayMessage: async function () {
    if (!state.profile) return;
    var input = $("dwc-away-msg");
    state.awayMessage = input ? input.value : "";
    var data = await apiPost("/presence", { device_id: deviceId(), status: state.presence, away_message: state.awayMessage });
    if (data && data.ok) setNotice("Away message saved.");
    else if (data && data.error) setNotice(data.error);
  },
  openIM: function (id, username) {
    if (!state.profile) { setNotice("Create your account first — IMs are for members."); DWC.openSignup(); return; }
    if (state.profile && id === state.profile.id) return;
    if (!state.openIMs.some(function (im) { return im.id === id; })) {
      state.openIMs.push({ id: id, username: username });
      if (state.openIMs.length > 4) state.openIMs.shift();
    }
    if (state.route && state.route.name === "chat") {
      syncIMShells();
      loadChatAim();
      var win = document.querySelector('[data-imwin="' + id + '"]');
      if (win) win.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      go("chat");
    }
  },
  closeIM: function (id) {
    state.openIMs = state.openIMs.filter(function (im) { return im.id !== id; });
    delete state.imCache[id];
    syncIMShells();
  },
  sendIM: async function (form, toId) {
    var fd = new FormData(form);
    var body = String(fd.get("body") || "").trim();
    if (!body) return false;
    var data = await apiPost("/direct-messages", { device_id: deviceId(), to: toId, body: body });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't send that IM."); return false; }
    form.reset();
    var conv = await apiGet("/direct-messages?device_id=" + encodeURIComponent(deviceId()) + "&with=" + toId);
    if (conv && conv.messages) {
      state.imCache[toId] = conv.messages;
      renderIMLog(toId);
    }
    return false;
  },
  imMember: function (id, username) {
    DWC.openIM(id, username);
  },

  // ---------- Taffy Phone ----------
  phoneOpen: function () {
    ensurePhoneRoot();
    state.phone.open = true;
    state.phone.app = "home";
    renderPhone();
  },
  phoneMinimize: function () {
    state.phone.open = false;
    renderPhone();
  },
  phoneGo: function (app) {
    state.phone.app = app;
    if (app === "msg") loadPhoneMsgList();
    renderPhone();
  },
  phoneWallpaper: function (id) {
    state.phone.wallpaper = id;
    savePhoneWallpaper(id);
    renderPhone();
  },
  phoneAscend: function () {
    var tw = $("dwc-phone-taffy");
    if (!tw || tw.classList.contains("taffy-working")) return;
    tw.classList.add("taffy-working");
    setTimeout(function () { if (tw) tw.classList.remove("taffy-working"); }, 2500);
  },
  phoneChatSend: function () {
    var input = document.getElementById("tp-chat-input");
    if (!input) return;
    var text = (input.value || "").trim();
    if (!text) return;
    input.value = "";
    input.focus();
    phoneChatAdd("me", text, "");
    var reply = taffyReply(text);
    var log = document.getElementById("tp-chat-log");
    var typingId = "tp-typing-" + Date.now();
    if (log) {
      log.insertAdjacentHTML("beforeend", '<div class="tp-bubble tp-bubble-taffy tp-typing" id="' + typingId + '"><span></span><span></span><span></span></div>');
      log.scrollTop = log.scrollHeight;
    }
    var tw = document.getElementById("dwc-phone-taffy");
    if (reply.ascend && tw) tw.classList.add("taffy-working");
    var delay = 650 + Math.floor(Math.random() * 650);
    setTimeout(function () {
      var t = document.getElementById(typingId);
      if (t) t.remove();
      if (reply.ascend && tw) tw.classList.remove("taffy-working");
      // Only append if the chat log is still on screen (user may have
      // navigated away mid-thought — the message still lands in state).
      if (document.getElementById("tp-chat-log")) phoneChatAdd("taffy", reply.text, reply.emoji);
      else {
        state.phoneChat.push({ who: "taffy", text: reply.text, emoji: reply.emoji || "" });
        if (state.phoneChat.length > 60) state.phoneChat.splice(0, state.phoneChat.length - 60);
      }
    }, delay);
  },
  phoneChatToggle: function () {
    state.phoneChatOpen = !state.phoneChatOpen;
    var chat = document.getElementById("tp-chat");
    if (!chat) return;
    chat.classList.toggle("open", state.phoneChatOpen);
    var head = chat.querySelector(".tp-chat-head");
    if (head) head.innerHTML = '<span>💬 ' + (state.phoneChatOpen ? "Chat with Taffy" : "Tap to chat with Taffy") + '</span><span class="tp-chat-chev">' + (state.phoneChatOpen ? "⌄" : "⌃") + '</span>';
    if (state.phoneChatOpen) {
      var input = document.getElementById("tp-chat-input");
      if (input) input.focus();
      var log = document.getElementById("tp-chat-log");
      if (log) log.scrollTop = log.scrollHeight;
    }
  },
  phoneChatClose: function () {
    if (!state.phoneChatOpen) return;
    state.phoneChatOpen = false;
    var chat = document.getElementById("tp-chat");
    if (!chat) return;
    chat.classList.remove("open");
    var head = chat.querySelector(".tp-chat-head");
    if (head) head.innerHTML = '<span>💬 Tap to chat with Taffy</span><span class="tp-chat-chev">⌃</span>';
  },
  phoneMsgMember: function (id, username) {
    DWC.phoneMinimize();
    DWC.openIM(id, username);
  },
  phoneSos: function () {
    DWC.phoneMinimize();
    DWC.go("reports");
  },
  phoneOpenEditor: function () {
    DWC.phoneMinimize();
    DWC.editProfile();
    // Land on the source code editor (Custom CSS), not the top of the form.
    setTimeout(function () {
      var ta = document.querySelector('textarea[name="layout_css"]');
      if (ta) { ta.scrollIntoView({ behavior: "smooth", block: "center" }); ta.focus(); }
    }, 80);
  },
  phoneGalleryAdd: async function (input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    if (state.phoneGallery.length >= 6) { setNotice("The gallery holds 6 photos at a time — delete one first."); input.value = ""; return; }
    var img = await fileToImage(file, 1500000);
    if (!img || img.error) { setNotice((img && img.error) || "That photo couldn't be read."); input.value = ""; return; }
    var item = { url: "data:" + img.mimeType + ";base64," + img.dataBase64, name: file.name || "photo", timer: null };
    item.timer = setTimeout(function () {
      var idx = state.phoneGallery.indexOf(item);
      if (idx >= 0) {
        state.phoneGallery.splice(idx, 1);
        if (state.phone.open && state.phone.app === "gallery") renderPhone();
      }
    }, 600000);
    state.phoneGallery.push(item);
    input.value = "";
    renderPhone();
  },
  phoneGalleryDel: function (i) {
    var it = state.phoneGallery[i];
    if (!it) return;
    if (it.timer) clearTimeout(it.timer);
    state.phoneGallery.splice(i, 1);
    renderPhone();
  },
  phoneGalleryOpen: function (i) {
    var it = state.phoneGallery[i];
    if (it) DWC.openLightbox(it.url);
  },
  phoneNotesInput: function (ta) {
    state.phoneNotes = ta.value;
  },
  phoneNotesCopy: function () {
    copyTextToClipboard(state.phoneNotes || "");
    setNotice(state.phoneNotes ? "Notes copied." : "Nothing to copy yet.");
  },
  phoneNotesClear: function () {
    state.phoneNotes = "";
    renderPhone();
  },

  report: async function (type, id) {
    if (!state.profile) { setNotice("Create your account first — reports come from members so they're accountable."); DWC.openSignup(); return; }
    var reason = prompt("What's wrong with this " + type + "? (optional — one line is enough)");
    if (reason === null) return;
    var data = await apiPost("/reports", { device_id: deviceId(), target_type: type, target_id: id, reason: reason || "" });
    if (data && data.ok) setNotice("Reported — it goes straight to the operator's inbox for Chris to review. Thanks.");
    else if (data && data.error) setNotice(data.error);
  },
  resolveReport: async function (id) {
    var data = await apiPost("/reports/" + id + "/resolve", { device_id: deviceId() });
    if (data && data.ok) { setNotice("Report marked reviewed."); renderView(); }
    else if (data && data.error) setNotice(data.error);
  },
  submitId: async function (form) {
    var fd = new FormData(form);
    var file = fd.get("id_photo");
    if (!file || !file.size) return formErr(form, "Pick a photo of your ID first.");
    var img = await fileToImage(file, 2500000);
    if (img.error) return formErr(form, img.error);
    var data = await apiPost("/age-verification/submit", { device_id: deviceId(), id_image: { dataBase64: img.dataBase64, mimeType: img.mimeType } });
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't submit that ID.");
    setNotice(data.message || "Received — Chris reviews every ID himself.");
    await refreshProfile();
    renderView();
    return false;
  },
  decideAge: async function (requestId, decision) {
    if (!confirm(decision === "approve" ? "Approve this ID? The member becomes age-verified and the ID photo is permanently deleted." : "Reject this ID? The photo is permanently deleted and the member stays unverified.")) return;
    var data = await apiPost("/age-verification/decide", { device_id: deviceId(), request_id: requestId, decision: decision });
    if (data && data.ok) { setNotice(decision === "approve" ? "Approved — the member is age-verified and the ID photo is deleted." : "Rejected — the ID photo is deleted."); renderView(); }
    else if (data && data.error) setNotice(data.error);
  },
  uploadWelcome: function () {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = async function () {
      var img = await fileToImage(input.files && input.files[0], 3000000);
      if (!img) return;
      if (img.error) { setNotice(img.error); return; }
      var data = await apiPost("/adult-welcome", { device_id: deviceId(), image: { dataBase64: img.dataBase64, mimeType: img.mimeType } });
      if (data && data.ok) { setNotice("Welcome picture set."); renderView(); }
      else setNotice((data && data.error) || "Couldn't set that picture.");
    };
    input.click();
  },
  adultTab: function (btn, tab) {
    if (tab === "forum") renderAdultForum();
    if (tab === "models") renderModelSearch();
    if (tab === "finder") renderFinder();
    if (tab === "modelme") renderModelMe();
  },
  adultCategory: function (cat) {
    state.category = cat;
    go("tag/adult/" + encodeURIComponent(cat));
  },
  searchModels: async function (form) {
    var fd = new FormData(form);
    var data = await apiGet("/models?device_id=" + encodeURIComponent(deviceId()) +
      "&query=" + encodeURIComponent(String(fd.get("query") || "").trim()) +
      "&category=" + encodeURIComponent(fd.get("category") || "") + "&limit=30");
    renderModelCards($("dwc-model-results"), (data && data.models) || []);
    return false;
  },
  findMatches: async function (form) {
    var fd = new FormData(form);
    var body = {
      device_id: deviceId(),
      gender: fd.get("gender") || "any",
      age_min: fd.get("age_min") ? parseInt(fd.get("age_min"), 10) : null,
      age_max: fd.get("age_max") ? parseInt(fd.get("age_max"), 10) : null,
      eye_color: fd.get("eye_color") || "",
      weight: fd.get("weight") || "any",
      style: fd.get("style") || "",
      music: String(fd.get("music") || "").trim(),
      gamer: fd.get("gamer") ? "yes" : "any",
      breast: fd.get("breast") || "any",
      ink: fd.get("ink") || "any",
    };
    var data = await apiPost("/models/matches", body);
    var host = $("dwc-finder-results");
    if (!host) return false;
    if (!data || !data.models) { host.innerHTML = '<p class="dwc-form-err">The finder didn’t load.</p>'; return false; }
    host.innerHTML = "<h4>Matches" + (data.criteria_total ? " — " + data.criteria_total + " thing" + (data.criteria_total === 1 ? "" : "s") + " you picked" : "") + "</h4>";
    renderModelCards(host, data.models);
    return false;
  },
  saveModelProfile: async function (form) {
    var fd = new FormData(form);
    var img = await fileToImage(fd.get("display_image") && fd.get("display_image").size ? fd.get("display_image") : null, 2500000);
    if (img && img.error) return formErr(form, img.error);
    var body = {
      device_id: deviceId(),
      opt_in: !!fd.get("opt_in"),
      model_bio: String(fd.get("model_bio") || "").trim(),
      model_categories: fd.getAll("model_categories"),
      model_gender: fd.get("model_gender") || "",
      model_eye_color: fd.get("model_eye_color") || "",
      model_weight_lbs: fd.get("model_weight_lbs") ? parseInt(fd.get("model_weight_lbs"), 10) : null,
      model_styles: fd.getAll("model_styles"),
      model_music: String(fd.get("model_music") || "").trim(),
      model_gamer: fd.get("model_gamer") || "",
      model_breast: fd.get("model_breast") || "",
      model_ink: fd.get("model_ink") || "",
      remove_display_image: !!fd.get("remove_display_image"),
    };
    if (img) body.display_image = { dataBase64: img.dataBase64, mimeType: img.mimeType };
    var data = await apiPost("/models", body);
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't save that listing.");
    setNotice("Your model listing is saved.");
    await refreshProfile();
    renderView();
    return false;
  },
  lookupPrice: async function (form) {
    var fd = new FormData(form);
    var name = String(fd.get("card") || "").trim();
    if (name.length < 2) return false;
    await showPriceChart(name);
    return false;
  },
  lookupPriceName: async function (name) { await showPriceChart(name); },
  logCardSale: async function (form) {
    var fd = new FormData(form);
    var data = await apiPost("/card-sales", {
      device_id: deviceId(),
      card_name: fd.get("card_name"),
      price_cents: Math.round(parseFloat(fd.get("price") || "0") * 100),
      sold_date: fd.get("sold_date"),
      venue: fd.get("venue"),
    });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't log that sale."); return false; }
    setNotice("Sale logged — the chart is built from real sales like yours. Thanks.");
    await showPriceChart(fd.get("card_name"));
    renderPriceChart($("dwc-pricechart"));
    return false;
  },
};

// ---------- init ----------
async function init() {
  if (!$("dwc-app")) return;
  await refreshProfile();
  await refreshStats();
  if (state.profile) {
    // AIM presence: start Online (or Away if that's how they left it) and
    // keep the heartbeat fresh every 60s so the buddy list sees them.
    state.presence = state.profile.presence === "away" ? "away" : "online";
    state.awayMessage = state.profile.away_message || "";
    await apiPost("/presence", { device_id: deviceId(), status: state.presence, away_message: state.awayMessage });
    state.presenceTimer = setInterval(function () {
      if (!state.profile) return;
      apiPost("/presence", { device_id: deviceId(), status: state.presence, away_message: state.awayMessage });
    }, 60000);
  }
  render();
  // Taffy Phone — the green call/text button lives on the page (outside
  // #dwc-app) from the start, so it's always there to open the phone.
  ensurePhoneRoot();
  loadPhoneWallpaper();
  renderPhone();
  window.addEventListener("hashchange", function () { render(); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();

