// GET /api/files?key= — downloads a 3D print file attached to a creator
// post. Serves R2 objects under the "3d/" prefix only (the IMAGES bucket
// also holds photos, which are served by /api/images instead). Age gate:
// the caller must be age-verified — 3D print files on creator posts are
// adult-area content. The response is a download (Content-Disposition:
// attachment) with the original filename.
export async function onRequestGet({ env, request }) {
  const q = new URL(request.url).searchParams;
  const key = q.get("key") || "";
  if (!key || !key.startsWith("3d/") || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  if (!env.IMAGES) return new Response("File storage is being set up", { status: 503 });
  const db = env.DB || null;
  if (db) {
    const deviceId = q.get("device_id") || "";
    if (!deviceId) return new Response("Age-verified members only", { status: 403 });
    const me = await db.prepare("SELECT age_verified FROM profiles WHERE device_id = ? LIMIT 1").bind(deviceId).first();
    if (!me || me.age_verified !== 1) return new Response("Age-verified members only", { status: 403 });
  }
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  const fileName = key.split("/").pop() || "print-file";
  headers.set("content-disposition", `attachment; filename="${fileName.replace(/"/g, "")}"`);
  headers.set("cache-control", "private, max-age=3600");
  return new Response(obj.body, { headers });
}
