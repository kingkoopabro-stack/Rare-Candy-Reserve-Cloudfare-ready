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
  json, noDb, getDb, readJson, profileByDevice, shapePost,
  CATEGORIES, ADULT_CATEGORIES, CREATOR_GENRES, normalizeTags, normalizeCreatorTags,
  parseTags, putImage, putPrintFile, nowMs,
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

  const wantsAdult = kind === "adult";
  let callerVerified = false;
  if (deviceId) {
    const caller = await profileByDevice(db, deviceId);
    callerVerified = !!caller && caller.age_verified === 1;
  }
  if (wantsAdult && !callerVerified) return json({ posts: [] });

  const { results } = await db.prepare(
    `SELECT p.*, a.id AS author_id, a.username AS author_username, a.occupation AS author_occupation, a.avatar_blob_key AS author_avatar
     FROM posts p JOIN profiles a ON a.id = p.profile_id ORDER BY p.id DESC LIMIT 200`,
  ).all();
  let rows = results || [];
  rows = rows.filter((r) => {
    const k = r.kind ?? "forum";
    if (wantsAdult) return k === "adult";
    if (k === "adult") return false;
    if (kind) return k === kind;
    return true;
  });
  if (category) rows = rows.filter((r) => r.category === category);
  if (tag) {
    const want = tag.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    rows = rows.filter((r) => parseTags(r.tags).includes(want));
  }
  // Creator filters (v3): creator-only feed, and filter by content genre.
  // Creator posts are adult posts, so these only ever apply inside the
  // age-verified adult scope above — a non-verified caller already got [].
  if (onlyCreator) rows = rows.filter((r) => r.is_creator === 1);
  if (genre) rows = rows.filter((r) => (r.content_genre ?? "") === genre);
  const shaped = [];
  for (const r of rows) {
    shaped.push(await shapePost(db, r, { id: r.author_id, username: r.author_username, occupation: r.author_occupation, avatar_blob_key: r.author_avatar }));
  }
  shaped.sort((a, b) => {
    if (sort === "top") return b.score - a.score || b.id - a.id;
    if (sort === "discussed") return b.comment_count - a.comment_count || b.id - a.id;
    return b.id - a.id;
  });
  return json({ posts: shaped.slice(0, limit) });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, post_id: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first — posting needs a username.");
  const kind = ["forum", "card_auth", "adult"].includes(a.kind) ? a.kind : "forum";
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
    if (!genre) return fail("Pick what kind of content this is — photos, videos, custom, audio, 3D print files, or other.");
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
    const baseCols = ["profile_id", "category", "kind", "flair", "tags", "image_blob_key", "gif_url", "gif_label", "verification_status", "verification_summary", "title", "body", "is_creator", "content_genre", "price_cents", "file_blob_key", "file_name", "file_mime", "file_size", "created_at", "updated_at"];
    const baseVals = [me.id, a.category, kind, flair, creatorTags, imageKey,
      a.gif_url ? String(a.gif_url).slice(0, 500) : null,
      String(a.gif_label || "").slice(0, 80), vs, vsum, title, body,
      1, genre, priceCents, fileKey, fileName, fileMime, fileSize, now, now];
    const insertCreator = async (withV32) => {
      const cols = withV32 ? [...baseCols.slice(0, 15), "blur_photo", "pay_unlock", ...baseCols.slice(15)] : baseCols;
      const vals = withV32 ? [...baseVals.slice(0, 15), blurPhoto, payUnlock, ...baseVals.slice(15)] : baseVals;
      const r = await db.prepare(`INSERT INTO posts (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).bind(...vals).run();
      return r.meta.last_row_id;
    };
    try {
      const id = await insertCreator(true);
      return json({ ok: true, error: null, post_id: id });
    } catch (e) {
      if (/no such column|no column named/i.test(String((e && e.message) || e))) {
        // v3.2 columns not there yet (v3 ran, v3.2 didn't) — retry without
        // blur/pay-unlock so the post still goes live, just unblurred.
        try {
          const id = await insertCreator(false);
          return json({ ok: true, error: null, post_id: id });
        } catch (e2) {
          if (/no such column|no column named/i.test(String((e2 && e2.message) || e2))) {
            return fail("Creator posts aren't set up yet — the shop is still running a quick database update. Try again later.");
          }
          throw e2;
        }
      }
      throw e;
    }
  }

  // Blur (v3.2) — OPT-IN ONLY, off by default. Stored on any post with a
  // photo; a post with no photo just carries 0 and nothing changes.
  const blurPhoto = a.blur_photo === true ? 1 : 0;
  const regCols = ["profile_id", "category", "kind", "flair", "tags", "image_blob_key", "gif_url", "gif_label", "verification_status", "verification_summary", "title", "body", "blur_photo", "created_at", "updated_at"];
  const regVals = [me.id, a.category, kind, flair, tags, imageKey,
    a.gif_url ? String(a.gif_url).slice(0, 500) : null,
    String(a.gif_label || "").slice(0, 80), vs, vsum, title, body, blurPhoto, now, now];
  try {
    const r = await db.prepare(`INSERT INTO posts (${regCols.join(", ")}) VALUES (${regCols.map(() => "?").join(", ")})`).bind(...regVals).run();
    return json({ ok: true, error: null, post_id: r.meta.last_row_id });
  } catch (e) {
    if (/no such column|no column named/i.test(String((e && e.message) || e))) {
      // v3.2 blur column not there yet — retry without it so posting never breaks.
      const cols2 = regCols.filter((c) => c !== "blur_photo");
      const vals2 = regVals.filter((_, i) => regCols[i] !== "blur_photo");
      const r = await db.prepare(`INSERT INTO posts (${cols2.join(", ")}) VALUES (${cols2.map(() => "?").join(", ")})`).bind(...vals2).run();
      return json({ ok: true, error: null, post_id: r.meta.last_row_id });
    }
    throw e;
  }
}
