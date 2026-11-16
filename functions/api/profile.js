// GET /api/profile?device_id= — getMyProfile
// POST /api/profile — saveProfile (create or update the account for a device).
// One account per person: full name (>= 2 chars) + date of birth, unique as
// a pair; username 2-24 [A-Za-z0-9_.-], unique. Full name is never shown
// publicly. New accounts also need the rules agreement + the math
// human-check. No age proof is required to join — only for the 18+ area.
import {
  json, noDb, getDb, readJson, profileByDevice, shapeProfile,
  checkChallenge, putImage, nowMs,
} from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const row = await profileByDevice(db, deviceId);
  return json({ profile: shapeProfile(row) });
}

const USERNAME_RE = /^[A-Za-z0-9_.-]+$/;

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, profile: null });
  const deviceId = String(a.device_id || "");
  if (deviceId.length < 8 || deviceId.length > 128) return fail("Missing device id.");
  const username = String(a.username || "").trim();
  if (username.length < 2 || username.length > 24 || !USERNAME_RE.test(username)) {
    return fail("Username needs 2–24 letters, numbers, _ . or - only.");
  }
  const existing = await profileByDevice(db, deviceId);
  const clash = await db.prepare("SELECT id FROM profiles WHERE username = ? LIMIT 1").bind(username).first();
  if (clash && (!existing || clash.id !== existing.id)) {
    return fail("That username is already taken — try another one.");
  }

  if (!existing) {
    const fullName = String(a.full_name || "").trim();
    if (fullName.length < 2) return fail("Add your full name — one account per person, and name + date of birth is how we keep it that way. Your full name is never shown publicly.");
    if (!a.birthday || !/^\d{4}-\d{2}-\d{2}$/.test(a.birthday)) return fail("Add your date of birth — it pairs with your name for the one-account-per-person rule. Only the month and day are ever shown publicly, never the year.");
    if (!a.terms_agreed) return fail("Tick the agreement box — every member agrees to the street rules when they join.");
    if (!checkChallenge(a.bot_token || "", Number(a.bot_answer))) return fail("That human-check answer wasn't right — grab a fresh question and try again.");
    // One account per person, case-insensitive, whitespace-collapsed.
    const nameKey = fullName.toLowerCase().replace(/\s+/g, " ");
    const { results } = await db.prepare("SELECT full_name, birthday FROM profiles").all();
    const dupe = (results || []).find(
      (p) => (p.full_name || "").trim().toLowerCase().replace(/\s+/g, " ") === nameKey && p.birthday === a.birthday,
    );
    if (dupe) return fail("An account already exists for that name + date of birth — one account per person. If that's you, you're already on the street; if you lost access, that's the account to recover, not a new one.");
  }

  let avatarKey = undefined; // undefined = keep
  if (a.remove_avatar) avatarKey = null;
  else if (a.avatar) {
    const up = await putImage(env, "avatars", deviceId, a.avatar, 1500000);
    if (!up.ok) return fail(up.error);
    avatarKey = up.key;
  }

  const now = nowMs();
  const str = (v, max) => String(v ?? "").trim().slice(0, max);
  let row;
  if (existing) {
    const sets = ["username = ?", "chat_name = ?", "occupation = ?", "bio = ?", "payout_method = ?", "payout_handle = ?", "updated_at = ?"];
    const vals = [username, str(a.chat_name, 24), str(a.occupation, 60), str(a.bio, 280), str(a.payout_method, 40), str(a.payout_handle, 80), now];
    if (!existing.full_name && String(a.full_name || "").trim()) { sets.push("full_name = ?"); vals.push(String(a.full_name).trim().slice(0, 80)); }
    if (a.birthday) { sets.push("birthday = ?"); vals.push(a.birthday); }
    if (a.terms_agreed && !existing.terms_agreed_at) { sets.push("terms_agreed_at = ?"); vals.push(now); }
    if (avatarKey !== undefined) { sets.push("avatar_blob_key = ?"); vals.push(avatarKey); }
    vals.push(existing.id);
    await db.prepare(`UPDATE profiles SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
    row = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(existing.id).first();
  } else {
    const r = await db.prepare(
      `INSERT INTO profiles (device_id, username, full_name, birthday, terms_agreed_at, chat_name, occupation, bio, payout_method, payout_handle, avatar_blob_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(deviceId, username, String(a.full_name).trim().slice(0, 80), a.birthday ?? null, now,
      str(a.chat_name, 24), str(a.occupation, 60), str(a.bio, 280),
      str(a.payout_method, 40), str(a.payout_handle, 80), avatarKey ?? null, now, now).run();
    row = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(r.meta.last_row_id).first();
  }
  if (!row) return fail("Couldn't save that profile — try again.");
  return json({ ok: true, error: null, profile: shapeProfile(row) });
}
