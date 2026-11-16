// GET /api/age-verification/id-image?request_id= — OPERATOR ONLY.
// Streams the pending ID photo from the ID_VAULT R2 bucket so the operator
// can review it. This is the ONLY way the image is ever viewed.
import { getDb, profileByDevice, isOperator } from "../_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return new Response(JSON.stringify({ ok: false, error: "db_unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me || !isOperator(env, me)) return new Response("Not found", { status: 404 });
  const id = Number(q.get("request_id") || 0);
  const row = await db.prepare("SELECT blob_key, status FROM age_verification_requests WHERE id = ? LIMIT 1").bind(id).first();
  if (!row || !row.blob_key || row.status !== "pending") return new Response("Not found", { status: 404 });
  if (!env.ID_VAULT) return new Response("ID vault not bound", { status: 503 });
  const obj = await env.ID_VAULT.get(row.blob_key);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("cache-control", "no-store");
  return new Response(obj.body, { headers });
}
