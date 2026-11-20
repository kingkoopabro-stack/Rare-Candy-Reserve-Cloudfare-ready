// GET /api/favorites?device_id= — my favorited members.
// POST /api/favorites — add or remove a favorite (the star on a member
// page). Separate from Top 8: a favorite is a one-way star, Top 8 is a
// public tile row. Requires the v3.6 migration (favorites table).
import { json, noDb, getDb, readJson, profileByDevice, imageUrl, nowMs, createNotification, awardLucre, LUCRE_AWARDS } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me) return json({ favorites: [] });
  let rows = [];
  try {
    const { results } = await db.prepare(
      "SELECT p.id, p.username, p.avatar_blob_key FROM favorites f JOIN profiles p ON p.id = f.favorite_id WHERE f.profile_id = ? ORDER BY p.username ASC",
    ).bind(me.id).all();
    rows = results || [];
  } catch { rows = []; }
  return json({ favorites: rows.map((p) => ({ id: p.id, username: p.username, avatar_url: imageUrl(p.avatar_blob_key) })) });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first — favorites are for members." });
  const favoriteId = Math.round(Number(a.favorite_id) || 0);
  if (favoriteId <= 0) return json({ ok: false, error: "Missing member." });
  if (favoriteId === me.id) return json({ ok: false, error: "You can't favorite yourself — you're already a star." });
  const target = await db.prepare("SELECT id FROM profiles WHERE id = ? LIMIT 1").bind(favoriteId).first();
  if (!target) return json({ ok: false, error: "That member doesn't exist." });
  const action = String(a.action || "");
  if (action !== "add" && action !== "remove") return json({ ok: false, error: "Pick add or remove." });
  try {
    if (action === "add") {
      await db.prepare("INSERT OR IGNORE INTO favorites (profile_id, favorite_id, created_at) VALUES (?, ?, ?)").bind(me.id, favoriteId, nowMs()).run();
      // Lucre (v3.11) — 5 for favoriting a member, once per member.
      await awardLucre(db, me.id, LUCRE_AWARDS.favorite, "favorite", String(favoriteId));
      // Notification (v3.8) — skips quietly if the table isn't there yet.
      await createNotification(db, {
        profile_id: favoriteId, actor_profile_id: me.id, kind: "favorite",
        ref_type: "favorite", ref_id: me.id,
        text: `@${me.username} favorited you`,
        link: `#/member/${me.id}`,
      });
      return json({ ok: true, error: null, is_favorite: true });
    }
    await db.prepare("DELETE FROM favorites WHERE profile_id = ? AND favorite_id = ?").bind(me.id, favoriteId).run();
    return json({ ok: true, error: null, is_favorite: false });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) {
      return json({ ok: false, error: "Favorites aren't switched on yet — the shop is still running a quick database update. Try again later." });
    }
    throw e;
  }
}
