// GET /api/profile?device_id= — getMyProfile
// POST /api/profile — saveProfile (create or update the account for a device).
// One account per person: full name (>= 2 chars) + date of birth, unique as
// a pair; username 2-24 [A-Za-z0-9_.-], unique. Full name is never shown
// publicly. New accounts also need the rules agreement + the math
// human-check. No age proof is required to join — only for the 18+ area.
import {
  json, noDb, getDb, readJson, profileByDevice, shapeProfile,
  checkChallenge, putImage, putVideo, fileUrl, imageUrl, nowMs, sanitizeLayoutCss, parseTopFriendIds,
  cleanTheme, cleanMyLinks, cleanProfileButtons, SLUG_RE, slugChangeCheck,
  createNotification, cleanWebsiteShow, RELATIONSHIP_IDS, ZODIAC_IDS,
  recordActivityDay, grantUnlocks, parseTheme, isFreeFrame, unlockForFrame,
  isFreeDivider, unlockForDivider,
  badgeListFor, cleanDisplayBadges, adultCreatorIds, awardLucre, LUCRE_AWARDS,
  queueOutbound,
} from "./_lib.js";
import {
  hashPassword, checkPasswordStrength, isValidEmail, issueToken,
  VERIFY_TOKEN_TTL_MS,
} from "./_auth.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const row = await profileByDevice(db, deviceId);
  if (!row) return json({ profile: null });
  // v3.9 — daily usage: loading the community counts as a day, and any
  // newly-earned frame unlocks are granted here. Both are best-effort
  // (missing tables before the migration just no-op).
  await recordActivityDay(db, row.id);
  const grants = await grantUnlocks(db, row.id);
  const profile = shapeProfile(row);
  profile.unlocked_frames = grants.unlocked;
  profile.unlock_counts = grants.counts;
  // Badges (v3.9) — full list with earned flags for the Badge display,
  // plus the display-slot facts the picker needs.
  profile.badges = badgeListFor(grants.unlocked);
  profile.is_regular_seller = grants.unlocked.includes("badge:sales-5");
  profile.is_adult_seller = (await adultCreatorIds(db, [row.id])).has(row.id);
  return json({ profile });
}

const USERNAME_RE = /^[A-Za-z0-9_.-]+$/;

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, profile: null });
  const deviceId = String(a.device_id || "");
  if (deviceId.length < 8 || deviceId.length > 128) return fail("Missing device id.");
  const existing = await profileByDevice(db, deviceId);

  // Set the profile picture from a stored gallery photo (v3.21) — runs
  // BEFORE the username checks below on purpose: a bare set-avatar
  // call sends no username, and this branch is avatar-only (only
  // avatar_blob_key changes), so it must never blank the bio,
  // occupation, or any other field the full save rewrites.
  if (a.avatar_gallery_id) {
    if (!existing) return fail("Create your account first — the profile picture lives on an account.");
    const row = await db.prepare("SELECT * FROM gallery_photos WHERE id = ? LIMIT 1").bind(Number(a.avatar_gallery_id)).first();
    if (!row || row.profile_id !== existing.id) return fail("That photo isn't yours.");
    // The profile picture can only be Friends or Members (2026-11-21)
    // — a Public or Private photo picked as the pfp becomes Members
    // (the account-only level), so the rule holds the moment it becomes
    // the avatar. The client tells the member it changed.
    let coerced = false;
    if (row.visibility === "public" || row.visibility === "private") {
      try {
        await db.prepare("UPDATE gallery_photos SET visibility = 'members' WHERE id = ?").bind(row.id).run();
        coerced = true;
      } catch { /* visibility column not there yet — avatar still sets */ }
    }
    await db.prepare("UPDATE profiles SET avatar_blob_key = ?, updated_at = ? WHERE id = ?").bind(row.blob_key, nowMs(), existing.id).run();
    return json({ ok: true, error: null, avatar_url: imageUrl(row.blob_key), avatar_visibility: coerced ? "members" : (row.visibility || "public"), visibility_coerced: coerced });
  }

  const username = String(a.username || "").trim();
  if (username.length < 2 || username.length > 24 || !USERNAME_RE.test(username)) {
    return fail("Username needs 2–24 letters, numbers, _ . or - only.");
  }
  const clash = await db.prepare("SELECT id FROM profiles WHERE username = ? LIMIT 1").bind(username).first();
  if (clash && (!existing || clash.id !== existing.id)) {
    return fail("That username is already taken — try another one.");
  }

  // Password auth (2026-11-22) — new signups set a password during
  // signup; it's how they sign back in anywhere. Collected here so the
  // same save stores it; the hash is written after the INSERT below.
  let signupRecoveryEmail = "";
  let passwordPending = false;
  let recoveryEmailPending = false;
  if (!existing) {
    const fullName = String(a.full_name || "").trim();
    if (fullName.length < 2) return fail("Add your full name — one account per person, and name + date of birth is how we keep it that way. Your full name is never shown publicly.");
    if (!a.birthday || !/^\d{4}-\d{2}-\d{2}$/.test(a.birthday)) return fail("Add your date of birth — it pairs with your name for the one-account-per-person rule. Only the month and day are ever shown publicly, never the year.");
    if (!a.terms_agreed) return fail("Tick the agreement box — every member agrees to the street rules when they join.");
    if (!checkChallenge(a.bot_token || "", Number(a.bot_answer))) return fail("That human-check answer wasn't right — grab a fresh question and try again.");
    // One account per person, case-insensitive, whitespace-collapsed.
    const nameKey = fullName.toLowerCase().replace(/\s+/g, " ");
    const { results } = await db.prepare("SELECT full_name, birthday FROM profiles").all();
    const dupe = (results || []).find(
      (p) => (p.full_name || "").trim().toLowerCase().replace(/\s+/g, " ") === nameKey && p.birthday === a.birthday,
    );
    if (dupe) return fail("An account already exists for that name + date of birth — one account per person. If that's you, you're already on the street; if you lost access, that's the account to recover, not a new one.");
    // Password (required at signup) + optional recovery email.
    const pwError = checkPasswordStrength(a.password);
    if (pwError) return fail(pwError);
    if (String(a.password) !== String(a.password_confirm || "")) return fail("Those two passwords don't match — type the same one twice.");
    signupRecoveryEmail = typeof a.recovery_email === "string" ? String(a.recovery_email).trim().toLowerCase() : "";
    if (signupRecoveryEmail && !isValidEmail(signupRecoveryEmail)) return fail("That recovery email doesn't look like an email address.");
  }

  // v3.4 — avatar: a bad picture must NEVER kill the whole save. If
  // the upload fails (too big, wrong type, storage not ready), keep
  // going without it and tell the member exactly why — the client
  // shows avatar_error in the save notice.
  let avatarKey = undefined; // undefined = keep
  let avatarError = null;
  if (a.remove_avatar) avatarKey = null;
  else if (a.avatar) {
    const up = await putImage(env, "avatars", deviceId, a.avatar, 1500000);
    if (!up.ok) avatarError = up.error;
    else avatarKey = up.key;
  }
  // v3.7 — banner / cover photo: same pattern as the avatar. A bad
  // banner never kills the whole save; the client shows banner_error.
  let bannerKey = undefined; // undefined = keep
  let bannerError = null;
  if (a.remove_banner) bannerKey = null;
  else if (a.banner) {
    const up = await putImage(env, "banners", deviceId, a.banner, 2500000);
    if (!up.ok) bannerError = up.error;
    else bannerKey = up.key;
  }
  // v3.10 — one profile video (YouTube link or an uploaded clip, stored
  // in R2 under "profile-video/"). Same pattern as the avatar: a bad
  // video never kills the whole save; the client shows video_error.
  // An upload wins over a YouTube link; removing clears both.
  let videoKey = undefined; // undefined = keep
  let videoError = null;
  if (a.remove_video) videoKey = null;
  else if (a.video) {
    const up = await putVideo(env, "profile-video", deviceId, a.video, 15000000);
    if (!up.ok) videoError = up.error;
    else videoKey = up.key;
  }

  const now = nowMs();
  const str = (v, max) => String(v ?? "").trim().slice(0, max);
  // MySpace throwback v2 — only written when the request carries them.
  // If the v2 migration hasn't been run yet the UPDATE fails with
  // "no such column" and we retry with just the v1 columns, so an edit
  // never breaks — the client is told via v2_pending.
  // Layout presets the client may apply through Edit Profile. Store
  // layouts ("store:*") are in this list too — they can only be set
  // through the Layout Store (free, or bought with Lucre), and the
  // store applies them through this same POST, so the server must
  // accept them here. The client picker never lists store ids, so
  // nobody can claim a priced layout by typing its id in Edit Profile.
  const LAYOUT_PRESETS = ["", "classic", "neon", "midnight", "candy", "afterdark", "creatorgold", "candyshop", "arcade", "ocean", "custom",
    "store:rainy-night", "store:clean-professional", "store:facebook-style",
    "store:instagram-style", "store:80s-arcade", "store:kitsune-shrine",
    "store:horror-lover", "store:stardust-diner", "store:deep-forest",
    "store:cyber-street", "store:neon-rain", "store:golden-shrine",
    "store:vaporwave-sunset", "store:retro-terminal", "store:candy-pop",
    "store:midnight-garden", "store:arcade80s", "store:shopfront",
    "store:band-stand", "store:portfolio", "store:neojapan-rain",
    "store:neojapan-night", "store:brass-knuckles", "store:too-much",
    "store:cat-faces", "store:burton", "store:christmas-cozy",
    "store:christmas-lights"];
  const v2Sets = [];
  const v2Vals = [];
  if (Array.isArray(a.top_friends)) {
    const ids = parseTopFriendIds(a.top_friends.join(","));
    v2Sets.push("top_friends = ?");
    v2Vals.push(ids.join(","));
  }
  if (typeof a.layout_css === "string") {
    v2Sets.push("layout_css = ?");
    v2Vals.push(sanitizeLayoutCss(a.layout_css));
  }
  // Layout preset (v3.10, store v3.11, user layouts v3.12) — a known
  // store preset, "custom" for hand-written CSS, or a member-published
  // layout "user:<id>" (validated as a real published layout below).
  // Anything else is ignored, never stored.
  if (typeof a.layout_preset === "string" && (LAYOUT_PRESETS.includes(a.layout_preset) || /^user:\d+$/.test(a.layout_preset))) {
    v2Sets.push("layout_preset = ?");
    v2Vals.push(a.layout_preset);
  }
  // Creator/Seller area (v3) — "What I sell" / "What I'm after". Same
  // graceful pattern as v2: if the v3 migration hasn't run yet, the
  // UPDATE fails with "no such column" and we retry without the v3
  // columns; the client is told via v3_pending.
  const v3Sets = [];
  const v3Vals = [];
  const cleanTypes = (list) => {
    const out = [];
    for (const t of (Array.isArray(list) ? list : [])) {
      const v = String(t || "").trim();
      if (v && !out.includes(v)) out.push(v);
    }
    return out;
  };
  const cleanTags = (list) => {
    const out = [];
    for (const t of (Array.isArray(list) ? list : [])) {
      const n = String(t || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
      if (n && n.length >= 2 && !out.includes(n)) out.push(n);
      if (out.length >= 8) break;
    }
    return out;
  };
  const CREATOR_GENRES_LOCAL = ["Photos", "Videos", "Custom Content", "Audio", "3D Models", "3D Print Files", "Developer Files", "Designs", "Art", "Apps", "Game Assets", "Adult Content", "Video games", "Refurbished tech", "3D prints", "Car parts", "Collectibles", "Tutor work", "Other"];
  if (Array.isArray(a.seller_types)) {
    v3Sets.push("seller_types = ?");
    v3Vals.push(cleanTypes(a.seller_types).filter((t) => CREATOR_GENRES_LOCAL.includes(t)).join(","));
  }
  if (Array.isArray(a.seller_tags)) {
    v3Sets.push("seller_tags = ?");
    v3Vals.push(cleanTags(a.seller_tags).join(","));
  }
  if (typeof a.seller_open_to === "string") {
    v3Sets.push("seller_open_to = ?");
    v3Vals.push(str(a.seller_open_to, 140));
  }
  // Member shops — the member's shop/brand name + tagline for their
  // shop page. Rides the v3 tier, so the graceful retry drops them
  // with the rest of v3 when the migration hasn't run yet.
  if (typeof a.shop_name === "string") {
    v3Sets.push("shop_name = ?");
    v3Vals.push(str(a.shop_name, 60));
  }
  if (typeof a.shop_tagline === "string") {
    v3Sets.push("shop_tagline = ?");
    v3Vals.push(str(a.shop_tagline, 140));
  }
  // Creator menu + content vault (2026-11-21) — the "Content sales
  // enabled" master toggle, near the top of Edit Profile. Rides the
  // v3 tier, same graceful retry as shop_name. Only an age-verified
  // member may turn it ON (the toggle does not replace the 18+
  // badge); anyone may turn it OFF. OFF hides the menu and stops
  // new sales; it does not delete staged content or cancel
  // in-flight orders. The toggle state itself is never public —
  // shapeMember deliberately never carries it.
  if (typeof a.content_sales_enabled === "boolean" || a.content_sales_enabled === 0 || a.content_sales_enabled === 1) {
    const want = a.content_sales_enabled === true || a.content_sales_enabled === 1 ? 1 : 0;
    if (want === 1 && (!existing || existing.age_verified !== 1)) {
      return fail("Content sales need age verification first — verify your age with a photo ID (Rules & After Dark). A typed birthday alone is never enough.");
    }
    v3Sets.push("content_sales_enabled = ?");
    v3Vals.push(want);
  }
  if (Number.isInteger(a.seller_price_min_cents) || Number.isInteger(a.seller_price_max_cents)) {
    const lo = Number.isInteger(a.seller_price_min_cents) ? Math.max(0, Math.min(a.seller_price_min_cents, 10000000)) : 0;
    const hi = Number.isInteger(a.seller_price_max_cents) ? Math.max(0, Math.min(a.seller_price_max_cents, 10000000)) : 0;
    v3Sets.push("seller_price_min_cents = ?", "seller_price_max_cents = ?");
    v3Vals.push(lo, hi >= lo ? hi : lo);
  }
  if (Array.isArray(a.buyer_types)) {
    v3Sets.push("buyer_types = ?");
    v3Vals.push(cleanTypes(a.buyer_types).filter((t) => CREATOR_GENRES_LOCAL.includes(t)).join(","));
  }
  if (Array.isArray(a.buyer_tags)) {
    v3Sets.push("buyer_tags = ?");
    v3Vals.push(cleanTags(a.buyer_tags).join(","));
  }
  if (Number.isInteger(a.buyer_budget_max_cents)) {
    v3Sets.push("buyer_budget_max_cents = ?");
    v3Vals.push(Math.max(0, Math.min(a.buyer_budget_max_cents, 10000000)));
  }
  // Music (v3.1) — A Steady Heart track picks (track numbers 1–21, max
  // 5, in the member's order) + the opt-in Vita Nova Radio player.
  // Same graceful pattern: they ride with the v3 columns, so if the
  // migration hasn't run yet the edit retries without them.
  if (Array.isArray(a.ash_tracks)) {
    const picks = [];
    for (const t of a.ash_tracks) {
      const n = Number(t);
      if (Number.isInteger(n) && n >= 1 && n <= 21 && !picks.includes(n)) picks.push(n);
      if (picks.length >= 5) break;
    }
    v3Sets.push("ash_tracks = ?");
    v3Vals.push(picks.join(","));
  }
  if (typeof a.show_vnr_player === "boolean" || a.show_vnr_player === 0 || a.show_vnr_player === 1) {
    v3Sets.push("show_vnr_player = ?");
    v3Vals.push(a.show_vnr_player === true || a.show_vnr_player === 1 ? 1 : 0);
  }
  // v3.3 — autoplay the Steady Wave player on the member page. Only
  // meaningful when show_vnr_player is on. Same graceful pattern: rides
  // with the v3 columns, so if the migration hasn't run yet the edit
  // retries without it.
  if (typeof a.autoplay_vnr === "boolean" || a.autoplay_vnr === 0 || a.autoplay_vnr === 1) {
    v3Sets.push("autoplay_vnr = ?");
    v3Vals.push(a.autoplay_vnr === true || a.autoplay_vnr === 1 ? 1 : 0);
  }
  // v3.2 — custom "Subscribe to my page" button text (max 40 chars;
  // empty falls back to the default) + the member-page theme pickers
  // (background color/image, text + accent colors, font — validated by
  // cleanTheme: hex colors, https:// image, allowlisted font only).
  // Same graceful pattern: they ride with the v3 columns.
  if (typeof a.subscribe_label === "string") {
    v3Sets.push("subscribe_label = ?");
    v3Vals.push(str(a.subscribe_label, 40) || "Subscribe to my page");
  }
  if (typeof a.profile_theme === "string" || (a.profile_theme && typeof a.profile_theme === "object")) {
    // v3.9 — locked frames can't be picked: if the submitted frame is
    // locked for this member, keep whatever frame they already had (or
    // none). Free frames and earned unlocks pass through.
    let themeIn = a.profile_theme;
    if (existing) {
      const incoming = parseTheme(a.profile_theme);
      if (incoming.pic_frame && !isFreeFrame(incoming.pic_frame)) {
        const grants = await grantUnlocks(db, existing.id);
        const need = unlockForFrame(incoming.pic_frame);
        if (need && !grants.unlocked.includes(need)) {
          const current = parseTheme(existing.profile_theme);
          incoming.pic_frame = current.pic_frame || "";
          themeIn = incoming;
        }
      }
      // v3.20 — dividers: same locked-pattern as frames. A locked
      // divider the member hasn't unlocked (Lucre / achievement — no
      // purchase flow yet) falls back to whatever they already had.
      if (incoming.divider && !isFreeDivider(incoming.divider)) {
        const grants = await grantUnlocks(db, existing.id);
        const need = unlockForDivider(incoming.divider);
        if (need && !grants.unlocked.includes(need)) {
          const current = parseTheme(existing.profile_theme);
          incoming.divider = current.divider || "";
          themeIn = incoming;
        }
      }
      // v3.9 — display badges: enforce the slot rules (adult sellers
      // always show 18+ plus one chosen; regular sellers showing Regular
      // Seller may add one secondary; everyone else shows one). Repairs
      // instead of rejecting, so a bad pick never kills the save.
      if (incoming.display_badges && incoming.display_badges.length) {
        const grants = await grantUnlocks(db, existing.id);
        const isAdult = (await adultCreatorIds(db, [existing.id])).has(existing.id);
        const isRegular = grants.unlocked.includes("badge:sales-5");
        const repaired = cleanDisplayBadges(incoming.display_badges, grants.unlocked, isAdult, isRegular);
        if (JSON.stringify(repaired) !== JSON.stringify(incoming.display_badges)) {
          incoming.display_badges = repaired;
          themeIn = incoming;
        }
      }
      // v3.10 — profile video: a fresh upload wins over a YouTube link
      // and stores the R2 file URL; removing clears both. A failed
      // upload leaves the previous video alone (video_error tells the
      // member) instead of wiping it.
      if (videoKey === null) {
        incoming.video_url = "";
        incoming.video_file_url = "";
        themeIn = incoming;
      } else if (videoKey) {
        incoming.video_file_url = fileUrl(videoKey);
        incoming.video_url = "";
        themeIn = incoming;
      }
    }
    v3Sets.push("profile_theme = ?");
    v3Vals.push(cleanTheme(themeIn));
  }
  // v3.4 — My links (label + URL buttons on the member page). Stored as
  // JSON; cleanMyLinks drops bad rows (no label, non-http(s) URL, dupes)
  // and caps at 6. Same graceful pattern: rides with the v3 columns.
  if (Array.isArray(a.my_links)) {
    v3Sets.push("my_links = ?");
    v3Vals.push(JSON.stringify(cleanMyLinks(a.my_links)));
  }
  // v3.6 — profile action-button customization + custom page URL.
  // Same graceful pattern: they ride in their own v36 columns, so if
  // the v3.6 migration hasn't run yet the edit retries without them
  // and the client is told via v36_pending.
  const v36Sets = [];
  const v36Vals = [];
  let v36Pending = false;
  if (typeof a.profile_buttons === "string" || (a.profile_buttons && typeof a.profile_buttons === "object")) {
    v36Sets.push("profile_buttons = ?");
    v36Vals.push(cleanProfileButtons(a.profile_buttons));
  }
  if (typeof a.page_slug === "string" && existing) {
    const newSlug = String(a.page_slug || "").trim();
    const currentSlug = String(existing.page_slug || "").trim();
    if (newSlug === "" && currentSlug !== "") {
      // Clearing the slug — free, doesn't count as a change.
      v36Sets.push("page_slug = ?");
      v36Vals.push("");
    } else if (newSlug !== "") {
      if (!SLUG_RE.test(newSlug)) return fail("Page URL needs 3–24 letters, numbers, _ . or - only.");
      const check = slugChangeCheck(existing, newSlug, now);
      if (!check.ok) return fail(check.error);
      if (check.changed) {
        // Uniqueness (case-insensitive). If the column doesn't exist
        // yet the query throws "no such column" — the slug just can't
        // stick, so tell the member via v36_pending and save the rest.
        let slugTaken = false;
        let slugColumnMissing = false;
        try {
          const clash = await db.prepare("SELECT id FROM profiles WHERE lower(page_slug) = lower(?) LIMIT 1").bind(newSlug).first();
          if (clash && clash.id !== existing.id) slugTaken = true;
        } catch (e) {
          if (/no such column|no column named/i.test(String((e && e.message) || e))) slugColumnMissing = true;
          else throw e;
        }
        if (slugTaken) return fail("That page URL is already taken — try another one.");
        if (slugColumnMissing) {
          v36Pending = true;
        } else {
          v36Sets.push("page_slug = ?", "page_slug_changes = ?", "page_slug_window_start = ?", "page_slug_changed_at = ?");
          v36Vals.push(newSlug, check.newChanges, check.newWindowStart, check.newChangedAt);
        }
      }
    }
  }
  // v3.7 — custom text ticker / marquee (optional, off by default; custom
  // text only, never the member's name) + banner blob key. Same graceful
  // pattern: they ride in their own v37 columns, so if the v3.7 migration
  // hasn't run yet the edit retries without them and the client is told
  // via v37_pending.
  const v37Sets = [];
  const v37Vals = [];
  let v37Pending = false;
  if (typeof a.ticker_text === "string") {
    v37Sets.push("ticker_text = ?");
    v37Vals.push(str(a.ticker_text, 200));
  }
  if (typeof a.ticker_enabled === "boolean" || a.ticker_enabled === 0 || a.ticker_enabled === 1) {
    v37Sets.push("ticker_enabled = ?");
    v37Vals.push(a.ticker_enabled === true || a.ticker_enabled === 1 ? 1 : 0);
  }
  if (typeof a.ticker_color === "string") {
    v37Sets.push("ticker_color = ?");
    v37Vals.push(str(a.ticker_color, 20));
  }
  if (bannerKey !== undefined) {
    v37Sets.push("banner_blob_key = ?");
    v37Vals.push(bannerKey);
  }
  // v3.9 — website look: the five website fields + which ones show.
  // Same graceful pattern: they ride in their own v39 columns, so if
  // the v3.9 migration hasn't run yet the edit retries without them
  // and the client is told via v39_pending.
  const v39Sets = [];
  const v39Vals = [];
  let v39Pending = false;
  if (typeof a.website_mode === "boolean" || a.website_mode === 0 || a.website_mode === 1) {
    v39Sets.push("website_mode = ?");
    v39Vals.push(a.website_mode === true || a.website_mode === 1 ? 1 : 0);
  }
  if (typeof a.hobbies === "string") {
    v39Sets.push("hobbies = ?");
    v39Vals.push(str(a.hobbies, 200));
  }
  if (typeof a.workplace === "string") {
    v39Sets.push("workplace = ?");
    v39Vals.push(str(a.workplace, 120));
  }
  if (typeof a.relationship_status === "string") {
    v39Sets.push("relationship_status = ?");
    v39Vals.push(RELATIONSHIP_IDS.includes(a.relationship_status) ? a.relationship_status : "");
  }
  if (typeof a.birthsign === "string") {
    v39Sets.push("birthsign = ?");
    v39Vals.push(ZODIAC_IDS.includes(a.birthsign) ? a.birthsign : "");
  }
  if (typeof a.accomplishments === "string") {
    v39Sets.push("accomplishments = ?");
    v39Vals.push(str(a.accomplishments, 500));
  }
  if (typeof a.website_show === "string" || (a.website_show && typeof a.website_show === "object")) {
    v39Sets.push("website_show = ?");
    v39Vals.push(cleanWebsiteShow(a.website_show));
  }
  // Professional mode (2026-11-21) — contact email + its opt-in Show
  // box. Same v39 tier: if the migration hasn't run yet the edit
  // retries without them and the client is told via v39_pending.
  if (typeof a.contact_email === "string") {
    var ce = str(a.contact_email, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ce)) ce = "";
    v39Sets.push("contact_email = ?");
    v39Vals.push(ce);
  }
  if (typeof a.show_contact_email === "boolean" || a.show_contact_email === 0 || a.show_contact_email === 1) {
    v39Sets.push("show_contact_email = ?");
    v39Vals.push(a.show_contact_email === true || a.show_contact_email === 1 ? 1 : 0);
  }
  // Notification prefs (Flea Market checkout) — email on by default,
  // texts opt-in only. Same tier pattern: if the migration hasn't run
  // yet the edit retries without them and the client is told via
  // v40_pending.
  const v40Sets = [], v40Vals = [];
  let v40Pending = false;
  if (typeof a.notify_email === "boolean" || a.notify_email === 0 || a.notify_email === 1) {
    v40Sets.push("notify_email = ?");
    v40Vals.push(a.notify_email === true || a.notify_email === 1 ? 1 : 0);
  }
  if (typeof a.notify_sms === "boolean" || a.notify_sms === 0 || a.notify_sms === 1) {
    v40Sets.push("notify_sms = ?");
    v40Vals.push(a.notify_sms === true || a.notify_sms === 1 ? 1 : 0);
  }
  if (typeof a.sms_number === "string") {
    v40Sets.push("sms_number = ?");
    v40Vals.push(str(a.sms_number, 20));
  }
  let row;
  let v2Pending = false;
  let v3Pending = false;
  if (existing) {
    const sets = ["username = ?", "chat_name = ?", "occupation = ?", "bio = ?", "payout_method = ?", "payout_handle = ?", "updated_at = ?", ...v2Sets, ...v3Sets, ...v36Sets, ...v37Sets, ...v39Sets, ...v40Sets];
    const vals = [username, str(a.chat_name, 24), str(a.occupation, 60), str(a.bio, 280), str(a.payout_method, 40), str(a.payout_handle, 80), now, ...v2Vals, ...v3Vals, ...v36Vals, ...v37Vals, ...v39Vals, ...v40Vals];
    if (!existing.full_name && String(a.full_name || "").trim()) { sets.push("full_name = ?"); vals.push(String(a.full_name).trim().slice(0, 80)); }
    if (a.birthday) { sets.push("birthday = ?"); vals.push(a.birthday); }
    if (a.terms_agreed && !existing.terms_agreed_at) { sets.push("terms_agreed_at = ?"); vals.push(now); }
    if (avatarKey !== undefined) { sets.push("avatar_blob_key = ?"); vals.push(avatarKey); }
    vals.push(existing.id);
    try {
      await db.prepare(`UPDATE profiles SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
    } catch (e) {
      // A migration column doesn't exist yet — retry without the new
      // columns so an edit never breaks. Drop one tier at a time: first
      // just v3.6, then v3 + v3.6, then v2 + v3 + v3.6. The client is
      // told via v2_pending / v3_pending / v36_pending.
      if (/no such column|no column named/i.test(String((e && e.message) || e))) {
        const without = (dropSets) => {
          const keep = [];
          const keepVals = [];
          for (let i = 0; i < sets.length; i++) {
            if (dropSets.includes(sets[i])) continue;
            keep.push(sets[i]);
            keepVals.push(vals[i]);
          }
          keepVals.push(existing.id);
          return { keep, keepVals };
        };
        const tryDrop = async (dropSets) => {
          const r = without(dropSets);
          await db.prepare(`UPDATE profiles SET ${r.keep.join(", ")} WHERE id = ?`).bind(...r.keepVals).run();
        };
        let done = false;
        if (v40Sets.length) {
          try { await tryDrop(v40Sets); v40Pending = true; done = true; }
          catch (e2) { if (!/no such column|no column named/i.test(String((e2 && e2.message) || e2))) throw e2; }
        }
        if (!done && v39Sets.length) {
          try { await tryDrop([...v39Sets, ...v40Sets]); v39Pending = true; v40Pending = true; done = true; }
          catch (e2) { if (!/no such column|no column named/i.test(String((e2 && e2.message) || e2))) throw e2; }
        }
        if (!done && v37Sets.length) {
          try { await tryDrop([...v37Sets, ...v39Sets, ...v40Sets]); v37Pending = true; v39Pending = true; v40Pending = true; done = true; }
          catch (e2) { if (!/no such column|no column named/i.test(String((e2 && e2.message) || e2))) throw e2; }
        }
        if (!done && v36Sets.length) {
          try { await tryDrop([...v36Sets, ...v37Sets, ...v39Sets, ...v40Sets]); v36Pending = true; v37Pending = true; v39Pending = true; v40Pending = true; done = true; }
          catch (e2) { if (!/no such column|no column named/i.test(String((e2 && e2.message) || e2))) throw e2; }
        }
        if (!done && v3Sets.length) {
          try { await tryDrop([...v3Sets, ...v36Sets, ...v37Sets, ...v39Sets, ...v40Sets]); v3Pending = true; v36Pending = true; v37Pending = true; v39Pending = true; v40Pending = true; done = true; }
          catch (e2) { if (!/no such column|no column named/i.test(String((e2 && e2.message) || e2))) throw e2; }
        }
        if (!done && v2Sets.length) {
          const r2 = without([...v2Sets, ...v3Sets, ...v36Sets, ...v37Sets, ...v39Sets, ...v40Sets]);
          await db.prepare(`UPDATE profiles SET ${r2.keep.join(", ")} WHERE id = ?`).bind(...r2.keepVals).run();
          v2Pending = true;
          if (v3Sets.length) v3Pending = true;
          if (v36Sets.length) v36Pending = true;
          if (v37Sets.length) v37Pending = true;
          if (v39Sets.length) v39Pending = true;
          if (v40Sets.length) v40Pending = true;
          done = true;
        }
        if (!done) throw e;
      } else { throw e; }
    }
    row = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(existing.id).first();
  } else {
    const r = await db.prepare(
      `INSERT INTO profiles (device_id, username, full_name, birthday, terms_agreed_at, chat_name, occupation, bio, payout_method, payout_handle, avatar_blob_key, top_friends, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(deviceId, username, String(a.full_name).trim().slice(0, 80), a.birthday ?? null, now,
      str(a.chat_name, 24), str(a.occupation, 60), str(a.bio, 280),
      str(a.payout_method, 40), str(a.payout_handle, 80), avatarKey ?? null,
      // Chris (member id 1) is every new member's first Top Friend,
      // MySpace-Tom style — already added, they can remove him if they want.
      "1", now, now).run();
    row = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(r.meta.last_row_id).first();
    // Password auth — hash + store best-effort. If the migration
    // hasn't run yet the UPDATE throws "no such column" and the account
    // still gets created; the client is told via password_pending so
    // the member sets a password in Edit profile once that's done.
    // A recovery email, if given, goes to pending_email with a verify
    // token queued the same way reset emails queue (waiting_provider
    // until an email provider is connected).
    if (row && a.password) {
      try {
        const { hash, salt } = await hashPassword(a.password);
        await db.prepare("UPDATE profiles SET password_hash = ?, password_salt = ?, password_set_at = ? WHERE id = ?").bind(hash, salt, now, row.id).run();
      } catch (e) {
        if (/no such column|no column named/i.test(String((e && e.message) || e))) passwordPending = true;
        else throw e;
      }
    }
    if (row && signupRecoveryEmail) {
      try {
        await db.prepare("UPDATE profiles SET pending_email = ? WHERE id = ?").bind(signupRecoveryEmail, row.id).run();
        const token = await issueToken(db, row.id, "email_verify", VERIFY_TOKEN_TTL_MS, "");
        const link = `${new URL(request.url).origin}/forgot-password.html?verify=${encodeURIComponent(token)}`;
        await queueOutbound(db, row.id, "email", "email_verify",
          "Verify your Rare Candy Reserve recovery email",
          `Confirm this email as the recovery address for @${username} — it lets you reset your password if you forget it:\n\n${link}\n\nThe link works for 24 hours. If you didn't ask for this, ignore it.`);
        recoveryEmailPending = true;
      } catch { /* columns/table missing — the member can add it later in Edit profile */ }
    }
  }
  if (!row) return fail("Couldn't save that profile — try again.");
  // Notifications (v3.8) — a brand-new member just joined: tell the
  // operator (Chris, member id 1). Fresh signups only, never a profile
  // edit. createNotification skips quietly when the table isn't there
  // yet, and never notifies the operator about his own signup.
  if (!existing) {
    await createNotification(db, {
      profile_id: 1, actor_profile_id: row.id, kind: "new_member",
      ref_type: "profile", ref_id: row.id,
      text: `@${row.username} just joined the Reserve!`,
      link: `#/member/${row.id}`,
    });
  }
  const profileOut = shapeProfile(row);
  const lucreOut = {};
  if (row) {
    const grants = await grantUnlocks(db, row.id);
    profileOut.unlocked_frames = grants.unlocked;
    profileOut.unlock_counts = grants.counts;
    // Same three fields the GET attaches — without them the client
    // replaces its profile with a badge-less copy after every save,
    // and the badge picker in Edit Profile goes empty until reload.
    profileOut.badges = badgeListFor(grants.unlocked);
    profileOut.is_regular_seller = grants.unlocked.includes("badge:sales-5");
    profileOut.is_adult_seller = (await adultCreatorIds(db, [row.id])).has(row.id);
    // Lucre (v3.11) — 10 for a new profile, once ever; 10 more the
    // first time the profile is fully set up (avatar + bio + occupation
    // + a link + a Top Friend). The ledger key makes each once-ever.
    if (!existing) {
      const np = await awardLucre(db, row.id, LUCRE_AWARDS.profile, "profile", "new");
      if (np.awarded) lucreOut.profile = np.balance;
    }
    if (grants.counts.profile_complete) {
      const pc = await awardLucre(db, row.id, LUCRE_AWARDS.profile_complete, "profile_complete", "complete");
      if (pc.awarded) lucreOut.profile_complete = pc.balance;
    }
  }
  const out = { ok: true, error: null, profile: profileOut, password_pending: passwordPending, recovery_email_pending: recoveryEmailPending, v2_pending: v2Pending, v3_pending: v3Pending, v36_pending: v36Pending, v37_pending: v37Pending, v39_pending: v39Pending, v40_pending: v40Pending, avatar_error: avatarError, banner_error: bannerError, video_error: videoError };
  if (Object.keys(lucreOut).length) out.lucre = lucreOut;
  return json(out);
}
