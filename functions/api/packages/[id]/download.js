// GET /api/packages/:id/download — download the package zip.
//
// ADDITION beyond the brief's endpoint list (flagged in the build
// report): "My stuff" has to fetch the zip bytes to unzip them
// client-side (JSZip), and /api/files only serves the "3d/" prefix to
// age-verified members with no ownership check. This endpoint serves
// the zip ONLY to: the seller, the operator, or a buyer with a paid
// order or a CS# sale row for this package. Anyone else gets a plain
// refusal — the zip key is never handed out, and the R2 key never
// appears in a URL the buyer can share. Originals are never served:
// the zip IS the scaled copy that was uploaded.
import { json, noDb, getDb, profileByDevice, isOperator } from "../../_lib.js";
import { ADULT_AREA_MSG } from "../../_creator.js";

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return new Response("Community is being set up — check back soon.", { status: 503 });
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return new Response("Create your account first.", { status: 403 });
  if (me.age_verified !== 1 && !isOperator(env, me)) return new Response(ADULT_AREA_MSG, { status: 403 });
  const id = Number(params.id);
  const pkg = await db.prepare("SELECT * FROM creator_packages WHERE id = ? LIMIT 1").bind(id).first();
  if (!pkg) return new Response("That package is gone.", { status: 404 });
  if (!pkg.zip_key) return new Response("That package has no uploaded zip yet.", { status: 404 });
  const allowed = pkg.profile_id === me.id || isOperator(env, me);
  let owned = allowed;
  if (!owned) {
    try {
      const cs = await db.prepare("SELECT id FROM content_sales WHERE package_id = ? AND buyer_id = ? LIMIT 1").bind(id, me.id).first();
      if (cs) owned = true;
    } catch { /* content_sales table not there yet — no purchase to match */ }
  }
  if (!owned) {
    try {
      const o = await db.prepare("SELECT id FROM orders WHERE package_id = ? AND buyer_id = ? AND status IN ('paid', 'shipped', 'delivered') LIMIT 1").bind(id, me.id).first();
      if (o) owned = true;
    } catch { /* orders columns not there yet — no purchase to match */ }
  }
  if (!owned) return new Response("That package isn't yours yet — buy it from the creator's menu first.", { status: 403 });
  if (!env.IMAGES) return new Response("File storage is being set up", { status: 503 });
  const obj = await env.IMAGES.get(pkg.zip_key);
  if (!obj) return new Response("That package file is gone.", { status: 404 });
  const safeName = String(pkg.title || "package").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || "package";
  const headers = new Headers();
  headers.set("content-type", "application/zip");
  headers.set("content-disposition", `attachment; filename="${safeName}.zip"`);
  headers.set("cache-control", "private, max-age=3600");
  return new Response(obj.body, { headers });
}
