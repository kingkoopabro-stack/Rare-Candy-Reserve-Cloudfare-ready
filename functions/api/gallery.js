// Public gallery photos (v3.9).
// The Taffy Phone Gallery is session-only (photos live 10 minutes in the
// browser, nothing uploaded). "Make public" on a phone photo uploads it
// here (R2, same putImage pattern as avatars) and records it as a public
// gallery photo for that profile. The picture viewer on a member page
// reads this list (public only, max 20) so visitors can scroll through
// the owner's public pictures. Nothing here is ever a like target —
// gallery photos have comments only, never likes.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, putImage, imageUrl, iso, nowMs } from "./_lib.js";

const MAX_PUBLIC = 20;

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const profileId = Number(new URL(request.url).searchParams.get("profile_id"));
  if (!profileId) return json({ ok: false, error: "Pick a member first.", photos: [] });
  let rows = [];
  try {
    const r = await db.prepare("SELECT * FROM gallery_photos WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?").bind(profileId, MAX_PUBLIC).all();
    rows = r.results || [];
  } catch { return json({ ok: true, photos: [] }); /* table not there yet */ }
  return json({
    ok: true,
    photos: rows.map((p) => ({ id: p.id, url: imageUrl(p.blob_key), caption: p.caption ?? "", created_at: iso(p.created_at) })),
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!me) return json({ ok: false, error: "Sign in to make a photo public." });
  if (!a.image) return json({ ok: false, error: "No photo attached." });
  const caption = String(a.caption || "").trim().slice(0, 80);
  let count = 0;
  try {
    const c = await db.prepare("SELECT COUNT(*) AS n FROM gallery_photos WHERE profile_id = ?").bind(me.id).first();
    count = c?.n || 0;
  } catch { return json({ ok: false, error: "Public photos aren't switched on yet — run the v3.9 update first." }); }
  if (count >= MAX_PUBLIC) return json({ ok: false, error: "Your public gallery holds 20 photos — remove one first." });
  const up = await putImage(env, "gallery", String(a.device_id), a.image, 2500000);
  if (!up.ok) return json({ ok: false, error: up.error });
  let photoId = null;
  try {
    const r = await db.prepare("INSERT INTO gallery_photos (profile_id, blob_key, caption, created_at) VALUES (?, ?, ?, ?)")
      .bind(me.id, up.key, caption, nowMs()).run();
    photoId = r.meta.last_row_id;
  } catch {
    return json({ ok: false, error: "Public photos aren't switched on yet — run the v3.9 update first." });
  }
  return json({ ok: true, error: null, photo: { id: photoId, url: imageUrl(up.key), caption, created_at: iso(nowMs()) } });
}

export async function onRequestDelete({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const deviceId = url.searchParams.get("device_id") || "";
  const me = deviceId ? await profileByDevice(db, deviceId) : null;
  if (!me || !id) return json({ ok: false, error: "Sign in first." });
  const row = await db.prepare("SELECT * FROM gallery_photos WHERE id = ? LIMIT 1").bind(id).first();
  if (!row) return json({ ok: false, error: "That photo is gone already." });
  if (me.id !== row.profile_id && !isOperator(env, me)) return json({ ok: false, error: "Only the owner or the operator can remove a public photo." });
  await db.prepare("DELETE FROM gallery_photos WHERE id = ?").bind(id).run();
  return json({ ok: true, error: null });
}
