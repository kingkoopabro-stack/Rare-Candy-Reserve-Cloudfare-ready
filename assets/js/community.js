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

var CATEGORIES = ["General", "News", "Question", "Questions & Help", "Shop Talk", "Music", "Video", "Plants & Garden", "Tech & Builds", "Dank Meme", "Off Topic"];
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
var CREATOR_GENRES = ["Photos", "Videos", "Custom Content", "Audio", "3D Models", "3D Print Files", "Developer Files", "Designs", "Art", "Apps", "Game Assets", "Adult Content", "Video games", "Refurbished tech", "3D prints", "Car parts", "Collectibles", "Tutor work", "Other"];
var CREATOR_TAG_CHIPS = ["Selling Uncensored Nudes", "Selling Videos", "Custom Content", "3D Print Files", "Selling Photos", "Selling 3D Models", "Developer Files", "Designs & Art", "Game Assets"];
var TITLE_EMOJIS = ["🔥", "💖", "✨", "🌙", "🍬", "💋", "😈", "😘", "🎀", "🌸", "💎", "👑", "🍓", "🍑", "🌶️", "💦", "🎥", "📸", "🖨️", "🎵"];

// A Steady Heart — "End of the year" (21 tracks, in order). Chris gives
// full permission to use all of it. Track names are exact — never
// re-title or alter them. Members pick up to 5 to show on their profile.
// (Track names only — no audio player for individual tracks yet; the
// player comes later. The Steady Wave player below is the live
// station stream, not per-track audio.)
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
  friendsOnly: false,
  // Feed redesign (v3.14) — single-column Reddit-style feed.
  savedOnly: false, // show only posts saved by this member (server log, or localStorage for guests)
  savedServer: null, // server copy of saved post ids; null until loaded
  composerOpen: false, // composer starts collapsed — a one-line prompt
  searchPosts: null, // cached posts for header search (lazy-loaded)
  searchMembers: null, // cached members for header search (lazy-loaded)
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
  phoneGallery: [], // [{ url, name, caption, timer, publicId }] — session only, auto-deleted after 10 min
  galleryStoredCount: null, // v3.21 — stored/published photos on the profile (GET /api/gallery total), null = not loaded yet
  phoneNotes: "", // the member's one saved note (D1, loaded on demand)
  phoneNotesLoaded: false, // true once the saved note has been fetched
  phoneNotesSavedAt: 0, // timestamp of the last successful note save
  phoneNotesTimer: null, // debounce timer for note autosave
  btcTimer: null, // live Bitcoin ticker refresh (cleared on navigation)
  builderPending: null, // Taffy builder's pending settings (applied on Apply, saved on Save)
  builderUnderstood: [], // what the builder matched, for the honesty report
  // Lucre (v3.11) — the site-only currency. Balance lives server-side;
  // state.lucre is the last GET /api/lucre response (or null until loaded).
  lucre: null, // { balance, ledger, checkin, owned }
  storeFilter: "all", // Layout Store filter: all | free | priced | owned
  storePreview: null, // Layout Store preview item id (null = no preview open)
  userLayouts: null, // Member-published store layouts (v3.12), loaded from /api/layouts
  userLayoutsLoading: false,
  storeApplying: null, // item id being applied/bought right now
  phoneMsgList: null, // cached member list for the MSG contacts view
  phoneAlertsList: null, // cached notifications for the Alerts app view
  phoneAlertsStamp: 0, // bumps when alerts reload, so renderPhone rebuilds
  phoneChat: [], // [{ who: "me"|"taffy", text, emoji }] — session only, gone when you leave
  phoneChatOpen: false, // chat bar expanded (tap-to-reveal); conversation stays in phoneChat when closed
  phoneRenderedKey: "", // app|open|wallpaper|galleryCount — avoids rebuilding the radio
  // v3.9 picture viewer — the lightbox opened from a profile picture.
  // photos: [{ url, subject, label }]; subject is the comment thread key
  // ("avatar" or "gallery:<id>"). No likes anywhere on pictures.
  picViewer: null,
  picViewerKeyHandler: null, // Escape-to-close listener for the viewer
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
function myHeart(key) { return myReaction(key) === "heart"; }
function setHeart(key, on) { setReaction(key, on ? "heart" : null); }
// Reactions (v3.15) — one reaction per person per target, kind
// 'heart' | 'sad' | 'confused'. The cache stores the kind string.
// Legacy entries stored 1 for a heart, and thread-comment hearts used
// to live under "comment-<id>" — both still read as 'heart'.
function myReaction(key) {
  var v = loadVotes()[key];
  if (v === 1 || v === "heart") return "heart";
  if (v === "sad" || v === "confused") return v;
  if (key.indexOf("comment-thread-") === 0) {
    var legacy = loadVotes()["comment-" + key.slice(15)];
    if (legacy === 1 || legacy === "heart") return "heart";
  }
  return null;
}
function setReaction(key, kind) {
  var v = loadVotes();
  if (kind) v[key] = kind; else delete v[key];
  if (key.indexOf("comment-thread-") === 0) delete v["comment-" + key.slice(15)];
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
// Feed redesign (v3.14) — date + time for the post-card header row
// (top-right), e.g. "Nov 20, 2026 · 4:05 PM".
function fmtDateTime(isoStr) {
  if (!isoStr) return "";
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// ---------- Feed redesign (v3.14): saved posts, action icons ----------
// Saved posts are LOGGED server-side in the post_saves table
// (functions/api/post-saves.js) when signed in, so a save follows the
// member between devices. Guests have no account to log under, so their
// saves stay on this device only (localStorage, key dwc-saved-posts).
// Comment saves are localStorage-only (post_saves is posts-only).
// No Lucre is paid for saving. Keys: "post-<id>" / "comment-<id>".
var SAVED_KEY = "dwc-saved-posts";
function loadSavedSet() {
  try { var raw = localStorage.getItem(SAVED_KEY); var arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; }
  catch (e) { return []; }
}
function saveSavedSet(arr) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(arr)); } catch (e) {} }
// The server copy of a member's saved post ids (null until loaded, so
// we never claim "not saved" before asking the server).
async function loadSavedServer() {
  if (!state.profile) { state.savedServer = null; return; }
  var data = await apiGet("/post-saves?device_id=" + encodeURIComponent(deviceId()));
  state.savedServer = data && data.ok && Array.isArray(data.saved_post_ids) ? data.saved_post_ids : [];
}
function isSavedKey(key) {
  if (key.indexOf("post-") === 0 && state.profile && state.savedServer !== null) {
    return state.savedServer.indexOf(parseInt(key.slice(5), 10)) >= 0;
  }
  return loadSavedSet().indexOf(key) >= 0;
}
function setSavedKey(key, on) {
  var arr = loadSavedSet().filter(function (k) { return k !== key; });
  if (on) arr.push(key);
  saveSavedSet(arr);
  return on;
}
function savedCount() {
  if (state.profile && state.savedServer !== null) return state.savedServer.length;
  return loadSavedSet().length;
}
// Neon glowing star heart (feed + thread post hearts). The star is an
// inline SVG so the glow is a real drop-shadow, not an emoji render.
function starHeartHTML(on, count) {
  return '<svg class="dwc-star-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>' +
    '<span class="dwc-act-count">' + (count || 0) + "</span>";
}
// Bright-blue bookmark (feed + comments). Filled when saved on this device.
function bookmarkHTML(saved) {
  return '<svg class="dwc-bm-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12a1 1 0 0 1 1 1v19l-7-4.5L5 22V3a1 1 0 0 1 1-1z"/></svg>' +
    '<span class="dwc-act-count">' + (saved ? "Saved" : "Save") + "</span>";
}
// White-filled comment bubble (feed + comments). On a comment it is a
// Reply button; on a post it opens the thread.
function commentBubbleHTML(count, label) {
  return '<svg class="dwc-cmt-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.5 2 2 5.9 2 10.8c0 2.8 1.5 5.2 3.8 6.8L4.5 22l5-2.7c.8.2 1.6.3 2.5.3 5.5 0 10-3.9 10-8.8S17.5 2 12 2z"/></svg>' +
    '<span class="dwc-act-count">' + (label != null ? label : (count || 0)) + "</span>";
}
// ---------- Reactions (v3.15): heart + sad + confused ----------
// Posts AND comments get all three. Pictures (v3.16) get heart or
// nothing — the same neon star, no sad, no confused, no thumbs-down.
// One reaction per person per target: tapping the same kind again takes
// it off, tapping another kind switches.
function sadReactHTML(on, count) {
  return '<span class="dwc-react-ico" aria-hidden="true">😢</span><span class="dwc-act-count">' + (count || 0) + "</span>";
}
function confusedReactHTML(on, count) {
  return '<span class="dwc-react-ico" aria-hidden="true">😕</span><span class="dwc-act-count">' + (count || 0) + "</span>";
}
function postReactionInnerHTML(id, counts) {
  var my = myReaction("post-" + id);
  return '<button type="button" class="dwc-act dwc-star' + (my === "heart" ? " on" : "") + '" onclick="DWC.reactPost(' + id + ', \'heart\', this)" aria-label="Heart this post">' + starHeartHTML(my === "heart", counts.heart) + "</button>" +
    '<button type="button" class="dwc-act dwc-sad' + (my === "sad" ? " on" : "") + '" onclick="DWC.reactPost(' + id + ', \'sad\', this)" aria-label="React sad to this post">' + sadReactHTML(my === "sad", counts.sad) + "</button>" +
    '<button type="button" class="dwc-act dwc-confused' + (my === "confused" ? " on" : "") + '" onclick="DWC.reactPost(' + id + ', \'confused\', this)" aria-label="React confused to this post">' + confusedReactHTML(my === "confused", counts.confused) + "</button>";
}
function postReactionGroupHTML(p) {
  return '<span class="dwc-react-group" data-react-kind="post" data-react-id="' + p.id + '">' +
    postReactionInnerHTML(p.id, { heart: p.score || 0, sad: p.sad || 0, confused: p.confused || 0 }) + "</span>";
}
function commentReactionInnerHTML(commentId, ctype, ref, counts) {
  var my = myReaction("comment-" + ctype + "-" + commentId);
  var args = "'" + ctype + "', " + ref + ", " + commentId + ", ";
  return '<button type="button" class="dwc-act dwc-star' + (my === "heart" ? " on" : "") + '" onclick="DWC.reactComment(' + args + '\'heart\', this)" aria-label="Heart this comment">' + starHeartHTML(my === "heart", counts.heart) + "</button>" +
    '<button type="button" class="dwc-act dwc-sad' + (my === "sad" ? " on" : "") + '" onclick="DWC.reactComment(' + args + '\'sad\', this)" aria-label="React sad to this comment">' + sadReactHTML(my === "sad", counts.sad) + "</button>" +
    '<button type="button" class="dwc-act dwc-confused' + (my === "confused" ? " on" : "") + '" onclick="DWC.reactComment(' + args + '\'confused\', this)" aria-label="React confused to this comment">' + confusedReactHTML(my === "confused", counts.confused) + "</button>";
}
function commentReactionGroupHTML(c, react) {
  // react: { ctype: 'thread' | 'listing' | 'profile', ref: postId | listingId | profileId }
  var counts = { heart: (c.hearts != null ? c.hearts : (c.score || 0)), sad: c.sad || 0, confused: c.confused || 0 };
  return '<span class="dwc-react-group" data-react-kind="comment" data-react-ctype="' + react.ctype + '" data-react-ref="' + react.ref + '" data-react-id="' + c.id + '">' +
    commentReactionInnerHTML(c.id, react.ctype, react.ref, counts) + "</span>";
}
// After a react lands, re-render just that reaction group in place
// (counts + which one is yours) without reloading the whole view.
function refreshReactGroup(kind, id, data, ctype, ref) {
  var sel = kind === "post"
    ? '.dwc-react-group[data-react-kind="post"][data-react-id="' + id + '"]'
    : '.dwc-react-group[data-react-kind="comment"][data-react-ctype="' + ctype + '"][data-react-id="' + id + '"]';
  var counts = { heart: data.hearts || 0, sad: data.sad || 0, confused: data.confused || 0 };
  document.querySelectorAll(sel).forEach(function (el) {
    el.innerHTML = kind === "post"
      ? postReactionInnerHTML(id, counts)
      : commentReactionInnerHTML(id, ctype, ref, counts);
  });
}
// ---------- Picture hearts (v3.16): heart or nothing ----------
// On actual pictures (profile picture + public gallery photos in the
// picture viewer): the same neon star heart, or nothing. No sad, no
// confused, no thumbs-down. The cache key is "picture-<ownerId>-<subject>"
// where subject is "avatar" or "gallery:<id>" — the same key the
// picture comments use, so the heart always follows the same picture.
function pictureHeartKey(ownerId, subject) { return "picture-" + ownerId + "-" + subject; }
function pictureHeartHTML(hearts, my) {
  return '<button type="button" class="dwc-act dwc-star' + (my ? " on" : "") + '" onclick="DWC.heartPicture(this)" aria-label="Heart this picture">' + starHeartHTML(my, hearts) + "</button>";
}
async function loadPicViewerHeart() {
  var pv = state.picViewer;
  var host = $("dwc-picviewer-heart");
  if (!pv || !host) return;
  var photo = pv.photos[pv.index];
  if (!photo) { host.innerHTML = ""; return; }
  var q = "/picture-hearts?owner_id=" + pv.memberId + "&subject=" + encodeURIComponent(photo.subject);
  if (state.profile) q += "&device_id=" + encodeURIComponent(deviceId());
  var data = await apiGet(q);
  if (!state.picViewer || state.picViewer.photos[state.picViewer.index] !== photo) return;
  if (!data || !data.ok) return;
  if (state.profile) setReaction(pictureHeartKey(pv.memberId, photo.subject), data.my_heart ? "heart" : null);
  host.innerHTML = pictureHeartHTML(data.hearts || 0, !!data.my_heart);
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
// Feed redesign (v3.14) — PUT for post edits.
async function apiPut(path, body) {
  try {
    var res = await fetch(API + path, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    var data = await res.json().catch(function () { return null; });
    if (data && data.error === "db_unavailable") { markDbDown(); return data; }
    return data || { ok: false, error: "Request failed." };
  } catch (e) { return { ok: false, error: "Couldn't reach the Community — check your connection and try again." }; }
}
var IMAGE_MIMES_CLIENT = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// Reads a photo for upload — and resizes it first, so a big phone photo
// never hits a "too large" error. Every photo runs through
// fitImageForUpload (1600px longest side by default, under maxBytes);
// opts can override per kind: { maxDim, minQuality, qualities }.
// Only files the browser can't read at all (e.g. HEIC) still error.
// Extra fields (origKB, newKB, width, height, shrunk) ride along so
// callers can show a "resized to fit" note.
function fileToImage(file, maxBytes, opts) {
  var o = opts || {};
  return fitImageForUpload(file, {
    maxDim: o.maxDim || 1600,
    maxBytes: maxBytes || 2500000,
    minQuality: o.minQuality || 0.55,
    qualities: o.qualities
  }).then(function (r) {
    if (!r) return null;
    if (r.error) return { error: r.error };
    return { dataBase64: r.dataBase64, mimeType: r.mimeType, origKB: r.origKB, newKB: r.newKB, width: r.width, height: r.height, shrunk: r.shrunk };
  });
}
// ---------- Short video clips (v3.5) ----------
// One short clip per post: MP4 / WebM / MOV, max 15 MB, max 60 seconds.
// The 60s check needs a <video> element, so it lives in videoPicked;
// fileToVideo only reads the bytes (mime + size), mirroring fileToImage.
var VIDEO_MIMES_CLIENT = ["video/mp4", "video/webm", "video/quicktime"];
var VIDEO_EXT_MIMES = { ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime" };
var VIDEO_MAX_BYTES = 15000000;
var VIDEO_MAX_SECONDS = 60;
function videoMimeFor(file) {
  if (file.type && VIDEO_MIMES_CLIENT.indexOf(file.type) !== -1) return file.type;
  // Some browsers leave file.type blank — fall back to the extension.
  var name = String(file.name || "");
  var dot = name.lastIndexOf(".");
  var ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  return VIDEO_EXT_MIMES[ext] || null;
}
function fileToVideo(file, maxBytes) {
  return new Promise(function (resolve) {
    if (!file) return resolve(null);
    var mime = videoMimeFor(file);
    if (!mime) return resolve({ error: "That video isn't an MP4, WebM, or MOV — pick one of those." });
    var limitMB = ((maxBytes || VIDEO_MAX_BYTES) / 1000000).toFixed(1).replace(".0", "");
    if (file.size > (maxBytes || VIDEO_MAX_BYTES)) return resolve({ error: "That video is too large — keep it under about " + limitMB + " MB." });
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = String(reader.result || "");
      var parts = dataUrl.split(",");
      resolve({ dataBase64: parts[1] || "", mimeType: mime, fileName: file.name || "video" });
    };
    reader.onerror = function () { resolve({ error: "That video couldn't be read — try again." }); };
    reader.readAsDataURL(file);
  });
}
// How long is this video file, in seconds? Loads it into a throwaway
// <video> and reads the metadata. Resolves null when it can't be read.
function videoDuration(file) {
  return new Promise(function (resolve) {
    var url = URL.createObjectURL(file);
    var v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = function () {
      URL.revokeObjectURL(url);
      var d = v.duration;
      resolve((typeof d === "number" && isFinite(d)) ? d : null);
    };
    v.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
    v.src = url;
  });
}

// ---------- Automatic image fitting ----------
// fitImageForUpload(file, opts) — the one resizer every photo upload
// runs through, so nobody ever sees a "too large" warning again.
//   opts.maxDim     — longest side in px (default 1600; avatar 512)
//   opts.maxBytes   — byte cap the output must fit under (default 2.5 MB,
//                     matching the server's putImage caps)
//   opts.minQuality — lowest JPEG quality tried (default 0.55; ID and
//                     card photos pass 0.75–0.8 so text stays legible)
//   opts.qualities  — explicit quality ladder (avatar passes [0.85])
// How it works: decode (createImageBitmap with EXIF orientation when
// available, else <img>), pass through untouched when already under both
// limits (no re-encode, no quality loss), otherwise downscale on canvas
// keeping aspect ratio and walk a JPEG quality ladder until under the
// byte cap, shrinking dimensions further if needed. PNGs that actually
// have transparent pixels stay PNG; everything else becomes JPEG.
// GIFs become a still JPEG (same as the old avatar shrinker). HEIC and
// other unreadable formats error plainly — screenshot the photo first.
// Returns { dataBase64, mimeType, origKB, newKB, width, height, shrunk }
// or { error }.
var FIT_HEIC_ERROR = "That photo isn't a JPG, PNG, WebP, or GIF — iPhone photos often save as HEIC. Pick a JPG, PNG, WebP, or GIF, or screenshot the photo and use that.";
function fitCanvasToBlob(cv, type, quality) {
  return new Promise(function (resolve) {
    try {
      cv.toBlob(function (blob) { resolve(blob || null); }, type, quality);
    } catch (e) { resolve(null); }
  });
}
function fitBlobToBase64(blob) {
  return new Promise(function (resolve) {
    var r = new FileReader();
    r.onload = function () {
      var parts = String(r.result || "").split(",");
      resolve(parts[1] || "");
    };
    r.onerror = function () { resolve(""); };
    r.readAsDataURL(blob);
  });
}
function fitDecodeImageViaImg(file) {
  return new Promise(function (resolve) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      resolve({ src: img, w: w, h: h, close: function () { URL.revokeObjectURL(url); } });
    };
    img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
function fitDecodeImage(file) {
  // Prefer createImageBitmap — it applies EXIF orientation for us.
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" }).then(function (bmp) {
      return { src: bmp, w: bmp.width, h: bmp.height, close: function () { try { bmp.close(); } catch (e) {} } };
    }).catch(function () { return fitDecodeImageViaImg(file); });
  }
  return fitDecodeImageViaImg(file);
}
function fitHasTransparency(src, w, h) {
  // Sample a small copy — cheap, and enough to catch real transparency.
  try {
    var s = Math.min(1, 200 / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
    var cv = document.createElement("canvas");
    cv.width = cw; cv.height = ch;
    var ctx = cv.getContext("2d");
    ctx.drawImage(src, 0, 0, cw, ch);
    var d = ctx.getImageData(0, 0, cw, ch).data;
    for (var i = 3; i < d.length; i += 4) { if (d[i] < 255) return true; }
  } catch (e) {}
  return false;
}
function fitDrawToCanvas(src, w, h, fillWhite) {
  var cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  var ctx = cv.getContext("2d");
  if (fillWhite) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(src, 0, 0, w, h);
  return cv;
}
async function fitImageForUpload(file, opts) {
  if (!file) return null;
  if (file.type && IMAGE_MIMES_CLIENT.indexOf(file.type) === -1) return { error: FIT_HEIC_ERROR };
  var o = opts || {};
  var maxDim = o.maxDim || 1600;
  var maxBytes = o.maxBytes || 2500000;
  var minQuality = (typeof o.minQuality === "number") ? o.minQuality : 0.55;
  var ladder = (o.qualities && o.qualities.length ? o.qualities.slice() : [0.92, 0.8, 0.68, 0.55])
    .filter(function (q) { return q >= minQuality; });
  if (!ladder.length || ladder[ladder.length - 1] !== minQuality) ladder.push(minQuality);
  var origKB = Math.round(file.size / 1000);
  var dec;
  try { dec = await fitDecodeImage(file); } catch (e) { dec = null; }
  if (!dec || !dec.w || !dec.h) {
    return { error: "That photo couldn't be read — it may be a HEIC or a format this browser can't open. Screenshot the photo and use that." };
  }
  var w = dec.w, h = dec.h;
  // Already fits? Pass it through untouched — no re-encode, no loss.
  if (file.size <= maxBytes && w <= maxDim && h <= maxDim) {
    var asIs = await fitBlobToBase64(file);
    dec.close();
    if (!asIs) return { error: "That photo couldn't be read — try again." };
    return { dataBase64: asIs, mimeType: file.type, origKB: origKB, newKB: origKB, width: w, height: h, shrunk: false };
  }
  var scale = Math.min(1, maxDim / Math.max(w, h));
  var tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale));
  var transparent = file.type === "image/png" && fitHasTransparency(dec.src, w, h);
  var best = null; // smallest blob produced so far
  function noteBlob(blob, mime, bw, bh) {
    if (!blob) return;
    if (!best || blob.size < best.blob.size) best = { blob: blob, mime: mime, w: bw, h: bh };
  }
  if (transparent) {
    // Stay PNG while it fits; halve dimensions until it does.
    var pw = tw, ph = th;
    for (var pi = 0; pi < 4; pi++) {
      var pcv = fitDrawToCanvas(dec.src, pw, ph, false);
      var pblob = await fitCanvasToBlob(pcv, "image/png");
      noteBlob(pblob, "image/png", pw, ph);
      if (pblob && pblob.size <= maxBytes) break;
      if (Math.max(pw, ph) <= 400) break;
      pw = Math.max(1, Math.round(pw * 0.5)); ph = Math.max(1, Math.round(ph * 0.5));
    }
    // Still too big as PNG? Fall through to JPEG (loses transparency,
    // but a photo that fits beats a photo that errors).
    if (!best || best.blob.size > maxBytes) transparent = false;
  }
  if (!transparent) {
    var jw = tw, jh = th;
    var fitted = false;
    for (var di = 0; di < 4 && !fitted; di++) {
      var jcv = fitDrawToCanvas(dec.src, jw, jh, true);
      for (var qi = 0; qi < ladder.length; qi++) {
        var jblob = await fitCanvasToBlob(jcv, "image/jpeg", ladder[qi]);
        noteBlob(jblob, "image/jpeg", jw, jh);
        if (jblob && jblob.size <= maxBytes) { fitted = true; break; }
      }
      if (fitted) break;
      if (Math.max(jw, jh) <= 400) break;
      jw = Math.max(1, Math.round(jw * 0.7)); jh = Math.max(1, Math.round(jh * 0.7));
    }
  }
  dec.close();
  if (!best || !best.blob) return { error: "That photo couldn't be shrunk — try a different one." };
  if (best.blob.size > maxBytes) {
    return { error: "That photo is too large — even resized it stays over about " + (maxBytes / 1000000).toFixed(1).replace(".0", "") + " MB. Try a smaller photo." };
  }
  var b64 = await fitBlobToBase64(best.blob);
  if (!b64) return { error: "That photo couldn't be read — try again." };
  return { dataBase64: b64, mimeType: best.mime, origKB: origKB, newKB: Math.round(best.blob.size / 1000), width: best.w, height: best.h, shrunk: true };
}

// "Shrink my photo for profile size" — avatar resizer / converter.
// Now a thin wrapper over fitImageForUpload: 512px, JPEG 0.85, under
// the 1.5 MB avatar cap. Same return shape as before, so avatar,
// banner, and page-comment callers work unchanged.
var AVATAR_MAX_DIM = 512;
function fmtKB(kb) { return kb >= 1000 ? (kb / 1000).toFixed(1).replace(".0", "") + " MB" : kb + " KB"; }
function shrinkAvatarImage(file) {
  return fitImageForUpload(file, { maxDim: AVATAR_MAX_DIM, maxBytes: 1500000, qualities: [0.85], minQuality: 0.85 });
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
  // Lucre (v3.11) — 5 for sharing a post or listing, once per item.
  // Best-effort: never block the copy itself.
  if (state.profile) {
    var m = String(url || "").match(/#\/(post|listing)\/(\d+)/);
    if (m) apiPost("/lucre", { device_id: deviceId(), action: "share", ref_type: m[1], ref_id: m[2] }).then(function (d) {
      if (d && d.ok && typeof d.balance === "number" && state.lucre) {
        state.lucre.balance = d.balance;
        var w = document.getElementById("dwc-lucre-wallet");
        if (w) w.outerHTML = lucreWalletHTML();
      }
    });
  }
  var done = function () {
    if (btn) {
      // Save/restore innerHTML (not textContent) — the share button
      // carries a <span> for its label, and textContent would flatten it.
      var old = btn.innerHTML;
      btn.innerHTML = "Copied ✓";
      setTimeout(function () { btn.innerHTML = old; }, 1600);
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
  ["street", "🏠 YourSpace"], ["chat", "💬 Live Chat"], ["market", "Flea Market"],
  ["trade", "⇄ Up for Trade"], ["flea", "🔨 Auction House"], ["cardcheck", "🔍 Card Check"],
  ["adult", "🌙 After Dark 18+"], ["find", "✨ Find Seller / Buyer"], ["headlines", "🔥 Headlines"], ["receipts", "🧾 My receipts"], ["orders", "📦 My Orders"], ["payouts", "💰 Payouts"],
  ["members", "Members"], ["reports", "🚩 Reports"], ["rules", "Rules & After Dark"],
  ["admin", "🛡️ Admin"], ["team", "👥 Team"],
];
function parseRoute() {
  var h = (location.hash || "").replace(/^#\/?/, "");
  var parts = h.split("/").filter(Boolean);
  if (!parts.length) return { name: "street" };
  var n = parts[0];
  if (n === "post" && parts[1]) return { name: "thread", postId: parts[1] };
  if (n === "listing" && parts[1]) return { name: "listing", listingId: parts[1] };
  if (n === "member" && parts[1]) return { name: "member", memberId: parts[1] };
  if (n === "u" && parts[1]) return { name: "memberSlug", slug: parts[1] };
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
  // Insert coin — visible to EVERYONE (signed in or guest, mobile or
  // desktop). Guests already see the coin in the "New here?" signup card
  // below, so the header coin only renders for signed-in members — that
  // way every visitor sees exactly one, on any device.
  if (state.profile) {
    html += '<div class="dwc-coin-row"><span class="dwc-insert-coin">⬇ Insert coin ⬇</span><span class="dwc-coin" aria-hidden="true">¢</span></div>';
  }
  html += '<div id="dwc-notice" class="dwc-notice" role="status" style="display:' + (state.notice ? "" : "none") + '">' + (state.notice ? esc(state.notice) : "") + '</div>';
  // Post-signup unlock card — only right after a basic account is created.
  if (state.showUnlock && state.profile) html += unlockCardHTML();
  html += '<div id="dwc-account"></div>';
  html += '<nav class="dwc-pills" aria-label="Community sections">' + NAV.filter(function (item) {
    // Admin + Team are role-gated: Admin is operator + admin, Team is
    // operator/admin/mod. Everyone else never sees the pills.
    if (item[0] === "admin") return !!(state.profile && (state.profile.role === "operator" || state.profile.role === "admin" || state.profile.is_operator));
    if (item[0] === "team") return !!(state.profile && (state.profile.role === "operator" || state.profile.role === "admin" || state.profile.role === "mod" || state.profile.is_operator));
    return true;
  }).map(function (item) {
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
  maybeApplyBrandDraft();
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
        ? '<p style="margin:4px 0 0;color:var(--green)">✓ Payout ready — you can list in the Flea Market, Trades, and Auction House.</p>'
        : '<p style="margin:4px 0 0">Add a payout method + handle whenever you’re ready to sell — buying and posting never need it.</p>') +
      '<p style="margin:8px 0 0"><button type="button" class="btn ghost small" onclick="DWC.go(\'member/' + p.id + '\')">View my page →</button>' +
      ((p.top_friend_ids && p.top_friend_ids.length) ? ' <span style="color:var(--muted);font-size:13px">🌟 Top Friends: ' + p.top_friend_ids.length + "/10 picked</span>" : "") +
      (p.layout_preset ? ' <span style="color:var(--muted);font-size:13px">· 🎨 layout: ' + esc(storeLayoutName(p.layout_preset)) + "</span>" : "") + "</p>" +
      "</div>" +
      '<div style="margin-left:auto"><button type="button" class="btn ghost small" onclick="DWC.editProfile()">Edit profile</button> <button type="button" class="btn ghost small" onclick="DWC.signOut()">Sign out</button></div>' +
      "</div>" + lucreWalletHTML() + "</section>";
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
  fitLayoutMinis();
}

// ---------- Taffy — the little site helper (ONE helper, v5) ----------
// v5: WORKING — inspired by Shawn Hocking's astral artwork (the reference
// Chris sent): a glowing figure, arms OUTSTRETCHED to the sides, radiant
// head, inside a big glowing rune mandala, energy streaming up and down in
// purple and gold. KEEP Taffy's v4 look (Game Boy-type creature, ORIGINAL
// RGB GRADIENT like Slabb's avatar — pink → purple → blue, cyan accents,
// hand-drawn show style, cute, hands and feet). NO PC AT ALL — the laptop,
// keyboard, keys and cursor are GONE.
// Idle/talking: adorable and helpful — smiling, winking, mouth moving when
// talking, arms waving around a bit. Friendly, alive.
// Working (loading information): Taffy floats in a meditation
// pose, a radiant glowing mandala behind him, light rays streaming up and
// down, and his ASTRAL FORM — a glowing spirit with arms OUTSTRETCHED and a
// radiant head, just like the figure in the reference — rises out of him and
// bobs up a bit, down, up, down, while he loads the information. The astral form shows the "904 Lokos" prison tattoos.
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

// ---------- Lucre (v3.11) — the site-only currency ----------
// Lucre ◈ is play money for the site ONLY: not real money, not crypto,
// not redeemable for cash. It buys layouts and frames in Taffy's Layout
// Store. Balances live server-side in D1 (the ledger); the client never
// sends a balance or a price — it only triggers actions, and the server
// computes what was earned. Earning: post 10, listing 10, new profile
// 10, comment 10, heart 5, completed transaction 40, suggestion 40,
// friend/favorite 5, share 5, song 10, first radio listen 10, fully
// set up profile 10, weekly check-in 5, 7th consecutive weekly
// check-in +50. One award per action, enforced by the ledger's unique
// key — a double-tap or retry can never pay twice.
var LUCRE_SYMBOL = "◈";
function lucreFmt(n) { return LUCRE_SYMBOL + " " + (Number(n) || 0); }
// Layout Store catalog — the single source of truth on the client. The
// server holds the same ids + prices for purchase (LUCRE_STORE_PRICES);
// a priced item's price here is display-only. Every preset is a
// COMPLETE theme: its theme object sets vibe, colors, font, button
// style, and preset background explicitly ("" clears a previous pick),
// so applying one never leaves a stray setting from the old look
// behind. layout_css carries only what a theme can't express —
// overlays, animations, borders the theme doesn't set, letter-spacing.
// Theme CSS is injected AFTER layout CSS on the real page, so anything
// the theme sets wins over the same property in layout_css.
var LAYOUT_STORE = [
  {
    id: "store:rainy-night", code: "RAINY", name: "Rainy Night", tag: "Animated · moody", price: 0,
    desc: "Rain falls over a deep-blue night while your words take the stage.",
    conflict: "Hides your Top Friends and links — those sections won't show while this layout is on.",
    theme: { vibe: "midnight", bg_color: "", bg_image_url: "", text_color: "", accent_color: "#00e5ff", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "neon", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "top", pic_frame: "", blood_color: "", hide_sections: ["top8", "links"] },
    css: ".dwc-myprofile{position:relative;overflow:hidden;}" +
      ".dwc-myprofile::after{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(115deg,transparent 0 14px,rgba(174,194,255,.30) 14px 15px,transparent 15px 36px);background-size:120px 260px;animation:dwcRain 1.1s linear infinite;}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{letter-spacing:.05em;}" +
      "@keyframes dwcRain{from{background-position:0 -260px;}to{background-position:-60px 0;}}"
   +
      ".dwc-myprofile a{color:#00e5ff;text-shadow:none;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #00e5ff;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #00e5ff;}" +
      ".dwc-myprofile .card{background:rgba(10,14,26,.85);border:1px solid #2a3a5f;border-radius:8px;}"},
  {
    id: "store:clean-professional", code: "CLEAN", name: "Clean Professional", tag: "Tidy · business", price: 0,
    desc: "Crisp white page, serif text, a thin navy rule — for selling like a pro.",
    conflict: "",
    theme: { vibe: "classic", bg_color: "", bg_image_url: "", text_color: "", accent_color: "#00e5ff", font: "serif", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile .card{box-shadow:0 1px 3px rgba(0,0,0,.14);}" +
      ".dwc-myprofile .dwc-mypage-head{border-bottom:2px solid #003399;padding-bottom:8px;}"
   +
      ".dwc-myprofile .btn{background:#00e5ff;color:#1a1405;box-shadow:none;border-radius:8px;}" +
      ".dwc-myprofile a{color:#00e5ff;text-shadow:none;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #00e5ff;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #00e5ff;}"},
  {
    id: "store:facebook-style", code: "FACEBOOK", name: "Facebook Style", tag: "Familiar · blue", price: 0,
    desc: "Light grey page, white cards, Facebook blue — the look everyone already knows.",
    conflict: "",
    theme: { vibe: "", bg_color: "#e9ebee", bg_image_url: "", text_color: "#1c1e21", accent_color: "#1877f2", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile .card{background:#fff;border:1px solid #dddfe2;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.10);}" +
      ".dwc-myprofile .btn{background:#1877f2;color:#fff;}" +
      ".dwc-myprofile .dwc-mypage-head h3{color:#1877f2;}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#1877f2;text-shadow:none;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #1877f2;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #1877f2;}"},
  {
    id: "store:instagram-style", code: "INSTAGRAM", name: "Instagram Style", tag: "Photo-first · clean", price: 0,
    desc: "Bright white, centered, with a rainbow ring around your picture — built for photos.",
    conflict: "",
    theme: { vibe: "", bg_color: "#fafafa", bg_image_url: "", text_color: "#262626", accent_color: "#e1306c", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "rounded", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile .card{background:#fff;border:1px solid #dbdbdb;border-radius:12px;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid transparent;border-radius:50%;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5) border-box;}" +
      ".dwc-myprofile .dwc-mypage-head{text-align:center;}" +
      ".dwc-myprofile .dwc-mypage-head .dwc-avatar{margin:0 auto;}"
   +
      ".dwc-myprofile .btn{background:#e1306c;color:#ffffff;box-shadow:none;}" +
      ".dwc-myprofile a{color:#e1306c;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #e1306c;}"},
  {
    id: "store:80s-arcade", code: "ARCADE", name: "80s Arcade", tag: "Neon · pixel", price: 0,
    desc: "Insert coin. Hot pink, electric cyan, scanlines, typewriter type — the arcade never closed.",
    conflict: "",
    theme: { vibe: "neon", bg_color: "", bg_image_url: "", text_color: "", accent_color: "#00e5ff", font: "typewriter", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;overflow:hidden;}" +
      ".dwc-myprofile::after{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 2px,transparent 2px 4px);}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{text-transform:uppercase;letter-spacing:.10em;}" +
      ".dwc-myprofile .btn{text-transform:uppercase;letter-spacing:.10em;}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#00e5ff;text-shadow:none;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #00e5ff;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #00e5ff;}" +
      ".dwc-myprofile .card{background:#120a24;border:2px solid #00e5ff;border-radius:8px;}"},
  {
    id: "store:kitsune-shrine", code: "KITSUNE", name: "Kitsune Shrine", tag: "Fox · gold · red", price: 0,
    desc: "Nine-tailed fox at a shrine in RGB — black classy background, golden borders, red accents here and there.",
    conflict: "",
    theme: { vibe: "gold", bg_color: "", bg_image_url: "https://rarecandyreserve.org/images/fox-mask-icon.jpg", text_color: "", accent_color: "#d4af37", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "gold", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;}" +
      ".dwc-myprofile::before{content:\"\";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.45),rgba(0,0,0,.72));}" +
      ".dwc-myprofile .card{outline:1px solid rgba(212,175,55,.55);outline-offset:3px;}" +
      ".dwc-myprofile h2{border-bottom:2px solid #e53935;padding-bottom:4px;}" +
      ".dwc-myprofile .dwc-avatar{box-shadow:0 0 0 3px #8a0303,0 0 18px rgba(229,57,53,.6);}"
   +
      ".dwc-myprofile a{color:#d4af37;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #d4af37;}"},
  {
    id: "store:horror-lover", code: "HORROR", name: "Horror Lover", tag: "Dark · blood", price: 0,
    desc: "Black as the basement, blood-red headings, serif like a tombstone inscription. For the ones who love the dark.",
    conflict: "",
    theme: { vibe: "dark", bg_color: "", bg_image_url: "", text_color: "", accent_color: "#c41e1e", font: "serif", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "ghost", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile .card{box-shadow:0 0 24px rgba(196,30,30,.25);}" +
      ".dwc-myprofile h2{border-bottom:1px solid #5c0000;padding-bottom:4px;letter-spacing:.04em;}" +
      ".dwc-myprofile .dwc-avatar{box-shadow:0 0 16px rgba(196,30,30,.7);}"
   +
      ".dwc-myprofile a{color:#c41e1e;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #c41e1e;}"},
  {
    id: "store:stardust-diner", code: "DINER", name: "Stardust Diner", tag: "50s · chrome · teal", price: 0,
    desc: "Cream booths, teal chrome, pink neon — a 50s diner at midnight, jukebox optional.",
    conflict: "",
    theme: { vibe: "", bg_color: "#fff6e5", bg_image_url: "", text_color: "#3a2a1a", accent_color: "#0e7c7b", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;}" +
      ".dwc-myprofile::before{content:\"\";position:absolute;top:0;left:0;right:0;height:18px;pointer-events:none;background-image:repeating-linear-gradient(90deg,#0e7c7b 0 18px,#fff 18px 36px);}" +
      ".dwc-myprofile .card{background:#fff;border:2px solid #0e7c7b;border-radius:18px;}" +
      ".dwc-myprofile .btn{background:linear-gradient(180deg,#f5f5f5,#cfcfcf);color:#222;border:2px solid #0e7c7b;}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#0e7c7b;text-shadow:none;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #0e7c7b;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #0e7c7b;}"},
  {
    id: "store:deep-forest", code: "FOREST", name: "Deep Forest", tag: "Green · calm", price: 0,
    desc: "Moss, pine, and soft green light — quiet, earthy, and easy on the eyes at 2 AM.",
    conflict: "",
    theme: { vibe: "forest", bg_color: "", bg_image_url: "", text_color: "", accent_color: "#00e5ff", font: "serif", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile .card{box-shadow:0 4px 14px rgba(0,0,0,.35);}" +
      ".dwc-myprofile h2{letter-spacing:.04em;}" +
      ".dwc-myprofile .dwc-avatar{box-shadow:0 0 14px rgba(57,255,136,.5);}"
   +
      ".dwc-myprofile .btn{background:#00e5ff;color:#1a1405;box-shadow:none;border-radius:8px;}" +
      ".dwc-myprofile a{color:#00e5ff;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #00e5ff;}"},
  {
    id: "store:cyber-street", code: "CYBER", name: "Cyber Street", tag: "Cyberpunk · angled", price: 0,
    desc: "Rain-slick blacktop, cyan neon, magenta slashes — the street after dark, wired up.",
    conflict: "",
    theme: { vibe: "midnight", bg_color: "", bg_image_url: "", text_color: "", accent_color: "#00e5ff", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile h2,.dwc-myprofile h3{transform:skewX(-8deg);}" +
      ".dwc-myprofile .card{box-shadow:-4px 0 0 #ff2ea6,0 0 12px rgba(0,229,255,.25);}" +
      ".dwc-myprofile .btn{text-transform:uppercase;letter-spacing:.12em;}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#00e5ff;text-shadow:none;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #00e5ff;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #00e5ff;}"},
  {
    id: "store:neon-rain", code: "NEONRAIN", name: "Neon Rain", tag: "Animated · premium", price: 20,
    desc: "Rainy Night's storm, turned all the way up — rain, neon glow, and your picture up top.",
    conflict: "Hides your links — that section won't show while this layout is on.",
    theme: { vibe: "neon", bg_color: "", bg_image_url: "", text_color: "", accent_color: "#00e5ff", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "neon", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "top", pic_frame: "", blood_color: "", hide_sections: ["links"] },
    css: ".dwc-myprofile{position:relative;overflow:hidden;}" +
      ".dwc-myprofile::after{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(115deg,transparent 0 14px,rgba(0,229,255,.28) 14px 15px,transparent 15px 36px);background-size:120px 260px;animation:dwcRain 1.1s linear infinite;}" +
      ".dwc-myprofile h2{text-transform:uppercase;letter-spacing:.10em;}" +
      ".dwc-myprofile .dwc-avatar{box-shadow:0 0 18px rgba(0,229,255,.8);}" +
      "@keyframes dwcRain{from{background-position:0 -260px;}to{background-position:-60px 0;}}"
   +
      ".dwc-myprofile a{color:#00e5ff;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #00e5ff;}" +
      ".dwc-myprofile .card{background:rgba(20,0,50,.82);border:1px solid #ff2d95;border-radius:8px;}"},
  {
    id: "store:golden-shrine", code: "GOLD", name: "Golden Shrine", tag: "Fox · deluxe", price: 20,
    desc: "Kitsune Shrine, gilded — double gold frames, red ribbon rules, serif like a temple plaque.",
    conflict: "",
    theme: { vibe: "gold", bg_color: "", bg_image_url: "https://rarecandyreserve.org/images/fox-mask-icon.jpg", text_color: "", accent_color: "#d4af37", font: "serif", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "gold", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;}" +
      ".dwc-myprofile::before{content:\"\";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.45),rgba(0,0,0,.72));}" +
      ".dwc-myprofile .card{outline:2px solid #d4af37;outline-offset:4px;}" +
      ".dwc-myprofile h2{border-bottom:2px solid #e53935;padding-bottom:4px;}" +
      ".dwc-myprofile .dwc-avatar{box-shadow:0 0 0 3px #d4af37,0 0 18px rgba(212,175,55,.7);}"
   +
      ".dwc-myprofile a{color:#d4af37;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #d4af37;}"},
  {
    id: "store:arcade80s", code: "ARCADE85", name: "Retro Arcade '85", tag: "Arcade · 80s · premium", price: 50,
    desc: "Chris's own page layout, turned all the way up — a truly retro 80s arcade background: neon grid floor, striped sun, INSERT COIN energy. Your page, but arcade. Buying it unlocks the background for your page.",
    conflict: "",
    theme: { vibe: "", bg_color: "#070714", bg_image_url: "https://rarecandyreserve.org/images/retro-arcade-80s-bg.jpg", text_color: "#e8f6ff", accent_color: "#00e5ff", font: "orbitron", name_font: "pressstart", glow: false, glow_color: "", outline_color: "", button_style: "arcade", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;background-image:linear-gradient(rgba(5,5,20,.55),rgba(5,5,20,.78)),url(https://rarecandyreserve.org/images/retro-arcade-80s-bg.jpg);background-size:cover;background-position:center;background-attachment:fixed;}" +
      ".dwc-myprofile .card{background:rgba(10,10,28,.88);border:2px solid #00e5ff;border-radius:8px;}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{color:#ffe600;text-shadow:0 0 12px rgba(255,230,0,.7);}" +
      ".dwc-myprofile p,.dwc-myprofile li{color:#e8f6ff;}" +
      ".dwc-myprofile .dwc-meta{color:#8ab8d8;}" +
      ".dwc-myprofile a{color:#00e5ff;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #ffe600;box-shadow:0 0 12px rgba(255,230,0,.6);}" +
      ".dwc-myprofile .btn{background:linear-gradient(90deg,#ff2d95,#ffe600);color:#0a0a12;box-shadow:0 0 12px rgba(255,230,0,.6);}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #ffe600;border-radius:8px;}" +
      ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #00e5ff;}"
  },
  {
    id: "store:vaporwave-sunset", code: "SUNSET", name: "Vaporwave Sunset", tag: "Sunset · chrome · grid", price: 0,
    desc: "Driving into the sunset — pink sky, chrome letters, neon grid floor. The signature RCR look, turned golden.",
    conflict: "",
    theme: { vibe: "sunset", bg_color: "", bg_image_url: "", text_color: "", accent_color: "#ff9a00", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "gradient", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;overflow:hidden;}" +
      ".dwc-myprofile::after{content:\"\";position:absolute;left:0;right:0;bottom:0;height:120px;pointer-events:none;background-image:linear-gradient(transparent,rgba(255,45,149,.25)),repeating-linear-gradient(90deg,rgba(0,229,255,.35) 0 2px,transparent 2px 28px),repeating-linear-gradient(0deg,rgba(0,229,255,.35) 0 2px,transparent 2px 18px);}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{text-transform:uppercase;letter-spacing:.12em;text-shadow:0 0 14px rgba(255,154,0,.7);}" +
      ".dwc-myprofile .dwc-avatar{box-shadow:0 0 18px rgba(255,154,0,.8);}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#ff9a00;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #ff9a00;}" +
      ".dwc-myprofile .card{background:#ffffff;border:1px solid #dddddd;border-radius:8px;}"},
  {
    id: "store:retro-terminal", code: "TERMINAL", name: "Retro Terminal", tag: "Green · mono · CRT", price: 0,
    desc: "Green phosphor on black, scanlines, blinking cursor — your page is a terminal and you are the operator.",
    conflict: "",
    theme: { vibe: "", bg_color: "#0a0f0a", bg_image_url: "", text_color: "#33ff66", accent_color: "#33ff66", font: "typewriter", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;overflow:hidden;}" +
      ".dwc-myprofile::after{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 2px,transparent 2px 4px);}" +
      ".dwc-myprofile h2::after{content:\"_\";animation:dwcBlink 1s steps(2,start) infinite;}" +
      ".dwc-myprofile .card{background:#0d150d;border:1px solid #1f4d2a;border-radius:4px;}" +
      ".dwc-myprofile .dwc-avatar{border-radius:4px;box-shadow:0 0 14px rgba(51,255,102,.5);}" +
      ".dwc-myprofile .btn{border:2px solid #33ff66;color:#33ff66;}" +
      "@keyframes dwcBlink{50%{opacity:0;}}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#33ff66;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #33ff66;}"},
  {
    id: "store:candy-pop", code: "CANDY", name: "Candy Pop", tag: "Bubblegum · round · sweet", price: 0,
    desc: "Bubblegum pink, big round corners, soft as a jawbreaker — sweet, loud, and impossible to miss.",
    conflict: "",
    theme: { vibe: "bubblegum", bg_color: "", bg_image_url: "", text_color: "", accent_color: "#ff2d95", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile .card{border-radius:26px;box-shadow:0 6px 0 rgba(255,45,149,.25);}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{letter-spacing:.03em;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #ff5cb8;box-shadow:0 0 16px rgba(255,92,184,.6);}" +
      ".dwc-myprofile .btn{border-radius:999px;box-shadow:0 4px 0 rgba(214,0,122,.35);}"
   +
      ".dwc-myprofile a{color:#ff2d95;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #ff2d95;}"},
  {
    id: "store:midnight-garden", code: "GARDEN", name: "Midnight Garden", tag: "Dark · fireflies · serif", price: 0,
    desc: "A garden after dark — deep green, soft gold fireflies, serif like a pressed flower. Quiet and a little haunted.",
    conflict: "",
    theme: { vibe: "forest", bg_color: "", bg_image_url: "", text_color: "", accent_color: "#a3e635", font: "serif", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "ghost", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;}" +
      ".dwc-myprofile::before{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(2px 2px at 22% 28%,#d9f99d,transparent),radial-gradient(2px 2px at 68% 18%,#a3e635,transparent),radial-gradient(1.5px 1.5px at 84% 62%,#fef08a,transparent),radial-gradient(2px 2px at 38% 74%,#a3e635,transparent);animation:dwcSparkleTwinkle 3.2s ease-in-out infinite;}" +
      ".dwc-myprofile .card{box-shadow:0 4px 18px rgba(0,0,0,.45);}" +
      ".dwc-myprofile h2{border-bottom:1px solid #3f6212;padding-bottom:4px;letter-spacing:.05em;}" +
      ".dwc-myprofile .dwc-avatar{box-shadow:0 0 16px rgba(163,230,53,.55);}"
   +
      ".dwc-myprofile a{color:#a3e635;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #a3e635;}"},
  {
    id: "store:shopfront", code: "SHOP", name: "Corner Shop", tag: "Website template · shop", price: 20,
    desc: "A full website template for your shop — your name big at the top, what you sell, and about the shop. Turns Website look on when you apply it.",
    conflict: "",
    website: true,
    theme: { vibe: "", bg_color: "#fdf6ec", bg_image_url: "", text_color: "#3a2a1a", accent_color: "#c41e1e", font: "rounded", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [], custom_page_html: "<section><h1>{{name}}</h1><p>Welcome to my shop — cards, prints, and more, all in one place.</p></section><section><h2>What I sell</h2><p>Browse my listings below — every item is in hand and ready to ship. Message me if you want a bundle deal.</p></section><section><h2>About the shop</h2><p>Run by {{name}} — a collector first, a seller second. Every order ships with care.</p></section>" },
    css: ".dwc-myprofile{background:#fdf6ec;}" +
      ".dwc-custom-page section{background:#fff;border:1px solid #e8d9c8;border-radius:14px;padding:16px;margin-bottom:12px;}" +
      ".dwc-custom-page h1{font-size:34px;color:#c41e1e;margin:0 0 8px;}" +
      ".dwc-custom-page h2{font-size:22px;color:#3a2a1a;margin:0 0 6px;}" +
      ".dwc-custom-page p{color:#3a2a1a;line-height:1.5;margin:0;}" +
      ".dwc-myprofile .btn{border-radius:999px;}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#c41e1e;text-shadow:none;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #c41e1e;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #c41e1e;}" +
      ".dwc-myprofile .card{background:#ffffff;border:1px solid #dddddd;border-radius:8px;}"},
  {
    id: "store:band-stand", code: "ENCORE", name: "Encore", tag: "Website template · band", price: 20,
    desc: "A full website template for a band or musician — your name in lights, your latest release, and how to book a show. Turns Website look on when you apply it.",
    conflict: "",
    website: true,
    theme: { vibe: "", bg_color: "#0b0b14", bg_image_url: "", text_color: "#f2f2f8", accent_color: "#ff2d95", font: "", name_font: "bangers", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [], custom_page_html: "<section><h1>{{name}}</h1><p>Music, merch, and show dates — all in one place.</p></section><section><h2>Latest release</h2><p>New music is out now. Listen on the player, grab the merch, and come see a show.</p></section><section><h2>Book a show</h2><p>Want {{name}} at your venue? Message me — let’s make it happen.</p></section>" },
    css: ".dwc-myprofile{background:linear-gradient(180deg,#0b0b14,#1a0b2e);}" +
      ".dwc-custom-page section{background:rgba(20,0,50,.82);border:1px solid #ff2d95;border-radius:16px;padding:16px;margin-bottom:12px;}" +
      ".dwc-custom-page h1{font-size:38px;color:#ff5cb8;text-shadow:0 0 12px rgba(255,45,149,.8);margin:0 0 8px;}" +
      ".dwc-custom-page h2{font-size:24px;color:#00e5ff;margin:0 0 6px;}" +
      ".dwc-custom-page p{color:#f2f2f8;line-height:1.5;margin:0;}" +
      ".dwc-myprofile .btn{background:linear-gradient(90deg,#ff2d95,#00e5ff);}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#ff2d95;text-shadow:none;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #ff2d95;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #ff2d95;}" +
      ".dwc-myprofile .card{background:rgba(255,255,255,.06);border:1px solid #333;border-radius:8px;}"},
  {
    id: "store:portfolio", code: "PORTFOLIO", name: "Portfolio", tag: "Website template · portfolio", price: 20,
    desc: "A full website template for showing off your work — your name, your selected pieces, and how to reach you. Turns Website look on when you apply it.",
    conflict: "",
    website: true,
    theme: { vibe: "", bg_color: "#ffffff", bg_image_url: "", text_color: "#1a1a1a", accent_color: "#003399", font: "serif", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "ghost", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [], custom_page_html: "<section><h1>{{name}}</h1><p>Work, projects, and things I’ve made — a portfolio in progress.</p></section><section><h2>Selected work</h2><p>A few favorite pieces. More below in my listings — everything here is made by hand.</p></section><section><h2>Contact</h2><p>Message me for commissions, collaborations, or just to say hi.</p></section>" },
    css: ".dwc-myprofile{background:#fff;}" +
      ".dwc-custom-page section{border-bottom:2px solid #003399;padding:14px 0;margin-bottom:12px;}" +
      ".dwc-custom-page h1{font-size:36px;color:#003399;margin:0 0 8px;}" +
      ".dwc-custom-page h2{font-size:22px;color:#1a1a1a;margin:0 0 6px;}" +
      ".dwc-custom-page p{color:#1a1a1a;line-height:1.6;margin:0;}" +
      ".dwc-myprofile .card{border:1px solid #6699cc;border-radius:4px;}"
   +
      ".dwc-myprofile a{color:#003399;text-shadow:none;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #003399;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #003399;}"},
  {
    id: "store:neojapan-rain", code: "NEORAIN", name: "Neo-Japan Rain", tag: "Rainy · city lights · lofi", price: 0,
    desc: "Rain over a lit-up city at night — warm windows, traffic glow, lights in the distance. Like the relaxing videos, on your page.",
    conflict: "",
    theme: { vibe: "midnight", bg_color: "#0a0e1a", bg_image_url: "", text_color: "#e8ecf5", accent_color: "#ff9a00", font: "typewriter", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "neon", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;overflow:hidden;background:linear-gradient(180deg,#05070f 0%,#0a0e1a 55%,#131a2e 100%);}" +
      ".dwc-myprofile::before{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(2px 2px at 12% 68%,#ffb347,transparent),radial-gradient(2px 2px at 28% 74%,#ff6b9d,transparent),radial-gradient(1.5px 1.5px at 44% 70%,#ffd166,transparent),radial-gradient(2px 2px at 61% 76%,#ff9a00,transparent),radial-gradient(1.5px 1.5px at 78% 72%,#ff5c8a,transparent),radial-gradient(2px 2px at 90% 78%,#ffb347,transparent),radial-gradient(1.5px 1.5px at 20% 82%,#ffd166,transparent),radial-gradient(2px 2px at 55% 84%,#ff6b9d,transparent),radial-gradient(1.5px 1.5px at 85% 86%,#ff9a00,transparent);animation:dwcSparkleTwinkle 4s ease-in-out infinite;}" +
      ".dwc-myprofile::after{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(115deg,transparent 0 14px,rgba(174,194,255,.30) 14px 15px,transparent 15px 36px);background-size:120px 260px;animation:dwcNeoRain 1.1s linear infinite;}" +
      ".dwc-myprofile .card{background:rgba(10,14,26,.82);border:1px solid #2a3a5f;border-radius:12px;}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{color:#ffd166;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #ff9a00;box-shadow:0 0 14px rgba(255,154,0,.55);}" +
      "@keyframes dwcNeoRain{from{background-position:0 -260px;}to{background-position:-60px 0;}}"
   +
      ".dwc-myprofile a{color:#ff9a00;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #ff9a00;}"},
  {
    id: "store:neojapan-night", code: "NEONIGHT", name: "Neo-Japan Clear Night", tag: "Clear night · city lights", price: 0,
    desc: "The same lit-up city, rain cleared — a pale moon, stars, and warm windows over a dark skyline.",
    conflict: "",
    theme: { vibe: "midnight", bg_color: "#0a0e1a", bg_image_url: "", text_color: "#e8ecf5", accent_color: "#00e5ff", font: "typewriter", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "neon", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;overflow:hidden;background:linear-gradient(180deg,#04060d 0%,#0a0e1a 55%,#131a2e 100%);}" +
      ".dwc-myprofile::before{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle at 82% 14%,rgba(255,248,225,.95) 0 30px,rgba(255,248,225,.28) 30px 56px,transparent 56px),radial-gradient(1px 1px at 8% 12%,#fff,transparent),radial-gradient(1px 1px at 32% 8%,#fff,transparent),radial-gradient(1.5px 1.5px at 55% 20%,#fff,transparent),radial-gradient(1px 1px at 70% 6%,#fff,transparent),radial-gradient(1px 1px at 94% 24%,#fff,transparent)radial-gradient(2px 2px at 12% 68%,#ffb347,transparent),radial-gradient(2px 2px at 28% 74%,#ff6b9d,transparent),radial-gradient(1.5px 1.5px at 44% 70%,#ffd166,transparent),radial-gradient(2px 2px at 61% 76%,#ff9a00,transparent),radial-gradient(1.5px 1.5px at 78% 72%,#ff5c8a,transparent),radial-gradient(2px 2px at 90% 78%,#ffb347,transparent),radial-gradient(1.5px 1.5px at 20% 82%,#ffd166,transparent),radial-gradient(2px 2px at 55% 84%,#ff6b9d,transparent),radial-gradient(1.5px 1.5px at 85% 86%,#ff9a00,transparent);animation:dwcSparkleTwinkle 5s ease-in-out infinite;}" +
      ".dwc-myprofile .card{background:rgba(10,14,26,.82);border:1px solid #2a3a5f;border-radius:12px;}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{color:#00e5ff;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #00e5ff;box-shadow:0 0 14px rgba(0,229,255,.55);}"
   +
      ".dwc-myprofile a{color:#00e5ff;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #00e5ff;}"},
  {
    id: "store:brass-knuckles", code: "BRASS", name: "Brass Knuckles", tag: "Street · gold · MySpace", price: 0,
    desc: "Super MySpace — dark street, brass-gold everything, big bold letters. Loud, proud, and a little bit trouble.",
    conflict: "",
    theme: { vibe: "", bg_color: "#161210", bg_image_url: "", text_color: "#f5ead6", accent_color: "#c9962e", font: "typewriter", name_font: "bangers", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{background:linear-gradient(160deg,#161210,#241a12 60%,#161210);}" +
      ".dwc-myprofile .card{background:#1e1712;border:2px solid #c9962e;border-radius:6px;}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{color:#e8b64c;text-shadow:0 2px 0 #000;letter-spacing:.04em;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #c9962e;box-shadow:0 0 14px rgba(201,150,46,.6);}" +
      ".dwc-myprofile .btn{background:linear-gradient(90deg,#8a6d1f,#e8b64c,#8a6d1f);color:#1a1206;font-weight:800;}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#c9962e;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #c9962e;}"},
  {
    id: "store:too-much", code: "TOOMUCH", name: "TOO MUCH", tag: "Pink · bows · cute overload", price: 0,
    desc: "Pink, bows, and cute overload — polka dots, round corners, and a red bow on everything. Sweet enough to hurt.",
    conflict: "",
    theme: { vibe: "", bg_color: "#ffd7ef", bg_image_url: "", text_color: "#4a1942", accent_color: "#e53935", font: "rounded", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{background-color:#ffd7ef;background-image:radial-gradient(10px 10px at 20% 20%,#fff 98%,transparent),radial-gradient(10px 10px at 70% 60%,#fff 98%,transparent),radial-gradient(10px 10px at 40% 85%,#fff 98%,transparent),radial-gradient(8px 8px at 90% 15%,#fff 98%,transparent);background-size:180px 180px;}" +
      ".dwc-myprofile .card{background:#fff;border:2px solid #ff8fc7;border-radius:22px;}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{color:#d81b60;}" +
      ".dwc-myprofile h2::before{content:\"\";display:inline-block;width:16px;height:12px;margin-right:8px;background:#e53935;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;box-shadow:20px 0 0 #e53935;transform:rotate(-18deg);vertical-align:middle;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #e53935;box-shadow:0 0 14px rgba(229,57,53,.5);}" +
      ".dwc-myprofile .btn{background:#e53935;border-radius:999px;}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#e53935;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #e53935;}"},
  {
    id: "store:cat-faces", code: "CATS", name: "Cat Faces", tag: "Cats · art-styled · cream", price: 0,
    desc: "A warm cream background covered in different art-styled cat faces — solid, outline, and striped. All original, all cats.",
    conflict: "",
    theme: { vibe: "", bg_color: "#fff6e5", bg_image_url: "", text_color: "#3a2a1a", accent_color: "#ff9a00", font: "rounded", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{background-color:#fff6e5;background-image:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'240'%20height%3D'240'%3E%3Cpath%20d%3D'M32%2044%20L46%2012%20L62%2040%20Z'%20fill%3D'%23ffb74d'%2F%3E%3Cpath%20d%3D'M78%2040%20L92%2012%20L108%2044%20Z'%20fill%3D'%23ffb74d'%2F%3E%3Ccircle%20cx%3D'70'%20cy%3D'62'%20r%3D'34'%20fill%3D'%23ffb74d'%2F%3E%3Ccircle%20cx%3D'58'%20cy%3D'56'%20r%3D'4'%20fill%3D'%233a2a1a'%2F%3E%3Ccircle%20cx%3D'82'%20cy%3D'56'%20r%3D'4'%20fill%3D'%233a2a1a'%2F%3E%3Cpath%20d%3D'M62%2070%20Q70%2076%2078%2070'%20stroke%3D'%233a2a1a'%20stroke-width%3D'2'%20fill%3D'none'%2F%3E%3Cpath%20d%3D'M152%2044%20L166%2012%20L182%2040%20Z'%20fill%3D'none'%20stroke%3D'%2326a69a'%20stroke-width%3D'3'%2F%3E%3Cpath%20d%3D'M198%2040%20L212%2012%20L228%2044%20Z'%20fill%3D'none'%20stroke%3D'%2326a69a'%20stroke-width%3D'3'%2F%3E%3Ccircle%20cx%3D'190'%20cy%3D'62'%20r%3D'34'%20fill%3D'none'%20stroke%3D'%2326a69a'%20stroke-width%3D'3'%2F%3E%3Ccircle%20cx%3D'178'%20cy%3D'56'%20r%3D'4'%20fill%3D'%2326a69a'%2F%3E%3Ccircle%20cx%3D'202'%20cy%3D'56'%20r%3D'4'%20fill%3D'%2326a69a'%2F%3E%3Cpath%20d%3D'M92%20164%20L106%20132%20L122%20160%20Z'%20fill%3D'%23b0bec5'%2F%3E%3Cpath%20d%3D'M138%20160%20L154%20132%20L168%20164%20Z'%20fill%3D'%23b0bec5'%2F%3E%3Ccircle%20cx%3D'130'%20cy%3D'182'%20r%3D'34'%20fill%3D'%23b0bec5'%2F%3E%3Cpath%20d%3D'M118%20156%20L122%20168%20M130%20154%20L130%20166%20M142%20156%20L138%20168'%20stroke%3D'%2378909c'%20stroke-width%3D'3'%2F%3E%3Ccircle%20cx%3D'118'%20cy%3D'176'%20r%3D'4'%20fill%3D'%233a2a1a'%2F%3E%3Ccircle%20cx%3D'142'%20cy%3D'176'%20r%3D'4'%20fill%3D'%233a2a1a'%2F%3E%3C%2Fsvg%3E\");background-size:240px 240px;}" +
      ".dwc-myprofile .card{background:#fffdf7;border:2px solid #ffcc80;border-radius:18px;}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{color:#e65100;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #ff9a00;box-shadow:0 0 14px rgba(255,154,0,.5);}" +
      ".dwc-myprofile .btn{background:#ff9a00;border-radius:999px;}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#ff9a00;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #ff9a00;}"},
  {
    id: "store:burton", code: "BURTON", name: "Burton", tag: "Stripes · moon · spooky", price: 0,
    desc: "Black-and-white stripes, a pale moon, and haunted-holiday purple — the striped nightmare look, no film characters.",
    conflict: "",
    theme: { vibe: "", bg_color: "#0b0b14", bg_image_url: "", text_color: "#f2f2f8", accent_color: "#7c4dff", font: "serif", name_font: "creepster", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;background:#0b0b14;}" +
      ".dwc-myprofile::before{content:\"\";position:absolute;top:14px;right:18px;width:110px;height:110px;border-radius:50%;background:radial-gradient(circle,#fff8e1,#f5e6b8);box-shadow:0 0 42px rgba(255,248,225,.45);pointer-events:none;}" +
      ".dwc-myprofile .card{background:#14141f;border:1px solid #2e2e4a;border-top:8px solid transparent;border-image:repeating-linear-gradient(90deg,#fff 0 12px,#000 12px 24px) 8;border-radius:4px;}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{color:#b388ff;letter-spacing:.08em;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #b388ff;box-shadow:0 0 14px rgba(124,77,255,.6);}" +
      ".dwc-myprofile .btn{border:2px solid #b388ff;color:#b388ff;}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#7c4dff;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #7c4dff;}"},
  {
    id: "store:christmas-cozy", code: "SNOW", name: "Christmas Cozy", tag: "Cozy · snow · warm", price: 0,
    desc: "Nice and cozy, filled with snow — warm cream, red and green, snow drifting down, and a string of lights across the top.",
    conflict: "",
    theme: { vibe: "", bg_color: "#fdf6ec", bg_image_url: "", text_color: "#3a2a1a", accent_color: "#c41e1e", font: "serif", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;overflow:hidden;background:#fdf6ec;}" +
      ".dwc-myprofile::before{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(5px 5px at 10% 12px,#ff5252,transparent),radial-gradient(5px 5px at 30% 12px,#69f0ae,transparent),radial-gradient(5px 5px at 50% 12px,#ffd740,transparent),radial-gradient(5px 5px at 70% 12px,#448aff,transparent),radial-gradient(5px 5px at 90% 12px,#ff5252,transparent);background-repeat:repeat-x;}" +
      ".dwc-myprofile::after{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(2px 2px at 12% 18%,#fff,transparent),radial-gradient(1.5px 1.5px at 30% 8%,#fff,transparent),radial-gradient(2px 2px at 52% 24%,#fff,transparent),radial-gradient(1.5px 1.5px at 68% 10%,#fff,transparent),radial-gradient(2px 2px at 84% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 94% 14%,#fff,transparent);animation:dwcStarDrift 30s linear infinite;}" +
      ".dwc-myprofile .card{background:#fff;border:2px solid #c41e1e;border-radius:16px;}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{color:#c41e1e;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #2e7d32;box-shadow:0 0 14px rgba(46,125,50,.5);}" +
      ".dwc-myprofile .btn{background:#c41e1e;border-radius:999px;}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#c41e1e;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #c41e1e;}"},
  {
    id: "store:christmas-lights", code: "LIGHTS", name: "Christmas Lights", tag: "Dark · lights · snow", price: 0,
    desc: "The darker version of the Christmas lights look — a deep night sky, bright colored lights, and snow falling.",
    conflict: "",
    theme: { vibe: "", bg_color: "#0b0f1a", bg_image_url: "", text_color: "#e8ecf5", accent_color: "#39ff88", font: "serif", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] },
    css: ".dwc-myprofile{position:relative;overflow:hidden;background:linear-gradient(180deg,#0b0f1a,#101a30);}" +
      ".dwc-myprofile::before{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(5px 5px at 10% 12px,#ff5252,transparent),radial-gradient(5px 5px at 30% 12px,#69f0ae,transparent),radial-gradient(5px 5px at 50% 12px,#ffd740,transparent),radial-gradient(5px 5px at 70% 12px,#448aff,transparent),radial-gradient(5px 5px at 90% 12px,#ff5252,transparent);background-repeat:repeat-x;}" +
      ".dwc-myprofile::after{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(2px 2px at 12% 18%,#fff,transparent),radial-gradient(1.5px 1.5px at 30% 8%,#fff,transparent),radial-gradient(2px 2px at 52% 24%,#fff,transparent),radial-gradient(1.5px 1.5px at 68% 10%,#fff,transparent),radial-gradient(2px 2px at 84% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 94% 14%,#fff,transparent);animation:dwcStarDrift 30s linear infinite;}" +
      ".dwc-myprofile .card{background:rgba(16,26,48,.85);border:1px solid #2e4a7a;border-radius:14px;}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{color:#69f0ae;}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid #ffd740;box-shadow:0 0 14px rgba(255,215,64,.6);}" +
      ".dwc-myprofile .btn{background:linear-gradient(90deg,#39ff88,#00e5ff);}"
   +
      ".dwc-myprofile .btn{box-shadow:none;}" +
      ".dwc-myprofile a{color:#39ff88;text-shadow:none;}" +
      ".dwc-myprofile .dwc-topfriend{border:2px solid #39ff88;}"}
];

function storeItemById(id) {
  var found = null;
  LAYOUT_STORE.forEach(function (x) { if (x.id === id) found = x; });
  if (!found) (state.userLayouts || []).forEach(function (x) { if (x.id === id) found = x; });
  return found;
}
function storeLayoutName(id) {
  var item = storeItemById(id);
  return item ? item.name : (id || "");
}
// The member's theme merged with a store preset's theme bits — the
// exact theme the preview shows AND the apply call saves, so the two
// can never disagree.
// A layout REPLACES the look (v3.20 root fix): the preset's theme
// fragment is the whole look — the member's old vibe, glow, effects,
// and custom button CSS do NOT survive the merge, or the old neon look
// would keep winning over the new preset (themeCSS is injected after
// the layout CSS, and the base .btn glow survives anything a preset
// doesn't explicitly kill). Structural settings are NOT part of a
// layout and stay exactly as the member set them: Top Friends, feed
// privacy, divider, buttons, video, ticker. The item's custom page
// wins when it has one; otherwise the member's own page stays.
var LAYOUT_STRUCTURAL_FIELDS = ["topfriends_count", "topfriends_side", "feed_privacy", "divider", "divider_color", "divider_unlocks", "website_buttons", "video_url", "video_file_url", "video_size", "video_align", "cover_size", "cover_name", "ticker_source", "buttons_side", "buttons_show", "button_size", "buttons_visible", "pro_button_side", "pro_button_color", "display_badges"];
function storeMergedTheme(item) {
  var cur = state.profile ? parseThemeClient(state.profile.profile_theme) : {};
  var merged = Object.assign({}, item.theme || {});
  LAYOUT_STRUCTURAL_FIELDS.forEach(function (k) { if (cur[k] !== undefined) merged[k] = cur[k]; });
  if (!merged.custom_page_html && cur.custom_page_html) merged.custom_page_html = cur.custom_page_html;
  return merged;
}
// Scope CSS to the store preview box so a preview can never restyle
// the page behind the phone. themeCSS + layout_css both use
// .dwc-myprofile selectors; keyframes stay global (harmless).
function scopeStoreCSS(css) {
  return String(css || "").replace(/\.dwc-myprofile/g, "#dwc-store-preview .dwc-myprofile");
}

// ---------- Layout miniatures (v3.20) ----------
// Previewing a layout used to mean opening a separate phone-sized
// preview off to the side — cut off and awkward. Now every layout
// carries its own miniature: a live, scaled-down sample profile page
// rendered inline in a small frame, in the store grid AND in the Edit
// Profile picker. It's a LIVE render, not a static image — the layout's
// own colors, background, fonts, and CSS are applied to a sample
// profile (banner strip, name, two cards, a button), so every layout
// gets a preview automatically, including new ones and member-published
// ones. The sample renders at a fixed width (360px in the store, 280px
// in the picker) and fitLayoutMinis() scales it down to the frame, so
// it stays legible on mobile and desktop. Each mini's CSS is scoped to
// its own .dwc-mini-<uid> class, so two dozen minis on one page can
// never restyle each other.
function layoutMiniHTML(item, innerW, small) {
  var w = innerW || 360;
  var uid = "m" + String(item.id || "x").replace(/[^a-z0-9]+/gi, "-");
  var th = parseThemeClient(item.theme || {});
  // The mini shows the LAYOUT as designed (its own theme only — not
  // merged with the member's current look, or every mini would show
  // the member's background instead of the layout's).
  var css = themeCSS(th) + scopeProfileCss(item.css || "");
  css = css.split(".dwc-myprofile").join(".dwc-mini-" + uid);
  ensureProfileFonts(th);
  var accent = th.accent_color || "#00e5ff";
  var bannerStyle = "background:linear-gradient(90deg," + accent + "," + (th.bg_color || "#223") + ")";
  return '<div class="dwc-layout-mini' + (small ? " dwc-layout-mini-sm" : "") + '" data-mini-w="' + w + '">' +
    "<style>" + css + "</style>" +
    '<div class="dwc-layout-mini-inner" style="width:' + w + 'px">' +
    '<div class="dwc-mini-' + uid + ' dwc-previewbox">' +
    '<div class="dwc-mini-banner" style="' + bannerStyle + '"></div>' +
    '<section class="card dwc-mypage-head"><div class="dwc-avatar dwc-mini-avatar">S</div><h3>Sample Member</h3><p class="dwc-meta">@sample · your page, this layout</p></section>' +
    '<section class="card"><p>About me — this is how your page will look with this layout on it.</p></section>' +
    '<section class="card"><p>🎵 My latest post shows here, in the feed.</p></section>' +
    '<p><button type="button" class="btn">Message</button></p>' +
    "</div></div></div>";
}
// Scale every miniature's inner sample down to its frame (never up —
// a frame wider than the sample just shows it at full size). Called
// after the store grid and the Edit Profile picker render, and on
// resize, so the minis always fill their frame on any screen.
function fitLayoutMinis() {
  if (typeof document === "undefined") return;
  var minis = document.querySelectorAll(".dwc-layout-mini");
  for (var i = 0; i < minis.length; i++) {
    var frame = minis[i];
    var inner = frame.querySelector(".dwc-layout-mini-inner");
    if (!inner) continue;
    var w = parseInt(frame.getAttribute("data-mini-w") || "360", 10) || 360;
    var fw = frame.clientWidth || w;
    var scale = Math.min(1, fw / w);
    inner.style.transform = "scale(" + scale + ")";
  }
}
async function loadLucre() {
  if (!state.profile) { state.lucre = null; return; }
  var data = await apiGet("/lucre?device_id=" + encodeURIComponent(deviceId()));
  if (data && data.ok) {
    state.lucre = { balance: data.balance, ledger: data.ledger || [], checkin: data.checkin || null, owned: data.owned || [] };
    var w = document.getElementById("dwc-lucre-wallet");
    if (w) w.outerHTML = lucreWalletHTML();
    if (state.phone.open && state.phone.app === "store") renderPhone();
  } else if (data) {
    state.lucre = { balance: 0, ledger: [], checkin: null, owned: [] };
  }
}
// A post/comment/listing response that paid Lucre carries it — keep the
// wallet balance fresh without another fetch.
function applyLucreResponse(data) {
  if (data && data.lucre && typeof data.lucre.balance === "number" && state.lucre) {
    state.lucre.balance = data.lucre.balance;
    var w = document.getElementById("dwc-lucre-wallet");
    if (w) w.outerHTML = lucreWalletHTML();
  }
}
function lucreCheckinLabel() {
  var c = state.lucre && state.lucre.checkin;
  if (!c) return "";
  if (c.can_check_in) {
    return (c.streak > 0 ? "🔥 Streak: " + c.streak + "/7 — " : "") + "50 " + LUCRE_SYMBOL + " bonus at 7 weeks in a row";
  }
  var days = Math.max(1, Math.ceil(((c.next_checkin_at || 0) - Date.now()) / 86400000));
  return "✓ Checked in — next check-in in " + days + " day" + (days === 1 ? "" : "s") + (c.streak > 0 ? " · 🔥 Streak: " + c.streak + "/7" : "");
}
// The wallet + weekly check-in on the member home page, right under the
// profile row and next to the Edit Profile buttons. Small, centered,
// classy — one look tells you your balance, your streak, and how to earn.
function lucreWalletHTML() {
  if (!state.profile) return "";
  var l = state.lucre;
  var balance = l ? l.balance : null;
  var c = l && l.checkin;
  var can = !!(c && c.can_check_in);
  return '<div id="dwc-lucre-wallet" class="dwc-lucre-wallet">' +
    '<div class="dwc-lucre-top"><span class="dwc-lucre-balance">' + LUCRE_SYMBOL + ' <strong>' + (balance === null ? "…" : balance) + '</strong> Lucre</span>' +
    '<span class="dwc-lucre-note">site only currency — not real money, not crypto, can’t cash out</span></div>' +
    '<div class="dwc-lucre-checkin"><span class="dwc-lucre-streak">' + esc(lucreCheckinLabel() || "Weekly check-in — 5 " + LUCRE_SYMBOL + " a week, 50 " + LUCRE_SYMBOL + " bonus every 7th week") + '</span>' +
    (can ? ' <button type="button" class="btn small" onclick="DWC.lucreCheckin()">Check in · +5 ' + LUCRE_SYMBOL + '</button>' : "") + '</div>' +
    '<div class="dwc-lucre-earn">Earn: post 10 · comment 10 · heart 5 · listing 10 · check in weekly · <button type="button" class="dwc-linklike" onclick="DWC.phoneGo(\'store\')">🛍️ Spend it in the Layout Store →</button></div>' +
    '</div>';
}
// ---------- Layout Store (Taffy Phone app) ----------
// A little fake browser inside the phone: browse pre-made layout codes
// like an old MySpace layout site, preview each one on YOUR page, then
// apply the free ones or buy the priced ones with Lucre. Taffy doesn't
// write code — these are pre-made, one tap each.
function storeOwnedIds() {
  return (state.lucre && state.lucre.owned) || [];
}
function storeFilteredItems() {
  var f = state.storeFilter || "all";
  var owned = storeOwnedIds();
  var all = LAYOUT_STORE.concat(state.userLayouts || []);
  return all.filter(function (x) {
    if (f === "free") return x.price === 0;
    if (f === "priced") return x.price > 0;
    if (f === "owned") return x.price === 0 || owned.indexOf(x.id) >= 0;
    return true;
  });
}
// Member-published layouts (v3.12) — the store's community shelf.
// Loaded lazily when the store opens; normalized to the same shape as
// the pre-made presets so preview/apply/code all work the same way.
// Fails soft (empty shelf) until the user_layouts migration has run.
async function loadUserLayouts() {
  var data = await apiGet("/layouts");
  state.userLayoutsLoading = false;
  if (data && data.ok && Array.isArray(data.layouts)) {
    state.userLayouts = data.layouts.map(function (r) {
      var theme = {};
      try { theme = JSON.parse(r.theme_json || "{}"); } catch (e) {}
      return { id: "user:" + r.id, name: r.name, tag: "By @" + r.author_name, price: 0, desc: r.description || "", conflict: "", code: "U" + r.id, theme: theme, css: r.css || "", author_name: r.author_name, author_id: r.author_id };
    });
    if (state.phone.open && state.phone.app === "store") renderPhone();
  }
}
function storePreviewHTML(item) {
  if (!item || !state.profile) return "";
  var merged = storeMergedTheme(item);
  // A website template's preview shows the website look (its custom
  // page is the page) — force website_mode on the fake profile and
  // fill in the member's name where the template says {{name}}.
  if (item.website) {
    merged.custom_page_html = String(merged.custom_page_html || "").split("{{name}}").join(state.profile.username || "Your name");
  }
  var fake = Object.assign({}, state.profile, { is_mine: true, website_mode: item.website ? true : state.profile.website_mode, profile_theme: JSON.stringify(merged) });
  var css = scopeStoreCSS(themeCSS(merged)) + scopeStoreCSS(scopeProfileCss(item.css));
  ensureProfileFonts(merged);
  return '<div id="dwc-store-preview" class="dwc-store-preview">' +
    '<style>' + css + '</style>' +
    '<h4 style="margin:0 0 6px">Preview — your page with “' + esc(item.name) + '”</h4>' +
    layoutPreviewInnerHTML(fake) +
    '</div>';
}
function phoneStoreHTML() {
  var body = "";
  if (!state.profile) {
    body = '<p class="tp-note">Create your account to use the Layout Store — Taffy is here either way.</p><p><button type="button" class="btn small" onclick="DWC.phoneMinimize();DWC.openSignup()">Create account — it’s free</button></p>';
  } else {
    var l = state.lucre;
    if (!l) { loadLucre(); }
    if (!state.userLayouts && !state.userLayoutsLoading) { state.userLayoutsLoading = true; loadUserLayouts(); }
    var balance = l ? l.balance : null;
    var owned = storeOwnedIds();
    var current = state.profile.layout_preset || "";
    var currentItem = storeItemById(current);
    var items = storeFilteredItems();
    var filters = [["all", "All"], ["free", "Free"], ["priced", "Priced"], ["owned", "Mine"]].map(function (f) {
      return '<button type="button" class="dwc-pill' + (state.storeFilter === f[0] ? " active" : "") + '" onclick="DWC.storeFilter(\'' + f[0] + '\')">' + f[1] + '</button>';
    }).join("");
    var previewItem = state.storePreview ? storeItemById(state.storePreview) : null;
    body =
      '<p class="tp-note" style="text-align:center;margin:0 0 4px"><strong>' + LUCRE_SYMBOL + ' ' + (balance === null ? "…" : balance) + ' Lucre</strong> · site only currency — not real money, not crypto, can’t cash out.</p>' +
      '<p class="tp-note" style="text-align:center;margin:0 0 8px">Pre-made layouts, like an old MySpace layout site. Preview one on your page, then apply it — one tap. Got a code from a friend? Paste it below.</p>' +
      '<div class="dwc-store-filters">' + filters + '</div>' +
      '<div class="dwc-store-codebox"><input id="dwc-layout-code" maxlength="20" placeholder="Got a layout code? Paste it here — e.g. RAINY" autocomplete="off">' +
      ' <button type="button" class="btn small" onclick="DWC.applyLayoutCode()">Use this code</button></div>' +
      (currentItem ? '<p class="tp-note" style="text-align:center">You’re wearing <strong>' + esc(currentItem.name) + '</strong> right now. <button type="button" class="dwc-linklike" onclick="DWC.storeRevert()">← Back to my own look</button></p>' : "") +
      (previewItem ? storePreviewHTML(previewItem) + '<p style="margin:6px 0 10px;text-align:center"><button type="button" class="btn small" onclick="DWC.storeApply(\'' + previewItem.id + '\')">Apply “' + esc(previewItem.name) + '”' + (previewItem.price > 0 && owned.indexOf(previewItem.id) < 0 ? ' · ' + previewItem.price + ' ' + LUCRE_SYMBOL : "") + '</button> <button type="button" class="btn ghost small" onclick="DWC.storePreview(null)">Close preview</button></p>' : "") +
      '<div class="dwc-store-list">' + items.map(function (x) {
        var isOwned = x.price === 0 || owned.indexOf(x.id) >= 0;
        var isCurrent = current === x.id;
        return '<div class="dwc-store-card">' +
          layoutMiniHTML(x, 360) +
          '<div class="dwc-store-head"><strong>' + esc(x.name) + '</strong><span class="dwc-store-price">' + (x.price === 0 ? "FREE" : x.price + " " + LUCRE_SYMBOL) + '</span></div>' +
          '<p class="dwc-store-tag">' + esc(x.tag) + '</p>' +
          '<p class="dwc-store-desc">' + esc(x.desc) + '</p>' +
          (x.conflict ? '<p class="dwc-store-conflict">⚠️ ' + esc(x.conflict) + '</p>' : "") +
          '<p class="dwc-store-code">Code: <code>' + esc(x.code || "") + '</code> <button type="button" class="dwc-linklike" onclick="DWC.copyLayoutCode(\'' + x.id + '\')">📋 Copy</button>' +
          (x.author_name ? ' · by <strong>@' + esc(x.author_name) + '</strong>' : "") +
          (x.author_id && state.profile && x.author_id === state.profile.id ? ' · <button type="button" class="dwc-linklike" onclick="DWC.unpublishLayout(\'' + x.id + '\')">Take down</button>' : "") + '</p>' +
          '<p class="dwc-store-btns"><button type="button" class="btn ghost small" onclick="DWC.storePreview(\'' + x.id + '\')">Full preview</button> ' +
          (isCurrent ? '<span class="dwc-store-wearing">✓ Wearing it</span>'
            : '<button type="button" class="btn small" ' + (state.storeApplying === x.id ? "disabled" : "") + ' onclick="DWC.storeApply(\'' + x.id + '\')">' + (isOwned ? "Apply" : "Buy · " + x.price + " " + LUCRE_SYMBOL) + '</button>') +
          '</p></div>';
      }).join("") + '</div>' +
      '<p class="tp-note">Taffy doesn’t write code — these layouts are pre-made by the shop, or published by members from their own hand-written CSS. Priced ones are yours forever once bought. Future layouts and frames cost about 20 ' + LUCRE_SYMBOL + ' each.</p>';
  }
  return phoneTopbarHTML("Layout Store") + '<div class="tp-appview">' + body + '</div>';
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
// editor in Edit profile), Layout Store (pre-made layouts, Lucre).
// The phone root lives on document.body, OUTSIDE #dwc-app, so route
// changes never rebuild it — the radio keeps playing and the notes
// textarea keeps focus. renderPhone() only rebuilds when the app, open
// state, wallpaper, gallery count, or MSG list changes.
var PHONE_WALLPAPERS = [
  { id: "vaporwave", label: "Vaporwave", bg: "linear-gradient(160deg,#2b1055 0%,#7597de 42%,#ff2ea6 78%,#ff9a00 100%)" },
  { id: "retro80s", label: "Retro 80s", bg: "radial-gradient(circle at 50% 36%,#ffd75e 0%,#ff9a3d 16%,#ff5e62 32%,transparent 34%),linear-gradient(180deg,#1a0b2e 0%,#3b1d5e 45%,#ff6b35 75%,#2b1055 100%)" },
  { id: "neon", label: "Neon", bg: "radial-gradient(circle at 22% 18%,rgba(0,229,255,.4),transparent 55%),radial-gradient(circle at 82% 82%,rgba(255,46,166,.4),transparent 55%),#05050a" },
  { id: "goth", label: "Goth", bg: "radial-gradient(circle at 50% 0%,rgba(124,77,255,.35),transparent 60%),linear-gradient(160deg,#000000 0%,#1a0b2e 55%,#3b0a3b 100%)" },
  { id: "vitanova", label: "Vita Nova", bg: "radial-gradient(circle at 50% 12%,#ffd75e 0%,rgba(255,215,94,0) 30%),radial-gradient(circle at 85% 90%,rgba(255,45,149,.55),transparent 60%),linear-gradient(165deg,#150326 0%,#4c1d95 50%,#be185d 100%)" },
  { id: "steadyheart", label: "Steady Heart", bg: "radial-gradient(circle at 50% 85%,rgba(170,255,0,.32),transparent 52%),linear-gradient(160deg,#0b0214 0%,#3b0764 45%,#7c3aed 75%,#ec4899 100%)" },
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
  '<svg class="tp-wifi" width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M1.5 4.5a9 9 0 0 1 13 0"/><path d="M4 7.5a5.5 5.5 0 0 1 8 0"/><circle cx="8" cy="10" r="1.2" fill="#fff" stroke="none"/></svg>' +
  '<svg width="25" height="12" viewBox="0 0 25 12" aria-hidden="true"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".5"/><rect x="2" y="2" width="16" height="8" rx="2" fill="#fff"/><path d="M23.5 4v4a2 2 0 0 0 0-4z" fill="#fff" fill-opacity=".5"/></svg>';
var TP_ICON_MSG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.5 2 2 5.9 2 10.8c0 2.8 1.5 5.2 3.8 6.8L4.5 22l5-2.7c.8.2 1.6.3 2.5.3 5.5 0 10-3.9 10-8.8S17.5 2 12 2z" fill="#fff"/></svg>';
var TP_ICON_GALLERY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" fill="#fff"/><path d="M5 17l4.5-4.5L12 15l3-3 4 4" stroke="#f59e0b" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="9" r="1.6" fill="#f59e0b"/></svg>';
var TP_ICON_NOTES = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" fill="#fff"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round"/></svg>';
var TP_ICON_ALERTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="#fff"/></svg>';

function phoneTopbarHTML(title) {
  return '<div class="tp-topbar"><button type="button" class="tp-back" onclick="DWC.phoneGo(\'home\')">‹ Home</button><strong>' + esc(title) + '</strong><button type="button" class="tp-min" onclick="DWC.phoneMinimize()" title="Close the phone">✕ Close</button></div>';
}
function phoneAppTile(app, label, iconHTML) {
  return '<button type="button" class="tp-app" onclick="DWC.phoneGo(\'' + app + '\')">' + iconHTML + '<span>' + esc(label) + '</span></button>';
}
function phoneHomeHTML() {
  var name = state.profile ? "@" + state.profile.username : "friend";
  return '<div class="tp-home">' +
    '<div class="tp-home-top"><button type="button" class="tp-min" onclick="DWC.phoneMinimize()" title="Close the phone">✕ Close</button></div>' +
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
    phoneAppTile("store", "Layout Store", '<span class="tp-icon tp-icon-store"><span class="tp-glyph">🛍️</span></span>') +
    phoneAppTile("alerts", "Alerts", '<span class="tp-icon tp-icon-alerts">' + TP_ICON_ALERTS + '</span>') +
    phoneAppTile("badges", "Badges", '<span class="tp-icon tp-icon-badges"><span class="tp-glyph">🏅</span></span>') +
    '</div>' +
    '<div class="tp-wall"><span>Wallpaper</span><div class="tp-wall-swatches">' +
    PHONE_WALLPAPERS.map(function (w) {
      return '<button type="button" class="tp-wall-sw' + (state.phone.wallpaper === w.id ? " active" : "") + '" style="background:' + w.bg + '" title="' + esc(w.label) + '" aria-label="' + esc(w.label) + ' wallpaper" onclick="DWC.phoneWallpaper(\'' + w.id + '\')"></button>';
    }).join("") +
    '</div></div>' +
    '<p class="tp-note">Tap an app to open it. The ✕ Close button (top right) closes the phone back to the green button.</p>' +
    '</div>';
}
// ---------- Taffy chat — lightweight, client-side only ----------
// No AI API, no network, no heavy model. Pure keyword/pattern matching
// over a small intent table. Fast, tiny, and honest about what it knows.
// Returns { text, emoji, working }. `working` = play the working animation
// (the astral form rising, mandala glowing) while Taffy "thinks".
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
    return { text: taffyPick(["Hey hey! Good to see you. Ask me about layouts, selling, reports, music, or code — or just say hi back.", "Hey! Taffy here. What's on your mind — a layout, selling something, or just saying hi?", "Hi hi! I'm all ears. Try \u201chow do I change my background\u201d or \u201chow do I sell?\u201d — or just chat."]), emoji: taffyPickEmoji(["👋", "😊", "✨"]), working: false };
  // Who is Taffy / tattoos
  if (has(/\b(who are you|your name|what are you|what's your name)\b/) || has(/\btattoo|904|lokos|prison|jail\b/))
    return { text: taffyPick(["I'm Taffy — your little site helper. Cute up front, and yes… my astral form has the 904 Lokos tattoos. Don't judge, I earned them. Ask me how to change something on your page.", "That's me — Taffy, the little helper that lives in the phone. I help with layouts, code, and site questions. The tattoos are on my astral form, long story."]), emoji: taffyPickEmoji(["🍬", "😎"]), working: false };
  // ---- Lucre + Layout Store (v3.11) — Taffy points at real features,
  // never claims to understand arbitrary language or to write code. ----
  if (has(/\blucre\b/) || has(/\b(site )?currenc(y|ies)\b/) || has(/\bhow (do|can) i (earn|get|make).*lucre\b/) || has(/\bwhat is lucre\b/))
    return { text: "Lucre ◈ is the site's own play money — not real money, not crypto, and you can't cash it out. You earn it by being here: 10 for a post, 10 for a comment, 5 for a heart, 10 for a listing, and a weekly check-in on your home page. Spend it in my Layout Store on Taffy's phone — layouts and frames, about 20 ◈ each. Your wallet lives on your home page.", emoji: "◈", working: false };
  if (has(/\blayout store\b/) || has(/\bbuy (a )?layout\b/) || has(/\bpre.?made layouts?\b/))
    return { text: "The Layout Store lives on my phone — tap the 🛍️ Layout Store app. Fourteen pre-made layouts are free (rainy night, professional, Facebook-style, Instagram-style, 80s arcade, kitsune shrine, horror, vaporwave sunset, retro terminal, candy pop, midnight garden, and a few surprises), and two fancy ones cost 20 ◈ each. Every layout has a short code you can copy — paste a code in the store's code box to use it. Members can publish their own layouts there too, free, with their name on them. Tap Preview to see one on your page first, then Apply — one tap and it's live.", emoji: "🛍️", working: false };
  if (has(/\bcheck ?in\b/) || has(/\bweekly check/) || has(/\bstreak\b/))
    return { text: "Weekly check-in: once a week, on your home page near the Edit Profile buttons — 5 ◈ each time, and every 7th week in a row pays a 50 ◈ bonus. Miss more than two weeks and the streak starts over.", emoji: "🔥", working: false };
  if (has(/\bachievements?\b/) || has(/\bunlockables?\b/) || has(/\bwhat.*(unlocked|earned)\b/) || has(/\bmy badges\b/))
    return { text: "Your badges, frames, and Lucre all live in the Badges app on my phone — unlocked ones on top, locked ones with what earns them. Fully setting up your profile unlocks the VITA NOVA frame and a rare-candy badge, too.", emoji: "🏅", working: false };
  // ---- "Make me a whole profile" — Taffy can't write a layout from
  // words, and she says so plainly. The real path is Edit Profile →
  // Taffy Layout Builder: pick a vibe + an accent color and watch the
  // live preview change. This runs before the single-feature intents so
  // a whole-profile ask gets the honest answer, not one piece of it.
  if (has(/\b(make|build|create|design)\b.{0,25}\b(my )?(profile|layout|theme|page)\b/) || (has(/\bhtml\b/) && has(/\b(copy|write|give|show|paste)\b/) && has(/\b(profile|layout|theme|page|my)\b/))) {
    return { text: "I can't write a whole layout from words — that's not something I can do. But Edit Profile → Taffy Layout Builder has real vibes + accent colors you can see live in the preview, and Taffy's Layout Store has pre-made layouts to grab — free ones and a couple you can buy with Lucre. For one thing at a time, just ask me how — like “how do I make my buttons glow”.", emoji: "🎨", working: false };
  }
  // ---- Layout help that actually helps: real CSS + an Apply button ----
  // Each of these returns a css snippet. The chat renders an
  // "Apply this to my layout" button under it, which drops the CSS into
  // the member's My Code box (Edit Profile) and updates the preview.
  // font size (the one that stumped her before)
  if (has(/font size|bigger text|smaller text|text size|make.*text.*(bigger|smaller|larger)/))
    return { text: "Easy — here's the CSS. Tap Apply and I'll drop it straight into your My Code box, or paste it yourself in Edit Profile under MySpace layout.", css: ".dwc-myprofile{font-size:18px;} .dwc-myprofile h2{font-size:32px;} .dwc-myprofile h3{font-size:24px;}", emoji: "🔠", working: false };
  // background color
  if (has(/background color|change.*background|bg color|background.*(blue|pink|purple|black|dark|red|green)/))
    return { text: "Background color, coming up. Apply it and your page goes dark purple — change the hex to any color you like in the My Code box after.", css: ".dwc-myprofile{background:#12002e;}", emoji: "🎨", working: false };
  // background image / GIF
  if (has(/background image|background.*gif|gif background|add a gif|gif.*background|wallpaper/))
    return { text: "GIF backgrounds work! Put the GIF link in the Background image URL box in Edit Profile (any https:// link), or use this CSS — swap in your own GIF link. It shows behind everything on your page.", css: '.dwc-myprofile{background-image:url("https://example.com/my-background.gif");background-size:cover;background-position:center;}', emoji: "🖼️", working: false };
  // buttons flicker / flash like neon signs
  if (has(/\b(flash|flashing|flicker|flickering)\b/) && has(/\bbuttons?\b/))
    return { text: "Flickering neon buttons — yes. Apply this and your buttons flash like a neon sign. The keyframes come with it, so it works wherever you paste it.", css: ".dwc-myprofile .btn,.dwc-myprofile .dwc-pill{box-shadow:0 0 12px #ff2d95,0 0 28px #ff2d95;animation:neonFlicker 2.4s infinite;}@keyframes neonFlicker{0%,91%,94%,98%,100%{opacity:1}92%{opacity:.3}96%{opacity:.6}}", emoji: "✨", working: true };
  // buttons glow
  if (has(/glow.*button|button.*glow|glowing buttons|neon buttons/))
    return { text: "Glowing buttons — yes. Apply this and every button on your page glows pink. Change the hex to glow any color.", css: ".dwc-myprofile .btn,.dwc-myprofile .dwc-pill{box-shadow:0 0 12px #ff2d95,0 0 28px #ff2d95;}", emoji: "✨", working: true };
  // buttons round
  if (has(/round buttons|rounded buttons|circle buttons|buttons?.{0,12}\bround\b/))
    return { text: "Round buttons, done. Apply it and they all go pill-shaped. There's also a Soft Pill button preset in Edit Profile if you want it without code.", css: ".dwc-myprofile .btn,.dwc-myprofile .dwc-pill{border-radius:999px;}", emoji: "🔘", working: false };
  // buttons color
  if (has(/button color|colored buttons|change.*button|button.*color|make.*buttons.*(pink|blue|purple|red|green|gold)/))
    return { text: "Here's a gradient for your buttons — pink to purple. Apply it, or pick a button preset in Edit Profile (Neon Glow, Arcade, RGB Gradient, Gold Luxe…) and skip the code entirely.", css: ".dwc-myprofile .btn,.dwc-myprofile .dwc-pill{background:linear-gradient(90deg,#ff2d95,#7c4dff);color:#fff;}", emoji: "🔘", working: false };
  // headings
  if (has(/heading.*(size|bigger|smaller)|bigger heading|change.*heading|heading.*font/))
    return { text: "Bigger headings, here you go. Apply it and your h2s jump to 32px. Tweak the numbers to whatever size you like.", css: ".dwc-myprofile h2{font-size:32px;} .dwc-myprofile h3{font-size:24px;}", emoji: "🔠", working: false };
  // borders
  if (has(/border|thick border|no border|borderless/))
    return { text: "Borders — this makes your cards pop with a thick pink border. Change the px for thicker or thinner, or the hex for a different color.", css: ".dwc-myprofile .card{border:3px solid #ff2d95;}", emoji: "🖼️", working: false };
  // avatar ring
  if (has(/avatar ring|ring around|picture border|profile pic.*border|border.*(avatar|picture|pfp)/))
    return { text: "A ring around your picture — apply this and your avatar gets a glowing pink ring. There's also a ring thickness option in the Layout Bot.", css: ".dwc-myprofile .dwc-avatar{border:4px solid #ff2d95;box-shadow:0 0 14px #ff2d95;}", emoji: "⭕", working: false };
  // spacing
  if (has(/more space|spacing|padding|roomy|compact/))
    return { text: "More breathing room — this pads your cards out to 28px. Lower the number for tighter, raise it for roomier.", css: ".dwc-myprofile .card{padding:28px;}", emoji: "📐", working: false };
  // sparkle
  if (has(/sparkle|glitter|twinkle|stars/))
    return { text: "Sparkle! Apply this and your page gets a twinkling star field over it. There's also a Sparkle toggle in Edit Profile under MySpace effects.", css: ".dwc-myprofile{position:relative;}.dwc-myprofile::before{content:'';position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(2px 2px at 20% 30%,#fff,transparent),radial-gradient(2px 2px at 70% 60%,#ffe27a,transparent),radial-gradient(2px 2px at 85% 20%,#ff2d95,transparent);animation:dwcSparkleTwinkle 2.4s ease-in-out infinite;}", emoji: "✨", working: true };
  // animated background
  if (has(/animated background|moving background|rainbow background|animated.*bg/))
    return { text: "Animated rainbow background — it slowly shifts through pink, purple, blue and green. Apply it and watch it move. There's a toggle for it in Edit Profile too.", css: ".dwc-myprofile{background:linear-gradient(135deg,#ff2d95,#7c4dff,#00e5ff,#39ff88);background-size:400% 400%;animation:dwcBgShift 12s ease infinite;}", emoji: "🌈", working: true };
  // marquee / scrolling text — the ticker, not the name. The name stays
  // put; scrolling text lives in the optional ticker above your page.
  if (has(/marquee|scrolling text|scrolling name|scrolling heading/))
    return { text: "Scrolling text lives in the ticker — Edit Profile has a Ticker box where you type your own text (up to 200 characters) and it scrolls above your page. Your name stays put.", css: "", emoji: "➡️", working: false };
  // change font (family)
  if (has(/change.*font|different font|font.*(family|style)|comic.*font|serif/))
    return { text: "Fonts — the Font picker in Edit Profile has Comic, Typewriter, and more. Or apply this CSS for a Georgia serif look. Swap the family name for any font you like.", css: ".dwc-myprofile{font-family:Georgia,'Times New Roman',serif;}", emoji: "🔠", working: false };
  // ---- More code help: real answers for code questions, not guesses ----
  // custom font / Google Fonts (external fonts are blocked — say so plainly)
  if (has(/google font|custom font|add (a )?font|import (a )?font|load (a )?font/))
    return { text: "Google Fonts can't load here — the site blocks external stylesheets (@import and @font-face) to keep pages safe, so a font link won't work. But you can use any font already on people's devices. Here's a Georgia serif look — swap the family name for Comic Sans, Trebuchet, Verdana, or Courier. The Font picker in Edit Profile has them too.", css: ".dwc-myprofile{font-family:Georgia,'Times New Roman',serif;}", html: "<style>\n.dwc-myprofile{font-family:Georgia,'Times New Roman',serif;}\n</style>", emoji: "🔠", working: false };
  // add an image / picture to my page
  if (has(/add (an? )?(image|picture|photo|pic)|put (a |an )?(image|picture|photo) on|insert (an? )?(image|picture|photo)/))
    return { text: "Three ways: your profile picture lives in Edit Profile (tap the picture box), a background picture goes in the Background image URL box, or use this CSS with any https:// picture link — swap in your own link. It covers the whole page behind everything.", css: '.dwc-myprofile{background-image:url("https://example.com/my-picture.jpg");background-size:cover;background-position:center;}', html: "<style>\n.dwc-myprofile{background-image:url(\"https://example.com/my-picture.jpg\");background-size:cover;background-position:center;}\n</style>", emoji: "🖼️", working: false };
  // change text / heading / link color
  if (has(/text color|change.*text.*color|color.*(my )?text|heading color|link color|make.*text.*(pink|blue|purple|red|green|gold|white|black|cyan|orange)/))
    return { text: "Text colors, here you go — this sets your body text pink, headings lighter pink, and links cyan. Swap any hex for the color you want, or use the color pickers in Edit Profile.", css: ".dwc-myprofile p,.dwc-myprofile li{color:#ff2d95;} .dwc-myprofile h2,.dwc-myprofile h3{color:#ff5cb8;} .dwc-myprofile a{color:#00e5ff;}", html: "<style>\n.dwc-myprofile p,.dwc-myprofile li{color:#ff2d95;}\n.dwc-myprofile h2,.dwc-myprofile h3{color:#ff5cb8;}\n.dwc-myprofile a{color:#00e5ff;}\n</style>", emoji: "🎨", working: false };
  // center things
  if (has(/center (my|the|text|page|everything|it|all)|how (do|can) i center|align center|centre/))
    return { text: "Centering, done — this centers your text and your cards. Apply it and everything lines up in the middle.", css: ".dwc-myprofile{text-align:center;} .dwc-myprofile .card{margin-left:auto;margin-right:auto;}", html: "<style>\n.dwc-myprofile{text-align:center;}\n.dwc-myprofile .card{margin-left:auto;margin-right:auto;}\n</style>", emoji: "🎯", working: false };
  // hide a section
  if (has(/hide (my|the|a|an)? ?(top friends?|music|links?|bio|avatar|picture|heading|meta|section|something|it|this)/))
    return { text: "Hiding things is one line each — this hides your Top Friends tiles, your music picks, and your links. Delete the lines for the parts you want to keep, and tell me which part if you want a different one hidden.", css: ".dwc-myprofile .dwc-topfriend{display:none;} .dwc-myprofile .dwc-music-picks{display:none;} .dwc-myprofile .dwc-links{display:none;}", html: "<style>\n.dwc-myprofile .dwc-topfriend{display:none;}\n.dwc-myprofile .dwc-music-picks{display:none;}\n.dwc-myprofile .dwc-links{display:none;}\n</style>", emoji: "🙈", working: false };
  // add a video / embed
  if (has(/add (a )?video|embed (a )?video|youtube|put (a )?video (on|in)/))
    return { text: "Videos can't embed on a profile — the site strips iframes to keep pages safe, so a YouTube embed won't work. What does work: add the video as one of your My links in Edit Profile (up to 6) so people tap straight to it, or put your songs in profile music.", emoji: "🎥", working: false };
  // rounded corners
  if (has(/round(ed)? corners?|corner radius|corners? round/))
    return { text: "Rounded corners — apply this and your cards go soft and bubbly. Lower the px for a subtle round, raise it for full bubble.", css: ".dwc-myprofile .card{border-radius:26px;}", html: "<style>\n.dwc-myprofile .card{border-radius:26px;}\n</style>", emoji: "🔘", working: false };
  // custom cursor
  if (has(/custom cursor|change (my )?cursor|mouse cursor|cursor (style|image|color)/))
    return { text: "Custom cursor — this one gives you a crosshair. Swap crosshair for pointer, grab, or wait — or use a picture with cursor:url(\"https://example.com/my-cursor.png\"), auto; (it has to be an https:// link).", css: ".dwc-myprofile{cursor:crosshair;}", html: "<style>\n.dwc-myprofile{cursor:crosshair;}\n</style>", emoji: "🖱️", working: false };
  // add music / audio to my page
  if (has(/add (music|song|audio) (to|on)|put (a |some )?(music|song|audio) on|music on my (profile|page)|song on my (profile|page)/))
    return { text: "Music on your page — Edit Profile has a profile music picker, up to 5 A Steady Heart tracks to show off. No arbitrary audio embeds (the site doesn't allow them), but your tracks play right on your page.", emoji: "🎵", working: false };
  // fix broken code / why isn't my code working
  if ((has(/\bbroken\b/) && has(/\b(code|css|layout)\b/)) ||
      (has(/\bfix\b/) && has(/\b(code|css|layout)\b/)) ||
      (has(/\b(isn.t|doesn.t)\b.{0,20}\bwork(ing)?\b/) && has(/\b(code|css|layout|my page)\b/)))
    return { text: "Let's fix it — the usual culprits: a missing } or ; somewhere, a <style> or <script> tag pasted in (the site strips those — paste just the CSS), an @import or @font-face (blocked), a javascript: link (blocked), or a url() that isn't an https:// image. And make sure you hit Save profile. Tell me what your code does — or doesn't do — and I'll point at the line.", emoji: "🔧", working: false };
  // what's allowed / can I use JavaScript
  if (has(/can i use (javascript|js|script)|is (javascript|js|script) allowed|what (code|css) can i use|what.s allowed|allowed (code|css)|use (javascript|js)/))
    return { text: "Short version: CSS only, no JavaScript. The site strips <script> tags, <style> tags, @import, @font-face, javascript: links, and iframes — that's to keep everyone's pages safe. What you CAN do is all the CSS: colors, fonts, backgrounds, borders, rounded corners, glow, sparkle, animations, and the Layout Bot presets. If you're not sure a line is allowed, ask me and I'll check it.", emoji: "📜", working: false };
  // reset my layout / start over
  if (has(/reset (my )?(layout|theme|page|profile|css)|start over|remove (my )?(custom )?css|clear (my )?(custom )?css|delete (my )?(layout|theme|css)/))
    return { text: "Starting over is easy — Edit Profile, clear out the My Code box, hit Save profile, and you're back to your preset. Or pick a fresh preset first and save that instead. Nothing is lost until you save, so you can always back out.", emoji: "🔄", working: false };
  // preview before saving
  if (has(/preview (my )?(layout|theme|page|profile|css)|how (do|can) i preview|see (my )?(layout|theme) before/))
    return { text: "There's a live preview right in Edit Profile — your My Code CSS updates the preview as you type, so you see it before you save. The Layout Bot shows a preview too. Nothing goes live until you hit Save profile.", emoji: "👀", working: false };
  // mobile / responsive
  if (has(/mobile|responsive|my page on (my )?phone|looks (bad|weird|broken) on (my )?phone|phone (view|layout|screen)/))
    return { text: "The site is responsive, so your page adapts to phones on its own. Two things that break it: fixed pixel widths (use max-width instead) and huge images. This line keeps every picture inside the screen — apply it and your page behaves on phones.", css: ".dwc-myprofile img{max-width:100%;height:auto;}", html: "<style>\n.dwc-myprofile img{max-width:100%;height:auto;}\n</style>", emoji: "📱", working: false };
  // change colors (general)
  if (has(/change.*color|change my colors|my colors|page colors/))
    return { text: "Colors are yours to pick — Edit Profile has color pickers for background, text, and accent, and they sit on top of your preset. Or tell me a color and a place (like \u201cpink background\u201d) and I'll build it.", emoji: taffyPickEmoji(["🎨", "✨"]), working: false };
  // Joke
  if (has(/\bjoke|funny|make me laugh\b/))
    return { text: taffyPick(["Okay, one: why did the Game Boy go to therapy? It had too many unresolved pixels. …I'll stick to layouts.", "What do you call a candy that fixes your page? Taffy — that's literally my job. …Okay, I'll keep the day job."]), emoji: taffyPickEmoji(["😄", "🤣"]), working: false };
  // Report / flag / block / bothering
  if (has(/\breport|flag|block|bother|harass|spam|scam|abuse|rude|mean to me|stalking\b/))
    return { text: taffyPick(["Got it — flag it and an admin will see it. Tap \u201cFile a report\u201d below (or head to Reports), and tell them the comment, profile, or message that doesn't belong. For anything still unresolved, email TheRarecandyreserve@proton.me.", "Say no more — that's what Reports is for. Tap \u201cFile a report\u201d, say what happened and where, and Chris will see it in the operator inbox. Blocking happens through reports too."]), emoji: taffyPickEmoji(["🛡️", "🚩"]), working: false };
  // Contact admin / support / email / mod — get a human.
  // We don't do AI customer support here: Taffy hands you to a real person.
  if (has(/\b(admin|support|contact|email|mod|moderator|owner|human|someone real|real person|live chat)\b/) || has(/talk to (a |someone|somebody)|speak to (a |someone|somebody)|need (a )?human|need real help|get (me )?(a )?(human|person)|real.{0,25}person/))
    return { text: "We don't support AI customer support here, so let me get you to a human! Message Chris directly, email an admin, or file a report — all three are right here.", emoji: "🧑‍💻", human: true, working: false };
  // Profile picture
  if (has(/\b(profile picture|pfp|avatar|change my picture|upload a photo|upload a picture|profile pic|change my pfp)\b/))
    return { text: taffyPick(["Edit Profile, tap the picture box, pick a JPG, PNG, or WebP, and hit Save — big photos are shrunk to fit automatically. If your photo is a HEIC, screenshot it first.", "Your picture lives in Edit Profile — pick a JPG, PNG, or WebP and save. Big photos shrink to fit on their own. It'll show on your page right away."]), emoji: taffyPickEmoji(["🖼️", "✨"]), working: false };
  // My links
  if (has(/\b(add a link|my links|links on my page|attach a link|add links|add a button)\b/))
    return { text: taffyPick(["Edit Profile, find \u201cMy links\u201d, type a label and a URL, hit \u201c+ Add a link\u201d, and save — they show up as buttons on your page. Up to 6.", "Adding a link is easy: Edit Profile \u2192 My links \u2192 label + URL \u2192 save. They show as clean buttons on your page. You can have up to 6."]), emoji: taffyPickEmoji(["🔗", "✨"]), working: false };
  // Delete a post (before the post intent)
  if (has(/\b(delete|remove) (a |my |the )?post\b/))
    return { text: taffyPick(["Open your own post and hit Delete — it's yours, it goes away. If it's someone else's post that doesn't belong, report it instead.", "Your post, your call — open it and delete it. Someone else's post bothering you? That's a report, not a delete."]), emoji: taffyPickEmoji(["🗑️", "✨"]), working: false };
  // 18+ post (before the general post intent)
  if (has(/\b(18\+|adult|after dark)\b/))
    return { text: taffyPick(["You need to be age-verified first — that's an ID check Chris reviews. Once you're verified, the 18+ area lets you Create a post with a genre and a price.", "The 18+ area is age-verified only. Get verified, then hit Create, pick Photos, Videos, or whatever you're selling, set a price, and post."]), emoji: taffyPickEmoji(["🔞", "✨"]), working: false };
  // Post / list an item
  if (has(/\b(post|create a post|make a post|list an item|list something|make a listing|create a listing|how do i list)\b/))
    return { text: taffyPick(["To list something, go to the 18+ area and hit Create — pick Photos, Videos, or whatever you're selling, add a price (0 is free), and post it. Buyers find you through Find a Seller.", "Posting is simple: in the 18+ area, hit Create, pick a genre, set your price, add your tags, and post. Age-verified members only."]), emoji: taffyPickEmoji(["📝", "✨"]), working: false };
  // Buy
  if (has(/\b(buy|purchase|how do i buy|buying)\b/))
    return { text: taffyPick(["Find a post you like, tap it, and message the seller in a private chat to sort out payment. Once it's done, tap \u201cTransaction done\u201d in the chat so you both get a receipt.", "Buying works through private chat — find the post, message the seller, agree on payment, and mark it done with the receipt button so there's a record."]), emoji: taffyPickEmoji(["🛒", "💰"]), working: false };
  // Pay / payment
  if (has(/\b(pay|payment|paypal|stripe|checkout|how do i pay)\b/))
    return { text: taffyPick(["The shop takes PayPal and Stripe — hit Buy with PayPal or the Stripe button on any listing. In the Community, you and the seller agree payment in private chat.", "For shop stuff, it's PayPal or Stripe right on the listing. For Community sales, you pay the seller however you both agree in private chat — then mark the receipt done."]), emoji: taffyPickEmoji(["💳", "💰"]), working: false };
  // Find a seller / buyer
  if (has(/\b(find a seller|find a buyer|find someone|find sellers|find buyers|find a match)\b/))
    return { text: taffyPick(["Hit Find (or Find a Seller / Find a Buyer) and tell it what you want or what you sell — it matches you up and you message them privately.", "The Find area is your matchmaker — set what you're after or what you sell, and it shows you the best matches. Message them privately from there."]), emoji: taffyPickEmoji(["🔍", "✨"]), working: false };
  // Payout / get paid
  if (has(/\b(payout|get paid|receive money|how do i get paid|how do i receive)\b/))
    return { text: taffyPick(["Set your payout method and handle in Edit Profile — that's how sellers get paid. The Community takes 6% once when the sale completes and you're paid.", "Getting paid starts in Edit Profile — put in your payout method and handle. When a sale completes, the buyer pays you, and the Community takes its 6% once."]), emoji: taffyPickEmoji(["💰", "✨"]), working: false };
  // Fee
  if (has(/\b(fee|fees|1\.5|commission|what do you take|how much does it cost)\b/))
    return { text: taffyPick(["The Community takes 6% once — and only once — when a sale completes and you've been paid. No monthly fee, no listing fee, no cut on the way in.", "Just 6%, once, when the sale is done and you're paid. That's it — no listing fees, no monthly fees."]), emoji: taffyPickEmoji(["💰", "🍬"]), working: false };
  // Receipts
  if (has(/\b(receipt|receipts|proof of purchase|transaction done)\b/))
    return { text: taffyPick(["In a private chat, tap \u201cTransaction done\u201d, put in the amount and whether you bought or sold — it saves a receipt for both of you before the chat deletes. You can see yours under My receipts.", "Receipts live in the chat — tap \u201cTransaction done\u201d, add the amount, and it records it for both sides. Find all your receipts under My receipts."]), emoji: taffyPickEmoji(["🧾", "✨"]), working: false };
  // Change name / bio
  if (has(/\b(change my name|change my bio|edit my bio|change my username|change my chat name|update my bio)\b/))
    return { text: taffyPick(["Edit Profile — your chat name, bio, and occupation are all right there. Save and it updates everywhere.", "All in Edit Profile: chat name, bio, occupation, even your birthday. Change it, save it, done."]), emoji: taffyPickEmoji(["✏️", "✨"]), working: false };
  // Subscribe
  if (has(/\b(subscribe|follow a seller|subscribe to)\b/))
    return { text: taffyPick(["On a seller's page, hit their Subscribe button — the label is theirs, so it might say something custom. It's how you follow a seller.", "Find a seller you like and tap Subscribe on their page. The button text is theirs, so it might say anything — but it means follow them."]), emoji: taffyPickEmoji(["⭐", "✨"]), working: false };
  // Top Friends
  if (has(/\b(top friends|top 8|top eight)\b/))
    return { text: taffyPick(["Edit Profile, pick up to 10 Top Friends — they show up as tiles on your page, MySpace-style. Your friends, front and center.", "Top Friends are your Top 10 — pick them in Edit Profile and they show as tiles on your page. Change them anytime."]), emoji: taffyPickEmoji(["🌟", "✨"]), working: false };
  // Friends / favorites / page URL (v3.6) — the buttons on a member page.
  if (has(/\b(add (a )?friend|add me|unfriend|favorite (someone|a member|them)|add to favorites|my page url|page url|custom (page )?url|change my (page )?url)\b/))
    return { text: taffyPick(["On someone's page, hit “Add me” to add them as a friend — it flips to “Unfriend” once you're friends. The star next to “Add to Favorites” lights up gold when they're favorited. Your own page URL lives in Edit Profile under “My page URL” — 3 changes per 5 years, 1-year cooldown, or appeal to Chris.", "Friends and favorites live on the member page: “Add me” adds them (it turns into “Unfriend” when you're already friends), and the ☆ star fills gold when you favorite someone. Your custom page URL is in Edit Profile — “My page URL” — 3 changes in 5 years, 1-year cooldown after each one."]), emoji: taffyPickEmoji(["👥", "⭐"]), working: false };
  // Phone
  if (has(/\b(phone|my phone|the phone|apps|gallery|notes app)\b/))
    return { text: taffyPick(["The green button opens my phone — 10 apps: me, MSG for friends, Gallery, SOS, Notes, radio, Code, Tutorial, Alerts, and Badges. Tap the \u2014 to minimize me back to the button.", "My phone has 10 apps — Vita Nova (me!), MSG, Gallery, SOS, Notes, radio, Code, Tutorial, Alerts, and Badges. The green call button opens it, the \u2014 button closes it."]), emoji: taffyPickEmoji(["📱", "✨"]), working: false };
  // Shop (where is it)
  if (has(/\bwhere\b.{0,15}\b(shop|store)\b|\b(go to|take me to|visit|open)\b.{0,15}\b(shop|store)\b|\b(shop|store) page\b/))
    return { text: taffyPick(["Hit Shop in the top nav — that's the Rare Candy Reserve store, cards, handhelds, and all.", "The shop is one tap away — Shop in the top nav takes you to the store. Cards, pins, handhelds, the lot."]), emoji: taffyPickEmoji(["🛍️", "🍬"]), working: false };
  // Donate
  if (has(/\b(donate|donation|donations)\b/))
    return { text: taffyPick(["Hit Donate in the top nav — it goes to the shop and keeps this place running. Early supporters get first access to new drops.", "Donate in the top nav. It keeps the lights on here, and early supporters get first access to new drops."]), emoji: taffyPickEmoji(["❤️", "🍬"]), working: false };
  // Layout / theme / customize my page (echoes a color word when they name one)
  if (has(/\blayout|theme|customi[sz]e|my page|profile.*(look|design|color|style)|background|wallpaper\b/)) {
    var cw = taffyColorWord(t);
    if (cw) {
      var cap = cw.charAt(0).toUpperCase() + cw.slice(1);
      return { text: cap + ", got it — that's a great pick. Type it into the mood box in the Layout Bot (like \u201c" + cw + " background\u201d or \u201c" + cw + " buttons\u201d) and I'll build your theme around it. Hit \u201cOpen the Layout Bot\u201d and I'll do the rest.", emoji: taffyPickEmoji(["🎨", "✨"]), working: true };
    }
    return { text: taffyPick(["Let's make your page yours! Hit \u201cOpen the Layout Bot\u201d and I'll build you a theme — pick a vibe, an accent color, and a few mood words. Or open Edit Profile and use the layout presets and custom CSS yourself.", "Oh, I love this part — tell me the vibe and the mood and I'll build you a whole theme. \u201cDark blue background, big headings, round buttons\u201d — that kind of thing. The Layout Bot does the writing."]), emoji: taffyPickEmoji(["🎨", "✨"]), working: true };
  }
  // Code / CSS
  if (has(/\bcode|css|html|javascript|js\b|script|program|develop/))
    return { text: taffyPick(["Code time! Open the Code app on the phone home screen — it opens the layout and custom-CSS editor — and I'll stay open alongside you. Tell me what you're trying to build and I'll point you to the right spot.", "The code editor lives in Edit Profile — your MySpace layout box, with custom CSS and a live preview. Open it from the phone's Code app and I'll hang out while you work."]), emoji: taffyPickEmoji(["💻", "💡"]), working: true };
  // Sell / list / price / money (general)
  if (has(/\bsell|listing|list it|price|pricing|how much|shop|store|earn|make money|marketplace\b/))
    return { text: taffyPick(["Selling here is simple: your page is free, you list what you make or collect, and buyers find you. The Community takes just 6% once — and only once — when the sale completes and you're paid. Need a price? Tell me the item and I'll help you think it through.", "List it, sell it, get paid — that's the whole deal. Your page is free, the Community takes 6% once when the sale completes. If you're stuck on a price, tell me the item and we'll figure it out."]), emoji: taffyPickEmoji(["💰", "🍬"]), working: false };
  // Music / radio / songs
  if (has(/\bmusic|radio|song|track|playlist|listen|play.*music|steady wave|vita nova\b/))
    return { text: taffyPick(["Turn it up! The radio app on the phone plays Steady Wave live, and on your profile you can pick up to 5 A Steady Heart tracks to show off. More licensed songs and public-domain pieces like Canon in D are coming too.", "Steady Wave is live on the radio app — 24/7. And your profile can show off up to 5 A Steady Heart tracks. More songs are coming, licensed and public domain."]), emoji: taffyPickEmoji(["🎵", "🎶"]), working: false };
  // Help (narrowed — specific "how to" questions hit their own intent above)
  if (has(/\bhelp|what can you do|commands|what do you do\b/))
    return { text: taffyPick(["Here's what I'm good at: building you a whole profile from one message — try \u201cmake me a profile with rgb colors and flickering neon buttons\u201d and I'll write the HTML out for you to copy — plus helping with code, showing you how to sell and get paid, filing reports, and playing the radio.", "I can build you a whole profile, help with code, explain selling and payouts, point you to reports, or play the radio. Just ask — \u201cmake me a profile with rgb colors and flickering neon buttons\u201d works too."]), emoji: taffyPickEmoji(["💡", "✨"]), working: false };
  // Thanks (only when that's basically all they said)
  if (wordCount <= 4 && has(/\bthank|thanks|thx|\bty\b|appreciated\b/))
    return { text: taffyPick(["Anytime! That's what I'm here for. Go make something cool.", "You got it! Now go make your page look amazing."]), emoji: taffyPickEmoji(["😊", "💜"]), working: false };
  // Bye (only when that's basically all they said)
  if (wordCount <= 4 && has(/\bbye|goodbye|good night|see you|later|gtg\b/))
    return { text: taffyPick(["Bye for now! I'll be right here in the phone whenever you need me.", "See you soon! I'll be here, probably working on something."]), emoji: taffyPickEmoji(["👋", "🌙"]), working: false };
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
    "Hmm, \u201c" + qw + "\u201d — that's a new one for me. " + steer + ". But we don't support AI customer support here, so let me get you to a human — message Chris, email an admin, or file a report, all right below.",
    "You got me on that one — I don't have \u201c" + qw + "\u201d in my little brain yet. " + steer + ". If you need a real answer now, we don't do AI customer support here — tap below and a human will sort you out.",
    "I'm not sure about \u201c" + qw + "\u201d yet, but I'm learning. " + steer + " — or get a human below, that's what they're for.",
    "Good question, and I don't want to guess — \u201c" + qw + "\u201d isn't something I know yet. " + steer + ". If it's urgent, we don't support AI customer support here, so tap below and reach a human directly."
  ]), emoji: taffyPickEmoji(["🤔", ""]), human: true, working: false };
}
function phoneChatBubbleHTML(m, idx) {
  var cls = m.who === "me" ? "tp-bubble-me" : "tp-bubble-taffy";
  var body = (m.emoji ? esc(m.emoji) + " " : "") + esc(m.text);
  var apply = "";
  if (m.who === "taffy" && (m.css || m.html || m.human)) {
    apply = '<div style="margin-top:8px">';
    if (m.css) apply += '<button type="button" class="btn small" onclick="DWC.taffyApplyCSS(' + idx + ')">✨ Apply this to my layout</button>';
    if (m.css) apply += '<div style="font-size:11px;color:var(--muted);margin-top:4px;word-break:break-all"><code>' + esc(m.css) + '</code></div>';
    if (m.human) apply += '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px"><button type="button" class="btn small" onclick="DWC.imMember(1, \'RareCandyReserve\')">💬 Contact support</button><a class="btn ghost small" href="mailto:TheRarecandyreserve@proton.me?subject=Community%20%E2%80%94%20contact%20an%20admin%20or%20mod">✉️ Email an admin / mod</a><button type="button" class="btn ghost small" onclick="DWC.go(\'reports\')">🚩 File a report</button></div>';
    apply += '</div>';
  }
  return '<div class="tp-bubble ' + cls + '">' + body + apply + '</div>';
}
function phoneChatLogHTML() {
  return state.phoneChat.map(function (m, i) { return phoneChatBubbleHTML(m, i); }).join("");
}
function phoneChatAdd(who, text, emoji, css, html, human) {
  state.phoneChat.push({ who: who, text: text, emoji: emoji || "", css: css || "", html: html || "", human: !!human });
  if (state.phoneChat.length > 60) state.phoneChat.splice(0, state.phoneChat.length - 60);
  var log = document.getElementById("tp-chat-log");
  if (log) {
    log.insertAdjacentHTML("beforeend", phoneChatBubbleHTML({ who: who, text: text, emoji: emoji || "", css: css || "", html: html || "", human: !!human }, state.phoneChat.length - 1));
    while (log.children.length > state.phoneChat.length) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }
}
function phoneTaffyHTML() {
  var chatOpen = !!state.phoneChatOpen;
  return phoneTopbarHTML("Vita Nova") + '<div class="tp-appview tp-taffy-full">' +
    '<div class="tp-taffy" id="dwc-phone-taffy" onclick="DWC.phoneChatClose()">' + taffySVG("taffy", "phone") + '</div>' +
    '<p class="tp-note">Hi, I’m Taffy! I help with layouts, code, and site questions. If I can’t help, I’ll get you to a human — we don’t do AI customer support here.</p>' +
    '<p><button type="button" class="btn ghost small" onclick="DWC.phoneOpenEditor()">Open the code editor →</button></p>' +
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
    rows += '<p class="tp-note">No other members yet — you’re the first one here. Add friends in Edit profile (Top Friends) and they’ll show up here.</p>';
  } else {
    rows += state.phoneMsgList.map(function (m) {
      return '<button type="button" class="tp-contact" onclick="DWC.phoneMsgMember(' + m.id + ', \'' + esc(m.username.replace(/'/g, "")) + '\')">' +
        '<span class="tp-contact-av">' + esc((m.username || "?").slice(0, 1).toUpperCase()) + '</span>' +
        '<span><strong>@' + esc(m.username) + '</strong><em>Tap to message</em></span><span class="tp-contact-go">›</span></button>';
    }).join("");
  }
  return phoneTopbarHTML("MSG — Contacts") + '<div class="tp-appview">' + rows + '</div>';
}
// Gallery visibility (v3.21) — per photo: Private / Public / Friends.
// The delete ✕ sits top-LEFT of the photo, the visibility chip top-RIGHT,
// so nothing overlaps. The picker under each photo always shows the
// current choice, so you can tell at a glance whether a photo is public.
function phoneGalleryVisChip(it, i, noClick) {
  var vis = it.visibility || "private";
  var inner = vis === "public" ? "🌍 Public" : vis === "friends" ? "👥 Friends" : "🔒 Private";
  var cls = vis === "public" ? "tp-vis-public" : vis === "friends" ? "tp-vis-friends" : "tp-vis-private";
  var title = vis === "public" ? "Public — everyone can see it" : vis === "friends" ? "Friends-only" : "Private — only you can see it";
  return '<span class="tp-vis-chip ' + cls + '"' + (noClick ? "" : ' onclick="DWC.phoneGalleryOpen(' + i + ')"') + ' title="' + title + '">' + inner + "</span>";
}
function phoneGalleryVisPicker(it, i) {
  var vis = it.visibility || "private";
  return '<select class="tp-visselect" ' + (it.uploading ? "disabled" : "") + ' onchange="DWC.phoneGallerySetVisibility(' + i + ', this.value)" title="Who can see this photo">' +
    '<option value="private"' + (vis === "private" ? " selected" : "") + '>🔒 Private</option>' +
    '<option value="public"' + (vis === "public" ? " selected" : "") + '>🌍 Public</option>' +
    '<option value="friends"' + (vis === "friends" ? " selected" : "") + '>👥 Friends</option></select>';
}
function phoneGalleryHTML() {
  var items = state.phoneGallery;
  var thumbs = items.length
    ? '<div class="tp-gallery">' + items.map(function (it, i) {
        return '<figure draggable="true" ondragstart="DWC.phoneGalleryDragStart(event,' + i + ')" ondragend="DWC.phoneGalleryDragEnd()" ontouchstart="DWC.phoneGalleryLongStart(' + i + ', this)" ontouchend="DWC.phoneGalleryLongEnd()" ontouchmove="DWC.phoneGalleryLongEnd()" oncontextmenu="return false"><img src="' + esc(it.url) + '" alt="" onclick="DWC.phoneGalleryOpen(' + i + ')"><button type="button" class="tp-gal-del" onclick="DWC.phoneGalleryDel(' + i + ')" title="Delete this photo">✕</button>' + phoneGalleryVisChip(it, i) + '<figcaption>' + esc(it.caption || it.name) + "</figcaption>" +
          (state.profile ? phoneGalleryVisPicker(it, i) + (it.uploading ? '<p class="tp-visstatus">Uploading… 🍬 please wait</p>' : "") : "") + "</figure>";
      }).join("") + "</div>"
    : '<p class="tp-note">No photos here yet — add one below.</p>';
  var storedLine = state.profile
    ? '<p class="tp-note" id="dwc-gallery-stored-count">' + (state.galleryStoredCount == null ? "Your saved photos: loading…" : state.galleryStoredCount + " of 20 photos saved on your profile") + "</p>"
    : "";
  return phoneTopbarHTML("Gallery") + '<div class="tp-appview">' +
    '<p class="tp-note">Session gallery — photos live here for 10 minutes, then they’re gone. Nothing is uploaded to the site until you pick Public or Friends on a photo. Tap a photo to see it big and pick who can see it. Long-hold a photo to delete it; on a computer, drag one to the trash can.</p>' +
    thumbs +
    '<label class="btn small tp-filebtn">+ Add a photo<input type="file" accept="image/*" hidden onchange="DWC.phoneGalleryAdd(this)"></label>' +
    '<p class="tp-note">' + items.length + ' / 6 photos in this session</p>' + storedLine + '</div>';
}
// Gallery photo detail (v3.21) — tap a phone gallery photo to see it big
// and pick who can see it. The ✕ Close sits top-LEFT, opposite the
// visibility chip top-right, so nothing overlaps.
function phoneGalleryPhotoHTML() {
  var it = state.phoneGallery[state.phoneGalleryView];
  if (!it) return phoneTopbarHTML("Gallery") + '<div class="tp-appview"><p class="tp-note">That photo is gone — it may have hit its 10 minutes.</p><p><button type="button" class="btn" onclick="DWC.phoneGo(\'gallery\')">Back to Gallery</button></p></div>';
  var i = state.phoneGalleryView;
  var vis = it.visibility || "private";
  var status = it.uploading
    ? "Uploading… 🍬 please wait"
    : vis === "public"
      ? "✓ Public — visitors can see it on your page"
      : vis === "friends"
        ? "✓ Friends-only — only your friends can see it"
        : "🔒 Private — only you can see it, here in your session gallery";
  return '<div class="tp-appview"><div class="tp-photoview-head"><button type="button" class="tp-min" onclick="DWC.phoneGo(\'gallery\')" title="Close this photo">✕ Close</button><strong>Photo</strong>' + phoneGalleryVisChip(it, i, true) + '</div>' +
    '<div class="tp-photoview"><img src="' + esc(it.url) + '" alt="' + esc(it.name || "Photo") + '"></div>' +
    '<p class="tp-visstatus">' + status + '</p>' +
    (state.profile
      ? '<label class="tp-caption-label">Short description <span style="color:var(--muted)">(shows under the photo — 140 characters max)</span></label>' +
        '<input type="text" class="tp-caption" maxlength="140" placeholder="e.g. My favorite pull — Charizard, mint!" value="' + esc(it.caption || "") + '" oninput="DWC.phoneGalleryCaption(' + i + ', this.value)"' + (it.uploading ? " disabled" : "") + '>' +
        '<p class="tp-caption-count">' + (it.caption || "").length + '/140</p>' +
        '<div class="tp-visrow">' +
        ["private", "public", "friends"].map(function (v) {
          var label = v === "private" ? "🔒 Private" : v === "public" ? "🌍 Public" : "👥 Friends";
          return '<button type="button" class="tp-visbtn' + (vis === v ? " active" : "") + '"' + (it.uploading ? " disabled" : "") + ' onclick="DWC.phoneGallerySetVisibility(' + i + ', \'' + v + '\')">' + label + "</button>";
        }).join("") + "</div>"
      : "") +
    '<p class="tp-note">' + esc(it.name || "photo") + '</p>' +
    (state.profile
      ? '<p><button type="button" class="btn small" onclick="DWC.phoneGallerySetAvatar(' + i + ')"' + (it.uploading ? " disabled" : "") + '>🖼️ Set as profile picture</button> <button type="button" class="btn ghost small" onclick="DWC.phoneGalleryDel(' + i + ')">🗑️ Delete photo</button></p>'
      : "") +
    '</div>';
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
    '<p class="tp-note">One note, yours — saved on your profile, still here when you come back. ' + (state.profile ? "500 characters max." : "Create an account to keep it — right now it only lives in this tab.") + '</p>' +
    '<textarea class="tp-notes" rows="10" maxlength="500" placeholder="Jot it down — a reminder, a price, a code…" oninput="DWC.phoneNotesInput(this)">' + esc(state.phoneNotes) + '</textarea>' +
    '<p class="tp-note" style="margin:4px 0 0"><span id="dwc-notes-count">' + (state.phoneNotes || "").length + '/500</span> · <span id="dwc-notes-saved">' + (state.phoneNotesSavedAt ? "Saved ✓ " + new Date(state.phoneNotesSavedAt).toLocaleTimeString() : (state.profile ? "Saved on your profile" : "Not saved yet")) + '</span></p>' +
    '<p><button type="button" class="btn small" onclick="DWC.phoneNotesCopy()">Copy notes</button> <button type="button" class="btn ghost small" onclick="DWC.phoneNotesClear()">Clear</button></p>' +
    '</div>';
}
// v3.10 — load the member's saved note once (per phone open), then keep
// it in state. Guests keep the old session-only behavior.
async function loadPhoneNotes() {
  if (!state.profile || state.phoneNotesLoaded) return;
  state.phoneNotesLoaded = true;
  try {
    var data = await apiGet("/notes?device_id=" + encodeURIComponent(deviceId()));
    if (data && data.ok && typeof data.note === "string") {
      state.phoneNotes = data.note;
      var ta = document.querySelector(".tp-notes");
      if (ta) ta.value = data.note;
      var c = $("dwc-notes-count");
      if (c) c.textContent = data.note.length + "/500";
    }
  } catch (e) { /* offline or migration not run yet — note stays local */ }
}
function phoneRadioHTML() {
  return phoneTopbarHTML("radio") + '<div class="tp-appview">' +
    '<div class="tp-radio-logo">♪</div>' +
    '<p class="tp-radio-name">Steady Wave</p>' +
    '<p class="tp-note" style="text-align:center">Chris’s station — live, 24/7.</p>' +
    '<audio controls preload="none" onplay="DWC.phoneRadioFirst()" src="' + VNR_STREAM_URL + '"></audio>' +
    '<p class="tp-note"><a href="' + VNR_STREAM_URL + '" target="_blank" rel="noopener">Open the stream in a new tab ↗</a></p>' +
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
// ---------- Alerts app (v3.8) — the same notifications as the header
// bell: mentions, tags, likes, replies, new adds, unfollows, heart
// reacts, comments, and messages. Newest first, unread highlighted.
function phoneNotifKindIcon(kind) {
  switch (kind) {
    case "message": return "💬";
    case "reply": return "↩️";
    case "comment": return "💬";
    case "heart": return "❤️";
    case "like": return "👍";
    case "friend": return "🤝";
    case "favorite": return "⭐";
    case "mention": return "@";
    case "tag": return "🏷️";
    case "follow": return "➕";
    case "unfollow": return "➖";
    case "team": return "🪙";
    default: return "🔔";
  }
}
function phoneNotifTime(ms) {
  if (!ms) return "";
  var diff = Date.now() - Number(ms);
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  return new Date(ms).toLocaleDateString();
}
async function loadPhoneAlerts() {
  if (!state.profile) return;
  var data = await apiGet("/notifications?device_id=" + encodeURIComponent(deviceId()));
  state.phoneAlertsList = (data && data.notifications) || [];
  state.phoneAlertsStamp = Date.now();
  if (state.phone.open && state.phone.app === "alerts") renderPhone();
}
// Notification sound toggle (v3.17) — same localStorage key the header
// bell in site.js uses ("dwc-notif-sound" = "off" disables it), default
// ON. The bell poll owns the coin ding; this switch just controls it.
function phoneNotifSoundOn() {
  try { return localStorage.getItem("dwc-notif-sound") !== "off"; } catch (e) { return true; }
}
function phoneAlertsHTML() {
  var rows = "";
  if (!state.profile) {
    rows = '<p class="tp-note">Create your account to get alerts — Taffy is here either way.</p><p><button type="button" class="btn small" onclick="DWC.phoneMinimize();DWC.openSignup()">Create account — it’s free</button></p>';
  } else if (!state.phoneAlertsList) {
    rows = '<p class="tp-note">Loading alerts…</p>';
    loadPhoneAlerts();
  } else if (!state.phoneAlertsList.length) {
    rows = '<p class="tp-note">No alerts yet — when someone comments, messages, hearts, or mentions you, it’ll show up here.</p>';
  } else {
    // Team pings first (the server already sorts them first — this keeps
    // the list right even if it arrives from an older fetch).
    var sorted = state.phoneAlertsList.slice().sort(function (a, b) {
      var ta = a.kind === "team" ? 0 : 1, tb = b.kind === "team" ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return (b.created_at || 0) - (a.created_at || 0);
    });
    rows = sorted.map(function (n) {
      var isTeam = n.kind === "team";
      return '<button type="button" class="tp-contact' + (n.read ? "" : " tp-notif-unread") + (isTeam ? " tp-notif-team" : "") + '" onclick="DWC.phoneAlertOpen(' + n.id + ', \'' + String(n.link || "").replace(/'/g, "") + '\')">' +
        '<span class="tp-contact-av">' + phoneNotifKindIcon(n.kind) + '</span>' +
        '<span><strong>' + (isTeam ? '<span class="tp-notif-team-tag">Team</span> ' : "") + esc(n.text || "") + '</strong><em>' + phoneNotifTime(n.created_at) + '</em></span><span class="tp-contact-go">›</span></button>';
    }).join("");
  }
  return phoneTopbarHTML("Alerts") + '<div class="tp-appview">' +
    '<p><button type="button" class="btn ghost small" onclick="DWC.phoneAlertsMarkAll()">Mark all read</button> <button type="button" class="btn ghost small" onclick="DWC.phoneAlertsSoundToggle()">' + (phoneNotifSoundOn() ? "🔊 Sound on" : "🔇 Sound off") + '</button></p>' + rows + '</div>';
}
// Badges app (v3.9) — your unlocked badges + the locked ones with what
// earns them. Same list as Edit Profile "Badge display". v3.11 — also
// your achievements: Lucre balance + recent earnings + picture frames,
// unlocked and locked, so one app shows everything you've earned.
function phoneBadgesHTML() {
  var body = "";
  if (!state.profile) {
    body = '<p class="tp-note">Create your account to earn badges — Taffy is here either way.</p><p><button type="button" class="btn small" onclick="DWC.phoneMinimize();DWC.openSignup()">Create account — it’s free</button></p>';
  } else {
    var unlocked = state.profile.unlocked_frames || [];
    var isUnlocked = function (k) { return unlocked.indexOf(k) >= 0; };
    var frameRows = PIC_FRAMES.map(function (f) {
      var un = !f.locked || (f.unlockKey && isUnlocked(f.unlockKey));
      return '<li>' + (un ? "✓ " : "🔒 ") + esc(f.name) + (f.locked && !un && f.requirement ? ' <span style="color:var(--muted);font-size:12px">— ' + esc(f.requirement) + "</span>" : "") + "</li>";
    }).join("");
    var l = state.lucre;
    if (!l) { loadLucre(); }
    var recent = (l && l.ledger ? l.ledger.slice(0, 5) : []).map(function (e) {
      return '<li>' + (e.amount > 0 ? "+" : "") + e.amount + " " + LUCRE_SYMBOL + " · " + esc(e.label || e.reason) + "</li>";
    }).join("");
    body = badgeDisplayListHTML(state.profile.badges || []) +
      '<p class="tp-note">Pick which badge shows next to your name in Edit Profile → Badge display.</p>' +
      '<h4 style="margin:12px 0 4px">🖼️ Picture frames</h4><ul class="dwc-list">' + frameRows + "</ul>" +
      '<h4 style="margin:12px 0 4px">' + LUCRE_SYMBOL + ' Lucre — site only currency</h4>' +
      '<p class="tp-note" style="margin:0 0 4px">Balance: <strong>' + (l ? l.balance : "…") + " " + LUCRE_SYMBOL + '</strong> · not real money, not crypto, can’t cash out.</p>' +
      (recent ? '<ul class="dwc-list">' + recent + "</ul>" : '<p class="tp-note">No earnings yet — post, comment, heart, or check in weekly to start earning.</p>');
  }
  return phoneTopbarHTML("Badges") + '<div class="tp-appview">' + body + '</div>';
}
function phoneScreenHTML() {
  var app = state.phone.app;
  var inner = "";
  if (app === "vitanova") inner = phoneTaffyHTML();
  else if (app === "msg") inner = phoneMsgHTML();
  else if (app === "gallery") inner = phoneGalleryHTML();
  else if (app === "gallery-photo") inner = phoneGalleryPhotoHTML();
  else if (app === "sos") inner = phoneSosHTML();
  else if (app === "notes") inner = phoneNotesHTML();
  else if (app === "radio") inner = phoneRadioHTML();
  else if (app === "code") inner = phoneCodeHTML();
  else if (app === "store") inner = phoneStoreHTML();
  else if (app === "alerts") inner = phoneAlertsHTML();
  else if (app === "badges") inner = phoneBadgesHTML();
  else inner = phoneHomeHTML();
  return '<div class="tp-screen" style="background:' + phoneWallpaperBg(state.phone.wallpaper) + '">' +
    '<div class="tp-statuswrap"><div class="tp-island"></div>' +
    '<div class="tp-status"><span id="tp-clock">' + phoneClockText() + '</span><span class="tp-status-right"><span class="tp-carrier">VNR Wireless ' + TP_SIGNAL_BARS + '</span><span class="tp-status-icons">' + TP_STATUS_ICONS + '</span></span></div></div>' +
    '<div class="tp-body">' + inner + '</div>' +
    '<div class="tp-homebar" onclick="DWC.phoneGo(\'home\')" title="Home"></div>' +
    '</div>';
}
function phoneRenderedKey() {
  return (state.phone.open ? "1" : "0") + "|" + state.phone.app + "|" + state.phone.wallpaper + "|" + state.phoneGallery.length + "|" + state.phoneGallery.map(function (it) { return (it.publicId || "") + ":" + (it.visibility || "private") + ":" + (it.uploading ? "1" : ""); }).join(",") + "|" + (state.phoneGalleryView == null ? "" : state.phoneGalleryView) + "|" + (state.phoneMsgList ? state.phoneMsgList.length : "x") + "|" + (state.phoneAlertsList ? state.phoneAlertsList.length : "x") + "|" + state.phoneAlertsStamp +
    // Lucre + Layout Store (v3.11) — filter, preview, applying, balance,
    // owned, and the current layout all change what the phone shows.
    "|" + (state.storeFilter || "all") + "|" + (state.storePreview || "") + "|" + (state.storeApplying || "") +
    "|" + (state.lucre ? state.lucre.balance : "x") + "|" + (state.lucre ? state.lucre.owned.length : "x") +
    "|" + (state.profile ? (state.profile.layout_preset || "") : "") +
    // v3.21 — saved-photo count, only while the gallery is open: a count
    // change must not rebuild the phone (and restart the radio) while
    // another app is showing.
    "|" + (state.phone.app === "gallery" ? (state.galleryStoredCount == null ? "-" : state.galleryStoredCount) : "-");
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
  fitLayoutMinis();
  // Re-fit the miniatures when the window changes size (phone popup and
  // store grid are fluid) — one listener, debounced.
  if (typeof window !== "undefined" && !window.__dwcMiniResize) {
    window.__dwcMiniResize = true;
    window.addEventListener("resize", function () {
      if (window.__dwcMiniT) clearTimeout(window.__dwcMiniT);
      window.__dwcMiniT = setTimeout(fitLayoutMinis, 120);
    });
  }
}
// v3.21 — drag-to-trash can (desktop gallery): a fixed drop target at
// the bottom of the screen. It lives OUTSIDE the phone root on purpose
// — renderPhone() rewrites the root on every key change, which would
// drop the can mid-drag. Hidden until a drag starts.
function ensureTrashCan() {
  if ($("dwc-trashcan")) return;
  var can = document.createElement("div");
  can.id = "dwc-trashcan";
  can.className = "tp-trashcan";
  can.innerHTML = "🗑️ Drop here to delete";
  can.ondragover = function (e) { e.preventDefault(); can.classList.add("over"); };
  can.ondragleave = function () { can.classList.remove("over"); };
  can.ondrop = function (e) { e.preventDefault(); DWC.phoneGalleryDropTrash(); };
  document.body.appendChild(can);
}
function ensurePhoneRoot() {
  if ($("dwc-phone-root")) return;
  var root = document.createElement("div");
  root.id = "dwc-phone-root";
  document.body.appendChild(root);
  ensureTrashCan();
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

// v3.6 — the per-button customization rows for Edit Profile. Each of
// the 5 action buttons gets a label + a background color + a text color.
// A color only counts when its checkbox is ticked (a color input always
// has a value, so the checkbox is what makes "no custom color" possible).
function profileButtonsRowsHTML(p) {
  var pb = (p && p.profile_buttons) || null;
  var get = function (key) {
    if (pb && pb.buttons && pb.buttons[key]) return pb.buttons[key];
    return { label: "", bg: "", color: "", font: "", size: "", radius: "" };
  };
  var labels = { add: "Add me", message: "Message me", favorite: "Add to Favorites", group: "Add to group" };
  var fontOpts = function (sel) {
    return THEME_FONTS.map(function (f) { return '<option value="' + esc(f.id) + '"' + ((sel || "") === f.id ? " selected" : "") + ">" + esc(f.name) + "</option>"; }).join("");
  };
  var rows = "";
  ["add", "message", "favorite", "group"].forEach(function (key) {
    var b = get(key);
    rows += '<div class="dwc-pb-row"><span class="dwc-pb-key">' + esc(labels[key]) + '</span>' +
      '<input name="pb_label_' + key + '" maxlength="30" value="' + esc(b.label || "") + '" placeholder="' + esc(labels[key]) + '">' +
      '<label class="dwc-pb-color"><input type="checkbox" name="pb_bg_use_' + key + '" style="width:auto"' + (b.bg ? " checked" : "") + '> BG</label>' +
      '<input type="color" name="pb_bg_' + key + '" value="' + (b.bg || "#141424") + '" style="width:48px;height:34px;padding:2px">' +
      '<label class="dwc-pb-color"><input type="checkbox" name="pb_color_use_' + key + '" style="width:auto"' + (b.color ? " checked" : "") + '> Text</label>' +
      '<input type="color" name="pb_color_' + key + '" value="' + (b.color || "#f2f2f8") + '" style="width:48px;height:34px;padding:2px">' +
      // Per-button look (v3.22) — each button's own font, size, and
      // container shape. Defaults follow the page's button size + style;
      // anything picked here wins for that button only. The live preview
      // below the form shows each change as you make it.
      '<label style="font-size:12px;color:var(--muted)">Font <select name="pb_font_' + key + '">' + fontOpts(b.font) + '</select></label>' +
      '<label style="font-size:12px;color:var(--muted)">Size <select name="pb_size_' + key + '">' +
        '<option value=""' + (!(b.size) ? " selected" : "") + '>Default</option>' +
        '<option value="s"' + (b.size === "s" ? " selected" : "") + '>Small</option>' +
        '<option value="l"' + (b.size === "l" ? " selected" : "") + '>Large</option>' +
        '<option value="xl"' + (b.size === "xl" ? " selected" : "") + '>XL</option></select></label>' +
      '<label style="font-size:12px;color:var(--muted)">Shape <select name="pb_radius_' + key + '">' +
        '<option value=""' + (!(b.radius) ? " selected" : "") + '>Default</option>' +
        '<option value="square"' + (b.radius === "square" ? " selected" : "") + '>Square</option>' +
        '<option value="rounded"' + (b.radius === "rounded" ? " selected" : "") + '>Rounded</option>' +
        '<option value="pill"' + (b.radius === "pill" ? " selected" : "") + '>Pill</option></select></label></div>';
  });
  return rows;
}
function profileButtonsSectionHTML(p) {
  var pb = (p && p.profile_buttons) || null;
  var mode = (pb && pb.mode === "image") ? "image" : "buttons";
  var img = (pb && pb.image_url) || "";
  var th = parseThemeClient(p && p.profile_theme);
  var side = (th.buttons_side === "right") ? "right" : "left";
  // v3.21 — Buttons group: size, which show, professional-mode button.
  var btnSize = th.button_size || "";
  var visSet = th.buttons_visible;
  var visOn = function (k) { return !visSet || visSet.indexOf(k) >= 0; };
  var proSide = th.pro_button_side || "";
  var proCol = th.pro_button_color || "";
  return '<div class="dwc-layoutbox" id="dwc-sec-buttons"><h4 style="margin:0 0 6px">🔘 Profile buttons — your action buttons</h4>' +
    "<p style=\"margin:0 0 8px\">These are the buttons visitors see on YOUR page — just four: Add me, Message me, Add to Favorites, Add to group. They sit in a 2×2 block on one side of your page, with your video on the other side. (Only on the standard look — with Website look on, your page shows just a Message button + your video, unless you tick “Show the buttons too” in the Website look box.) Change each one's wording and colors, or put one solid image behind the whole block instead. Reporting lives on posts, comments, and listings now — that's where the 🚩 Report button is.</p>" +
    '<label><input type="checkbox" name="theme_buttons_show" style="width:auto"' + (th.buttons_show !== false ? " checked" : "") + '> Show the buttons on my page (untick to hide the whole block — MySpace-style, your call)</label>' +
    '<label>Buttons side — which side of the page the button block sits on (your video goes on the other side)</label>' +
    '<div class="dwc-presets">' +
    '<button type="button" class="dwc-pill' + (side === "left" ? " active" : "") + '" data-btnsidebtn="left" onclick="DWC.applyButtonsSide(\'left\')">Left</button>' +
    '<button type="button" class="dwc-pill' + (side === "right" ? " active" : "") + '" data-btnsidebtn="right" onclick="DWC.applyButtonsSide(\'right\')">Right</button>' +
    "</div>" +
    '<input type="hidden" name="theme_buttons_side" value="' + esc(side) + '">' +
    '<label><input type="radio" name="pb_mode" value="buttons" style="width:auto"' + (mode === "buttons" ? " checked" : "") + '> Individual buttons — style each one below</label>' +
    '<label><input type="radio" name="pb_mode" value="image" style="width:auto"' + (mode === "image" ? " checked" : "") + '> One solid image — one picture behind the whole button block</label>' +
    '<label>Button-block image URL (https:// — only used with “One solid image”)</label>' +
    '<input name="pb_image_url" maxlength="500" value="' + esc(img) + '" placeholder="https://…">' +
    '<div class="dwc-pb-rows">' + profileButtonsRowsHTML(p) + "</div>" +
    '<h4 style="margin:16px 0 6px">📏 Button size</h4>' +
    '<p style="margin:0 0 8px;color:var(--muted);font-size:13px">How big the buttons on your page are — your action buttons, your link buttons, and the buttons inside your page sections. M is the size everyone sees now. S is the smallest still easy to read; XL is decently large.</p>' +
    '<div class="dwc-presets">' +
    '<button type="button" class="dwc-pill' + (btnSize === "s" ? " active" : "") + '" data-btnsizebtn="s" onclick="DWC.applyButtonSize(\'s\')">S — small</button>' +
    '<button type="button" class="dwc-pill' + (btnSize === "" ? " active" : "") + '" data-btnsizebtn="m" onclick="DWC.applyButtonSize(\'m\')">M — medium (current)</button>' +
    '<button type="button" class="dwc-pill' + (btnSize === "l" ? " active" : "") + '" data-btnsizebtn="l" onclick="DWC.applyButtonSize(\'l\')">L — large</button>' +
    '<button type="button" class="dwc-pill' + (btnSize === "xl" ? " active" : "") + '" data-btnsizebtn="xl" onclick="DWC.applyButtonSize(\'xl\')">XL — extra large</button>' +
    "</div>" +
    '<input type="hidden" name="theme_button_size" value="' + esc(btnSize) + '">' +
    '<h4 style="margin:16px 0 6px">✅ Which buttons show</h4>' +
    '<p style="margin:0 0 8px;color:var(--muted);font-size:13px">Tick only the ones you want — show just “Message me” if you like. Unticking all hides the button block (your video and links still show). The Message button on the professional look always shows — it’s how people reach you.</p>' +
    '<div class="dwc-checkgrid">' +
    [["add", "Add me"], ["message", "Message me"], ["favorite", "Add to Favorites"], ["group", "Add to group"], ["subscribe", "Subscribe (on my shop card)"]].map(function (kv) {
      return '<label><input type="checkbox" name="theme_buttons_visible" value="' + kv[0] + '" style="width:auto"' + (visOn(kv[0]) ? " checked" : "") + "> " + kv[1] + "</label>";
    }).join("") + "</div>" +
    '<h4 style="margin:16px 0 6px">🌐 Professional-mode button</h4>' +
    '<p style="margin:0 0 8px;color:var(--muted);font-size:13px">On the professional (website) look, visitors get one button under your picture. Pick which side it sits on, and its color — big enough to see. (Pick a bigger size above to make it stand out even more.)</p>' +
    '<label>Which side, under your picture</label>' +
    '<div class="dwc-presets">' +
    '<button type="button" class="dwc-pill' + (proSide === "" ? " active" : "") + '" data-prosidebtn="left" onclick="DWC.applyProButtonSide(\'left\')">Left</button>' +
    '<button type="button" class="dwc-pill' + (proSide === "center" ? " active" : "") + '" data-prosidebtn="center" onclick="DWC.applyProButtonSide(\'center\')">Center</button>' +
    '<button type="button" class="dwc-pill' + (proSide === "right" ? " active" : "") + '" data-prosidebtn="right" onclick="DWC.applyProButtonSide(\'right\')">Right</button>' +
    "</div>" +
    '<input type="hidden" name="theme_pro_button_side" value="' + esc(proSide) + '">' +
    '<label>Button color</label>' +
    '<div class="dwc-presets">' +
    [["#ff2d95", "Pink"], ["#00e5ff", "Cyan"], ["#22c55e", "Green"], ["#d4af37", "Gold"], ["#7c4dff", "Purple"], ["#ef4444", "Red"]].map(function (kv) {
      return '<button type="button" class="dwc-pill' + (proCol === kv[0] ? " active" : "") + '" data-procolorbtn="' + kv[0] + '" onclick="DWC.applyProButtonColor(\'' + kv[0] + '\')">' + kv[1] + "</button>";
    }).join("") + "</div>" +
    '<label>Or pick any color</label>' +
    '<input type="hidden" name="theme_pro_button_color" value="' + esc(proCol) + '">' +
    '<input type="color" id="dwc-pro-color-pick" value="' + (proCol || "#ff2d95") + '" style="width:64px;height:36px;padding:2px" onchange="DWC.applyProButtonColor(this.value)"> ' +
    '<span style="color:var(--muted);font-size:13px">Leave it alone to keep the default look.</span>' +
    '<p style="margin:8px 0 0;color:var(--muted);font-size:13px">Leave a label blank to keep the standard wording, and leave a color unticked to keep the default. Colors are #rrggbb; the image must be https://.</p></div>';
}
// v3.10 — one video per profile: a YouTube link OR an uploaded clip.
// Shows opposite the action buttons, and only ever plays when a
// visitor taps it — never autoplay.
function profileVideoSectionHTML(p, th) {
  var yt = (th && th.video_url) || "";
  var file = (th && th.video_file_url) || "";
  var has = yt || file;
  // Video size + centering (v3.22) — the setting sits right next to the
  // video URL, where the video is set. Size "" = Normal (the current
  // size, the default); "s" Small, "l" Big, "stretch" Stretch to fit.
  // The Center button locks the video block in the middle of its spot.
  var vidSize = (th && th.video_size) || "";
  var vidSizeKey = vidSize === "" ? "m" : vidSize;
  var vidAlign = (th && th.video_align) || "";
  return '<div class="dwc-layoutbox" id="dwc-sec-video"><h4 style="margin:0 0 6px">🎬 My video — one video on my page</h4>' +
    "<p style=\"margin:0 0 8px\">One video on your page — your training video, a music video, whatever you like. It sits on the opposite side from your buttons, and it only plays when someone taps it. Paste a YouTube link, or upload a clip — if you upload one, it wins over the link.</p>" +
    '<label>YouTube link — paste a watch, Shorts, or youtu.be link</label>' +
    '<input name="theme_video_url" maxlength="500" value="' + esc(yt) + '" placeholder="https://www.youtube.com/watch?v=…">' +
    '<label>Video size — how big the video is on your page (Normal is the size it is now)</label>' +
    '<div class="dwc-presets">' +
    '<button type="button" class="dwc-pill' + (vidSizeKey === "s" ? " active" : "") + '" data-videosizebtn="s" onclick="DWC.applyVideoSize(\'s\')">Small</button>' +
    '<button type="button" class="dwc-pill' + (vidSizeKey === "m" ? " active" : "") + '" data-videosizebtn="m" onclick="DWC.applyVideoSize(\'m\')">Normal</button>' +
    '<button type="button" class="dwc-pill' + (vidSizeKey === "l" ? " active" : "") + '" data-videosizebtn="l" onclick="DWC.applyVideoSize(\'l\')">Big</button>' +
    '<button type="button" class="dwc-pill' + (vidSizeKey === "stretch" ? " active" : "") + '" data-videosizebtn="stretch" onclick="DWC.applyVideoSize(\'stretch\')">Stretch to fit</button>' +
    "</div>" +
    '<input type="hidden" name="theme_video_size" value="' + esc(vidSize) + '">' +
    '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">Big takes up most of its container area. Stretch to fit scales the video (and the page link under it) to almost exactly the width of the page, with just a small margin. The size moves the video AND the page link under it together, as one block.</p>' +
    '<label>Centering — put the video block back in the middle of its spot</label>' +
    '<div class="dwc-presets">' +
    '<button type="button" class="dwc-pill' + (vidAlign === "center" ? " active" : "") + '" data-videocenterbtn onclick="DWC.applyVideoAlign(\'center\')">🎯 Center video</button>' +
    "</div>" +
    '<input type="hidden" name="theme_video_align" value="' + esc(vidAlign) + '">' +
    '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">The video is centered in its spot by default; Center locks that in, so it stays centered even if a layout you apply would move it. Tap it again to release the lock.</p>' +
    '<label>Or upload a video file (MP4, WebM, or MOV — up to 15 MB, up to 60 seconds)</label>' +
    '<input name="profile_video_file" type="file" accept="video/mp4,video/webm,video/quicktime" onchange="DWC.videoPicked(this)">' +
    '<p id="dwc-video-note" style="margin:4px 0 0;color:var(--muted);font-size:13px">' + (has ? (yt ? "Current video: YouTube — " + esc(yt) : "Current video: uploaded clip") : "No video on your page yet.") + "</p>" +
    '<input type="hidden" name="theme_video_file_url" value="' + esc(file) + '">' +
    (has ? '<label><input type="checkbox" name="remove_video" style="width:auto"> Remove my current video</label>' : "") +
    "</div>";
}
// v3.10 — pick which parts of your page show. MySpace-style: tick to
// HIDE a section. Everything shows unless you hide it here (or Taffy
// hides it for you from a plain-words request).
function profileHideSectionsHTML(p, th) {
  var hidden = (th && th.hide_sections) || [];
  return '<div class="dwc-layoutbox" id="dwc-sec-show"><h4 style="margin:0 0 6px">👀 What shows on my page</h4>' +
    "<p style=\"margin:0 0 8px\">Everything shows unless you tick it off. Untick to bring it back — nothing here deletes anything, it just hides it from visitors.</p>" +
    '<div class="dwc-checkgrid">' +
    SECTION_HIDE_IDS.map(function (k) {
      return '<label><input type="checkbox" name="theme_hide_sections" value="' + k + '" style="width:auto"' + (hidden.indexOf(k) >= 0 ? " checked" : "") + "> Hide " + esc(SECTION_HIDE_LABELS[k]) + "</label>";
    }).join("") + "</div>" +
    '<p style="margin:8px 0 0;color:var(--muted);font-size:13px">Your picture, name, and bio always show. Top Friends only show when you have Top Friends picked; My links only shows when you have links. Hiding Relationship status here hides it even if its Show box is ticked above.</p></div>';
}
// v3.6 — the My page URL section for Edit Profile. Shows the current
// slug, how many of the 3 changes are used, and the next-change date
// when the 1-year cooldown (or the 3-change limit) is in force. The
// input is disabled while locked, and an Appeal button files a
// slug_appeal report so Chris sees it in the Reports inbox.
function pageSlugSectionHTML(p) {
  var slug = (p && p.page_slug) || "";
  var changes = (p && typeof p.page_slug_changes === "number") ? p.page_slug_changes : 0;
  var nextAt = (p && p.page_slug_next_change_at) ? new Date(p.page_slug_next_change_at).getTime() : 0;
  var locked = nextAt > Date.now();
  var nextDate = locked ? new Date(nextAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
  var html = '<div class="dwc-layoutbox"><h4 style="margin:0 0 6px">🔗 My page URL</h4>' +
    "<p style=\"margin:0 0 8px\">Your own page address — e.g. <strong>rarecandyreserve.org/community.html#/u/newuser420</strong>. 3–24 letters, numbers, _ . or -. You get 3 changes per 5 years, with a 1-year cooldown after each change.</p>" +
    '<label>Your page URL slug</label>' +
    '<input name="page_slug" maxlength="24" value="' + esc(slug) + '" placeholder="newuser420"' + (locked ? " disabled" : "") + ">" +
    '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">Changes used: <strong>' + changes + ' of 3</strong>' +
    (locked ? ' · You can change it again on <strong>' + esc(nextDate) + '</strong>.' : "") + "</p>";
  if (locked) {
    html += '<p style="margin:8px 0 0"><button type="button" class="btn ghost small" onclick="DWC.appealSlug()">Appeal for another change</button></p>' +
      '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">Appeals go to Chris — tell him the URL you want and why.</p>';
  }
  html += "</div>";
  return html;
}

// v3.9 — picture frame picker: 11 frames, locked ones greyed out with
// their requirement. p.unlocked_frames comes from the profile GET.
function picFramePickerHTML(p, th) {
  var unlocked = (p && p.unlocked_frames) || [];
  var current = th.pic_frame || "none";
  return PIC_FRAMES.map(function (f) {
    var isLocked = f.locked && unlocked.indexOf(f.unlockKey) < 0;
    var label = esc(f.name) + (f.desc ? " — " + esc(f.desc) : "");
    if (isLocked) label = "🔒 " + esc(f.name) + " — unlock: " + esc(f.requirement);
    return '<button type="button" class="dwc-pill' + (current === f.id ? " active" : "") + '"' + (isLocked ? " disabled" : "") + ' data-picframebtn="' + f.id + '" onclick="DWC.applyPicFrame(\'' + f.id + '\')">' + label + "</button>";
  }).join("");
}
// v3.9 — preset backgrounds picker (swatch + name).
function presetBackgroundsHTML(th) {
  var current = th.bg_preset || "";
  return PRESET_BACKGROUNDS.map(function (pr) {
    return '<button type="button" class="dwc-pill' + (current === pr.id ? " active" : "") + '" data-bgpresetbtn="' + pr.id + '" onclick="DWC.applyBgPreset(\'' + pr.id + '\')">' +
      '<span class="dwc-bg-swatch" style="background:' + pr.swatch + '"></span> ' + esc(pr.name) + (pr.desc ? ' <span style="color:var(--muted);font-size:12px">— ' + esc(pr.desc) + "</span>" : "") + "</button>";
  }).join("");
}
// v3.9 — website-look fields: each of the five has its own show checkbox.
function websiteFieldsHTML(p) {
  var show = (p && p.website_show) || {};
  var th = parseThemeClient(p && p.profile_theme);
  var val = function (k) { return p ? esc(p[k] || "") : ""; };
  var chk = function (k) { return show[k] ? " checked" : ""; };
  var signs = Object.keys(ZODIAC_SIGNS).map(function (id) {
    return '<option value="' + id + '"' + (p && p.birthsign === id ? " selected" : "") + ">" + ZODIAC_SIGNS[id].symbol + " " + esc(ZODIAC_SIGNS[id].name) + "</option>";
  }).join("");
  return '<div class="dwc-layoutbox"><h4 style="margin:0 0 6px">🌐 Website look — make my profile look like a real website</h4>' +
    "<p style=\"margin:0 0 8px\">Website look is the professional mode — the opposite of the MySpace look. It turns your profile into your own clean standalone website: your banner as the header at the top, just a Message link for contact, your shop listings, and nothing else cluttering it up. The personal bits below (hobbies, where you work, relationship status, sign, accomplishments) stay hidden while this is on. MySpace mode shows everything, arranged like a MySpace profile. Top Friends hide in this mode.</p>" +
    '<label class="dwc-enable-toggle"><input type="checkbox" name="website_mode" style="width:auto"' + (p && p.website_mode ? " checked" : "") + '> <span>🌐 Website look — click to enable button</span></label>' +
    '<label class="dwc-enable-toggle"><input type="checkbox" name="theme_website_buttons" style="width:auto"' + (th.website_buttons ? " checked" : "") + '> <span>Show the Add me / Favorite / Add to group buttons too (otherwise visitors just get the Message link)</span></label>' +
    '<label>Contact email — the email visitors can reach you at (only shows on your page if you tick Show below)</label>' +
    '<input type="email" name="contact_email" maxlength="120" value="' + val("contact_email") + '" placeholder="you@example.com">' +
    '<label class="dwc-enable-toggle"><input type="checkbox" name="show_contact_email" style="width:auto"' + (p && p.show_contact_email ? " checked" : "") + '> <span>Show my contact email on my page</span></label>' +
    '<label><input type="checkbox" name="website_show_hobbies" style="width:auto"' + chk("hobbies") + '> Show my Hobbies</label>' +
    '<label>Hobbies</label><input name="hobbies" maxlength="200" value="' + val("hobbies") + '" placeholder="e.g. collecting, 3D printing, making music">' +
    '<label><input type="checkbox" name="website_show_workplace" style="width:auto"' + chk("workplace") + '> Show where I work</label>' +
    '<label>Where I work</label><input name="workplace" maxlength="120" value="' + val("workplace") + '" placeholder="e.g. Rare Candy Reserve">' +
    '<label><input type="checkbox" name="website_show_relationship" style="width:auto"' + chk("relationship") + '> Show Single or in a relationship</label>' +
    '<label>Single or in a relationship</label><select name="relationship_status"><option value="">— pick one —</option>' +
    ["Single", "In a relationship", "It's complicated", "Prefer not to say"].map(function (r) { return '<option' + (p && p.relationship_status === r ? " selected" : "") + ">" + esc(r) + "</option>"; }).join("") + "</select>" +
    '<label><input type="checkbox" name="website_show_sign" style="width:auto"' + chk("sign") + '> Show my Sign</label>' +
    '<label>Sign</label><select name="birthsign"><option value="">— pick your sign —</option>' + signs + "</select>" +
    '<label><input type="checkbox" name="website_show_accomplishments" style="width:auto"' + chk("accomplishments") + '> Show my Recent accomplishments</label>' +
    '<label>Recent accomplishments</label><textarea name="accomplishments" rows="3" maxlength="500" placeholder="What have you pulled off lately?">' + val("accomplishments") + "</textarea>" +
    '<h4 style="margin:14px 0 6px">🌐 Custom page — your own code IS the page</h4>' +
    '<p style="margin:0 0 6px;color:var(--muted);font-size:13px">Write your own page here — HTML for the words and pictures, and your CSS in the code box below for how it looks. When Website look is on and this box has something in it, this code IS your page (it replaces the MySpace columns — your listings and message link still show below it). Scripts and iframes are stripped out for safety — plain HTML only.</p>' +
    '<textarea name="custom_page_html" rows="8" maxlength="8000" placeholder="e.g. Welcome to my shop — cards, prints, and more." oninput="DWC.customPagePreview(this)">' + esc(th.custom_page_html || "") + '</textarea>' +
    '<div id="dwc-custompage-preview" style="margin-top:8px"></div>' +
    '<p style="margin:8px 0 0;color:var(--muted);font-size:13px">Page comments are optional on a professional page too — hide them from “What shows on my page” below if you don\'t want them.</p></div>';
}

function profileFormHTML(p) {
  var isNew = !p;
  var v = function (k) { return p ? esc(p[k] || "") : ""; };
  // v3.2 theme pickers — parsed + validated (hex colors, https image,
  // allowlisted font); all empty unless the member opted in.
  var th = parseThemeClient(p && p.profile_theme);
  return '<section class="card" aria-label="' + (isNew ? "Create your account" : "Edit your profile") + '">' +
    "<h3 style=\"margin-top:0\">" + (isNew ? "Create your account — it’s free" : "Edit your profile") + "</h3>" +
    (isNew ? '<p style="color:var(--muted);margin-top:0">Just 4 things and you’re in — username, birthday, your name, and a quick human check. Picture, bio, links, layout, and payout can all wait until after — hit Edit profile any time.</p><p style="color:var(--green);font-weight:700;margin-top:0">Free to join — no ID needed. Selling regular stuff never needs an ID. ID is only ever asked for adult content and digital assets.</p>' : "") +
    '<form onsubmit="DWC.saveProfile(this); return false;" oninput="DWC.profileFormDirty();DWC.refreshLayoutPreviewSoon()" onchange="DWC.profileFormDirty();DWC.refreshLayoutPreviewSoon()">' +
    (isNew ? "" :
    '<p class="dwc-editnav" style="margin:0 0 12px;color:var(--muted);font-size:13px">Jump to: <a href="#dwc-sec-picture">Picture</a> · <a href="#dwc-sec-ticker">Ticker</a> · <a href="#dwc-sec-links">Links</a> · <a href="#dwc-sec-top8">Top Friends</a> · <a href="#dwc-sec-buttons">Buttons</a> · <a href="#dwc-sec-video">Video</a> · <a href="#dwc-sec-show">What shows</a> · <a href="#dwc-sec-sell">Selling</a> · <a href="#dwc-sec-layout">Make it yours</a> · <a href="#dwc-sec-taffy">Taffy</a> · <a href="#dwc-sec-badges">Badges</a></p>' +
    '<p id="dwc-unsaved-note" class="dwc-unsaved" hidden>✏️ You have unsaved changes — hit <strong>Save profile</strong> at the bottom to keep them. Nothing saves until you do.</p>') +
    '<label>Username (2–24 letters, numbers, _ . -)</label>' +
    '<input name="username" required minlength="2" maxlength="24" value="' + v("username") + '" placeholder="Your shop name / username">' +
    // Basic account: new signups only see the essentials. Everything
    // optional (chat name, bio, payout, picture, banner, ticker, links,
    // layout, music, buttons, page URL) lives in Edit profile after.
    (isNew ? "" :
    '<label>Chat name (shown in Live Chat — defaults to your username)</label>' +
    '<input name="chat_name" maxlength="24" value="' + v("chat_name") + '" placeholder="What should chat call you?">' +
    '<label>Occupation (optional)</label>' +
    '<input name="occupation" maxlength="60" value="' + v("occupation") + '" placeholder="What do you do?">' +
    '<label>About you / your shop</label>' +
    '<textarea name="bio" maxlength="280" placeholder="What do you collect and sell?">' + v("bio") + "</textarea>") +
    '<label>Birthday — month / day only shows publicly, never the year' + (isNew ? " (required — one account per person)" : "") + "</label>" +
    '<input name="birthday" type="date" value="' + (p && p.birthday ? esc(p.birthday) : "") + '"' + (isNew ? " required" : "") + ">" +
    (isNew ? "" :
    '<label>Payout method (how you want to be paid — needed to sell)</label>' +
    '<input name="payout_method" maxlength="40" value="' + v("payout_method") + '" placeholder="e.g. PayPal, Cash App, Chime…">' +
    '<label>Payout handle</label>' +
    '<input name="payout_handle" maxlength="80" value="' + v("payout_handle") + '" placeholder="Your handle / address on that method">' +
    '<label id="dwc-sec-picture">📸 Profile picture — Shrink my photo for profile size</label>' +
    '<p style="margin:0 0 4px;color:var(--muted);font-size:13px">Pick any JPG, PNG, WebP, or GIF — we shrink it to profile size (512px, same ratio) and convert it to JPEG automatically (a GIF becomes a still image). iPhone HEIC photos can\'t be read by the browser — screenshot the photo and use that. A personal photo is optional; an avatar or none is fine.</p>' +
    '<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange="DWC.avatarPicked(this)">' +
    '<p id="dwc-avatar-note" style="margin:4px 0 0;color:var(--muted);font-size:13px"></p>' +
    (p && p.avatar_url ? '<label><input type="checkbox" name="remove_avatar" style="width:auto"> Remove my current picture</label>' : "") +
    '<label>Picture size — how big your picture shows on your page</label>' +
    '<div class="dwc-presets">' +
    '<button type="button" class="dwc-pill' + (th.pic_size !== "smaller" ? " active" : "") + '" data-picsizebtn="bigger" onclick="DWC.applyPicSize(\'bigger\')">Bigger</button>' +
    '<button type="button" class="dwc-pill' + (th.pic_size === "smaller" ? " active" : "") + '" data-picsizebtn="smaller" onclick="DWC.applyPicSize(\'smaller\')">Smaller</button>' +
    '</div>' +
    '<input type="hidden" name="theme_pic_size" value="' + esc(th.pic_size || "bigger") + '">' +
    '<label>Picture position — where your picture sits</label>' +
    '<div class="dwc-presets">' +
    '<button type="button" class="dwc-pill' + (th.pic_position !== "top" ? " active" : "") + '" data-picposbtn="normal" onclick="DWC.applyPicPosition(\'normal\')">Normal — banner on top, picture below</button>' +
    '<button type="button" class="dwc-pill' + (th.pic_position === "top" ? " active" : "") + '" data-picposbtn="top" onclick="DWC.applyPicPosition(\'top\')">On top — picture first, banner below it</button>' +
    '</div>' +
    '<input type="hidden" name="theme_pic_position" value="' + esc(th.pic_position || "normal") + '">' +
    '<label>🖼️ Picture frame — the ring around your picture (tap your picture on your page to enlarge it and comment)</label>' +
    '<p style="margin:0 0 8px;color:var(--muted);font-size:13px">Some frames unlock as you use the site — post, comment, and show up daily to earn them. Locked frames are greyed out with what they need.</p>' +
    '<div class="dwc-presets">' + picFramePickerHTML(p, th) + "</div>" +
    '<input type="hidden" name="theme_pic_frame" value="' + esc(th.pic_frame || "none") + '">' +
    '<div id="dwc-blood-row"' + (th.pic_frame === "blood" ? "" : " hidden") + '><label>Drip color — pick any color for the blood / ooze</label>' +
    '<input name="theme_blood_color" type="color" value="' + esc(/^#[0-9a-fA-F]{6}$/.test(th.blood_color || "") ? th.blood_color : "#c41e1e") + '" style="width:64px;height:36px;padding:2px"></div>' +
    '<div id="dwc-gb-row"' + ((th.pic_frame === "gb" || th.pic_frame === "gba") ? "" : " hidden") + '><label>Handheld colors</label>' +
    '<select name="theme_gb_mode" onchange="DWC.gbModeChanged(this)">' + GB_FRAME_MODES.map(function (gm) { return '<option value="' + gm.id + '"' + (th.gb_mode === gm.id ? " selected" : "") + ">" + esc(gm.name) + "</option>"; }).join("") + "</select>" +
    '<div id="dwc-gb-custom"' + (th.gb_mode === "custom" ? "" : " hidden") + '><label>Your 3 colors — they blend into the handheld body</label>' +
    '<div class="dwc-rowform">' +
    [0, 1, 2].map(function (i) { return '<input name="theme_gb_color_' + i + '" type="color" value="' + esc((th.gb_colors && th.gb_colors[i]) || ["#5a5fcf", "#7c4dff", "#1a1a2e"][i]) + '" style="width:64px;height:36px;padding:2px">'; }).join("") +
    "</div></div></div>") +
    // v3.7 — banner / cover photo (centered at the top of the page) +
    // optional custom-text ticker (above the main page; the name stays put).
    (isNew ? "" :
    '<label>🖼️ Banner / cover photo — shows centered at the top of your page</label>' +
    '<p style="margin:0 0 4px;color:var(--muted);font-size:13px">Pick any JPG, PNG, WebP, or GIF — we shrink it to fit across the top of your page. A banner is optional. A wide picture stretches across the top like a cover photo; a small or square one stays centered and small, like a logo.</p>' +
    '<input name="banner" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange="DWC.bannerPicked(this)">' +
    '<div id="dwc-banner-preview" style="margin-top:8px">' + (p && p.banner_url ? '<div class="dwc-banner"><img src="' + esc(p.banner_url) + '" alt="Current banner" onload="DWC.bannerFit(this)"></div>' : "") + '</div>' +
    (p && p.banner_url ? '<label><input type="checkbox" name="remove_banner" style="width:auto"> Remove my current banner</label>' : "") +
    // Cover photo + name placement (v3.22) — the top picture can be a
    // tall cover area or just a small picture, and the name can sit
    // under it (how it is now) or to the left or right of it. Small +
    // under = exactly the current look. The ticker always stays visible
    // below the picture — a Big cover never covers it.
    '<label>Cover photo — how big the top picture is</label>' +
    '<div class="dwc-presets">' +
    '<button type="button" class="dwc-pill' + ((th.cover_size || "") !== "big" ? " active" : "") + '" data-coversizebtn="small" onclick="DWC.applyCoverSize(\'small\')">Small picture</button>' +
    '<button type="button" class="dwc-pill' + ((th.cover_size || "") === "big" ? " active" : "") + '" data-coversizebtn="big" onclick="DWC.applyCoverSize(\'big\')">Big cover photo</button>' +
    "</div>" +
    '<input type="hidden" name="theme_cover_size" value="' + esc(th.cover_size || "") + '">' +
    '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">Big makes the top picture a tall cover area taking up almost the whole top of your page — the ticker stays visible below it. Small is the picture how it is now.</p>' +
    '<label>Name placement — where your name shows, next to the top picture</label>' +
    '<div class="dwc-presets">' +
    '<button type="button" class="dwc-pill' + ((th.cover_name || "") === "" ? " active" : "") + '" data-covernamebtn="under" onclick="DWC.applyCoverName(\'under\')">Under the picture</button>' +
    '<button type="button" class="dwc-pill' + ((th.cover_name || "") === "left" ? " active" : "") + '" data-covernamebtn="left" onclick="DWC.applyCoverName(\'left\')">Left of the picture</button>' +
    '<button type="button" class="dwc-pill' + ((th.cover_name || "") === "right" ? " active" : "") + '" data-covernamebtn="right" onclick="DWC.applyCoverName(\'right\')">Right of the picture</button>' +
    "</div>" +
    '<input type="hidden" name="theme_cover_name" value="' + esc(th.cover_name || "") + '">' +
    '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">Under is how it is now — your name sits below the picture. Left or right puts your name beside it instead. (On the standard look — Website look keeps its own banner header.)</p>' +
    '<label id="dwc-sec-ticker">📜 Ticker — optional scrolling text above your page</label>' +
    '<p style="margin:0 0 4px;color:var(--muted);font-size:13px">Type your own text (up to 200 characters) and it scrolls above your page — or pick Bitcoin and it shows the live price instead, updating every minute. Your name stays put — it never scrolls.</p>' +
    '<label>What the ticker shows</label><select name="theme_ticker_source">' +
    '<option value=""' + (th.ticker_source !== "btc" ? " selected" : "") + '>My own words (below)</option>' +
    '<option value="btc"' + (th.ticker_source === "btc" ? " selected" : "") + '>₿ Live Bitcoin price (updates every minute — needs CoinGecko to answer; if it can’t, your own words show instead)</option></select>' +
    '<input name="ticker_text" maxlength="200" value="' + esc(p ? (p.ticker_text || "") : "") + '" placeholder="e.g. New drops every Friday — check the Flea Market!">' +
    '<label><input type="checkbox" name="ticker_enabled" style="width:auto"' + (p && p.ticker_enabled ? " checked" : "") + '> Show the ticker on my page</label>' +
    '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">Tick this AND type your own words below, or pick Bitcoin above — the ticker only shows when it’s ticked and has something to show.</p>' +
    '<label>Ticker color</label>' +
    '<input name="ticker_color" type="color" value="' + esc((p && /^#[0-9a-fA-F]{6}$/.test(p.ticker_color || "")) ? p.ticker_color : "#00e5ff") + '" style="width:64px;height:36px;padding:2px">') +
    (isNew ? "" :
    '<div class="dwc-layoutbox" id="dwc-sec-links"><h4 style="margin:0 0 6px">🔗 My links — buttons on your page</h4>' +
    "<p style=\"margin:0 0 8px\">Add links that show as buttons on your member page — your shop, Instagram, whatever. Up to 6. A label, a full link starting with http:// or https://, and a button style just for that link. A link’s own style wins over your page’s button style — but your My Code CSS can still override it with !important (may cause a link’s button style to not work properly).</p>" +
    '<div id="dwc-links-list">' + myLinksRowsHTML(p ? (p.my_links || []) : []) + '</div>' +
    '<p style="margin:8px 0 0"><button type="button" class="btn ghost small" onclick="DWC.addLinkRow()">+ Add a link</button> <span id="dwc-links-count" style="color:var(--muted);font-size:13px">' + ((p && p.my_links || []).length) + '/6</span></p></div>') +
    (isNew ? "" :
      '<div class="dwc-layoutbox" id="dwc-sec-top8"><h4 style="margin:0 0 6px">🌟 Top Friends — your Top Friends</h4>' +
      "<p style=\"margin:0 0 8px\">MySpace-style: pick up to 10 friends to show on your page. Thanks for the add — now show it off. They sit in the right-hand column of your page by default, above your page comments. They don’t show in Website look — your page is a website then, not a MySpace page.</p>" +
      '<label>How many Top Friends to show</label><select name="theme_topfriends_count">' + [3, 4, 5, 8, 10].map(function (n) { return '<option value="' + n + '"' + ((th.topfriends_count || 8) === n ? " selected" : "") + ">" + (n === 10 ? "Top 10" : n === 8 ? "Top 8" : "Top " + n) + "</option>"; }).join("") + "</select>" +
      '<label>Top Friends side — which side of your page the Top Friends column sits on (your info goes on the other side)</label>' +
      '<div class="dwc-presets">' +
      '<button type="button" class="dwc-pill' + (th.topfriends_side !== "left" ? " active" : "") + '" data-tfsidebtn="right" onclick="DWC.applyTopFriendsSide(\'right\')">Right</button>' +
      '<button type="button" class="dwc-pill' + (th.topfriends_side === "left" ? " active" : "") + '" data-tfsidebtn="left" onclick="DWC.applyTopFriendsSide(\'left\')">Left</button>' +
      "</div>" +
      '<input type="hidden" name="theme_topfriends_side" value="' + esc(th.topfriends_side === "left" ? "left" : "right") + '">' +
      '<div id="dwc-topfriends-picker"><p style="color:var(--muted)">Loading members…</p></div>' +
      '<p class="dwc-minihead">Picked: <span id="dwc-top8-count">0</span>/10</p></div>') +
    (isNew ? "" : profileButtonsSectionHTML(p)) +
    (isNew ? "" : profileVideoSectionHTML(p, th)) +
    (isNew ? "" : profileHideSectionsHTML(p, th)) +
    (isNew ? "" : pageSlugSectionHTML(p)) +
    (isNew ? "" :
    '<div class="dwc-layoutbox" id="dwc-sec-sell"><h4 style="margin:0 0 6px">🎨 What I sell — your creator card</h4>' +
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
    '<div class="dwc-layoutbox" id="dwc-sec-buy"><h4 style="margin:0 0 6px">🔍 What I’m after — as a buyer</h4>' +
    "<p style=\"margin:0 0 8px\">Powers Find a Buyer. Same deal — only these fields are shown.</p>" +
    '<label>Content types I want</label><div class="dwc-checkgrid">' + CREATOR_GENRES.map(function (g) {
      return '<label><input type="checkbox" name="buyer_types" value="' + esc(g) + '" style="width:auto"' + ((p && p.buyer_types || []).includes(g) ? " checked" : "") + "> " + esc(g) + "</label>";
    }).join("") + "</div>" +
    '<label>Tags I’m after (comma separated, up to 8)</label>' +
    '<input name="buyer_tags" maxlength="240" value="' + esc(p ? (p.buyer_tags || []).join(", ") : "") + '" placeholder="e.g. cosplay, amateur">' +
    '<label>My budget — up to ($)</label>' +
    '<input name="buyer_budget" type="number" step="1" min="0" max="100000" value="' + Math.round(((p && p.buyer_budget_max_cents) || 0) / 100) + '"></div>') +
    (isNew ? "" :
      '<div class="dwc-layoutbox" id="dwc-sec-radio"><h4 style="margin:0 0 6px">📻 Steady Wave</h4>' +
      "<p style=\"margin:0 0 8px\">The live station stream on your page — one button, SteadyWave Live.</p>" +
      '<label><input type="checkbox" name="show_vnr_player" style="width:auto"' + (p && p.show_vnr_player ? " checked" : "") + '> 📻 Show Steady Wave player on my profile</label>' +
      '<label><input type="checkbox" name="autoplay_vnr" style="width:auto"' + (p && p.autoplay_vnr ? " checked" : "") + '> ▶️ Autoplay the Steady Wave player when someone visits my page</label>' +
      '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">Autoplay only starts after a visitor taps something on your page — browsers won’t start sound on their own.</p>' +
      '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">A small live player for the Steady Wave stream shows on your page. It just streams the station — no track selection, no playlist.</p></div>') +
    (isNew ? "" :
    '<div class="dwc-layoutbox" id="dwc-sec-layout"><h4 style="margin:0 0 6px">🎨 Make it yours — layout, colors &amp; code</h4>' +
    "<p style=\"margin:0 0 8px\">This is the styling area — everything here changes how YOUR page looks, and nothing else. Three ways to do it: <strong>1)</strong> pick a preset below, <strong>2)</strong> use the pickers (background, colors, font, button style, effects), or <strong>3)</strong> paste your own CSS in the code box. Your layout shows on <strong>your page only</strong> — it never touches anyone else's. They can fight each other — a preset background wins over your vibe's background, and your own color, font, and button picks win over a preset or a vibe. The notes next to each picker say what wins. The live preview at the bottom shows what visitors see.</p>" +
    '<div class="dwc-presets">' +
    '<button type="button" class="dwc-pill' + (v("layout_preset") === "" ? " active" : "") + '" data-presetbtn="" onclick="DWC.applyLayoutPreset(\'\')">None</button>' +
    LAYOUT_PRESETS.map(function (pr) {
      return '<div class="dwc-preset-card">' + layoutMiniHTML({ id: "preset:" + pr.id, css: pr.css, theme: pr.theme || {} }, 280, true) +
        '<button type="button" class="dwc-pill' + (v("layout_preset") === pr.id ? " active" : "") + '" data-presetbtn="' + pr.id + '" onclick="DWC.applyLayoutPreset(\'' + pr.id + '\')">' + esc(pr.name) + "</button></div>";
    }).join("") + "</div>" +
    '<label>💻 My Code — your own CSS, hand-written by you</label>' +
    '<p style="margin:0 0 6px;color:var(--muted);font-size:13px">This is YOUR code box — paste a MySpace layout’s CSS here, or write your own. Taffy can’t write code, and nobody else’s code goes here: what you type is what shows. Rules only ever restyle YOUR page — start every rule with <code>.dwc-myprofile</code> and it stays on your page. Your vibe + color/font picks still win over this CSS — add !important to force it.</p>' +
    '<textarea name="layout_css" rows="8" maxlength="8000" placeholder="e.g. .dwc-myprofile{background:#003399;} .dwc-myprofile .card{border:2px solid #fff;}" oninput="DWC.layoutCssEdited(this)">' + v("layout_css") + "</textarea>" +
    '<p style="margin:6px 0 0"><span id="dwc-mycode-count" style="color:var(--muted);font-size:13px"></span> <button type="button" class="btn ghost small" onclick="DWC.copyMyCode()">📋 Copy my code</button></p>' +
    '<div class="dwc-layoutbox" style="margin-top:10px"><h4 style="margin:0 0 6px">📣 Share it as a layout</h4>' +
    "<p style=\"margin:0 0 8px\">Publish the CSS in this box as a free layout in Taffy’s Layout Store, with your name on it. Other members can grab it with a code. It stays free — priced layouts are the shop’s only.</p>" +
    '<input id="dwc-publish-name" maxlength="40" placeholder="Layout name — e.g. Midnight Bubblegum">' +
    '<input id="dwc-publish-desc" maxlength="120" placeholder="One line about it (optional)" style="margin-top:6px">' +
    '<p style="margin:8px 0 0"><button type="button" class="btn small" onclick="DWC.publishLayout()">📣 Publish as a layout</button> <span style="color:var(--muted);font-size:13px">Publishes this box’s CSS with your saved look. You can take it down from the store later.</span></p></div>' +
    '<input type="hidden" name="layout_preset" value="' + v("layout_preset") + '">' +
    "<p class=\"dwc-limits\">Limits, plain and simple: <strong>CSS only</strong> — no &lt;script&gt;, no @import, no external stylesheets or fonts. Images inside url() must be https://. position:fixed is treated as absolute so a layout can't cover the site. An old MySpace layout's CSS works as far as plain CSS goes — anything that needs scripts or outside files won't. Your layout targets the hooks <code>.dwc-myprofile</code>, <code>.card</code>, <code>h2/h3</code>, <code>a</code>, <code>.dwc-avatar</code>, <code>.btn</code>, <code>.dwc-topfriend</code>.</p>" +
    '<h4 style="margin:14px 0 6px">🖼️ Page background — pick ONE: a preset, your own picture, or None</h4>' +
    "<p style=\"margin:0 0 8px\">These three are either/or — picking one turns the others off, so a preset can never sit on top of your picture again. Your background color below still shows behind a picture (or on its own).</p>" +
    '<p id="dwc-bg-now" style="margin:0 0 4px;font-size:13px"><strong>Showing now:</strong> ' + (th.bg_image_url ? "your picture" : th.bg_preset ? "preset “" + esc((PRESET_BACKGROUNDS.filter(function (pr) { return pr.id === th.bg_preset; })[0] || {}).name || th.bg_preset) + "”" : "no picture or preset — your background color / vibe shows") + '</p>' +
    '<p id="dwc-bg-note" style="margin:0 0 8px;color:var(--muted);font-size:13px"></p>' +
    '<div class="dwc-presets">' + presetBackgroundsHTML(th) +
    '<button type="button" class="dwc-pill' + (th.bg_preset ? "" : " active") + '" data-bgpresetbtn="" onclick="DWC.applyBgPreset(\'\')">None — no preset</button></div>' +
    '<label>Your own picture — paste an image URL (https://), or use your banner below</label>' +
    '<input name="theme_bg_image" maxlength="500" value="' + esc(th.bg_image_url) + '" placeholder="https://…" oninput="DWC.bgImageChanged(this)">' +
    '<p style="margin:6px 0 0"><button type="button" class="btn ghost small" onclick="DWC.useBannerAsBackground()">🖼️ Use my banner as the background</button></p>' +
    '<input type="hidden" name="theme_bg_preset" value="' + esc(th.bg_preset || "") + '">' +
    '<h4 style="margin:14px 0 6px">🎨 My page theme — colors, background &amp; font</h4>' +
    "<p style=\"margin:0 0 8px\">Pickers only — nothing changes unless you tick a box or pick something. These sit on top of your preset and your vibe — a pick here wins over the vibe for that one thing. Your custom CSS can still override them with !important.</p>" +
    '<div class="dwc-themebox">' +
    '<label><input type="checkbox" name="theme_bg_use" style="width:auto"' + (th.bg_color ? " checked" : "") + '> Use a custom background color (overrides your vibe’s background)</label>' +
    '<input type="color" name="theme_bg_color" value="' + (th.bg_color || "#12002e") + '" style="width:64px;height:40px;padding:2px">' +
    '<p style="margin:0 0 6px;color:var(--muted);font-size:13px">Your background picture lives in the “Page background” group above — pick a preset, a picture, or None, one at a time, so nothing can cover it up.</p>' +
    '<label><input type="checkbox" name="theme_text_use" style="width:auto"' + (th.text_color ? " checked" : "") + '> Use a custom text color (overrides your vibe’s text)</label>' +
    '<input type="color" name="theme_text_color" value="' + (th.text_color || "#f2f2f8") + '" style="width:64px;height:40px;padding:2px">' +
    '<label><input type="checkbox" name="theme_accent_use" style="width:auto"' + (th.accent_color ? " checked" : "") + '> Use a custom accent color (overrides your vibe’s accent — links, headings, friend borders)</label>' +
    '<input type="color" name="theme_accent_color" value="' + (th.accent_color || "#ff2d95") + '" style="width:64px;height:40px;padding:2px" oninput="DWC.setAccent(this.value)">' +
    '<label>Name font — your display name only (overrides your vibe’s name font)</label><select name="theme_name_font">' + THEME_FONTS.map(function (f) { return '<option value="' + f.id + '"' + (th.name_font === f.id ? " selected" : "") + ">" + esc(f.name) + "</option>"; }).join("") + "</select>" +
    '<label>Page text font — the rest of your page (this is what your old “Font” pick is now — it still works exactly as before)</label><select name="theme_font">' + THEME_FONTS.map(function (f) { return '<option value="' + f.id + '"' + (th.font === f.id ? " selected" : "") + ">" + esc(f.name) + "</option>"; }).join("") + "</select>" +
    '<p style="margin:6px 0 0"><span id="dwc-font-sample-name" style="font-size:20px;font-weight:700">Your Name</span><br><span id="dwc-font-sample-body" style="font-size:14px">Sample page text — this is how the rest of your page will read.</span></p>' +
    '<label><input type="checkbox" name="theme_glow" style="width:auto"' + (th.glow ? " checked" : "") + '> ✨ Glow text — make your fonts glow (works with any font you pick above)</label>' +
    '<label>Glow color — the color of the glow</label>' +
    '<input type="color" name="theme_glow_color" value="' + (th.glow_color || "#00e5ff") + '" style="width:64px;height:40px;padding:2px">' +
    '<label>Outline color — the outline around your glowing text</label>' +
    '<input type="color" name="theme_outline_color" value="' + (th.outline_color || "#000000") + '" style="width:64px;height:40px;padding:2px">' +
    '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">Only shows when Glow text is ticked above.</p>' +
    '<h4 style="margin:14px 0 6px">➗ Divider — the line between Top Friends and comments</h4>' +
    "<p style=\"margin:0 0 8px\">Pick the divider that sits between your Top Friends and your page comments. It only draws when Top Friends AND comments both show — hide either one and there’s no line to draw. The free designs are yours now — more unlock with Lucre or achievements later. Pick a color to match your page.</p>" +
    '<div class="dwc-presets" id="dwc-divider-picks">' +
    Object.keys(DIVIDERS).map(function (id) {
      var d = DIVIDERS[id];
      var locked = !d.free;
      return '<button type="button" class="dwc-pill dwc-divider-pick' + ((th.divider || "") === id ? " active" : "") + '"' + (locked ? " disabled title=\"Unlock with " + esc(d.unlock) + " — coming soon\"" : "") + ' data-dividerbtn="' + id + '" onclick="DWC.applyDivider(\'' + id + '\')">' + (locked ? "🔒 " : "") + esc(d.name) + (locked ? " · " + esc(d.unlock) : "") + "</button>";
    }).join("") + "</div>" +
    '<input type="hidden" name="theme_divider" value="' + esc(th.divider || "") + '">' +
    '<label>Divider color — the color of the line</label>' +
    '<input type="color" name="theme_divider_color" value="' + esc(dividerColorFor(th, th.divider || "")) + '" data-custom="' + (th.divider_color ? "1" : "0") + '" style="width:64px;height:40px;padding:2px" oninput="this.setAttribute(\'data-custom\',\'1\');DWC.refreshDividerPreview()">' +
    '<div id="dwc-divider-preview" style="margin-top:8px">' + dividerHTML(th.divider || "", dividerColorFor(th, th.divider || "")) + "</div>" +
    '<label>Who can see my posts on my page</label><select name="theme_feed_privacy">' +
    [["public", "🌍 Public — everyone can see my post feed"], ["friends", "👥 Friends only — only my friends (and me) see it"], ["private", "🔒 Private — only I see my post feed"]].map(function (o) { return '<option value="' + o[0] + '"' + ((th.feed_privacy || "public") === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>" +
    "<p style=\"margin:4px 0 0;color:var(--muted);font-size:13px\">Private means only you see your post feed here. Friends-only means only your friends (and you) see it. Public means everyone — friends-only posts still only show to your friends.</p>" +
    "</div>" +
    '<h4 style="margin:14px 0 6px">🔘 Menu buttons — make them yours</h4>' +
    "<p style=\"margin:0 0 8px\">Pick a button style for the buttons on YOUR page (Subscribe, message, links — all of them). Or leave it blank and write your own below. Presets are interchangeable — swap them anytime. A style here overrides your vibe's buttons.</p>" +
    '<div class="dwc-presets">' +
    '<button type="button" class="dwc-pill' + (!th.button_style ? " active" : "") + '" onclick="DWC.applyButtonStyle(\'\',this)">Default</button>' +
    Object.keys(BUTTON_STYLES).map(function (k) {
      return '<button type="button" class="dwc-pill' + (th.button_style === k ? " active" : "") + '" onclick="DWC.applyButtonStyle(\'' + k + '\',this)">' + esc(BUTTON_STYLES[k].label) + "</button>";
    }).join("") + "</div>" +
    '<input type="hidden" name="theme_button_style" value="' + esc(th.button_style || "") + '">' +
    '<label>Custom button CSS — your own button code (glow, GIFs, whatever you want; overrides your vibe’s buttons and the style above)</label>' +
    '<textarea name="theme_button_css" rows="4" maxlength="4000" placeholder="e.g. .dwc-myprofile .btn{background:url(https://example.com/my.gif);background-size:cover;box-shadow:0 0 16px #ff2d95;}">' + esc(th.button_css || "") + "</textarea>" +
    '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">Targets the buttons on your page only. Images in url() must be https:// — a GIF URL works as a button background. CSS only, same limits as the layout box.</p>' +
    '<h4 style="margin:14px 0 6px">✨ MySpace effects — Give it those oldschool effects</h4>' +
    "<p style=\"margin:0 0 8px\">Tick what you want on your page. These sit on top of everything else. A GIF background goes in the background-image URL box above — any https:// GIF works.</p>" +
    '<div class="dwc-checkgrid">' +
    Object.keys(MYSPACE_EFFECTS).map(function (k) {
      var fx = MYSPACE_EFFECTS[k];
      return '<label><input type="checkbox" name="theme_effects" value="' + k + '" style="width:auto" onchange="DWC.bgEffectChanged(this)"' + ((th.effects || []).indexOf(k) >= 0 ? " checked" : "") + "> <strong>" + esc(fx.label) + "</strong>" + (fx.desc ? ' <span style="color:var(--muted);font-size:12px">— ' + esc(fx.desc) + "</span>" : "") + "</label>";
    }).join("") + "</div>" +
    '<label><input type="checkbox" name="theme_comment_border_use" style="width:auto"' + (th.comment_border_color ? " checked" : "") + ' onchange="DWC.commentBorderUseChanged(this)"> Use a custom color for comment-picture borders — any color (this turns off the RGB border effect above)</label>' +
    '<input name="theme_comment_border_color" type="color" value="' + esc(/^#[0-9a-fA-F]{6}$/.test(th.comment_border_color || "") ? th.comment_border_color : "#000000") + '" style="width:64px;height:36px;padding:2px">' +
    (isNew ? "" :
    '<h4 id="dwc-sec-badges" style="margin:14px 0 6px">🏅 Badge display — your unlocked badges</h4>' +
    "<p style=\"margin:0 0 8px\">Your badges show next to your name everywhere you post, comment, and chat. Pick which ones show below — locked ones are greyed out until you earn them.</p>" +
    badgeDisplayListHTML(p ? p.badges : []) +
    badgeSlotPickerHTML(p)) +
    (isNew ? "" : websiteFieldsHTML(p)) +
    '<h4 style="margin:12px 0 6px">Live preview</h4><div id="dwc-layout-preview">' + layoutPreviewInnerHTML(p) + "</div></div>" +
    '<div class="dwc-layoutbox dwc-bot" id="dwc-sec-taffy"><div class="taffy-row"><div id="dwc-taffy">' + taffySVG("taffy", "bot") + '</div><div><h4 style="margin:0 0 6px">🎨 Taffy Layout Builder — pick your look</h4>' +
    "<p style=\"margin:0\">Hi, I'm Taffy! I don't write code — I point you at real settings that work. Pick a vibe, pick an accent color, and watch the live preview change. Save to keep it.</p></div></div>" +
    "<p style=\"margin:8px 0\">A vibe is a full look — background, cards, headings, buttons — in one tap. Your accent color is the one color that ties it together. Both are real settings: they save with your profile and show on your page.</p>" +
    '<label>Vibe — a full look for your page (sets background, cards, headings, and buttons — your own color, font, and button picks below still win over it)</label><select id="dwc-bot-vibe" name="theme_vibe" onchange="DWC.vibePicked(this)"><option value="">— No vibe, just my own picks —</option>' + Object.keys(LAYOUT_VIBES).map(function (k) { return '<option value="' + k + '"' + (th.vibe === k ? " selected" : "") + ">" + esc(LAYOUT_VIBES[k].label) + "</option>"; }).join("") + "</select>" +
    '<label>Accent color — the one color that ties your page together (overrides your vibe’s accent)</label><div class="dwc-rowform"><input type="color" id="dwc-bot-accent" value="' + esc(th.accent_color || (th.vibe && LAYOUT_VIBES[th.vibe] ? LAYOUT_VIBES[th.vibe].accent : "#ff2d95")) + '" style="flex:0 0 auto;width:64px;height:40px;padding:2px" oninput="DWC.setAccent(this.value)">' +
    ["#ff2d95", "#00e5ff", "#7c4dff", "#39ff88", "#ff9a00", "#d4af37"].map(function (c) {
      return '<button type="button" class="dwc-swatch" style="background:' + c + '" title="' + c + '" onclick="DWC.setAccent(\'' + c + '\')">&nbsp;</button>';
    }).join("") + "</div>" +
    '<p style="margin:12px 0 0"><button type="button" class="btn ghost" onclick="DWC.layoutStoreSoon()">🛍️ Browse layouts in Taffy’s store →</button></p>' +
    '<p style="margin:4px 0 0;color:var(--muted);font-size:13px">Pre-made layouts you can grab in Taffy’s Layout Store — 22 free, 6 priced in Lucre, including 3 website templates and 8 new themes. Members publish their own there too, free. Pick a vibe above for a quick look that works right now.</p>' +
    '<h4 style="margin:16px 0 6px">🗣️ Tell Taffy what you want — in plain words</h4>' +
    "<p style=\"margin:0 0 8px\">One box, one ask: type what you want for your page — buttons side, button style, ticker, video, what shows and what hides — and I'll set it up. I match words I know (buttons, arcade, insert coin, bitcoin, top friends, links, videos…). Anything I don't get, I'll tell you plainly and set the rest. No AI service involved — I match your words right here, nothing leaves your browser.</p>" +
    '<input id="dwc-builder-prompt" maxlength="500" placeholder="e.g. buttons on the right, arcade buttons, bitcoin ticker, hide everything but my top friends and my videos">' +
    '<p style="margin:8px 0 0"><button type="button" class="btn" onclick="DWC.runProfileBuilder()">Build my page →</button></p>' +
    '<div id="dwc-builder-result"></div>' +
    '<p id="dwc-builder-apply-row" hidden style="margin:8px 0 0"><button type="button" class="btn" onclick="DWC.applyProfileBuilder()">Apply these settings →</button> <span style="color:var(--muted);font-size:13px">Puts the settings into the form above — nothing saves until you hit Save profile.</span></p></div>') +
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
  if (el) el.innerHTML = state.challenge ? esc(state.challenge.question) : 'Human check didn\'t load — <button type="button" class="btn ghost small" onclick="DWC.retryChallenge()">Tap to retry</button>';
}

// Post-signup unlock card — after a basic account is created, show the
// member exactly what they can unlock next, in plain words. No ID is
// needed unless they want the 18+ areas. Dismissable; it only appears
// right after a new signup.
function unlockCardHTML() {
  var p = state.profile || {};
  var name = p.username ? "@" + p.username : "you";
  return '<section class="card dwc-unlock" aria-label="You\'re in — unlock more">' +
    '<h3 style="margin-top:0">🎉 You\'re in, ' + esc(name) + '!</h3>' +
    '<p style="margin:0 0 10px">That was the whole signup. Everything below is optional — unlock it whenever you want, or skip it and just hang out.</p>' +
    '<div class="dwc-unlock-grid">' +
    '<button type="button" class="btn" onclick="DWC.editProfile()">🎨 Make it yours<br><span style="font-weight:400;font-size:13px">picture, bio, layout, links</span></button>' +
    '<button type="button" class="btn" onclick="DWC.editProfile()">💰 Start selling<br><span style="font-weight:400;font-size:13px">add how you get paid</span></button>' +
    '<button type="button" class="btn" onclick="DWC.go(\'adult\')">🔞 18+ areas<br><span style="font-weight:400;font-size:13px">ID check — only if you want in</span></button>' +
    '</div>' +
    '<p style="margin:10px 0 0;color:var(--muted);font-size:13px">No ID needed to join or sell regular stuff — only for the 18+ areas. No rush on any of it.</p>' +
    '<p style="margin:8px 0 0"><button type="button" class="btn ghost small" onclick="DWC.dismissUnlock()">I\'ll do this later →</button></p>' +
    '</section>';
}

// ---------- MySpace throwback v2: Top Friends picker + layout editor ----------

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
    return '<label><input type="checkbox" name="top_friend" value="' + m.id + '" style="width:auto"' + (picked.has(m.id) ? " checked" : "") + ' onchange="DWC.topFriendChanged(this)"> ' + esc(m.id === 1 ? "Chris (Ash)" : "@" + m.username) + "</label>";
  }).join("") + "</div>";
  updateTop8Count();
}
function updateTop8Count() {
  var el = $("dwc-top8-count");
  if (!el) return;
  el.textContent = document.querySelectorAll('input[name="top_friend"]:checked').length;
}
function updateLinksCount() {
  var el = $("dwc-links-count");
  if (!el) return;
  el.textContent = document.querySelectorAll('#dwc-links-list .dwc-linkrow').length + "/6";
}
function initLayoutEditor() {
  // First render of the Live preview: build it from the form values
  // (vibe, accent, website look, everything), not just the saved CSS.
  var count = document.getElementById("dwc-mycode-count");
  var ta0 = document.querySelector('textarea[name="layout_css"]');
  if (count && ta0) count.textContent = (ta0.value || "").length + "/8000";
  if (typeof DWC !== "undefined" && DWC.refreshLayoutPreview) DWC.refreshLayoutPreview();
  var cta = document.querySelector('textarea[name="custom_page_html"]');
  if (cta && typeof DWC !== "undefined" && DWC.customPagePreview) DWC.customPagePreview(cta);
  else {
    var ta = document.querySelector('textarea[name="layout_css"]');
    if (ta) applyPreviewCSS(ta.value);
  }
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
// Professional mode (2026-11-21) — GIF comments don't autoplay on a
// clean website-mode profile: they sit behind a button until the
// visitor taps it. True only while a website-mode member page is open
// (the body class is set in viewMember and cleared on navigation).
function isWebsiteView() {
  return typeof document !== "undefined" && document.body && document.body.classList.contains("dwc-website-view");
}
function gifEmbedHTML(url, label, gate) {
  if (!url) return "";
  if (gate) return '<button type="button" class="btn ghost small dwc-gif-gate" data-gif-url="' + esc(url) + '" data-gif-label="' + esc(label || "") + '" onclick="DWC.loadGifEmbed(this)">▶ Load GIF' + (label ? " · " + esc(label) : "") + "</button>";
  return '<div class="dwc-gifview"><iframe src="' + esc(url) + '" loading="lazy" title="' + esc(label || "GIF") + '" sandbox="allow-scripts allow-same-origin"></iframe>' +
    '<p>GIF via GIPHY' + (label ? " · " + esc(label) : "") + "</p></div>";
}

// ---------- Meme Stash codes (v3.13) ----------
// Members paste a code like :rickroll: into a post or comment and the
// meme shows up inline. Allowlist only — the code is the filename stem
// (:stem:), the MP4 gets :rickroll-video:. Unknown codes stay literal
// text, and the body is escaped FIRST (see memeBodyHTML) so no user
// HTML can ever pass through.
var MEME_CODES = {
  "rickroll": { file: "rickroll.gif", kind: "gif", label: "YOU GOT RICK ROLLED" },
  "beard-nod": { file: "beard-nod.gif", kind: "gif", label: "The Bearded Nod" },
  "rickroll-video": { file: "rickroll.mp4", kind: "video", label: "RICKROLL — get rickrolled" },
  "always-has-been": { file: "always-has-been.gif", kind: "gif", label: "Always Has Been" },
  "ancient-aliens-guy": { file: "ancient-aliens-guy.gif", kind: "gif", label: "Ancient Aliens Guy" },
  "bad-luck-brian": { file: "bad-luck-brian.gif", kind: "gif", label: "Bad Luck Brian" },
  "bernie-once-again-asking": { file: "bernie-once-again-asking.gif", kind: "gif", label: "Bernie Once Again Asking" },
  "change-my-mind": { file: "change-my-mind.gif", kind: "gif", label: "Change My Mind" },
  "deal-with-it": { file: "deal-with-it.gif", kind: "gif", label: "Deal With It" },
  "dicaprio-toast": { file: "dicaprio-toast.gif", kind: "gif", label: "Leo Toast" },
  "disaster-girl": { file: "disaster-girl.gif", kind: "gif", label: "Disaster Girl" },
  "distracted-boyfriend": { file: "distracted-boyfriend.gif", kind: "gif", label: "Distracted Boyfriend" },
  "doge": { file: "doge.gif", kind: "gif", label: "Doge" },
  "drake-yes-no": { file: "drake-yes-no.gif", kind: "gif", label: "Drake Yes / No" },
  "grumpy-cat": { file: "grumpy-cat.gif", kind: "gif", label: "Grumpy Cat" },
  "grus-plan": { file: "grus-plan.gif", kind: "gif", label: "Gru's Plan" },
  "hide-the-pain-harold": { file: "hide-the-pain-harold.gif", kind: "gif", label: "Hide the Pain Harold" },
  "ight-imma-head-out": { file: "ight-imma-head-out.gif", kind: "gif", label: "Ight Imma Head Out" },
  "is-this-a-pigeon": { file: "is-this-a-pigeon.gif", kind: "gif", label: "Is This a Pigeon?" },
  "keyboard-cat": { file: "keyboard-cat.gif", kind: "gif", label: "Keyboard Cat" },
  "mocking-spongebob": { file: "mocking-spongebob.gif", kind: "gif", label: "Mocking SpongeBob" },
  "nyan-cat": { file: "nyan-cat.gif", kind: "gif", label: "Nyan Cat" },
  "one-does-not-simply": { file: "one-does-not-simply.gif", kind: "gif", label: "One Does Not Simply" },
  "pepe-the-frog": { file: "pepe-the-frog.gif", kind: "gif", label: "Pepe the Frog" },
  "philosoraptor": { file: "philosoraptor.png", kind: "png", label: "Philosoraptor" },
  "shut-up-and-take-my-money": { file: "shut-up-and-take-my-money.gif", kind: "gif", label: "Shut Up and Take My Money" },
  "success-kid": { file: "success-kid.gif", kind: "gif", label: "Success Kid" },
  "surprised-pikachu": { file: "surprised-pikachu.gif", kind: "gif", label: "Surprised Pikachu" },
  "this-is-fine": { file: "this-is-fine.gif", kind: "gif", label: "This Is Fine" },
  "trollface": { file: "trollface.png", kind: "png", label: "Trollface" },
  "two-buttons": { file: "two-buttons.gif", kind: "gif", label: "Two Buttons" },
  "wojak-feels-guy": { file: "wojak-feels-guy.gif", kind: "gif", label: "Wojak (Feels Guy)" },
  "woman-yelling-at-cat": { file: "woman-yelling-at-cat.gif", kind: "gif", label: "Woman Yelling at Cat" }
};
function memeBodyHTML(body) {
  var out = esc(body);
  return out.replace(/:([a-z0-9][a-z0-9-]*):/g, function (m, stem) {
    var it = MEME_CODES[stem];
    if (!it) return m;
    if (it.kind === "video") return '<video src="images/memes/' + it.file + '" controls preload="none" playsinline class="dwc-meme-inline"></video>';
    return '<img src="images/memes/' + it.file + '" class="dwc-meme-inline" alt="' + esc(it.label) + '" loading="lazy">';
  });
}

// YouTube embed (v3.8) — a post body may carry a YouTube watch / shorts /
// youtu.be link. We extract ONLY a validated 11-char video id and build a
// privacy-enhanced (nocookie) embed in code. No raw user HTML is ever
// inserted, so the iframe strip for user-supplied content still applies
// everywhere else. Returns "" when the body has no YouTube link.
function youtubeEmbedHTML(body) {
  if (!body) return "";
  var m = String(body).match(/(?:youtube\.com\/(?:watch\?[^#\s]*?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (!m) return "";
  var id = m[1];
  return '<div class="dwc-ytview"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '" loading="lazy" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>' +
    '<p>Video via YouTube · <a href="https://www.youtube.com/watch?v=' + id + '" target="_blank" rel="noopener">Watch on YouTube ↗</a></p></div>';
}

// ---------- Photo cropper + short video clips (v3.5) ----------
// Crop: when a photo is picked in any post composer, a modal opens and
// the member drags a box over it (move inside, resize by the corners).
// "Use this crop" exports the region from the ORIGINAL full-resolution
// image (longest side capped at 1600px, JPEG 0.85) into cropPick;
// "Use original (no crop)" keeps the file as picked; Cancel keeps
// whatever was there before. The cropper is plain canvas + Pointer
// Events — no AI, no libraries.
// Video: one short clip per post (MP4 / WebM / MOV, 15 MB, 60s). The
// File stays in videoPick until submit, when it is read as base64.
var cropPick = {}; // formKey -> { dataBase64, mimeType } (cropped JPEG)
var cropOrig = {}; // formKey -> object URL of the original photo (preview)
var videoPick = {}; // formKey -> { file, name, url, duration }
var listingPhotoFit = {}; // listing photo slot (1-3) -> { file, result } from the pick-time auto-fit, reused at submit so the photo is only resized once
var cropState = null; // open modal: { file, key, form, img, iw, ih, dw, dh, scale, rect, aspect, drag }
var CROP_MAX_SIDE = 1600;
var CROP_ASPECTS = { "free": null, "1:1": [1, 1], "4:3": [4, 3], "16:9": [16, 9] };
// Export size for a crop region (original pixels): longest side capped
// at 1600px, aspect kept. Pure — unit-tested in node (see test notes).
function cropExportSize(sw, sh) {
  var w = Math.max(1, Math.round(sw)), h = Math.max(1, Math.round(sh));
  var longest = Math.max(w, h);
  if (longest <= CROP_MAX_SIDE) return { w: w, h: h };
  var k = CROP_MAX_SIDE / longest;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
// Centered rect of the given aspect [w,h], as large as fits the display.
function fitRectToAspect(ar, dw, dh) {
  var k = Math.min(dw / ar[0], dh / ar[1]);
  var w = Math.max(1, Math.floor(ar[0] * k)), h = Math.max(1, Math.floor(ar[1] * k));
  return { x: Math.round((dw - w) / 2), y: Math.round((dh - h) / 2), w: w, h: h };
}
// Corner-drag a rect (display px) while holding its aspect (ar [w,h] or
// null for free). mode fixes one corner: se = top-left fixed, nw =
// bottom-right fixed, ne = bottom-left fixed, sw = top-right fixed.
function fitDragRect(o, mode, dx, dy, ar, dw, dh) {
  var min = 24;
  var r = { x: o.x, y: o.y, w: o.w, h: o.h };
  if (!ar) {
    if (mode === "se" || mode === "ne") r.w = Math.max(min, Math.min(dw - o.x, o.w + dx));
    if (mode === "nw" || mode === "sw") r.w = Math.max(min, Math.min(o.x + o.w, o.w - dx));
    if (mode === "se" || mode === "sw") r.h = Math.max(min, Math.min(dh - o.y, o.h + dy));
    if (mode === "nw" || mode === "ne") r.h = Math.max(min, Math.min(o.y + o.h, o.h - dy));
  } else {
    if (mode === "se" || mode === "ne") r.w = Math.max(min, Math.min(dw - o.x, o.w + dx));
    else r.w = Math.max(min, Math.min(o.x + o.w, o.w - dx));
    r.h = r.w * ar[1] / ar[0];
    var maxH = (mode === "se" || mode === "sw") ? dh - o.y : o.y + o.h;
    if (r.h > maxH) { r.h = maxH; r.w = r.h * ar[0] / ar[1]; }
    var maxW = (mode === "se" || mode === "ne") ? dw - o.x : o.x + o.w;
    if (r.w > maxW) { r.w = maxW; r.h = r.w * ar[1] / ar[0]; }
    if (r.w < min) { r.w = min; r.h = r.w * ar[1] / ar[0]; }
    if (r.h < min) { r.h = min; r.w = r.h * ar[0] / ar[1]; }
  }
  if (mode === "nw" || mode === "sw") r.x = o.x + o.w - r.w;
  if (mode === "nw" || mode === "ne") r.y = o.y + o.h - r.h;
  r.x = Math.max(0, r.x); r.y = Math.max(0, r.y);
  return r;
}
function closeCropModal() {
  var old = document.getElementById("dwc-crop-overlay");
  if (old) old.remove();
}
function openCropModal(file, key, form) {
  var url = URL.createObjectURL(file);
  var img = new Image();
  img.onload = function () {
    URL.revokeObjectURL(url);
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) { formErr(form, "That photo couldn't be read — try a different one."); return; }
    var scale = Math.min(1, 900 / iw, 520 / ih);
    var dw = Math.max(1, Math.round(iw * scale)), dh = Math.max(1, Math.round(ih * scale));
    cropState = { file: file, key: key, form: form, img: img, iw: iw, ih: ih, dw: dw, dh: dh, scale: scale, rect: { x: 0, y: 0, w: dw, h: dh }, aspect: "free", drag: null };
    renderCropModal();
  };
  img.onerror = function () { URL.revokeObjectURL(url); formErr(form, "That photo couldn't be read — try a different one."); };
  img.src = url;
}
function renderCropModal() {
  var st = cropState;
  if (!st) return;
  closeCropModal();
  var div = document.createElement("div");
  div.className = "dwc-crop-overlay";
  div.id = "dwc-crop-overlay";
  div.innerHTML =
    '<div class="dwc-crop-modal" role="dialog" aria-label="Crop photo">' +
    '<h3 style="margin-top:0">Crop your photo</h3>' +
    '<p style="color:var(--muted)">Drag inside the box to move it, drag a corner to resize. Pick a shape, or leave it free.</p>' +
    '<div class="dwc-crop-stage" id="dwc-crop-stage">' +
    '<canvas id="dwc-crop-canvas" width="' + st.dw + '" height="' + st.dh + '"></canvas>' +
    '<div class="dwc-crop-rect" id="dwc-crop-rect">' +
    '<span class="dwc-crop-handle nw"></span><span class="dwc-crop-handle ne"></span>' +
    '<span class="dwc-crop-handle sw"></span><span class="dwc-crop-handle se"></span>' +
    '</div></div>' +
    '<div class="dwc-crop-aspects">' +
    '<button type="button" data-cropaspect="free" class="on" onclick="DWC.setCropAspect(\'free\')">Free</button>' +
    '<button type="button" data-cropaspect="1:1" onclick="DWC.setCropAspect(\'1:1\')">1:1</button>' +
    '<button type="button" data-cropaspect="4:3" onclick="DWC.setCropAspect(\'4:3\')">4:3</button>' +
    '<button type="button" data-cropaspect="16:9" onclick="DWC.setCropAspect(\'16:9\')">16:9</button>' +
    '</div>' +
    '<div class="dwc-crop-actions">' +
    '<button type="button" class="btn" onclick="DWC.applyCrop()">Use this crop</button>' +
    '<button type="button" class="btn ghost" onclick="DWC.useOriginalCrop()">Use original (no crop)</button>' +
    '<button type="button" class="btn ghost" onclick="DWC.cancelCrop()">Cancel</button>' +
    '</div></div>';
  document.body.appendChild(div);
  var stage = document.getElementById("dwc-crop-stage");
  stage.addEventListener("pointerdown", cropPointerDown);
  stage.addEventListener("pointermove", cropPointerMove);
  stage.addEventListener("pointerup", cropPointerUp);
  stage.addEventListener("pointercancel", cropPointerUp);
  drawCropCanvas();
}
// Draw the image + dimmed outside-the-rect area, and place the rect div
// (percentages, so it tracks the canvas when CSS scales it on mobile).
function drawCropCanvas() {
  var st = cropState;
  if (!st) return;
  var c = document.getElementById("dwc-crop-canvas");
  if (!c) return;
  var ctx = c.getContext("2d");
  ctx.drawImage(st.img, 0, 0, st.dw, st.dh);
  var r = st.rect;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, st.dw, r.y);
  ctx.fillRect(0, r.y + r.h, st.dw, st.dh - (r.y + r.h));
  ctx.fillRect(0, r.y, r.x, r.h);
  ctx.fillRect(r.x + r.w, r.y, st.dw - (r.x + r.w), r.h);
  var div = document.getElementById("dwc-crop-rect");
  if (div) {
    div.style.left = (r.x / st.dw * 100) + "%";
    div.style.top = (r.y / st.dh * 100) + "%";
    div.style.width = (r.w / st.dw * 100) + "%";
    div.style.height = (r.h / st.dh * 100) + "%";
  }
}
function cropPointerDown(e) {
  var st = cropState;
  if (!st) return;
  var stage = document.getElementById("dwc-crop-stage");
  if (!stage) return;
  var r = stage.getBoundingClientRect();
  var dx = (e.clientX - r.left) / r.width * st.dw;
  var dy = (e.clientY - r.top) / r.height * st.dh;
  var tol = 18 / r.width * st.dw; // ~18 CSS px corner grab area
  var cr = st.rect;
  var mode = null;
  var near = function (cx, cy) { return Math.abs(dx - cx) <= tol && Math.abs(dy - cy) <= tol; };
  if (near(cr.x, cr.y)) mode = "nw";
  else if (near(cr.x + cr.w, cr.y)) mode = "ne";
  else if (near(cr.x, cr.y + cr.h)) mode = "sw";
  else if (near(cr.x + cr.w, cr.y + cr.h)) mode = "se";
  else if (dx >= cr.x && dx <= cr.x + cr.w && dy >= cr.y && dy <= cr.y + cr.h) mode = "move";
  if (!mode) return;
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  st.drag = { mode: mode, startX: e.clientX, startY: e.clientY, rect: { x: cr.x, y: cr.y, w: cr.w, h: cr.h }, stageW: r.width, stageH: r.height };
}
function cropPointerMove(e) {
  var st = cropState;
  if (!st || !st.drag) return;
  var d = st.drag;
  var dx = (e.clientX - d.startX) / d.stageW * st.dw;
  var dy = (e.clientY - d.startY) / d.stageH * st.dh;
  var o = d.rect;
  if (d.mode === "move") {
    st.rect = {
      x: Math.max(0, Math.min(st.dw - o.w, o.x + dx)),
      y: Math.max(0, Math.min(st.dh - o.h, o.y + dy)),
      w: o.w, h: o.h,
    };
  } else {
    st.rect = fitDragRect(o, d.mode, dx, dy, CROP_ASPECTS[st.aspect], st.dw, st.dh);
  }
  drawCropCanvas();
}
function cropPointerUp() {
  if (cropState) cropState.drag = null;
}
// Composer previews — the small "what's attached" area under each input.
// Rendered with the composer (so picks survive a re-render) and updated
// in place by the pick/crop handlers (so typed text is never lost).
function cropPreviewInner(key) {
  var c = cropPick[key];
  if (c) {
    return '<img class="dwc-crop-thumb" src="data:image/jpeg;base64,' + c.dataBase64 + '" alt="Cropped photo preview">' +
      '<p>Photo cropped ✓ <button type="button" class="dwc-linklike" onclick="DWC.cropAgain(this, \'' + esc(key) + '\')">Crop again</button> <button type="button" class="dwc-linklike" onclick="DWC.removePhoto(this, \'' + esc(key) + '\')">Remove photo</button></p>';
  }
  if (cropOrig[key]) {
    return '<img class="dwc-crop-thumb" src="' + esc(cropOrig[key]) + '" alt="Photo preview">' +
      '<p>Original photo — no crop <button type="button" class="dwc-linklike" onclick="DWC.cropAgain(this, \'' + esc(key) + '\')">Crop it</button> <button type="button" class="dwc-linklike" onclick="DWC.removePhoto(this, \'' + esc(key) + '\')">Remove photo</button></p>';
  }
  return "";
}
function cropPreviewHTML(key) {
  return '<div data-croppreview="' + esc(key) + '">' + cropPreviewInner(key) + '</div>';
}
function updateCropPreview(form, key) {
  var box = form ? form.querySelector('[data-croppreview="' + key + '"]') : document.querySelector('[data-croppreview="' + key + '"]');
  if (box) box.innerHTML = cropPreviewInner(key);
}
function videoPreviewInner(key) {
  var v = videoPick[key];
  if (!v) return "";
  return '<video class="dwc-video-preview-vid" controls preload="metadata" playsinline src="' + esc(v.url) + '"></video>' +
    '<p>' + esc(v.name) + ' · ' + Math.round(v.duration) + 's <button type="button" class="dwc-linklike" onclick="DWC.clearVideo(this, \'' + esc(key) + '\')">Remove video</button></p>';
}
function videoPreviewHTML(key) {
  return '<div data-videopreview="' + esc(key) + '">' + videoPreviewInner(key) + '</div>';
}
function updateVideoPreview(form, key) {
  var box = form ? form.querySelector('[data-videopreview="' + key + '"]') : document.querySelector('[data-videopreview="' + key + '"]');
  if (box) box.innerHTML = videoPreviewInner(key);
}
function clearCropPick(key) {
  delete cropPick[key];
  if (cropOrig[key]) { try { URL.revokeObjectURL(cropOrig[key]); } catch (e) {} delete cropOrig[key]; }
}
function clearVideoPick(key) {
  var v = videoPick[key];
  if (v && v.url) { try { URL.revokeObjectURL(v.url); } catch (e) {} }
  delete videoPick[key];
}

// ---------- MySpace layouts: presets + Layout Bot ----------
// Layout CSS targets the .dwc-myprofile hooks only, so a member's layout
// styles THEIR page and nothing else:
//   .dwc-myprofile            the page wrapper (background)
//   .dwc-myprofile .card      panels  ·  h2/h3 headings  ·  a links
//   .dwc-myprofile .dwc-avatar  avatar ring  ·  .btn buttons
//   .dwc-myprofile .dwc-topfriend  Top 8 tiles  ·  .dwc-mypage-head header
var LAYOUT_PRESETS = [
  { id: "classic", name: "Classic MySpace (2005)", theme: { vibe: "", bg_color: "#ffffff", bg_image_url: "", text_color: "#000000", accent_color: "#003399", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] }, css:
    ".dwc-myprofile{background:#fff;font-family:Verdana,Tahoma,Arial,sans-serif;}" +
    ".dwc-myprofile .card{background:#fff;border:1px solid #6699cc;border-radius:4px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#003399;font-family:Verdana,Tahoma,Arial,sans-serif;text-shadow:none;}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#000;}" +
    ".dwc-myprofile .dwc-meta{color:#666;}" +
    ".dwc-myprofile a{color:#003399;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #003399;box-shadow:none;}" +
    ".dwc-myprofile .btn{background:#003399;color:#fff;box-shadow:none;}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #6699cc;border-radius:4px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #003399;}" },
  { id: "neon", name: "Neon Vaporwave", theme: { vibe: "", bg_color: "#12002e", bg_image_url: "", text_color: "#f2f2f8", accent_color: "#ff2d95", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] }, css:
    ".dwc-myprofile{background:linear-gradient(160deg,#12002e 0%,#2b0057 55%,#0a2a4a 100%);}" +
    ".dwc-myprofile .card{background:rgba(20,0,50,.82);border:1px solid #ff2d95;border-radius:16px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#ff5cb8;text-shadow:0 0 12px rgba(255,45,149,.8);}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#f2f2f8;}" +
    ".dwc-myprofile .dwc-meta{color:#c9b8ff;}" +
    ".dwc-myprofile a{color:#00e5ff;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #ff2d95;box-shadow:0 0 12px rgba(255,45,149,.8);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#ff2d95,#00e5ff);box-shadow:0 0 12px rgba(255,45,149,.8);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #ff2d95;border-radius:16px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #ff2d95;}" },
  { id: "midnight", name: "Midnight", theme: { vibe: "", bg_color: "#05050a", bg_image_url: "", text_color: "#e8e8f5", accent_color: "#00e5ff", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] }, css:
    ".dwc-myprofile{background:linear-gradient(160deg,#05050a 0%,#0d0d1f 100%);}" +
    ".dwc-myprofile .card{background:#12122a;border:1px solid #2a2a44;border-radius:12px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#00e5ff;text-shadow:0 0 10px rgba(0,229,255,.6);}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#e8e8f5;}" +
    ".dwc-myprofile .dwc-meta{color:#8a8aa8;}" +
    ".dwc-myprofile a{color:#00e5ff;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #00e5ff;box-shadow:0 0 10px rgba(0,229,255,.6);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#00a8cc,#7c4dff);box-shadow:0 0 10px rgba(0,229,255,.6);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #2a2a44;border-radius:12px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #00e5ff;}" },
  { id: "candy", name: "Candy Pop", theme: { vibe: "", bg_color: "#ffd7ef", bg_image_url: "", text_color: "#3a0a2a", accent_color: "#d6007a", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] }, css:
    ".dwc-myprofile{background:linear-gradient(160deg,#ffd7ef 0%,#e9d5ff 55%,#bff3ff 100%);}" +
    ".dwc-myprofile .card{background:rgba(255,255,255,.9);border:2px solid #ff2d95;border-radius:24px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#d6007a;text-shadow:none;}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#3a0a2a;}" +
    ".dwc-myprofile .dwc-meta{color:#8a5a7a;}" +
    ".dwc-myprofile a{color:#d6007a;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #ff2d95;box-shadow:0 0 12px rgba(255,45,149,.45);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#ff2d95,#ff9a00);box-shadow:0 0 12px rgba(255,45,149,.45);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #ff9a00;border-radius:24px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #ff2d95;}" },
  { id: "afterdark", name: "After Dark 🌙", theme: { vibe: "", bg_color: "#0a0014", bg_image_url: "", text_color: "#f5e8f5", accent_color: "#ff2ea6", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] }, css:
    ".dwc-myprofile{background:linear-gradient(160deg,#0a0014 0%,#1a002e 50%,#2b001f 100%);}" +
    ".dwc-myprofile .card{background:rgba(26,0,46,.88);border:1px solid #ff2ea6;border-radius:16px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#ff5cb8;text-shadow:0 0 14px rgba(255,46,166,.9);}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#f5e8f5;}" +
    ".dwc-myprofile .dwc-meta{color:#c9a8d8;}" +
    ".dwc-myprofile a{color:#ff2ea6;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #ff2ea6;box-shadow:0 0 14px rgba(255,46,166,.9);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#ff2ea6,#7c4dff);box-shadow:0 0 14px rgba(255,46,166,.9);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #ff2ea6;border-radius:16px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #ff2ea6;}" },
  { id: "creatorgold", name: "Creator Gold 👑", theme: { vibe: "", bg_color: "#0d0a02", bg_image_url: "", text_color: "#f5eed8", accent_color: "#d4af37", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] }, css:
    ".dwc-myprofile{background:linear-gradient(160deg,#0d0a02 0%,#241a05 55%,#3a2c08 100%);}" +
    ".dwc-myprofile .card{background:#1a1405;border:1px solid #d4af37;border-radius:12px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#f5d76e;text-shadow:0 0 12px rgba(212,175,55,.7);}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#f5eed8;}" +
    ".dwc-myprofile .dwc-meta{color:#b8a468;}" +
    ".dwc-myprofile a{color:#f5d76e;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #d4af37;box-shadow:0 0 12px rgba(212,175,55,.7);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#d4af37,#ffec99);color:#1a1405;box-shadow:0 0 12px rgba(212,175,55,.7);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #d4af37;border-radius:12px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #d4af37;}" },
  { id: "candyshop", name: "Candy Shop 🍬", theme: { vibe: "", bg_color: "#fff0f7", bg_image_url: "", text_color: "#3a0a2a", accent_color: "#ff5cb8", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] }, css:
    ".dwc-myprofile{background:linear-gradient(160deg,#fff0f7 0%,#ffe3f2 40%,#d8f3ff 75%,#e9d5ff 100%);}" +
    ".dwc-myprofile .card{background:rgba(255,255,255,.92);border:2px solid #ff5cb8;border-radius:22px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#c4007a;text-shadow:none;}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#3a0a2a;}" +
    ".dwc-myprofile .dwc-meta{color:#9a5a8a;}" +
    ".dwc-myprofile a{color:#c4007a;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #ff5cb8;box-shadow:0 0 14px rgba(255,92,184,.5);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#ff5cb8,#00c8ff);box-shadow:0 0 14px rgba(255,92,184,.5);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #00c8ff;border-radius:22px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #ff5cb8;}" },
  { id: "arcade", name: "Retro Arcade 🕹️", theme: { vibe: "", bg_color: "#0a0a12", bg_image_url: "", text_color: "#e8f6ff", accent_color: "#00e5ff", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] }, css:
    ".dwc-myprofile{background:linear-gradient(160deg,#0a0a12 0%,#1a0b2e 55%,#0b1a2e 100%);font-family:'Courier New',Courier,monospace;}" +
    ".dwc-myprofile .card{background:#120a24;border:2px solid #00e5ff;border-radius:8px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#ffe600;text-shadow:0 0 12px rgba(255,230,0,.7);}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#e8f6ff;}" +
    ".dwc-myprofile .dwc-meta{color:#8ab8d8;}" +
    ".dwc-myprofile a{color:#00e5ff;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #ffe600;box-shadow:0 0 12px rgba(255,230,0,.6);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#ff2d95,#ffe600);color:#0a0a12;box-shadow:0 0 12px rgba(255,230,0,.6);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #ffe600;border-radius:8px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #00e5ff;}" },
  { id: "ocean", name: "Ocean Deep 🌊", theme: { vibe: "", bg_color: "#001a2e", bg_image_url: "", text_color: "#e8f8ff", accent_color: "#4dd8ff", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", hide_sections: [] }, css:
    ".dwc-myprofile{background:linear-gradient(160deg,#001a2e 0%,#003a5c 55%,#005c5c 100%);}" +
    ".dwc-myprofile .card{background:rgba(0,40,70,.85);border:1px solid #4dd8ff;border-radius:16px;}" +
    ".dwc-myprofile h2,.dwc-myprofile h3{color:#7de8ff;text-shadow:0 0 12px rgba(77,216,255,.7);}" +
    ".dwc-myprofile p,.dwc-myprofile li{color:#e8f8ff;}" +
    ".dwc-myprofile .dwc-meta{color:#8ab8d8;}" +
    ".dwc-myprofile a{color:#4dd8ff;}" +
    ".dwc-myprofile .dwc-avatar{border:3px solid #4dd8ff;box-shadow:0 0 12px rgba(77,216,255,.6);}" +
    ".dwc-myprofile .btn{background:linear-gradient(90deg,#0077b6,#00c8a8);box-shadow:0 0 12px rgba(77,216,255,.6);}" +
    ".dwc-myprofile .dwc-topfriend{border:2px solid #4dd8ff;border-radius:16px;}" +
    ".dwc-myprofile .dwc-mypage-head{border-bottom:3px solid #4dd8ff;}" },
];
function layoutPresetCSS(id) {
  for (var i = 0; i < LAYOUT_PRESETS.length; i++) if (LAYOUT_PRESETS[i].id === id) return LAYOUT_PRESETS[i].css;
  return "";
}

// ---------- Member-page theme pickers (v3.2) ----------
// Background color/image, text + accent colors, and fonts — all optional,
// all validated (hex colors, https:// image, allowlisted font stacks), so
// the CSS built from them can never carry a script or an @import. The
// theme style is injected AFTER the member's layout CSS on their page, so
// the pickers win over a preset for the properties they set; custom CSS
// can still override them with !important.
// ---------- Profile fonts (v3.13) ----------
// TWO picks sharing one allowlist: `font` is the page text font, `name_font`
// is the display-name font. 5 system stacks (kept for back-compat) + 9
// Google Fonts: 4 elegant (Playfair Display, Cormorant Garamond, Great
// Vibes script, Cinzel) and 5 cool (Orbitron, Bangers, Press Start 2P,
// Audiowide, Creepster). The "monoton" id now loads Audiowide — Monoton's
// broken-up glyphs misread as other letters (A looks like Q), so the id
// was remapped instead of repaired; every existing pick keeps working and
// just renders the readable font. Each entry carries its full stack (with
// the page still looks right if the webfont fails) and, for webfonts, the
// Google css2 family param. Webfonts load ONLY from this map —
// ensureProfileFonts() builds the <link> from these params and nothing
// else, so a font URL can never be built from user input.
var THEME_FONTS = [
  { id: "", name: "System default" },
  { id: "serif", name: "Classic serif", css: 'Georgia,"Times New Roman",serif' },
  { id: "typewriter", name: "Typewriter", css: '"Courier New",Courier,monospace' },
  { id: "comic", name: "Comic / Chalkboard", css: '"Comic Sans MS","Chalkboard SE","Comic Neue",cursive' },
  { id: "rounded", name: "Rounded", css: '"Trebuchet MS",Verdana,sans-serif' },
  { id: "playfair", name: "Playfair Display — elegant serif", css: "'Playfair Display',Georgia,serif", google: "Playfair+Display:wght@400;700" },
  { id: "cormorant", name: "Cormorant Garamond — elegant serif", css: "'Cormorant Garamond',Georgia,serif", google: "Cormorant+Garamond:wght@500;600" },
  { id: "vibes", name: "Great Vibes — elegant script", css: "'Great Vibes','Segoe Script',cursive", google: "Great+Vibes" },
  { id: "cinzel", name: "Cinzel — Roman elegant", css: "'Cinzel',Georgia,serif", google: "Cinzel:wght@400;700" },
  { id: "orbitron", name: "Orbitron — futuristic", css: "'Orbitron','Segoe UI',sans-serif", google: "Orbitron:wght@500;700" },
  { id: "bangers", name: "Bangers — comic bold", css: "'Bangers','Comic Sans MS',cursive", google: "Bangers" },
  { id: "pressstart", name: "Press Start 2P — arcade pixel", css: '"Press Start 2P","Courier New",monospace', google: "Press+Start+2P" },
  { id: "monoton", name: "Neon retro — reads right (Audiowide)", css: "'Audiowide','Courier New',monospace", google: "Audiowide" },
  { id: "creepster", name: "Creepster — horror", css: "'Creepster',Georgia,serif", google: "Creepster" },
];
function themeFontCSS(id) {
  for (var i = 0; i < THEME_FONTS.length; i++) if (THEME_FONTS[i].id === id) return THEME_FONTS[i].css || "";
  return "";
}
function themeFontGoogle(id) {
  for (var i = 0; i < THEME_FONTS.length; i++) if (THEME_FONTS[i].id === id) return THEME_FONTS[i].google || "";
  return "";
}
// Google css2 family params a theme actually needs, deduped, allowlist-only.
// A bogus id (or an injection attempt) maps to "" and is never emitted.
function profileFontFamilies(theme) {
  var t = parseThemeClient(theme);
  var out = [];
  [t.name_font, t.font].forEach(function (id) {
    var g = themeFontGoogle(id);
    if (g && out.indexOf(g) === -1) out.push(g);
  });
  return out;
}
function profileFontsURL(theme) {
  var fams = profileFontFamilies(theme);
  if (!fams.length) return "";
  return "https://fonts.googleapis.com/css2?family=" + fams.join("&family=") + "&display=swap";
}
// Adds (or updates) the ONE Google Fonts <link> for this profile's fonts.
// No-op when the theme uses no webfonts; removes the link when not needed,
// so a profile that switches back to system fonts stops fetching them.
function ensureProfileFonts(theme) {
  if (typeof document === "undefined") return;
  var url = profileFontsURL(theme);
  var link = document.getElementById("dwc-profile-fonts");
  if (!url) { if (link) link.remove(); return; }
  if (!link) {
    link = document.createElement("link");
    link.id = "dwc-profile-fonts";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.getAttribute("href") !== url) link.setAttribute("href", url);
}
function parseThemeClient(stored) {
  var empty = { bg_color: "", bg_image_url: "", text_color: "", accent_color: "", font: "", name_font: "", glow: false, glow_color: "", outline_color: "", topfriends_count: 8, topfriends_side: "", feed_privacy: "public", divider: "", divider_color: "", divider_unlocks: [], website_buttons: false, custom_page_html: "" };
  if (!stored) return empty;
  var obj;
  try { obj = typeof stored === "string" ? JSON.parse(stored) : stored; } catch (e) { return empty; }
  if (!obj || typeof obj !== "object") return empty;
  var hex = function (v) { return /^#[0-9a-fA-F]{6}$/.test(String(v || "").trim()) ? String(v).trim() : ""; };
  var out = { bg_color: hex(obj.bg_color), bg_image_url: "", text_color: hex(obj.text_color), accent_color: hex(obj.accent_color), font: "", vibe: "", button_style: "", button_css: "", effects: [], bg_preset: "", comment_border_color: "", pic_size: "", pic_position: "", pic_frame: "", blood_color: "", gb_mode: "", gb_colors: [], buttons_side: "", buttons_show: true, video_url: "", video_file_url: "", ticker_source: "", hide_sections: [] };
  var img = String(obj.bg_image_url || "").trim().slice(0, 500);
  out.bg_image_url = /^https:\/\//i.test(img) ? img : "";
  out.font = themeFontCSS(obj.font) ? obj.font : "";
  out.name_font = themeFontCSS(obj.name_font) ? obj.name_font : "";
  // Font glow (v3.19) — checkbox + two colors, works with any font.
  // Colors are hex-validated; empty means "not picked" (the form shows
  // the defaults). Glow off means no glow CSS, even if colors are set.
  out.glow = obj.glow === true;
  out.glow_color = hex(obj.glow_color);
  out.outline_color = hex(obj.outline_color);
  // Member page layout (v3.20) — how many Top Friends show (3/4/5/8/10,
  // default 8), which side the Top Friends column sits on ("" = right
  // default, "left" swaps it with the info column), who can see the
  // member's post feed (public / friends / private), and the divider
  // between Top Friends and Page comments (any known design id).
  var tfc = Number(obj.topfriends_count);
  out.topfriends_count = [3, 4, 5, 8, 10].indexOf(tfc) >= 0 ? tfc : 8;
  out.topfriends_side = (String(obj.topfriends_side || "") === "left") ? "left" : "";
  out.feed_privacy = ["public", "friends", "private"].indexOf(obj.feed_privacy) >= 0 ? obj.feed_privacy : "public";
  // Website look (v3.20) — the Add me / Favorite / Add to group
  // buttons on a professional page are the member's choice: off by
  // default (contact is just the message link), on when they tick
  // "Show the buttons too" in the Website look box.
  out.website_buttons = obj.website_buttons === true;
  out.divider = DIVIDERS[String(obj.divider || "")] ? String(obj.divider) : "";
  out.divider_color = hex(obj.divider_color);
  var du = Array.isArray(obj.divider_unlocks) ? obj.divider_unlocks : [];
  out.divider_unlocks = du.map(function (k) { return String(k || ""); }).filter(function (k) { return DIVIDERS[k]; });
  // Custom page (v3.20) — sanitized HTML, renders only in website mode.
  out.custom_page_html = sanitizeCustomPageHtml(obj.custom_page_html);
  out.button_style = (typeof BUTTON_STYLES !== "undefined" && BUTTON_STYLES[obj.button_style]) ? obj.button_style : "";
  // Vibe (Taffy Layout Builder) — a full look, stored as one theme key.
  out.vibe = (typeof LAYOUT_VIBES !== "undefined" && LAYOUT_VIBES[obj.vibe]) ? String(obj.vibe) : "";
  out.button_css = String(obj.button_css || "").slice(0, 4000);
  var eff = Array.isArray(obj.effects) ? obj.effects : [];
  out.effects = eff.filter(function (e) { return MYSPACE_EFFECTS[e]; }).slice(0, 8);
  var presetIds = PRESET_BACKGROUNDS.map(function (p) { return p.id; });
  out.bg_preset = presetIds.indexOf(String(obj.bg_preset || "")) >= 0 ? String(obj.bg_preset || "") : "";
  // Background choices are either/or (v3.20): a custom picture and a
  // preset can never both be on — the picture wins. Same rule as the
  // server parseTheme, so the form and the live page can never disagree.
  if (out.bg_image_url) out.bg_preset = "";
  out.comment_border_color = hex(obj.comment_border_color);
  if (out.effects.indexOf("rgb-comment-border") >= 0) out.comment_border_color = "";
  // Animated rainbow background (v3.20) — the effect IS the background,
  // so it wins over a picture or a preset. Same rule as the server.
  if (out.effects.indexOf("animated-bg") >= 0) { out.bg_preset = ""; out.bg_image_url = ""; }
  out.pic_size = (obj.pic_size === "bigger" || obj.pic_size === "smaller") ? obj.pic_size : "";
  out.pic_position = (obj.pic_position === "normal" || obj.pic_position === "top") ? obj.pic_position : "";
  var frameIds = PIC_FRAMES.map(function (f) { return f.id; });
  out.pic_frame = frameIds.indexOf(String(obj.pic_frame || "")) >= 0 ? String(obj.pic_frame) : "";
  out.blood_color = hex(obj.blood_color);
  var gbModes = GB_FRAME_MODES.map(function (m) { return m.id; });
  out.gb_mode = gbModes.indexOf(String(obj.gb_mode || "")) >= 0 ? String(obj.gb_mode || "") : "";
  var gbCols = Array.isArray(obj.gb_colors) ? obj.gb_colors : [];
  out.gb_colors = gbCols.map(function (c) { return hex(c); }).filter(Boolean).slice(0, 3);
  // Chosen display badges (v3.9) — up to 2 known badge keys.
  var db = Array.isArray(obj.display_badges) ? obj.display_badges : [];
  out.display_badges = db.map(function (k) { return String(k || ""); }).filter(function (k) { return badgeByKeyClient(k); }).slice(0, 2);
  // Action buttons (v3.10) — which side they sit on ("" = left) and
  // whether they show at all (default true — hiding is opt-in).
  out.buttons_side = (String(obj.buttons_side || "") === "right") ? "right" : "";
  out.buttons_show = obj.buttons_show === false ? false : true;
  // Button size + which buttons show + professional-mode button
  // (v3.21) — the Buttons group in Edit Profile. Size "" = M, the
  // current size; "s" is the smallest clearly readable, "xl" decently
  // large. buttons_visible null = all show; an array lists exactly
  // which of add/message/favorite/group/subscribe show. pro_button_side
  // "" = left, "center" / "right" under the picture in professional
  // mode. pro_button_color any #rrggbb, "" = default.
  out.button_size = ["s", "l", "xl"].indexOf(String(obj.button_size || "")) >= 0 ? String(obj.button_size) : "";
  var bv = Array.isArray(obj.buttons_visible) ? obj.buttons_visible : null;
  out.buttons_visible = bv === null ? null : bv.map(function (k) { return String(k || ""); }).filter(function (k) { return ["add", "message", "favorite", "group", "subscribe"].indexOf(k) >= 0; });
  out.pro_button_side = (String(obj.pro_button_side || "") === "center" || String(obj.pro_button_side || "") === "right") ? String(obj.pro_button_side) : "";
  out.pro_button_color = hex(obj.pro_button_color);
  // One video per profile (v3.10) — a YouTube link (must carry a real
  // 11-char video id) or an uploaded clip served from R2.
  var vu = String(obj.video_url || "").trim().slice(0, 500);
  out.video_url = extractYouTubeId(vu) ? vu : "";
  var vf = String(obj.video_file_url || "").trim().slice(0, 500);
  out.video_file_url = (/^\/api\/files\?key=/i.test(vf) || /^https:\/\//i.test(vf)) ? vf : "";
  // Video size + centering + stretch (v3.22) — "" = Normal (current
  // size, default); "s" Small, "l" Big, "stretch" Stretch to fit.
  // video_align "" = standard arrangement; "center" locks it centered.
  out.video_size = ["s", "l", "stretch"].indexOf(String(obj.video_size || "")) >= 0 ? String(obj.video_size) : "";
  out.video_align = (String(obj.video_align || "") === "center") ? "center" : "";
  // Cover photo (v3.22) — "" = Small (current look, default); "big" =
  // tall cover area. Name placement: "" = under it (current look);
  // "left" / "right" = beside the picture.
  out.cover_size = (String(obj.cover_size || "") === "big") ? "big" : "";
  out.cover_name = ["left", "right"].indexOf(String(obj.cover_name || "")) >= 0 ? String(obj.cover_name) : "";
  // Ticker source (v3.10) — "" = the member's own text, "btc" = live
  // Bitcoin price from CoinGecko (free, no key, fetched client-side).
  out.ticker_source = (String(obj.ticker_source || "") === "btc") ? "btc" : "";
  // Hidden page sections (v3.10) — which card sections the member chose
  // to hide on their page (MySpace-style: show only what you want).
  var hs = Array.isArray(obj.hide_sections) ? obj.hide_sections : [];
  out.hide_sections = hs.map(function (k) { return String(k || ""); }).filter(function (k) { return SECTION_HIDE_IDS.indexOf(k) >= 0; }).slice(0, 10);
  return out;
}
// Section keys a member can hide on their page (v3.10).
var SECTION_HIDE_IDS = ["top8", "links", "seller", "about", "comments", "radio", "video", "relationship", "occupation", "listings"];
var SECTION_HIDE_LABELS = { top8: "Top Friends", links: "My links", seller: "What I sell", about: "About", comments: "Page comments", radio: "Steady Wave player", video: "My video", relationship: "Relationship status", occupation: "Occupation", listings: "My listings (professional mode)" };
// Plain-words keywords Taffy's builder matches to each hideable section
// (client-side only — the builder never leaves the browser).
var SECTION_KEYWORDS = {
  top8: ["top 8", "top friend"],
  links: ["link"],
  seller: ["sell", "seller"],
  about: ["about me", "about section"],
  comments: ["comment"],
  radio: ["radio", "steady wave"],
  video: ["video"],
  relationship: ["relationship", "single"],
  occupation: ["occupation", "job", "what i do"]
};
// Pull just the 11-char YouTube video id out of a watch / Shorts /
// embed / youtu.be link. Returns "" when there is no video id.
function extractYouTubeId(str) {
  if (!str) return "";
  var m = String(str).match(/(?:youtube\.com\/(?:watch\?[^#\s]*?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}
function themeCSS(theme) {
  var t = parseThemeClient(theme);
  var css = "";
  // Vibe (Taffy Layout Builder) — a full look: background, cards,
  // headings, text, links, avatar ring, buttons. It goes FIRST so the
  // member's own picks below (background, preset, text/accent, font,
  // button style) win over the vibe for that one thing.
  if (t.vibe && LAYOUT_VIBES[t.vibe]) {
    var v = LAYOUT_VIBES[t.vibe];
    var acc = t.accent_color || v.accent;
    css += ".dwc-myprofile{background:linear-gradient(160deg," + v.bg + " 0%," + v.bg2 + " 100%);font-family:" + v.font + ";}" +
      ".dwc-myprofile .card{background:" + v.card + ";border:1px solid " + v.cardBorder + ";border-radius:" + v.radius + ";}" +
      ".dwc-myprofile h2,.dwc-myprofile h3{color:" + v.heading + ";}" +
      (v.glow && v.glow !== "none" ? ".dwc-myprofile h2,.dwc-myprofile h3{text-shadow:" + v.glow + ";}" : "") +
      ".dwc-myprofile p,.dwc-myprofile li{color:" + v.text + ";}" +
      ".dwc-myprofile .dwc-meta{color:" + v.muted + ";}" +
      ".dwc-myprofile a{color:" + v.link + ";}" +
      ".dwc-myprofile .dwc-avatar{border:3px solid " + acc + ";}" +
      ".dwc-myprofile .btn{background:linear-gradient(90deg," + acc + "," + v.accent2 + ");}" +
      ".dwc-myprofile .dwc-topfriend{border-color:" + acc + ";}";
  }
  if (t.bg_color) css += ".dwc-myprofile{background-color:" + t.bg_color + ";}";
  if (t.bg_image_url) css += '.dwc-myprofile{background-image:url("' + t.bg_image_url.replace(/"/g, "") + '");background-size:cover;background-position:center;background-repeat:no-repeat;}';
  // Preset background (v3.9) — wins over the plain color/image pickers.
  if (t.bg_preset) {
    var preset = null;
    PRESET_BACKGROUNDS.forEach(function (p) { if (p.id === t.bg_preset) preset = p; });
    if (preset && preset.css) css += preset.css;
  }
  if (t.text_color) css += ".dwc-myprofile{color:" + t.text_color + ";}.dwc-myprofile p,.dwc-myprofile li{color:" + t.text_color + ";}";
  if (t.accent_color) css += ".dwc-myprofile a{color:" + t.accent_color + ";}.dwc-myprofile h2,.dwc-myprofile h3{color:" + t.accent_color + ";}.dwc-myprofile .dwc-topfriend{border-color:" + t.accent_color + ";}";
  if (t.font) css += ".dwc-myprofile{font-family:" + themeFontCSS(t.font) + ";}";
  // Display-name font (v3.13) — the name heading only, on the real page
  // (h2 inside .dwc-profile-row) and in the Edit Profile / store preview
  // (h3 inside .dwc-mypage-head in the preview box). Comes after the body
  // font rule so it wins for the name; the vibe's heading color still
  // applies, and custom CSS can override with !important as usual.
  if (t.name_font) css += ".dwc-myprofile .dwc-profile-row h2,.dwc-myprofile.dwc-previewbox .dwc-mypage-head h3,.dwc-myprofile .dwc-website-banner-name{font-family:" + themeFontCSS(t.name_font) + ";}";
  // Font glow (v3.19) — member-picked glow + outline for page text and
  // display name, works with ANY font in the list. Comes after the vibe
  // and font rules so the member's glow wins. paint-order:stroke fill
  // keeps the 1px outline behind the glyph fill so small text stays
  // readable; the glow is a plain text-shadow in the chosen color.
  if (t.glow) {
    var gc = t.glow_color || "#00e5ff";
    var oc = t.outline_color || "#000000";
    css += ".dwc-myprofile h2,.dwc-myprofile h3,.dwc-myprofile p,.dwc-myprofile li,.dwc-myprofile .dwc-meta,.dwc-myprofile a,.dwc-myprofile .dwc-profile-row h2,.dwc-myprofile.dwc-previewbox .dwc-mypage-head h3{text-shadow:0 0 6px " + gc + ",0 0 16px " + gc + ",0 0 32px " + gc + ";-webkit-text-stroke:1px " + oc + ";paint-order:stroke fill;}";
  }
  // Buttons: preset first, then the member's own button CSS on top.
  if (t.button_style && BUTTON_STYLES[t.button_style]) css += BUTTON_STYLES[t.button_style].css;
  if (t.button_css) css += sanitizeLayoutCssClient(t.button_css);
  // Comment-picture border color (v3.9) — any color the member picked
  // (the RGB effect clears it on save, so the two never fight).
  if (t.comment_border_color) css += ".dwc-myprofile .dwc-page-comment .dwc-avatar{border:3px solid " + t.comment_border_color + ";}";
  // MySpace effects (opt-in toggles).
  (t.effects || []).forEach(function (e) { if (MYSPACE_EFFECTS[e]) css += MYSPACE_EFFECTS[e].css; });
  // Per-link button styles (button system v3.12) — ride with the
  // theme CSS so they apply on the real page and in every preview.
  Object.keys(LINK_BUTTON_STYLES).forEach(function (k) { css += LINK_BUTTON_STYLES[k].css; });
  return css;
}

// Layout vibes — real palettes for the Taffy Layout Builder. Picking a
// vibe is a real theme setting (theme.vibe): it sets the page's
// background, cards, headings, links, avatar ring, and buttons, and it
// shows in the live preview and on the saved page. No AI involved.
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
// Button style presets — members pick one, or write their own button CSS.
// Each preset's CSS targets the buttons on THEIR OWN member page only
// (.dwc-myprofile .btn and .dwc-pill). Picked in Edit Profile, stored in
// the theme JSON as button_style; custom CSS lives in button_css.
var BUTTON_STYLES = {
  neon: { label: "Neon Glow", css: ".dwc-myprofile .btn,.dwc-myprofile .dwc-pill{background:linear-gradient(90deg,#ff2d95,#7c4dff);color:#fff;border:2px solid #ff2d95;box-shadow:0 0 12px rgba(255,45,149,.8),0 0 28px rgba(255,45,149,.45);border-radius:12px;}" },
  arcade: { label: "Arcade", css: ".dwc-myprofile .btn,.dwc-myprofile .dwc-pill{background:linear-gradient(90deg,#00e5ff,#ff2d95);color:#04122b;font-weight:900;border:3px solid #fff;border-radius:6px;box-shadow:0 4px 0 #7c4dff;}" },
  "insert-coin": { label: "Insert Coin", css: ".dwc-myprofile .btn,.dwc-myprofile .dwc-pill{background:linear-gradient(90deg,#ffd700,#ff9a00,#ffd700);color:#1a1405;font-weight:900;border:3px solid #fff;border-radius:8px;box-shadow:0 0 14px rgba(255,215,0,.8);animation:dwcCoinBlink 1.6s steps(2,start) infinite;}" },
  gradient: { label: "RGB Gradient", css: ".dwc-myprofile .btn,.dwc-myprofile .dwc-pill{background:linear-gradient(90deg,#ff2d95,#7c4dff,#00e5ff);color:#fff;border:none;border-radius:12px;}" },
  rounded: { label: "Soft Pill", css: ".dwc-myprofile .btn,.dwc-myprofile .dwc-pill{border-radius:999px;padding:10px 22px;}" },
  retro: { label: "MySpace 2005", css: ".dwc-myprofile .btn,.dwc-myprofile .dwc-pill{background:#003399;color:#fff;border:2px solid #6699cc;border-radius:4px;box-shadow:none;font-family:Verdana,Tahoma,Arial,sans-serif;}" },
  gold: { label: "Gold Luxe", css: ".dwc-myprofile .btn,.dwc-myprofile .dwc-pill{background:linear-gradient(90deg,#d4af37,#ffec99,#d4af37);color:#1a1405;border:2px solid #d4af37;box-shadow:0 0 12px rgba(212,175,55,.55);border-radius:10px;}" },
  ghost: { label: "Ghost", css: ".dwc-myprofile .btn,.dwc-myprofile .dwc-pill{background:transparent;border:2px solid currentColor;box-shadow:none;}" }
};
// Per-link button styles (button system v3.12) — the same 8 button
// looks, restated for one link at a time. Derived from BUTTON_STYLES
// so the two can never drift apart. The selector is more specific
// than the page-wide button style, so a link's own style wins over it.
var LINK_BUTTON_STYLES = {};
Object.keys(BUTTON_STYLES).forEach(function (k) {
  LINK_BUTTON_STYLES[k] = {
    label: BUTTON_STYLES[k].label,
    css: BUTTON_STYLES[k].css.replace(/\.dwc-myprofile \.btn,\.dwc-myprofile \.dwc-pill/g, ".dwc-myprofile a.dwc-linkbtn.dwc-linkbtn-" + k)
  };
});
// MySpace effects — opt-in toggles, stored in the theme JSON as effects[].
// Each effect is CSS scoped to .dwc-myprofile (their page only). GIF
// backgrounds work through the background-image URL picker (any https URL,
// GIF included) — no separate effect needed for that.
var MYSPACE_EFFECTS = {
  "animated-bg": { label: "Animated rainbow background", desc: "Your page background slowly shifts through pink, purple, blue and green. (overrides your background color/image)", css: ".dwc-myprofile{background:linear-gradient(135deg,#ff2d95,#7c4dff,#00e5ff,#39ff88);background-size:400% 400%;animation:dwcBgShift 12s ease infinite;}" },
  "starfield-drift": { label: "Starfield drift — stars keep flying past", desc: "Stars drift across your page, left, forever, looping seamlessly. Works over any background or picture.", css: ".dwc-myprofile{position:relative;}.dwc-myprofile::after{content:'';position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(2px 2px at 12% 22%,#fff,transparent),radial-gradient(1.5px 1.5px at 28% 68%,#ffe27a,transparent),radial-gradient(2px 2px at 44% 38%,#00e5ff,transparent),radial-gradient(1.5px 1.5px at 58% 82%,#ff2d95,transparent),radial-gradient(2px 2px at 72% 14%,#fff,transparent),radial-gradient(1px 1px at 84% 58%,#fff,transparent),radial-gradient(1.5px 1.5px at 94% 30%,#00e5ff,transparent),radial-gradient(2px 2px at 8% 88%,#ffe27a,transparent);background-size:512px 512px;background-repeat:repeat;animation:dwcStarDrift 30s linear infinite;}" },
  "sparkle": { label: "Sparkle", desc: "A twinkling star field over your page.", css: ".dwc-myprofile{position:relative;}.dwc-myprofile::before{content:'';position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(2px 2px at 20% 30%,#fff,transparent),radial-gradient(2px 2px at 70% 60%,#ffe27a,transparent),radial-gradient(1.5px 1.5px at 40% 80%,#00e5ff,transparent),radial-gradient(2px 2px at 85% 20%,#ff2d95,transparent);animation:dwcSparkleTwinkle 2.4s ease-in-out infinite;}" },
  "glow-text": { label: "Glowing headings", desc: "Your headings glow.", css: ".dwc-myprofile h2,.dwc-myprofile h3{text-shadow:0 0 8px currentColor,0 0 22px currentColor;}" },
  // v3.9 — scoped sparkles + ticker + comment-picture borders.
  "sparkle-name": { label: "Sparkle over name", desc: "Twinkling stars over your display name only.", css: ".dwc-myprofile .dwc-mypage-head h2{position:relative;}.dwc-myprofile .dwc-mypage-head h2::after{content:'';position:absolute;inset:-4px -10px;pointer-events:none;background-image:radial-gradient(2px 2px at 20% 40%,#fff,transparent),radial-gradient(1.5px 1.5px at 60% 20%,#ffe27a,transparent),radial-gradient(2px 2px at 85% 60%,#00e5ff,transparent),radial-gradient(1.5px 1.5px at 40% 80%,#ff2d95,transparent);animation:dwcSparkleTwinkle 2.4s ease-in-out infinite;}" },
  "sparkle-banner": { label: "Sparkle over banner", desc: "Twinkling stars over your cover photo only.", css: ".dwc-myprofile .dwc-banner{position:relative;}.dwc-myprofile .dwc-banner::after{content:'';position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(2px 2px at 15% 30%,#fff,transparent),radial-gradient(2px 2px at 55% 70%,#ffe27a,transparent),radial-gradient(1.5px 1.5px at 80% 25%,#00e5ff,transparent),radial-gradient(2px 2px at 35% 60%,#ff2d95,transparent);animation:dwcSparkleTwinkle 2.4s ease-in-out infinite;}" },
  "ticker-effect": { label: "Scrolling ticker or headline", desc: "A scrolling headline above your page (your ticker text, or your bio line when you haven't set one). Your own ticker wins — this only shows when your ticker is off.", css: "" },
  "rgb-comment-border": { label: "RGB border for comment pictures", desc: "Comment avatars on your page get an animated RGB gradient border. Picking a custom border color below turns this off.", css: ".dwc-myprofile .dwc-page-comment .dwc-avatar{border:3px solid #ff2d95;animation:dwcRgbBorderGlow 3s linear infinite;}" }
};
// Preset backgrounds (v3.9) — CSS-only picks in Chris's aesthetic. The
// chosen preset becomes the profile page background (applied in themeCSS,
// after the plain color/image pickers so it wins). "vaporwave" uses the
// site's signature vapor-bg.jpg, already on the site.
var PRESET_BACKGROUNDS = [
  { id: "", name: "None / default", css: "", swatch: "linear-gradient(135deg,#0b0b14,#141424)" },
  { id: "vaporwave", name: "Vaporwave Grid", desc: "The signature — pink smoke left, cyan smoke right, neon grid floor.", css: ".dwc-myprofile{background-image:url('images/vapor-bg.jpg');background-size:cover;background-position:center;background-repeat:no-repeat;}", swatch: "linear-gradient(135deg,#ff2d95 0%,#7c4dff 45%,#00e5ff 100%)" },
  { id: "rgb-gradient", name: "Neon RGB Gradient", desc: "Animated pink → purple → cyan → green.", css: ".dwc-myprofile{background:linear-gradient(135deg,#ff2d95,#7c4dff,#00e5ff,#39ff88);background-size:400% 400%;animation:dwcBgShift 12s ease infinite;}", swatch: "linear-gradient(135deg,#ff2d95,#7c4dff,#00e5ff,#39ff88)" },
  { id: "midnight-neon", name: "Midnight Neon", desc: "Near-black with a neon glow edge.", css: ".dwc-myprofile{background:#05050a;box-shadow:inset 0 0 60px rgba(0,229,255,.25),inset 0 0 120px rgba(255,45,149,.15);}", swatch: "linear-gradient(135deg,#05050a,#0d0d1f 60%,#00e5ff)" },
  { id: "sunset-drive", name: "Sunset Drive", desc: "Pink, purple and orange — driving into the sunset.", css: ".dwc-myprofile{background:linear-gradient(160deg,#ff2d95 0%,#7c4dff 45%,#ff9a00 100%);}", swatch: "linear-gradient(160deg,#ff2d95,#7c4dff,#ff9a00)" },
  { id: "cotton-candy", name: "Cotton Candy", desc: "Soft pink and cyan pastels.", css: ".dwc-myprofile{background:linear-gradient(160deg,#ffd7ef 0%,#ffb3e6 40%,#a8e6ff 100%);}", swatch: "linear-gradient(160deg,#ffd7ef,#ffb3e6,#a8e6ff)" },
  { id: "blackout", name: "Blackout", desc: "Pure dark — the site background, nothing else.", css: ".dwc-myprofile{background:#0b0b14;}", swatch: "linear-gradient(135deg,#0b0b14,#0b0b14)" }
];
// Zodiac signs for the website-look "Sign" field — symbol + a short
// blurb in Chris's voice (fun, not horoscope-woo).
var ZODIAC_SIGNS = {
  aries: { name: "Aries", symbol: "♈", blurb: "First one in, last one out. Runs on impulse and pure momentum — if there's a wall, an Aries is already through it." },
  taurus: { name: "Taurus", symbol: "♉", blurb: "Stubborn in the best way. Loyal, grounded, and not moving for anyone — but if you're in their circle, you're fed and protected." },
  gemini: { name: "Gemini", symbol: "♊", blurb: "Two minds, twice the chaos, twice the fun. Can talk to anybody about anything and somehow mean all of it." },
  cancer: { name: "Cancer", symbol: "♋", blurb: "Soft shell, steel core. Remembers everything, feels everything, and will absolutely feed you while doing it." },
  leo: { name: "Leo", symbol: "♌", blurb: "Born for the spotlight and not even sorry about it. Big heart, bigger presence — when a Leo walks in, the room knows." },
  virgo: { name: "Virgo", symbol: "♍", blurb: "Notices what everyone else misses. The one who actually reads the fine print and fixes it before it breaks." },
  libra: { name: "Libra", symbol: "♎", blurb: "Peacekeeper with a steel spine underneath. Wants everything fair and everybody vibing — and will argue politely until it is." },
  scorpio: { name: "Scorpio", symbol: "♏", blurb: "Quiet, intense, and ten steps ahead. Doesn't say much — doesn't have to. Loyalty like this doesn't come around twice." },
  sagittarius: { name: "Sagittarius", symbol: "♐", blurb: "Always aiming at the next horizon. Restless, honest to a fault, and allergic to being fenced in." },
  capricorn: { name: "Capricorn", symbol: "♑", blurb: "Slow climb, big summit. Patient, practical, and quietly outworking everybody while nobody's watching." },
  aquarius: { name: "Aquarius", symbol: "♒", blurb: "Weird on purpose and proud of it. Sees the future before it shows up and builds it anyway." },
  pisces: { name: "Pisces", symbol: "♓", blurb: "Dreamer with a deep current. Feels the room before a word is said and turns it into art, music, or a whole world." }
};
// Picture frames (v3.9) — the ring around the profile picture. Free
// frames are open to everyone; the rest unlock with engagement (see
// UNLOCKS in the server _lib.js — same thresholds, kept in sync here so
// the picker can show what's locked and why).
var PIC_FRAMES = [
  { id: "none", name: "None", desc: "No frame.", locked: false },
  { id: "neon", name: "Neon", desc: "Cyan glow.", locked: false },
  { id: "rgb", name: "RGB Gradient", desc: "Animated gradient border.", locked: false },
  { id: "rgb-rotating", name: "RGB Rotating", desc: "A circling RGB gradient ring.", locked: true, unlockKey: "frame-rgb-rotating", requirement: "Use the site 7 different days" },
  { id: "gold", name: "Gold", desc: "Golden frame.", locked: false },
  { id: "black", name: "Black", desc: "Simple black frame.", locked: false },
  { id: "wooden", name: "Wooden", desc: "Warm wood tones.", locked: true, unlockKey: "frame-wooden", requirement: "Post 10 times" },
  { id: "gothic", name: "Gothic", desc: "Black and white stripes — Tim Burton style.", locked: true, unlockKey: "frame-gothic", requirement: "Leave 25 comments" },
  { id: "blood", name: "Blood dripping", desc: "Dripping ooze — pick your drip color.", locked: true, unlockKey: "frame-blood", requirement: "Give or get 25 hearts" },
  { id: "gb", name: "GB frame", desc: "Your picture inside a Game Boy.", locked: true, unlockKey: "frame-gb", requirement: "Post 25 times" },
  { id: "gba", name: "GBA frame", desc: "Your picture inside a Game Boy Advance.", locked: true, unlockKey: "frame-gba", requirement: "Post 50 times and use the site 14 different days" },
  { id: "vita-nova", name: "VITA NOVA frame", desc: "Gold and violet — the Vita Nova Records frame.", locked: true, unlockKey: "frame-vita-nova", requirement: "Fully set up your profile" }
];
// GB/GBA handheld body colors — preset mixes, or the member's own 3.
var GB_FRAME_MODES = [
  { id: "", name: "Default (GameCube mix)" },
  { id: "gamecube", name: "GameCube mix" },
  { id: "gb", name: "Game Boy (classic grey)" },
  { id: "gba", name: "GBA (indigo)" },
  { id: "custom", name: "My own 3 colors" }
];
var GB_FRAME_COLORS = {
  gamecube: ["#5a5fcf", "#7c4dff", "#1a1a2e"],
  gb: ["#d8d8d0", "#9a9a92", "#555550"],
  gba: ["#6b5ce7", "#8a7cff", "#3d2b8f"]
};
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

// Custom-page HTML sanitizer (v3.20) — client mirror of the server one
// in functions/api/_lib.js. Same rules: small allowlist of plain tags,
// script/iframe/object/embed/form/input dropped with contents, on*
// handlers + inline styles stripped, javascript:/data: links killed,
// images https:// or site-relative / only. Used for the Edit Profile
// live preview and the render path (defense in depth — the server
// already sanitized on save).
var CUSTOM_PAGE_TAGS = ["div", "section", "article", "header", "footer", "nav", "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "img", "ul", "ol", "li", "span", "strong", "em", "b", "i", "u", "small", "br", "hr", "blockquote", "figure", "figcaption"];
function sanitizeCustomPageHtml(html) {
  var out = String(html || "").slice(0, 8000);
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<(script|style|iframe|object|embed|form|textarea|select|button)[\s\S]*?<\/\1\s*>/gi, "");
  out = out.replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form|input|textarea|select|button|title)\b[^>]*>/gi, "");
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/href\s*=\s*"\s*(javascript|vbscript|data)\s*:[^"]*"/gi, 'href="#"');
  out = out.replace(/href\s*=\s*'\s*(javascript|vbscript|data)\s*:[^']*'/gi, "href='#'");
  out = out.replace(/href\s*=\s*(javascript|vbscript|data)\s*:[^\s>]*/gi, 'href="#"');
  out = out.replace(/src\s*=\s*"([^"]*)"/gi, function (_m, v) {
    var u = String(v || "").trim();
    return (/^https:\/\//i.test(u) || u.indexOf("/") === 0) ? 'src="' + u.replace(/"/g, "") + '"' : 'src=""';
  });
  out = out.replace(/src\s*=\s*'([^']*)'/gi, function (_m, v) {
    var u = String(v || "").trim();
    return (/^https:\/\//i.test(u) || u.indexOf("/") === 0) ? "src='" + u.replace(/'/g, "") + "'" : "src=''";
  });
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, function (m, tag) {
    return CUSTOM_PAGE_TAGS.indexOf(tag.toLowerCase()) >= 0 ? m : "";
  });
  return out.trim();
}

// Scope a member's hand-written CSS to their profile container.
// Rules that already mention .dwc-myprofile are left alone; bare
// selectors get ".dwc-myprofile " in front, so a layout can never
// restyle the rest of the site. @keyframes blocks are left alone
// (their inner selectors are from/to/percentages), and @media /
// @supports blocks are scoped recursively. The sanitizer is still
// the security boundary — this only limits WHERE rules apply.
function scopeProfileCss(css) {
  var src = String(css || "").replace(/\/\*[\s\S]*?\*\//g, "");
  var out = "";
  var i = 0, n = src.length;
  while (i < n) {
    while (i < n && /\s/.test(src[i])) i++;
    if (i >= n) break;
    var start = i;
    while (i < n && src[i] !== "{" && src[i] !== ";") i++;
    var head = src.slice(start, i).trim();
    if (i < n && src[i] === ";") { out += head + ";"; i++; continue; }
    if (i >= n) { if (head) out += head; break; }
    var depth = 0, j = i;
    while (j < n) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") { depth--; if (depth === 0) break; }
      j++;
    }
    var body = src.slice(i + 1, j);
    var close = (j < n) ? "}" : "";
    if (/^@keyframes\b/i.test(head) || /^@font-face\b/i.test(head)) {
      out += head + "{" + body + close;
    } else if (/^@media\b/i.test(head) || /^@supports\b/i.test(head)) {
      out += head + "{" + scopeProfileCss(body) + close;
    } else if (head) {
      var sels = head.split(",").map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
        if (s.indexOf(".dwc-myprofile") >= 0) return s;
        return ".dwc-myprofile " + s;
      });
      out += sels.join(", ") + "{" + body + close;
    }
    i = j + 1;
  }
  return out;
}

// My links editor rows (v3.4, button system v3.12) — one row per link:
// label + URL + a button style just for that link + remove.
// Renders the member's real links; a blank row is always available so
// adding the first link is one tap.
function myLinksRowsHTML(links) {
  var styleOpts = function (sel) {
    return '<option value=""' + (!sel ? " selected" : "") + '>Page buttons</option>' +
      Object.keys(LINK_BUTTON_STYLES).map(function (k) {
        return '<option value="' + k + '"' + (sel === k ? " selected" : "") + ">" + esc(LINK_BUTTON_STYLES[k].label) + "</option>";
      }).join("");
  };
  var rows = (links || []).slice(0, 6).map(function (l) {
    return '<div class="dwc-linkrow"><input name="link_label" maxlength="40" placeholder="Label — e.g. My shop" value="' + esc(l.label || "") + '">' +
      '<input name="link_url" maxlength="500" placeholder="https://…" value="' + esc(l.url || "") + '">' +
      '<select name="link_style" title="Button style for this link">' + styleOpts(l.style || "") + "</select>" +
      '<button type="button" class="btn ghost small" onclick="DWC.removeLinkRow(this)" title="Remove this link">✕</button></div>';
  }).join("");
  if (!rows) {
    rows = '<div class="dwc-linkrow"><input name="link_label" maxlength="40" placeholder="Label — e.g. My shop">' +
      '<input name="link_url" maxlength="500" placeholder="https://…">' +
      '<select name="link_style" title="Button style for this link">' + styleOpts("") + "</select>" +
      '<button type="button" class="btn ghost small" onclick="DWC.removeLinkRow(this)" title="Remove this link">✕</button></div>';
  }
  return rows;
}
function myLinksButtonsHTML(links) {
  if (!links || !links.length) return "";
  return '<div class="dwc-links">' + links.map(function (l) {
    var cls = (l.style && LINK_BUTTON_STYLES[l.style]) ? " dwc-linkbtn-" + l.style : "";
    return '<a class="btn dwc-linkbtn' + cls + '" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + ' ↗</a>';
  }).join("") + "</div>";
}

// The layout preview in Edit Profile — shows the member's REAL page
// (their bio, their Top Friends, their links), never fake demo content.
// Empty sections are left out entirely so the preview is honest.
function layoutPreviewInnerHTML(p) {
  var friends = p && p.top_friend_ids ? p.top_friend_ids : [];
  var th = parseThemeClient(p && p.profile_theme);
  var hidden = function (k) { return (th.hide_sections || []).indexOf(k) >= 0; };
  var top8 = "";
  if (friends.length && !hidden("top8")) {
    top8 = '<div class="card"><h3>🌟 Top Friends</h3><p style="color:var(--muted)">Your ' + friends.length + ' Top Friend' + (friends.length === 1 ? "" : "s") + ' show here.</p></div>';
  }
  // v3.10 — the preview shows the buttons/video side row too, so the
  // member (and Taffy's builder) can see the layout. pointer-events
  // off: it's a preview, the buttons can't be clicked here.
  // v3.21 — same Connect card as the live page, so the preview matches.
  var sideRow = profileSideRowHTML(p, th);
  if (sideRow) sideRow = '<section class="card dwc-connect-card"><h3 style="margin-top:0">💬 Connect</h3>' + sideRow + "</section>";
  // Website look ON: the real page shows the website-mode actions
  // (Message button + video, no 2×2 block) — the preview must match
  // what visitors actually see, so render those instead of the row.
  var actionsBlock = (p && p.website_mode) ? profileActionsHTML(p, true, th) : sideRow;
  // Website look — the five fields as website sections, plus an honest
  // note for anything filled in but not switched on (so a filled-in
  // field that doesn't show is never a mystery). Professional mode
  // (2026-11-21) hides them all on the live page, whatever the Show
  // boxes say — the preview dims them with that note instead.
  var website = "";
  var show = (p && p.website_show) || {};
  if (p) {
    website = websiteSectionsHTML(p, th, true);
    var offBits = [];
    if (p.hobbies && !show.hobbies) offBits.push("Hobbies");
    if (p.workplace && !show.workplace) offBits.push("Where I work");
    if (p.relationship_status && !show.relationship) offBits.push("Relationship status");
    if (p.birthsign && !show.sign) offBits.push("Sign");
    if (p.accomplishments && !show.accomplishments) offBits.push("Recent accomplishments");
    if (offBits.length) website += '<p style="color:var(--muted);font-size:13px;margin:0 0 8px">👁️ Hidden — tick Show to publish: ' + esc(offBits.join(", ")) + '.</p>';
    if (p.website_mode && (p.hobbies || p.workplace || p.relationship_status || p.birthsign || p.accomplishments)) website += '<p style="color:var(--muted);font-size:13px;margin:0 0 8px">👁️ Professional mode is on — the bits above stay hidden on your page until you turn it off.</p>';
  }
  // Hidden sections — one line so the member sees the hide worked.
  var hiddenLabels = (th.hide_sections || []).map(function (k) { return SECTION_HIDE_LABELS[k] || k; });
  var hiddenNote = hiddenLabels.length ? '<p style="color:var(--muted);font-size:13px;margin:0 0 8px">🙈 Hidden on your page: ' + esc(hiddenLabels.join(", ")) + '.</p>' : "";
  // v3.21 — the bio lives inside the grouped About card now
  // (websiteSectionsHTML above), so there is no separate About card.
  // Button size — the member's pick, so the preview shows it too.
  var btnSizeCls = th.button_size ? " dwc-btn-" + th.button_size : "";
  // Custom page (v3.20) — website mode + the member's own HTML: their
  // code IS the page, so the preview shows it (sanitized) instead of
  // the MySpace columns. The actions row (message link) still shows
  // below it, like on the real page.
  if (p && p.website_mode && th.custom_page_html) {
    return '<div class="dwc-myprofile dwc-previewbox' + btnSizeCls + '">' +
      '<div class="dwc-custom-page">' + sanitizeCustomPageHtml(th.custom_page_html) + "</div>" +
      '<div style="pointer-events:none">' + actionsBlock + "</div>" +
      '<p style="color:var(--muted);font-size:13px">Your listings still show below this on your page.</p>' +
      "</div>";
  }
  return '<div class="dwc-myprofile dwc-previewbox' + btnSizeCls + '">' +
    tickerHTML(p, th) +
    '<div class="dwc-mypage-head">' + (p && p.avatar_url ? '<img class="dwc-avatar" src="' + esc(p.avatar_url) + '" alt="" style="width:64px;height:64px">' : '<span class="dwc-avatar dwc-avatar-none">🍬</span>') + '<div><h3 style="margin:0">@' + esc(p ? (p.username || "yourname") : "yourname") + '</h3><p class="dwc-meta">' + esc(!hidden("occupation") && p && p.occupation ? p.occupation : "your vibe here") + "</p></div></div>" +
    '<div style="pointer-events:none">' + actionsBlock + "</div>" +
    website +
    top8 +
    hiddenNote +
    "</div>";
}
function applyPreviewCSS(css) {
  var clean = scopeProfileCss(sanitizeLayoutCssClient(css || ""));
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

// ---------- Post videos (v3.5) ----------
// Same locked/blurred rules as photos: pay-locked shows a locked preview
// (blurred first frame, no controls — the unlock path is the same private
// chat as photos), blurred shows the video blurred with the same
// tap-to-reveal button, otherwise a normal <video>.
function postVideoHTML(p) {
  if (!p.video_url) return "";
  var mine = state.profile && state.profile.id === p.author_id;
  var locked = !!p.pay_unlock && p.price_cents > 0 && !mine;
  var blurred = !!p.blur_photo && !mine;
  if (locked) {
    return '<div class="dwc-photowrap"><video class="dwc-post-video dwc-img-locked" preload="metadata" playsinline muted src="' + esc(p.video_url) + '"></video>' +
      '<div class="dwc-photo-overlay"><span>🔒 Locked — Pay to unlock · ' + money(p.price_cents) + '</span></div></div>';
  }
  if (blurred) {
    return '<div class="dwc-photowrap"><video class="dwc-post-video dwc-img-blurred" controls preload="metadata" playsinline src="' + esc(p.video_url) + '"></video>' +
      '<button type="button" class="dwc-reveal-btn" onclick="DWC.toggleBlur(this)">👁 Blurred video — tap to reveal</button></div>';
  }
  return '<video class="dwc-post-video" controls preload="metadata" playsinline src="' + esc(p.video_url) + '"></video>';
}

// Event posts — "📅 Dec 13 · 12–6 PM · [place]" (only the parts given).
function eventLineHTML(p) {
  if (!p || p.kind !== "event") return "";
  var parts = [];
  if (p.event_date) {
    var d = new Date(p.event_date + "T12:00:00");
    if (!isNaN(d.getTime())) parts.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    else parts.push(p.event_date);
  }
  if (p.event_time) parts.push(p.event_time);
  if (p.event_place) parts.push(p.event_place);
  if (!parts.length) return "";
  return '<p class="dwc-event-line">📅 ' + esc(parts.join(" · ")) + "</p>";
}

// Feed redesign (v3.14) — one scrolling feed, Reddit-style: a single
// vertical list, one card after another, full feed width, going DOWN.
// No multi-column grid for posts anywhere in the community feed.
// A post can carry one photo, one short video, and one GIF embed —
// each becomes a carousel slide; one slide = shown as-is, several =
// carousel with dots + arrows underneath.
function postTypeLabel(p) {
  if (p.kind === "event") return "📅 Event";
  if (p.kind === "card_auth") return "🔍 Card Check";
  if (p.category === "News") return "📰 News";
  if (p.kind === "announcement") return "📢 Announcement";
  return "💬 Post";
}
function postMediaSlides(p) {
  var slides = [];
  var ph = postPhotoHTML(p);
  if (ph) slides.push(ph);
  var vid = postVideoHTML(p);
  if (vid) slides.push(vid);
  var gif = gifEmbedHTML(p.gif_url, p.gif_label);
  if (gif) slides.push(gif);
  var yt = youtubeEmbedHTML(p.body || "");
  if (yt) slides.push(yt);
  return slides;
}
function postMediaHTML(p) {
  var slides = postMediaSlides(p);
  if (!slides.length) return "";
  if (slides.length === 1) return '<div class="dwc-feed-media">' + slides[0] + "</div>";
  var dots = slides.map(function (_, i) {
    return '<button type="button" class="dwc-dot' + (i === 0 ? " on" : "") + '" data-slide="' + i + '" onclick="DWC.carouselGo(' + p.id + ", " + i + ', this)" aria-label="Show picture ' + (i + 1) + " of " + slides.length + '"></button>';
  }).join("");
  var inner = slides.map(function (s, i) {
    return '<div class="dwc-slide' + (i === 0 ? " on" : "") + '" data-slide="' + i + '"' + (i === 0 ? "" : " hidden") + ">" + s + "</div>";
  }).join("");
  return '<div class="dwc-carousel" data-post="' + p.id + '">' +
    '<div class="dwc-slides">' + inner + "</div>" +
    '<button type="button" class="dwc-car-arrow dwc-car-prev" onclick="DWC.carouselStep(' + p.id + ', -1, this)" aria-label="Previous picture">‹</button>' +
    '<button type="button" class="dwc-car-arrow dwc-car-next" onclick="DWC.carouselStep(' + p.id + ', 1, this)" aria-label="Next picture">›</button>' +
    '<div class="dwc-dots" role="tablist" aria-label="Pictures in this post">' + dots + "</div></div>";
}
function postCardHTML(p) {
  var isCreator = !!p.is_creator;
  var priceLabel = isCreator ? (p.price_cents > 0 ? money(p.price_cents) : "Free") : "";
  var isMine = state.profile && state.profile.id === p.author_id;
  var isOp = state.profile && state.profile.is_operator;
  var isAdmin = state.profile && state.profile.role === "admin";
  var canEdit = isMine || isOp;
  // Team moderation (v3.18) — admins can delete any post (never edit
  // one that isn't theirs); the ⋯ menu shows for them with Delete only.
  var canDeletePost = isMine || isOp || isAdmin;
  var editsUsed = p.edit_count || 0;
  var isNews = p.category === "News";
  var long = (p.body || "").length > 280;
  var saved = isSavedKey("post-" + p.id);
  return '<article class="card dwc-post dwc-feed-card' + (p.kind === "announcement" ? " dwc-post-announcement" : "") + '" data-post-id="' + p.id + '">' +
    '<div class="dwc-feed-head">' +
      '<span class="dwc-feed-who">👤 <a href="#/member/' + p.author_id + '" class="dwc-titlelink"><strong>@' + esc(p.author_username) + "</strong></a>" + achBadgeIconsHTML(p.author_badges) + (p.author_occupation ? ' <span class="dwc-feed-occ">· ' + esc(p.author_occupation) + "</span>" : "") + "</span>" +
      '<span class="dwc-feed-right"><span class="dwc-feed-when">' + fmtDateTime(p.created_at) + "</span>" +
      (canEdit || isAdmin ? '<span class="dwc-feed-menuwrap"><button type="button" class="dwc-feed-dots" onclick="DWC.togglePostMenu(' + p.id + ', this)" aria-label="Post options" aria-haspopup="true">⋯</button>' +
        '<span class="dwc-feed-menu" id="dwc-menu-' + p.id + '" hidden>' +
          (canEdit ? (editsUsed >= 3
            ? '<span class="dwc-feed-menu-note">No edits left — 3/3 used</span>'
            : '<button type="button" onclick="DWC.editPost(' + p.id + ')">✏️ Edit</button>') +
          '<button type="button" onclick="DWC.showEditHistory(' + p.id + ')">🕘 Edit history</button>' : "") +
          (canDeletePost ? '<button type="button" onclick="DWC.deletePost(' + p.id + ')">🗑 Delete post</button>' : "") +
        "</span></span>" : "") +
      "</span>" +
    "</div>" +
    '<div class="dwc-feed-typeline"><span class="dwc-type-label">' + postTypeLabel(p) + "</span>" +
    '<span class="tag">' + esc(p.category) + (p.flair ? " · " + esc(p.flair) : "") + (p.kind === "adult" ? " · 18+" : "") + (isCreator ? " · 🎨 Creator" : "") + "</span>" +
    (isNews ? '<span class="dwc-weird-badge">👽 Weird but true</span>' : "") +
    (p.visibility === "friends" ? '<span class="dwc-vis-badge">👥 Friends only</span>' : "") +
    (editsUsed > 0 ? '<span class="dwc-edited-badge" title="This post has been changed ' + editsUsed + ' of 3 times">✏️ Edited · ' + editsUsed + "/3</span>" : "") +
    "</div>" +
    postMediaHTML(p) +
    '<h3 class="dwc-feed-title"><a href="#/post/' + p.id + '" class="dwc-titlelink">' + esc(p.title) + "</a></h3>" +
    (p.kind === "announcement" ? '<p class="dwc-announce-line"><span class="dwc-announce-badge">📢 Official announcement from the owner</span></p>' : "") +
    eventLineHTML(p) +
    (isCreator ? '<p class="dwc-creator-line"><span class="dwc-creator-badge">🎨 ' + esc(p.content_genre || "Creator content") + "</span> " +
      '<strong style="color:var(--green);font-size:17px">' + priceLabel + "</strong>" +
      (p.file_url ? ' <span class="dwc-3d-badge">🖨️ 3D print file</span>' : "") + "</p>" : "") +
    '<p class="dwc-feed-body' + (long ? " dwc-clamped" : "") + '" id="dwc-post-body-' + p.id + '">' + memeBodyHTML(p.body) + "</p>" +
    (long ? '<button type="button" class="dwc-readmore" onclick="DWC.togglePostBody(' + p.id + ', this)">Read more ↓</button>' : "") +
    (p.kind === "card_auth" ? verificationBadge(p) : "") +
    (p.tags && p.tags.length ? '<p class="dwc-tags">' + p.tags.map(function (t) { return '<a class="dwc-tag-chip" href="#/tag/' + (p.kind === "adult" ? "adult/" : "") + encodeURIComponent(t) + '">#' + esc(t) + "</a>"; }).join(" ") + "</p>" : "") +
    '<div class="dwc-feed-actions">' +
    '<button type="button" class="dwc-act dwc-bookmark' + (saved ? " on" : "") + '" onclick="DWC.toggleSave(' + p.id + ', \'post\', this)" aria-label="Save this post">' + bookmarkHTML(saved) + "</button>" +
    postReactionGroupHTML(p) +
    '<a class="dwc-act dwc-comment-link" href="#/post/' + p.id + '" aria-label="Open comments">' + commentBubbleHTML(p.comment_count) + "</a>" +
    '<button type="button" class="dwc-act dwc-share" onclick="DWC.copyLink(\'' + postLink(p.id) + '\', this)" aria-label="Share this post">♻️ <span class="dwc-act-count">Share</span></button>' +
    (p.kind === "card_auth" ? '<span class="dwc-auth">Real ' + p.auth_real + " · Fake " + p.auth_fake + " · Unsure " + p.auth_unsure + "</span>" : "") +
    (isCreator && state.profile && state.profile.id !== p.author_id
      ? (p.pay_unlock && p.price_cents > 0
        ? '<button type="button" class="btn" onclick="DWC.messageSeller(' + p.author_id + ", '" + esc(p.author_username.replace(/'/g, "")) + "', " + p.id + ')">🔓 Pay to unlock — ' + money(p.price_cents) + '</button>'
        : '<button type="button" class="btn small" onclick="DWC.messageSeller(' + p.author_id + ", '" + esc(p.author_username.replace(/'/g, "")) + "', " + p.id + ')">💬 Buy / Message seller</button>') : "") +
    (isCreator && p.file_url && state.profile
      ? '<a class="btn ghost small" href="' + esc(fileDownloadUrl(p.file_url)) + '" download>⬇ ' + esc(p.file_name || "Download 3D file") + "</a>" : "") +
    '<span class="dwc-feed-more"><button type="button" class="dwc-linklike" onclick="DWC.report(\'post\', ' + p.id + ')">🚩 Report</button></span>' +
    "</div>" +
    '<div class="dwc-edit-slot" id="dwc-edit-' + p.id + '" hidden></div>' +
    '<div class="dwc-edit-history" id="dwc-history-' + p.id + '" hidden></div>' +
    "</article>";
}
// Feed redesign (v3.14) — comments use the same layout language as
// posts: header row (name left, date+time right), compact body with
// Read more, same action row, same RGB/neon borders. Callers pass
// o.react ({ ctype: 'thread' | 'listing' | 'profile', ref: the post,
// listing, or profile id }) and the card renders the heart + sad +
// confused reaction group for that surface (v3.15).
function commentCardHTML(c, o) {
  o = o || {};
  var long = (c.body || "").length > 280;
  var saved = isSavedKey("comment-" + c.id);
  return '<div class="dwc-comment dwc-comment-card" data-comment-id="' + c.id + '">' +
    (c.author_avatar_url ? '<img class="dwc-avatar dwc-avatar-sm" src="' + esc(c.author_avatar_url) + '" alt="">' : "") +
    '<div class="dwc-comment-main">' +
    '<div class="dwc-feed-head"><span class="dwc-feed-who"><strong>@' + esc(c.author_username) + "</strong>" + achBadgeIconsHTML(c.author_badges) + "</span>" +
    '<span class="dwc-feed-right"><span class="dwc-feed-when">' + fmtDateTime(c.created_at) + "</span></span></div>" +
    (o.visibilityNote ? ' <p class="dwc-meta" style="margin:2px 0 0">' + o.visibilityNote + "</p>" : "") +
    (c.body ? '<p class="dwc-feed-body' + (long ? " dwc-clamped" : "") + '" id="dwc-comment-body-' + c.id + '">' + memeBodyHTML(c.body) + "</p>" +
      (long ? '<button type="button" class="dwc-readmore" onclick="DWC.toggleCommentBody(' + c.id + ', this)">Read more ↓</button>' : "") : "") +
    (o.mediaHTML || "") +
    (o.gifAsImage ? "" : gifEmbedHTML(c.gif_url, c.gif_label, isWebsiteView())) +
    '<div class="dwc-feed-actions">' +
    '<button type="button" class="dwc-act dwc-bookmark' + (saved ? " on" : "") + '" onclick="DWC.toggleSave(' + c.id + ', \'comment\', this)" aria-label="Save this comment">' + bookmarkHTML(saved) + "</button>" +
    (o.react ? commentReactionGroupHTML(c, o.react) : "") +
    (o.canReply ? '<button type="button" class="dwc-act dwc-reply" onclick="DWC.replyToComment(\'' + esc(String(c.author_username || "").replace(/'/g, "")) + '\')">' + commentBubbleHTML(0, "Reply") + "</button>" : "") +
    (o.extraActions || "") +
    "</div></div></div>";
}
// Feed redesign (v3.14) — unified feed: listings and squads join the
// same single-column feed with a clear type label and the same card
// treatment. Articles have no API type anywhere — see the build log.
function listingFeedCardHTML(l) {
  var kindLabel = l.kind === "trade" ? "🔄 Ad · Up for trade" : l.kind === "flea" ? "🔨 Ad · Auction" : "🛒 Ad · For sale";
  var html = listingCardHTML(l);
  html = html.replace('<article class="card dwc-listing">', '<article class="card dwc-listing dwc-feed-card">' +
    '<div class="dwc-feed-typeline"><span class="dwc-type-label">' + kindLabel + "</span></div>");
  return html;
}
function squadFeedCardHTML(s) {
  var full = s.member_count >= (s.max_players || 4);
  var joinBtn = !state.profile ? '<span class="dwc-act-count">Join — members only</span>'
    : s.is_member ? '<a class="btn small" href="nerd.html#groupup">Open room →</a>'
    : full ? '<span class="dwc-act-count">Full (' + s.member_count + "/" + (s.max_players || 4) + ")</span>"
    : '<a class="btn small" href="nerd.html#groupup">Join group →</a>';
  return '<article class="card dwc-feed-card dwc-squad-card">' +
    '<div class="dwc-feed-head"><span class="dwc-feed-who">👤 <strong>@' + esc(s.creator_username) + "</strong></span>" +
    '<span class="dwc-feed-right"><span class="dwc-feed-when">' + fmtDateTime(s.created_at) + "</span></span></div>" +
    '<div class="dwc-feed-typeline"><span class="dwc-type-label">🎮 Group · ' + esc(s.platform) + " · " + esc(s.playtime) + "</span></div>" +
    '<h3 class="dwc-feed-title" style="margin:6px 0 2px">' + esc(s.game) + "</h3>" +
    '<p style="font-weight:800;margin:0">' + esc(s.title) + "</p>" +
    (s.description ? '<p class="dwc-feed-body">' + esc(s.description) + "</p>" : "") +
    '<p class="dwc-meta">Players: <b>' + s.member_count + "/" + (s.max_players || 4) + "</b> · " + (s.is_private ? "🔒 Private" : "🟢 Open") + "</p>" +
    '<div class="dwc-feed-actions">' + joinBtn + ' <a class="dwc-linklike" href="nerd.html#groupup">Group Up on the Nerd Hub →</a></div>' +
    "</article>";
}
function feedListHTML(items) {
  return '<div class="dwc-feed-list">' + items.join("") + "</div>";
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
    ' <span style="color:var(--muted);font-size:13px">· seller gets ' + money(l.seller_gets_cents) + " after the 6% street cut</span></p>" +
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
  // The member theme + the Edit Profile preview styles only live on
  // their own pages — take them down too, or a preview theme would
  // leak onto the next page you visit.
  ["dwc-member-theme", "dwc-layout-preview-style", "dwc-layout-preview-theme"].forEach(function (id) {
    var pel = document.getElementById(id);
    if (pel) pel.remove();
  });
  // Website-mode chrome fade lives only on a website-mode member page —
  // take the body class down whenever we navigate anywhere else.
  if (typeof document !== "undefined" && document.body) document.body.classList.remove("dwc-website-view");
  if (r.name === "street") return viewStreet(el);
  if (r.name === "cardcheck") return viewCardCheck(el);
  if (r.name === "market" || r.name === "trade" || r.name === "flea") return viewMarket(el, r.name);
  if (r.name === "orders") return viewOrders(el);
  if (r.name === "payouts") return viewPayouts(el);
  if (r.name === "members") return viewMembers(el);
  if (r.name === "member") return viewMember(el, Number(r.memberId));
  if (r.name === "memberSlug") return viewMemberBySlug(el, r.slug);
  if (r.name === "chat") return viewChat(el);
  if (r.name === "find") return viewFind(el);
  if (r.name === "headlines") return viewHeadlines(el);
  if (r.name === "receipts") return viewReceipts(el);
  if (r.name === "reports") return viewReports(el);
  if (r.name === "rules") return viewRules(el);
  if (r.name === "admin") return viewAdmin(el);
  if (r.name === "team") return viewTeam(el);
  if (r.name === "adult") return viewAdult(el);
  if (r.name === "tag") return viewTag(el, r.tag, r.adult);
  if (r.name === "thread") return viewThread(el, Number(r.postId));
  if (r.name === "listing") return viewListing(el, Number(r.listingId));
  viewStreet(el);
}

// ---------- YourSpace (The Street) ----------
// ---------- YourSpace (The Street) ----------
// Feed redesign (v3.14) — the feed sits directly below the profile
// card: profile at the top, feed right underneath, composer at the top
// of the feed. The big hero stays on the page shell (compact), and the
// How-it-works + Taffy cards moved BELOW the feed so nothing buries it.
// Unified feed: when sort is Newest with no category, no Friends-only
// and no Saved-only filter, the feed is one scrolling list of
// everything in the hub — posts, news, ads/listings, and gaming groups
// (squads) — each with a clear type label. Other tabs/filters stay
// posts-only (listings and squads have no heart/comment counts to rank
// by). Articles have no API type anywhere — see the build log.
async function viewStreet(el) {
  el.innerHTML =
    '<section class="dwc-feed-intro" aria-label="Your feed">' +
      '<h2 class="dwc-feed-title" style="margin:0">📰 Your feed</h2>' +
      '<p class="dwc-feed-hint">This is where everyone’s posts live — newest first. Write in the box below and your post shows up right here, at the top of the feed. Tap a tag to see more like it, tap 🔖 to save a post for later.</p>' +
    "</section>" +
    '<div id="dwc-headlines-strip"></div>' +
    '<div id="dwc-composer"></div>' +
    '<div class="dwc-filters"><div role="group" aria-label="Filter by corner"><span class="dwc-filter-label">Show posts about:</span>' +
    '<button type="button" class="dwc-pill' + (state.category === null ? " active" : "") + '" onclick="DWC.setCategory(null)">All corners</button>' +
    CATEGORIES.map(function (c) {
      return '<button type="button" class="dwc-pill' + (state.category === c ? " active" : "") + '" onclick="DWC.setCategory(\'' + esc(c) + '\')">' + esc(c) + "</button>";
    }).join("") +
    '</div><div role="group" aria-label="Sort posts"><span class="dwc-filter-label">Sort by:</span>' +
    [["new", "Newest"], ["top", "Top hearts"], ["discussed", "Most discussed"]].map(function (s) {
      return '<button type="button" class="dwc-pill' + (state.sort === s[0] ? " active" : "") + '" onclick="DWC.setSort(\'' + s[0] + '\')">' + s[1] + "</button>";
    }).join("") +
    (state.profile ? '<button type="button" class="dwc-pill' + (state.friendsOnly ? " active" : "") + '" onclick="DWC.setFriendsOnly(' + (!state.friendsOnly) + ')">👥 Friends</button>' : "") +
    '<button type="button" class="dwc-pill' + (state.savedOnly ? " active" : "") + '" onclick="DWC.setSavedOnly(' + (!state.savedOnly) + ')">🔖 Saved' + (savedCount() ? " (" + savedCount() + ")" : "") + "</button>" +
    "</div></div>" +
    '<div id="dwc-feed"><p style="color:var(--muted)">Loading posts…</p></div>' +
    '<div id="dwc-tags"><p style="color:var(--muted)">Loading tags…</p></div>' +
    '<details class="card dwc-how"><summary><strong>How YourSpace works — read this first</strong></summary><ul class="dwc-rules-list">' +
    "<li><strong>List it free, sell it fair</strong> — listing costs nothing; a fair 6% cut on a sale keeps the street running.</li>" +
    "<li><strong>Sell anything legal</strong> — not just cards. Adult content lives in its own separate 18+ area (🌙 After Dark), never mixed into YourSpace — and only if you’ve proved your age (see Rules &amp; After Dark).</li>" +
    "<li><strong>Ask &amp; learn</strong> — post on any topic, tag it so people can find it, and heart the good stuff (❤️ hearts only — no downvotes here).</li>" +
    "<li><strong>One account per person</strong>, and 🚩 Report on any post sends an alert to the owner.</li></ul>" +
    '<p><button type="button" class="btn ghost small" onclick="DWC.go(\'rules\')">Read the full rules →</button></p></details>' +
    '<section class="card"><div class="taffy-row"><div>' + taffySVG("taffy-small", "street") + '</div><div><h3 style="margin:0">🍬 Meet Taffy — your little site helper</h3>' +
    "<p style=\"margin:6px 0 0\">Hi, I'm Taffy! I build layouts, help with code, and answer questions about building your site. I can also help with support, reports, blocking, and FAQ — anything site-related.</p></div></div>" +
    taffyHelpHTML() + "</section>";
  renderComposer("street");
  loadHeadlinesStrip();
  var savesP = loadSavedServer();
  var data = await apiGet("/posts?device_id=" + encodeURIComponent(deviceId()) + "&sort=" + state.sort + "&limit=50" + (state.category ? "&category=" + encodeURIComponent(state.category) : "") + (state.friendsOnly ? "&friends=1" : ""));
  await savesP;
  var feed = $("dwc-feed");
  if (!feed) return;
  var posts = (data && data.posts) || [];
  if (state.savedOnly) posts = posts.filter(function (p) { return isSavedKey("post-" + p.id); });
  var unified = state.sort === "new" && !state.category && !state.friendsOnly && !state.savedOnly;
  if (unified) {
    var reqs = [
      apiGet("/listings?kind=market&limit=20"),
      apiGet("/listings?kind=trade&limit=20"),
      apiGet("/listings?kind=flea&limit=20"),
      apiGet("/squads?device_id=" + encodeURIComponent(deviceId())),
    ];
    var res = await Promise.all(reqs.map(function (p) { return p.catch(function () { return null; }); }));
    var items = posts.map(function (p) { return { ts: p.created_at || 0, html: postCardHTML(p) }; });
    [["listings", 0], ["listings", 1], ["listings", 2]].forEach(function (spec) {
      var list = (res[spec[1]] && res[spec[1]].listings) || [];
      list.forEach(function (l) { items.push({ ts: l.created_at || 0, html: listingFeedCardHTML(l) }); });
    });
    var squads = (res[3] && res[3].squads) || [];
    squads.forEach(function (s) { items.push({ ts: s.created_at || 0, html: squadFeedCardHTML(s) }); });
    items.sort(function (a, b) { return b.ts - a.ts; });
    items = items.slice(0, 50);
    feed.innerHTML = items.length
      ? feedListHTML(items.map(function (it) { return it.html; }))
      : '<div class="note">Nothing here yet — post something, list an item, or start a group.</div>';
  } else {
    feed.innerHTML = posts.length
      ? feedListHTML(posts.map(postCardHTML))
      : '<div class="note">' + (state.savedOnly ? "No saved posts yet — tap 🔖 on any post to save it here." : state.friendsOnly ? "No posts from your friends yet — add some friends and their posts will show up here." : "No posts yet — be the first to post on the street.") + "</div>";
  }
  var tags = await apiGet("/tags?scope=general&device_id=" + encodeURIComponent(deviceId()));
  var tagEl = $("dwc-tags");
  if (tagEl) {
    var list = (tags && tags.tags) || [];
    tagEl.innerHTML = list.length
      ? '<h3>Trending tags</h3><p class="dwc-tags">' + list.map(function (t) { return '<a class="dwc-tag-chip" href="#/tag/' + encodeURIComponent(t.tag) + '">#' + esc(t.tag) + " (" + t.count + ")</a>"; }).join(" ") + "</p>"
      : "";
  }
}

// ---------- Headlines (v3.1) ----------
// The Community's own most eye-catching posts, ranked by engagement
// (hearts × 2 + comments). Community posts only — no outside news.
// Adult posts are NEVER in Headlines — the 18+ area is separate from
// YourSpace (the endpoint excludes kind=adult entirely).
function headlineCardHTML(h) {
  return '<article class="card dwc-headline" onclick="DWC.go(\'post/' + h.id + '\')" style="cursor:pointer" role="link" tabindex="0" onkeydown="if(event.key===\'Enter\')DWC.go(\'post/' + h.id + '\')">' +
    '<div class="dwc-headline-eng">🔥 ' + (h.engagement || 0) + ' · ❤️ ' + (h.score || 0) + ' · 💬 ' + (h.comment_count || 0) + "</div>" +
    '<h3 class="dwc-headline-title" style="margin:8px 0 4px"><a href="#/post/' + h.id + '" class="dwc-titlelink">' + esc(h.title) + "</a></h3>" +
    eventLineHTML(h) +
    '<p style="margin:4px 0">by <strong>@' + esc(h.author_username) + "</strong>" + achBadgeIconsHTML(h.author_badges) + (h.kind === "adult" ? " · 18+" : h.kind === "event" ? " · 📅 Event" : h.kind === "announcement" ? " · 📢 Announcement" : "") + (h.is_creator ? " · 🎨 Creator" : "") + " · " + fmtDate(h.created_at) + "</p>" +
    (h.body ? "<p>" + esc(h.body.length > 140 ? h.body.slice(0, 140) + "…" : h.body) + "</p>" : "") +
    '<p style="margin:8px 0 0"><a href="#/post/' + h.id + '" class="dwc-titlelink">Open post →</a></p>' +
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
  el.innerHTML = '<section class="card"><h2 class="dwc-neon-head" style="margin-top:0">🔥 Headlines</h2><p style="color:var(--muted)">YourSpace’s own most eye-catching posts — ranked by hearts and comments. No outside news, just what the street is shouting about.</p></section><div id="dwc-headlines-list"><p style="color:var(--muted)">Loading headlines…</p></div>';
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
  var isOp = state.profile && (state.profile.role === "operator" || state.profile.is_operator);
  // Feed redesign (v3.14) — the composer is COLLAPSED by default: one
  // compact line (prompt + Post button). Tapping it expands the FULL
  // composer — everything it has today, nothing removed — and the
  // Minimize button at the top right collapses it again so the feed
  // is immediately visible right below.
  var prompt = isAuth ? "Check a card — real or fake?…" : (state.profile ? "Share something, @" + state.profile.username + "…" : "Share something…");
  host.innerHTML =
    '<section class="card dwc-composer" aria-label="New post">' +
    '<div class="dwc-composer-mini" id="dwc-composer-mini"' + (state.composerOpen ? " hidden" : "") + ">" +
      (state.profile && state.profile.avatar_url ? '<img class="dwc-avatar dwc-avatar-sm" src="' + esc(state.profile.avatar_url) + '" alt="">' : '<span class="dwc-avatar dwc-avatar-none dwc-avatar-sm">🍬</span>') +
      '<button type="button" class="dwc-composer-prompt" onclick="DWC.toggleComposer(true)">' + esc(prompt) + "</button>" +
      '<button type="button" class="btn small" onclick="DWC.toggleComposer(true)">Post</button>' +
    "</div>" +
    '<div class="dwc-composer-full" id="dwc-composer-full"' + (state.composerOpen ? "" : " hidden") + ">" +
    '<div class="dwc-composer-head"><h3 style="margin:0">' + (isAuth ? "Card Check — real or fake?" : "New post") + "</h3>" +
    '<button type="button" class="dwc-minimize-btn" onclick="DWC.toggleComposer(false)" title="Collapse the post box so you can see the feed">Minimize</button></div>' +
    '<p class="dwc-composer-hint">Your post shows up in the feed below, right under your profile — newest first.</p>' +
    (state.profile ? "" : "<p>Posting needs an account — <button type=\"button\" class=\"dwc-linklike\" onclick=\"DWC.openSignup()\">create one, it’s free</button>.</p>") +
    '<form onsubmit="DWC.submitPost(this, \'' + context + '\'); return false;">' +
    '<div class="dwc-kindrow">' +
    '<button type="button" class="dwc-pill' + (!isAuth ? " active" : "") + '" data-kind="forum" onclick="DWC.composerKind(this, \'forum\')">💬 Forum</button>' +
    '<button type="button" class="dwc-pill' + (isAuth ? " active" : "") + '" data-kind="card_auth" onclick="DWC.composerKind(this, \'card_auth\')">🔍 Card Check</button>' +
    '<button type="button" class="dwc-pill" data-kind="event" onclick="DWC.composerKind(this, \'event\')">📅 Event</button>' +
    (isOp ? '<button type="button" class="dwc-pill" data-kind="announcement" onclick="DWC.composerKind(this, \'announcement\')">📢 Announcement</button>' : "") +
    "</div>" +
    '<input type="hidden" name="kind" value="' + (isAuth ? "card_auth" : "forum") + '">' +
    '<label>Category — this decides where your post shows up</label><select name="category">' + CATEGORIES.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
    '<label>Flair</label><select name="flair">' + FLAIRS.map(function (f) { return "<option" + (f === (isAuth ? "Card Check" : "Discussion") ? " selected" : "") + ">" + esc(f) + "</option>"; }).join("") + "</select>" +
    '<label>Title (3–120 characters)</label>' +
    '<input name="title" required minlength="3" maxlength="120" placeholder="What’s this about?">' +
    '<label>What’s on your mind? (up to 4000 characters)</label>' +
    '<textarea name="body" required maxlength="4000" placeholder="Write it out…"></textarea>' +
    '<label>Tags (up to 6, comma separated)</label>' +
    '<input name="tags" maxlength="240" placeholder="e.g. charizard, grading, psa">' +
    '<div data-eventfields hidden>' +
    '<label>Event date</label><input name="event_date" type="date">' +
    '<label>Event time (e.g. 12–6 PM)</label><input name="event_time" maxlength="120" placeholder="12–6 PM">' +
    '<label>Event place (venue / city)</label><input name="event_place" maxlength="120" placeholder="Where is it happening?">' +
    "</div>" +
    '<label>Photo (JPG, PNG, WebP, or GIF — resized automatically to fit; required for Card Check)</label>' +
    '<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange="DWC.photoPicked(this, \'composer-' + context + '\')">' +
    cropPreviewHTML("composer-" + context) +
    '<label><input type="checkbox" name="blur_photo" style="width:auto"> 🙈 Blur this photo — viewers see a blurred preview (they can tap to reveal). Off by default; never on unless you tick it.</label>' +
    '<label>Short video clip (MP4, WebM, or MOV, under 15 MB and 60 seconds — optional)</label>' +
    '<input name="video" type="file" accept="video/mp4,video/webm,video/quicktime" onchange="DWC.videoPicked(this, \'composer-' + context + '\')">' +
    videoPreviewHTML("composer-" + context) +
    '<div class="dwc-checkline"><button type="button" class="btn ghost small" onclick="DWC.runCardCheck(this.form)">🔍 Run AI authenticity + price check on photo</button> <span data-checkresult></span></div>' +
    gifPickerHTML("composer-" + context) +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">Post it →</button></p>' +
    "</form></div></section>";
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
    ? "<h3>Card Check posts</h3>" + feedListHTML(posts.map(postCardHTML))
    : '<div class="note">No Card Check posts yet — post the first card.</div>';
}

function priceChartHTML() {
  return '<article class="card" aria-label="Price chart lookup — actual member-reported sales">' +
    "<h3 style=\"margin-top:0\">📈 Price chart — real reported sales</h3>" +
    "<p>Look up any card to see what it has <strong>actually sold for</strong>, as reported by the members who sold it — the chart the AI estimate can’t fake. Sold a card yourself? Open its chart and log the sale.</p>" +
    '<form class="dwc-rowform" onsubmit="DWC.lookupPrice(this); return false;">' +
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
      ? '<form class="dwc-logsale" onsubmit="DWC.logCardSale(this); return false;"><input type="hidden" name="card_name" value="' + esc(cardName) + '">' +
        "<strong>Log a sale you actually made:</strong> " +
        '<input name="price" type="number" step="0.01" min="0.01" required placeholder="Price sold for ($)">' +
        '<input name="sold_date" type="date" required>' +
        '<select name="venue">' + SALE_VENUES.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("") + "</select>" +
        '<button class="btn small" type="submit">Log this sale</button></form>'
      : "<p>Log a sale you made — <button type=\"button\" class=\"dwc-linklike\" onclick=\"DWC.openSignup()\">create your account</button> first.</p>") +
    "</div>";
}

// ---------- Flea Market / Trade / Auction House ----------
async function viewMarket(el, kind) {
  var titles = {
    market: ["🛒 Flea Market — sell your cards &amp; collectibles", "List it free. <span class=\"grad-text\">Sell it fair.</span>", "Anyone can sell their own Pokémon cards and collectibles here once their account and payout method are set up. Listing is free — a small fair cut goes to Rare Candy Reserve only when the item sells."],
    trade: ["🔄 Up for Trade", "Offer a trade. <span class=\"grad-text\">Let the community weigh in.</span>", "Every trade listing needs a photo and a check first — the shop verifies no fakes or proxies before a trade goes live. Then members vote whether it’s a good trade, a fair one, or a bad deal."],
    flea: ["🔨 Auction House — simple bidding", "Bid on it. <span class=\"grad-text\">Win it.</span>", "An online auction house with simple bidding — cards, collectibles, and whatever else the community’s selling. Bids must beat the high bid. The high bidder completes the purchase."],
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
  var kindLabel = kind === "sale" ? "for sale" : kind === "trade" ? "for trade" : "in the auction house";
  host.innerHTML =
    '<section class="card"><div class="tag">List an item ' + kindLabel + '</div><h3 style="margin-top:10px">Put something up ' + kindLabel + "</h3>" +
    (p ? (p.payout_method && p.payout_handle ? "" : '<p class="dwc-warn">You’re not payout-ready yet — add a payout method + handle in your profile before listing, or the listing will be blocked. You can still fill everything in now.</p>')
      : "<p>Listing needs an account + payout method — <button type=\"button\" class=\"dwc-linklike\" onclick=\"DWC.openSignup()\">create your account</button> first.</p>") +
    '<form onsubmit="DWC.submitListing(this, \'' + kind + '\'); return false;">' +
    '<label>Item title (3–120 characters)</label>' +
    '<input name="title" required minlength="3" maxlength="120" placeholder="What are you selling?">' +
    '<label>Category</label><select name="category">' + LISTING_CATEGORIES.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
    '<label>' + (kind === "flea" ? "Starting bid (USD)" : kind === "trade" ? "Trade value (USD — what it’s worth, for the fee split)" : "Price (USD)") + "</label>" +
    '<input name="price" type="number" step="0.01" min="0" required placeholder="e.g. 25.00">' +
    (kind === "trade" ? '<label>What you’re looking for in return</label><input name="trade_wanted" maxlength="500" placeholder="Card(s) you want in return">' : "") +
    '<label>Description &amp; condition (a little formatting is allowed: bold, italic, lists, links)</label>' +
    '<textarea name="description" required maxlength="6000" placeholder="Condition, set, what’s included…"></textarea>' +
    '<label>Photos — up to 3 (JPG, PNG, or WebP — resized automatically to fit)' + (kind === "trade" ? " — a photo is required for trades" : "") + "</label>" +
    '<input name="photo1" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange="DWC.listingPhotoPicked(this, 1)">' +
    '<p style="margin:2px 0 6px;color:var(--muted);font-size:12px" data-listingphotonote="1"></p>' +
    '<input name="photo2" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange="DWC.listingPhotoPicked(this, 2)">' +
    '<p style="margin:2px 0 6px;color:var(--muted);font-size:12px" data-listingphotonote="2"></p>' +
    '<input name="photo3" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange="DWC.listingPhotoPicked(this, 3)">' +
    '<p style="margin:2px 0 6px;color:var(--muted);font-size:12px" data-listingphotonote="3"></p>' +
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
    el.innerHTML = '<div class="note">That post is gone, or it’s in the 18+ area and this account isn’t age-verified.</div><p><button type="button" class="btn ghost" onclick="DWC.go(\'street\')">← Back to YourSpace</button></p>';
    return;
  }
  window.__dwcThreadKind = p.kind;
  var comments = await apiGet("/posts/" + postId + "/comments?device_id=" + encodeURIComponent(deviceId()));
  var list = (comments && comments.comments) || [];
  var isMine = state.profile && state.profile.id === p.author_id;
  var isOperator = state.profile && state.profile.is_operator;
  var isAdmin = state.profile && state.profile.role === "admin";
  // Team moderation (v3.18) — admins can delete any post and any
  // comment on it; turning comments on/off stays author/operator only.
  var canDelete = isMine || isOperator || isAdmin;
  var canMod = isOperator || isAdmin;
  el.innerHTML =
    '<p><button type="button" class="btn ghost small" onclick="DWC.go(\'' + (p.kind === "adult" ? "adult" : "street") + '\')">← Back</button></p>' +
    '<article class="card' + (p.kind === "announcement" ? " dwc-post-announcement" : "") + '">' +
    postPhotoHTML(p) +
    postVideoHTML(p) +
    gifEmbedHTML(p.gif_url, p.gif_label) +
    '<div class="tag">' + esc(p.category) + (p.flair ? " · " + esc(p.flair) : "") + (p.kind === "card_auth" ? " · 🔍 Card Check" : p.kind === "adult" ? " · 18+" : p.kind === "event" ? " · 📅 Event" : p.kind === "announcement" ? " · 📢 Announcement" : "") + (p.is_creator ? " · 🎨 Creator" : "") + "</div>" +
    "<h2>" + esc(p.title) + "</h2>" +
    (p.kind === "announcement" ? '<p class="dwc-announce-line"><span class="dwc-announce-badge">📢 Official announcement from the owner</span></p>' : "") +
    eventLineHTML(p) +
    (p.is_creator ? '<p class="dwc-creator-line"><span class="dwc-creator-badge">🎨 ' + esc(p.content_genre || "Creator content") + "</span> " +
      '<strong style="color:var(--green);font-size:20px">' + (p.price_cents > 0 ? money(p.price_cents) : "Free") + "</strong>" +
      (p.file_url ? ' <span class="dwc-3d-badge">🖨️ 3D print file — ' + esc(p.file_name || "download") + "</span>" : "") + "</p>" +
      '<p style="color:var(--muted);font-size:14px">' + (p.pay_unlock && p.price_cents > 0 ? 'This post is pay-to-unlock — hit “Pay to unlock” and sort out payment in a private chat. The receipt marked done in that chat is your proof of purchase.' : 'Payment is arranged privately with the seller — hit “Buy / Message seller” and sort it out in a private chat.') + ' No money moves in this app.</p>' : "") +
    '<p style="white-space:pre-wrap">' + memeBodyHTML(p.body) + "</p>" +
    youtubeEmbedHTML(p.body) +
    (p.kind === "card_auth" ? verificationBadge(p) : "") +
    '<p class="dwc-meta">by @' + esc(p.author_username) + achBadgeIconsHTML(p.author_badges) + (p.author_occupation ? " · " + esc(p.author_occupation) : "") + " · " + fmtDateTime(p.created_at) + "</p>" +
    (p.tags && p.tags.length ? '<p class="dwc-tags">' + p.tags.map(function (t) { return '<a class="dwc-tag-chip" href="#/tag/' + (p.kind === "adult" ? "adult/" : "") + encodeURIComponent(t) + '">#' + esc(t) + "</a>"; }).join(" ") + "</p>" : "") +
    '<div class="dwc-actions dwc-feed-actions">' +
    postReactionGroupHTML(p) +
    '<button type="button" class="dwc-act dwc-share" onclick="DWC.copyLink(\'' + postLink(p.id) + '\', this)" aria-label="Share this post">♻️ <span class="dwc-act-count">Share</span></button>' +
    (p.is_creator && state.profile && state.profile.id !== p.author_id
      ? (p.pay_unlock && p.price_cents > 0
        ? '<button type="button" class="btn" onclick="DWC.messageSeller(' + p.author_id + ", '" + esc(p.author_username.replace(/'/g, "")) + "', " + p.id + ')">🔓 Pay to unlock — ' + money(p.price_cents) + '</button>'
        : '<button type="button" class="btn small" onclick="DWC.messageSeller(' + p.author_id + ", '" + esc(p.author_username.replace(/'/g, "")) + "', " + p.id + ')">💬 Buy / Message seller</button>') : "") +
    (p.is_creator && p.file_url && state.profile
      ? '<a class="btn ghost small" href="' + esc(fileDownloadUrl(p.file_url)) + '" download>⬇ ' + esc(p.file_name || "Download 3D file") + "</a>" : "") +
    '<button type="button" class="dwc-linklike" onclick="DWC.report(\'post\', ' + p.id + ')">🚩 Report</button>' +
    (canDelete ? '<button type="button" class="dwc-linklike" onclick="DWC.deletePost(' + p.id + ')">🗑 ' + (isMine ? "Delete my post" : "Delete post") + "</button>" : "") +
    ((isMine || isOperator) ? '<button type="button" class="dwc-linklike" onclick="DWC.toggleComments(' + p.id + ", " + (!p.allow_comments) + ')">' + (p.allow_comments ? "🔇 Turn comments off" : "🔊 Turn comments on") + "</button>" : "") +
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
      var mine = state.profile && state.profile.id === c.author_id;
      return commentCardHTML(c, {
        canReply: true,
        react: { ctype: "thread", ref: p.id },
        extraActions: '<button type="button" class="dwc-linklike" onclick="DWC.report(\'comment\', ' + c.id + ')">🚩 Report</button>' +
          ((mine || canMod) ? '<button type="button" class="dwc-linklike" onclick="DWC.deleteComment(' + p.id + ", " + c.id + ')">🗑 Delete</button>' : ""),
      });
    }).join("") : "<p>Nothing yet — be the first to say something.</p>") +
    "</section>" +
    (state.profile && (p.allow_comments || isMine)
      ? '<section class="card"><h3 style="margin-top:0">Add a comment</h3><form onsubmit="DWC.submitComment(this, ' + p.id + '); return false;">' +
        '<textarea id="dwc-comment-box" name="body" maxlength="2000" placeholder="Say something kind…"></textarea>' +
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
    el.innerHTML = '<div class="note">That listing is gone or sold.</div><p><button type="button" class="btn ghost" onclick="DWC.go(\'market\')">← Back to the Flea Market</button></p>';
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
        (state.profile ? '<form class="dwc-rowform" onsubmit="DWC.placeBid(this, ' + l.id + '); return false;"><input name="bid" type="number" step="0.01" min="0.01" required placeholder="Your bid ($)"><button class="btn" type="submit">Place the bid →</button></form><p class="dwc-form-err" data-err hidden></p>' : needProfileHTML()) +
        "</section>" : "") +
    (l.kind === "trade"
      ? '<section class="card"><h3 style="margin-top:0">Is it a good trade?</h3><div class="dwc-actions">' +
        '<button type="button" class="btn ghost small" onclick="DWC.tradeVote(' + l.id + ", 'good')\">👍 Good (" + l.trade_good + ')</button>' +
        '<button type="button" class="btn ghost small" onclick="DWC.tradeVote(' + l.id + ", 'fair')\">🤝 Fair (" + l.trade_fair + ')</button>' +
        '<button type="button" class="btn ghost small" onclick="DWC.tradeVote(' + l.id + ", 'bad')\">👎 Bad deal (" + l.trade_bad + ")</button></div></section>" : "") +
    '<section class="card"><h3 style="margin-top:0">Comments (' + list.length + ')' + (l.allow_comments ? "" : ' <span style="color:var(--amber)">— comments are off on this listing</span>') + "</h3>" +
    (list.length ? list.map(function (c) {
      return commentCardHTML(c, { canReply: true, react: { ctype: "listing", ref: l.id } });
    }).join("") : "<p>Nothing yet.</p>") +
    "</section>" +
    (state.profile && l.allow_comments
      ? '<section class="card"><h3 style="margin-top:0">Comment on this listing</h3><form onsubmit="DWC.submitListingComment(this, ' + l.id + '); return false;">' +
        '<textarea id="dwc-comment-box" name="body" maxlength="2000" placeholder="Say something…"></textarea>' +
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
    '<p class="dwc-feed-hint">Every post tagged #' + esc(tag) + ' — newest first. Tap a tag on any post to see more like it.</p>' +
    (posts.length ? feedListHTML(posts.map(postCardHTML)) : '<div class="note">No posts with that tag yet.</div>');
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
    "<h3>My listings</h3>" + (ml.length ? '<div class="grid">' + ml.map(listingCardHTML).join("") + "</div>" : '<div class="note">No listings yet — list something in the Flea Market, Trades, or Auction House and it shows up here.</div>') +
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
      : '<form class="dwc-shipform" onsubmit="DWC.updateShipping(this, ' + o.id + '); return false;">' +
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
// v3.7 badges — all in the same place, right by the name + online dot.
// Operator: the VNR symbol (gradient heart + EKG). Admin: a peace yin and
// yang with "admin" in small text under it. Mod: "Moderator" in glowing
// green small letters. Everyone else: no badge.
function badgeHTML(m) {
  var role = m.role || (m.is_operator ? "operator" : "member");
  if (role === "operator") {
    return '<img class="dwc-badge-op" src="images/steady-heart.svg" alt="Operator" title="Operator — runs Rare Candy Reserve">';
  }
  if (role === "admin") {
    return '<span class="dwc-badge-admin" title="Admin">☯<small>admin</small></span>';
  }
  if (role === "mod") {
    return '<span class="dwc-badge-mod" title="Moderator">Moderator</span>';
  }
  return "";
}
// --- Achievement badges (v3.9) -------------------------------------------
// BADGES mirrors the server registry in functions/api/_lib.js (icon,
// label, requirement). Keep the two in sync — the server is the source
// of truth for earning; this list only renders the picker + display.
// Display rule: ONE badge by default; adult sellers ALWAYS show the 18+
// badge plus ONE chosen badge; regular sellers showing Regular Seller
// may add ONE optional secondary badge. Nobody shows more than two.
// Reporter is FIRST on purpose (mirrors the server list): a member who
// earns it shows it by default until they pick a different display badge.
var BADGES = [
  { key: "badge:reporter", icon: "📰", label: "Reporter", requirement: "Granted by the shop — posts news for the community" },
  { key: "badge:first-post", icon: "📝", label: "First Post", requirement: "Post your first post" },
  { key: "badge:first-comment", icon: "💬", label: "First Comment", requirement: "Leave your first comment" },
  { key: "badge:comments-25", icon: "🗨️", label: "Chatty", requirement: "Leave 25 comments" },
  { key: "badge:hearts-25", icon: "❤️", label: "Well Loved", requirement: "Give or get 25 hearts" },
  { key: "badge:streak-7", icon: "🔥", label: "7-Day Streak", requirement: "Use the site 7 different days" },
  { key: "badge:first-sale", icon: "💰", label: "First Sale", requirement: "Make your first sale" },
  { key: "badge:sales-5", icon: "🛍️", label: "Regular Seller", requirement: "Make 5 sales" },
  { key: "badge:sales-10", icon: "🏆", label: "10 Sales", requirement: "Make 10 sales" },
  { key: "badge:member-7d", icon: "🌱", label: "First Week", requirement: "Be a member for 7 days" },
  { key: "badge:member-1mo", icon: "📅", label: "1 Month", requirement: "Be a member for 1 month" },
  { key: "badge:member-3mo", icon: "📆", label: "3 Months", requirement: "Be a member for 3 months" },
  { key: "badge:member-6mo", icon: "🗓️", label: "6 Months", requirement: "Be a member for 6 months" },
  { key: "badge:member-1yr", icon: "🎂", label: "1 Year", requirement: "Be a member for 1 year" },
  { key: "badge:adult-approved", icon: "🔞", label: "Adult Approved", requirement: "Get approved for adult content" },
];
function badgeByKeyClient(key) {
  for (var i = 0; i < BADGES.length; i++) if (BADGES[i].key === key) return BADGES[i];
  return null;
}
// Inline badge icons next to a name (posts, comments, chat, profile
// head). badges is the author's DISPLAY badges from the API (1–2 max).
function achBadgeIconsHTML(badges) {
  if (!badges || !badges.length) return "";
  return " " + badges.slice(0, 2).map(function (b) {
    var full = badgeByKeyClient(b.key) || b;
    return '<span class="dwc-ach-badge" title="' + esc(full.label || b.key) + '">' + esc(full.icon || "🏅") + "</span>";
  }).join("");
}
// Full badge display list (Edit Profile + phone): every badge with its
// earned state, locked ones greyed out with their requirement.
function badgeDisplayListHTML(badges) {
  var list = badges || [];
  if (!list.length) return '<p style="color:var(--muted)">No badges yet — post, comment, sell, and show up to earn your first one.</p>';
  return '<div class="dwc-badge-grid">' + list.map(function (b) {
    return '<div class="dwc-badge-item' + (b.earned ? "" : " dwc-badge-locked") + '">' +
      '<span class="dwc-badge-ico">' + esc(b.icon) + "</span>" +
      '<span class="dwc-badge-lab">' + esc(b.label) + "</span>" +
      (b.earned ? '<span class="dwc-badge-got">✓ Unlocked</span>'
        : '<span class="dwc-badge-req">🔒 ' + esc(b.requirement) + "</span>") +
      "</div>";
  }).join("") + "</div>";
}
// The display-slot picker (Edit Profile): which badge(s) show next to
// the member's name. Slots depend on who they are — adult sellers get
// the 18+ badge locked in slot 1 plus one choice; regular sellers who
// show Regular Seller get a second slot; everyone else gets one slot.
function badgeSlotPickerHTML(p) {
  var badges = (p && p.badges) || [];
  var earned = badges.filter(function (b) { return b.earned; });
  var th = parseThemeClient(p ? p.profile_theme : "");
  var picked = (th.display_badges || []).filter(function (k) { return earned.some(function (b) { return b.key === k; }); });
  var isAdult = !!(p && p.is_adult_seller);
  var isRegular = !!(p && p.is_regular_seller);
  var slots = isAdult || (isRegular && picked[0] === "badge:sales-5") ? 2 : 1;
  // No badges unlocked yet — say so honestly instead of a picker with
  // no options (a lone "— Pick a badge —" looks broken).
  if (!earned.length) {
    return '<p style="margin:0 0 8px">No badges unlocked yet — your first badge unlocks after your first post. Post, comment, sell, and show up to earn them, then pick which ones show next to your name here.</p>' +
      '<label>Badge slot 1</label><select disabled><option>No badges unlocked yet</option></select>';
  }
  var opt = function (sel) {
    return '<option value="">— Pick a badge —</option>' + earned.map(function (b) {
      return '<option value="' + esc(b.key) + '"' + (sel === b.key ? " selected" : "") + ">" + esc(b.icon + " " + b.label) + "</option>";
    }).join("");
  };
  var html = '<p style="margin:0 0 8px">You show <strong>' + slots + " badge" + (slots > 1 ? "s" : "") + "</strong> next to your name" +
    (isAdult ? " — as an adult seller, the 🔞 18+ badge always shows, plus one badge you pick."
      : isRegular ? " — as a regular seller, showing Regular Seller unlocks a second slot for one more badge you pick."
      : " — pick one of your unlocked badges.") + "</p>";
  html += '<label>Badge slot 1' + (isAdult ? " — locked to 🔞 Adult Approved" : "") + "</label>";
  if (isAdult) {
    html += '<p style="margin:0 0 8px"><span class="dwc-ach-badge" style="font-size:20px">🔞</span> <strong>Adult Approved</strong> — always shows for adult sellers.</p>' +
      '<input type="hidden" name="theme_display_badge_1" value="badge:adult-approved">';
  } else {
    html += '<select name="theme_display_badge_1" onchange="DWC.badgeSlotChanged()">' + opt(picked[0] || "") + "</select>";
  }
  // Slot 2 lives in one div that badgeSlotChanged() shows/hides (and
  // enables/disables, so a hidden slot never submits a stale value).
  html += '<div id="dwc-badge-slot2"' + (slots === 2 ? "" : " hidden") + '><label>Badge slot 2 — your pick</label>' +
    '<select name="theme_display_badge_2" onchange="DWC.badgeSlotChanged()"' + (slots === 2 ? "" : " disabled") + ">" + opt(picked[1] || "") + "</select></div>";
  html += '<p style="margin:8px 0 0;color:var(--muted);font-size:13px">Badges you haven\'t unlocked yet show greyed out above — post, comment, sell, and show up to earn them.</p>';
  return html;
}
// v3.7 ticker — optional custom text, up to 200 chars, scrolling above
// the main page. The name never scrolls; it stays put.
// v3.10 — ticker_source "btc" swaps the text for the live Bitcoin price
// (CoinGecko, free, no key — fetched client-side, refreshed every
// minute by armBtcTicker). The member's own text stays as the fallback
// when the price can't load.
function tickerHTML(m, th) {
  var isBtc = !!(th && th.ticker_source === "btc");
  if (!m || !m.ticker_enabled) return "";
  if (!isBtc && !m.ticker_text) return "";
  var color = /^#[0-9a-fA-F]{6}$/.test(m.ticker_color || "") ? m.ticker_color : "#00e5ff";
  var inner = isBtc
    ? '<span id="dwc-btc-price">₿ Loading Bitcoin price…</span>'
    : esc(m.ticker_text);
  return '<div class="dwc-ticker" style="color:' + esc(color) + '"' + (isBtc ? ' data-btc-ticker="1"' : "") + '><div class="dwc-ticker-inner">' + inner + "</div></div>";
}
// v3.10 — live Bitcoin price for the ticker. CoinGecko's free simple
// price endpoint needs no key and allows browser calls (CORS *).
// Shows price + 24h change; on failure the member's own ticker text
// (or a plain "unavailable" line) stays put — never a blank ticker.
async function refreshBtcTicker() {
  var host = document.querySelector('[data-btc-ticker="1"] #dwc-btc-price');
  if (!host) return;
  try {
    var res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true");
    if (!res.ok) throw new Error("bad status");
    var data = await res.json();
    var btc = data && data.bitcoin;
    if (!btc || typeof btc.usd !== "number") throw new Error("no price");
    var chg = (typeof btc.usd_24h_change === "number") ? btc.usd_24h_change : null;
    var arrow = chg === null ? "" : (chg >= 0 ? " ▲ " : " ▼ ");
    var chgTxt = chg === null ? "" : arrow + Math.abs(chg).toFixed(1) + "% (24h)";
    host.textContent = "₿ BTC $" + Math.round(btc.usd).toLocaleString("en-US") + chgTxt;
  } catch (e) {
    var m = state.viewingMember;
    host.textContent = (m && m.ticker_text) ? m.ticker_text : "₿ Bitcoin price unavailable right now";
  }
}
function armBtcTicker() {
  if (state.btcTimer) { clearInterval(state.btcTimer); state.btcTimer = null; }
  if (!document.querySelector('[data-btc-ticker="1"]')) return;
  refreshBtcTicker();
  state.btcTimer = setInterval(refreshBtcTicker, 60000);
}
// ---------- Dividers (v3.20) ----------
// The line between Top Friends and Page comments on a member page.
// Rendered as inline SVG (NOT images) so the color is changeable.
// Free designs are always pickable; locked ones need the unlock key
// (Lucre purchase or achievement — the purchase flow isn't built yet,
// so locked designs show in the picker but can't be selected).
// The gold swirl is Chris's pick: a line whose left end curls into a
// swirl, mirrored on the right so it curls the opposite way.
var DIVIDERS = {
  line: { name: "Simple line", free: true },
  dots: { name: "Dotted line", free: true },
  double: { name: "Double line", free: true },
  stars: { name: "Star line", free: true },
  goldswirl: { name: "Gold swirl", free: true, color: "#d4af37" },
  neonwave: { name: "Neon wave", free: false, unlock: "Lucre" },
  hearts: { name: "Heart line", free: false, unlock: "achievement" },
};
function dividerSVG(id) {
  if (id === "dots") return '<line x1="2" y1="14" x2="198" y2="14" stroke-width="4" stroke-dasharray="0.1 8" stroke-linecap="round"/>';
  if (id === "double") return '<line x1="2" y1="10" x2="198" y2="10"/><line x1="2" y1="18" x2="198" y2="18"/>';
  if (id === "stars") return '<line x1="2" y1="14" x2="84" y2="14"/><line x1="116" y1="14" x2="198" y2="14"/><path d="M100 5 L103 11 L109 14 L103 17 L100 23 L97 17 L91 14 L97 11 Z" fill="currentColor" stroke="none"/>';
  if (id === "goldswirl") return '<line x1="76" y1="14" x2="124" y2="14"/>' +
    '<path d="M76 14 C64 14 56 10 57 5 C58 1 65 1 66 6 C67 10 62 12 60 9 C58 7 60 4 63 5"/>' +
    '<path d="M124 14 C136 14 144 10 143 5 C142 1 135 1 134 6 C133 10 138 12 140 9 C142 7 140 4 137 5"/>';
  if (id === "neonwave") return '<path d="M2 14 Q14 4 26 14 T50 14 T74 14 T98 14 T122 14 T146 14 T170 14 T194 14"/>';
  if (id === "hearts") return '<line x1="2" y1="14" x2="86" y2="14"/><line x1="114" y1="14" x2="198" y2="14"/><path d="M100 21 C92 15 90 9 96 6 C99 5 100 8 100 8 C100 8 101 5 104 6 C110 9 108 15 100 21 Z" fill="currentColor" stroke="none"/>';
  return '<line x1="2" y1="14" x2="198" y2="14"/>';
}
// The divider's color: the member's pick wins; otherwise the design's
// own default (gold for the gold swirl); otherwise a neutral grey.
function dividerColorFor(th, id) {
  if (th && th.divider_color) return th.divider_color;
  var d = DIVIDERS[id] || {};
  return d.color || "#9a9ab0";
}
function dividerHTML(id, color) {
  var d = DIVIDERS[id] || DIVIDERS.line;
  var col = color || d.color || "#9a9ab0";
  return '<div class="dwc-divider" role="separator" style="color:' + esc(col) + '">' +
    '<svg viewBox="0 0 200 28" width="100%" height="28" preserveAspectRatio="xMidYMid meet" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + dividerSVG(id) + "</svg></div>";
}
// v3.7 banner / cover photo — centered at the top of the profile.
// Website-mode business header (v3.20) — the banner with the member's
// page name ON it, like a business website header. Wide pictures
// stretch across the top (auto-fit); small ones stay centered. The name
// renders in the member's chosen name font + glow (themeCSS covers
// .dwc-website-banner-name for both). No banner? The name still shows
// as the header, on the page background.
function websiteBannerHTML(m, mth) {
  var name = '<h2 class="dwc-website-banner-name">' + esc(m.username) + "</h2>";
  if (!m || !m.banner_url) return '<div class="dwc-banner dwc-website-banner dwc-website-banner-none">' + name + "</div>";
  return '<div class="dwc-banner dwc-website-banner"><img src="' + esc(m.banner_url) + '" alt="Cover photo" onload="DWC.bannerFit(this)">' + name + "</div>";
}
function bannerHTML(m, th) {
  if (!m || !m.banner_url) return "";
  // Banner auto-fit (v3.20) — the shape decides the size. DWC.bannerFit
  // runs on load (and again after render, for cached images) and tags
  // the wrapper wide or small: a wide/horizontal picture stretches
  // across the top to almost the width of the profile walls; a
  // small/square picture stays centered and small, like a logo.
  // Cover photo (v3.22) — "big" makes the top picture a tall cover
  // area instead; the ticker below it stays visible. Small is this
  // auto-fit look.
  var coverCls = (th && th.cover_size === "big") ? " dwc-banner-cover" : "";
  return '<div class="dwc-banner' + coverCls + '"><img src="' + esc(m.banner_url) + '" alt="Cover photo" onload="DWC.bannerFit(this)"></div>';
}
// Cover photo + name placement (v3.22) — the top picture with the
// member's name beside it, when they picked Left / Right. The head card
// below hides its own name line then, so the name shows exactly once.
// Under (the default) is just the banner on its own, name below it.
function coverNameHTML(m) {
  return '<div class="dwc-cover-name"><h2 style="margin:0">@' + esc(m.username) + " " + presenceDot(m) + " " + badgeHTML(m) + achBadgeIconsHTML(m.badges) + "</h2></div>";
}
function coverBannerHTML(m, th) {
  if (!m || !m.banner_url) return "";
  var pos = th && (th.cover_name === "left" || th.cover_name === "right") ? th.cover_name : "";
  if (!pos) return bannerHTML(m, th);
  return '<div class="dwc-cover-row dwc-cover-name-' + pos + '">' + coverNameHTML(m) + bannerHTML(m, th) + "</div>";
}
// Banner auto-fit (v3.20) — wide (aspect >= 1.6) stretches across the
// top; anything squarer stays centered and small. Called on the img's
// load event and from viewMember after render (cached images).
function bannerFit(img) {
  if (!img || !img.naturalWidth || !img.parentNode) return;
  var wide = (img.naturalWidth / img.naturalHeight) >= 1.6;
  img.parentNode.classList.toggle("dwc-banner-wide", wide);
  img.parentNode.classList.toggle("dwc-banner-small", !wide);
}
// Chris (member id 1) is the site's Tom — every new member's first Top
// Friend by default. His tile says "Chris (Ash)" with his profile picture,
// not @RareCandyReserve.
function topFriendLabel(f) { return f.id === 1 ? "Chris (Ash)" : "@" + f.username; }
function topFriendsRowHTML(friends) {
  if (!friends || !friends.length) return '<p style="color:var(--muted)">No Top Friends yet — pick yours in Edit profile.</p>';
  return '<div class="dwc-top8">' + friends.map(function (f) {
    return '<a class="dwc-topfriend" href="#/member/' + f.id + '">' +
      (f.avatar_url ? '<img class="dwc-avatar" src="' + esc(f.avatar_url) + '" alt="">' : '<span class="dwc-avatar dwc-avatar-none">🍬</span>') +
      "<span>" + esc(topFriendLabel(f)) + "</span></a>";
  }).join("") + "</div>";
}
// Vanity page URL (v3.6) — #/u/<slug> resolves the slug to a member id,
// then renders their page exactly like #/member/<id>.
async function viewMemberBySlug(el, slug) {
  el.innerHTML = '<p style="color:var(--muted)">Loading their page…</p>';
  var data = await apiGet("/members/by-slug?slug=" + encodeURIComponent(slug));
  var id = data && data.member_id;
  if (!id) {
    el.innerHTML = '<div class="note">That page doesn’t exist.</div><p><button type="button" class="btn ghost" onclick="DWC.go(\'members\')">← Back to Members</button></p>';
    return;
  }
  return viewMember(el, id);
}

// ---------- Profile action buttons (v3.6, v3.10) ----------
// The 4-button block on someone else's member page: Add me / Message me /
// Add to Favorites (star) / Add to group. Rendered from THAT member's
// profile_buttons (custom labels, colors, or a solid image behind the
// whole block). Report is NOT a button anymore — every post, comment,
// listing, and picture already has a 🚩 Report link that goes to the
// admin Reports inbox, so nothing is lost. Per-button inline styles win
// over the page theme button CSS. Defaults are used for anything the
// owner didn't set. The block is a 2×2 grid on the left or right side
// of the page (the member's pick), opposite their video.
var ACTION_BUTTON_DEFS = [
  { key: "add", icon: "➕", label: "Add me", friendIcon: "💔", friendLabel: "Unfriend" },
  { key: "message", icon: "💬", label: "Message me" },
  { key: "favorite", icon: "☆", label: "Add to Favorites", favIcon: "★", favLabel: "Favorited" },
  { key: "group", icon: "👥", label: "Add to group" },
];
function actionButtonStyle(pb, key) {
  if (!pb || !pb.buttons || !pb.buttons[key]) return "";
  var b = pb.buttons[key];
  var s = "";
  if (b.bg) s += "background:" + b.bg + ";";
  if (b.color) s += "color:" + b.color + ";";
  // Per-button look (v3.22) — each button's own font, size, and
  // container shape, set in Edit Profile > Buttons. The font comes from
  // the fixed theme-font map (never raw input); size/radius are fixed
  // choices. Inline styles win over the page button size + style.
  if (b.font && themeFontCSS(b.font)) s += "font-family:" + themeFontCSS(b.font) + ";";
  if (b.size === "s") s += "font-size:13px;padding:8px 14px;";
  else if (b.size === "l") s += "font-size:18px;padding:14px 24px;";
  else if (b.size === "xl") s += "font-size:20px;padding:16px 26px;";
  if (b.radius === "square") s += "border-radius:4px;";
  else if (b.radius === "rounded") s += "border-radius:12px;";
  else if (b.radius === "pill") s += "border-radius:999px;";
  return s ? ' style="' + s + '"' : "";
}
function actionButtonLabel(pb, key, fallback) {
  if (pb && pb.buttons && pb.buttons[key] && pb.buttons[key].label) return pb.buttons[key].label;
  return fallback;
}
// Readable text color for a chosen button background (v3.21): white
// on dark colors, near-black on light ones (relative luminance).
function buttonTextFor(hex) {
  var h = String(hex || "").replace("#", "");
  if (h.length !== 6) return "#0b0b14";
  var r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "#0b0b14";
  var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 0.5 ? "#ffffff" : "#0b0b14";
}
function actionButtonsHTML(m, preview, th) {
  var pb = m.profile_buttons || null;
  var blockStyle = "";
  var blockClass = "dwc-action-buttons";
  if (pb && pb.mode === "image" && pb.image_url) {
    blockClass += " dwc-action-buttons-image";
    blockStyle = ' style="background-image:url(' + esc(pb.image_url) + ')"';
  }
  var isFriend = !!m.is_friend;
  var isFav = !!m.is_favorite;
  var uname = esc(m.username.replace(/'/g, ""));
  // v3.21 — which buttons show (Edit Profile > Buttons). buttons_visible
  // null = all show (the default); an array lists exactly which show,
  // so a member can show just "Message me" if they want. The
  // professional-mode Message button is separate and always shows.
  var th2 = th || parseThemeClient(m.profile_theme);
  var visSet = th2.buttons_visible;
  var showBtn = function (k) { return !visSet || visSet.indexOf(k) >= 0; };
  var anyBtn = false;
  // Preview mode (your own page): buttons are disabled so you can't
  // friend/message yourself — they only show how visitors see them.
  var dis = preview ? " disabled" : "";
  var html = (preview ? '<p style="color:var(--muted);font-size:13px;margin:0 0 8px">👀 Preview — this is what visitors see on your page.</p>' : "");
  var body = '<div id="dwc-action-buttons" class="' + blockClass + '"' + blockStyle + ">";
  // Add me / Unfriend
  if (showBtn("add")) {
    anyBtn = true;
    var addDef = ACTION_BUTTON_DEFS[0];
    body += '<button type="button" class="btn small" data-action-btn="add"' + dis + ' onclick="DWC.toggleFriend(' + m.id + ')"' + actionButtonStyle(pb, "add") + ">" +
      (isFriend ? addDef.friendIcon : addDef.icon) + " " + esc(actionButtonLabel(pb, "add", isFriend ? addDef.friendLabel : addDef.label)) + "</button>";
  }
  // Message me
  if (showBtn("message")) {
    anyBtn = true;
    body += '<button type="button" class="btn small" data-action-btn="message"' + dis + ' onclick="DWC.imMember(' + m.id + ", '" + uname + "')\"" + actionButtonStyle(pb, "message") + ">" +
      ACTION_BUTTON_DEFS[1].icon + " " + esc(actionButtonLabel(pb, "message", ACTION_BUTTON_DEFS[1].label)) + "</button>";
  }
  // Add to Favorites — star next to the wording: ☆ unfilled/uncolored
  // before, ★ filled gold when already favorited.
  if (showBtn("favorite")) {
    anyBtn = true;
    body += '<button type="button" class="btn small' + (isFav ? " dwc-fav-on" : "") + '" data-action-btn="favorite"' + dis + ' onclick="DWC.toggleFavorite(' + m.id + ')"' + actionButtonStyle(pb, "favorite") + ">" +
      '<span class="dwc-fav-star' + (isFav ? " on" : "") + '">' + (isFav ? ACTION_BUTTON_DEFS[2].favIcon : ACTION_BUTTON_DEFS[2].icon) + "</span> " +
      esc(actionButtonLabel(pb, "favorite", isFav ? ACTION_BUTTON_DEFS[2].favLabel : ACTION_BUTTON_DEFS[2].label)) + "</button>";
  }
  // Add to group
  if (showBtn("group")) {
    anyBtn = true;
    body += '<button type="button" class="btn small" data-action-btn="group"' + dis + ' onclick="DWC.toggleGroupPanel(' + m.id + ')"' + actionButtonStyle(pb, "group") + ">" +
      ACTION_BUTTON_DEFS[3].icon + " " + esc(actionButtonLabel(pb, "group", ACTION_BUTTON_DEFS[3].label)) + "</button>";
  }
  if (!anyBtn) return preview ? html + '<p style="color:var(--muted);font-size:13px;margin:0">No action buttons selected — pick some in Edit Profile &gt; Buttons.</p>' : "";
  return html + body + "</div>";
}
// Re-fetch one member and swap just the action-button block (and vanity
// line) so a toggle updates in place without losing the visitor's scroll.
async function refreshActionButtons(memberId) {
  var data = await apiGet("/members/" + memberId + "?device_id=" + encodeURIComponent(deviceId()));
  var m = data && data.member;
  if (!m) return;
  state.viewingMember = m;
  var box = document.getElementById("dwc-action-buttons");
  if (box) {
    var wrap = document.createElement("div");
    wrap.innerHTML = actionButtonsHTML(m, false, parseThemeClient(m.profile_theme));
    var fresh = wrap.firstChild;
    if (fresh) box.replaceWith(fresh);
    else box.remove();
  }
  var van = document.getElementById("dwc-vanity");
  if (van) {
    var vwrap = document.createElement("div");
    vwrap.innerHTML = vanityURLHTML(m);
    van.replaceWith(vwrap.firstChild);
  }
}
function vanityURLHTML(m) {
  if (!m.page_slug) return '<div id="dwc-vanity"></div>';
  var url = "https://rarecandyreserve.org/community.html#/u/" + encodeURIComponent(m.page_slug);
  return '<div id="dwc-vanity" class="dwc-vanity-url">🔗 My page: <a href="' + esc(url) + '">' + esc(url) + '</a> ' +
    '<button type="button" class="btn ghost small dwc-copy-icon" title="Copy page link" aria-label="Copy page link" onclick="DWC.copyVanityUrl(\'' + esc(m.page_slug.replace(/'/g, "")) + '\')">📋</button></div>';
}
// ---------- v3.10 — one video per profile ----------
// Click-to-play ONLY — nothing autoplays. A YouTube link shows its
// thumbnail with a play button; an uploaded clip shows a play tile.
// Tapping swaps the real player in (YouTube privacy-enhanced embed,
// or the uploaded file with controls). The video always sits on the
// OPPOSITE side from the member's action buttons.
// Whether the member has a video on their page (v3.22) — used so the
// page URL is shown exactly once: under the video when there is one,
// after the Connect card when there isn't.
function profileHasVideo(th) {
  if (!th || (th.hide_sections || []).indexOf("video") >= 0) return false;
  return !!(extractYouTubeId(th.video_url || "") || th.video_file_url);
}
function profileVideoHTML(m, th) {
  if (!th || (th.hide_sections || []).indexOf("video") >= 0) return "";
  // Video size + centering (v3.22) — the size and the centering apply
  // to the video AND the page URL under it, as one block: the URL rides
  // inside the video block, so they scale and center together. Size ""
  // = Normal (current size, default); "s" Small, "l" Big, "stretch"
  // Stretch to fit. Center locks the block in the middle of its spot.
  var sizeCls = th.video_size === "s" ? " dwc-vid-s" : th.video_size === "l" ? " dwc-vid-l" : th.video_size === "stretch" ? " dwc-vid-stretch" : "";
  var centerCls = th.video_align === "center" ? " dwc-vid-centered" : "";
  var wrapCls = ' class="dwc-profile-video' + sizeCls + centerCls + '"';
  var urlLine = vanityURLHTML(m);
  var yt = extractYouTubeId(th.video_url || "");
  if (yt) {
    return '<div' + wrapCls + '><div class="dwc-vid-facade" role="button" tabindex="0" title="Play video" onclick="DWC.playProfileVideo(this,\'yt\',\'' + yt + '\')">' +
      '<img src="https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg" alt="Video thumbnail" loading="lazy">' +
      '<span class="dwc-vid-play">▶</span><span class="dwc-vid-label">▶ Play video</span></div>' +
      '<p class="dwc-vid-src">Video via YouTube · <a href="https://www.youtube.com/watch?v=' + yt + '" target="_blank" rel="noopener">Watch on YouTube ↗</a></p>' + urlLine + '</div>';
  }
  if (th.video_file_url) {
    return '<div' + wrapCls + '><div class="dwc-vid-facade dwc-vid-file" role="button" tabindex="0" title="Play my video" onclick="DWC.playProfileVideo(this,\'file\',\'' + encodeURIComponent(th.video_file_url) + '\')">' +
      '<span class="dwc-vid-play">▶</span><span class="dwc-vid-label">▶ Play my video</span></div>' + urlLine + '</div>';
  }
  return "";
}
// The buttons + video side row: 2×2 button grid on one side, the video
// on the other. Buttons hidden → the video takes the whole row. Neither
// set → no row at all.
function profileSideRowHTML(m, th) {
  var showButtons = !th || th.buttons_show !== false;
  var side = (th && th.buttons_side === "right") ? "right" : "left";
  var buttons = showButtons ? actionButtonsHTML(m, !!m.is_mine, th) : "";
  var video = profileVideoHTML(m, th);
  if (!buttons && !video) return "";
  // Links row (v3.22) — the member's links sit up top with the other
  // top links, in a neat row next to them, instead of stacked under the
  // 2×2 button block. "Hide My links" hides them here too.
  var linksHidden = !!(th && (th.hide_sections || []).indexOf("links") >= 0);
  var links = linksHidden ? "" : myLinksButtonsHTML(m.my_links);
  var linksRow = links ? '<div class="dwc-links-row">' + links + "</div>" : "";
  // Video size (v3.22) — Big gives the video cell most of the row;
  // Stretch gives it the whole row; Small keeps it narrow.
  var vidRowCls = (th && th.video_size === "s") ? " dwc-side-vid-s" : (th && th.video_size === "l") ? " dwc-side-vid-l" : (th && th.video_size === "stretch") ? " dwc-side-vid-stretch" : "";
  var cells = side === "right"
    ? '<div class="dwc-side-cell dwc-side-video">' + video + '</div><div class="dwc-side-cell dwc-side-buttons">' + buttons + "</div>"
    : '<div class="dwc-side-cell dwc-side-buttons">' + buttons + '</div><div class="dwc-side-cell dwc-side-video">' + video + "</div>";
  return linksRow + '<div class="dwc-side-row dwc-side-' + side + vidRowCls + '">' + cells + "</div>";
}

// ---------- v3.9 profile customization helpers ----------
// GB/GBA handheld body colors — the member's mode, or their own 3.
function gbFrameColors(th) {
  if (th && th.gb_mode === "custom" && th.gb_colors && th.gb_colors.length === 3) return th.gb_colors;
  var mode = (th && th.gb_mode) || "gamecube";
  return GB_FRAME_COLORS[mode] || GB_FRAME_COLORS.gamecube;
}
// The profile picture, wrapped in the member's frame, sized by their
// picture-size pick, and clickable to open the picture viewer (large +
// comments + heart). GB/GBA frames render a handheld around the
// picture instead of a round ring.
function picAvatarHTML(m, th) {
  var frame = (th && th.pic_frame) || "none";
  var big = !th || th.pic_size !== "smaller";
  var sizeCls = big ? " dwc-avatar-big" : "";
  var img = m.avatar_url
    ? '<img class="dwc-avatar' + sizeCls + '" src="' + esc(m.avatar_url) + '" alt="">'
    : '<span class="dwc-avatar dwc-avatar-none' + sizeCls + '">🍬</span>';
  var style = "";
  if (frame === "blood" && th && th.blood_color) style = ' style="--blood:' + esc(th.blood_color) + '"';
  if (frame === "gb" || frame === "gba") {
    var cols = gbFrameColors(th);
    style = ' style="--gb-c1:' + cols[0] + ';--gb-c2:' + cols[1] + ';--gb-c3:' + cols[2] + '"';
    return '<span class="dwc-picwrap dwc-picframe-' + frame + '"' + style + ' role="button" tabindex="0" title="Tap to enlarge + comment" onclick="DWC.openPicViewer(' + m.id + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();DWC.openPicViewer(' + m.id + ')}">' +
      '<span class="dwc-gb-screen">' + img + '</span>' +
      '<span class="dwc-gb-label">' + (frame === "gba" ? "GAME BOY ADVANCE" : "GAME BOY") + '</span>' +
      '<span class="dwc-gb-dpad"></span>' +
      '<span class="dwc-gb-startselect"><i></i><i></i></span>' +
      '<span class="dwc-gb-ab"><i></i><i></i></span>' +
      '<span class="dwc-gb-speaker"><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
      "</span>";
  }
  return '<span class="dwc-picwrap dwc-picframe-' + frame + '"' + style + ' role="button" tabindex="0" title="Tap to enlarge + comment" onclick="DWC.openPicViewer(' + m.id + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();DWC.openPicViewer(' + m.id + ')}">' + img + "</span>";
}
// The picture + name + bio block (no card wrapper — the caller wraps it).
// v3.10 — the occupation line respects "Hide Occupation" (hide_sections).
function profileHeadInnerHTML(m, th) {
  var hideOcc = !!(th && (th.hide_sections || []).indexOf("occupation") >= 0);
  // Cover name placement (v3.22) — when the name sits beside the top
  // picture, the head card keeps the picture + bio + meta but hides its
  // own name line, so the name shows exactly once.
  var nameBeside = !!(m && m.banner_url && th && (th.cover_name === "left" || th.cover_name === "right"));
  return '<div class="dwc-profile-row">' + picAvatarHTML(m, th) +
    '<div>' + (nameBeside ? "" : '<h2 style="margin:0">@' + esc(m.username) + " " + presenceDot(m) + " " + badgeHTML(m) + achBadgeIconsHTML(m.badges) + "</h2>") +
    (!hideOcc && m.occupation ? "<p style=\"margin:4px 0\">" + esc(m.occupation) + "</p>" : "") +
    (m.bio ? '<p style="margin:4px 0;white-space:pre-wrap">' + esc(m.bio) + "</p>" : "") +
    '<p class="dwc-meta" style="margin:4px 0">' +
    (m.birthday ? "🎂 " + esc(m.birthday) + " · " : "") + "Joined " + fmtDate(m.created_at) +
    (m.age_verified ? ' · <span style="color:var(--green)">Age verified ✓</span>' : "") +
    (m.payout_ready ? ' · <span style="color:var(--green)">✓ Payout ready</span>' : "") + "</p>" +
    (m.presence === "away" && m.away_message ? '<p style="margin:4px 0">🌙 Away: “' + esc(m.away_message) + "”</p>" : "") +
    "</div></div>";
}
// The Edit / All-members nav row on a member page (standard look).
// Split out of profileActionsHTML (v3.20) so the row stays in the page
// header while the buttons + video move into the middle column.
function profileNavRowHTML(m) {
  return '<div class="dwc-actions" style="margin-top:14px">' +
    (m.is_mine
      ? '<button type="button" class="btn ghost small" onclick="DWC.editProfile()">Edit profile</button> <button type="button" class="btn ghost small" onclick="DWC.openProfilePhotoUpload()">📷 Add photos</button>'
      : "") +
    '<button type="button" class="btn ghost small" onclick="DWC.go(\'members\')">← All members</button>' +
    "</div>";
}
// v3.21 — Add photos, direct on your own profile. A file picker that
// uploads straight to the stored profile gallery (no Taffy Phone
// needed) — up to 5 files at once, each with a short description and a
// Public / Friends choice, with the candy loader + "Uploaded ✓".
function profilePhotoUploadHTML() {
  var count = state.galleryStoredCount == null ? "…" : state.galleryStoredCount;
  return '<div class="card dwc-photo-upload" id="dwc-photo-upload">' +
    '<h3 style="margin-top:0">📷 Add photos to your profile</h3>' +
    '<p style="color:var(--muted);font-size:13px;margin:0 0 10px">Photos stay on your profile so customers and businesses can browse them — your products, your content. <span id="dwc-photo-upload-count">' + count + ' of 20 photos saved.</span></p>' +
    '<label class="btn small">Choose photos<input type="file" accept="image/*" multiple hidden onchange="DWC.profilePhotoPicked(this)"></label>' +
    '<div id="dwc-photo-upload-list"></div>' +
    '<p><button type="button" class="btn" id="dwc-photo-upload-btn" onclick="DWC.profilePhotoUpload()" disabled>Upload</button> <button type="button" class="btn ghost" onclick="DWC.closeProfilePhotoUpload()">Close</button></p>' +
    '<p id="dwc-photo-upload-status" style="color:var(--muted);font-size:13px;margin:0"></p>' +
    "</div>";
}
// Action buttons for a member page. Website mode shows ONLY "Message me"
// under the picture (plus their video, if they set one) — contact is
// mainly just a message link. The Add me / Favorite / Add to group
// buttons are the MEMBER'S choice there: off by default, on only when
// they tick "Show the buttons too" in the Website look box (theme
// website_buttons). Standard mode shows the buttons + video side row
// (the nav row lives in profileNavRowHTML now, in the page header).
// On your own page the buttons are a disabled preview.
function profileActionsHTML(m, websiteMode, th) {
  var uname = esc(m.username.replace(/'/g, ""));
  var pb = m.profile_buttons || null;
  if (websiteMode) {
    var dis = m.is_mine ? " disabled" : "";
    // v3.20 — the button block brings its own "Preview" line on your
    // own page, so only add one here when the block is off.
    var showBtns = !!(th && th.website_buttons);
    // Professional mode (2026-11-21) — Message me is the only button by
    // default; the contact email shows too, but ONLY when the member
    // opted in (Show my contact email in Edit profile).
    var contactEmail = (m.show_contact_email && m.contact_email)
      ? '<p style="margin:10px 0 0">✉️ <a href="mailto:' + esc(m.contact_email) + '">' + esc(m.contact_email) + "</a></p>" : "";
    // v3.21 — professional-mode button: the member picks the side under
    // their picture and the color (Edit Profile > Buttons). The color
    // wins over the per-button custom color here — it IS the pro-mode
    // pick. Text color flips for readability on dark colors.
    var proSide = th && th.pro_button_side === "center" ? "text-align:center" : th && th.pro_button_side === "right" ? "text-align:right" : "";
    var proCol = th && th.pro_button_color ? th.pro_button_color : "";
    var msgStyle = proCol ? ' style="background:' + esc(proCol) + ';color:' + buttonTextFor(proCol) + '"' : actionButtonStyle(pb, "message");
    var out = '<div class="dwc-actions" style="margin-top:14px' + (proSide ? ";" + proSide : "") + '">' +
      ((m.is_mine && !showBtns) ? '<p style="color:var(--muted);font-size:13px;margin:0 0 8px">👀 Preview — this is what visitors see on your page.</p>' : "") +
      '<button type="button" class="btn"' + dis + ' onclick="DWC.imMember(' + m.id + ", '" + uname + "')\"" + msgStyle + ">💬 " + esc(actionButtonLabel(pb, "message", "Message me")) + "</button>" +
      contactEmail +
      "</div>";
    if (showBtns) out += actionButtonsHTML(m, !!m.is_mine, th);
    return out + profileVideoHTML(m, th);
  }
  // v3.21 — the buttons + video + links live in one grouped Connect
  // card now, instead of a loose floating row, so visitors (and the
  // owner) can find them at a glance. The vanity URL + group picker
  // stay outside the card.
  var row = profileSideRowHTML(m, th);
  var connect = row ? '<section class="card dwc-connect-card"><h3 style="margin-top:0">💬 Connect</h3>' + row + "</section>" : "";
  // v3.22 — the page URL rides under the video when there is one, so
  // only show it here (after the Connect card) when there is no video.
  // Either way it shows exactly once.
  var van = profileHasVideo(th) ? "" : vanityURLHTML(m);
  return connect +
    (m.is_mine ? van : '<div id="dwc-group-picker"></div>' + van);
}
// Website-look sections — only the checked fields, in order.
// v3.10 — relationship also respects "Hide Relationship status".
// v3.21 — ONE grouped About card instead of a card per field: bio +
// occupation up top, then the five personal fields as labeled rows.
// Every row keeps its own gate (bio/occupation hide with "About";
// each field with its own Show box). In the edit preview, hidden rows
// render dimmed so the member sees what they typed AND that it won't
// publish until they tick Show. preview=true (live preview only).
function websiteSectionsHTML(m, mth, preview) {
  var show = m.website_show || {};
  var hideRel = !!(mth && (mth.hide_sections || []).indexOf("relationship") >= 0);
  var hideAbout = !!(mth && (mth.hide_sections || []).indexOf("about") >= 0);
  // Professional mode (2026-11-21) is the opposite of MySpace: the clean
  // website look hides the personal bits. On the live page they don't
  // render at all; in the edit preview they render dimmed so the member
  // sees what stays hidden while professional mode is on.
  var pro = !!(m && m.website_mode);
  if (pro && !preview) return "";
  var dimTag = preview ? ' <span style="color:var(--muted);font-size:12px">' + (pro ? "👁️ Hidden in professional mode" : "👁️ Hidden — tick Show to publish") + "</span>" : "";
  var rows = "";
  var addRow = function (label, html, live, dimmed) {
    if (live) rows += '<p style="margin:10px 0 0">' + (label ? "<strong>" + label + "</strong><br>" : "") + html + "</p>";
    else if (preview && dimmed) rows += '<p style="margin:10px 0 0;opacity:.55">' + (label ? "<strong>" + label + dimTag + "</strong><br>" : dimTag + "<br>") + html + "</p>";
  };
  // Bio + occupation — the old standalone About card, folded in here.
  addRow("", '<span style="white-space:pre-wrap">' + esc(m.bio || "") + "</span>", !hideAbout && !!m.bio && !pro, !!m.bio && (hideAbout || pro));
  addRow("", "Does: <strong>" + esc(m.occupation || "") + "</strong>", !hideAbout && !!m.occupation && !pro, !!m.occupation && (hideAbout || pro));
  // Hobbies
  addRow("🎯 Hobbies", '<span style="white-space:pre-wrap">' + esc(m.hobbies || "") + "</span>", !!(show.hobbies && m.hobbies && !pro), !!(m.hobbies && (!show.hobbies || pro)));
  // Where I work
  addRow("💼 Where I work", esc(m.workplace || ""), !!(show.workplace && m.workplace && !pro), !!(m.workplace && (!show.workplace || pro)));
  // Relationship
  addRow("💞 Single or in a relationship", esc(m.relationship_status || ""), !!(show.relationship && !hideRel && m.relationship_status && !pro), !!(m.relationship_status && (!show.relationship || pro) && !hideRel));
  // Sign
  if (show.sign && m.birthsign && ZODIAC_SIGNS[m.birthsign] && !pro) {
    var z = ZODIAC_SIGNS[m.birthsign];
    addRow("✨ Sign", '<span class="dwc-sign">' + z.symbol + " " + esc(z.name) + '</span><br><span style="color:var(--muted)">' + esc(z.blurb) + "</span>", true, false);
  } else if (preview && m.birthsign && (!show.sign || pro) && ZODIAC_SIGNS[m.birthsign]) {
    var z2 = ZODIAC_SIGNS[m.birthsign];
    addRow("✨ Sign", '<span class="dwc-sign">' + z2.symbol + " " + esc(z2.name) + '</span><br><span style="color:var(--muted)">' + esc(z2.blurb) + "</span>", false, true);
  }
  // Recent accomplishments
  addRow("🏆 Recent accomplishments", '<span style="white-space:pre-wrap">' + esc(m.accomplishments || "") + "</span>", !!(show.accomplishments && m.accomplishments && !pro), !!(m.accomplishments && (!show.accomplishments || pro)));
  if (!rows) return "";
  return '<section class="card dwc-about-card"><h3 style="margin-top:0">👤 About</h3>' + rows + "</section>";
}
// v3.9 — the "Scrolling ticker or headline" effect: when the member
// hasn't set their own ticker text, the effect shows their bio line (or
// a welcome line) scrolling above the page instead.
function vibeTickerHTML(m, th) {
  if (!th || (th.effects || []).indexOf("ticker-effect") < 0) return "";
  if (m.ticker_enabled && m.ticker_text) return ""; // their own ticker already renders
  var text = (m.bio || "").split("\n")[0].trim() || "Welcome to my page!";
  var color = /^#[0-9a-fA-F]{6}$/.test(m.ticker_color || "") ? m.ticker_color : "#00e5ff";
  return '<div class="dwc-ticker" style="color:' + esc(color) + '"><div class="dwc-ticker-inner">' + esc(text) + "</div></div>";
}

async function viewMember(el, memberId) {
  // Website-mode chrome fade lives only on a website-mode member page —
  // take it down first (a gated / missing member still shows the chrome).
  if (typeof document !== "undefined" && document.body) document.body.classList.remove("dwc-website-view");
  el.innerHTML = '<p style="color:var(--muted)">Loading their page…</p>';
  // Rare Candy loading bar — the member fetch has no progress events,
  // so the bar runs indeterminate until the page renders.
  if (window.RCRloader) window.RCRloader.show();
  var data = await apiGet("/members/" + memberId + "?device_id=" + encodeURIComponent(deviceId()));
  var m = data && data.member;
  // Age gate (v3.9): an adult creator's page is 18+ only. Unverified
  // viewers get the gate, not the profile — no details leak through.
  if (data && data.gated) {
    el.innerHTML = '<div class="card"><h2 style="margin-top:0">🔞 This page is 18+</h2>' +
      '<p>@' + esc(data.username || "This member") + ' posts adult content, so this page is only for members who have verified their age with a photo ID.</p>' +
      '<p>🔒 <strong>Your ID is safe here.</strong> It goes into a private vault for Chris to check, and it is permanently deleted the moment he approves or rejects it. Nothing is stored — no photo, no ID number, no birthdate.</p>' +
      '<p><button type="button" class="btn" onclick="DWC.go(\'rules\')">Verify my age →</button> ' +
      '<button type="button" class="btn ghost" onclick="DWC.go(\'members\')">← Back to Members</button></p></div>';
    if (window.RCRloader) window.RCRloader.hide();
    return;
  }
  if (!m) {
    el.innerHTML = '<div class="note">That member doesn’t exist.</div><p><button type="button" class="btn ghost" onclick="DWC.go(\'members\')">← Back to Members</button></p>';
    if (window.RCRloader) window.RCRloader.hide();
    return;
  }
  state.viewingMember = m;
  // Their layout, scoped to this page only (removed on navigation).
  if (m.layout_css) {
    var st = document.createElement("style");
    st.id = "dwc-member-layout";
    st.textContent = scopeProfileCss(m.layout_css);
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
  // Webfonts this profile actually uses (name + page text) — one deduped
  // <link>, loaded from the allowlist only.
  ensureProfileFonts(m.profile_theme);
  // v3.9 — website look + picture position drive the layout.
  var mth = parseThemeClient(m.profile_theme);
  var isWebsite = !!m.website_mode;
  var picOnTop = mth.pic_position === "top";
  var hidden = function (key) { return (mth.hide_sections || []).indexOf(key) >= 0; };
  // v3.20 — MySpace three columns: LEFT = info (website sections,
  // About, What I sell, Steady Wave), MIDDLE = goods (video + buttons,
  // or Message + video in website mode) on top with the post feed
  // scrolling endlessly below, RIGHT = Top Friends on top, divider,
  // then Page comments. The right column sits on the right by default
  // and stays put unless the member picks Left in settings.
  var tfCount = mth.topfriends_count || 8;
  var tfSideLeft = mth.topfriends_side === "left";
  var topFriends = (m.top_friends || []).slice(0, tfCount);
  var navRow = isWebsite ? "" : profileNavRowHTML(m);
  var headCard = '<section class="card dwc-mypage-head">' + profileHeadInnerHTML(m, mth) + navRow + "</section>";
  var headTop = '<section class="dwc-mypage-top">' + profileHeadInnerHTML(m, mth) + navRow + "</section>";
  var isBtcTicker = mth.ticker_source === "btc";
  var topBanner = (isWebsite ? websiteBannerHTML(m, mth) : coverBannerHTML(m, mth)) + tickerHTML(m, mth) + (isBtcTicker ? "" : vibeTickerHTML(m, mth));
  // LEFT — info.
  // v3.21 — the Subscribe button can be hidden from Edit Profile >
  // Buttons ("Which buttons show"). buttons_visible null = all show.
  var showSubscribe = !mth.buttons_visible || mth.buttons_visible.indexOf("subscribe") >= 0;
  var sellerSection = (((m.seller_types && m.seller_types.length) || (m.seller_tags && m.seller_tags.length) || m.seller_open_to) && !hidden("seller")
    ? '<section class="card dwc-sellercard"><h3 style="margin-top:0">🎨 What I sell</h3>' +
      ((m.seller_types && m.seller_types.length) ? "<p>Sells: <strong>" + esc(m.seller_types.join(", ")) + "</strong></p>" : "") +
      ((m.seller_tags && m.seller_tags.length) ? '<p class="dwc-tags">' + m.seller_tags.map(function (t) { return "<span>#" + esc(t) + "</span>"; }).join(" ") + "</p>" : "") +
      (m.seller_open_to ? "<p>Open to: “" + esc(m.seller_open_to) + "”</p>" : "") +
      ((m.seller_price_min_cents || m.seller_price_max_cents) ? "<p>Price range: <strong>" + money(m.seller_price_min_cents) + " – " + money(m.seller_price_max_cents) + "</strong></p>" : "") +
      // Professional mode (2026-11-21) — Message me (in the actions
      // area above) is the only button by default, so the seller
      // Subscribe / Message privately buttons stay off here. The shop
      // info above still shows. v3.21 — the Subscribe button itself
      // can be hidden from Edit Profile > Buttons ("Which buttons show").
      ((m.is_mine || isWebsite) ? "" : '<p>' + (showSubscribe ? '<button type="button" class="btn dwc-subscribe" onclick="DWC.messageSeller(' + m.id + ", '" + esc(m.username.replace(/'/g, "")) + '\', null)">' + esc(m.subscribe_label || "Subscribe to my page") + '</button> ' : "") + '<button type="button" class="btn ghost small" onclick="DWC.messageSeller(' + m.id + ", '" + esc(m.username.replace(/'/g, "")) + '\', null)">💬 Message privately</button></p>') +
      "</section>"
    : "");
  var radioSection = (m.show_vnr_player && !hidden("radio")
    ? '<section class="card dwc-vnrcard"><h3 style="margin-top:0">📻 Steady Wave</h3><p style="color:var(--muted);font-size:13px;margin-top:0">Live from the station — tap play (browsers won’t start sound on their own until you tap something).</p>' +
      '<div class="dwc-vnr-player"><span class="dwc-vnr-label">🎙️ Steady Wave · LIVE</span>' +
      '<button type="button" class="btn" onclick="DWC.playVNR()">▶ Play Steady Wave</button> ' +
      '<audio id="dwc-vnr-audio" controls preload="' + (m.autoplay_vnr ? "auto" : "none") + '"' + (m.autoplay_vnr ? " autoplay" : "") + ' src="' + VNR_STREAM_URL + '">Your browser can’t play the stream here — open it in a new tab: ' + VNR_STREAM_URL + "</audio></div>" +
      '<p style="margin:8px 0 0;font-size:13px"><a href="' + VNR_STREAM_URL + '" target="_blank" rel="noopener">Open the stream in a new tab ↗</a></p></section>'
    : "");
  // Professional mode (2026-11-21) is the opposite of MySpace: the five
  // website sections only render in MySpace mode, whenever their OWN
  // Show box is ticked. Professional mode hides them outright (see
  // websiteSectionsHTML) — the clean website look keeps just the
  // banner, the Message link, the shop, and an opted-in contact email.
  // v3.21 — the bio + occupation live inside the grouped About card
  // (websiteSectionsHTML), so there is no separate About card anymore.
  var infoCol =
    websiteSectionsHTML(m, mth) +
    sellerSection + radioSection;
  // MIDDLE — goods on top, then the post feed scrolling endlessly below.
  var mainCol = profileActionsHTML(m, isWebsite, mth) +
    '<section class="card dwc-member-feed"><h3 style="margin-top:0">📝 Posts</h3>' +
    '<div class="dwc-member-feed-list" id="dwc-member-feed-list"><p style="color:var(--muted)">Loading posts…</p></div>' +
    '<div id="dwc-member-feed-more" style="margin-top:10px"></div></section>';
  // RIGHT — Top Friends (compact, bordered) + divider + Page comments.
  // The divider only renders between Top Friends and comments — if
  // either side is hidden, there's no line to draw.
  var top8Section = ((!isWebsite && !hidden("top8") && topFriends.length)
    ? '<section class="card dwc-topfriends-box"><h3 style="margin-top:0">🌟 Top ' + tfCount + '</h3><p style="color:var(--muted);font-size:13px;margin-top:0">Thanks for the add — these are the ' + tfCount + '.</p>' + topFriendsRowHTML(topFriends) + "</section>"
    : "");
  var divId = mth.divider || (m.id === 1 ? "goldswirl" : "");
  var dividerStr = (top8Section && !hidden("comments")) ? dividerHTML(divId, dividerColorFor(mth, divId)) : "";
  // v3.7 — page comments (spec section 9): anyone who added this
  // member can leave a comment — public, friends-only, or private.
  var commentsSection = (!hidden("comments") ? '<section class="card dwc-side-comments" id="dwc-page-comments"><h3 style="margin-top:0">💬 Page comments</h3><div id="dwc-page-comments-list"><p style="color:var(--muted)">Loading comments…</p></div><div id="dwc-page-comments-form"></div></section>' : "");
  var sideCol = top8Section + dividerStr + commentsSection;
  // Website mode is the member's own standalone site: the platform
  // chrome fades away (body class hides the site header, hero,
  // community pills, profile card, meme drawer, and footer — the tiny
  // footer link below is the only way back). Standard mode leaves the
  // chrome alone.
  if (typeof document !== "undefined" && document.body) document.body.classList.toggle("dwc-website-view", !!isWebsite);
  // Custom page (v3.20) — website mode + the member's own HTML: their
  // code IS the page. It replaces the banner header and the three
  // columns (but not the listings, the message link, or the way back).
  var hasCustomPage = !!(isWebsite && mth.custom_page_html);
  // Professional mode (v3.20) — the member's listings on their page,
  // so the page works as their personal website/shop. Full width below
  // the columns (or below the custom page); hidden when they have no
  // active listings.
  var listingsSection = (isWebsite && !hidden("listings") ? '<section class="card" id="dwc-member-listings"><h3 style="margin-top:0">🛒 Shop — my listings</h3><div id="dwc-member-listings-list"><p style="color:var(--muted)">Loading listings…</p></div></section>' : "");
  // The only way back — tiny and unobtrusive, on purpose. The owner
  // also gets an Edit link here (their website nav bar is gone).
  var websiteBack = (isWebsite ? '<p class="dwc-website-back"><a href="community.html">🍬 ← Rare Candy Reserve</a>' + (m.is_mine ? ' · <button type="button" class="dwc-linklike" onclick="DWC.editProfile()">Edit profile</button>' : "") + "</p>" : "");
  // v3.21 — button size: the member's pick from Edit Profile > Buttons.
  // "" = M, the current size; the class scales every button on the page.
  var btnSizeCls = mth.button_size ? " dwc-btn-" + mth.button_size : "";
  el.innerHTML =
    '<div class="dwc-myprofile' + (isWebsite ? " dwc-website" : "") + btnSizeCls + '">' +
    (hasCustomPage
      ? '<div class="dwc-custom-page">' + sanitizeCustomPageHtml(mth.custom_page_html) + "</div>" + profileActionsHTML(m, true, mth) + listingsSection + websiteBack
      : (picOnTop ? headTop + topBanner : topBanner + headCard) +
        '<div id="dwc-photo-upload-host"></div>' +
        '<div class="dwc-member-cols' + (tfSideLeft ? " dwc-member-cols-flip" : "") + '">' +
        '<div class="dwc-member-col dwc-member-col-info">' + infoCol + "</div>" +
        '<div class="dwc-member-col dwc-member-col-main">' + mainCol + "</div>" +
        '<div class="dwc-member-col dwc-member-col-side">' + sideCol + "</div>" +
        "</div>" +
        listingsSection + websiteBack) +
    "</div>";
  // Start the Steady Wave stream on the visitor's first tap/click/scroll
  // (browsers block autoplay with sound until a real gesture).
  DWC.armVNRAutoplay();
  // v3.10 — live Bitcoin ticker: refresh the price now + every minute.
  armBtcTicker();
  // Banner auto-fit for cached images (the onload may already have fired).
  var bannerImg = el.querySelector(".dwc-banner img");
  if (bannerImg && bannerImg.complete) bannerFit(bannerImg);
  if (!hasCustomPage) loadMemberFeed(m.id);
  if (isWebsite && !hidden("listings")) loadMemberListings(m.id);
  if (!hasCustomPage && !hidden("comments")) loadPageComments(m.id, m.is_mine, m.is_friend);
  if (window.RCRloader) window.RCRloader.hide();
}

// ---------- v3.7 page comments ----------
async function loadPageComments(profileId, isMine, isFriend) {
  var list = $("dwc-page-comments-list");
  var formHost = $("dwc-page-comments-form");
  if (!list) return;
  // Team moderation (v3.18) — admins can delete page comments too.
  var canMod = state.profile && (state.profile.is_operator || state.profile.role === "admin");
  var data = await apiGet("/profile-comments?profile_id=" + profileId + (state.profile ? "&device_id=" + encodeURIComponent(deviceId()) : ""));
  var comments = (data && data.comments) || [];
  list.innerHTML = comments.length
    ? comments.map(function (c) {
        return commentCardHTML(c, {
          canReply: true,
          react: { ctype: "profile", ref: profileId },
          gifAsImage: true, // page comments show a raw GIF link as an image, as before
          visibilityNote: c.visibility !== "public" ? "· " + (c.visibility === "friends" ? "friends-only" : "private") : "",
          mediaHTML: (c.image_url ? '<p style="margin:4px 0"><img src="' + esc(c.image_url) + '" alt="" style="max-width:100%;border-radius:8px"></p>' : "") +
            // Professional mode — a GIF on a page comment sits behind a
            // button instead of auto-showing (see gifEmbedHTML gate).
            (c.gif_url ? (isWebsiteView() ? '<p style="margin:4px 0"><button type="button" class="btn ghost small" data-gif-src="' + esc(c.gif_url) + '" onclick="DWC.loadGifImg(this)">▶ Load GIF</button></p>' : '<p style="margin:4px 0"><img src="' + esc(c.gif_url) + '" alt="" style="max-width:100%;border-radius:8px"></p>') : ""),
          extraActions: (c.is_mine || isMine || canMod) ? ' <button type="button" class="dwc-linklike" onclick="DWC.deletePageComment(' + c.id + "," + profileId + ')">Delete</button>' : "",
        });
      }).join("")
    : "<p style=\"color:var(--muted)\">No page comments yet — be the first.</p>";
  if (!formHost) return;
  if (!state.profile) {
    formHost.innerHTML = '<p style="color:var(--muted)">Sign in to leave a page comment.</p>';
    return;
  }
  if (!data.can_comment) {
    formHost.innerHTML = '<p style="color:var(--muted)">Add them as a friend first — only friends can leave page comments.</p>';
    return;
  }
  formHost.innerHTML =
    '<form class="dwc-rowform" onsubmit="DWC.sendPageComment(this,' + profileId + '); return false;" style="flex-wrap:wrap">' +
    '<textarea name="body" rows="2" maxlength="500" placeholder="Leave a comment on this page…" style="flex:1;min-width:200px"></textarea>' +
    '<select name="visibility" title="Who can see this comment"><option value="public">🌍 Public</option><option value="friends">👥 Friends-only</option><option value="private">🔒 Private (just them)</option></select>' +
    '<input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif" title="Attach a picture">' +
    '<input type="url" name="gif_url" placeholder="GIF link (https://…)" style="min-width:180px">' +
    '<button class="btn" type="submit">Post comment</button></form>' +
    '<p class="dwc-form-err" data-err hidden></p>';
}

// ---------- v3.20 member post feed ----------
// The member's own posts on their page, newest first, in the middle
// column under the video + buttons. The feed lives in its own scroll
// region and loads endlessly: scrolling near the bottom fetches the
// next page, and the Load more button does the same. Privacy is
// server-enforced (feed_visible:false → a plain private note, never
// an error). News posts show here too — no category filter, so
// @WallMarketNews's feed reads directly on his page.
async function loadMemberFeed(memberId) {
  var list = $("dwc-member-feed-list");
  var moreHost = $("dwc-member-feed-more");
  if (!list) return;
  var feed = { before: null, hasMore: true, loading: false, loaded: 0 };
  async function loadPage() {
    if (feed.loading || !feed.hasMore) return;
    feed.loading = true;
    var q = "/posts?profile_id=" + memberId + "&limit=10&device_id=" + encodeURIComponent(deviceId());
    if (feed.before) q += "&before=" + feed.before;
    var data = await apiGet(q);
    feed.loading = false;
    if (!data) return;
    if (data.feed_visible === false) {
      list.innerHTML = '<p style="color:var(--muted)">This member’s posts are private.</p>';
      if (moreHost) moreHost.innerHTML = "";
      feed.hasMore = false;
      return;
    }
    var posts = (data && data.posts) || [];
    if (feed.loaded === 0 && !posts.length) {
      list.innerHTML = '<p style="color:var(--muted)">No posts yet.</p>';
      if (moreHost) moreHost.innerHTML = "";
      feed.hasMore = false;
      return;
    }
    if (feed.loaded === 0) list.innerHTML = "";
    list.innerHTML += posts.map(postCardHTML).join("");
    feed.loaded += posts.length;
    if (posts.length) feed.before = posts[posts.length - 1].id;
    feed.hasMore = !!data.has_more;
    if (moreHost) moreHost.innerHTML = feed.hasMore
      ? '<button type="button" class="btn ghost small" onclick="DWC.loadMoreMemberFeed()">Load more posts ↓</button>'
      : (feed.loaded > 10 ? '<p style="color:var(--muted);font-size:13px">That’s everything they’ve posted.</p>' : "");
  }
  state.feedLoader = loadPage;
  list.addEventListener("scroll", function () {
    if (list.scrollTop + list.clientHeight > list.scrollHeight - 200) loadPage();
  });
  loadPage();
}

// ---------- v3.20 professional-mode listings ----------
// Website look only: the member's active listings on their page, so
// the page works as their personal website/shop. Full-width section
// below the columns; hidden entirely when they have nothing listed.
async function loadMemberListings(memberId) {
  var host = $("dwc-member-listings-list");
  if (!host) return;
  var data = await apiGet("/listings?profile_id=" + memberId + "&limit=12");
  var items = (data && data.listings) || [];
  if (!items.length) {
    var sec = $("dwc-member-listings");
    if (sec) sec.style.display = "none";
    return;
  }
  host.innerHTML = '<div class="dwc-member-listings-grid">' + items.map(listingCardHTML).join("") + "</div>";
}


// ---------- v3.9 picture viewer (lightbox + comments + heart) ----------
// Opened by tapping a profile picture. Shows the picture large in the
// owner's frame, with Prev/Next through their public phone pictures
// (avatar first, then up to 20 public gallery photos), a heart button
// under it (v3.16 — heart or nothing, no sad/confused), and a comment
// thread under that (the profile-comments API, subject = the picture).
function picViewerPhotoHTML(pv) {
  var photo = pv.photos[pv.index];
  if (!photo) return '<p style="color:var(--muted)">No picture here.</p>';
  var th = pv.theme || {};
  var frame = th.pic_frame || "none";
  var style = "";
  if (frame === "blood" && th.blood_color) style = ' style="--blood:' + esc(th.blood_color) + '"';
  var img = '<img class="dwc-avatar dwc-picviewer-img" src="' + esc(photo.url) + '" alt="' + esc(photo.label || "Profile picture") + '">';
  if (frame === "gb" || frame === "gba") {
    var cols = gbFrameColors(th);
    style = ' style="--gb-c1:' + cols[0] + ';--gb-c2:' + cols[1] + ';--gb-c3:' + cols[2] + '"';
    return '<span class="dwc-picwrap dwc-picframe-' + frame + '"' + style + '>' +
      '<span class="dwc-gb-screen">' + img + '</span>' +
      '<span class="dwc-gb-label">' + (frame === "gba" ? "GAME BOY ADVANCE" : "GAME BOY") + '</span>' +
      '<span class="dwc-gb-dpad"></span>' +
      '<span class="dwc-gb-startselect"><i></i><i></i></span>' +
      '<span class="dwc-gb-ab"><i></i><i></i></span>' +
      '<span class="dwc-gb-speaker"><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
      "</span>";
  }
  return '<span class="dwc-picwrap dwc-picframe-' + frame + '"' + style + '>' + img + "</span>";
}
function renderPicViewer() {
  var pv = state.picViewer;
  var host = $("dwc-picviewer");
  if (!pv || !host) return;
  var photo = pv.photos[pv.index];
  host.innerHTML =
    '<div class="dwc-picviewer-backdrop" onclick="DWC.closePicViewer()"></div>' +
    '<div class="dwc-picviewer-card" role="dialog" aria-label="Picture viewer">' +
    '<button type="button" class="dwc-picviewer-close" onclick="DWC.closePicViewer()" title="Close">✕</button>' +
    '<div class="dwc-picviewer-photo">' + picViewerPhotoHTML(pv) + "</div>" +
    '<p class="dwc-picviewer-label">' + esc(photo ? (photo.label || "Profile picture") : "") + (state.profile && state.profile.id === pv.memberId && photo && photo.visibility && photo.visibility !== "public" ? " · " + (photo.visibility === "friends" ? "👥 Friends-only" : "🔒 Private") : "") + "</p>" +
    (state.profile && state.profile.id === pv.memberId && photo && photo.subject && photo.subject.indexOf("gallery:") === 0
      ? '<p style="margin:0 0 10px"><button type="button" class="btn small" onclick="DWC.picViewerSetAvatar()">🖼️ Set as profile picture</button></p>'
      : "") +
    '<div class="dwc-picviewer-nav">' +
    '<button type="button" class="btn ghost small" onclick="DWC.picViewerPrev()" ' + (pv.photos.length <= 1 ? "disabled" : "") + '>← Prev</button>' +
    '<span>' + (pv.index + 1) + " / " + pv.photos.length + "</span>" +
    '<button type="button" class="btn ghost small" onclick="DWC.picViewerNext()" ' + (pv.photos.length <= 1 ? "disabled" : "") + '>Next →</button>' +
    "</div>" +
    '<div id="dwc-picviewer-heart" class="dwc-picviewer-heart"></div>' +
    '<div id="dwc-picviewer-comments"><p style="color:var(--muted)">Loading comments…</p></div>' +
    "</div>";
  loadPicViewerComments();
  loadPicViewerHeart();
}
async function loadPicViewerComments() {
  var pv = state.picViewer;
  var host = $("dwc-picviewer-comments");
  if (!pv || !host) return;
  var photo = pv.photos[pv.index];
  if (!photo) { host.innerHTML = ""; return; }
  var data = await apiGet("/profile-comments?profile_id=" + pv.memberId + "&subject=" + encodeURIComponent(photo.subject) + (state.profile ? "&device_id=" + encodeURIComponent(deviceId()) : ""));
  var comments = (data && data.comments) || [];
  var canComment = !!(data && data.can_comment);
  host.innerHTML =
    '<h4 style="margin:12px 0 6px">💬 Comments on this picture</h4>' +
    (comments.length
      ? comments.map(function (c) {
          return commentCardHTML(c, {
            canReply: true,
            react: { ctype: "profile", ref: pv.memberId },
            mediaHTML: (c.image_url ? '<p style="margin:4px 0"><img src="' + esc(c.image_url) + '" alt="" style="max-width:100%;border-radius:8px"></p>' : ""),
            extraActions: (c.is_mine || (state.viewingMember && state.viewingMember.is_mine) || (state.profile && (state.profile.is_operator || state.profile.role === "admin"))) ? ' <button type="button" class="dwc-linklike" onclick="DWC.deletePicComment(' + c.id + ')">Delete</button>' : "",
          });
        }).join("")
      : '<p style="color:var(--muted)">No comments on this picture yet — be the first.</p>') +
    (state.profile
      ? (canComment
        ? '<form class="dwc-rowform" onsubmit="DWC.sendPicComment(this); return false;" style="flex-wrap:wrap;margin-top:8px">' +
          '<textarea name="body" rows="2" maxlength="500" placeholder="Comment on this picture…" style="flex:1;min-width:200px"></textarea>' +
          '<select name="visibility" title="Who can see this comment"><option value="public">🌍 Public</option><option value="friends">👥 Friends-only</option><option value="private">🔒 Private (just them)</option></select>' +
          '<button class="btn" type="submit">Post comment</button></form><p class="dwc-form-err" data-err hidden></p>'
        : '<p style="color:var(--muted)">Add them as a friend first — only friends can comment on pictures.</p>')
      : '<p style="color:var(--muted)">Sign in to comment on this picture.</p>');
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
    '<form class="dwc-rowform" onsubmit="DWC.sendChat(this); return false;">' +
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
          return '<div class="dwc-chatmsg"><strong>' + esc(m.author_name) + "</strong>" + achBadgeIconsHTML(m.author_badges) + (m.is_member ? "" : ' <span class="dwc-guest">guest</span>') + ': <span>' + esc(m.body) + '</span> <span class="dwc-meta">' + fmtDate(m.created_at) + "</span></div>";
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
// Brand-button DM draft (Create page): a visitor taps "build your own
// brand" and lands on #/chat with a pre-written message to Chris (member 1).
// The draft stays in sessionStorage until it is actually put in the
// composer, so a visitor who still needs to sign up gets it after signup.
function applyPendingIMDraft(id, winEl) {
  if (!state.pendingIMDraft || state.pendingIMDraft.id !== id) return;
  var input = winEl.querySelector('input[name="body"]');
  if (input) {
    input.value = state.pendingIMDraft.body;
    input.focus();
  }
  try { sessionStorage.removeItem("dwc-brand-draft"); } catch (e) {}
  state.pendingIMDraft = null;
}
function maybeApplyBrandDraft() {
  if (!state.profile) return;
  if (!state.route || state.route.name !== "chat") return;
  var raw = null;
  try { raw = sessionStorage.getItem("dwc-brand-draft"); } catch (e) { return; }
  if (!raw) return;
  var d = null;
  try { d = JSON.parse(raw); } catch (e) { return; }
  if (!d || !d.body) return;
  DWC.openIM(1, "RareCandyReserve", d.body);
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
    var existing = host.querySelector('[data-imwin="' + im.id + '"]');
    if (existing) { applyPendingIMDraft(im.id, existing); return; }
    var div = document.createElement("div");
    div.className = "dwc-imwin";
    div.setAttribute("data-imwin", String(im.id));
    div.innerHTML =
      '<div class="dwc-imwin-head"><strong>💬 IM — @' + esc(im.username) + '</strong><button type="button" class="dwc-linklike" onclick="DWC.closeIM(' + im.id + ')">✕ Close</button></div>' +
      '<div class="dwc-imlog" id="dwc-imlog-' + im.id + '"><p style="color:var(--muted)">Loading…</p></div>' +
      '<form class="dwc-rowform" onsubmit="DWC.sendIM(this, ' + im.id + '); return false;">' +
      '<input name="body" required maxlength="500" placeholder="Message @' + esc(im.username) + '…" style="flex:1">' +
      '<button class="btn small" type="submit">Send</button></form>';
    host.appendChild(div);
    applyPendingIMDraft(im.id, div);
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
    '<form onsubmit="DWC.saveFindPrefs(this); return false;">' +
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
    '<form id="dwc-txn-form" class="dwc-txn-form" hidden onsubmit="DWC.saveTransaction(this); return false;">' +
    '<label>Amount — whole dollars ($)</label>' +
    '<input name="amount" type="number" step="1" min="1" max="100000" required placeholder="e.g. 15">' +
    '<label>What was bought (one short line, up to 140 characters)</label>' +
    '<input name="note" maxlength="140" required placeholder="e.g. 20-photo set">' +
    '<div class="dwc-rowform"><label><input type="radio" name="role" value="buyer" checked style="width:auto"> I bought it (I spent)</label>' +
    '<label><input type="radio" name="role" value="seller" style="width:auto"> I sold it (I received)</label></div>' +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:10px"><button class="btn small" type="submit">Save receipt →</button></p></form>' +
    '<form class="dwc-rowform" onsubmit="DWC.sendEphemeral(this); return false;">' +
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
    el.innerHTML = '<section class="card"><h2 style="margin-top:0">🚩 Reports</h2><p>Reports go straight to the operator’s inbox — Chris reviews every one. To file a report, use the 🚩 Report button on any post, comment, or listing.</p><p>Flag and report any comment or profile, as well as messages or content you see, if it does not belong — an admin will see it and action will be taken.</p><h3 style="margin:18px 0 6px">File a ticket</h3><p style="color:var(--muted)">No post or listing to point at? Harassment in DMs, account help, anything else — write it here and it lands in the same inbox.</p><textarea id="dwc-ticket-text" rows="4" maxlength="1000" placeholder="What happened, or what do you need?"></textarea><p><button type="button" class="btn small" onclick="DWC.fileTicket()">Send ticket</button></p><p>For further issues unresolved, reach out to <a href="mailto:TheRarecandyreserve@proton.me">TheRarecandyreserve@proton.me</a> or leave a message for the owner of this website or its agents or employees.</p><p style="color:var(--muted)">Only the operator can see the inbox.</p></section>';
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
      return '<article class="card dwc-report"><p style="margin:0"><strong>' + esc(r.target_label) + '</strong> · <span class="dwc-status-' + esc(r.status) + '">' + esc(r.status) + "</span>" +
        (r.assignee_username ? ' · Handling: <strong>@' + esc(r.assignee_username) + "</strong>" : "") + "</p>" +
        '<p style="margin:4px 0">Reported by @' + esc(r.reporter_username) + " · " + fmtDate(r.created_at) + "</p>" +
        (r.reason ? '<p style="margin:4px 0">Reason: ' + esc(r.reason) + "</p>" : "") +
        '<p>' +
        (r.status === "open" ? '<button type="button" class="btn small" onclick="DWC.reportAction(' + r.id + ", 'claim')\">I'll take care of that</button> " : "") +
        (r.status === "claimed" ? '<button type="button" class="btn ghost small" onclick="DWC.reportAction(' + r.id + ", 'release')\">Put it back</button> " : "") +
        (r.status !== "resolved" ? '<button type="button" class="btn ghost small" onclick="DWC.reportAction(' + r.id + ", 'resolve')\">Resolve</button>" : "") +
        "</p></article>";
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

// ---------- v3.7 Admin panel (operator only) ----------

// ---------- v3.8 Admin member filters (operator only) ----------
// Client-side only: the full member list comes from /api/admin/members
// once, and both filters combine (AND) over that array — no extra API
// call. Filter choices persist while the page is open, so a role change
// or ban (which re-renders the panel) doesn't lose them.
var adminMembersAll = [];
var adminSellsFilter = "";
var adminWantsFilter = "";
function renderAdminMembers() {
  var host = $("dwc-admin-members");
  if (!host) return;
  // Team moderation (v3.18) — who is looking decides which controls a
  // row shows. The operator sees everything; admins see silence only
  // (roles, permanent bans, and profile deletion are the operator's
  // call, and the server enforces that too — never just the UI).
  var viewerRole = myTeamRole();
  var viewerIsOp = viewerRole === "operator";
  var viewerIsAdmin = viewerRole === "admin";
  if (!adminMembersAll.length) { host.innerHTML = '<p style="color:var(--muted)">No members yet.</p>'; return; }
  var members = adminMembersAll.filter(function (m) {
    if (adminSellsFilter && (m.seller_types || []).indexOf(adminSellsFilter) === -1) return false;
    if (adminWantsFilter && (m.buyer_types || []).indexOf(adminWantsFilter) === -1) return false;
    return true;
  });
  var filterActive = adminSellsFilter !== "" || adminWantsFilter !== "";
  var opts = function (current) {
    return '<option value=""' + (current === "" ? " selected" : "") + '>All</option>' +
      CREATOR_GENRES.map(function (g) {
        return '<option value="' + esc(g) + '"' + (current === g ? " selected" : "") + ">" + esc(g) + "</option>";
      }).join("");
  };
  host.innerHTML =
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
      '<label style="font-size:13px">Sells <select onchange="DWC.adminFilter(\'sells\', this.value)">' + opts(adminSellsFilter) + "</select></label>" +
      '<label style="font-size:13px">Wants <select onchange="DWC.adminFilter(\'wants\', this.value)">' + opts(adminWantsFilter) + "</select></label>" +
      (filterActive ? '<button type="button" class="btn ghost small" onclick="DWC.adminFilter(\'clear\')">Clear filters</button>' : "") +
      (filterActive ? '<span style="color:var(--muted);font-size:12px">Showing ' + members.length + " of " + adminMembersAll.length + " members</span>" : "") +
    "</div>" +
    (members.length
      ? '<div class="dwc-admin-list">' + members.map(function (m) {
          var isOp = m.role === "operator";
          var sells = (m.seller_types || []).filter(Boolean);
          var wants = (m.buyer_types || []).filter(Boolean);
          var muted = m.muted_until && Number(m.muted_until) > Date.now();
          var controls = "";
          if (isOp) {
            controls = '<span style="color:var(--muted);font-size:12px">Operator</span>';
          } else {
            if (viewerIsOp) {
              controls += '<select onchange="DWC.adminSetRole(' + m.id + ', this.value)" title="Grant a role">' +
                '<option value="member"' + (m.role === "member" ? " selected" : "") + '>Member</option>' +
                '<option value="mod"' + (m.role === "mod" ? " selected" : "") + '>Mod</option>' +
                '<option value="admin"' + (m.role === "admin" ? " selected" : "") + '>Admin</option></select> ' +
                (m.banned
                  ? '<button type="button" class="btn ghost small" onclick="DWC.adminBan(' + m.id + ", false)\">Unban</button> "
                  : '<button type="button" class="btn ghost small" onclick="DWC.adminBan(' + m.id + ", true)\">Ban</button> ") +
                '<button type="button" class="btn ghost small" style="color:var(--danger,#ff5a5a)" onclick="DWC.adminDeleteProfile(' + m.id + ", '" + esc(m.username.replace(/'/g, "")) + '\')">Delete profile</button> ';
            }
            if (viewerIsOp || viewerIsAdmin) {
              if (muted) {
                controls += '<span style="color:var(--amber,#ffb020);font-size:12px">Silenced until ' + fmtMuteDate(m.muted_until) + (m.muted_reason ? " — " + esc(m.muted_reason) : "") + '</span> ' +
                  '<button type="button" class="btn ghost small" onclick="DWC.adminUnsilence(' + m.id + ')">Unsilence</button>';
              } else {
                controls += '<select id="dwc-silence-' + m.id + '" title="Silence for…">' + silenceOptionsHTML(viewerRole) + '</select> ' +
                  '<button type="button" class="btn ghost small" onclick="DWC.adminSilence(' + m.id + ')">Silence</button>';
              }
            }
          }
          return '<div class="dwc-admin-row">' +
            (m.avatar_url ? '<img class="dwc-avatar" src="' + esc(m.avatar_url) + '" alt="" style="width:36px;height:36px">' : '<span class="dwc-avatar dwc-avatar-none" style="width:36px;height:36px;font-size:18px">🍬</span>') +
            '<div style="flex:1;min-width:0"><strong>@' + esc(m.username) + "</strong> " + presenceDot(m) + " " + badgeHTML(m) +
            '<div style="color:var(--muted);font-size:12px">Joined ' + fmtDate(m.created_at) + (m.age_verified ? " · Age verified ✓" : "") + (m.banned ? ' · <span style="color:#ff3b30">BANNED' + (m.banned_reason ? " — " + esc(m.banned_reason) : "") + "</span>" : "") + "</div>" +
            (sells.length ? '<div style="font-size:12px">Sells: ' + sells.map(function (t) { return esc(t); }).join(", ") + "</div>" : "") +
            (wants.length ? '<div style="font-size:12px">Wants: ' + wants.map(function (t) { return esc(t); }).join(", ") + "</div>" : "") +
            "</div>" + controls +
            "</div>";
        }).join("") + "</div>"
      : '<p style="color:var(--muted)">No members match these filters.</p>');
}

async function viewAdmin(el) {
  var isOp = !!(state.profile && (state.profile.role === "operator" || state.profile.is_operator));
  var isAdmin = !!(state.profile && state.profile.role === "admin");
  if (!state.profile || !(isOp || isAdmin)) {
    el.innerHTML = '<section class="card"><h2 style="margin-top:0">🛡️ Admin</h2><p>Only the operator (Chris) and admins he grants can open the admin panel — this is where he bans, grants mod/admin, and approves or denies requests.</p></section>';
    return;
  }
  /* Members, bans, roles, requests, and shop listings stay operator-only.
     The radio text + DJ console below are open to admins too.
     v3.18 — the member LIST is open to admins as well (they need it to
     silence members); the role/ban/delete-profile controls inside each
     row stay operator-only (renderAdminMembers gates them, and the
     server enforces it too). */
  el.innerHTML =
    ((isOp || isAdmin)
      ? '<section class="card"><h2 style="margin-top:0">🛡️ Admin panel</h2><p style="color:var(--muted)">' + (isOp ? "Members, bans, roles, and requests — all in one place. Only you can see the role and ban controls." : "Members — you can silence members here for up to 3 months. Roles, permanent bans, and profile deletion are the operator's call.") + '</p><div id="dwc-admin-members"><p style="color:var(--muted)">Loading members…</p></div></section>'
      : "") +
    (isOp
      ? '<section class="card"><h2 style="margin-top:0">📥 Requests to approve or deny</h2><p style="color:var(--muted)">ID verifications live under 🚩 Reports. Page URL appeals show there too.</p><p><button type="button" class="btn ghost small" onclick="DWC.go(\'reports\')">Open Reports inbox →</button></p></section>' +
        '<section class="card"><h2 style="margin-top:0">🛍️ Shop listings</h2><p style="color:var(--muted)">Edit the shop yourself — photos, prices, descriptions, dropdowns, video, and the Stripe link. No code needed.</p><p><a class="btn" href="admin-listings.html">Edit shop listings →</a></p></section>'
      : "") +
    '<section class="card"><h2 style="margin-top:0">📻 Radio player text</h2><p style="color:var(--muted)">Change the words on the live radio page — they update within 30 seconds. Leave a field blank to leave it as-is.</p>' +
    '<form onsubmit="DWC.saveRadioSettings(this); return false;">' +
    '<label style="display:block;margin-bottom:8px">Station tagline<input name="station_tagline" type="text" maxlength="500" placeholder="DJ Slabb · A Steady Heart · Vita Nova Records" style="width:100%;min-height:48px"></label>' +
    '<label style="display:block;margin-bottom:8px">DJ greeting<input name="dj_greeting" type="text" maxlength="500" placeholder="Slabb here — welcome to Steady Wave." style="width:100%;min-height:48px"></label>' +
    '<label style="display:block;margin-bottom:8px">DJ message<input name="dj_message" type="text" maxlength="500" placeholder="Tune in — the station is live, 24/7." style="width:100%;min-height:48px"></label>' +
    '<label style="display:block;margin-bottom:8px">On-air label<input name="onair_label" type="text" maxlength="500" placeholder="LIVE" style="width:100%;min-height:48px"></label>' +
    '<label style="display:block;margin-bottom:8px">Stream URL — the link the music page video box plays<input name="stream_url" type="text" maxlength="500" placeholder="https://www.youtube.com/watch?v=… or https://www.twitch.tv/…" style="width:100%;min-height:48px"></label>' +
    '<label style="display:block;margin-bottom:8px">Ticker<textarea name="ticker" rows="3" maxlength="500" placeholder="thank you for listening to Steady Wave! …" style="width:100%;min-height:90px"></textarea></label>' +
    '<p><button class="btn" type="submit">Save radio text</button> <span id="dwc-radio-settings-msg" style="font-weight:700"></span></p>' +
    "</form></section>" +
    '<section class="card"><h2 style="margin-top:0">🎧 DJ Console</h2><p style="color:var(--muted)">Run the show from the browser — deck, mic, talk-over, soundboard, and the auto-DJ rotation. Operator + admin only. Keep the tab open while you DJ.</p><p><a class="btn" href="dj-console.html">Open the full DJ Console →</a> <a class="btn ghost" href="dj-lite.html">🎧 Pocket DJ (phone) →</a></p></section>';
  loadRadioSettingsForm();
  if (!isOp && !isAdmin) return;
  var data = await apiGet("/admin?device_id=" + encodeURIComponent(deviceId()));
  var host = $("dwc-admin-members");
  if (!host) return;
  if (!data || !data.ok) { host.innerHTML = '<p style="color:var(--muted)">' + esc((data && data.error) || "Couldn't load members.") + "</p>"; return; }
  adminMembersAll = data.members || [];
  renderAdminMembers();
}

/* Radio player text — load the current settings into the admin form. */
async function loadRadioSettingsForm() {
  var data = await apiGet("/radio-settings");
  if (!data || !data.settings) return;
  var keys = ["station_tagline", "dj_greeting", "dj_message", "ticker", "onair_label", "stream_url"];
  keys.forEach(function (k) {
    var input = document.querySelector('form [name="' + k + '"]');
    if (input && data.settings[k]) input.value = data.settings[k];
  });
}

// ---------- v3.18 Team moderation: silence durations ----------
// Same keys as the server's SILENCE_DURATIONS — the dropdown only ever
// offers what this viewer's role may use (the server caps it again, so
// a forged request still can't go further). "A few days" = 3 days and
// the mod cap of 1 week are PROPOSED defaults for Chris to correct.
var SILENCE_OPTIONS = [
  { key: "1d", label: "1 day" },
  { key: "3d", label: "A few days (3 days)" },
  { key: "1w", label: "1 week" },
  { key: "2w", label: "2 weeks" },
  { key: "6w", label: "6 weeks" },
  { key: "3mo", label: "3 months" },
  { key: "permanent", label: "Permanently" },
];
var SILENCE_MAX_KEY = { operator: "permanent", admin: "3mo", mod: "1w" };
function silenceOptionsFor(role) {
  var order = SILENCE_OPTIONS.map(function (o) { return o.key; });
  var max = SILENCE_MAX_KEY[role] || null;
  if (!max) return [];
  return SILENCE_OPTIONS.filter(function (o) { return order.indexOf(o.key) <= order.indexOf(max); });
}
function silenceOptionsHTML(role) {
  return silenceOptionsFor(role).map(function (o) { return '<option value="' + o.key + '">' + esc(o.label) + "</option>"; }).join("");
}
function myTeamRole() {
  if (!state.profile) return "member";
  return state.profile.role || (state.profile.is_operator ? "operator" : "member");
}
function fmtMuteDate(ms) {
  if (!ms) return "";
  var d = new Date(ms);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---------- v3.7 Team (operator + admin + mod) ----------
async function viewTeam(el) {
  var role = state.profile ? (state.profile.role || (state.profile.is_operator ? "operator" : "member")) : "member";
  var isTeam = role === "operator" || role === "admin" || role === "mod";
  if (!isTeam) {
    el.innerHTML = '<section class="card"><h2 style="margin-top:0">👥 Team</h2><p>The team area is only for the operator, admins, and mods — it has the team chat and the roster of who’s online.</p></section>';
    return;
  }
  el.innerHTML =
    '<section class="card"><h2 style="margin-top:0">🚩 Reports — team queue</h2><p style="color:var(--muted)">Reports from the street. Claim one to own it — “I’ll take care of that” — and resolve it when it’s handled. Everyone on the team sees who’s on what.</p><div id="dwc-team-reports"><p style="color:var(--muted)">Loading reports…</p></div></section>' +
    '<section class="card"><h2 style="margin-top:0">👥 Team roster</h2><p style="color:var(--muted)">Everyone on the RCR website team — who’s online and who’s not.</p><div id="dwc-team-roster"><p style="color:var(--muted)">Loading roster…</p></div></section>' +
    '<section class="card"><h2 style="margin-top:0">💬 Team chat</h2><p style="color:var(--muted)">Check in here — leave a note about what you handled and who dealt with it, so the rest of the team knows.</p>' +
    '<div id="dwc-team-log" class="dwc-chatlog"><p style="color:var(--muted)">Loading team chat…</p></div>' +
    '<form class="dwc-rowform" onsubmit="DWC.sendTeamChat(this); return false;">' +
    '<input name="body" required maxlength="500" placeholder="What did you handle?" style="flex:1">' +
    '<button class="btn" type="submit">Send</button></form>' +
    '<p class="dwc-form-err" data-err hidden></p></section>';
  var roster = await apiGet("/team?device_id=" + encodeURIComponent(deviceId()));
  var rosterHost = $("dwc-team-roster");
  if (rosterHost) {
    var team = (roster && roster.team) || [];
    rosterHost.innerHTML = team.length
      ? '<div class="dwc-admin-list">' + team.map(function (t) {
          return '<div class="dwc-admin-row">' +
            (t.avatar_url ? '<img class="dwc-avatar" src="' + esc(t.avatar_url) + '" alt="" style="width:36px;height:36px">' : '<span class="dwc-avatar dwc-avatar-none" style="width:36px;height:36px;font-size:18px">🍬</span>') +
            '<div style="flex:1;min-width:0"><strong>@' + esc(t.username) + "</strong> " + presenceDot(t) + " " + badgeHTML(t) +
            '<div style="color:var(--muted);font-size:12px">' + (t.presence === "online" ? "🟢 Online" : t.presence === "away" ? "🌙 Away" + (t.away_message ? " — “" + esc(t.away_message) + "”" : "") : "⚫ Offline") + "</div></div></div>";
        }).join("") + "</div>"
      : '<p style="color:var(--muted)">No team members yet.</p>';
  }
  await loadTeamReports();
  await loadTeamChat();
  state.chatTimer = setInterval(function () { loadTeamChat(); }, 15000);
}
// Team reports queue (v3.18) — open + claimed reports with assignee,
// status, claim/resolve, and a silence control for the reported member.
async function loadTeamReports() {
  var host = $("dwc-team-reports");
  if (!host) return;
  var data = await apiGet("/reports?device_id=" + encodeURIComponent(deviceId()));
  var list = (data && data.reports) || [];
  var role = myTeamRole();
  var open = list.filter(function (r) { return r.status === "open" || r.status === "claimed"; });
  if (!list.length) { host.innerHTML = '<p style="color:var(--muted)">No reports — nothing to review.</p>'; return; }
  host.innerHTML = (open.length ? open.map(function (r) {
    var mine = r.assignee_id && state.profile && r.assignee_id === state.profile.id;
    var silenceRow = "";
    if (r.target_author_id && state.profile && r.target_author_id !== state.profile.id) {
      silenceRow = '<p style="margin:8px 0 0"><label style="font-size:13px">Silence @' + esc(r.target_author_username || "member") + ' <select id="dwc-report-silence-' + r.id + '">' + silenceOptionsHTML(role) + '</select></label> ' +
        '<button type="button" class="btn ghost small" onclick="DWC.adminSilence(' + r.target_author_id + ", 'dwc-report-silence-" + r.id + '\')">Silence</button></p>';
    }
    return '<article class="card dwc-report"><p style="margin:0"><strong>' + esc(r.target_label) + '</strong> · <span class="dwc-status-' + esc(r.status) + '">' + esc(r.status) + "</span>" +
      (r.assignee_username ? ' · Handling: <strong>@' + esc(r.assignee_username) + "</strong>" : "") + "</p>" +
      '<p style="margin:4px 0">Reported by @' + esc(r.reporter_username) + " · " + fmtDate(r.created_at) + "</p>" +
      (r.reason ? '<p style="margin:4px 0">Reason: ' + esc(r.reason) + "</p>" : "") +
      '<p style="margin:8px 0 0">' +
      (r.status === "open" ? '<button type="button" class="btn small" onclick="DWC.reportAction(' + r.id + ", 'claim')\">I'll take care of that</button> " : "") +
      (r.status === "claimed" && (mine || role === "operator") ? '<button type="button" class="btn ghost small" onclick="DWC.reportAction(' + r.id + ", 'release')\">Put it back</button> " : "") +
      (r.status !== "resolved" ? '<button type="button" class="btn ghost small" onclick="DWC.reportAction(' + r.id + ", 'resolve')\">Resolve</button>" : "") +
      "</p>" + silenceRow + "</article>";
  }).join("") : '<p style="color:var(--muted)">All caught up — nothing open.</p>') +
    (list.some(function (r) { return r.status === "resolved"; })
      ? '<details style="margin-top:10px"><summary style="cursor:pointer;color:var(--muted)">Resolved (' + list.filter(function (r) { return r.status === "resolved"; }).length + ')</summary>' +
        list.filter(function (r) { return r.status === "resolved"; }).map(function (r) {
          return '<article class="card dwc-report"><p style="margin:0"><strong>' + esc(r.target_label) + '</strong> · <span class="dwc-status-resolved">resolved</span>' +
            (r.assignee_username ? ' · Handled by <strong>@' + esc(r.assignee_username) + "</strong>" : "") + "</p>" +
            '<p style="margin:4px 0">Reported by @' + esc(r.reporter_username) + " · " + fmtDate(r.created_at) + "</p></article>";
        }).join("") + "</details>"
      : "");
}
async function loadTeamChat() {
  var log = $("dwc-team-log");
  if (!log) return;
  var data = await apiGet("/team-chat?device_id=" + encodeURIComponent(deviceId()) + "&limit=60");
  var msgs = (data && data.messages) || [];
  log.innerHTML = msgs.length
    ? msgs.map(function (m) {
        return '<div class="dwc-chatmsg dwc-team-role-' + esc(m.author_role || "member") + '"><strong>' + esc(m.author_name) + "</strong>" + achBadgeIconsHTML(m.author_badges) + ': <span>' + esc(m.body) + '</span> <span class="dwc-meta">' + fmtDate(m.created_at) + "</span></div>";
      }).join("")
    : "<p>No team notes yet — say what you handled.</p>";
  log.scrollTop = log.scrollHeight;
}

// ---------- Rules & After Dark ----------
function viewRules(el) {
  el.innerHTML =
    '<section class="card"><h2 style="margin-top:0">The deal — in plain language</h2><p style="text-align:center;font-weight:900;color:var(--green);letter-spacing:.14em">LIST IT FREE, SELL IT FAIR</p><ul class="dwc-rules-list">' +
    "<li><strong>This is a general marketplace and community — not just cards.</strong> Buy and sell anything legal: cards and collectibles, plants, video games, tech, figures, custom work, and more. One free account is your buyer <em>and</em> seller account in one.</li>" +
    "<li><strong>Listing is always free.</strong> When something sells, a fair 6% cut goes to Rare Candy Reserve to keep the street running — every listing shows the exact split before you post. Payments go directly between buyer and seller; the app never holds your money.</li>" +
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
    "<p><strong>How the check works:</strong> you upload a clear photo of your government-issued photo ID (driver’s license, state ID, or passport). Chris — the operator — reviews it himself: that it’s a genuine-looking government ID, that the date of birth on it shows 18 or older, and that it matches the name and date of birth on your account. <strong>A typed birthday or an “I’m 18” checkbox alone never verifies anyone.</strong> Until the check passes, there is no adult access — no entering the 18+ forum, no adult selling. Your ID photo is permanently deleted the moment Chris approves or rejects it — nothing is stored.</p>" +
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
    '<form onsubmit="DWC.submitId(this); return false;">' +
    '<label>Upload a clear photo of your government-issued photo ID (driver’s license, state ID, or passport) — JPG or PNG (resized automatically to fit)</label>' +
    '<input name="id_photo" type="file" accept="image/jpeg,image/png" required>' +
    '<p class="dwc-form-err" data-err hidden></p>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">Submit my ID for review →</button></p></form>';
}

// ---------- v3.2: 18+ area banners + Digital File Marketplace ----------
// "Get matched with buyers & sellers fast!" — the area's intro banner,
// right before the "After Dark — 18+" heading.
var MATCH_BANNER_HTML =
  '<div class="dwc-match-banner">Get matched with buyers &amp; sellers fast!</div>';
// "Digital File Marketplace!" banner + a PayPal balance rising demo
// (CSS/SVG animation — clearly labeled EXAMPLE, never a real PayPal
// screenshot). Sits above the main 18+ welcome picture. The flickering
// 18+ lives in the After Dark heading itself (viewAdult), not here.
var NUT_BANNER_HTML =
  '<div class="dwc-nut-banner">' +
  '<div class="dwc-dfm-banner"><span class="dwc-dfm-banner-title">🕹️ Digital File Marketplace!</span><span class="dwc-dfm-banner-sub">Sell any digital file — 3D models, developer files, designs, art, apps, game assets, photos, videos &amp; adult content. Optional blur on your uploads.</span></div>' +
  '<div class="dwc-paypal-demo"><div class="dwc-paypal-label">Example — illustration only, not a real PayPal screenshot</div>' +
  '<div class="dwc-paypal-balance">$1,240.00 <small>▲ +$12.50 just now</small></div>' +
  '<p class="dwc-paypal-note">PayPal balance rising — sales land here the moment buyers pay.</p>' +
  '<div class="dwc-paypal-bars" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div></div></div>';
// Digital File Marketplace — Chris's words verbatim + featured examples
// (the shop's own 3D prints, clearly labeled EXAMPLE — no fake members,
// no fake sales).
var DFM_HTML =
  '<section class="card dwc-dfm"><h3 class="dwc-neon-head" style="margin-top:0">Digital File Marketplace!</h3>' +
  '<p>They try to download or take a pic/screenshot, IP logged, Perma ban, and their location is offered to you to press charges for IP infringement they sign up for upon the account creation screen, as we don\'t steal here. We help grow the hustle of every single hustler out there working hard but make it easier as we make nothing from these sales, we just keep them from giving your files away for free or copying them. And lets them know not to redistribute any IP from anyone or your account can be suspended indefinitely, it costs nothing to make an sellers/buyers account, but 100 free listings per month reset monthly, to 6% only taken ONCE AND ONLY ONCE the sale is complete and you\'ve gotten immediately required payment. We refuse to charge for any of our services as much as other big companies do, and don\'t need to, this place is to keep you, your files, your ideas, your communication, content, livelihood, knowledge, and information safe and ensures top measures taken to ensure this. If you need help reach out to an admin and get to building your space whether it need be a site you code for your business to start or model your photography to the world, RCR is the place to do it all!</p>' +
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
      '<section class="card" style="text-align:center"><h2 style="margin-top:0"><span class="dwc-18-flicker">18+</span><br>🌙 After dark</h2>' +
      NUT_BANNER_HTML +
      (wimg
        ? '<img src="' + esc(wimg) + '" alt="Welcome to the 18+ area" class="dwc-welcome-img">'
        : '<div class="dwc-welcome-slot"><p>🌙</p><p><strong>Welcome picture slot</strong></p><p style="font-size:13px;color:var(--muted)">Chris uploads his own welcome picture here. The slot is empty until he does — no stock photo.</p></div>') +
      '<p>This area is for age-verified members only. A typed birthday alone is never enough — a real photo ID check is what opens the door.</p>' +
      '<p class="dwc-review-note">🔒 <strong>Your ID is safe here.</strong> Joining YourSpace is free, and selling regular stuff never needs an ID — ID is only for adult content and digital assets. When you do verify, your ID photo goes into a private vault for Chris to check, and it is permanently deleted the moment he approves or rejects it. Nothing is stored — no photo, no ID number, no birthdate. The only thing kept is a simple ‘age verified’ mark on your account.</p>' +
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
    '<section class="card" style="text-align:center"><h2 style="margin-top:0"><span class="dwc-18-flicker">18+</span><br>🌙 After dark</h2>' + NUT_BANNER_HTML + '<div id="dwc-welcome"></div></section>' +
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
    ? feedListHTML(posts.map(postCardHTML))
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
    '<form onsubmit="DWC.submitPost(this, \'adult\'); return false;">' +
    '<input type="hidden" name="kind" value="adult">' +
    '<label>Corner (one of the 53 adult categories)</label><select name="category">' + ADULT_CATEGORIES.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
    '<label>Flair</label><select name="flair">' + FLAIRS.map(function (f) { return "<option>" + esc(f) + "</option>"; }).join("") + "</select>" +
    '<label>Title (3–120 characters)</label>' +
    '<input name="title" required minlength="3" maxlength="120" placeholder="What’s this about?">' +
    '<label>Post (up to 4000 characters)</label>' +
    '<textarea name="body" required maxlength="4000" placeholder="Write it out…"></textarea>' +
    '<label>Tags (up to 6, comma separated)</label>' +
    '<input name="tags" maxlength="240" placeholder="e.g. cosplay, amateur">' +
    '<label>Photo (JPG, PNG, WebP, or GIF — resized automatically to fit; optional)</label>' +
    '<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange="DWC.photoPicked(this, \'composer-adult\')">' +
    cropPreviewHTML("composer-adult") +
    '<label><input type="checkbox" name="blur_photo" style="width:auto"> 🙈 Blur this photo — viewers see a blurred preview (they can tap to reveal). Off by default; never on unless you tick it.</label>' +
    '<label>Short video clip (MP4, WebM, or MOV, under 15 MB and 60 seconds — optional)</label>' +
    '<input name="video" type="file" accept="video/mp4,video/webm,video/quicktime" onchange="DWC.videoPicked(this, \'composer-adult\')">' +
    videoPreviewHTML("composer-adult") +
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
    '<p style="color:var(--muted)">Selling a digital file? Post it here — 3D models, developer files, designs, art, apps, game assets, photos, videos, audio, custom content, or adult content. Age-verified members only — your post shows in the 18+ forum and its tag pages, with a Creator badge and your price. Payment is arranged privately with the buyer in a private chat.</p>' +
    '<form onsubmit="DWC.submitCreatorPost(this); return false;">' +
    '<input type="hidden" name="kind" value="adult">' +
    '<label>Forum corner (one of the 53 adult categories)</label><select name="category">' + ADULT_CATEGORIES.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
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
    '<label>Preview photo (JPG, PNG, or WebP — resized automatically to fit; optional)</label>' +
    '<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange="DWC.photoPicked(this, \'composer-creator\')">' +
    cropPreviewHTML("composer-creator") +
    '<label><input type="checkbox" name="blur_photo" style="width:auto"> 🙈 Blur this photo — viewers see a blurred preview (they can tap to reveal). Off by default; never on unless you tick it.</label>' +
    '<label><input type="checkbox" name="pay_unlock" style="width:auto"> 🔓 Pay to unlock — set a price above and viewers see a locked preview with a “Pay to unlock” button. Only works with a price above $0. Off by default.</label>' +
    '<label>3D print file — .stl, .obj, .3mf, or a .zip of them (under 25 MB — optional, only when the genre is 3D Print Files or you’re including one)</label>' +
    '<input name="print_file" type="file" accept=".stl,.obj,.3mf,.zip">' +
    '<label>Short video clip (MP4, WebM, or MOV, under 15 MB and 60 seconds — optional)</label>' +
    '<input name="video" type="file" accept="video/mp4,video/webm,video/quicktime" onchange="DWC.videoPicked(this, \'composer-creator\')">' +
    videoPreviewHTML("composer-creator") +
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
    '<form class="dwc-rowform" onsubmit="DWC.searchModels(this); return false;">' +
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
    '<form onsubmit="DWC.findMatches(this); return false;">' +
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
    '<form onsubmit="DWC.saveModelProfile(this); return false;">' +
    '<label><input type="checkbox" name="opt_in" style="width:auto"' + (p.is_model ? " checked" : "") + "> List me in the model search</label>" +
    '<label>Your public blurb (up to 280 characters)</label>' +
    '<textarea name="model_bio" maxlength="280">' + esc(p.model_bio || "") + "</textarea>" +
    '<label>Categories (up to 6)</label><div class="dwc-checkgrid">' + ADULT_CATEGORIES.map(function (c) {
      return '<label><input type="checkbox" name="model_categories" value="' + esc(c) + '" style="width:auto"' + ((p.model_categories || []).includes(c) ? " checked" : "") + "> " + esc(c) + "</label>";
    }).join("") + "</div>" +
    '<label>Display picture (JPG, PNG, or WebP — resized automatically to fit)</label>' +
    '<input name="display_image" type="file" accept="image/jpeg,image/png,image/webp,image/gif">' +
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
  setFriendsOnly: function (on) { state.friendsOnly = !!on; renderView(); },
  // Feed redesign (v3.14) — Saved filter pill.
  setSavedOnly: function (on) { state.savedOnly = !!on; renderView(); },
  // Feed redesign (v3.14) — collapse/expand the composer. Toggling the
  // two halves directly keeps anything already typed in the form.
  toggleComposer: function (open) {
    state.composerOpen = !!open;
    var mini = $("dwc-composer-mini"), full = $("dwc-composer-full");
    if (mini) mini.hidden = !!open;
    if (full) full.hidden = !open;
    if (open && full) { var t = full.querySelector('textarea[name="body"]'); if (t) t.focus(); }
  },
  // Feed redesign (v3.14) — carousel: show slide i of a post's media.
  carouselGo: function (postId, i, btn) {
    var car = document.querySelector('.dwc-carousel[data-post="' + postId + '"]');
    if (!car) return;
    var slides = car.querySelectorAll(".dwc-slide");
    var dots = car.querySelectorAll(".dwc-dot");
    slides.forEach(function (s, idx) { s.hidden = idx !== i; s.classList.toggle("on", idx === i); });
    dots.forEach(function (d, idx) { d.classList.toggle("on", idx === i); });
  },
  carouselStep: function (postId, dir, btn) {
    var car = document.querySelector('.dwc-carousel[data-post="' + postId + '"]');
    if (!car) return;
    var slides = car.querySelectorAll(".dwc-slide");
    var cur = 0;
    slides.forEach(function (s, idx) { if (s.classList.contains("on")) cur = idx; });
    var next = (cur + dir + slides.length) % slides.length;
    DWC.carouselGo(postId, next, btn);
  },
  // Feed redesign (v3.14) — Read more / Show less on a post body.
  togglePostBody: function (postId, btn) {
    var body = $("dwc-post-body-" + postId);
    if (!body) return;
    var clamped = body.classList.toggle("dwc-clamped");
    if (btn) btn.textContent = clamped ? "Read more ↓" : "Show less ↑";
  },
  toggleCommentBody: function (commentId, btn) {
    var body = $("dwc-comment-body-" + commentId);
    if (!body) return;
    var clamped = body.classList.toggle("dwc-clamped");
    if (btn) btn.textContent = clamped ? "Read more ↓" : "Show less ↑";
  },
  // Feed redesign (v3.14) — save/bookmark a post or comment. Posts are
  // logged server-side (post_saves) when signed in; if the server log
  // is unavailable (migration not run yet) it falls back to this device
  // only. Comment saves are always this-device only.
  toggleSave: async function (id, kind, btn) {
    var key = kind + "-" + id;
    var now = !isSavedKey(key);
    if (kind === "post" && state.profile) {
      var data = await apiPost("/post-saves", { device_id: deviceId(), post_id: id, action: now ? "add" : "remove" });
      if (data && data.ok) {
        // The endpoint answers saved:true/false, not the full list —
        // keep our loaded copy in sync locally.
        if (Array.isArray(state.savedServer)) {
          if (now && state.savedServer.indexOf(id) < 0) state.savedServer.push(id);
          if (!now) state.savedServer = state.savedServer.filter(function (x) { return x !== id; });
        }
        setSavedKey(key, now); // keep the device copy in sync too
      } else {
        setSavedKey(key, now); // server log down — device-only save
      }
    } else {
      setSavedKey(key, now);
    }
    if (btn) { btn.classList.toggle("on", now); btn.innerHTML = bookmarkHTML(now); }
  },
  // Feed redesign (v3.14) — header search. Hover or tap the magnifier
  // to reveal the input; Enter or the magnifier runs the search.
  toggleSearch: function () {
    var wrap = $("dwc-search-wrap");
    if (!wrap) return;
    var open = wrap.classList.toggle("open");
    var btn = $("dwc-search-btn");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { var input = $("dwc-search-input"); if (input) input.focus(); }
    else DWC.clearSearch();
  },
  closeSearch: function () {
    var wrap = $("dwc-search-wrap");
    if (wrap) wrap.classList.remove("open");
    DWC.clearSearch();
  },
  clearSearch: function () {
    var input = $("dwc-search-input");
    if (input) input.value = "";
    var res = $("dwc-search-results");
    if (res) { res.innerHTML = ""; res.hidden = true; }
  },
  runSearch: async function (form) {
    var input = $("dwc-search-input");
    var q = input ? input.value.trim() : "";
    var res = $("dwc-search-results");
    if (!res) return false;
    if (!q) { res.innerHTML = '<p class="dwc-search-hint">Type to search posts, tags, and people.</p>'; res.hidden = false; return false; }
    res.innerHTML = '<p class="dwc-search-hint">Searching…</p>'; res.hidden = false;
    if (!state.searchPosts || !state.searchMembers) {
      var p = apiGet("/posts?sort=new&limit=50&device_id=" + encodeURIComponent(deviceId()));
      var m = apiGet("/members?limit=60");
      var both = await Promise.all([p, m]);
      state.searchPosts = (both[0] && both[0].posts) || [];
      state.searchMembers = (both[1] && both[1].members) || [];
    }
    var needle = q.toLowerCase();
    var posts = state.searchPosts.filter(function (p) {
      var hay = ((p.title || "") + " " + (p.body || "") + " " + ((p.tags || []).join(" "))).toLowerCase();
      return hay.indexOf(needle) >= 0;
    }).slice(0, 8);
    var members = state.searchMembers.filter(function (m) {
      var hay = ((m.username || "") + " " + (m.occupation || "") + " " + (m.bio || "")).toLowerCase();
      return hay.indexOf(needle) >= 0;
    }).slice(0, 8);
    var html = "";
    if (posts.length) {
      html += '<p class="dwc-search-group">Posts</p><ul class="dwc-search-list">' + posts.map(function (p) {
        return '<li><a href="#/post/' + p.id + '" onclick="DWC.closeSearch()"><strong>' + esc(p.title) + '</strong><span>' + esc(p.category) + " · @" + esc(p.author_username) + "</span></a></li>";
      }).join("") + "</ul>";
    }
    if (members.length) {
      html += '<p class="dwc-search-group">People</p><ul class="dwc-search-list">' + members.map(function (m) {
        return '<li><a href="#/member/' + m.id + '" onclick="DWC.closeSearch()"><strong>@' + esc(m.username) + "</strong><span>" + esc(m.occupation || "") + "</span></a></li>";
      }).join("") + "</ul>";
    }
    res.innerHTML = html || '<p class="dwc-search-hint">Nothing found for “' + esc(q) + '” — try a different word.</p>';
    return false;
  },
  // Feed redesign (v3.14) — the bubble on a comment is a Reply button:
  // focus the comment form and prefill "@username ". Reactions (v3.15)
  // added the picture viewer form too, so Reply works there as well.
  replyToComment: function (username) {
    var box = $("dwc-comment-box");
    if (!box) { var pf = $("dwc-page-comments-form"); if (pf) box = pf.querySelector('textarea[name="body"]'); }
    if (!box) { var pv = $("dwc-picviewer-comments"); if (pv) box = pv.querySelector('textarea[name="body"]'); }
    if (!box) return;
    var prefix = "@" + username + " ";
    if (box.value.indexOf(prefix) !== 0) box.value = prefix + box.value;
    box.focus();
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  },
  // Feed redesign (v3.14) — the ⋯ menu on your own post (author or
  // operator): Edit + Edit history. Only one menu open at a time.
  togglePostMenu: function (postId, btn) {
    var menu = $("dwc-menu-" + postId);
    if (!menu) return;
    document.querySelectorAll(".dwc-feed-menu").forEach(function (m) { if (m !== menu) m.hidden = true; });
    menu.hidden = !menu.hidden;
  },
  // Feed redesign (v3.14) — edit your own post (or an operator's).
  // The form lets you change title/body/tags, ADD a photo or video if
  // you forgot them, flip visibility PUBLIC ↔ FRIENDS ONLY, or DELETE
  // the post (confirm first — reuses DWC.deletePost, no second delete).
  // 3-edit limit, enforced server-side; the card shows "Edited · n/3".
  editPost: async function (postId) {
    var menu = $("dwc-menu-" + postId);
    if (menu) menu.hidden = true;
    var slot = $("dwc-edit-" + postId);
    if (!slot) return;
    var data = await apiGet("/posts/" + postId + "?device_id=" + encodeURIComponent(deviceId()));
    var p = data && data.post;
    if (!p) { setNotice("Couldn't load that post to edit it."); return; }
    if ((p.edit_count || 0) >= 3) { setNotice("This post has used all 3 of its edits — it can't be changed again."); return; }
    var vis = p.visibility || "public";
    slot.hidden = false;
    slot.innerHTML =
      '<form class="dwc-edit-form" onsubmit="DWC.savePostEdit(this, ' + p.id + '); return false;">' +
      '<p class="dwc-edit-note">Edit ' + ((p.edit_count || 0) + 1) + ' of 3 — you have ' + (3 - (p.edit_count || 0)) + ' edit' + ((3 - (p.edit_count || 0)) === 1 ? "" : "s") + " left on this post.</p>" +
      '<label>Title</label><input name="title" required minlength="3" maxlength="120" value="' + esc(p.title) + '">' +
      '<label>What’s on your mind?</label><textarea name="body" required maxlength="4000">' + esc(p.body || "") + "</textarea>" +
      '<label>Tags (comma separated)</label><input name="tags" maxlength="240" value="' + esc((p.tags || []).join(", ")) + '">' +
      '<label>Who can see it</label><select name="visibility"><option value="public"' + (vis === "public" ? " selected" : "") + ">🌍 Public — everyone</option><option value=\"friends\"" + (vis === "friends" ? " selected" : "") + ">👥 Friends only — only your friends (and the shop) can see it</option></select>" +
      '<label>Add a photo (optional — only if the post has none)</label>' +
      (p.image_url ? '<p class="dwc-meta">This post already has a photo — the edit can’t swap it, only add one if it’s missing.</p>' : '<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif">') +
      '<label>Add a short video (optional — only if the post has none)</label>' +
      (p.video_url ? '<p class="dwc-meta">This post already has a video.</p>' : '<input name="video" type="file" accept="video/mp4,video/webm,video/quicktime">') +
      '<p class="dwc-form-err" data-err hidden></p>' +
      '<p class="dwc-edit-actions"><button class="btn" type="submit">Save changes</button> ' +
      '<button type="button" class="btn ghost" onclick="DWC.cancelPostEdit(' + p.id + ')">Cancel</button> ' +
      '<button type="button" class="btn ghost" style="color:var(--danger,#ff5a5a)" onclick="if(confirm(\'Delete this post for good? This can’t be undone.\'))DWC.deletePost(' + p.id + ')">🗑 Delete post</button></p>' +
      "</form>";
    slot.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },
  cancelPostEdit: function (postId) {
    var slot = $("dwc-edit-" + postId);
    if (slot) { slot.innerHTML = ""; slot.hidden = true; }
  },
  savePostEdit: async function (form, postId) {
    var fd = new FormData(form);
    var photo = await fileToImage(fd.get("photo") && fd.get("photo").size ? fd.get("photo") : null, 2500000, { maxDim: 1600 });
    if (photo && photo.error) return formErr(form, photo.error);
    var video = null;
    var vf = fd.get("video");
    if (vf && vf.size) {
      video = await fileToVideo(vf, VIDEO_MAX_BYTES);
      if (video && video.error) return formErr(form, video.error);
    }
    var body = {
      device_id: deviceId(),
      title: String(fd.get("title") || "").trim(),
      body: String(fd.get("body") || "").trim(),
      tags: String(fd.get("tags") || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean),
      visibility: String(fd.get("visibility") || "public"),
    };
    if (photo) body.image = { dataBase64: photo.dataBase64, mimeType: photo.mimeType };
    if (video) body.video = { dataBase64: video.dataBase64, mimeType: video.mimeType, fileName: video.fileName };
    var data = await apiPut("/posts/" + postId, body);
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't save that edit.");
    setNotice(data.video_skipped || data.image_skipped ? "Saved — but the media didn't attach yet; the shop is still running a database update." : "Post updated (" + (data.edit_count || 0) + " of 3 edits used).");
    renderView();
  },
  // Feed redesign (v3.14) — edit history: every edit's date + time,
  // stored in the post_edits table when an edit is saved.
  showEditHistory: async function (postId) {
    var menu = $("dwc-menu-" + postId);
    if (menu) menu.hidden = true;
    var slot = $("dwc-history-" + postId);
    if (!slot) return;
    slot.hidden = false;
    slot.innerHTML = '<p class="dwc-meta">Loading edit history…</p>';
    var data = await apiGet("/posts/" + postId + "/edits?device_id=" + encodeURIComponent(deviceId()));
    var edits = (data && data.edits) || [];
    slot.innerHTML = edits.length
      ? '<p class="dwc-edit-history-title">🕘 Edit history — ' + edits.length + ' of 3 edits used</p><ol class="dwc-edit-history-list">' +
        edits.map(function (e, i) {
          return "<li>Edit " + (i + 1) + " — " + fmtDateTime(e.edited_at) + " · by @" + esc(e.editor_username) + "</li>";
        }).join("") + "</ol>"
      : '<p class="dwc-meta">This post has never been edited.</p>';
  },
  openSignup: function () { state.signupOpen = true; state.editingProfile = false; state.challenge = null; renderAccount(); var el = $("dwc-account"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); },
  editProfile: async function () {
    // Re-fetch the profile first (v3.20) — the form must be built from
    // fresh saved settings, never from a stale in-memory copy, or a
    // preset can silently come back over a picture the member removed.
    await refreshProfile();
    state.editingProfile = true; state.signupOpen = true; renderAccount(); var el = $("dwc-account"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  },
  // Human check didn't load (slow mobile) — reload it without losing the form.
  retryChallenge: function () { var el = $("dwc-challenge"); if (el) el.innerHTML = "Loading human check…"; state.challenge = null; loadChallenge(); },
  // Dismiss the post-signup unlock card.
  dismissUnlock: function () { state.showUnlock = false; render(); },
  signOut: function () {
    if (!confirm("Sign out of the Community on this device? Your account stays — you can sign back in here any time.")) return;
    try { localStorage.removeItem(DEVICE_KEY); } catch (e) {}
    state.profile = null;
    state.editingProfile = false;
    state.signupOpen = false;
    setNotice("Signed out on this device.");
    render();
  },
  cancelProfileForm: function () { state.editingProfile = false; state.signupOpen = false; renderAccount(); },
  copyLink: copyLink,
  openLightbox: function (url) { if (typeof openLightbox === "function") openLightbox(url); else window.open(url, "_blank"); },
  // v3.9 — picture viewer: avatar first, then the owner's public
  // gallery photos (max 20). The host div is created once on the body.
  openPicViewer: async function (memberId) {
    var host = $("dwc-picviewer");
    if (!host) {
      host = document.createElement("div");
      host.id = "dwc-picviewer";
      host.className = "dwc-picviewer";
      host.hidden = true;
      document.body.appendChild(host);
    }
    var m = state.viewingMember && state.viewingMember.id === memberId ? state.viewingMember : null;
    if (!m) {
      var data = await apiGet("/members/" + memberId + "?device_id=" + encodeURIComponent(deviceId()));
      m = data && data.member;
    }
    if (!m) { setNotice("That member doesn't exist."); return; }
    var photos = [];
    if (m.avatar_url) photos.push({ url: m.avatar_url, subject: "avatar", label: "Profile picture" });
    try {
      var g = await apiGet("/gallery?profile_id=" + memberId + "&device_id=" + encodeURIComponent(deviceId()));
      ((g && g.photos) || []).slice(0, 20).forEach(function (p, i) {
        photos.push({ url: p.url, subject: "gallery:" + p.id, label: p.caption || ("Photo " + (i + 1)), visibility: p.visibility || "public" });
      });
    } catch (e) { /* gallery not there yet — avatar only */ }
    if (!photos.length) { setNotice("No picture to show yet."); return; }
    state.picViewer = { memberId: memberId, photos: photos, index: 0, theme: parseThemeClient(m.profile_theme) };
    host.hidden = false;
    renderPicViewer();
    // Escape closes the viewer (backdrop click does too).
    if (state.picViewerKeyHandler) document.removeEventListener("keydown", state.picViewerKeyHandler);
    state.picViewerKeyHandler = function (e) { if (e && e.key === "Escape") DWC.closePicViewer(); };
    document.addEventListener("keydown", state.picViewerKeyHandler);
  },
  picViewerPrev: function () {
    var pv = state.picViewer;
    if (!pv) return;
    pv.index = (pv.index + pv.photos.length - 1) % pv.photos.length;
    renderPicViewer();
  },
  picViewerNext: function () {
    var pv = state.picViewer;
    if (!pv) return;
    pv.index = (pv.index + 1) % pv.photos.length;
    renderPicViewer();
  },
  // v3.21 — set the gallery photo showing in the viewer as the profile
  // picture. Same avatar_gallery_id path as the phone gallery, so the
  // avatar_blob_key is updated and it persists. Re-opens the viewer so
  // the new profile picture shows first.
  picViewerSetAvatar: async function () {
    var pv = state.picViewer;
    if (!pv || !state.profile || state.profile.id !== pv.memberId) return;
    var photo = pv.photos[pv.index];
    if (!photo || !photo.subject || photo.subject.indexOf("gallery:") !== 0) return;
    var gid = photo.subject.slice("gallery:".length);
    var data = await apiPost("/profile", { device_id: deviceId(), avatar_gallery_id: gid });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't set that as your profile picture."); return; }
    var avatarUrl = data.avatar_url || (data.profile && data.profile.avatar_url);
    if (avatarUrl) {
      state.profile.avatar_url = avatarUrl;
      if (state.viewingMember) state.viewingMember.avatar_url = avatarUrl;
      var av = document.querySelector(".dwc-avatar");
      if (av && av.tagName === "IMG") av.src = avatarUrl;
    }
    setNotice("🖼️ That's your profile picture now.");
    DWC.openPicViewer(pv.memberId);
  },
  // v3.21 — Add photos panel on your own profile (bypasses the Taffy
  // Phone Gallery; the phone path stays). Up to 5 files at once, each
  // with a short description + Public / Friends, uploaded straight to
  // the stored gallery with the candy loader + "Uploaded ✓".
  openProfilePhotoUpload: function () {
    var host = $("dwc-photo-upload-host");
    if (!host) return;
    host.innerHTML = profilePhotoUploadHTML();
    DWC.refreshGalleryCount();
    state.profilePhotoFiles = [];
    var el = $("dwc-photo-upload");
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
  },
  closeProfilePhotoUpload: function () {
    var host = $("dwc-photo-upload-host");
    if (host) host.innerHTML = "";
  },
  profilePhotoPicked: function (input) {
    var files = input && input.files ? Array.prototype.slice.call(input.files, 0, 5) : [];
    state.profilePhotoFiles = files;
    var list = $("dwc-photo-upload-list");
    var btn = $("dwc-photo-upload-btn");
    if (btn) btn.disabled = !files.length;
    if (list) {
      list.innerHTML = files.map(function (f, i) {
        return '<div class="dwc-photo-upload-row"><span>' + esc(f.name || ("Photo " + (i + 1))) + '</span>' +
          '<input type="text" class="dwc-photo-upload-caption" maxlength="140" placeholder="Short description (140 max)" data-cap="' + i + '">' +
          '<select class="dwc-photo-upload-vis" data-vis="' + i + '"><option value="public">🌍 Public</option><option value="friends">👥 Friends</option></select></div>';
      }).join("");
    }
    if (input) input.value = "";
  },
  profilePhotoUpload: async function () {
    var files = state.profilePhotoFiles || [];
    if (!files.length || !state.profile) return;
    var btn = $("dwc-photo-upload-btn");
    var status = $("dwc-photo-upload-status");
    if (btn) btn.disabled = true;
    var ok = 0, failed = 0;
    if (window.RCRloader) window.RCRloader.show();
    for (var k = 0; k < files.length; k++) {
      var f = files[k];
      var cap = "";
      var vis = "public";
      var capEl = document.querySelector('[data-cap="' + k + '"]');
      var visEl = document.querySelector('[data-vis="' + k + '"]');
      if (capEl) cap = capEl.value.slice(0, 140);
      if (visEl) vis = visEl.value === "friends" ? "friends" : "public";
      if (status) status.textContent = "Uploading " + (k + 1) + " of " + files.length + "… 🍬";
      var img = await fileToImage(f, 1500000, { maxDim: 1600 });
      if (!img || img.error) { failed++; continue; }
      var data = await apiPost("/gallery", { device_id: deviceId(), image: { dataBase64: img.dataBase64, mimeType: img.mimeType }, caption: cap, visibility: vis });
      if (data && data.ok) ok++; else failed++;
    }
    if (window.RCRloader) window.RCRloader.hide();
    DWC.refreshGalleryCount();
    if (ok) {
      var newCount = state.galleryStoredCount == null ? ok : state.galleryStoredCount + ok;
      var countEl = $("dwc-photo-upload-count");
      if (countEl) countEl.textContent = newCount + " of 20 photos saved.";
    }
    if (status) status.textContent = ok ? "Uploaded ✓ — " + ok + " photo" + (ok === 1 ? "" : "s") + " saved to your profile." + (failed ? " " + failed + " couldn't be read." : "") : "Nothing uploaded — those photos couldn't be read.";
    if (ok) {
      state.profilePhotoFiles = [];
      var list = $("dwc-photo-upload-list");
      if (list) list.innerHTML = "";
    }
    if (btn) btn.disabled = true;
  },
  closePicViewer: function () {
    var host = $("dwc-picviewer");
    if (host) host.hidden = true;
    if (state.picViewerKeyHandler) { document.removeEventListener("keydown", state.picViewerKeyHandler); state.picViewerKeyHandler = null; }
    state.picViewer = null;
  },
  // v3.9 — comment on the picture currently open in the viewer.
  sendPicComment: async function (form) {
    var pv = state.picViewer;
    if (!pv) return false;
    var photo = pv.photos[pv.index];
    if (!photo) return false;
    var fd = new FormData(form);
    var err = form.parentElement.querySelector("[data-err]");
    var body = {
      device_id: deviceId(),
      profile_id: pv.memberId,
      subject: photo.subject,
      body: String(fd.get("body") || "").trim(),
      visibility: String(fd.get("visibility") || "public"),
    };
    if (!body.body) { if (err) { err.hidden = false; err.textContent = "Write something first."; } return false; }
    var data = await apiPost("/profile-comments", body);
    if (!data || !data.ok) { if (err) { err.hidden = false; err.textContent = (data && data.error) || "Couldn't post that comment."; } return false; }
    if (data.subject_skipped) setNotice("Comment posted — it landed as a page comment (the shop is still running a quick database update).");
    form.reset();
    await loadPicViewerComments();
    return false;
  },
  deletePicComment: async function (commentId) {
    var pv = state.picViewer;
    if (!pv) return;
    if (!confirm("Delete this comment?")) return;
    var data = await apiDelete("/profile-comments?id=" + commentId + "&device_id=" + encodeURIComponent(deviceId()));
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't delete that comment."); return; }
    await loadPicViewerComments();
  },

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
    var ev = form.querySelector("[data-eventfields]");
    if (ev) ev.hidden = kind !== "event";
  },

  saveProfile: async function (form) {
    var isNew = !state.profile;
    var fd = new FormData(form);
    // Rare Candy loading bar — the save (photo shrinking + upload +
    // POST) has no progress events, so the bar runs indeterminate.
    if (window.RCRloader) window.RCRloader.show();
    // Avatar: a bad picture must NEVER kill the whole save. If the pic
    // is too big or the wrong type, we save the rest of the profile and
    // tell the member exactly why the picture didn't stick.
    var avatar = await shrinkAvatarImage(fd.get("avatar") && fd.get("avatar").size ? fd.get("avatar") : null);
    var avatarError = (avatar && avatar.error) || null;
    var avatarUploaded = false;
    // v3.7 — banner / cover photo: same shrink as the avatar (wide).
    var banner = await shrinkAvatarImage(fd.get("banner") && fd.get("banner").size ? fd.get("banner") : null);
    var bannerError = (banner && banner.error) || null;
    var bannerUploaded = false;
    // v3.10 — one profile video: MP4/WebM/MOV, up to 15 MB and 60s
    // (same caps as post clips). A bad video never kills the save.
    var videoFile = fd.get("profile_video_file") && fd.get("profile_video_file").size ? fd.get("profile_video_file") : null;
    var video = null;
    var videoError = null;
    if (videoFile) {
      video = await fileToVideo(videoFile, VIDEO_MAX_BYTES);
      if (video && !video.error) {
        var vdur = await videoDuration(videoFile);
        if (vdur !== null && vdur > VIDEO_MAX_SECONDS) {
          video = { error: "That video is " + Math.round(vdur) + " seconds — keep profile clips under " + VIDEO_MAX_SECONDS + " seconds." };
        }
      }
      if (video && video.error) { videoError = video.error; video = null; }
    }
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
      remove_banner: !!fd.get("remove_banner"),
    };
    if (avatar) body.avatar = { dataBase64: avatar.dataBase64, mimeType: avatar.mimeType };
    if (banner) body.banner = { dataBase64: banner.dataBase64, mimeType: banner.mimeType };
    if (video) body.video = { dataBase64: video.dataBase64, mimeType: video.mimeType };
    if (fd.get("remove_video")) body.remove_video = true;
    // v3.7 — ticker: optional custom text (up to 200 chars) + on/off + color.
    if (form.querySelector('input[name="ticker_text"]')) {
      body.ticker_text = String(fd.get("ticker_text") || "").trim().slice(0, 200);
      body.ticker_enabled = !!fd.get("ticker_enabled");
      body.ticker_color = String(fd.get("ticker_color") || "").trim();
    }
    // MySpace throwback v2 — Top Friends (only if the picker actually
    // rendered, so a failed member load never wipes the list), plus the
    // custom layout CSS + preset.
    if (form.querySelectorAll('input[name="top_friend"]').length) {
      var tf = [];
      form.querySelectorAll('input[name="top_friend"]:checked').forEach(function (cb) {
        var n = parseInt(cb.value, 10);
        if (n > 0 && tf.indexOf(n) === -1) tf.push(n);
      });
      body.top_friends = tf.slice(0, 10);
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
      var theme = { bg_color: "", bg_image_url: "", text_color: "", accent_color: "", font: "", name_font: "" };
      var hexOk = function (val) { return /^#[0-9a-fA-F]{6}$/.test(String(val || "").trim()) ? String(val).trim() : ""; };
      if (fd.get("theme_bg_use")) theme.bg_color = hexOk(fd.get("theme_bg_color"));
      var bgImg = String(fd.get("theme_bg_image") || "").trim().slice(0, 500);
      if (/^https:\/\//i.test(bgImg)) theme.bg_image_url = bgImg;
      if (fd.get("theme_text_use")) theme.text_color = hexOk(fd.get("theme_text_color"));
      if (fd.get("theme_accent_use")) theme.accent_color = hexOk(fd.get("theme_accent_color"));
      var fontSel = String(fd.get("theme_font") || "");
      if (themeFontCSS(fontSel)) theme.font = fontSel;
      var nameFontSel = String(fd.get("theme_name_font") || "");
      if (themeFontCSS(nameFontSel)) theme.name_font = nameFontSel;
      // Font glow (v3.19) — checkbox-gated, same opt-in pattern as the
      // custom text/accent colors: unticked means no glow fields at all.
      if (fd.get("theme_glow")) {
        theme.glow = true;
        theme.glow_color = hexOk(fd.get("theme_glow_color")) || "#00e5ff";
        theme.outline_color = hexOk(fd.get("theme_outline_color")) || "#000000";
      }
      // Member page layout (v3.20) — Top Friends count/side, feed
      // privacy, divider + color. Defaults stay unset in the theme
      // (8 / right / public / no divider) so old saves never change.
      var tfCount = parseInt(String(fd.get("theme_topfriends_count") || ""), 10);
      if ([3, 4, 5, 8, 10].indexOf(tfCount) >= 0 && tfCount !== 8) theme.topfriends_count = tfCount;
      if (String(fd.get("theme_topfriends_side") || "") === "left") theme.topfriends_side = "left";
      var feedPriv = String(fd.get("theme_feed_privacy") || "");
      if (["friends", "private"].indexOf(feedPriv) >= 0) theme.feed_privacy = feedPriv;
      var divId = String(fd.get("theme_divider") || "");
      if (DIVIDERS[divId]) theme.divider = divId;
      var divCol = hexOk(fd.get("theme_divider_color"));
      if (divCol) theme.divider_color = divCol;
      var btnStyle = String(fd.get("theme_button_style") || "");
      if (BUTTON_STYLES[btnStyle]) theme.button_style = btnStyle;
      // Taffy Layout Builder — the vibe is a real theme setting.
      var vibeId = String(fd.get("theme_vibe") || "");
      if (LAYOUT_VIBES[vibeId]) theme.vibe = vibeId;
      var btnCss = String(fd.get("theme_button_css") || "").slice(0, 4000);
      if (btnCss.trim()) theme.button_css = btnCss;
      var effs = fd.getAll ? fd.getAll("theme_effects") : [];
      theme.effects = effs.filter(function (e) { return MYSPACE_EFFECTS[e]; }).slice(0, 8);
      // v3.9 — preset background + comment-border color + picture
      // size / position / frame + blood + handheld colors. The RGB
      // comment-border effect and a custom border color are mutually
      // exclusive: ticking the RGB effect drops the custom color.
      var bgPreset = String(fd.get("theme_bg_preset") || "");
      if (PRESET_BACKGROUNDS.some(function (pr) { return pr.id === bgPreset; })) theme.bg_preset = bgPreset;
      // Background choices are either/or (v3.20): the animated-bg
      // effect wins over both, and a picture wins over a preset — so a
      // preset can never silently sit on top of a custom picture again.
      if (theme.effects.indexOf("animated-bg") >= 0) {
        theme.bg_preset = "";
        theme.bg_image_url = "";
      } else if (theme.bg_image_url) {
        theme.bg_preset = "";
      }
      // Custom page (v3.20) — sanitized on the way in; the server
      // sanitizes again on save.
      var customPage = String(fd.get("custom_page_html") || "").slice(0, 8000);
      if (customPage.trim()) theme.custom_page_html = sanitizeCustomPageHtml(customPage);
      if (theme.effects.indexOf("rgb-comment-border") >= 0) {
        theme.comment_border_color = "";
      } else if (fd.get("theme_comment_border_use")) {
        theme.comment_border_color = hexOk(fd.get("theme_comment_border_color")) || "#000000";
      }
      var picSize = String(fd.get("theme_pic_size") || "");
      if (picSize === "bigger" || picSize === "smaller") theme.pic_size = picSize;
      var picPos = String(fd.get("theme_pic_position") || "");
      if (picPos === "normal" || picPos === "top") theme.pic_position = picPos;
      var picFrame = String(fd.get("theme_pic_frame") || "");
      if (PIC_FRAMES.some(function (f) { return f.id === picFrame; })) theme.pic_frame = picFrame;
      var bloodCol = hexOk(fd.get("theme_blood_color"));
      if (bloodCol) theme.blood_color = bloodCol;
      var gbMode = String(fd.get("theme_gb_mode") || "");
      if (GB_FRAME_MODES.some(function (gm) { return gm.id === gbMode; })) theme.gb_mode = gbMode;
      var gbCols = [0, 1, 2].map(function (i) { return hexOk(fd.get("theme_gb_color_" + i)); }).filter(Boolean);
      if (gbCols.length) theme.gb_colors = gbCols;
      // v3.10 — buttons side/show, profile video, ticker source, hidden
      // sections. These ride in the theme JSON, so they round-trip with
      // everything else — changing one never resets another.
      var btnSide = String(fd.get("theme_buttons_side") || "");
      if (btnSide === "right") theme.buttons_side = "right";
      // v3.21 — Buttons group: size, which buttons show, professional
      // button side + color. Size "" = M (the current size); the which-
      // show checkboxes only submit when the Buttons section is on the
      // form, so only set buttons_visible when they are present (same
      // stale-form guard as display_badges below).
      var btnSize = String(fd.get("theme_button_size") || "");
      if (btnSize === "s" || btnSize === "l" || btnSize === "xl") theme.button_size = btnSize;
      var visChecked = fd.getAll ? fd.getAll("theme_buttons_visible") : [];
      if (visChecked.length) theme.buttons_visible = visChecked.map(function (k) { return String(k || ""); }).filter(function (k) { return ["add", "message", "favorite", "group", "subscribe"].indexOf(k) >= 0; });
      var proSide = String(fd.get("theme_pro_button_side") || "");
      if (proSide === "center" || proSide === "right") theme.pro_button_side = proSide;
      var proCol = String(fd.get("theme_pro_button_color") || "").trim();
      if (/^#[0-9a-fA-F]{6}$/.test(proCol)) theme.pro_button_color = proCol;
      theme.buttons_show = !!fd.get("theme_buttons_show");
      // Website look (v3.20) — the Add me / Favorite / Add to group
      // buttons on a professional page are the member's choice.
      theme.website_buttons = !!fd.get("theme_website_buttons");
      var vidUrl = String(fd.get("theme_video_url") || "").trim().slice(0, 500);
      if (extractYouTubeId(vidUrl)) theme.video_url = vidUrl;
      var vidFile = String(fd.get("theme_video_file_url") || "").trim().slice(0, 500);
      if (vidFile) theme.video_file_url = vidFile;
      // Video size + centering + stretch (v3.22) — Small / Normal / Big /
      // Stretch to fit; "" = Normal (current size, default). Center locks
      // the video block in the middle of its spot.
      var vidSize = String(fd.get("theme_video_size") || "");
      if (vidSize === "s" || vidSize === "l" || vidSize === "stretch") theme.video_size = vidSize;
      var vidAlign = String(fd.get("theme_video_align") || "");
      if (vidAlign === "center") theme.video_align = "center";
      // Cover photo + name placement (v3.22) — "" = Small + name under
      // the picture (current look, default); "big" = tall cover area;
      // "left"/"right" = name beside the picture.
      var covSize = String(fd.get("theme_cover_size") || "");
      if (covSize === "big") theme.cover_size = "big";
      var covName = String(fd.get("theme_cover_name") || "");
      if (covName === "left" || covName === "right") theme.cover_name = covName;
      var tickSrc = String(fd.get("theme_ticker_source") || "");
      if (tickSrc === "btc") theme.ticker_source = "btc";
      var hideSecs = fd.getAll ? fd.getAll("theme_hide_sections") : [];
      theme.hide_sections = hideSecs.map(function (k) { return String(k || ""); }).filter(function (k) { return SECTION_HIDE_IDS.indexOf(k) >= 0; }).slice(0, 10);
      // v3.9 — chosen display badges (1–2 slots; the server enforces
      // the slot rules on save, so the client just passes the picks).
      // Never wipe them: if the form has no badge picks (or none are
      // chosen), carry the member's current badges forward instead of
      // sending an empty theme that would drop them.
      var dbPicked = [String(fd.get("theme_display_badge_1") || ""), String(fd.get("theme_display_badge_2") || "")]
        .filter(function (k) { return BADGES.some(function (b) { return b.key === k; }); });
      if (dbPicked.length) theme.display_badges = dbPicked;
      else if (state.profile) {
        var curTh = parseThemeClient(state.profile.profile_theme);
        if (curTh.display_badges && curTh.display_badges.length) theme.display_badges = curTh.display_badges;
      }
      body.profile_theme = JSON.stringify(theme);
    }
    // v3.9 — website look: the toggle + the five fields + their show
    // checkboxes. Only sent when the form has them (edit view).
    if (form.querySelector('input[name="website_mode"]')) {
      body.website_mode = !!fd.get("website_mode");
      body.hobbies = String(fd.get("hobbies") || "").trim().slice(0, 200);
      body.workplace = String(fd.get("workplace") || "").trim().slice(0, 120);
      body.relationship_status = String(fd.get("relationship_status") || "").trim();
      body.birthsign = String(fd.get("birthsign") || "").trim();
      body.accomplishments = String(fd.get("accomplishments") || "").trim().slice(0, 500);
      body.website_show = {
        hobbies: !!fd.get("website_show_hobbies"),
        workplace: !!fd.get("website_show_workplace"),
        relationship: !!fd.get("website_show_relationship"),
        sign: !!fd.get("website_show_sign"),
        accomplishments: !!fd.get("website_show_accomplishments"),
      };
      // Professional mode — contact email + its opt-in Show box. The
      // server stores them in the v39 columns (graceful pending if the
      // migration hasn't run yet, like the rest of the website look).
      body.contact_email = String(fd.get("contact_email") || "").trim().slice(0, 120);
      body.show_contact_email = !!fd.get("show_contact_email");
    }
    // Steady Wave player (v3.1) — opt-in radio on the profile.
    // Edit-only fields (the toggles only render on edit), so only send
    // them when the form has them.
    if (form.querySelector('input[name="show_vnr_player"]')) {
      body.show_vnr_player = !!fd.get("show_vnr_player");
    }
    if (form.querySelector('input[name="autoplay_vnr"]')) {
      body.autoplay_vnr = !!fd.get("autoplay_vnr");
    }
    // My links (v3.4) — label + URL pairs from the "My links" editor.
    // Collected in order; the server validates (label 1-40 chars, URL
    // must start with http:// or https://, max 6) and drops bad rows.
    if (form.querySelectorAll('input[name="link_label"]').length || form.querySelectorAll('input[name="link_url"]').length) {
      var linkLabels = form.querySelectorAll('input[name="link_label"]');
      var linkUrls = form.querySelectorAll('input[name="link_url"]');
      var linkStyles = form.querySelectorAll('select[name="link_style"]');
      body.my_links = [];
      for (var li = 0; li < linkLabels.length && li < linkUrls.length; li++) {
        body.my_links.push({ label: String(linkLabels[li].value || "").trim(), url: String(linkUrls[li].value || "").trim(), style: linkStyles[li] ? String(linkStyles[li].value || "") : "" });
      }
    }
    // v3.6 — profile action-button customization + custom page URL.
    // Buttons: mode radio + image URL + per-button label / colors (a
    // color only counts when its checkbox is ticked). Slug: only sent
    // when the input is enabled (it's disabled while locked).
    if (form.querySelector('input[name="pb_mode"]')) {
      var pb = { mode: "buttons", image_url: "", buttons: {} };
      var modeEl = form.querySelector('input[name="pb_mode"]:checked');
      if (modeEl && modeEl.value === "image") pb.mode = "image";
      pb.image_url = String(fd.get("pb_image_url") || "").trim().slice(0, 500);
      ["add", "message", "favorite", "group"].forEach(function (key) {
        var label = String(fd.get("pb_label_" + key) || "").trim().slice(0, 30);
        var bg = fd.get("pb_bg_use_" + key) ? String(fd.get("pb_bg_" + key) || "").trim() : "";
        var color = fd.get("pb_color_use_" + key) ? String(fd.get("pb_color_" + key) || "").trim() : "";
        // Per-button look (v3.22) — each button's own font, size, and
        // container shape. The server allowlists all three.
        var font = String(fd.get("pb_font_" + key) || "").trim();
        var size = String(fd.get("pb_size_" + key) || "").trim();
        var radius = String(fd.get("pb_radius_" + key) || "").trim();
        if (label || bg || color || font || size || radius) pb.buttons[key] = { label: label, bg: bg, color: color, font: font, size: size, radius: radius };
      });
      body.profile_buttons = JSON.stringify(pb);
    }
    var slugEl = form.querySelector('input[name="page_slug"]');
    if (slugEl && !slugEl.disabled) {
      body.page_slug = String(fd.get("page_slug") || "").trim();
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
      if (window.RCRloader) window.RCRloader.hide();
      return formErr(form, (data && data.error) || "Couldn't save that profile.");
    }
    // The save response may not carry badges / seller flags (the GET
    // does); never let a save wipe what we already know.
    var prevProfile = state.profile;
    state.profile = data.profile;
    if (prevProfile && data.profile) {
      if (!data.profile.badges && prevProfile.badges) data.profile.badges = prevProfile.badges;
      if (typeof data.profile.is_adult_seller === "undefined") data.profile.is_adult_seller = !!prevProfile.is_adult_seller;
      if (typeof data.profile.is_regular_seller === "undefined") data.profile.is_regular_seller = !!prevProfile.is_regular_seller;
    }
    state.editingProfile = false;
    state.signupOpen = false;
    // Basic signup done — show the unlock card so the member can add
    // the rest (picture, payout, 18+ ID) whenever they want.
    if (isNew) state.showUnlock = true;
    // Avatar feedback: the picture either saved, or the member gets the
    // exact reason it didn't (too big / wrong type / upload failed) —
    // without losing the rest of the save.
    if (avatar) avatarUploaded = !!(data.profile && data.profile.avatar_url);
    var avatarNote = "";
    if (avatarError) avatarNote = " Your picture didn't save — " + avatarError;
    else if (data.avatar_error) avatarNote = " Your picture didn't save — " + data.avatar_error;
    else if (avatarUploaded) avatarNote = " Picture saved ✓";
    // v3.7 — banner feedback, same pattern as the avatar.
    if (banner) bannerUploaded = !!(data.profile && data.profile.banner_url);
    var bannerNote = "";
    if (bannerError) bannerNote = " Your banner didn't save — " + bannerError;
    else if (data.banner_error) bannerNote = " Your banner didn't save — " + data.banner_error;
    else if (bannerUploaded) bannerNote = " Banner saved ✓";
    // v3.10 — video feedback, same pattern. An upload that failed
    // never wipes the previous video — the server keeps it.
    var videoNote = "";
    if (videoError) videoNote = " Your video didn't save — " + videoError;
    else if (data.video_error) videoNote = " Your video didn't save — " + data.video_error;
    else if (video) videoNote = " Video saved ✓";
    else if (fd.get("remove_video")) videoNote = " Video removed.";
    if (data.v2_pending || data.v3_pending || data.v36_pending || data.v37_pending || data.v39_pending) {
      var pendingParts = [];
      if (data.v2_pending) pendingParts.push("your Top Friends / layout");
      if (data.v3_pending) pendingParts.push("your What I sell / Find prefs / music picks");
      if (data.v36_pending) pendingParts.push("your page URL / action buttons");
      if (data.v37_pending) pendingParts.push("your banner / ticker");
      if (data.v39_pending) pendingParts.push("your website look");
      setNotice("Profile saved — but " + pendingParts.join(" and ") + " didn't stick yet. " +
        "The shop is still running a quick database update; try saving again later." + avatarNote + bannerNote + videoNote);
    } else {
      setNotice((isNew ? "Welcome to YourSpace, @" + data.profile.username + " — you're on." : "Profile saved.") + avatarNote + bannerNote + videoNote);
    }
    render();
    // Meme drawer (2026-11-21): saving used to land the member on the
    // memes — the tall edit form collapses on render and the browser
    // clamps the old scroll position to the bottom of the now-shorter
    // page, which is the meme stash. Close the drawer if it was open
    // and put the member back at the top of the feed instead.
    if (window.__dwcMemeDrawer) window.__dwcMemeDrawer(false);
    var feedTop = document.getElementById("dwc-app");
    if (feedTop) feedTop.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (typeof window !== "undefined") window.scrollTo(0, 0);
    await refreshStats();
    if (window.RCRloader) window.RCRloader.hide();
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
    var gk = "composer-" + context;
    // Cropped photo wins over the raw file input (the cropper already
    // validated the source file). No crop? Read the file input as before.
    var photo = cropPick[gk] || null;
    if (!photo) {
      photo = await fileToImage(fd.get("photo") && fd.get("photo").size ? fd.get("photo") : null, 2500000, { maxDim: 1600 });
      if (photo && photo.error) return formErr(form, photo.error);
    }
    var video = null;
    var vp = videoPick[gk];
    if (vp && vp.file) {
      video = await fileToVideo(vp.file, VIDEO_MAX_BYTES);
      if (video && video.error) return formErr(form, video.error);
    }
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
    if (kind === "event") {
      body.event_date = String(fd.get("event_date") || "").trim().slice(0, 120);
      body.event_time = String(fd.get("event_time") || "").trim().slice(0, 120);
      body.event_place = String(fd.get("event_place") || "").trim().slice(0, 120);
    }
    if (photo) body.image = { dataBase64: photo.dataBase64, mimeType: photo.mimeType };
    if (video) body.video = { dataBase64: video.dataBase64, mimeType: video.mimeType, fileName: video.fileName };
    var data = await apiPost("/posts", body);
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't post that.");
    delete gifPick[gk];
    clearCropPick(gk);
    clearVideoPick(gk);
    state.checkResult = null;
    var postMsg = kind === "adult" ? "Posted to the 18+ forum." : kind === "announcement" ? "Announcement is live." : kind === "event" ? "Event posted." : "Posted.";
    if (data.video_skipped) postMsg += " The video didn't attach yet — the shop is still running a database update, so the post is live without it.";
    if (data.event_skipped) postMsg += " The event date/time/place didn't save yet — the shop is still running a database update, so the post is live without them.";
    setNotice(postMsg);
    // Feed redesign (v3.14) — collapse the composer again so the new
    // post is visible right at the top of the feed below.
    state.composerOpen = false;
    if (context === "adult") renderAdultForum();
    else if (context === "cardcheck") renderView();
    else renderView();
    await refreshStats();
    return false;
  },

  submitCreatorPost: async function (form) {
    var fd = new FormData(form);
    var gk = "composer-creator";
    // Cropped photo wins over the raw file input (the cropper already
    // validated the source file). No crop? Read the file input as before.
    var photo = cropPick[gk] || null;
    if (!photo) {
      photo = await fileToImage(fd.get("photo") && fd.get("photo").size ? fd.get("photo") : null, 2500000, { maxDim: 1600 });
      if (photo && photo.error) return formErr(form, photo.error);
    }
    var video = null;
    var vp = videoPick[gk];
    if (vp && vp.file) {
      video = await fileToVideo(vp.file, VIDEO_MAX_BYTES);
      if (video && video.error) return formErr(form, video.error);
    }
    var printFile = await fileToPrintFile(fd.get("print_file") && fd.get("print_file").size ? fd.get("print_file") : null, 25000000);
    if (printFile && printFile.error) return formErr(form, printFile.error);
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
    if (video) body.video = { dataBase64: video.dataBase64, mimeType: video.mimeType, fileName: video.fileName };
    if (printFile) body.print_file = { dataBase64: printFile.dataBase64, fileName: printFile.fileName };
    var data = await apiPost("/posts", body);
    if (!data || !data.ok) return formErr(form, (data && data.error) || "Couldn't post that.");
    delete gifPick[gk];
    clearCropPick(gk);
    clearVideoPick(gk);
    var creatorMsg = "Creator post is live in the 18+ forum.";
    if (data.video_skipped) creatorMsg += " The video didn't attach yet — the shop is still running a database update, so the post is live without it.";
    setNotice(creatorMsg);
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

  // Blur toggle (v3.2) — reveal / re-hide a blurred photo or video
  // preview. This only flips the preview on this screen; it never
  // changes the post itself, and it never un-locks a pay-to-unlock photo.
  toggleBlur: function (btn) {
    var wrap = btn.closest(".dwc-photowrap");
    if (!wrap) return;
    var media = wrap.querySelector("img") || wrap.querySelector("video");
    if (!media) return;
    var hidden = media.classList.toggle("dwc-img-blurred");
    var isVideo = media.tagName === "VIDEO";
    btn.textContent = hidden
      ? (isVideo ? "👁 Blurred video — tap to reveal" : "👁 Blurred photo — tap to reveal")
      : (isVideo ? "🙈 Blur this video again" : "🙈 Blur this photo again");
  },
  // Photo cropper (v3.5) — a photo picked in any post composer opens the
  // crop modal. No size rejection here anymore: the crop export caps at
  // 1600px, and "use original" goes through the auto-fit in fileToImage
  // at submit, so a big photo just gets resized instead of erroring.
  photoPicked: function (input, key) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.type && IMAGE_MIMES_CLIENT.indexOf(file.type) === -1) {
      formErr(input.form, "That photo isn't a JPG, PNG, WebP, or GIF — iPhone photos often save as HEIC. Pick a JPG, PNG, WebP, or GIF, or screenshot the photo and use that.");
      input.value = "";
      return;
    }
    if (cropOrig[key]) { try { URL.revokeObjectURL(cropOrig[key]); } catch (e) {} }
    cropOrig[key] = URL.createObjectURL(file);
    updateCropPreview(input.form, key);
    openCropModal(file, key, input.form);
  },
  cropAgain: function (btn, key) {
    var form = btn.closest("form");
    var input = form && form.querySelector('input[name="photo"]');
    var file = input && input.files && input.files[0];
    if (!file) { setNotice("The original photo isn't in the form anymore — pick it again to crop."); return; }
    openCropModal(file, key, form);
  },
  removePhoto: function (btn, key) {
    var form = btn.closest("form");
    var input = form && form.querySelector('input[name="photo"]');
    if (input) input.value = "";
    clearCropPick(key);
    updateCropPreview(form, key);
  },
  // Crop modal actions — applyCrop exports the region from the ORIGINAL
  // full-resolution image (longest side capped at 1600px, JPEG 0.85).
  applyCrop: function () {
    var st = cropState;
    if (!st) return;
    var sx = st.rect.x / st.scale, sy = st.rect.y / st.scale;
    var sw = st.rect.w / st.scale, sh = st.rect.h / st.scale;
    var out = cropExportSize(sw, sh);
    var cv = document.createElement("canvas");
    cv.width = out.w; cv.height = out.h;
    var ctx = cv.getContext("2d");
    ctx.drawImage(st.img, sx, sy, sw, sh, 0, 0, out.w, out.h);
    var parts = cv.toDataURL("image/jpeg", 0.85).split(",");
    cropPick[st.key] = { dataBase64: parts[1] || "", mimeType: "image/jpeg" };
    var form = st.form, key = st.key;
    closeCropModal();
    cropState = null;
    updateCropPreview(form, key);
  },
  useOriginalCrop: function () {
    var st = cropState;
    if (!st) return;
    delete cropPick[st.key];
    var form = st.form, key = st.key;
    closeCropModal();
    cropState = null;
    updateCropPreview(form, key);
  },
  cancelCrop: function () {
    closeCropModal();
    cropState = null;
  },
  setCropAspect: function (aspect) {
    var st = cropState;
    if (!st) return;
    st.aspect = aspect;
    var btns = document.querySelectorAll("[data-cropaspect]");
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("on", btns[i].getAttribute("data-cropaspect") === aspect);
    if (aspect !== "free") {
      st.rect = fitRectToAspect(CROP_ASPECTS[aspect], st.dw, st.dh);
      drawCropCanvas();
    }
  },
  // Short video clip (v3.5) — mime + size first, then the 60s duration
  // check with a throwaway <video>. Rejected picks clear the input so a
  // bad file never rides along on submit.
  videoPicked: async function (input, key) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (!videoMimeFor(file)) {
      formErr(input.form, "That video isn't an MP4, WebM, or MOV — pick one of those.");
      input.value = "";
      return;
    }
    if (file.size > VIDEO_MAX_BYTES) {
      formErr(input.form, "That video is too large — keep it under about 15 MB.");
      input.value = "";
      return;
    }
    var dur = await videoDuration(file);
    if (dur == null) {
      formErr(input.form, "That video couldn't be read — try a different one.");
      input.value = "";
      return;
    }
    if (dur > VIDEO_MAX_SECONDS) {
      formErr(input.form, "That video is " + Math.round(dur) + " seconds — keep clips to 60 seconds or less.");
      input.value = "";
      return;
    }
    if (videoPick[key] && videoPick[key].url) { try { URL.revokeObjectURL(videoPick[key].url); } catch (e) {} }
    videoPick[key] = { file: file, name: file.name || "video", url: URL.createObjectURL(file), duration: dur };
    updateVideoPreview(input.form, key);
  },
  clearVideo: function (btn, key) {
    var form = btn.closest("form");
    var input = form && form.querySelector('input[name="video"]');
    if (input) input.value = "";
    clearVideoPick(key);
    updateVideoPreview(form, key);
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
    var img = await fileToImage(file, 2500000, { maxDim: 1600, minQuality: 0.75 });
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
    // Reuse the pick-time fit for the cover photo when it's the same file.
    var cachedCheck = listingPhotoFit[1];
    var img = (cachedCheck && cachedCheck.file === file) ? cachedCheck.result : await fileToImage(file, 2500000, { maxDim: 1600, minQuality: 0.75 });
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

  // Market listing photo pick — auto-fit the moment a photo is picked,
  // so the member sees it worked ("Resized to fit") instead of hitting
  // a "too large" wall at submit. The fit is cached per slot and reused
  // at submit (same File object) so the photo is only resized once.
  // minQuality 0.75: listing photos are product photos — keep the detail.
  listingPhotoPicked: async function (input, n) {
    var file = input && input.files && input.files[0];
    var form = input && input.form;
    var note = form && form.querySelector('[data-listingphotonote="' + n + '"]');
    delete listingPhotoFit[n];
    if (!file) { if (note) note.textContent = ""; return; }
    if (note) { note.textContent = "Resizing “" + file.name + "” to fit…"; note.style.color = "var(--muted)"; }
    var img = await fileToImage(file, 2500000, { maxDim: 1600, minQuality: 0.75 });
    if (!img) { if (note) note.textContent = ""; return; }
    if (img.error) {
      if (note) { note.textContent = "“" + file.name + "” — " + img.error; note.style.color = "var(--amber)"; }
      input.value = "";
      return;
    }
    listingPhotoFit[n] = { file: file, result: img };
    if (note) {
      note.textContent = img.shrunk
        ? "✓ “" + file.name + "” resized to fit — " + img.width + "×" + img.height + ", " + fmtKB(img.newKB) + " (was " + fmtKB(img.origKB) + ")"
        : "✓ “" + file.name + "” good to go — " + img.width + "×" + img.height + ", " + fmtKB(img.newKB);
      note.style.color = "var(--green)";
    }
  },

  submitListing: async function (form, kind) {
    var fd = new FormData(form);
    var photos = [];
    var anyShrunk = false;
    for (var i = 1; i <= 3; i++) {
      var f = fd.get("photo" + i);
      if (f && f.size) {
        // Pick-time fit wins when the file hasn't changed since picking
        // (same File object) — no double resize.
        var cached = listingPhotoFit[i];
        var img = (cached && cached.file === f) ? cached.result : await fileToImage(f, 2500000, { maxDim: 1600, minQuality: 0.75 });
        if (img.error) return formErr(form, img.error);
        if (img.shrunk) anyShrunk = true;
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
    listingPhotoFit = {};
    setNotice("Listed — it's live in the " + (kind === "sale" ? "Flea Market" : kind === "trade" ? "Up for Trade" : "Auction House") + "." + (anyShrunk ? " Photos were resized to fit." : ""));
    go("listing/" + data.listing_id);
    await refreshStats();
    return false;
  },

  // Reactions (v3.15) — heart + sad + confused on a post. One reaction
  // per person; tapping the same kind again takes it off, tapping
  // another kind switches. The group re-renders in place from the
  // server's counts, so no full reload is needed.
  reactPost: async function (id, kind, btn) {
    if (!state.profile) { setNotice("Create your account first to react to posts."); DWC.openSignup(); return; }
    var data = await apiPost("/posts/" + id + "/vote", { device_id: deviceId(), kind: kind });
    if (data && data.ok) {
      setReaction("post-" + id, data.my_reaction || null);
      refreshReactGroup("post", id, data);
    } else if (data && data.error) setNotice(data.error);
  },
  heartPost: async function (id, btn) { return DWC.reactPost(id, "heart", btn); },
  // Reactions (v3.15) — heart + sad + confused on a comment, on every
  // surface: thread (postId), listing (listingId), profile page and
  // picture viewer (profileId). Same one-reaction rule as posts.
  reactComment: async function (ctype, ref, commentId, kind, btn) {
    if (!state.profile) { setNotice("Create your account first to react to comments."); DWC.openSignup(); return; }
    var url, body = { device_id: deviceId(), kind: kind };
    if (ctype === "thread") url = "/posts/" + ref + "/comments/" + commentId + "/vote";
    else if (ctype === "listing") url = "/listings/" + ref + "/comments/" + commentId + "/react";
    else { url = "/profile-comments/react"; body.comment_id = commentId; }
    var data = await apiPost(url, body);
    if (data && data.ok) {
      setReaction("comment-" + ctype + "-" + commentId, data.my_reaction || null);
      refreshReactGroup("comment", commentId, data, ctype, ref);
    } else if (data && data.error) setNotice(data.error);
  },
  // Feed redesign (v3.14) — the thread post heart is the same neon star.
  heartComment: async function (postId, commentId, btn) { return DWC.reactComment("thread", postId, commentId, "heart", btn); },
  // Picture hearts (v3.16) — heart or nothing on the picture open in
  // the viewer. Same neon star as posts/comments; no sad/confused.
  // The button re-renders in place from the server's count, and the
  // host is only touched if the viewer is still on the same photo
  // (Prev/Next rebuilds it, so a late reply never writes to the
  // wrong picture).
  heartPicture: async function (btn) {
    if (!state.profile) { setNotice("Create your account first to heart pictures."); DWC.openSignup(); return; }
    var pv = state.picViewer;
    if (!pv) return;
    var photo = pv.photos[pv.index];
    if (!photo) return;
    var data = await apiPost("/picture-hearts", { device_id: deviceId(), owner_id: pv.memberId, subject: photo.subject });
    if (data && data.ok) {
      setReaction(pictureHeartKey(pv.memberId, photo.subject), data.my_heart ? "heart" : null);
      var host = $("dwc-picviewer-heart");
      if (host && state.picViewer && state.picViewer.photos[state.picViewer.index] === photo) {
        host.innerHTML = pictureHeartHTML(data.hearts || 0, !!data.my_heart);
      }
    } else if (data && data.error) setNotice(data.error);
  },
  // Feed redesign (v3.14) — comment hearts are the same neon star.
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

  // v3.7 page comments — post + delete.
  sendPageComment: async function (form, profileId) {
    var fd = new FormData(form);
    var err = form.parentElement.querySelector("[data-err]");
    // Optional picture: shrink it first (same as avatar/banner) so a
    // big phone photo never kills the comment.
    var img = await shrinkAvatarImage(fd.get("image") && fd.get("image").size ? fd.get("image") : null);
    if (img && img.error) { if (err) { err.hidden = false; err.textContent = "Picture didn't attach — " + img.error; } return false; }
    var body = {
      device_id: deviceId(),
      profile_id: profileId,
      body: String(fd.get("body") || "").trim(),
      visibility: String(fd.get("visibility") || "public"),
      gif_url: String(fd.get("gif_url") || "").trim(),
    };
    if (img) body.image = { dataBase64: img.dataBase64, mimeType: img.mimeType };
    var data = await apiPost("/profile-comments", body);
    if (!data || !data.ok) { if (err) { err.hidden = false; err.textContent = (data && data.error) || "Couldn't post that comment."; } return false; }
    form.reset();
    await loadPageComments(profileId, state.profile && state.profile.id === profileId, false);
    return false;
  },
  deletePageComment: async function (commentId, profileId) {
    if (!confirm("Delete this page comment?")) return;
    var data = await apiDelete("/profile-comments?id=" + commentId + "&device_id=" + encodeURIComponent(deviceId()));
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't delete that comment."); return; }
    await loadPageComments(profileId, state.profile && state.profile.id === profileId, false);
  },

  // v3.7 admin panel — grant a role, ban/unban.
  adminSetRole: async function (profileId, role) {
    var data = await apiPost("/admin", { device_id: deviceId(), action: "set-role", profile_id: profileId, role: role });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't change that role."); renderView(); return; }
    setNotice("Role updated to " + role + ".");
    renderView();
  },
  adminBan: async function (profileId, ban) {
    var reason = "";
    if (ban) {
      reason = prompt("Ban reason (optional — shown to the team):", "") || "";
    }
    if (ban && !confirm("Ban this member? They won't be able to post or list until you unban them.")) return;
    var data = await apiPost("/admin", { device_id: deviceId(), action: "ban", profile_id: profileId, banned: ban, reason: reason });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't change that ban."); return; }
    setNotice(ban ? "Member banned." : "Member unbanned.");
    renderView();
  },
  // v3.8 admin member filters — client-side only, re-renders the cached
  // member list. "clear" resets both filters.
  adminFilter: function (which, value) {
    if (which === "sells") adminSellsFilter = value || "";
    else if (which === "wants") adminWantsFilter = value || "";
    else if (which === "clear") { adminSellsFilter = ""; adminWantsFilter = ""; }
    renderAdminMembers();
  },
  // v3.9 radio player text — save the radio.html words + stream URL.
  // Blank fields are left as-is (only non-empty values are sent).
  saveRadioSettings: async function (form) {
    var msg = $("dwc-radio-settings-msg");
    var keys = ["station_tagline", "dj_greeting", "dj_message", "ticker", "onair_label", "stream_url"];
    var settings = {};
    keys.forEach(function (k) {
      var input = form.querySelector('[name="' + k + '"]');
      var v = input ? String(input.value || "").trim() : "";
      if (v) settings[k] = v.slice(0, 500);
    });
    if (!Object.keys(settings).length) { if (msg) msg.textContent = "Nothing to save — fill in a field first."; return false; }
    if (msg) msg.textContent = "Saving…";
    var data = await apiPost("/radio-settings", { device_id: deviceId(), settings: settings });
    if (!data || !data.ok) { if (msg) msg.textContent = (data && data.error) || "Couldn't save — try again."; return false; }
    if (msg) msg.textContent = "Saved ✓ — the radio page picks it up within 30 seconds.";
    return false;
  },

  // v3.7 team chat.
  sendTeamChat: async function (form) {
    var fd = new FormData(form);
    var err = form.parentElement.querySelector("[data-err]");
    var data = await apiPost("/team-chat", { device_id: deviceId(), body: String(fd.get("body") || "").trim() });
    if (!data || !data.ok) { if (err) { err.hidden = false; err.textContent = (data && data.error) || "Couldn't send that."; } return false; }
    form.reset();
    await loadTeamChat();
    return false;
  },

  // ---------- MySpace throwback v2 actions ----------
  topFriendChanged: function (cb) {
    var n = document.querySelectorAll('input[name="top_friend"]:checked').length;
    if (n > 10) {
      cb.checked = false;
      setNotice("Top Friends means 10 — unpick one first.");
    }
    updateTop8Count();
    DWC.refreshLayoutPreviewSoon();
  },
  // Avatar picker feedback (v3.4) — the moment Chris picks a file, show
  // its size and whether it will work, instead of failing silently on save.
  avatarPicked: async function (input) {
    var note = document.getElementById("dwc-avatar-note");
    if (!note) return;
    var f = input && input.files && input.files[0];
    if (!f) { note.textContent = ""; return; }
    note.textContent = "Shrinking “" + f.name + "” to profile size…";
    note.style.color = "var(--muted)";
    var r = await shrinkAvatarImage(f);
    if (!r) { note.textContent = ""; return; }
    if (r.error) {
      note.textContent = "Picked “" + f.name + "” — " + r.error;
      note.style.color = "var(--amber)";
    } else if (r.shrunk) {
      note.textContent = "Picked “" + f.name + "” — shrunk from " + fmtKB(r.origKB) + " to " + fmtKB(r.newKB) + " (" + r.width + "×" + r.height + " JPEG) ✓ Good to go — hit Save profile.";
      note.style.color = "var(--green)";
    } else {
      note.textContent = "Picked “" + f.name + "” — " + fmtKB(r.newKB) + " ✓ Good to go — hit Save profile.";
      note.style.color = "var(--green)";
    }
  },
  // My links editor (v3.4) — add a row (max 6) or remove one row.
  addLinkRow: function () {
    var list = document.getElementById("dwc-links-list");
    if (!list) return;
    var rows = list.querySelectorAll(".dwc-linkrow").length;
    if (rows >= 6) { setNotice("Up to 6 links — remove one first."); return; }
    var div = document.createElement("div");
    div.className = "dwc-linkrow";
    div.innerHTML = '<input name="link_label" maxlength="40" placeholder="Label — e.g. My shop">' +
      '<input name="link_url" maxlength="500" placeholder="https://…">' +
      '<select name="link_style" title="Button style for this link"><option value="" selected>Page buttons</option>' +
      Object.keys(LINK_BUTTON_STYLES).map(function (k) { return '<option value="' + k + '">' + esc(LINK_BUTTON_STYLES[k].label) + "</option>"; }).join("") + "</select>" +
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
    var pr = null;
    if (id) { for (var i = 0; i < LAYOUT_PRESETS.length; i++) if (LAYOUT_PRESETS[i].id === id) pr = LAYOUT_PRESETS[i]; }
    var form = document.querySelector("#dwc-account form");
    var ta = form && form.querySelector('textarea[name="layout_css"]');
    var hidden = form && form.querySelector('input[name="layout_preset"]');
    if (ta) ta.value = pr ? pr.css : "";
    if (hidden) hidden.value = id || "";
    // Reset the theme pickers to the preset's theme (v3.20 root fix) —
    // the old neon look (vibe, glow, effects, custom button CSS) must
    // NOT survive, or it would keep winning over the new preset. The
    // preset's CSS + its theme fragment, together, ARE the look.
    DWC.applyPresetThemeToForm(pr ? pr.theme || {} : {});
    // Say what changed: the preset's look replaces the old one, so a
    // background picture the member had is off now (the preset's own
    // background shows instead).
    if (pr) DWC.bgNote("Preset “" + pr.name + "” is on — your old background picture and preset are off; the preset’s own look is showing.");
    else DWC.bgNote("Preset off — your page is back to your own picks.");
    applyPreviewCSS(ta ? ta.value : "");
    document.querySelectorAll("[data-presetbtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-presetbtn") === id);
    });
    DWC.refreshLayoutPreviewSoon();
  },
  // Write a preset's theme fragment into the Edit Profile form fields
  // (look fields only — Top Friends, feed privacy, divider, video, and
  // ticker are structural and stay as the member set them). Every field
  // is guarded: a missing field just doesn't change.
  applyPresetThemeToForm: function (th) {
    var form = document.querySelector("#dwc-account form");
    if (!form) return;
    var setVal = function (name, v) { var el = form.querySelector('[name="' + name + '"]'); if (el) el.value = v; };
    var setChk = function (name, on) { var el = form.querySelector('[name="' + name + '"]'); if (el) el.checked = !!on; };
    var setPills = function (attr, val) {
      document.querySelectorAll("[" + attr + "]").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute(attr) === val);
      });
    };
    th = th || {};
    setVal("theme_vibe", th.vibe || "");
    setChk("theme_bg_use", !!th.bg_color);
    setVal("theme_bg_color", th.bg_color || "#12002e");
    setVal("theme_bg_image", th.bg_image_url || "");
    setVal("theme_bg_preset", th.bg_preset || "");
    setPills("data-bgpresetbtn", th.bg_preset || "");
    setChk("theme_text_use", !!th.text_color);
    setVal("theme_text_color", th.text_color || "#f2f2f8");
    setChk("theme_accent_use", !!th.accent_color);
    setVal("theme_accent_color", th.accent_color || "#ff2d95");
    var botAccent = document.getElementById("dwc-bot-accent");
    if (botAccent && th.accent_color) botAccent.value = th.accent_color;
    setVal("theme_name_font", th.name_font || "");
    setVal("theme_font", th.font || "");
    setChk("theme_glow", th.glow === true);
    setVal("theme_glow_color", th.glow_color || "#00e5ff");
    setVal("theme_outline_color", th.outline_color || "#000000");
    setVal("theme_button_style", th.button_style || "");
    document.querySelectorAll('[onclick*="applyButtonStyle"]').forEach(function (b) {
      var oc = b.getAttribute("onclick") || "";
      b.classList.toggle("active", (th.button_style || "") === "" ? oc.indexOf("''") >= 0 : oc.indexOf("'" + th.button_style + "'") >= 0);
    });
    setVal("theme_button_css", th.button_css || "");
    form.querySelectorAll('input[name="theme_effects"]').forEach(function (cb) {
      cb.checked = (th.effects || []).indexOf(cb.value) >= 0;
    });
    setChk("theme_comment_border_use", !!th.comment_border_color);
    setVal("theme_comment_border_color", th.comment_border_color || "#000000");
    setVal("theme_pic_size", th.pic_size || "bigger");
    setPills("data-picsizebtn", th.pic_size || "bigger");
    setVal("theme_pic_position", th.pic_position || "normal");
    setPills("data-picposbtn", th.pic_position || "normal");
    setVal("theme_pic_frame", th.pic_frame || "none");
    setPills("data-picframebtn", th.pic_frame || "none");
    DWC.refreshBgNow();
  },
  // v3.20 — background mutual exclusion: a preset, a custom picture,
  // or None — picking one turns the others OFF, in the form AND in the
  // save path, so a preset can never silently sit on top of a custom
  // picture again. Every switch says what changed, right there.
  bgNote: function (text) {
    var n = document.getElementById("dwc-bg-note");
    if (n) n.textContent = text || "";
  },
  refreshBgNow: function () {
    var form = document.querySelector("#dwc-account form");
    var now = document.getElementById("dwc-bg-now");
    if (!now || !form) return;
    var img = form.querySelector('input[name="theme_bg_image"]');
    var hidden = form.querySelector('input[name="theme_bg_preset"]');
    var imgVal = img ? String(img.value || "").trim() : "";
    var presetVal = hidden ? String(hidden.value || "") : "";
    var label = "no picture or preset — your background color / vibe shows";
    if (imgVal) label = "your picture";
    else if (presetVal) {
      var pr = PRESET_BACKGROUNDS.filter(function (x) { return x.id === presetVal; })[0];
      label = "preset “" + (pr ? pr.name : presetVal) + "”";
    }
    now.innerHTML = "<strong>Showing now:</strong> " + esc(label);
  },
  applyBgPreset: function (id) {
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_bg_preset"]');
    if (hidden) hidden.value = id;
    document.querySelectorAll("[data-bgpresetbtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-bgpresetbtn") === id);
    });
    if (id) {
      // A preset turns the picture OFF.
      var img = form && form.querySelector('input[name="theme_bg_image"]');
      if (img) img.value = "";
      var pr = PRESET_BACKGROUNDS.filter(function (x) { return x.id === id; })[0];
      DWC.bgNote("Your picture is off — preset “" + (pr ? pr.name : id) + "” is now showing.");
    } else {
      DWC.bgNote("Preset off — your background color / vibe shows (add a picture below if you want one).");
    }
    DWC.refreshBgNow();
    DWC.refreshLayoutPreviewSoon();
  },
  // A picture turns the preset OFF.
  bgImageChanged: function (input) {
    var v = String((input && input.value) || "").trim();
    if (v) {
      var form = document.querySelector("#dwc-account form");
      var hidden = form && form.querySelector('input[name="theme_bg_preset"]');
      if (hidden) hidden.value = "";
      document.querySelectorAll("[data-bgpresetbtn]").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-bgpresetbtn") === "");
      });
      DWC.bgNote("Preset turned off — your custom picture is now showing.");
    } else {
      DWC.bgNote("Picture removed — your preset / background color shows.");
    }
    DWC.refreshBgNow();
    DWC.refreshLayoutPreviewSoon();
  },
  // The animated rainbow background IS the background — it wins over a
  // picture or a preset, so ticking it turns both off (and says so).
  bgEffectChanged: function (cb) {
    if (!cb || cb.value !== "animated-bg") return;
    if (cb.checked) {
      var form = document.querySelector("#dwc-account form");
      var img = form && form.querySelector('input[name="theme_bg_image"]');
      if (img) img.value = "";
      var hidden = form && form.querySelector('input[name="theme_bg_preset"]');
      if (hidden) hidden.value = "";
      document.querySelectorAll("[data-bgpresetbtn]").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-bgpresetbtn") === "");
      });
      DWC.bgNote("Animated background is on — your picture and preset are off while it runs.");
    } else {
      DWC.bgNote("Animated background off — your picture / preset can show again (re-pick it below).");
    }
    DWC.refreshBgNow();
    DWC.refreshLayoutPreviewSoon();
  },
  // One tap: use the member's own banner picture as the background.
  useBannerAsBackground: function () {
    var banner = state.profile && state.profile.banner_url;
    if (!banner) { DWC.bgNote("You don’t have a banner uploaded yet — upload one above first."); return; }
    var form = document.querySelector("#dwc-account form");
    var img = form && form.querySelector('input[name="theme_bg_image"]');
    if (img) img.value = banner;
    var hidden = form && form.querySelector('input[name="theme_bg_preset"]');
    if (hidden) hidden.value = "";
    document.querySelectorAll("[data-bgpresetbtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-bgpresetbtn") === "");
    });
    DWC.bgNote("Preset turned off — your banner picture is now showing.");
    DWC.refreshBgNow();
    DWC.refreshLayoutPreviewSoon();
  },
  // Custom page live preview (v3.20) — sanitized, so the preview shows
  // exactly what visitors would see, scripts stripped and all.
  customPagePreview: function (ta) {
    var host = document.getElementById("dwc-custompage-preview");
    if (!host) return;
    var html = sanitizeCustomPageHtml(ta ? ta.value : "");
    host.innerHTML = html
      ? '<div class="card" style="margin-top:4px"><p style="margin:0 0 6px;color:var(--muted);font-size:13px">Preview — what visitors see with Website look on:</p><div class="dwc-custom-page">' + html + "</div></div>"
      : "";
  },
  // v3.9 — picture size / position pickers.
  applyPicSize: function (size) {
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_pic_size"]');
    if (hidden) hidden.value = size;
    document.querySelectorAll("[data-picsizebtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-picsizebtn") === size);
    });
  },
  applyPicPosition: function (pos) {
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_pic_position"]');
    if (hidden) hidden.value = pos;
    document.querySelectorAll("[data-picposbtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-picposbtn") === pos);
    });
  },
  // v3.9 — picture frame picker. Shows/hides the blood-color row and
  // the handheld-color row for the frames that need them.
  applyPicFrame: function (id) {
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_pic_frame"]');
    if (hidden) hidden.value = id;
    document.querySelectorAll("[data-picframebtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-picframebtn") === id);
    });
    var blood = $("dwc-blood-row");
    if (blood) blood.hidden = id !== "blood";
    var gb = $("dwc-gb-row");
    if (gb) gb.hidden = !(id === "gb" || id === "gba");
  },
  // Badge slot picker (v3.9): a regular seller only gets a second slot
  // while slot 1 is Regular Seller. Adult sellers ALWAYS get a second
  // slot (18+ is locked in slot 1 + one pick), so never hide it for
  // them — their slot 1 is a hidden input, not a select, so checking
  // s1.value alone would wrongly hide/clear slot 2 on every change.
  badgeSlotChanged: function () {
    var form = document.querySelector("#dwc-account form");
    if (!form) return;
    var s1 = form.querySelector('select[name="theme_display_badge_1"]');
    var slot2 = $("dwc-badge-slot2");
    if (!slot2) return;
    var isAdult = !!(state.profile && state.profile.is_adult_seller);
    var show = isAdult || (!!(state.profile && state.profile.is_regular_seller) && s1 && s1.value === "badge:sales-5");
    slot2.hidden = !show;
    var s2 = slot2.querySelector("select");
    if (s2) {
      s2.disabled = !show;
      if (!show) s2.value = "";
    }
    DWC.refreshLayoutPreviewSoon();
  },
  // v3.9 — handheld color mode: show the 3 custom colors only for "custom".
  gbModeChanged: function (sel) {
    var custom = $("dwc-gb-custom");
    if (custom) custom.hidden = sel.value !== "custom";
  },
  // v3.9 — custom comment-border color vs the RGB effect: ticking the
  // color un-ticks the RGB effect (they're mutually exclusive).
  commentBorderUseChanged: function (cb) {
    if (!cb.checked) return;
    var form = cb.closest("form");
    var rgb = form && form.querySelector('input[name="theme_effects"][value="rgb-comment-border"]');
    if (rgb) rgb.checked = false;
    DWC.refreshLayoutPreviewSoon();
  },
  layoutCssEdited: function (ta) {
    var form = ta.closest("form");
    var hidden = form && form.querySelector('input[name="layout_preset"]');
    if (hidden) hidden.value = "custom";
    var count = document.getElementById("dwc-mycode-count");
    if (count) count.textContent = (ta.value || "").length + "/8000";
    applyPreviewCSS(ta.value);
    document.querySelectorAll("[data-presetbtn]").forEach(function (b) { b.classList.remove("active"); });
    DWC.refreshLayoutPreviewSoon();
  },
  // ---------- v3.10 Taffy Layout Builder (no code generation) ----------
  // The vibe dropdown + accent color are REAL theme settings: they map
  // to theme.vibe / theme.accent_color, change the live preview at once,
  // and save with the profile. Taffy doesn't write code — she points at
  // settings that work.
  vibePicked: function (sel) {
    var v = sel && LAYOUT_VIBES[sel.value];
    var form = sel ? sel.closest("form") : null;
    var useEl = form && form.querySelector('input[name="theme_accent_use"]');
    var accEl = form && form.querySelector('input[name="theme_accent_color"]');
    var botEl = $("dwc-bot-accent");
    // No custom accent picked yet: show the vibe's accent in both
    // accent inputs, so what you see is what the page uses.
    if (v && useEl && !useEl.checked) {
      if (accEl) accEl.value = v.accent;
      if (botEl) botEl.value = v.accent;
    }
    DWC.refreshLayoutPreviewSoon();
    DWC.profileFormDirty();
  },
  // Accent color — one color, two inputs (Taffy's box + the layout
  // section's picker). They stay in sync, and picking a color ticks
  // "Use a custom accent color" so it actually saves.
  setAccent: function (color) {
    var form = document.querySelector("#dwc-account form");
    var botEl = $("dwc-bot-accent");
    if (botEl) botEl.value = color;
    if (form) {
      var accEl = form.querySelector('input[name="theme_accent_color"]');
      if (accEl) accEl.value = color;
      var useEl = form.querySelector('input[name="theme_accent_use"]');
      if (useEl) useEl.checked = true;
    }
    DWC.refreshLayoutPreviewSoon();
    DWC.profileFormDirty();
  },
  // Layout Store entry point — opens Taffy's phone on the store app.
  layoutStoreSoon: function () {
    DWC.phoneGo("store");
  },
  // Live preview, debounced — the form's oninput/onchange fires this on
  // every keystroke, and the preview rebuilds 200ms after the member
  // stops typing. The preview lives in its own div, so typing never
  // loses focus.
  refreshLayoutPreviewSoon: function () {
    if (state.previewTimer) clearTimeout(state.previewTimer);
    state.previewTimer = setTimeout(function () { DWC.refreshLayoutPreview(); }, 200);
  },
  // ---------- v3.10 profile customization ----------
  // Buttons side picker — Left / Right pills in the Buttons section.
  // Sets the hidden theme_buttons_side field and the pill states.
  applyButtonsSide: function (side) {
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_buttons_side"]');
    if (hidden) hidden.value = side;
    document.querySelectorAll("[data-btnsidebtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-btnsidebtn") === side);
    });
    DWC.profileFormDirty();
    DWC.refreshLayoutPreviewSoon();
  },
  // Button size picker (v3.21) — S / M / L / XL pills in the Buttons
  // group. Sets the hidden theme_button_size field ("" = M, the
  // current size). Same pattern as applyButtonsSide.
  applyButtonSize: function (size) {
    var v = (size === "s" || size === "l" || size === "xl") ? size : "";
    var key = v === "" ? "m" : v;
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_button_size"]');
    if (hidden) hidden.value = v;
    document.querySelectorAll("[data-btnsizebtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-btnsizebtn") === key);
    });
    DWC.profileFormDirty();
    DWC.refreshLayoutPreviewSoon();
  },
  // Video size picker (v3.22) — Small / Normal / Big / Stretch to fit
  // pills next to the video URL. Sets the hidden theme_video_size
  // field ("" = Normal, the current size). Same pattern as
  // applyButtonSize; the preview shows the new size right away.
  applyVideoSize: function (size) {
    var v = (size === "s" || size === "l" || size === "stretch") ? size : "";
    var key = v === "" ? "m" : v;
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_video_size"]');
    if (hidden) hidden.value = v;
    document.querySelectorAll("[data-videosizebtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-videosizebtn") === key);
    });
    DWC.profileFormDirty();
    DWC.refreshLayoutPreviewSoon();
  },
  // Video Center button (v3.22) — locks the video block in the middle
  // of its spot (theme_video_align "center"). Tapping it again releases
  // the lock back to the standard arrangement. The preview shows it.
  applyVideoAlign: function (align) {
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_video_align"]');
    var cur = hidden ? hidden.value : "";
    var v = (align === "center" && cur !== "center") ? "center" : "";
    if (hidden) hidden.value = v;
    document.querySelectorAll("[data-videocenterbtn]").forEach(function (b) {
      b.classList.toggle("active", v === "center");
    });
    DWC.profileFormDirty();
    DWC.refreshLayoutPreviewSoon();
  },
  // Cover photo size (v3.22) — Small picture / Big cover photo pills
  // next to the banner settings. Sets theme_cover_size ("" = Small,
  // the current look; "big" = tall cover area).
  applyCoverSize: function (size) {
    var v = (size === "big") ? "big" : "";
    var key = v === "" ? "small" : "big";
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_cover_size"]');
    if (hidden) hidden.value = v;
    document.querySelectorAll("[data-coversizebtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-coversizebtn") === key);
    });
    DWC.profileFormDirty();
    DWC.refreshLayoutPreviewSoon();
  },
  // Name placement (v3.22) — Under / Left / Right pills next to the
  // banner settings. Sets theme_cover_name ("" = under the picture,
  // the current look; "left" / "right" = beside the picture).
  applyCoverName: function (pos) {
    var v = (pos === "left" || pos === "right") ? pos : "";
    var key = v === "" ? "under" : v;
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_cover_name"]');
    if (hidden) hidden.value = v;
    document.querySelectorAll("[data-covernamebtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-covernamebtn") === key);
    });
    DWC.profileFormDirty();
    DWC.refreshLayoutPreviewSoon();
  },
  // Professional-mode button side (v3.21) — Left / Center / Right pills.
  // Sets the hidden theme_pro_button_side field ("" = left).
  applyProButtonSide: function (side) {
    var v = (side === "center" || side === "right") ? side : "";
    var key = v === "" ? "left" : v;
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_pro_button_side"]');
    if (hidden) hidden.value = v;
    document.querySelectorAll("[data-prosidebtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-prosidebtn") === key);
    });
    DWC.profileFormDirty();
    DWC.refreshLayoutPreviewSoon();
  },
  // Professional-mode button color (v3.21) — preset pills or the color
  // input. Sets the hidden theme_pro_button_color field ("" = default
  // look, untouched) and syncs the picker + pills.
  applyProButtonColor: function (color) {
    var ok = /^#[0-9a-fA-F]{6}$/.test(String(color || "").trim()) ? String(color).trim() : "";
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_pro_button_color"]');
    if (hidden) hidden.value = ok;
    var pick = form && form.querySelector("#dwc-pro-color-pick");
    if (pick && ok) pick.value = ok;
    document.querySelectorAll("[data-procolorbtn]").forEach(function (b) {
      b.classList.toggle("active", ok !== "" && b.getAttribute("data-procolorbtn").toLowerCase() === ok.toLowerCase());
    });
    DWC.profileFormDirty();
    DWC.refreshLayoutPreviewSoon();
  },
  // Banner auto-fit (v3.20) — see bannerFit above; the DWC wrapper so
  // the inline onload handler can reach it.
  bannerFit: function (img) { bannerFit(img); },
  // Banner picked in Edit Profile — show it in the preview area, fitted
  // the same way it'll look on the page (wide stretches, square stays
  // small). The file still only saves when the member hits Save.
  bannerPicked: function (input) {
    var host = $("dwc-banner-preview");
    var f = input && input.files && input.files[0];
    if (!host || !f) return;
    var url = URL.createObjectURL(f);
    host.innerHTML = '<div class="dwc-banner"><img src="' + esc(url) + '" alt="Banner preview" onload="DWC.bannerFit(this)"></div>';
  },
  // Top Friends side picker (v3.20) — Right / Left pills in the Top
  // Friends section. Sets the hidden theme_topfriends_side field.
  applyTopFriendsSide: function (side) {
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_topfriends_side"]');
    if (hidden) hidden.value = side;
    document.querySelectorAll("[data-tfsidebtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tfsidebtn") === side);
    });
    DWC.profileFormDirty();
    DWC.refreshLayoutPreviewSoon();
  },
  // Divider picker (v3.20) — sets the hidden theme_divider field and
  // the pill states, then refreshes the live preview. A design's own
  // default color applies when the member hasn't picked a custom one
  // (tracked by the color input's data-custom flag).
  applyDivider: function (id) {
    if (!DIVIDERS[id] || !DIVIDERS[id].free) return;
    var form = document.querySelector("#dwc-account form");
    var hidden = form && form.querySelector('input[name="theme_divider"]');
    if (hidden) hidden.value = id;
    document.querySelectorAll("[data-dividerbtn]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-dividerbtn") === id);
    });
    var col = form && form.querySelector('input[name="theme_divider_color"]');
    if (col && col.getAttribute("data-custom") !== "1") {
      col.value = (DIVIDERS[id].color || "#9a9ab0");
    }
    DWC.refreshDividerPreview();
    DWC.profileFormDirty();
    DWC.refreshLayoutPreviewSoon();
  },
  // Divider live preview (v3.20) — re-renders the preview under the
  // picker from the current pick + color input.
  refreshDividerPreview: function () {
    var host = $("dwc-divider-preview");
    var form = document.querySelector("#dwc-account form");
    if (!host || !form) return;
    var id = (form.querySelector('input[name="theme_divider"]') || {}).value || "";
    var col = (form.querySelector('input[name="theme_divider_color"]') || {}).value || "";
    host.innerHTML = dividerHTML(id, col);
  },
  // Member feed "Load more" (v3.20) — the fallback for endless scroll.
  loadMoreMemberFeed: function () {
    if (typeof state !== "undefined" && state.feedLoader) state.feedLoader();
  },
  // Profile video file picked — instant feedback (name, size, too big).
  videoPicked: function (input) {
    var note = $("dwc-video-note");
    var f = input && input.files && input.files[0];
    if (!f) return;
    var mb = (f.size / 1048576).toFixed(1);
    if (note) {
      if (f.size > VIDEO_MAX_BYTES) {
        note.textContent = "⚠ " + f.name + " is " + mb + " MB — profile videos cap at " + (VIDEO_MAX_BYTES / 1048576) + " MB. Pick a shorter clip or a YouTube link instead.";
      } else {
        note.textContent = "✓ " + f.name + " (" + mb + " MB) — ready to save. It wins over any YouTube link above.";
      }
    }
    DWC.profileFormDirty();
    DWC.refreshLayoutPreviewSoon();
  },
  // Any change on the Edit Profile form shows the unsaved-changes note
  // and enables the Save button state. Nothing saves until Save.
  profileFormDirty: function () {
    var note = $("dwc-unsaved-note");
    if (note) note.hidden = false;
  },
  // ---------- v3.10 Taffy profile builder ----------
  // Plain-words profile setup: keyword/phrase matching over the known
  // settings — buttons side, button style, ticker source, show/hide
  // sections, video side. Taffy is client-side pattern matching only —
  // she never claims to understand arbitrary language. Anything she
  // can't match is reported back honestly, and the rest still applies.
  runProfileBuilder: function () {
    var el = $("dwc-builder-prompt");
    var raw = el ? el.value : "";
    var text = " " + raw.toLowerCase().replace(/[^a-z0-9 ]/g, " ") + " ";
    var has = function (re) { return re.test(text); };
    var changes = {};
    var understood = [];
    var missed = [];
    // — Buttons side —
    if (has(/buttons? (on )?(the )?(top )?right/) || has(/right side/)) { changes.buttons_side = "right"; understood.push("Buttons on the right side"); }
    else if (has(/buttons? (on )?(the )?(top )?left/) || has(/left side/)) { changes.buttons_side = "left"; understood.push("Buttons on the left side"); }
    // — Buttons show/hide —
    if (has(/hide (the )?(my )?buttons?/) || has(/\bno buttons?\b/)) { changes.buttons_show = false; understood.push("Hide the action buttons"); }
    else if (has(/show (the )?(my )?buttons?/)) { changes.buttons_show = true; understood.push("Show the action buttons"); }
    // — Button style —
    [["insert coin|arcade", "insert-coin", "Insert-coin arcade buttons"],
     ["pixel|8[- ]?bit", "pixel", "Pixel buttons"],
     ["neon", "neon", "Neon buttons"],
     ["round", "round", "Round buttons"],
     ["glow", "glow", "Glowing buttons"],
     ["bubble", "bubble", "Bubble buttons"],
     ["vapor ?wave", "vaporwave", "Vaporwave buttons"],
     ["retro", "retro", "Retro buttons"],
     ["classic|plain", "classic", "Classic buttons"]].forEach(function (row) {
      if (has(new RegExp(row[0]))) { changes.button_style = row[1]; understood.push(row[2]); }
    });
    // — Ticker — (includes the "bitcion" typo from Chris's own example)
    if (has(/bitcoin|bitcion|bit coin|\bbtc\b/)) { changes.ticker_source = "btc"; changes.ticker_enabled = true; understood.push("Ticker shows the live Bitcoin price (updates every minute)"); }
    else if (has(/hide (the )?ticker|ticker off|no ticker/)) { changes.ticker_enabled = false; understood.push("Hide the ticker"); }
    else if (has(/ticker/)) { changes.ticker_source = "text"; understood.push("Ticker shows your own words (type them in the Ticker box)"); }
    // — Sections: "hide everything but X" / "only show X" —
    var keepList = null;
    if (has(/hide everything but|only show|hide all but|show only/)) {
      keepList = [];
      SECTION_HIDE_IDS.forEach(function (k) {
        (SECTION_KEYWORDS[k] || []).forEach(function (w) {
          if (text.indexOf(w) >= 0 && keepList.indexOf(k) < 0) keepList.push(k);
        });
      });
      if (keepList.length) {
        changes.hide_sections = SECTION_HIDE_IDS.filter(function (k) { return keepList.indexOf(k) < 0; });
        understood.push("Hide everything except: " + keepList.map(function (k) { return SECTION_HIDE_LABELS[k]; }).join(", "));
      }
    }
    // — Individual section hide/show (clause by clause) —
    if (!keepList) {
      var hideSet = [];
      var showSet = [];
      raw.split(/[,;.]+|\band\b|\bthen\b/i).forEach(function (clause) {
        var c = clause.toLowerCase();
        SECTION_HIDE_IDS.forEach(function (k) {
          if (!(SECTION_KEYWORDS[k] || []).some(function (w) { return c.indexOf(w) >= 0; })) return;
          if (/\bhide\b/.test(c) || /\bremove\b/.test(c)) { if (hideSet.indexOf(k) < 0) hideSet.push(k); }
          else if (/\bshow\b/.test(c) || /\bkeep\b/.test(c) || /\bunhide\b/.test(c)) { if (showSet.indexOf(k) < 0) showSet.push(k); }
        });
      });
      if (hideSet.length || showSet.length) {
        var cur = state.profile ? (parseThemeClient(state.profile.profile_theme).hide_sections || []) : [];
        var next = cur.filter(function (k) { return showSet.indexOf(k) < 0; });
        hideSet.forEach(function (k) { if (next.indexOf(k) < 0) next.push(k); });
        changes.hide_sections = next;
        hideSet.forEach(function (k) { understood.push("Hide " + SECTION_HIDE_LABELS[k]); });
        showSet.forEach(function (k) { understood.push("Show " + SECTION_HIDE_LABELS[k]); });
      }
    }
    // — Video opposite the buttons (automatic in the layout) —
    if (has(/video.*opposite|opposite.*video/)) understood.push("Video sits opposite the buttons — automatic");
    // — Honesty: which clauses had no known keyword at all —
    var known = ["button", "arcade", "insert coin", "bitcoin", "btc", "ticker", "pixel", "neon", "round", "glow", "bubble", "vapor", "retro", "classic", "hide", "show", "top friend", "top 8", "relationship", "link", "occupation", "video", "radio", "about", "comment", "seller", "buyer", "left", "right", "opposite", "contact"];
    raw.split(/[,;.]+|\band\b|\bthen\b/i).forEach(function (clause) {
      var c = clause.trim().toLowerCase();
      if (!c) return;
      if (!known.some(function (w) { return c.indexOf(w) >= 0; })) missed.push(clause.trim());
    });
    state.builderPending = changes;
    state.builderUnderstood = understood;
    var host = $("dwc-builder-result");
    var applyRow = $("dwc-builder-apply-row");
    if (!host) return;
    if (!raw.trim()) {
      host.innerHTML = '<p class="dwc-info">Type what you want in the box first — e.g. “buttons on the right, arcade buttons, bitcoin ticker”.</p>';
      if (applyRow) applyRow.hidden = true;
      return;
    }
    var html = "";
    if (understood.length) {
      html += '<p class="dwc-info">🍬 Got it — here\u2019s what I\u2019ll set:</p><ul class="dwc-list">' +
        understood.map(function (u) { return "<li>✓ " + esc(u) + "</li>"; }).join("") + "</ul>";
    } else {
      html += '<p class="dwc-info">Hmm — I didn\u2019t match anything in that. Try words I know: buttons, arcade, bitcoin, top friends, links, videos…</p>';
    }
    if (missed.length) {
      html += '<p class="dwc-info">⚠️ I didn\u2019t understand this part, so I\u2019m leaving it alone: “' + esc(missed.join("; ")) + '”. Everything above still applies.</p>';
    }
    if (understood.length) {
      var cur = state.profile || {};
      var curTh = parseThemeClient(cur.profile_theme);
      var merged = Object.assign({}, curTh, changes);
      var fake = Object.assign({}, cur, { is_mine: true, profile_theme: JSON.stringify(merged) });
      html += '<h4 style="margin:10px 0 6px">Preview — your page with these settings</h4><div class="dwc-builder-preview">' + layoutPreviewInnerHTML(fake) + "</div>";
    }
    host.innerHTML = html;
    if (applyRow) applyRow.hidden = !understood.length;
    if (understood.length && changes.ticker_source === "btc") refreshBtcTicker();
  },
  // Apply the builder's settings into the form (visible in the preview
  // above). Nothing is persisted until the member hits Save profile.
  applyProfileBuilder: function () {
    var changes = state.builderPending || {};
    if (!Object.keys(changes).length) return;
    var form = document.querySelector("#dwc-account form");
    if (!form) return;
    var setVal = function (name, val) { var el = form.querySelector('[name="' + name + '"]'); if (el) el.value = val; };
    var setCheck = function (name, val) { var el = form.querySelector('[name="' + name + '"]'); if (el) el.checked = !!val; };
    if (changes.buttons_side) DWC.applyButtonsSide(changes.buttons_side);
    if (typeof changes.buttons_show === "boolean") setCheck("theme_buttons_show", changes.buttons_show);
    if (changes.button_style) {
      setVal("theme_button_style", changes.button_style);
      form.querySelectorAll('[onclick^="DWC.applyButtonStyle"]').forEach(function (p) {
        p.classList.toggle("active", p.getAttribute("onclick").indexOf("'" + changes.button_style + "'") >= 0);
      });
    }
    if (changes.ticker_source) setVal("theme_ticker_source", changes.ticker_source);
    if (typeof changes.ticker_enabled === "boolean") setCheck("theme_ticker_enabled", changes.ticker_enabled);
    if (changes.hide_sections) {
      form.querySelectorAll('input[name="theme_hide_sections"]').forEach(function (box) {
        box.checked = changes.hide_sections.indexOf(box.value) >= 0;
      });
    }
    DWC.refreshLayoutPreview();
    DWC.profileFormDirty();
    setNotice("Taffy's settings are in the form — check the preview, then hit Save profile to keep them.");
  },
  // Re-render the Live preview from the CURRENT form values — vibe,
  // accent, website look, every show/hide box, buttons side, video —
  // so any form change shows up right away. Mirrors the profile page:
  // layout CSS first, then the theme (pickers win), so the preview shows
  // exactly what visitors will see after Save.
  refreshLayoutPreview: function () {
    var host = $("dwc-layout-preview");
    var form = document.querySelector("#dwc-account form");
    if (!host || !form || !state.profile) return;
    var fd = new FormData(form);
    var get = function (n) { return String(fd.get(n) || ""); };
    var hexOk = function (v) { return /^#[0-9a-fA-F]{6}$/.test(String(v || "").trim()) ? String(v).trim() : ""; };
    // Start from the saved theme, then overlay every form value — same
    // fields saveProfile reads, so preview and save can never drift.
    var th = parseThemeClient(state.profile.profile_theme);
    var vibeId = get("theme_vibe");
    th.vibe = (vibeId && LAYOUT_VIBES[vibeId]) ? vibeId : "";
    th.bg_color = fd.get("theme_bg_use") ? hexOk(get("theme_bg_color")) : "";
    var bgImg = get("theme_bg_image").trim().slice(0, 500);
    th.bg_image_url = /^https:\/\//i.test(bgImg) ? bgImg : "";
    th.text_color = fd.get("theme_text_use") ? hexOk(get("theme_text_color")) : "";
    th.accent_color = fd.get("theme_accent_use") ? hexOk(get("theme_accent_color")) : "";
    var fontSel = get("theme_font");
    th.font = themeFontCSS(fontSel) ? fontSel : "";
    var nameFontSel = get("theme_name_font");
    th.name_font = themeFontCSS(nameFontSel) ? nameFontSel : "";
    // Font glow (v3.19) — same fields saveProfile reads, so preview and
    // save can never drift.
    th.glow = !!fd.get("theme_glow");
    th.glow_color = th.glow ? (hexOk(get("theme_glow_color")) || "#00e5ff") : "";
    th.outline_color = th.glow ? (hexOk(get("theme_outline_color")) || "#000000") : "";
    // Member page layout (v3.20) — same fields saveProfile reads.
    var tfCount2 = parseInt(String(get("theme_topfriends_count") || ""), 10);
    th.topfriends_count = [3, 4, 5, 8, 10].indexOf(tfCount2) >= 0 ? tfCount2 : 8;
    th.topfriends_side = (get("theme_topfriends_side") === "left") ? "left" : "";
    var feedPriv2 = get("theme_feed_privacy");
    th.feed_privacy = ["public", "friends", "private"].indexOf(feedPriv2) >= 0 ? feedPriv2 : "public";
    var divId2 = get("theme_divider");
    th.divider = DIVIDERS[divId2] ? divId2 : "";
    th.divider_color = hexOk(get("theme_divider_color"));
    var btnStyle = get("theme_button_style");
    th.button_style = BUTTON_STYLES[btnStyle] ? btnStyle : "";
    th.button_css = get("theme_button_css").slice(0, 4000);
    th.effects = fd.getAll ? fd.getAll("theme_effects").filter(function (e) { return MYSPACE_EFFECTS[e]; }).slice(0, 8) : [];
    var bgPreset = get("theme_bg_preset");
    th.bg_preset = PRESET_BACKGROUNDS.some(function (pr) { return pr.id === bgPreset; }) ? bgPreset : "";
    // Same either/or rule as saveProfile, so the live preview and the
    // save can never disagree.
    if (th.effects.indexOf("animated-bg") >= 0) {
      th.bg_preset = "";
      th.bg_image_url = "";
    } else if (th.bg_image_url) {
      th.bg_preset = "";
    }
    if (th.effects.indexOf("rgb-comment-border") >= 0) th.comment_border_color = "";
    else if (fd.get("theme_comment_border_use")) th.comment_border_color = hexOk(get("theme_comment_border_color")) || "#000000";
    else th.comment_border_color = "";
    var picSize = get("theme_pic_size");
    th.pic_size = (picSize === "bigger" || picSize === "smaller") ? picSize : "";
    var picPos = get("theme_pic_position");
    th.pic_position = (picPos === "normal" || picPos === "top") ? picPos : "";
    var picFrame = get("theme_pic_frame");
    th.pic_frame = PIC_FRAMES.some(function (f) { return f.id === picFrame; }) ? picFrame : "";
    th.blood_color = hexOk(get("theme_blood_color"));
    var gbMode = get("theme_gb_mode");
    th.gb_mode = GB_FRAME_MODES.some(function (gm) { return gm.id === gbMode; }) ? gbMode : "";
    th.gb_colors = [0, 1, 2].map(function (i) { return hexOk(get("theme_gb_color_" + i)); }).filter(Boolean);
    var btnSide = get("theme_buttons_side");
    th.buttons_side = (btnSide === "right") ? "right" : "";
    // v3.21 — Buttons group fields, same reads as saveProfile.
    var btnSize = get("theme_button_size");
    th.button_size = (btnSize === "s" || btnSize === "l" || btnSize === "xl") ? btnSize : "";
    var visChecked = fd.getAll ? fd.getAll("theme_buttons_visible") : [];
    th.buttons_visible = visChecked.length ? visChecked.filter(function (k) { return ["add", "message", "favorite", "group", "subscribe"].indexOf(k) >= 0; }) : null;
    var proSide = get("theme_pro_button_side");
    th.pro_button_side = (proSide === "center" || proSide === "right") ? proSide : "";
    var proCol = (get("theme_pro_button_color") || "").trim();
    th.pro_button_color = /^#[0-9a-fA-F]{6}$/.test(proCol) ? proCol : "";
    th.buttons_show = !!fd.get("theme_buttons_show");
    // Website look (v3.20) — same field saveProfile reads.
    th.website_buttons = !!fd.get("theme_website_buttons");
    th.custom_page_html = sanitizeCustomPageHtml(get("custom_page_html"));
    var vidUrl = get("theme_video_url").trim().slice(0, 500);
    th.video_url = extractYouTubeId(vidUrl) ? vidUrl : "";
    th.video_file_url = get("theme_video_file_url").trim().slice(0, 500);
    // Video size + centering + stretch + cover (v3.22) — same fields
    // saveProfile reads, so the preview and the save can never drift.
    var vidSize2 = get("theme_video_size");
    th.video_size = (vidSize2 === "s" || vidSize2 === "l" || vidSize2 === "stretch") ? vidSize2 : "";
    th.video_align = (get("theme_video_align") === "center") ? "center" : "";
    var covSize2 = get("theme_cover_size");
    th.cover_size = (covSize2 === "big") ? "big" : "";
    var covName2 = get("theme_cover_name");
    th.cover_name = (covName2 === "left" || covName2 === "right") ? covName2 : "";
    var tickSrc = get("theme_ticker_source");
    th.ticker_source = (tickSrc === "btc") ? "btc" : "";
    th.hide_sections = fd.getAll ? fd.getAll("theme_hide_sections").filter(function (k) { return SECTION_HIDE_IDS.indexOf(k) >= 0; }).slice(0, 10) : [];
    var dbPicked = [get("theme_display_badge_1"), get("theme_display_badge_2")].filter(function (k) { return BADGES.some(function (b) { return b.key === k; }); });
    if (dbPicked.length) th.display_badges = dbPicked;
    // Links + Top Friends, straight from the form editors.
    var linkLabels = form.querySelectorAll('input[name="link_label"]');
    var linkUrls = form.querySelectorAll('input[name="link_url"]');
    var links = [];
    for (var li = 0; li < linkLabels.length && li < linkUrls.length; li++) {
      var ll = String(linkLabels[li].value || "").trim();
      var lu = String(linkUrls[li].value || "").trim();
      if (ll || lu) links.push({ label: ll, url: lu });
    }
    var tfIds = [];
    form.querySelectorAll('input[name="top_friend"]:checked').forEach(function (cb) {
      var n = parseInt(cb.value, 10);
      if (n > 0 && tfIds.indexOf(n) === -1) tfIds.push(n);
    });
    // Per-button look (v3.22) — same reads as saveProfile, so the live
    // preview shows each button's own font / size / shape as the member
    // changes it. The fake profile carries the parsed object (not the
    // JSON string), like shapeMember returns on the live page.
    var pbPrev = { mode: "buttons", image_url: "", buttons: {} };
    var pbModeEl = form.querySelector('input[name="pb_mode"]:checked');
    if (pbModeEl && pbModeEl.value === "image") pbPrev.mode = "image";
    pbPrev.image_url = get("pb_image_url").trim().slice(0, 500);
    ["add", "message", "favorite", "group"].forEach(function (key) {
      var pbLabel = get("pb_label_" + key).trim().slice(0, 30);
      var pbBg = fd.get("pb_bg_use_" + key) ? get("pb_bg_" + key).trim() : "";
      var pbColor = fd.get("pb_color_use_" + key) ? get("pb_color_" + key).trim() : "";
      var pbFont = get("pb_font_" + key).trim();
      var pbSize = get("pb_size_" + key).trim();
      var pbRadius = get("pb_radius_" + key).trim();
      if (pbLabel || pbBg || pbColor || pbFont || pbSize || pbRadius) pbPrev.buttons[key] = { label: pbLabel, bg: pbBg, color: pbColor, font: pbFont, size: pbSize, radius: pbRadius };
    });
    var fake = Object.assign({}, state.profile, {
      is_mine: true,
      profile_theme: JSON.stringify(th),
      profile_buttons: pbPrev,
      page_slug: get("page_slug"),
      ticker_text: get("ticker_text"),
      ticker_enabled: !!fd.get("ticker_enabled"),
      ticker_color: get("ticker_color") || state.profile.ticker_color,
      bio: get("bio"),
      occupation: get("occupation"),
      website_mode: !!fd.get("website_mode"),
      hobbies: get("hobbies"),
      workplace: get("workplace"),
      relationship_status: get("relationship_status"),
      birthsign: get("birthsign"),
      accomplishments: get("accomplishments"),
      website_show: {
        hobbies: !!fd.get("website_show_hobbies"),
        workplace: !!fd.get("website_show_workplace"),
        relationship: !!fd.get("website_show_relationship"),
        sign: !!fd.get("website_show_sign"),
        accomplishments: !!fd.get("website_show_accomplishments")
      },
      my_links: links,
      top_friend_ids: tfIds
    });
    host.innerHTML = layoutPreviewInnerHTML(fake);
    // Layout CSS first, then the theme — same order as the profile page.
    applyPreviewCSS(get("layout_css"));
    var tst = document.getElementById("dwc-layout-preview-theme");
    if (!tst) {
      tst = document.createElement("style");
      tst.id = "dwc-layout-preview-theme";
    }
    tst.textContent = themeCSS(th);
    document.head.appendChild(tst); // re-append keeps it AFTER the layout CSS
    // Load the webfonts this preview actually uses, so the sample + the
    // big preview below show the real fonts, not the fallbacks.
    ensureProfileFonts(th);
    // Font glow on the samples (v3.19) — same colors as the page glow,
    // cleared when the box is unticked.
    var glowOn = !!th.glow;
    var gCol = th.glow_color || "#00e5ff";
    var oCol = th.outline_color || "#000000";
    var nfSample = document.getElementById("dwc-font-sample-name");
    if (nfSample) {
      nfSample.style.fontFamily = themeFontCSS(th.name_font) || "";
      nfSample.style.textShadow = glowOn ? ("0 0 6px " + gCol + ",0 0 16px " + gCol) : "";
      nfSample.style.webkitTextStroke = glowOn ? ("1px " + oCol) : "";
      nfSample.style.paintOrder = glowOn ? "stroke fill" : "";
    }
    var bfSample = document.getElementById("dwc-font-sample-body");
    if (bfSample) {
      bfSample.style.fontFamily = themeFontCSS(th.font) || "";
      bfSample.style.textShadow = glowOn ? ("0 0 6px " + gCol + ",0 0 16px " + gCol) : "";
      bfSample.style.webkitTextStroke = glowOn ? ("1px " + oCol) : "";
      bfSample.style.paintOrder = glowOn ? "stroke fill" : "";
    }
    if (th.ticker_source === "btc") refreshBtcTicker();
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
  openIM: function (id, username, draft) {
    if (!state.profile) { setNotice("Create your account first — IMs are for members."); DWC.openSignup(); return; }
    if (state.profile && id === state.profile.id) return;
    if (draft) state.pendingIMDraft = { id: id, body: String(draft) };
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

  // ---------- Profile action buttons (v3.6) ----------
  // Add me / Unfriend — one click = friends (instant, no approval).
  // Refreshes just the button block so the label flips in place.
  toggleFriend: async function (id) {
    if (!state.profile) { setNotice("Create your account first — friends are for members."); DWC.openSignup(); return; }
    var m = state.viewingMember;
    if (!m || m.id !== id) return;
    var action = m.is_friend ? "remove" : "add";
    var data = await apiPost("/friends", { device_id: deviceId(), friend_id: id, action: action });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't update that friendship."); return; }
    m.is_friend = !!data.is_friend;
    setNotice(data.is_friend ? "You're friends now — welcome to the crew." : "Unfriended. No hard feelings.");
    await refreshActionButtons(id);
  },
  // Add to Favorites — the star. Toggles the favorite on/off; the star
  // fills gold when favorited, goes back to an outline when it's not.
  toggleFavorite: async function (id) {
    if (!state.profile) { setNotice("Create your account first — favorites are for members."); DWC.openSignup(); return; }
    var m = state.viewingMember;
    if (!m || m.id !== id) return;
    var action = m.is_favorite ? "remove" : "add";
    var data = await apiPost("/favorites", { device_id: deviceId(), favorite_id: id, action: action });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't update that favorite."); return; }
    m.is_favorite = !!data.is_favorite;
    setNotice(data.is_favorite ? "⭐ Favorited — they're starred now." : "Star removed.");
    await refreshActionButtons(id);
  },
  // Add to group — an inline picker under the buttons listing MY groups
  // with Add/Remove per group, plus a create-a-group field. If I own no
  // groups, the panel is just the create field.
  toggleGroupPanel: async function (memberId) {
    if (!state.profile) { setNotice("Create your account first — groups are for members."); DWC.openSignup(); return; }
    var panel = document.getElementById("dwc-group-picker");
    if (!panel) return;
    if (panel.innerHTML.trim()) { panel.innerHTML = ""; return; }
    panel.innerHTML = '<p style="color:var(--muted)">Loading your groups…</p>';
    var data = await apiGet("/groups?device_id=" + encodeURIComponent(deviceId()));
    var groups = (data && data.groups) || [];
    var m = state.viewingMember;
    var name = m ? m.username : "them";
    var html = '<div class="dwc-group-picker"><h4 style="margin:0 0 8px">👥 Add @' + esc(name) + ' to a group</h4>';
    if (!groups.length) {
      html += '<p style="color:var(--muted);margin:0 0 8px">You don’t have any groups yet — make your first one:</p>';
    } else {
      html += groups.map(function (g) {
        var inGroup = (g.member_ids || []).indexOf(memberId) >= 0;
        return '<div class="dwc-group-row"><span>' + esc(g.name) + '</span>' +
          '<button type="button" class="btn ' + (inGroup ? "ghost " : "") + 'small" onclick="DWC.toggleGroupMember(' + g.id + ", " + memberId + ", '" + (inGroup ? "remove" : "add") + "')\">" +
          (inGroup ? "Remove" : "Add") + "</button></div>";
      }).join("");
    }
    html += '<div class="dwc-group-create"><input id="dwc-new-group-name" maxlength="40" placeholder="New group name — e.g. My crew">' +
      '<button type="button" class="btn small" onclick="DWC.createGroup(' + memberId + ')">+ Create group</button></div>' +
      '<p style="margin:8px 0 0"><button type="button" class="btn ghost small" onclick="DWC.toggleGroupPanel(' + memberId + ')">Done</button></p></div>';
    panel.innerHTML = html;
  },
  createGroup: async function (memberId) {
    var input = document.getElementById("dwc-new-group-name");
    var name = input ? String(input.value || "").trim() : "";
    if (!name) { setNotice("Give the group a name first."); return; }
    var data = await apiPost("/groups", { device_id: deviceId(), name: name });
    if (!data || !data.ok || !data.group) { setNotice((data && data.error) || "Couldn't create that group."); return; }
    // New group, and the member goes straight in — that's why it's open.
    var added = await apiPost("/groups", { device_id: deviceId(), group_id: data.group.id, member_id: memberId, action: "add" });
    if (!added || !added.ok) { setNotice((added && added.error) || "Group made, but they didn't get added — try again."); }
    else setNotice("Group “" + data.group.name + "” made, and @" + (state.viewingMember ? state.viewingMember.username : "them") + " is in it.");
    DWC.toggleGroupPanel(memberId);
    DWC.toggleGroupPanel(memberId);
  },
  toggleGroupMember: async function (groupId, memberId, action) {
    var data = await apiPost("/groups", { device_id: deviceId(), group_id: groupId, member_id: memberId, action: action });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't update that group."); return; }
    setNotice(action === "add" ? "Added to the group." : "Removed from the group.");
    // Re-open the picker with fresh data (toggle twice: close, then open).
    DWC.toggleGroupPanel(memberId);
    DWC.toggleGroupPanel(memberId);
  },
  // Page URL appeal (v3.6) — when the 3-change limit or the 1-year
  // cooldown blocks a new slug, the member appeals to Chris. Filed as a
  // 'slug_appeal' report so it lands in the operator's Reports inbox.
  appealSlug: async function () {
    if (!state.profile) { setNotice("Create your account first."); DWC.openSignup(); return; }
    var wanted = prompt("What page URL do you want? (3–24 letters, numbers, _ . or -)");
    if (wanted === null) return;
    wanted = String(wanted || "").trim();
    if (!wanted) return;
    var data = await apiPost("/reports", { device_id: deviceId(), target_type: "slug_appeal", target_id: state.profile.id, reason: wanted });
    if (data && data.ok) setNotice("Appeal sent — Chris reviews page URL appeals himself. He'll let you know.");
    else if (data && data.error) setNotice(data.error);
  },
  // Copy the vanity page URL (full link) to the clipboard.
  copyVanityUrl: function (slug) {
    var url = "https://rarecandyreserve.org/community.html#/u/" + slug;
    var done = function () { setNotice("Copied — " + url); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { setNotice("Copy didn't work — the link is: " + url); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { setNotice("Copy didn't work — the link is: " + url); }
      document.body.removeChild(ta);
    }
  },
  // My Code — copy the member's own hand-written CSS out of the box.
  copyMyCode: function () {
    var ta = document.querySelector('textarea[name="layout_css"]');
    var css = ta ? ta.value : "";
    if (!css.trim()) { setNotice("Your My Code box is empty — nothing to copy yet."); return; }
    var done = function () { setNotice("Copied your code — paste it anywhere, it's yours."); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(css).then(done, function () { setNotice("Copy didn't work — select the text in the box and copy it by hand."); });
    } else {
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { setNotice("Copy didn't work — select the text in the box and copy it by hand."); }
    }
  },

  // ---------- Steady Wave player ----------
  // Browsers block autoplay WITH SOUND until the visitor interacts, so
  // the <audio autoplay> alone never starts the music. playVNR() is the
  // explicit tap-to-play button; armVNRAutoplay() starts the stream on
  // the visitor's FIRST tap/click/scroll/keypress anywhere on the page
  // (a real user gesture, which browsers allow).
  playVNR: function () {
    var a = document.getElementById("dwc-vnr-audio");
    if (!a) return;
    var p = a.play();
    if (p && p.catch) p.catch(function () {});
  },
  armVNRAutoplay: function () {
    var a = document.getElementById("dwc-vnr-audio");
    if (!a || a.dataset.vnrArmed) return;
    a.dataset.vnrArmed = "1";
    var kick = function () { DWC.playVNR(); };
    ["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (ev) {
      document.addEventListener(ev, kick, { once: true, passive: true });
    });
  },
  // ---------- v3.10 profile video — click-to-play only ----------
  // A profile video never autoplays. Tapping the facade swaps the real
  // player in: a privacy-enhanced YouTube embed (autoplay=1, because
  // the tap IS the gesture) or the uploaded clip with controls.
  playProfileVideo: function (facade, kind, ref) {
    if (!facade) return;
    if (kind === "yt") {
      facade.outerHTML = '<div class="dwc-ytview"><iframe src="https://www.youtube-nocookie.com/embed/' + ref + '?autoplay=1" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>';
    } else {
      var url = decodeURIComponent(ref || "");
      facade.outerHTML = '<video controls autoplay playsinline preload="metadata" src="' + esc(url) + '" style="width:100%;border-radius:10px;background:#000"></video>';
    }
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
    state.phone.open = true; // a deep-link to an app opens the phone
    state.phone.app = app;
    if (app === "msg") loadPhoneMsgList();
    if (app === "alerts") loadPhoneAlerts();
    if (app === "notes") loadPhoneNotes();
    if (app === "store" && !state.lucre) loadLucre();
    if (app === "gallery") DWC.refreshGalleryCount();
    renderPhone();
  },
  // Lucre (v3.11) — weekly check-in from the wallet on the home page.
  lucreCheckin: async function () {
    if (!state.profile) return;
    var data = await apiPost("/lucre", { device_id: deviceId(), action: "checkin" });
    if (!data) return;
    if (!data.ok) { setNotice(data.error || "Check-in didn't go through — try again."); return; }
    await loadLucre();
    setNotice(data.bonus_paid ? "Checked in! +5 " + LUCRE_SYMBOL + " — and a 50 " + LUCRE_SYMBOL + " streak bonus for 7 weeks in a row! 🔥" : "Checked in! +5 " + LUCRE_SYMBOL + " — see you next week.");
  },
  // Layout Store (v3.11) — filter, preview, apply, buy, revert.
  storeFilter: function (f) {
    state.storeFilter = f;
    renderPhone();
  },
  storePreview: function (id) {
    state.storePreview = id || null;
    renderPhone();
  },
  // Apply a store layout to YOUR profile page. Free layouts apply
  // straight away; priced ones are bought first (server price, never
  // the client's). The POST echoes the profile fields the server
  // rewrites (chat_name, occupation, bio, payout) so nothing is lost,
  // and sends the full merged theme so one setting never resets another.
  storeApply: async function (id) {
    var item = storeItemById(id);
    if (!item || !state.profile || state.storeApplying) return;
    state.storeApplying = id;
    renderPhone();
    try {
      var owned = storeOwnedIds();
      if (item.price > 0 && owned.indexOf(id) < 0) {
        var buy = await apiPost("/lucre", { device_id: deviceId(), action: "purchase", item_id: id });
        if (!buy || !buy.ok) {
          setNotice(buy && buy.error ? buy.error : "That purchase didn't go through — try again.");
          state.storeApplying = null; renderPhone(); return;
        }
        state.lucre = state.lucre || { balance: 0, ledger: [], checkin: null, owned: [] };
        state.lucre.balance = buy.balance;
        state.lucre.owned = buy.owned || owned.concat([id]);
      }
      // Re-fetch first (v3.20) — the merge must start from fresh
      // saved settings, or a stale in-memory copy can resurrect a
      // preset the member already turned off.
      await refreshProfile();
      var p = state.profile;
      var merged = storeMergedTheme(item);
      // A website template turns Website look ON and fills in the
      // member's name where the template says {{name}}.
      if (item.website) {
        merged.custom_page_html = String(merged.custom_page_html || "").split("{{name}}").join(p.username || "Your name");
      }
      var data = await apiPost("/profile", {
        device_id: deviceId(),
        username: p.username, chat_name: p.chat_name || "", occupation: p.occupation || "",
        bio: p.bio || "", payout_method: p.payout_method || "", payout_handle: p.payout_handle || "",
        website_mode: item.website ? true : !!p.website_mode,
        layout_preset: item.id, layout_css: item.css, profile_theme: JSON.stringify(merged),
      });
      if (!data || !data.ok) {
        setNotice(data && data.error ? data.error : "That layout didn't apply — try again.");
      } else {
        await refreshProfile();
        await loadLucre();
        state.storePreview = null;
        setNotice("“" + item.name + "” is live on your page! 🎨");
        render();
      }
    } finally {
      state.storeApplying = null;
      if (state.phone.open && state.phone.app === "store") renderPhone();
    }
  },
  // Copy a layout's short code so a member can share it with a friend.
  copyLayoutCode: function (id) {
    var item = storeItemById(id);
    if (!item || !item.code) { setNotice("That layout has no code yet."); return; }
    var done = function () { setNotice("Copied — code " + item.code + " for “" + item.name + "”. Paste it in the code box to use it."); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(item.code).then(done, function () { setNotice("Copy didn't work — the code is: " + item.code); });
    } else {
      setNotice("Copy didn't work — the code is: " + item.code);
    }
  },
  // Use a layout code — find the layout (shop preset or a member's
  // published one) and open its preview, so the member can Apply it.
  applyLayoutCode: function () {
    var input = document.getElementById("dwc-layout-code");
    var code = (input ? input.value : "").trim().toUpperCase();
    if (!code) { setNotice("Paste a layout code first — every layout in the store shows its code."); return; }
    var found = null;
    LAYOUT_STORE.concat(state.userLayouts || []).forEach(function (x) { if ((x.code || "").toUpperCase() === code) found = x; });
    if (!found) { setNotice("No layout with the code “" + code + "” — check the code and try again."); return; }
    DWC.storePreview(found.id);
    setNotice("Found “" + found.name + "” — preview it, then Apply.");
  },
  // Publish the My Code box's CSS as a free layout in the store, with
  // the member's name on it. The theme saved is their saved look; the
  // CSS is whatever is in the box right now.
  publishLayout: async function () {
    if (!state.profile) return;
    var ta = document.querySelector('textarea[name="layout_css"]');
    var css = ta ? ta.value : "";
    var nameEl = document.getElementById("dwc-publish-name");
    var descEl = document.getElementById("dwc-publish-desc");
    var name = (nameEl ? nameEl.value : "").trim();
    var desc = (descEl ? descEl.value : "").trim();
    if (!css.trim()) { setNotice("Your My Code box is empty — write or paste some CSS first, then publish it."); return; }
    if (!name) { setNotice("Give your layout a name first."); return; }
    var data = await apiPost("/layouts", { device_id: deviceId(), action: "publish", name: name, description: desc, css: css, theme_json: state.profile.profile_theme || "" });
    if (!data || !data.ok) { setNotice(data && data.error ? data.error : "That layout didn't publish — try again."); return; }
    if (nameEl) nameEl.value = "";
    if (descEl) descEl.value = "";
    await loadUserLayouts();
    setNotice("“" + name + "” is in the Layout Store — free for everyone, with your name on it. Its code is " + (data.code || "") + ".");
  },
  // Take one of my published layouts out of the store.
  unpublishLayout: async function (id) {
    if (!state.profile) return;
    var num = String(id || "").replace(/^user:/, "");
    var data = await apiPost("/layouts", { device_id: deviceId(), action: "unpublish", id: Number(num) });
    if (!data || !data.ok) { setNotice(data && data.error ? data.error : "Couldn't take that layout down — try again."); return; }
    await loadUserLayouts();
    setNotice("That layout is out of the store.");
  },
  // Back to my own look — clears the store layout (preset + CSS) and
  // keeps the member's own theme exactly as it was.
  storeRevert: async function () {
    if (!state.profile) return;
    var p = state.profile;
    var data = await apiPost("/profile", {
      device_id: deviceId(),
      username: p.username, chat_name: p.chat_name || "", occupation: p.occupation || "",
      bio: p.bio || "", payout_method: p.payout_method || "", payout_handle: p.payout_handle || "",
      layout_preset: "", layout_css: "",
    });
    if (!data || !data.ok) { setNotice(data && data.error ? data.error : "Couldn't switch back — try again."); return; }
    await refreshProfile();
    setNotice("Back to your own look — the store layout is off.");
    render();
  },
  // First radio listen (v3.11) — 10 Lucre, once ever. Fires on the
  // phone radio's first play; the server key makes repeats a no-op.
  phoneRadioFirst: async function () {
    if (!state.profile) return;
    var d = await apiPost("/lucre", { device_id: deviceId(), action: "radio-first" });
    if (d && d.ok && d.awarded) {
      if (state.lucre) {
        state.lucre.balance = d.balance;
        // The wallet shows the balance — swap it now, or the +10 only
        // appears after the next reload (same pattern as copyLink).
        var w = document.getElementById("dwc-lucre-wallet");
        if (w) w.outerHTML = lucreWalletHTML();
        if (state.phone.open && (state.phone.app === "store" || state.phone.app === "badges")) renderPhone();
      }
      setNotice("First radio listen! +10 " + LUCRE_SYMBOL + " — welcome to Steady Wave. 📻");
    }
  },
  // Alerts app (v3.8) — tap an alert: mark it read, close the phone,
  // and jump to what it points at.
  phoneAlertOpen: function (id, link) {
    if (state.profile) {
      apiPost("/notifications", { device_id: deviceId(), action: "read", id: id });
      if (state.phoneAlertsList) {
        state.phoneAlertsList.forEach(function (n) { if (n.id === id) n.read = true; });
      }
    }
    state.phone.open = false;
    renderPhone();
    if (link) location.hash = link;
  },
  phoneAlertsMarkAll: function () {
    if (!state.profile) return;
    apiPost("/notifications", { device_id: deviceId(), action: "read_all" }).then(function () {
      loadPhoneAlerts();
    });
  },
  // Sound toggle (v3.17) — same key the header bell uses, so one switch
  // controls the coin ding everywhere. Re-renders the Alerts app so the
  // button label flips right away.
  phoneAlertsSoundToggle: function () {
    try { localStorage.setItem("dwc-notif-sound", phoneNotifSoundOn() ? "off" : "on"); } catch (e) {}
    renderPhone();
  },
  phoneWallpaper: function (id) {
    state.phone.wallpaper = id;
    savePhoneWallpaper(id);
    renderPhone();
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
    if (reply.working && tw) tw.classList.add("taffy-working");
    var delay = 650 + Math.floor(Math.random() * 650);
    setTimeout(function () {
      var t = document.getElementById(typingId);
      if (t) t.remove();
      if (reply.working && tw) tw.classList.remove("taffy-working");
      // Only append if the chat log is still on screen (user may have
      // navigated away mid-thought — the message still lands in state).
      if (document.getElementById("tp-chat-log")) phoneChatAdd("taffy", reply.text, reply.emoji, reply.css, reply.html, reply.human);
      else {
        state.phoneChat.push({ who: "taffy", text: reply.text, emoji: reply.emoji || "", css: reply.css || "", html: reply.html || "", human: !!reply.human });
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
  // Button style picker — sets the hidden theme_button_style field and
  // marks the picked pill active. Saved with the rest of the profile.
  // Taffy "Apply this to my layout" — drops the snippet Taffy just gave
  // into the My Code box in Edit Profile and updates the live preview.
  // Guests get sent to create an account first (layouts live on a profile).
  taffyApplyCSS: function (idx) {
    var m = state.phoneChat[idx];
    var css = m && m.css;
    if (!css) return;
    if (!state.profile) {
      DWC.phoneMinimize();
      DWC.openSignup();
      setNotice("Create your account first — layouts live on your profile, then Taffy can apply them for you.");
      return;
    }
    DWC.phoneMinimize();
    DWC.editProfile();
    setTimeout(function () {
      var ta = document.querySelector('textarea[name="layout_css"]');
      if (!ta) { setNotice("Open Edit profile and paste this into My Code."); return; }
      var cur = ta.value || "";
      if (cur && cur.slice(-1) !== "\n") cur += "\n";
      ta.value = cur + css + "\n";
      if (typeof DWC.layoutCssEdited === "function") DWC.layoutCssEdited(ta);
      ta.scrollIntoView({ behavior: "smooth", block: "center" });
      ta.focus();
      setNotice("Added to your My Code — hit Save profile to keep it.");
    }, 150);
  },
  applyButtonStyle: function (id, btn) {
    var form = btn ? btn.closest("form") : null;
    if (!form) return;
    var hidden = form.querySelector('input[name="theme_button_style"]');
    if (hidden) hidden.value = id || "";
    var pills = form.querySelectorAll('[onclick^="DWC.applyButtonStyle"]');
    pills.forEach(function (p) { p.classList.remove("active"); });
    if (btn) btn.classList.add("active");
    DWC.refreshLayoutPreviewSoon();
  },
  phoneOpenEditor: function () {
    DWC.phoneMinimize();
    DWC.editProfile();
    // Land on the source code editor (My Code), not the top of the form.
    setTimeout(function () {
      var ta = document.querySelector('textarea[name="layout_css"]');
      if (ta) { ta.scrollIntoView({ behavior: "smooth", block: "center" }); ta.focus(); }
    }, 80);
  },
  phoneGalleryAdd: async function (input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    if (state.phoneGallery.length >= 6) { setNotice("The gallery holds 6 photos at a time — delete one first."); input.value = ""; return; }
    var img = await fileToImage(file, 1500000, { maxDim: 1600 });
    if (!img || img.error) { setNotice((img && img.error) || "That photo couldn't be read."); input.value = ""; return; }
    var item = { url: "data:" + img.mimeType + ";base64," + img.dataBase64, name: file.name || "photo", caption: "", timer: null, visibility: "private", uploading: false };
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
  // v3.21 — delete a gallery photo. One shared delete path: the ✕
  // button, the long-hold (mobile), and the drag-to-trash (desktop)
  // all come here, and all ask first — a gesture never deletes
  // silently. If the photo was published, the stored copy is deleted
  // too, and the "N of 20" count refreshes.
  phoneGalleryDel: async function (i) {
    DWC.phoneGalleryLongEnd(); // a pending long-hold must not fire after a ✕ tap
    var it = state.phoneGallery[i];
    if (!it) return;
    if (!window.confirm("Delete this photo?" + (it.publicId ? " It will also be removed from your profile's saved photos." : ""))) return;
    if (it.timer) clearTimeout(it.timer);
    if (it.publicId) {
      var data = await apiDelete("/gallery?id=" + it.publicId + "&device_id=" + encodeURIComponent(deviceId()));
      if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't delete that photo."); return; }
      DWC.refreshGalleryCount();
    }
    var idx = state.phoneGallery.indexOf(it);
    if (idx >= 0) state.phoneGallery.splice(idx, 1);
    if (state.phoneGalleryView === i) { state.phoneGalleryView = null; state.phone.app = "gallery"; }
    else if (state.phoneGalleryView != null && state.phoneGalleryView > idx) state.phoneGalleryView--;
    renderPhone();
  },
  // v3.21 — short description for a photo (140 chars max). Typed in
  // the detail view; saved with the photo when it is published, and
  // shown under it in the grid + the picture viewer. Not re-rendered
  // on every keystroke (that would steal focus) — the count line only.
  phoneGalleryCaption: function (i, v) {
    var it = state.phoneGallery[i];
    if (!it) return;
    it.caption = String(v || "").slice(0, 140);
    var c = document.querySelector(".tp-caption-count");
    if (c) c.textContent = it.caption.length + "/140";
  },
  // v3.21 — how many photos are stored on the profile right now.
  // GET /api/gallery returns total; a change re-renders the gallery
  // (the key only includes the count while the gallery is open).
  refreshGalleryCount: async function () {
    if (!state.profile) { state.galleryStoredCount = null; return; }
    try {
      // GET needs profile_id (the owner sees all rows, so total counts
      // every stored photo — exactly what the 20-photo cap counts).
      var data = await apiGet("/gallery?profile_id=" + state.profile.id + "&device_id=" + encodeURIComponent(deviceId()));
      var n = data && data.ok ? data.total : null;
      if (n == null && data && Array.isArray(data.photos)) n = data.photos.length;
      if (n != null && n !== state.galleryStoredCount) {
        state.galleryStoredCount = n;
        if (state.phone.app === "gallery") renderPhone();
      }
    } catch (e) { /* offline — the count line stays on "loading…" */ }
  },
  // v3.21 — long-hold on a photo (mobile/touch): hold ~600ms and the
  // delete confirm comes up. A quick tap or a scroll cancels it.
  phoneGalleryLongStart: function (i, el) {
    DWC.phoneGalleryLongEnd();
    var it = state.phoneGallery[i];
    if (!it) return;
    state.phoneGalleryLongTimer = setTimeout(function () {
      state.phoneGalleryLongFired = true;
      // Look the photo up by object, not by index — the grid may have
      // shifted since the hold started (a ✕ tap, a publish finishing).
      var idx = state.phoneGallery.indexOf(it);
      if (idx >= 0) DWC.phoneGalleryDel(idx);
    }, 600);
  },
  phoneGalleryLongEnd: function () {
    if (state.phoneGalleryLongTimer) { clearTimeout(state.phoneGalleryLongTimer); state.phoneGalleryLongTimer = null; }
    // The tap that ends a fired long-hold must not also open the photo.
    if (state.phoneGalleryLongFired) {
      state.phoneGalleryLongFired = false;
      state.phoneGallerySuppressClick = true;
      setTimeout(function () { state.phoneGallerySuppressClick = false; }, 50);
    }
  },
  // v3.21 — drag a photo to the trash can (desktop/mouse only; touch
  // dragging fights with scrolling, so mobile gets the long-hold).
  phoneGalleryDragStart: function (e, i) {
    state.phoneGalleryDragIndex = i;
    ensureTrashCan();
    var can = $("dwc-trashcan");
    if (can) can.classList.add("show");
    if (e && e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(i)); } catch (err) {} }
  },
  phoneGalleryDragEnd: function () {
    state.phoneGalleryDragIndex = null;
    var can = $("dwc-trashcan");
    if (can) can.classList.remove("show", "over");
  },
  phoneGalleryDropTrash: function () {
    var i = state.phoneGalleryDragIndex;
    DWC.phoneGalleryDragEnd();
    if (i == null) return;
    DWC.phoneGalleryDel(i);
  },
  // v3.21 — set this gallery photo as the profile picture. The photo
  // is published first if it is still session-only, then the avatar is
  // pointed at the stored gallery row (avatar_blob_key) via the
  // profile endpoint — the same place the avatar is saved everywhere
  // else, so it persists.
  phoneGallerySetAvatar: async function (i) {
    var it = state.phoneGallery[i];
    if (!it || !state.profile || it.uploading) return;
    if (!it.publicId) {
      await DWC.phoneGalleryPublish(i, it.visibility === "friends" ? "friends" : "public");
      it = state.phoneGallery[i];
      if (!it || !it.publicId) return;
    }
    var data = await apiPost("/profile", { device_id: deviceId(), avatar_gallery_id: it.publicId });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't set that as your profile picture."); return; }
    var avatarUrl = data.avatar_url || (data.profile && data.profile.avatar_url);
    if (avatarUrl) {
      state.profile.avatar_url = avatarUrl;
      var av = document.querySelector(".dwc-avatar");
      if (av && av.tagName === "IMG") av.src = avatarUrl;
    }
    setNotice("🖼️ That's your profile picture now.");
  },
  // Gallery visibility (v3.21) — per photo: Private / Public / Friends.
  // Private is session-only (nothing uploaded). Public / Friends upload
  // the photo (or update the one already up) and show a clear uploading
  // state while the file goes up — the candy loader + "Uploading…" text
  // so you can tell when it finished.
  phoneGallerySetVisibility: async function (i, vis) {
    var it = state.phoneGallery[i];
    if (!it || !state.profile) return;
    if (["private", "public", "friends"].indexOf(vis) < 0) vis = "private";
    if (vis === "private") {
      if (it.publicId) {
        var del = await apiDelete("/gallery?id=" + it.publicId + "&device_id=" + encodeURIComponent(deviceId()));
        if (!del || !del.ok) { setNotice((del && del.error) || "Couldn't take that photo down."); return; }
        it.publicId = null;
        DWC.refreshGalleryCount();
      }
      it.visibility = "private";
      setNotice("🔒 Private — only you can see it, here in your session gallery.");
      renderPhone();
      return;
    }
    if (it.publicId) {
      it.uploading = true;
      if (window.RCRloader) window.RCRloader.show();
      renderPhone();
      var upd = await apiPut("/gallery", { device_id: deviceId(), id: it.publicId, visibility: vis });
      it.uploading = false;
      if (window.RCRloader) window.RCRloader.hide();
      if (state.phoneGallery.indexOf(it) < 0) return;
      if (!upd || !upd.ok) { setNotice((upd && upd.error) || "Couldn't change that photo's visibility."); renderPhone(); return; }
      it.visibility = vis;
      setNotice(vis === "public" ? "🌍 Public ✓ — visitors can see it on your page." : "👥 Friends-only ✓ — only your friends can see it.");
      renderPhone();
      return;
    }
    DWC.phoneGalleryPublish(i, vis);
  },
  // v3.9 — upload a session phone photo to the gallery (R2) so it shows
  // in the picture viewer on your page (up to 20). The session copy
  // still vanishes after 10 minutes — the published copy stays until
  // you set it back to Private.
  phoneGalleryPublish: async function (i, vis) {
    var it = state.phoneGallery[i];
    if (!it || !state.profile) return;
    vis = vis === "friends" ? "friends" : "public";
    var m = /^data:([^;]+);base64,(.+)$/.exec(it.url || "");
    if (!m) { setNotice("That photo couldn't be read — add it again."); return; }
    it.uploading = true;
    if (window.RCRloader) window.RCRloader.show();
    renderPhone();
    var data = await apiPost("/gallery", { device_id: deviceId(), image: { dataBase64: m[2], mimeType: m[1] }, caption: (it.caption || "").slice(0, 140), visibility: vis });
    it.uploading = false;
    if (window.RCRloader) window.RCRloader.hide();
    if (state.phoneGallery.indexOf(it) < 0) return;
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't make that photo public."); renderPhone(); return; }
    it.publicId = data.photo && data.photo.id;
    it.visibility = (data.photo && data.photo.visibility) || vis;
    DWC.refreshGalleryCount();
    setNotice(vis === "public" ? "Uploaded ✓ — Public: visitors can scroll to it from your picture." : "Uploaded ✓ — Friends-only: only your friends can see it.");
    renderPhone();
  },
  phoneGalleryUnpublish: async function (i) {
    var it = state.phoneGallery[i];
    if (!it || !it.publicId) return;
    var data = await apiDelete("/gallery?id=" + it.publicId + "&device_id=" + encodeURIComponent(deviceId()));
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't take that photo down."); return; }
    it.publicId = null;
    DWC.refreshGalleryCount();
    setNotice("Taken down from your public gallery.");
    renderPhone();
  },
  phoneGalleryOpen: function (i) {
    if (!state.phoneGallery[i]) return;
    // v3.21 — a tap right after a fired long-hold is the end of the
    // hold, not a tap to open — ignore it.
    if (state.phoneGallerySuppressClick) return;
    state.phone.app = "gallery-photo";
    state.phoneGalleryView = i;
    renderPhone();
  },
  phoneNotesInput: function (ta) {
    state.phoneNotes = ta.value;
    var c = $("dwc-notes-count");
    if (c) c.textContent = ta.value.length + "/500";
    if (!state.profile) return; // guests: session-only, no save
    var s = $("dwc-notes-saved");
    if (s) s.textContent = "Saving…";
    if (state.phoneNotesTimer) clearTimeout(state.phoneNotesTimer);
    state.phoneNotesTimer = setTimeout(function () {
      apiPost("/notes", { device_id: deviceId(), note: state.phoneNotes }).then(function (data) {
        var s2 = $("dwc-notes-saved");
        if (data && data.ok) {
          state.phoneNotesSavedAt = Date.now();
          if (s2) s2.textContent = "Saved ✓ " + new Date(state.phoneNotesSavedAt).toLocaleTimeString();
        } else if (s2) {
          s2.textContent = "Couldn't save — still in this tab for now";
        }
      });
    }, 800);
  },
  phoneNotesCopy: function () {
    copyTextToClipboard(state.phoneNotes || "");
    setNotice(state.phoneNotes ? "Notes copied." : "Nothing to copy yet.");
  },
  phoneNotesClear: function () {
    state.phoneNotes = "";
    renderPhone();
    if (state.profile) apiPost("/notes", { device_id: deviceId(), note: "" });
  },
  // Meme Stash (v3.13) — copy a meme's code, or save it to the member's
  // Taffy Phone notepad. Copy works for everyone, no profile needed.
  memeCopy: function (btn) {
    var code = btn.getAttribute("data-code") || "";
    var orig = btn.textContent;
    var done = function () {
      btn.textContent = "✅ Copied!";
      setTimeout(function () { btn.textContent = orig; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, function () { copyTextToClipboard(code); done(); });
    } else { copyTextToClipboard(code); done(); }
  },
  // Save a meme code to the member's one persistent note (500 chars).
  // Loads the live note first so an older tab never wipes newer text.
  // Never posts a shorter note than the one loaded, and never posts at
  // all when the code won't fit or the notes table isn't there yet.
  memeSave: async function (btn) {
    var code = btn.getAttribute("data-code") || "";
    var orig = btn.textContent;
    var flash = function (msg) {
      btn.textContent = msg;
      setTimeout(function () { btn.textContent = orig; }, 2200);
    };
    if (!state.profile) { flash("Make a profile first"); return; }
    btn.textContent = "Saving…";
    var base = state.phoneNotes || "";
    try {
      var data = await apiGet("/notes?device_id=" + encodeURIComponent(deviceId()));
      if (data && data.ok && typeof data.note === "string") base = data.note;
    } catch (e) { /* keep the local note as the base */ }
    if (base.indexOf(code) !== -1) { flash("✅ Already saved"); return; }
    var trimmed = base.replace(/\n+$/, "");
    var next = trimmed ? trimmed + "\n" + code : code;
    if (next.length > 500) { flash("Notepad full"); return; }
    var saved = null;
    try { saved = await apiPost("/notes", { device_id: deviceId(), note: next }); } catch (e) { saved = null; }
    if (!saved || !saved.ok) { flash("Notes aren't switched on yet"); return; }
    state.phoneNotes = next;
    state.phoneNotesSavedAt = Date.now();
    var ta = document.querySelector(".tp-notes");
    if (ta) ta.value = next;
    var c = $("dwc-notes-count");
    if (c) c.textContent = next.length + "/500";
    flash("✅ Saved!");
  },

  // Professional mode — GIF comments sit behind a button (see the
  // gifEmbedHTML gate and the page-comment GIF gate). Tap loads the GIF
  // in place of the button; nothing auto-plays on a clean profile.
  loadGifEmbed: function (btn) {
    var url = btn.getAttribute("data-gif-url") || "";
    var label = btn.getAttribute("data-gif-label") || "";
    if (!url || !btn.parentNode) return;
    var tmp = document.createElement("div");
    tmp.innerHTML = gifEmbedHTML(url, label);
    if (tmp.firstChild) btn.parentNode.replaceChild(tmp.firstChild, btn);
  },
  loadGifImg: function (btn) {
    var url = btn.getAttribute("data-gif-src") || "";
    if (!url || !btn.parentNode) return;
    var img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.style.maxWidth = "100%";
    img.style.borderRadius = "8px";
    btn.parentNode.replaceChild(img, btn);
  },

  report: async function (type, id) {
    if (!state.profile) { setNotice("Create your account first — reports come from members so they're accountable."); DWC.openSignup(); return; }
    var reason = prompt("What's wrong with this " + type + "? (optional — one line is enough)");
    if (reason === null) return;
    var data = await apiPost("/reports", { device_id: deviceId(), target_type: type, target_id: id, reason: reason || "" });
    if (data && data.ok) setNotice("Reported — it goes straight to the operator's inbox for Chris to review. Thanks.");
    else if (data && data.error) setNotice(data.error);
  },
  // General ticket (v3.21) — a report with no post/comment/listing
  // attached. Same inbox, same Claim/Release/Resolve actions.
  fileTicket: async function () {
    if (!state.profile) { setNotice("Create your account first — reports come from members so they're accountable."); DWC.openSignup(); return; }
    var box = document.getElementById("dwc-ticket-text");
    var reason = box ? box.value.trim() : "";
    if (!reason) { setNotice("Say what happened first — a blank ticket helps nobody."); return; }
    var data = await apiPost("/reports", { device_id: deviceId(), target_type: "general", target_id: 0, reason: reason });
    if (data && data.ok) { if (box) box.value = ""; setNotice("Ticket sent — it goes straight to the operator's inbox for Chris to review. Thanks."); }
    else if (data && data.error) setNotice(data.error);
  },
  // Team moderation (v3.18) — claim / release / resolve a report.
  // Any team member can claim or resolve; the server enforces it.
  reportAction: async function (id, action) {
    var data = await apiPost("/reports/" + id + "/resolve", { device_id: deviceId(), action: action });
    if (data && data.ok) {
      setNotice(action === "claim" ? "It's yours — the team can see you're handling it." : action === "release" ? "Put back in the queue." : "Report resolved.");
      renderView();
    } else if (data && data.error) setNotice(data.error);
  },
  resolveReport: async function (id) { return DWC.reportAction(id, "resolve"); },
  // Team moderation (v3.18) — silence a member for a duration picked
  // from the dropdown. selectId defaults to the Admin panel row's
  // select; report cards pass their own select id. The server caps the
  // duration by role (admins ≤ 3 months, mods ≤ 1 week, permanent is
  // operator-only) — the dropdown only ever shows what's allowed.
  adminSilence: async function (profileId, selectId) {
    var sel = document.getElementById(selectId || ("dwc-silence-" + profileId));
    var duration = sel ? sel.value : "";
    if (!duration) { setNotice("Pick how long first."); return; }
    var reason = prompt("Silence reason (shown to the team — and to them when they try to post):", "") || "";
    var data = await apiPost("/admin", { device_id: deviceId(), action: "silence", profile_id: profileId, duration: duration, reason: reason });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't silence them."); return; }
    setNotice(data.banned ? "Member banned permanently." : "Member silenced.");
    renderView();
  },
  adminUnsilence: async function (profileId) {
    if (!confirm("Lift the silence? They'll be able to post and comment again.")) return;
    var data = await apiPost("/admin", { device_id: deviceId(), action: "unsilence", profile_id: profileId });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't lift the silence."); return; }
    setNotice("Silence lifted.");
    renderView();
  },
  // Team moderation (v3.18) — operator only. Deletes the member's
  // account row for good; their posts and comments stop showing.
  adminDeleteProfile: async function (profileId, username) {
    if (!confirm("Delete @" + username + "'s profile for good? Their account is gone — their posts and comments stop showing. This can't be undone.")) return;
    var data = await apiPost("/admin", { device_id: deviceId(), action: "delete-profile", profile_id: profileId });
    if (!data || !data.ok) { setNotice((data && data.error) || "Couldn't delete that profile."); return; }
    setNotice("Profile deleted.");
    renderView();
  },
  submitId: async function (form) {
    var fd = new FormData(form);
    var file = fd.get("id_photo");
    if (!file || !file.size) return formErr(form, "Pick a photo of your ID first.");
    var img = await fileToImage(file, 2500000, { maxDim: 1600, minQuality: 0.8 });
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
      var img = await fileToImage(input.files && input.files[0], 3000000, { maxDim: 1600 });
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
    var img = await fileToImage(fd.get("display_image") && fd.get("display_image").size ? fd.get("display_image") : null, 2500000, { maxDim: 1200 });
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
  // Rare Candy loading bar — the boot (profile + stats + first render)
  // has no progress events, so the bar runs indeterminate.
  if (window.RCRloader) window.RCRloader.show();
  await refreshProfile();
  await refreshStats();
  if (state.profile) {
    loadLucre(); // Lucre wallet (balance, check-in, owned) — loads in the background
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
  if (window.RCRloader) window.RCRloader.hide();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();

