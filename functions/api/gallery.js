// Public gallery photos (v3.9).
// The Taffy Phone Gallery is session-only (photos live 10 minutes in the
// browser, nothing uploaded). "Make public" on a phone photo uploads it
// here (R2, same putImage pattern as avatars) and records it as a public
// gallery photo for that profile. The picture viewer on a member page
// reads this list (max 3) so visitors can scroll through the owner's
// pictures. Gallery photos are hearted in the viewer (v3.16 — heart or
// nothing, via /api/picture-hearts); the phone Gallery app itself stays
// session-only and has no hearts.
// VISIBILITY (2026-11-21) — four levels per picture, enforced HERE
// server-side (the viewer only hides what this endpoint already
// withheld):
//   public  — anyone, including guests.
//   friends — friends only.
//   members — signed-in members only (account holders).
//   private — the account owner + the operator only. A personal stash
//     for temporary photos; the owner re-downloads a copy later if they
//     lose the original (download is a LATER feature, not built yet).
// The profile picture follows its ROLE, not its position: whichever
// photo is currently the avatar can only be Friends or Members — never
// Public, never Private (PUT refuses both, and setting a photo as the
// avatar coerces a Public/Private visibility to Members).
// 18+ CONTAINMENT (2026-11-21): an adult creator's pictures are 18+
// content — only the owner, the operator, or a signed-in + ID-verified
// member sees any of them (same gate as the profile page).
// NOTE: /api/images still serves raw R2 bytes to anyone with the URL —
// a direct link bypasses this gate (pre-existing limitation, same as
// the watermark work noted). This endpoint never hands the URL out to
// someone who shouldn't see the picture, but it can't un-share a URL
// that already leaked.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, isFriendWith, putImage, imageUrl, iso, nowMs, adultCreatorIds } from "./_lib.js";

const MAX_PHOTOS = 3;

const VISIBILITIES = ["public", "friends", "members", "private"];

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const profileId = Number(url.searchParams.get("profile_id"));
  if (!profileId) return json({ ok: false, error: "Pick a member first.", photos: [] });
  const viewer = url.searchParams.get("device_id") ? await profileByDevice(db, url.searchParams.get("device_id")) : null;
  const ownerRow = await db.prepare("SELECT avatar_blob_key FROM profiles WHERE id = ? LIMIT 1").bind(profileId).first();
  const avatarKey = ownerRow?.avatar_blob_key || null;
  let rows = [];
  try {
    const r = await db.prepare("SELECT * FROM gallery_photos WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?").bind(profileId, MAX_PHOTOS).all();
    rows = r.results || [];
  } catch { return json({ ok: true, photos: [] }); /* table not there yet */ }
  const isOwner = !!viewer && viewer.id === profileId;
  const isOp = !!viewer && isOperator(env, viewer);
  // 18+ containment: an adult creator's pictures are 18+ content — only
  // the owner, the operator, or a signed-in + ID-verified member sees
  // any of them. Guests and non-verified members get nothing.
  const canViewAdult = isOwner || isOp || (!!viewer && viewer.age_verified === 1);
  const isAdultCreator = (await adultCreatorIds(db, [profileId])).has(profileId);
  if (isAdultCreator && !canViewAdult) return json({ ok: true, total: 0, photos: [] });
  // Per-picture visibility: the owner + operator see everything; friends
  // see public + friends-only (+ members, which any signed-in member
  // sees); signed-in members see public + members; guests see public
  // only. Rows written before the visibility column existed read as public.
  let isFriend = false;
  if (!isOwner && viewer) isFriend = await isFriendWith(db, viewer.id, profileId);
  const visible = rows.filter((p) => {
    const v = p.visibility || "public";
    if (v === "public") return true;
    if (v === "friends") return isOwner || isOp || isFriend;
    if (v === "members") return isOwner || isOp || !!viewer;
    return isOwner || isOp; // private: owner + operator only
  });
  // total is the VISIBLE count — it never leaks how many hidden photos a
  // profile has. The owner sees everything, so their stored count (the
  // 3-photo cap) still reads correctly.
  return json({
    ok: true,
    total: visible.length,
    photos: visible.map((p) => ({ id: p.id, url: imageUrl(p.blob_key), caption: p.caption ?? "", visibility: p.visibility || "public", is_avatar: avatarKey ? p.blob_key === avatarKey : false, created_at: iso(p.created_at) })),
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
  const visibility = VISIBILITIES.includes(a.visibility) ? a.visibility : "public";
  let count = 0;
  try {
    const c = await db.prepare("SELECT COUNT(*) AS n FROM gallery_photos WHERE profile_id = ?").bind(me.id).first();
    count = c?.n || 0;
  } catch { return json({ ok: false, error: "Public photos aren't switched on yet — run the v3.9 update first." }); }
  if (count >= MAX_PHOTOS) return json({ ok: false, error: "You've reached the 3-photo limit — delete one to add another." });
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

// PUT /api/gallery — change a published photo's visibility and/or its
// short description (caption, 140 chars). Owner or operator only.
// Visibility is public / friends / members / private. The photo that is
// currently the profile picture can only be Friends or Members — Public
// and Private are refused on it with a plain message (the pfp follows
// its role, not its position in the gallery).
export async function onRequestPut({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!me) return json({ ok: false, error: "Sign in first." });
  const id = Number(a.id);
  if (!id) return json({ ok: false, error: "Pick a photo first." });
  const hasVisibility = a.visibility !== undefined && a.visibility !== null;
  const hasCaption = a.caption !== undefined && a.caption !== null;
  const visibility = hasVisibility ? (VISIBILITIES.includes(a.visibility) ? a.visibility : null) : null;
  if (hasVisibility && !visibility) return json({ ok: false, error: "Pick Public, Friends, Members, or Private." });
  if (!hasVisibility && !hasCaption) return json({ ok: false, error: "Nothing to change." });
  const caption = hasCaption ? String(a.caption || "").trim().slice(0, 140) : null;
  const row = await db.prepare("SELECT * FROM gallery_photos WHERE id = ? LIMIT 1").bind(id).first();
  if (!row) return json({ ok: false, error: "That photo is gone already." });
  if (me.id !== row.profile_id && !isOperator(env, me)) return json({ ok: false, error: "Only the owner or the operator can change this photo." });
  // The profile picture follows its role: whichever photo is the avatar
  // can only be Friends or Members — never Public, never Private.
  if (visibility === "public" || visibility === "private") {
    const owner = await db.prepare("SELECT avatar_blob_key FROM profiles WHERE id = ? LIMIT 1").bind(row.profile_id).first();
    if (owner?.avatar_blob_key && owner.avatar_blob_key === row.blob_key) {
      return json({ ok: false, error: "Your profile picture can only be Friends or Members — pick one of those." });
    }
  }
  try {
    if (hasVisibility && hasCaption) {
      await db.prepare("UPDATE gallery_photos SET visibility = ?, caption = ? WHERE id = ?").bind(visibility, caption, id).run();
    } else if (hasVisibility) {
      await db.prepare("UPDATE gallery_photos SET visibility = ? WHERE id = ?").bind(visibility, id).run();
    } else {
      await db.prepare("UPDATE gallery_photos SET caption = ? WHERE id = ?").bind(caption, id).run();
    }
  } catch {
    return json({ ok: false, error: "Photo visibility needs the gallery update — run the visibility migration first." });
  }
  const out = { id };
  if (hasVisibility) out.visibility = visibility;
  if (hasCaption) out.caption = caption;
  return json({ ok: true, error: null, photo: out });
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
  // If the deleted photo was the member's profile picture, clear the
  // avatar too — NO photo is auto-promoted to pfp. The avatar slot
  // shows the VNR logo + "Upload a new pfp" until the member picks
  // another uploaded picture and sets it as their pfp.
  let clearedAvatar = false;
  const owner = await db.prepare("SELECT avatar_blob_key FROM profiles WHERE id = ? LIMIT 1").bind(row.profile_id).first();
  if (owner?.avatar_blob_key && owner.avatar_blob_key === row.blob_key) {
    await db.prepare("UPDATE profiles SET avatar_blob_key = NULL, updated_at = ? WHERE id = ?").bind(nowMs(), row.profile_id).run();
    clearedAvatar = true;
  }
  return json({ ok: true, error: null, cleared_avatar: clearedAvatar });
}
