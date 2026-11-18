// GET /api/profile?device_id= — getMyProfile
// POST /api/profile — saveProfile (create or update the account for a device).
// One account per person: full name (>= 2 chars) + date of birth, unique as
// a pair; username 2-24 [A-Za-z0-9_.-], unique. Full name is never shown
// publicly. New accounts also need the rules agreement + the math
// human-check. No age proof is required to join — only for the 18+ area.
import {
  json, noDb, getDb, readJson, profileByDevice, shapeProfile,
  checkChallenge, putImage, nowMs, sanitizeLayoutCss, parseTopFriendIds,
  cleanTheme, cleanMyLinks, cleanProfileButtons, SLUG_RE, slugChangeCheck,
} from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const row = await profileByDevice(db, deviceId);
  return json({ profile: shapeProfile(row) });
}

const USERNAME_RE = /^[A-Za-z0-9_.-]+$/;

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, profile: null });
  const deviceId = String(a.device_id || "");
  if (deviceId.length < 8 || deviceId.length > 128) return fail("Missing device id.");
  const username = String(a.username || "").trim();
  if (username.length < 2 || username.length > 24 || !USERNAME_RE.test(username)) {
    return fail("Username needs 2–24 letters, numbers, _ . or - only.");
  }
  const existing = await profileByDevice(db, deviceId);
  const clash = await db.prepare("SELECT id FROM profiles WHERE username = ? LIMIT 1").bind(username).first();
  if (clash && (!existing || clash.id !== existing.id)) {
    return fail("That username is already taken — try another one.");
  }

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

  const now = nowMs();
  const str = (v, max) => String(v ?? "").trim().slice(0, max);
  // MySpace throwback v2 — only written when the request carries them.
  // If the v2 migration hasn't been run yet the UPDATE fails with
  // "no such column" and we retry with just the v1 columns, so an edit
  // never breaks — the client is told via v2_pending.
  const LAYOUT_PRESETS = ["", "classic", "neon", "midnight", "candy", "afterdark", "creatorgold", "candyshop", "arcade", "ocean", "custom"];
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
  if (typeof a.layout_preset === "string" && LAYOUT_PRESETS.includes(a.layout_preset)) {
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
  const CREATOR_GENRES_LOCAL = ["Photos", "Videos", "Custom Content", "Audio", "3D Models", "3D Print Files", "Developer Files", "Designs", "Art", "Apps", "Game Assets", "Adult Content", "Other"];
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
    v3Sets.push("profile_theme = ?");
    v3Vals.push(cleanTheme(a.profile_theme));
  }
  // v3.4 — My links (label + URL buttons on the member page). Stored as
  // JSON; cleanMyLinks drops bad rows (no label, non-http(s) URL, dupes)
  // and caps at 5. Same graceful pattern: rides with the v3 columns.
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
  let row;
  let v2Pending = false;
  let v3Pending = false;
  if (existing) {
    const sets = ["username = ?", "chat_name = ?", "occupation = ?", "bio = ?", "payout_method = ?", "payout_handle = ?", "updated_at = ?", ...v2Sets, ...v3Sets, ...v36Sets, ...v37Sets];
    const vals = [username, str(a.chat_name, 24), str(a.occupation, 60), str(a.bio, 280), str(a.payout_method, 40), str(a.payout_handle, 80), now, ...v2Vals, ...v3Vals, ...v36Vals, ...v37Vals];
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
        if (v37Sets.length) {
          try { await tryDrop(v37Sets); v37Pending = true; done = true; }
          catch (e2) { if (!/no such column|no column named/i.test(String((e2 && e2.message) || e2))) throw e2; }
        }
        if (!done && v36Sets.length) {
          try { await tryDrop([...v36Sets, ...v37Sets]); v36Pending = true; v37Pending = true; done = true; }
          catch (e2) { if (!/no such column|no column named/i.test(String((e2 && e2.message) || e2))) throw e2; }
        }
        if (!done && v3Sets.length) {
          try { await tryDrop([...v3Sets, ...v36Sets, ...v37Sets]); v3Pending = true; v36Pending = true; v37Pending = true; done = true; }
          catch (e2) { if (!/no such column|no column named/i.test(String((e2 && e2.message) || e2))) throw e2; }
        }
        if (!done && v2Sets.length) {
          const r2 = without([...v2Sets, ...v3Sets, ...v36Sets, ...v37Sets]);
          await db.prepare(`UPDATE profiles SET ${r2.keep.join(", ")} WHERE id = ?`).bind(...r2.keepVals).run();
          v2Pending = true;
          if (v3Sets.length) v3Pending = true;
          if (v36Sets.length) v36Pending = true;
          if (v37Sets.length) v37Pending = true;
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
  }
  if (!row) return fail("Couldn't save that profile — try again.");
  return json({ ok: true, error: null, profile: shapeProfile(row), v2_pending: v2Pending, v3_pending: v3Pending, v36_pending: v36Pending, v37_pending: v37Pending, avatar_error: avatarError, banner_error: bannerError });
}
