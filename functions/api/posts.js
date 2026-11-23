// GET /api/posts — listPosts (category / kind / tag / sort filters).
// POST /api/posts — createPost.
// ADULT GATE (server-side, not just UI): adult posts are NEVER returned
// unless kind=adult AND the caller is age-verified. Adult posts are
// excluded from every other listing, including tag pages and the front page.
// CREATOR POSTS (v3): kind=adult posts with is_creator=1 — a seller's
// digital-content post (genre, price, custom tags, optional 3D print
// file). They live in the adult forum feed and its tag pages, and only
// age-verified members can create or see them.
import {
  json, noDb, getDb, readJson, profileByDevice, isOperator, shapePost,
  CATEGORIES, ADULT_CATEGORIES, CREATOR_GENRES, normalizeTags, normalizeCreatorTags,
  parseTags, putImage, putVideo, putPrintFile, nowMs, notifyMentions,
  createNotification, badgesForProfiles, awardLucre, LUCRE_AWARDS, filterVisiblePosts, silenceCheck, bannedMemberCheck,
  parseTheme, isFriendWith, isBanActive,
} from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const category = q.get("category") || null;
  const kind = q.get("kind") || null;
  const tag = q.get("tag") || null;
  const sort = ["new", "top", "discussed"].includes(q.get("sort")) ? q.get("sort") : "new";
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "50", 10) || 50, 1), 100);
  const deviceId = q.get("device_id") || "";
  const onlyCreator = q.get("creator") === "1";
  const genre = q.get("genre") || null;
  const friendsOnly = q.get("friends") === "1";
  // Member post feed (v3.20) — one member's posts for their profile page.
  // profile_id filters to that author; before=<post id> pages older.
  const profileId = q.get("profile_id") ? Number(q.get("profile_id")) : null;
  const before = q.get("before") ? Number(q.get("before")) : null;

  const wantsAdult = kind === "adult";
  let callerVerified = false;
  let caller = null;
  if (deviceId) {
    caller = await profileByDevice(db, deviceId);
    callerVerified = !!caller && caller.age_verified === 1;
  }
  if (wantsAdult && !callerVerified) return json({ posts: [] });

  // Member-level feed privacy (v3.20, server-enforced, never UI-only):
  // "private" = owner + operator only; "friends" = owner + operator +
  // friends; "public" = everyone. A blocked viewer gets an empty feed
  // with feed_visible:false — the page shows a plain note, not an error.
  // Friends-only POSTS are still filtered per post by filterVisiblePosts.
  if (profileId) {
    const memberRow = await db.prepare("SELECT id, profile_theme FROM profiles WHERE id = ? LIMIT 1").bind(profileId).first();
    if (!memberRow) return json({ posts: [], feed_visible: false, has_more: false });
    const fp = parseTheme(memberRow.profile_theme).feed_privacy || "public";
    let visible = true;
    if (fp === "private") {
      visible = !!caller && (caller.id === profileId || caller.is_operator === 1);
    } else if (fp === "friends") {
      visible = !!caller && (caller.id === profileId || caller.is_operator === 1 || await isFriendWith(db, profileId, caller.id));
    }
    if (!visible) return json({ posts: [], feed_visible: false, has_more: false });
  }

  const noCol = (e) => /no such column|no column named/i.test(String((e && e.message) || e));
  let results;
  try {
    const q = await db.prepare(
      profileId
        ? `SELECT p.*, a.id AS author_id, a.username AS author_username, a.occupation AS author_occupation, a.avatar_blob_key AS author_avatar, a.banned AS author_banned, a.banned_until AS author_banned_until
           FROM posts p JOIN profiles a ON a.id = p.profile_id WHERE p.profile_id = ? ORDER BY p.id DESC LIMIT 200`
        : `SELECT p.*, a.id AS author_id, a.username AS author_username, a.occupation AS author_occupation, a.avatar_blob_key AS author_avatar, a.banned AS author_banned, a.banned_until AS author_banned_until
           FROM posts p JOIN profiles a ON a.id = p.profile_id ORDER BY p.id DESC LIMIT 200`,
    ).bind(...(profileId ? [profileId] : [])).all();
    results = q.results;
  } catch (e) {
    if (!noCol(e)) throw e;
    // banned_until column not there yet — a ban reads as permanent
    // (the old flag), which is the safe direction.
    const q = await db.prepare(
      profileId
        ? `SELECT p.*, a.id AS author_id, a.username AS author_username, a.occupation AS author_occupation, a.avatar_blob_key AS author_avatar, a.banned AS author_banned
           FROM posts p JOIN profiles a ON a.id = p.profile_id WHERE p.profile_id = ? ORDER BY p.id DESC LIMIT 200`
        : `SELECT p.*, a.id AS author_id, a.username AS author_username, a.occupation AS author_occupation, a.avatar_blob_key AS author_avatar, a.banned AS author_banned
           FROM posts p JOIN profiles a ON a.id = p.profile_id ORDER BY p.id DESC LIMIT 200`,
    ).bind(...(profileId ? [profileId] : [])).all();
    results = q.results;
  }
  let rows = results || [];
  // Banned authors (Build 5) — their existing posts stay in the
  // database but stop showing anywhere, server-side. The operator
  // still sees them (to review / unban); the author sees their own.
  // A timed ban that already expired doesn't hide anything.
  const callerIsOp = !!caller && isOperator(env, caller);
  rows = rows.filter((r) => {
    if (!isBanActive({ banned: r.author_banned, banned_until: r.author_banned_until })) return true;
    return !!caller && (caller.id === r.profile_id || callerIsOp);
  });
  if (profileId) rows = rows.filter((r) => r.profile_id === profileId);
  if (before) rows = rows.filter((r) => r.id < before);
  rows = rows.filter((r) => {
    const k = r.kind ?? "forum";
    if (wantsAdult) return k === "adult";
    if (k === "adult") return false;
    if (kind) return k === kind;
    return true;
  });
  if (category && !profileId) rows = rows.filter((r) => r.category === category);
  if (tag) {
    const want = tag.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    rows = rows.filter((r) => parseTags(r.tags).includes(want));
  }
  // Creator filters (v3): creator-only feed, and filter by content genre.
  // Creator posts are adult posts, so these only ever apply inside the
  // age-verified adult scope above — a non-verified caller already got [].
  if (onlyCreator) rows = rows.filter((r) => r.is_creator === 1);
  if (genre) rows = rows.filter((r) => (r.content_genre ?? "") === genre);
  // Friends feed — only posts by people the viewer added as friends,
  // plus the viewer's own posts. Guests (no profile) get nothing here;
  // the Friends pill is hidden for them. A missing friends table (the
  // v3.6 migration hasn't run yet) also yields nothing, never a crash.
  if (friendsOnly) {
    const me = deviceId ? await profileByDevice(db, deviceId) : null;
    if (!me) return json({ posts: [] });
    let friendIds = [];
    try {
      const { results } = await db.prepare("SELECT friend_id FROM friends WHERE profile_id = ?").bind(me.id).all();
      friendIds = (results || []).map((r) => r.friend_id);
    } catch { friendIds = []; }
    const allowed = new Set(friendIds);
    allowed.add(me.id);
    rows = rows.filter((r) => allowed.has(r.profile_id));
  }
  // Feed redesign (v3.14) — friends-only posts only show to the author,
  // their friends, and the operator. Guests and strangers never see them
  // through any listing (tag pages and Card Check use this same list).
  rows = await filterVisiblePosts(db, caller, rows);
  const shaped = [];
  const badgeMap = await badgesForProfiles(db, rows.map((r) => r.author_id));
  for (const r of rows) {
    shaped.push(await shapePost(db, r, { id: r.author_id, username: r.author_username, occupation: r.author_occupation, avatar_blob_key: r.author_avatar, badges: badgeMap.get(r.author_id) || [] }));
  }
  shaped.sort((a, b) => {
    if (sort === "top") return b.score - a.score || b.id - a.id;
    if (sort === "discussed") return b.comment_count - a.comment_count || b.id - a.id;
    return b.id - a.id;
  });
  // Member feed (v3.20) — the page needs to know whether there's another
  // page (endless scroll) and that the feed is visible to this viewer.
  // The main feed's shape is unchanged when profile_id isn't passed.
  if (profileId) return json({ posts: shaped.slice(0, limit), has_more: shaped.length > limit, feed_visible: true });
  return json({ posts: shaped.slice(0, limit) });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, post_id: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first — posting needs a username.");
  // Silence (v3.18) — a silenced member can't post until it expires.
  const silenced = silenceCheck(me);
  if (silenced) return fail(silenced);
  // Ban (v3.18) — a banned member can't post at all.
  const banned = bannedMemberCheck(me);
  if (banned) return fail(banned);
  const kind = ["forum", "card_auth", "adult", "event", "announcement"].includes(a.kind) ? a.kind : "forum";
  // Announcements are operator-only (Chris). The pill only renders for
  // the operator, but the gate lives here — a forged request gets a 403.
  if (kind === "announcement" && !isOperator(env, me)) return fail("Announcements are for the operator only.");
  const title = String(a.title || "").trim();
  const body = String(a.body || "").trim();
  if (title.length < 3 || title.length > 120) return fail("Title needs 3–120 characters.");
  if (body.length < 1 || body.length > 4000) return fail("Write something in the post (up to 4000 characters).");
  if (kind === "card_auth" && !a.image) return fail("Card Check posts need a clear photo of the card — front is best, add back details in the description.");
  if (kind === "adult") {
    if (me.age_verified !== 1) return fail("The 18+ area is for age-verified members only. Verify your age with a photo ID first (Rules & After Dark) — a typed birthday alone is never enough.");
    if (!ADULT_CATEGORIES.includes(a.category)) return fail("Pick one of the adult forum's corners.");
  } else if (!CATEGORIES.includes(a.category)) {
    return fail("Pick one of the street's corners.");
  }
  const tags = normalizeTags(a.tags || []).join(",");
  let imageKey = null;
  if (a.image) {
    const up = await putImage(env, "post-images", String(a.device_id), a.image, 2500000);
    if (!up.ok) return fail(up.error);
    imageKey = up.key;
  }
  // Short video clip (v3.5) — MP4 / WebM / MOV, max 15 MB, max 60s
  // (the 60s limit is checked in the browser before upload).
  let videoKey = null;
  if (a.video) {
    const up = await putVideo(env, "post-videos", String(a.device_id), a.video, 15000000);
    if (!up.ok) return fail(up.error);
    videoKey = up.key;
  }

  // Insert with graceful fallback for columns the live D1 table doesn't
  // have yet (Chris runs migrations by hand). combos lists, in try order,
  // which optional columns to leave out of the INSERT. Returns
  // { post_id, videoSkipped } — videoSkipped is true when the winning
  // attempt left out video_blob_key. Throws the last missing-column error
  // when every attempt fails; any other error throws immediately.
  const missingCol = (e) => /no such column|no column named/i.test(String((e && e.message) || e));
  const tryInsert = async (cols, vals, combos) => {
    let lastErr = null;
    for (const combo of combos) {
      const c2 = cols.filter((col) => combo.drop.indexOf(col) === -1);
      const v2 = vals.filter((_, i) => combo.drop.indexOf(cols[i]) === -1);
      try {
        const r = await db.prepare(`INSERT INTO posts (${c2.join(", ")}) VALUES (${c2.map(() => "?").join(", ")})`).bind(...v2).run();
        return { post_id: r.meta.last_row_id, videoSkipped: combo.drop.indexOf("video_blob_key") !== -1, dropped: combo.drop };
      } catch (e) {
        if (!missingCol(e)) throw e;
        lastErr = e;
      }
    }
    throw lastErr;
  };
  // Success JSON for a post insert — video_skipped is only set when a
  // video was actually picked AND the insert had to drop the video
  // column (the v3.5 migration hasn't run yet). event_skipped is the
  // same deal for event date/time/place (the post-types migration
  // hasn't run yet). Never silently dropped.
  const insertDone = async (res, hadEvent) => {
    const out = { ok: true, error: null, post_id: res.post_id };
    if (res.videoSkipped && videoKey) out.video_skipped = true;
    if (hadEvent && res.dropped && res.dropped.indexOf("event_date") !== -1) out.event_skipped = true;
    // Lucre (v3.11) — 10 for posting, once per post. Best-effort: a
    // missing ledger table never breaks the post.
    const lw = await awardLucre(db, me.id, LUCRE_AWARDS.post, "post", String(res.post_id));
    if (lw.awarded) out.lucre = { awarded: true, balance: lw.balance };
    return json(out);
  };
  const now = nowMs();
  const flair = String(a.flair || "").slice(0, 30);
  const vs = String(a.verification_status || "not_checked").slice(0, 40);
  const vsum = String(a.verification_summary || "").slice(0, 800);

  // Creator post (v3) — adult only, age-verified only (checked above
  // for kind=adult). Title keeps emojis as-is; the genre comes from the
  // picker; tags are the seller's own (max 8); price is integer dollars
  // (0 = free); an optional 3D print file rides along in R2.
  const isCreator = a.is_creator === true && kind === "adult";
  if (a.is_creator === true && kind !== "adult") {
    return fail("Creator posts live in the 18+ forum — they can't be general posts.");
  }
  if (isCreator) {
    const genre = CREATOR_GENRES.includes(a.content_genre) ? a.content_genre : "";
    if (!genre) return fail("Pick what kind of content this is — photos, videos, custom, audio, 3D models, 3D print files, developer files, designs, art, apps, game assets, adult content, or other.");
    const priceCents = Number.isInteger(a.price_cents) ? a.price_cents : Math.round(Number(a.price_cents || 0));
    if (!Number.isFinite(priceCents) || priceCents < 0 || priceCents > 10000000) {
      return fail("Price needs to be 0 (free) up to $100,000, in whole dollars.");
    }
    // Blur + pay-to-unlock (v3.2) — OPT-IN ONLY, both default off. A photo
    // is never blurred or paywalled unless the seller explicitly ticked
    // the box when posting. Pay-to-unlock only takes effect with a price
    // above $0; a $0 post with the box ticked just stays free and visible.
    const blurPhoto = a.blur_photo === true ? 1 : 0;
    const payUnlock = (a.pay_unlock === true && priceCents > 0) ? 1 : 0;
    const creatorTags = normalizeCreatorTags(a.tags || []).join(",");
    let fileKey = null, fileName = "", fileMime = "", fileSize = 0;
    if (a.print_file) {
      const up = await putPrintFile(env, String(a.device_id), a.print_file, 25000000);
      if (!up.ok) return fail(up.error);
      fileKey = up.key; fileName = up.fileName; fileMime = up.mime; fileSize = up.size;
    }
    // v3.2 blur/pay-unlock columns sit in the list like any other column
    // now (the tryInsert combos below drop them when the live table
    // doesn't have them yet, same as video_blob_key).
    const creatorCols = ["profile_id", "category", "kind", "flair", "tags", "image_blob_key", "video_blob_key", "gif_url", "gif_label", "verification_status", "verification_summary", "title", "body", "blur_photo", "pay_unlock", "is_creator", "content_genre", "price_cents", "file_blob_key", "file_name", "file_mime", "file_size", "created_at", "updated_at"];
    const creatorVals = [me.id, a.category, kind, flair, creatorTags, imageKey, videoKey,
      a.gif_url ? String(a.gif_url).slice(0, 500) : null,
      String(a.gif_label || "").slice(0, 80), vs, vsum, title, body,
      blurPhoto, payUnlock,
      1, genre, priceCents, fileKey, fileName, fileMime, fileSize, now, now];
    let creatorRes;
    try {
      creatorRes = await tryInsert(creatorCols, creatorVals, [
        { drop: [] },
        { drop: ["video_blob_key"] },
        { drop: ["blur_photo", "pay_unlock"] },
        { drop: ["video_blob_key", "blur_photo", "pay_unlock"] },
      ]);
    } catch (e) {
      // Every attempt hit a missing column — v3 columns not there yet.
      if (missingCol(e)) return fail("Creator posts aren't set up yet — the shop is still running a quick database update. Try again later.");
      throw e;
    }
    // @mentions in the post body (v3.8) — skips quietly if the table isn't there yet.
    await notifyMentions(db, me, body, { ref_type: "post", ref_id: creatorRes.post_id, label: "in a post", link: `#/thread/${creatorRes.post_id}` });
    // Operator alert (v3.8) — new sellable content: tell Chris so he can
    // check it against the rules. Skips quietly if the table isn't there
    // yet, and never notifies him about his own posts.
    await createNotification(db, {
      profile_id: 1, actor_profile_id: me.id, kind: "new_content",
      ref_type: "post", ref_id: creatorRes.post_id,
      text: `@${me.username} listed new content — ${title}`,
      link: `#/thread/${creatorRes.post_id}`,
    });
    return insertDone(creatorRes);
  }

  // Blur (v3.2) — OPT-IN ONLY, off by default. Stored on any post with a
  // photo; a post with no photo just carries 0 and nothing changes.
  const blurPhoto = a.blur_photo === true ? 1 : 0;
  // Event fields — only on kind="event"; empty strings become NULL.
  const evDate = kind === "event" ? String(a.event_date || "").trim().slice(0, 120) : "";
  const evTime = kind === "event" ? String(a.event_time || "").trim().slice(0, 120) : "";
  const evPlace = kind === "event" ? String(a.event_place || "").trim().slice(0, 120) : "";
  const regCols = ["profile_id", "category", "kind", "flair", "tags", "image_blob_key", "video_blob_key", "gif_url", "gif_label", "verification_status", "verification_summary", "title", "body", "blur_photo", "event_date", "event_time", "event_place", "created_at", "updated_at"];
  const regVals = [me.id, a.category, kind, flair, tags, imageKey, videoKey,
    a.gif_url ? String(a.gif_url).slice(0, 500) : null,
    String(a.gif_label || "").slice(0, 80), vs, vsum, title, body, blurPhoto,
    evDate || null, evTime || null, evPlace || null, now, now];
  // v3.2 blur column / v3.5 video column / post-types event columns not
  // there yet — retry without them so posting never breaks (video_skipped
  // / event_skipped tells the client).
  const regRes = await tryInsert(regCols, regVals, [
    { drop: [] },
    { drop: ["video_blob_key"] },
    { drop: ["blur_photo"] },
    { drop: ["video_blob_key", "blur_photo"] },
    { drop: ["event_date", "event_time", "event_place"] },
    { drop: ["video_blob_key", "event_date", "event_time", "event_place"] },
    { drop: ["blur_photo", "event_date", "event_time", "event_place"] },
    { drop: ["video_blob_key", "blur_photo", "event_date", "event_time", "event_place"] },
  ]);
  // @mentions in the post body (v3.8) — skips quietly if the table isn't there yet.
  await notifyMentions(db, me, body, { ref_type: "post", ref_id: regRes.post_id, label: "in a post", link: `#/thread/${regRes.post_id}` });
  // Operator alert (v3.8) — a new post went up: tell Chris so he can
  // check it against the rules. Skips quietly if the table isn't there
  // yet, and never notifies him about his own posts.
  await createNotification(db, {
    profile_id: 1, actor_profile_id: me.id, kind: "new_post",
    ref_type: "post", ref_id: regRes.post_id,
    text: `@${me.username} posted — ${title}`,
    link: `#/thread/${regRes.post_id}`,
  });
  return insertDone(regRes, !!(evDate || evTime || evPlace));
}
