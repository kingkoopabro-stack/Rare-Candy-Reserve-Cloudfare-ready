// Public gallery photos (v3.9).
// The Taffy Phone Gallery is session-only (photos live 10 minutes in the
// browser, nothing uploaded). "Make public" on a phone photo uploads it
// here (R2, same putImage pattern as avatars) and records it as a public
// gallery photo for that profile. The picture viewer on a member page
// reads this list (public only, max 20) so visitors can scroll through
// the owner's public pictures. Gallery photos are hearted in the viewer
// (v3.16 — heart or nothing, via /api/picture-hearts); the phone Gallery
// app itself stays session-only and has no hearts.
// v3.21 — each published photo has a visibility: public or friends-only
// (default public). Private is not stored — a Private photo lives only
// in the session gallery. The viewer filters by who is looking.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, isFriendWith, putImage, imageUrl, iso, nowMs } from "./_lib.js";

const MAX_PUBLIC = 20;

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const profileId = Number(url.searchParams.get("profile_id"));
  if (!profileId) return json({ ok: false, error: "Pick a member first.", photos: [] });
  const viewer = url.searchParams.get("device_id") ? await profileByDevice(db, url.searchParams.get("device_id")) : null;
  let rows = [];
  try {
    const r = await db.prepare("SELECT * FROM gallery_photos WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?").bind(profileId, MAX_PUBLIC).all();
    rows = r.results || [];
  } catch { return json({ ok: true, photos: [] }); /* table not there yet */ }
  // Visibility (v3.21): the owner sees everything; friends see public +
  // friends-only; everyone else sees public only. Rows written before
  // the visibility column existed read as public.
  const isOwner = !!viewer && viewer.id === profileId;
  let isFriend = false;
  if (!isOwner && viewer) isFriend = await isFriendWith(db, viewer.id, profileId);
  const visible = rows.filter((p) => {
    const v = p.visibility || "public";
    if (v === "public") return true;
    if (v === "friends") return isOwner || isFriend;
    return isOwner;
  });
  return json({
    ok: true,
    total: rows.length,
    photos: visible.map((p) => ({ id: p.id, url: imageUrl(p.blob_key), caption: p.caption ?? "", visibility: p.visibility || "public", created_at: iso(p.created_at) })),
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!me) return json({ ok: false, error: "Sign in to make a photo public." });
  if (!a.image) return json({ ok: false, error: "No photo attached." });
  const caption = String(a.caption || "").trim().slice(0, 140);
  const visibility = a.visibility === "friends" ? "friends" : "public";
  let count = 0;
  try {
    const c = await db.prepare("SELECT COUNT(*) AS n FROM gallery_photos WHERE profile_id = ?").bind(me.id).first();
    count = c?.n || 0;
  } catch { return json({ ok: false, error: "Public photos aren't switched on yet — run the v3.9 update first." }); }
  if (count >= MAX_PUBLIC) return json({ ok: false, error: "You've reached the 20-photo limit — remove one to add another." });
  const up = await putImage(env, "gallery", String(a.device_id), a.image, 2500000);
  if (!up.ok) return json({ ok: false, error: up.error });
  let photoId = null;
  try {
    const r = await db.prepare("INSERT INTO gallery_photos (profile_id, blob_key, caption, visibility, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(me.id, up.key, caption, visibility, nowMs()).run();
    photoId = r.meta.last_row_id;
  } catch {
    // Table without the visibility column yet (migration not run) —
    // fall back to the old insert; the photo reads back as public.
    try {
      const r2 = await db.prepare("INSERT INTO gallery_photos (profile_id, blob_key, caption, created_at) VALUES (?, ?, ?, ?)")
        .bind(me.id, up.key, caption, nowMs()).run();
      photoId = r2.meta.last_row_id;
    } catch {
      return json({ ok: false, error: "Public photos aren't switched on yet — run the v3.9 update first." });
    }
    return json({ ok: true, error: null, photo: { id: photoId, url: imageUrl(up.key), caption, visibility: "public", created_at: iso(nowMs()) } });
  }
  return json({ ok: true, error: null, photo: { id: photoId, url: imageUrl(up.key), caption, visibility, created_at: iso(nowMs()) } });
}

// PUT /api/gallery — change a published photo's visibility (v3.21).
// Owner or operator only. visibility is "public" or "friends"; Private
// is not stored — setting a photo Private deletes it (see the client).
export async function onRequestPut({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!me) return json({ ok: false, error: "Sign in first." });
  const id = Number(a.id);
  const visibility = a.visibility === "friends" ? "friends" : a.visibility === "public" ? "public" : null;
  if (!id || !visibility) return json({ ok: false, error: "Pick Public or Friends." });
  const row = await db.prepare("SELECT * FROM gallery_photos WHERE id = ? LIMIT 1").bind(id).first();
  if (!row) return json({ ok: false, error: "That photo is gone already." });
  if (me.id !== row.profile_id && !isOperator(env, me)) return json({ ok: false, error: "Only the owner or the operator can change this photo." });
  try {
    await db.prepare("UPDATE gallery_photos SET visibility = ? WHERE id = ?").bind(visibility, id).run();
  } catch {
    return json({ ok: false, error: "Photo visibility needs the gallery update — run the visibility migration first." });
  }
  return json({ ok: true, error: null, photo: { id, visibility } });
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
