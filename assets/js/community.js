/* ============================================================
   Do Whatever Community — site app (vanilla JS, talks to /api/*)
   Community lives on community.html; routes are hash routes:
   #/street #/cardcheck #/market #/trade #/flea #/orders #/payouts
   #/members #/chat #/reports #/rules #/adult #/tag/<tag>
   #/tag/adult/<tag> #/post/<id> #/listing/<id>
   Identity: device id in localStorage (dwc-device-id); heart state in
   dwc-my-votes; adult welcome seen flag in dwc-adult-welcomed.
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
  '<p>You must be 18 years or older to sell adult content or enter the 18+ area. To confirm your age, upload a clear photo of your government-issued photo ID (driver\u2019s license, state ID, or passport).</p>' +
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
  '<p class="dwc-advisory" role="note">⚠ <strong>Keep the deal on the platform.</strong> Selling off site is discouraged for a reason: here, every member is a verified account, orders and tracking are recorded, and there\u2019s a report trail if anything goes wrong. Take a deal off site and you lose all of that protection — no record, no verified buyer, no help if it goes bad.</p>';

var THEFT_NOTICE_HTML =
  '<p class="dwc-theft" role="note">⚖ <strong>Stealing content is theft.</strong> Anyone who takes a member\u2019s content and redistributes it — in any form — will be held liable in court for money owed due to damages, and more. Don\u2019t do it, and report it if you see it.</p>';

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
  route: null,
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
function fileToImage(file, maxBytes) {
  return new Promise(function (resolve) {
    if (!file) return resolve(null);
    if (file.size > (maxBytes || 2500000)) return resolve({ error: "That photo is too large — keep it under about 2.5 MB." });
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

// ---------- routing ----------
var NAV = [
  ["street", "The Street"], ["chat", "💬 Live Chat"], ["market", "Market"],
  ["trade", "⇄ Up for Trade"], ["flea", "🔨 Flea Market"], ["cardcheck", "🔍 Card Check"],
  ["adult", "🌙 After Dark 18+"], ["orders", "📦 My Orders"], ["payouts", "💰 Payouts"],
  ["members", "Members"], ["reports", "🚩 Reports"], ["rules", "Rules & After Dark"],
];
function parseRoute() {
  var h = (location.hash || "").replace(/^#\/?/, "");
  var parts = h.split("/").filter(Boolean);
  if (!parts.length) return { name: "street" };
  var n = parts[0];
  if (n === "post" && parts[1]) return { name: "thread", postId: parts[1] };
  if (n === "listing" && parts[1]) return { name: "listing", listingId: parts[1] };
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
    return '<button type="button" class="dwc-pill' + (active === item[0] ? " active" : "") + '" onclick="DWC.go(\'' + item[0] + '\')">' + esc(label) + "</button>";
  }).join("") + "</nav>";
  html += '<div id="dwc-view"></div>';
  app.innerHTML = html;
  renderAccount();
  renderView();
  renderNotice();
}

function renderAccount() {
  var el = $("dwc-account");
  if (!el) return;
  if (state.profile && !state.editingProfile) {
    var p = state.profile;
    el.innerHTML =
      '<section class="card dwc-profile-card"><div class="dwc-profile-row">' +
      (p.avatar_url ? '<img class="dwc-avatar" src="' + esc(p.avatar_url) + '" alt="">' : '<span class="dwc-avatar dwc-avatar-none">🍬</span>') +
      '<div><h3 style="margin:0">✓ You\u2019re on the street as @' + esc(p.username) + '</h3>' +
      '<p style="margin:4px 0 0">Buyer &amp; seller in one account.' +
      (p.age_verified ? ' <strong style="color:var(--green)">· Age verified ✓</strong>' : "") +
      (p.is_operator ? ' <strong style="color:var(--amber)">· Operator</strong>' : "") + "</p>" +
      (p.payout_method && p.payout_handle
        ? '<p style="margin:4px 0 0;color:var(--green)">✓ Payout ready — you can list in the Market, Trades, and Flea Market.</p>'
        : '<p style="margin:4px 0 0">Add a payout method + handle whenever you\u2019re ready to sell — buying and posting never need it.</p>') +
      "</div>" +
      '<div style="margin-left:auto"><button type="button" class="btn ghost small" onclick="DWC.editProfile()">Edit profile</button></div>' +
      "</div></section>";
    return;
  }
  if (!state.profile && !state.signupOpen) {
    el.innerHTML =
      '<section class="card" style="text-align:center"><h3 style="margin-top:0">New here?</h3>' +
      '<p style="max-width:520px;margin:0 auto">One free account — buyer and seller in one. Name, username, date of birth, one tiny sum to prove you\u2019re human, agree to the rules below. That\u2019s it — then post, ask, chat, buy, and sell.</p>' +
      '<p style="margin-top:14px"><button type="button" class="btn" onclick="DWC.openSignup()">Create Account — it\u2019s free</button></p>' +
      '<p style="font-size:13px">Just looking? The chat window works as a guest, too — guests are auto-censored, members aren\u2019t.</p></section>';
    return;
  }
  el.innerHTML = profileFormHTML(state.profile);
  if (!state.challenge) loadChallenge();
}

function profileFormHTML(p) {
  var isNew = !p;
  var v = function (k) { return p ? esc(p[k] || "") : ""; };
  return '<section class="card" aria-label="' + (isNew ? "Create your account" : "Edit your profile") + '">' +
    "<h3 style=\"margin-top:0\">" + (isNew ? "Create your account — it\u2019s free" : "Edit your profile") + "</h3>" +
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
    '<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp">' +
    (p && p.avatar_url ? '<label><input type="checkbox" name="remove_avatar" style="width:auto"> Remove my current picture</label>' : "") +
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

// ---------- shared bits ----------
function needProfileHTML() {
  return '<div class="card"><h3 style="margin-top:0">Create your account first</h3><p>That needs a username. It\u2019s free — name, username, date of birth, one tiny sum, agree to the rules.</p><p><button type="button" class="btn" onclick="DWC.openSignup()">Create Account — it\u2019s free</button></p></div>';
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
function postCardHTML(p) {
  var heartOn = myHeart("post-" + p.id);
  return '<article class="card dwc-post">' +
    (p.image_url ? '<img class="dwc-post-img" src="' + esc(p.image_url) + '" alt="Post photo" loading="lazy">' : "") +
    gifEmbedHTML(p.gif_url, p.gif_label) +
    '<div class="tag">' + esc(p.category) + (p.flair ? " · " + esc(p.flair) : "") + (p.kind === "card_auth" ? " · 🔍 Card Check" : p.kind === "adult" ? " · 18+" : "") + "</div>" +
    '<h3 style="margin:8px 0 4px"><a href="#/post/' + p.id + '" class="dwc-titlelink">' + esc(p.title) + "</a></h3>" +
    '<p>' + esc(p.body.length > 280 ? p.body.slice(0, 280) + "…" : p.body) + "</p>" +
    (p.kind === "card_auth" ? verificationBadge(p) : "") +
    '<p class="dwc-meta">by @' + esc(p.author_username) + (p.author_occupation ? " · " + esc(p.author_occupation) : "") + " · " + fmtDate(p.created_at) + "</p>" +
    (p.tags && p.tags.length ? '<p class="dwc-tags">' + p.tags.map(function (t) { return '<a href="#/tag/' + encodeURIComponent(t) + '">#' + esc(t) + "</a>"; }).join(" ") + "</p>" : "") +
    '<div class="dwc-actions">' +
    '<button type="button" class="dwc-heart' + (heartOn ? " on" : "") + '" onclick="DWC.heartPost(' + p.id + ', this)">' + (heartOn ? "❤️" : "🤍") + " " + (p.score || 0) + "</button>" +
    '<a href="#/post/' + p.id + '">💬 ' + (p.comment_count || 0) + " comments</a>" +
    (p.kind === "card_auth" ? '<span class="dwc-auth">Real ' + p.auth_real + " · Fake " + p.auth_fake + " · Unsure " + p.auth_unsure + "</span>" : "") +
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
  if (r.name === "street") return viewStreet(el);
  if (r.name === "cardcheck") return viewCardCheck(el);
  if (r.name === "market" || r.name === "trade" || r.name === "flea") return viewMarket(el, r.name);
  if (r.name === "orders") return viewOrders(el);
  if (r.name === "payouts") return viewPayouts(el);
  if (r.name === "members") return viewMembers(el);
  if (r.name === "chat") return viewChat(el);
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
    "<li><strong>Sell anything legal</strong> — not just cards. Adult content too, <em>if</em> you\u2019ve proved your age (only ever asked for that — see Rules &amp; After Dark).</li>" +
    "<li><strong>Ask &amp; learn</strong> — post on any topic, tag it so people can find it, and heart the good stuff (❤️ hearts only — no downvotes here).</li>" +
    "<li><strong>One account per person</strong>, and 🚩 Report on any post sends an alert to the owner.</li></ul>" +
    '<p><button type="button" class="btn ghost small" onclick="DWC.go(\'rules\')">Read the full rules →</button></p></section>' +
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

function renderComposer(context) {
  var host = $("dwc-composer");
  if (!host) return;
  var isAuth = context === "cardcheck";
  host.innerHTML =
    '<section class="card" aria-label="New post"><h3 style="margin-top:0">' + (isAuth ? "Card Check — real or fake?" : "New post") + "</h3>" +
    (state.profile ? "" : "<p>Posting needs an account — <button type=\"button\" class=\"dwc-linklike\" onclick=\"DWC.openSignup()\">create one, it\u2019s free</button>.</p>") +
    '<form onsubmit="return DWC.submitPost(this, \'' + context + '\')">' +
    '<div class="dwc-kindrow">' +
    '<button type="button" class="dwc-pill' + (!isAuth ? " active" : "") + '" data-kind="forum" onclick="DWC.composerKind(this, \'forum\')">💬 Forum</button>' +
    '<button type="button" class="dwc-pill' + (isAuth ? " active" : "") + '" data-kind="card_auth" onclick="DWC.composerKind(this, \'card_auth\')">🔍 Card Check</button>' +
    "</div>" +
    '<input type="hidden" name="kind" value="' + (isAuth ? "card_auth" : "forum") + '">' +
    '<label>Corner</label><select name="category">' + CATEGORIES.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
    '<label>Flair</label><select name="flair">' + FLAIRS.map(function (f) { return "<option" + (f === (isAuth ? "Card Check" : "Discussion") ? " selected" : "") + ">" + esc(f) + "</option>"; }).join("") + "</select>" +
    '<label>Title (3–120 characters)</label>' +
    '<input name="title" required minlength="3" maxlength="120" placeholder="What\u2019s this about?">' +
    '<label>What\u2019s on your mind? (up to 4000 characters)</label>' +
    '<textarea name="body" required maxlength="4000" placeholder="Write it out…"></textarea>' +
    '<label>Tags (up to 6, comma separated)</label>' +
    '<input name="tags" maxlength="240" placeholder="e.g. charizard, grading, psa">' +
    '<label>Photo (JPG, PNG, or WebP, under 2.5 MB — required for Card Check)</label>' +
    '<input name="photo" type="file" accept="image/jpeg,image/png,image/webp">' +
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
    "<p>Look up any card to see what it has <strong>actually sold for</strong>, as reported by the members who sold it — the chart the AI estimate can\u2019t fake. Sold a card yourself? Open its chart and log the sale.</p>" +
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
  if (!data || !data.sales) { host.innerHTML = '<p class="dwc-form-err">The chart didn\u2019t load.</p>'; return; }
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
    trade: ["🔄 Up for Trade", "Offer a trade. <span class=\"grad-text\">Let the community weigh in.</span>", "Every trade listing needs a photo and a check first — the shop verifies no fakes or proxies before a trade goes live. Then members vote whether it\u2019s a good trade, a fair one, or a bad deal."],
    flea: ["🔨 Flea Market — simple bidding", "Bid on it. <span class=\"grad-text\">Win it.</span>", "An online flea-market area with simple bidding — cards, collectibles, and whatever else the community\u2019s selling. Bids must beat the high bid. The high bidder completes the purchase."],
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
    (p ? (p.payout_method && p.payout_handle ? "" : '<p class="dwc-warn">You\u2019re not payout-ready yet — add a payout method + handle in your profile before listing, or the listing will be blocked. You can still fill everything in now.</p>')
      : "<p>Listing needs an account + payout method — <button type=\"button\" class=\"dwc-linklike\" onclick=\"DWC.openSignup()\">create your account</button> first.</p>") +
    '<form onsubmit="return DWC.submitListing(this, \'' + kind + '\')">' +
    '<label>Item title (3–120 characters)</label>' +
    '<input name="title" required minlength="3" maxlength="120" placeholder="What are you selling?">' +
    '<label>Category</label><select name="category">' + LISTING_CATEGORIES.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
    '<label>' + (kind === "flea" ? "Starting bid (USD)" : kind === "trade" ? "Trade value (USD — what it\u2019s worth, for the fee split)" : "Price (USD)") + "</label>" +
    '<input name="price" type="number" step="0.01" min="0" required placeholder="e.g. 25.00">' +
    (kind === "trade" ? '<label>What you\u2019re looking for in return</label><input name="trade_wanted" maxlength="500" placeholder="Card(s) you want in return">' : "") +
    '<label>Description &amp; condition (a little formatting is allowed: bold, italic, lists, links)</label>' +
    '<textarea name="description" required maxlength="6000" placeholder="Condition, set, what\u2019s included…"></textarea>' +
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
    el.innerHTML = '<div class="note">That post is gone, or it\u2019s in the 18+ area and this account isn\u2019t age-verified.</div><p><button type="button" class="btn ghost" onclick="DWC.go(\'street\')">← Back to The Street</button></p>';
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
    (p.image_url ? '<img class="dwc-post-img" src="' + esc(p.image_url) + '" alt="Post photo">' : "") +
    gifEmbedHTML(p.gif_url, p.gif_label) +
    '<div class="tag">' + esc(p.category) + (p.flair ? " · " + esc(p.flair) : "") + (p.kind === "card_auth" ? " · 🔍 Card Check" : p.kind === "adult" ? " · 18+" : "") + "</div>" +
    "<h2>" + esc(p.title) + "</h2>" +
    '<p style="white-space:pre-wrap">' + esc(p.body) + "</p>" +
    (p.kind === "card_auth" ? verificationBadge(p) : "") +
    '<p class="dwc-meta">by @' + esc(p.author_username) + (p.author_occupation ? " · " + esc(p.author_occupation) : "") + " · " + fmtDate(p.created_at) + "</p>" +
    (p.tags && p.tags.length ? '<p class="dwc-tags">' + p.tags.map(function (t) { return '<a href="#/tag/' + (p.kind === "adult" ? "adult/" : "") + encodeURIComponent(t) + '">#' + esc(t) + "</a>"; }).join(" ") + "</p>" : "") +
    '<div class="dwc-actions">' +
    '<button type="button" class="dwc-heart' + (heartOn ? " on" : "") + '" onclick="DWC.heartPost(' + p.id + ', this)">' + (heartOn ? "❤️" : "🤍") + " " + (p.score || 0) + "</button>" +
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
      ? '<p style="margin-top:14px">Trade listings aren\u2019t bought — leave a comment below to offer your trade.</p>' : "") +
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
      ? '<label class="dwc-alerts"><input type="checkbox" ' + (o.tracking_alerts ? "checked" : "") + ' onchange="DWC.setAlerts(' + o.id + ', this.checked)" style="width:auto"> Email me tracking alerts on this order <span style="color:var(--muted)">(preference saved — alert emails send once the street\u2019s mail connection is live)</span></label>'
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
    (data.payout_method ? "<p>Payout method: " + esc(data.payout_method) + " · " + esc(data.payout_handle) + "</p>" : "<p>You haven\u2019t set a payout method yet — add one in your profile.</p>") +
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
  el.innerHTML = '<section aria-label="Community members"><h2 style="margin-top:0">Members</h2><p style="color:var(--muted)">Every member is a buyer <em>and</em> a seller — one account, both hats. “Payout ready” just means they\u2019ve set up how they get paid when they sell.</p><p style="color:var(--muted)">Loading members…</p></section>';
  var data = await apiGet("/members?limit=24");
  var members = (data && data.members) || [];
  el.innerHTML =
    '<section aria-label="Community members"><h2 style="margin-top:0">Members</h2><p style="color:var(--muted)">Every member is a buyer <em>and</em> a seller — one account, both hats. “Payout ready” just means they\u2019ve set up how they get paid when they sell.</p>' +
    (members.length ? '<div class="grid">' + members.map(function (m) {
      return '<article class="card">' +
        (m.avatar_url ? '<img class="dwc-avatar" src="' + esc(m.avatar_url) + '" alt="">' : '<span class="dwc-avatar dwc-avatar-none">🍬</span>') +
        "<h3>@" + esc(m.username) + "</h3>" +
        (m.occupation ? "<p>" + esc(m.occupation) + "</p>" : "") +
        (m.bio ? "<p>" + esc(m.bio) + "</p>" : "") +
        (m.birthday ? "<p>🎂 " + esc(m.birthday) + "</p>" : "") +
        '<p>' + (m.payout_ready ? '<span style="color:var(--green)">✓ Payout ready</span>' : '<span style="color:var(--muted)">Not payout-ready yet</span>') + "</p>" +
        '<p class="dwc-meta">Joined ' + fmtDate(m.created_at) + "</p></article>";
    }).join("") + "</div>" : '<div class="note">No members yet.</div>') + "</section>";
}

// ---------- Live Chat ----------
function stopChatPoll() {
  if (state.chatTimer) { clearInterval(state.chatTimer); state.chatTimer = null; }
}
async function viewChat(el) {
  el.innerHTML =
    '<section class="card" aria-label="Live chat"><h2 style="margin-top:0">💬 Live Chat — The Street, live</h2>' +
    '<p style="color:var(--muted)">Guests are auto-censored, always. Members chat under their own name uncensored — and own what they say.</p>' +
    (state.profile
      ? '<p>Signed in as <strong>' + esc(state.profile.chat_name || state.profile.username) + '</strong> · <button type="button" class="dwc-linklike" onclick="DWC.editProfile()">Change chat name in profile</button></p>'
      : '<p>Chatting as a guest — <button type="button" class="dwc-linklike" onclick="DWC.openSignup()">create an account</button> to chat uncensored under your name.</p>') +
    '<div id="dwc-chat-log" class="dwc-chatlog"><p style="color:var(--muted)">Loading chat…</p></div>' +
    '<form class="dwc-rowform" onsubmit="return DWC.sendChat(this)">' +
    (state.profile ? "" : '<input name="guest_name" maxlength="24" placeholder="Guest name (optional)" style="max-width:160px">') +
    '<input name="body" required maxlength="500" placeholder="Say something…" style="flex:1">' +
    '<button class="btn" type="submit">Send</button></form>' +
    '<p class="dwc-form-err" data-err hidden></p></section>';
  await loadChat();
  state.chatTimer = setInterval(function () { loadChat(); }, 15000);
}
async function loadChat() {
  var log = $("dwc-chat-log");
  if (!log) return;
  var data = await apiGet("/chat?limit=60");
  var msgs = (data && data.messages) || [];
  log.innerHTML = msgs.length
    ? msgs.map(function (m) {
        return '<div class="dwc-chatmsg"><strong>' + esc(m.author_name) + '</strong>' + (m.is_member ? "" : ' <span class="dwc-guest">guest</span>') + ': <span>' + esc(m.body) + '</span> <span class="dwc-meta">' + fmtDate(m.created_at) + "</span></div>";
      }).join("")
    : "<p>No messages yet — say hi.</p>";
  log.scrollTop = log.scrollHeight;
}

// ---------- Reports (operator inbox) ----------
async function viewReports(el) {
  if (!state.profile) { el.innerHTML = needProfileHTML(); return; }
  if (!state.profile.is_operator) {
    el.innerHTML = '<section class="card"><h2 style="margin-top:0">🚩 Reports</h2><p>Reports go straight to the operator\u2019s inbox — Chris reviews every one. To file a report, use the 🚩 Report button on any post, comment, or listing.</p><p style="color:var(--muted)">Only the operator can see the inbox. (If this is your shop, claim the operator role from your profile — first claim wins, so do it before opening the Community.)</p><p><button type="button" class="btn ghost small" onclick="DWC.claimOperator()">Claim operator role</button></p></section>';
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
    "<li><strong>Hearts only.</strong> The only reaction anywhere here is a heart — on posts and on comments. There is no downvote, no thumbs-down, no dislike. Heart it or don\u2019t.</li>" +
    "<li><strong>Your post, your call on comments.</strong> Whoever wrote a post can turn its comments off (and back on) any time from the post itself. Existing comments stay visible; new ones pause.</li>" +
    "<li><strong>One account per person.</strong> Your name + date of birth is the pair that keeps it that way. Your full name and birth year are never shown publicly.</li>" +
    "<li><strong>Report anything.</strong> Every post, comment, and listing has a 🚩 Report button. Reports go straight to the owner\u2019s inbox in this app for Chris to review.</li></ul></section>" +
    '<section class="card"><h2 style="margin-top:0">Street rules — keep everyone safe</h2><ul class="dwc-rules-list">' +
    "<li><strong>Sell what you want — legally.</strong> <strong>No firearms, ammunition, or anything illegal, ever.</strong> Listings that mention them are blocked automatically.</li>" +
    "<li><strong>No fakes or proxies passed off as real.</strong> Card trades run an AI first look in the Card Check corner; a likely fake/proxy flag blocks the trade listing until the community weighs in. Proxies must be labeled as proxies if they're ever shown.</li>" +
    "<li><strong>No hate speech</strong> in posts, comments, usernames, or profiles. Pages and posts that break this get removed.</li>" +
    "<li><strong>No outside sales.</strong> Deals that start here stay here. On this platform your content and your deals are protected — verified member accounts, recorded orders and tracking, and a report trail. Take a deal off site and you lose all of that protection. Taking a buyer off-platform to dodge the street cut also risks a <strong>permanent ban of the account</strong> (and, on the public site, the IP).</li>" +
    "<li><strong>Stealing content is theft — and it\u2019s expensive.</strong> Anyone who steals a member\u2019s content and redistributes it, in any form, <strong>will be held liable in court for money owed due to damages, and more</strong>. The platform will pursue content thieves. If you didn\u2019t make it or buy the right to share it, don\u2019t post it anywhere.</li>" +
    "<li><strong>Be honest about condition.</strong> Photos of the actual item, flaws stated up front. The item is the item for sale — extras are courtesies, not the product.</li>" +
    "<li><strong>Chat:</strong> guests are auto-censored, always. Members chat under their own name uncensored — and own what they say.</li>" +
    "<li><strong>Payments &amp; shipping:</strong> buyer and seller arrange payment (the seller's payout method is on their profile) and shipping directly. Every purchase lands in the buyer's <strong>My Orders</strong> with the order status; when the seller ships, they add the carrier + tracking number there and the buyer gets their copy of it (plus a link to the carrier's tracking page). Sellers: your wallet balance and payout history live under <strong>Payouts</strong> — money becomes available when an order is marked delivered. Shipping-label creation through Shippo or a similar service is planned and will be labeled clearly when it actually works — it is not live yet.</li></ul>" +
    OFFSITE_ADVISORY_HTML + THEFT_NOTICE_HTML + "</section>" +
    '<section class="card"><h2 style="margin-top:0">🌙 Adult content &amp; the 18+ area — how age verification works</h2>' +
    "<p>The deal is simple: <strong>you can sell any content, adult or otherwise, if you prove your age.</strong> Adult discussion lives in the <strong>🌙 After Dark 18+</strong> forum inside this app, and adult selling lives in the After Dark market — entering any 18+ area asks for age verification first. Everything else on the street never asks.</p>" +
    "<p><strong>How the check works:</strong> you upload a clear photo of your government-issued photo ID (driver\u2019s license, state ID, or passport). Chris — the operator — reviews it himself: that it\u2019s a genuine-looking government ID, that the date of birth on it shows 18 or older, and that it matches the name and date of birth on your account. <strong>A typed birthday or an \u201cI\u2019m 18\u201d checkbox alone never verifies anyone.</strong> Until the check passes, there is no adult access — no entering the 18+ forum, no adult selling.</p>" +
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
    host.innerHTML = '<p style="color:var(--green);font-weight:800">✓ You\u2019re age verified — the 18+ area is open to you.</p><p><button type="button" class="btn" onclick="DWC.go(\'adult\')">Enter the 18+ area →</button></p>';
    return;
  }
  var st = await apiGet("/age-verification/status?device_id=" + encodeURIComponent(deviceId()));
  var pending = st && st.pending;
  host.innerHTML =
    (pending
      ? '<p class="dwc-info">🕐 Your ID is waiting for review — Chris reviews every ID himself. You\u2019ll see your age-verified mark here once it\u2019s approved. Your photo is deleted the moment he decides.</p>'
      : "") +
    '<form onsubmit="return DWC.submitId(this)">' +
    '<label>Upload a clear photo of your government-issued photo ID (driver\u2019s license, state ID, or passport) — JPG or PNG, under 2.5 MB</label>' +
    '<input name="id_photo" type="file" accept="image/jpeg,image/png" required>' +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">Submit my ID for review →</button></p></form>';
}

// ---------- After Dark 18+ ----------
async function viewAdult(el) {
  if (!state.profile) { el.innerHTML = needProfileHTML(); return; }
  if (!state.profile.age_verified) {
    var st = await apiGet("/age-verification/status?device_id=" + encodeURIComponent(deviceId()));
    var welcome = await apiGet("/adult-welcome?device_id=" + encodeURIComponent(deviceId()));
    var wimg = welcome && welcome.image_url;
    el.innerHTML =
      '<section class="card" style="text-align:center"><h2 style="margin-top:0">🌙 After Dark — 18+ only</h2>' +
      (wimg
        ? '<img src="' + esc(wimg) + '" alt="Welcome to the 18+ area" class="dwc-welcome-img">'
        : '<div class="dwc-welcome-slot"><p>🌙</p><p><strong>Welcome picture slot</strong></p><p style="font-size:13px;color:var(--muted)">Chris uploads his own welcome picture here. The slot is empty until he does — no stock photo.</p></div>') +
      '<p>This area is for age-verified members only. A typed birthday alone is never enough — a real photo ID check is what opens the door.</p>' +
      (st && st.pending ? '<p class="dwc-info">🕐 Your ID is waiting for review — Chris reviews every ID himself.</p>' : "") +
      "</section>" +
      '<section class="card"><h3 style="margin-top:0">Verify your age</h3>' +
      AGE_NOTICE_HTML + AGE_REVIEW_NOTE + '<div id="dwc-age-block"></div></section>';
    renderAgeBlock();
    return;
  }
  try { localStorage.setItem(ADULT_KEY, "1"); } catch (e) {}
  el.innerHTML =
    '<section class="card" style="text-align:center"><h2 style="margin-top:0">🌙 After Dark — 18+</h2><div id="dwc-welcome"></div></section>' +
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
    '<div class="dwc-catgrid">' + ADULT_CATEGORIES.map(function (c) {
      return '<button type="button" class="dwc-cattile" onclick="DWC.adultCategory(\'' + esc(c) + '\')">' + esc(c) + "</button>";
    }).join("") + "</div>" +
    '<div id="dwc-adult-composer"></div>' +
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
    '<input name="title" required minlength="3" maxlength="120" placeholder="What\u2019s this about?">' +
    '<label>Post (up to 4000 characters)</label>' +
    '<textarea name="body" required maxlength="4000" placeholder="Write it out…"></textarea>' +
    '<label>Tags (up to 6, comma separated)</label>' +
    '<input name="tags" maxlength="240" placeholder="e.g. cosplay, amateur">' +
    '<label>Photo (JPG, PNG, or WebP, under 2.5 MB — optional)</label>' +
    '<input name="photo" type="file" accept="image/jpeg,image/png,image/webp">' +
    gifPickerHTML("composer-adult") +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">Post to the 18+ forum →</button></p>' +
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
    "<p style=\"color:var(--muted)\">Pick what you\u2019re looking for. Models are matched ONLY on the details each model chose to share — blank means not shared, and it never counts against them.</p>" +
    '<form onsubmit="return DWC.findMatches(this)">' +
    '<label>I\u2019m looking for</label><select name="gender"><option value="any">Anyone</option><option value="girl">Girl</option><option value="guy">Guy</option></select>' +
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
    "<p style=\"color:var(--muted)\">Opt in to the model search. Everything on your card is chosen by you — your blurb, your categories, your display picture, and the match details below. Leave anything blank and it simply isn\u2019t shared.</p>" +
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
  editProfile: function () { state.editingProfile = true; state.signupOpen = true; renderAccount(); },
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
    var avatar = await fileToImage(fd.get("avatar") && fd.get("avatar").size ? fd.get("avatar") : null, 1500000);
    if (avatar && avatar.error) return formErr(form, avatar.error);
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
    setNotice(isNew ? "Welcome to the street, @" + data.profile.username + " — you're on." : "Profile saved.");
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
    await loadChat();
    return false;
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
    if (!data || !data.models) { host.innerHTML = '<p class="dwc-form-err">The finder didn\u2019t load.</p>'; return false; }
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
  render();
  window.addEventListener("hashchange", function () { render(); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
