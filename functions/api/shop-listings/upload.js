// POST /api/shop-listings/upload — operator only: upload one listing
// photo or one video clip for the listing editor. Reuses the _lib.js
// putImage / putVideo helpers (same R2 bucket + rules as post photos:
// JPG/PNG/WebP/GIF, max 2.5 MB; MP4/WebM/MOV, max 15 MB).
// Body: { device_id, image?: {dataBase64, mimeType} } or
// { device_id, video?: {dataBase64, mimeType} }.
// Returns { ok, url } — the URL to store in the override's photos[]
// or video field. Served back through /api/images like every other
// community image.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, putImage, putVideo, imageUrl, videoUrl } from "../../_lib.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!me || !isOperator(env, me)) return json({ ok: false, error: "Operator only." });
  if (a.image) {
    const up = await putImage(env, "shop-images", String(a.device_id), a.image, 2500000);
    if (!up.ok) return json({ ok: false, error: up.error });
    return json({ ok: true, url: imageUrl(up.key), key: up.key });
  }
  if (a.video) {
    const up = await putVideo(env, "shop-videos", String(a.device_id), a.video, 15000000);
    if (!up.ok) return json({ ok: false, error: up.error });
    return json({ ok: true, url: videoUrl(up.key), key: up.key });
  }
  return json({ ok: false, error: "Attach a photo or a video clip first." });
}
