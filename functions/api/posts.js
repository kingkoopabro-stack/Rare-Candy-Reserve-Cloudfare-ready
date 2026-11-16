// GET /api/posts — listPosts (category / kind / tag / sort filters).
// POST /api/posts — createPost.
// ADULT GATE (server-side, not just UI): adult posts are NEVER returned
// unless kind=adult AND the caller is age-verified. Adult posts are
// excluded from every other listing, including tag pages and the front page.
import {
  json, noDb, getDb, readJson, profileByDevice, shapePost,
  CATEGORIES, ADULT_CATEGORIES, normalizeTags, parseTags, putImage, nowMs,
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
  const r = await db.prepare(
    `INSERT INTO posts (profile_id, category, kind, flair, tags, image_blob_key, gif_url, gif_label, verification_status, verification_summary, title, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(me.id, a.category, kind, flair, tags, imageKey,
    a.gif_url ? String(a.gif_url).slice(0, 500) : null,
    String(a.gif_label || "").slice(0, 80), vs, vsum, title, body, now, now).run();
  return json({ ok: true, error: null, post_id: r.meta.last_row_id });
}
