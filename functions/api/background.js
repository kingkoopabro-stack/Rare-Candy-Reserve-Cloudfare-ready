// Background picture upload (2026-11-23) — Edit Profile > Page
// background > "Upload a picture". One image per upload, stored in the
// IMAGES R2 bucket under the "backgrounds/" prefix (same putImage
// pattern as gallery photos, same 2.5 MB cap). No D1 table: the
// returned URL is stored in the member's profile theme as
// bg_image_url when they save — the background lives or dies with the
// theme, like a pasted URL does. Old uploads are orphaned in R2 when
// a member replaces their background (same as a replaced gallery
// photo's old bytes); there is no delete endpoint yet.
// The URL is absolute (request origin + /api/images?key=...) because
// the theme parser only accepts https:// background URLs.
// Sign-in only: the caller must be a member (device_id). Any member
// can upload their own background — no age gate here, same as a
// pasted background URL (the URL paste has no gate either).
import { json, noDb, getDb, readJson, profileByDevice, putImage, imageUrl } from "./_lib.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!me) return json({ ok: false, error: "Sign in to upload a background picture." });
  if (!a.image) return json({ ok: false, error: "No picture attached." });
  const up = await putImage(env, "backgrounds", String(a.device_id), a.image, 2500000);
  if (!up.ok) return json({ ok: false, error: up.error });
  const origin = new URL(request.url).origin;
  return json({ ok: true, error: null, url: origin + imageUrl(up.key), key: up.key });
}
