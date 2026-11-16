// GET /api/images?key= — streams an image from the IMAGES R2 bucket.
// ID-review photos are NEVER served here (they live in the separate
// ID_VAULT bucket and are only viewable through the operator-only
// /api/age-verification/id-image endpoint).

export async function onRequestGet({ env, request }) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key || key.startsWith("id-review/") || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  if (!env.IMAGES) return new Response("Image storage is being set up", { status: 503 });
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=86400");
  return new Response(obj.body, { headers });
}
