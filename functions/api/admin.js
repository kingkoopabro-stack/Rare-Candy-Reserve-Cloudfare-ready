// Admin panel (v3.7) — operator + admin read, operator-only writes
// for the big settings (v3.18).
// GET /api/admin?device_id= — list all members with role, ban/silence
// status, presence, age verification, and what they sell / are after
// (seller_types, buyer_types — v3.8, so the operator can sort members
// by offer and want). The operator AND admins can read it (admins need
// the list to silence members); mods never see the Admin panel.
// POST /api/admin — actions, each gated server-side:
//   set-role        operator only (admin/mod/member). Cannot change the
//                   operator (id 1) or yourself.
//   ban             operator only — the PERMANENT ban flag. Cannot ban
//                   the operator or yourself.
//   silence         operator / admin / mod, capped by role: operator any
//                   duration incl. permanent (= ban flag), admin up to 3
//                   months, mod up to 1 week (proposed default).
//   unsilence       operator / admin / mod — clears a silence.
//   delete-profile  operator only — removes the member's account row.
//                   Cannot delete the operator or yourself. Their posts
//                   and comments stay in the database as orphan rows but
//                   stop showing anywhere (every list joins profiles).
// A banned member's posts/listings are hidden by the frontend; the flag
// is the record.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, roleOf, isTeamRole, imageUrl, presenceOf, iso, nowMs, parsePrefs, SILENCE_DURATIONS, canSilenceFor } from "./_lib.js";

function needOperator(env, me) {
  return me && isOperator(env, me);
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me || !(isOperator(env, me) || roleOf(me) === "admin")) return json({ ok: false, error: "Operator or admin only.", members: [] });
  // v3.8 — seller_types / buyer_types ride along so the admin panel can
  // sort members by what they offer and what they're after. If the v3
  // columns aren't in the live table yet, fall back to the v1 columns so
  // the panel still loads (with empty types) instead of breaking.
  // v3.18 — muted_until / muted_reason ride along the same way (the
  // silence columns land with the team-moderation migration).
  const noCol = (e) => /no such column|no column named/i.test(String((e && e.message) || e));
  var results;
  try {
    const q = await db.prepare(
      "SELECT id, username, avatar_blob_key, role, is_operator, banned, banned_reason, muted_until, muted_reason, age_verified, presence_status, last_seen, created_at, seller_types, buyer_types FROM profiles ORDER BY id ASC",
    ).all();
    results = q.results;
  } catch (e) {
    if (!noCol(e)) throw e;
    try {
      const q = await db.prepare(
        "SELECT id, username, avatar_blob_key, role, is_operator, banned, banned_reason, age_verified, presence_status, last_seen, created_at, seller_types, buyer_types FROM profiles ORDER BY id ASC",
      ).all();
      results = q.results;
    } catch (e2) {
      if (!noCol(e2)) throw e2;
      const q = await db.prepare(
        "SELECT id, username, avatar_blob_key, role, is_operator, banned, banned_reason, age_verified, presence_status, last_seen, created_at FROM profiles ORDER BY id ASC",
      ).all();
      results = q.results;
    }
  }
  return json({
    ok: true,
    members: (results || []).map((r) => ({
      id: r.id, username: r.username, avatar_url: imageUrl(r.avatar_blob_key),
      role: roleOf(r), banned: r.banned === 1, banned_reason: r.banned_reason ?? "",
      muted_until: r.muted_until ?? null, muted_reason: r.muted_reason ?? "",
      age_verified: r.age_verified === 1, presence: presenceOf(r),
      seller_types: parsePrefs(r.seller_types),
      buyer_types: parsePrefs(r.buyer_types),
      created_at: iso(r.created_at),
    })),
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const action = String(a.action || "");
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  const meRole = roleOf(me);
  if (!me || !isTeamRole(meRole)) return json({ ok: false, error: "Team only." });
  const targetId = Number(a.profile_id);
  if (!Number.isInteger(targetId) || targetId <= 0) return json({ ok: false, error: "Pick a member first." });
  if (targetId === me.id) return json({ ok: false, error: "You can't change your own role, ban, silence, or delete yourself." });
  const target = await db.prepare("SELECT id, is_operator, role FROM profiles WHERE id = ? LIMIT 1").bind(targetId).first();
  if (!target) return json({ ok: false, error: "That member doesn't exist." });
  if (target.is_operator === 1) return json({ ok: false, error: "The operator can't be changed, banned, silenced, or deleted." });
  if (action === "set-role") {
    if (!needOperator(env, me)) return json({ ok: false, error: "Only the operator can grant roles." });
    const role = String(a.role || "").toLowerCase();
    if (role !== "admin" && role !== "mod" && role !== "member") {
      return json({ ok: false, error: "Role must be admin, mod, or member." });
    }
    await db.prepare("UPDATE profiles SET role = ? WHERE id = ?").bind(role, targetId).run();
    return json({ ok: true, error: null, role });
  }
  if (action === "ban") {
    if (!needOperator(env, me)) return json({ ok: false, error: "Only the operator can ban permanently — admins silence for up to 3 months instead." });
    const banned = a.banned === true || a.banned === 1;
    const reason = String(a.reason || "").trim().slice(0, 200);
    await db.prepare("UPDATE profiles SET banned = ?, banned_at = ?, banned_reason = ? WHERE id = ?")
      .bind(banned ? 1 : 0, banned ? nowMs() : null, banned ? reason : "", targetId).run();
    return json({ ok: true, error: null, banned });
  }
  if (action === "silence") {
    const key = String(a.duration || "").toLowerCase();
    if (!canSilenceFor(meRole, key)) {
      return json({ ok: false, error: meRole === "admin" ? "Admins can silence for up to 3 months — permanent bans are the operator's call." : meRole === "mod" ? "Mods can silence for up to 1 week." : "Only the team can silence members." });
    }
    const reason = String(a.reason || "").trim().slice(0, 200);
    const noCol = (e) => /no such column|no column named/i.test(String((e && e.message) || e));
    if (key === "permanent") {
      // Permanent silence IS the ban flag — operator only (enforced by
      // canSilenceFor above, which only allows it for the operator).
      await db.prepare("UPDATE profiles SET banned = 1, banned_at = ?, banned_reason = ?, muted_until = NULL, muted_reason = ? WHERE id = ?")
        .bind(nowMs(), reason, reason, targetId).run();
      return json({ ok: true, error: null, banned: true });
    }
    const dur = SILENCE_DURATIONS.find((d) => d.key === key);
    const until = nowMs() + dur.ms;
    try {
      await db.prepare("UPDATE profiles SET muted_until = ?, muted_reason = ? WHERE id = ?").bind(until, reason, targetId).run();
    } catch (e) {
      if (!noCol(e)) throw e;
      return json({ ok: false, error: "Silencing isn't switched on yet — the shop is still running a quick database update. Try again later." });
    }
    return json({ ok: true, error: null, muted_until: until });
  }
  if (action === "unsilence") {
    const noCol = (e) => /no such column|no column named/i.test(String((e && e.message) || e));
    try {
      await db.prepare("UPDATE profiles SET muted_until = NULL, muted_reason = '' WHERE id = ?").bind(targetId).run();
    } catch (e) {
      if (!noCol(e)) throw e;
      return json({ ok: false, error: "Silencing isn't switched on yet — the shop is still running a quick database update. Try again later." });
    }
    return json({ ok: true, error: null });
  }
  if (action === "delete-profile") {
    if (!needOperator(env, me)) return json({ ok: false, error: "Only the operator can delete profiles." });
    await db.prepare("DELETE FROM profiles WHERE id = ?").bind(targetId).run();
    return json({ ok: true, error: null, deleted: true });
  }
  return json({ ok: false, error: "Unknown admin action." });
}
