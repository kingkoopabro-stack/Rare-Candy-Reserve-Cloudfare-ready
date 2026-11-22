// GET /api/watermarked?key=&cs=&device_id= — burned-in watermarked copy
// (v2, DORMANT — not live yet).
//
// This serves the R2 image with the watermark burned into the PIXELS via
// the Cloudflare Images binding (env.RCR_IMAGES): the Rare Candy logo
// tiled diagonally across the whole image, plus RareCandyReserve.org,
// "redistribution of this is punishable by law", and "@buyer - CS#N".
// Only the buyer who owns that CS#, the post's author, or the operator
// may fetch it, and the key must be that sale's own image.
//
// NOT switched on yet: the Images binding isn't connected — it needs a
// paid Cloudflare Images subscription plus a dashboard binding named
// RCR_IMAGES on this Pages project (it must NOT be named IMAGES — that
// name is already the R2 bucket). Until then this answers 501 and the
// on-screen overlay watermark (community.js) is the active layer.
// Flipping it on is a dashboard change, not a code change — but the
// client doesn't call this endpoint yet; wiring it in is a follow-up
// once the binding exists.
//
// Limits, stated plainly: the Images binding works on IMAGES only —
// there is no burned-in path for video in this stack (Cloudflare Stream
// isn't used here, and it doesn't burn watermarks either). Video relies
// on the moving on-screen watermark. There is also no DRM video in this
// stack — that would need a third-party DRM license provider and
// encrypted packaging, which is out of scope for this build.
import { json, noDb, getDb, profileByDevice, isOperator } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  if (!env.RCR_IMAGES) {
    return json({ ok: false, error: "Burned-in watermarking isn't switched on yet — the Images binding (RCR_IMAGES) isn't connected. The on-screen watermark still applies." }, 501);
  }
  const q = new URL(request.url).searchParams;
  const key = q.get("key") || "";
  const cs = Number(q.get("cs") || 0);
  if (!key || key.includes("..") || key.startsWith("id-review/")) return new Response("Not found", { status: 404 });
  if (!cs) return json({ ok: false, error: "A sale number (CS#) is required." }, 400);
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first." }, 401);
  let sale = null;
  try {
    sale = await db.prepare("SELECT * FROM content_sales WHERE cs_number = ? LIMIT 1").bind(cs).first();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: "Content sales aren't set up yet." }, 503);
    throw e;
  }
  if (!sale) return json({ ok: false, error: "No sale with that number." }, 404);
  const post = await db.prepare("SELECT author_id, image_blob_key FROM posts WHERE id = ? LIMIT 1").bind(sale.post_id).first();
  if (!post || post.image_blob_key !== key) return new Response("Not found", { status: 404 });
  const allowed = me.id === sale.buyer_id || me.id === post.author_id || isOperator(env, me);
  if (!allowed) return json({ ok: false, error: "That copy isn't yours." }, 403);
  if (!env.IMAGES) return new Response("Image storage is being set up", { status: 503 });
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const logoRes = await fetch(new URL("/apple-touch-icon.png", request.url));
  if (!logoRes.ok || !logoRes.body) return new Response("Logo unavailable", { status: 502 });
  const out = await env.RCR_IMAGES.input(obj.body)
    .draw(env.RCR_IMAGES.input(logoRes.body).transform({ width: 90, rotate: 30 }), { repeat: true, opacity: 0.28 })
    .draw(env.RCR_IMAGES.text("RareCandyReserve.org", { color: "#ffffff", size: 42 }), { top: 40, left: 40, opacity: 0.85 })
    .draw(env.RCR_IMAGES.text("redistribution of this is punishable by law", { color: "#ffffff", size: 30 }), { top: 100, left: 40, opacity: 0.85 })
    .draw(env.RCR_IMAGES.text("@" + sale.buyer_username + " - CS#" + sale.cs_number, { color: "#ffe45e", size: 34 }), { bottom: 40, left: 40, opacity: 0.9 })
    .output({ format: "image/jpeg", quality: 85 });
  return out.response();
}
