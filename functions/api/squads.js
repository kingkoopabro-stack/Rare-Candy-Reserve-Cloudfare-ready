// Group Up — Nerd Hub squad finder.
// GET /api/squads?device_id=&platform=&game=&playtime= — browse open squads
//   (plus the caller's own private squads). Guests can browse open squads;
//   only members can create or join. Expired squads are never listed.
// POST /api/squads — create a squad { device_id, platform, game, title,
//   description, is_private, pin, playtime }. Creator auto-joins.
// If the migration hasn't run yet, every call answers a clean
// "not set up yet" instead of crashing.
import {
  json, noDb, getDb, readJson, profileByDevice, nowMs,
  SQUAD_PLATFORMS, SQUAD_PLAYTIMES, SQUAD_MAX_PLAYERS,
  squadIsExpired, shapeSquad,
} from "./_lib.js";

function notSetup() {
  return json({ ok: false, error: "Group Up isn't set up yet — the shop is still running a quick database update." });
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const platform = q.get("platform") || "";
  const game = (q.get("game") || "").trim();
  const playtime = q.get("playtime") || "";
  const me = q.get("device_id") ? await profileByDevice(db, q.get("device_id")) : null;
  try {
    const { results } = await db.prepare(
      "SELECT * FROM squads ORDER BY last_activity_at DESC LIMIT 100",
    ).all();
    const now = nowMs();
    const out = [];
    for (const row of (results || [])) {
      if (squadIsExpired(row, now)) continue;
      const shaped = await shapeSquad(db, row, me?.id || null);
      // Open squads are public; private squads only show to their members.
      if (shaped.is_private && !shaped.is_member) continue;
      if (shaped.member_count >= SQUAD_MAX_PLAYERS) continue;
      if (platform && shaped.platform !== platform) continue;
      if (playtime && shaped.playtime !== playtime) continue;
      if (game && !shaped.game.toLowerCase().includes(game.toLowerCase())) continue;
      out.push(shaped);
    }
    return json({ squads: out });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ squads: [], error: "Group Up isn't set up yet — the shop is still running a quick database update." });
    throw e;
  }
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first — Group Up is for members.");
  const platform = String(a.platform || "").trim();
  if (!SQUAD_PLATFORMS.includes(platform)) return fail("Pick a platform for your group.");
  const game = String(a.game || "").trim();
  if (game.length < 1 || game.length > 100) return fail("Name the game (up to 100 characters).");
  const title = String(a.title || "").trim();
  if (title.length < 3 || title.length > 60) return fail("Give the group a name (3–60 characters).");
  const description = String(a.description || "").trim().slice(0, 200);
  const playtime = String(a.playtime || "").trim();
  if (!SQUAD_PLAYTIMES.includes(playtime)) return fail("Pick how long you plan to play.");
  const isPrivate = a.is_private === true || a.is_private === 1;
  let pin = null;
  if (isPrivate) {
    pin = String(a.pin || "").trim();
    if (!/^\d{4}$/.test(pin)) return fail("Private groups need a 4-digit PIN code.");
  }
  try {
    const now = nowMs();
    const r = await db.prepare(
      "INSERT INTO squads (creator_profile_id, platform, game, title, description, is_private, pin, playtime, max_players, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(me.id, platform, game, title, description, isPrivate ? 1 : 0, pin, playtime, SQUAD_MAX_PLAYERS, now, now).run();
    const squadId = r.meta.last_row_id;
    await db.prepare("INSERT INTO squad_members (squad_id, profile_id, joined_at) VALUES (?, ?, ?)").bind(squadId, me.id, now).run();
    const row = await db.prepare("SELECT * FROM squads WHERE id = ? LIMIT 1").bind(squadId).first();
    return json({ ok: true, error: null, squad: await shapeSquad(db, row, me.id) });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return notSetup();
    throw e;
  }
}
