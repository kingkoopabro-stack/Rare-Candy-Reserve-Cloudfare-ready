// GET /api/images?key= — streams an image (or a post video clip) from the
// IMAGES R2 bucket.
// ID-review photos are NEVER served here (they live in the separate
// ID_VAULT bucket and are only viewable through the operator-only
// /api/age-verification/id-image endpoint).
// HTTP Range: when the request carries a Range header (a <video> seeking),
// the range is passed to R2 and the answer is 206 with Content-Range /
// Accept-Ranges. Requests without Range behave exactly as before.

export async function onRequestGet({ env, request }) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key || key.startsWith("id-review/") || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  if (!env.IMAGES) return new Response("Image storage is being set up", { status: 503 });
  const range = request.headers.get("range");
  if (range) {
    const obj = await env.IMAGES.get(key, { range });
    if (!obj) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("cache-control", "public, max-age=86400");
    headers.set("accept-ranges", "bytes");
    if (obj.range) {
      headers.set("content-range", `bytes ${obj.range.offset}-${obj.range.end}/${obj.size}`);
      headers.set("content-length", String(obj.range.end - obj.range.offset + 1));
      return new Response(obj.body, { status: 206, headers });
    }
    return new Response(obj.body, { headers });
  }
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=86400");
  return new Response(obj.body, { headers });
}
