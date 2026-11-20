// GET + POST /api/picture-hearts — heart or nothing on pictures.
// Pictures (v3.16): the profile picture ("avatar") and public gallery
// photos ("gallery:<id>") as seen in the picture viewer. Heart or
// nothing — no sad, no confused, no thumbs-down, no bad reacts of any
// kind. One heart per person per picture; tapping again takes it off.
// Only a NEW heart notifies the picture owner and pays the 5 Lucre
// (once per picture, as with posts and comments).
// The migration must run first: until picture_hearts exists, GET reads
// 0 hearts and POST answers "not switched on yet".
import { json, noDb, getDb, readJson, profileByDevice, createNotification, awardLucre, LUCRE_AWARDS, togglePictureHeart, pictureHeartCounts, pictureMyHeart } from "./_lib.js";

// A picture is (owner_id, subject). Subject is "avatar", or
// "gallery:<id>" where the gallery row must belong to the owner.
async function checkPicture(db, ownerId, subject) {
  const owner = await db.prepare("SELECT id FROM profiles WHERE id = ? LIMIT 1").bind(ownerId).first();
  if (!owner) return "That member doesn't exist.";
  if (subject === "avatar") return null;
  const m = /^gallery:(\d+)$/.exec(subject || "");
  if (!m) return "That picture doesn't exist.";
  const row = await db.prepare("SELECT id FROM gallery_photos WHERE id = ? AND profile_id = ? LIMIT 1").bind(Number(m[1]), ownerId).first();
  if (!row) return "That photo is gone.";
  return null;
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const ownerId = Number(q.get("owner_id"));
  const subject = String(q.get("subject") || "");
  if (!ownerId || !subject) return json({ ok: false, error: "Pick a picture first.", hearts: 0, my_heart: false });
  const bad = await checkPicture(db, ownerId, subject);
  if (bad) return json({ ok: false, error: bad, hearts: 0, my_heart: false });
  const deviceId = String(q.get("device_id") || "");
  const me = deviceId ? await profileByDevice(db, deviceId) : null;
  return json({ ok: true, error: null, hearts: await pictureHeartCounts(db, ownerId, subject), my_heart: await pictureMyHeart(db, ownerId, subject, me ? me.id : null) });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, hearts: 0, my_heart: false });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to heart pictures.");
  const ownerId = Number(a.owner_id);
  const subject = String(a.subject || "");
  if (!ownerId || !subject) return fail("Pick a picture first.");
  const bad = await checkPicture(db, ownerId, subject);
  if (bad) return fail(bad);
  const toggled = await togglePictureHeart(db, me, ownerId, subject);
  if (!toggled) return fail("Picture hearts aren't switched on yet — run the update first.");
  if (toggled.my_heart) {
    await createNotification(db, {
      profile_id: ownerId, actor_profile_id: me.id, kind: "heart",
      ref_type: "picture", ref_id: ownerId,
      text: `@${me.username} hearted your picture`,
      link: `#/member/${ownerId}`,
    });
    await awardLucre(db, me.id, LUCRE_AWARDS.heart, "heart", "picture:" + ownerId + ":" + subject);
  }
  return json({ ok: true, error: null, hearts: toggled.hearts, my_heart: toggled.my_heart });
}
