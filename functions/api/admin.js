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
//   ban             operator only — TIMED or permanent (Build 5). A
//                   duration key (1d / 3d / 1w / 2w / 6w / 3mo, same keys
//                   as the silence durations) sets banned_until; the ban
//                   lifts itself when the time passes. "permanent" (or
//                   no duration, for the old call) sets banned_until
//                   NULL — banned forever until unbanned. Cannot ban
//                   the operator or yourself.
//   silence         operator / admin / mod, capped by role: operator any
//                   duration incl. permanent (= ban flag), admin up to 3
//                   months, mod up to 1 week (proposed default).
//   unsilence       operator / admin / mod — clears a silence.
//   reset-layout    operator only — resets a member's layout/theme to
//                   the default MySpace look (Build 5).
//   delete-profile  operator only — removes the member's account row.
//                   Cannot delete the operator or yourself. Their posts
//                   and comments stay in the database as orphan rows but
//                   stop showing anywhere (every list joins profiles).
// A banned member's posts and listings are hidden SERVER-SIDE (posts.js
// and listings.js skip banned authors; a timed ban that expired doesn't
// hide anything), and a banned member can't create posts, comments, or
// listings (bannedMemberCheck in posts.js, profile-comments.js, and
// listings.js). The flag alone is not the enforcement — the checks are.
// Every action in this file is written to admin_audit_log (Build 5) —
// who did it, to whom, what, when. The log write is best-effort and
// never breaks the action itself.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, roleOf, isTeamRole, imageUrl, presenceOf, iso, nowMs, parsePrefs, SILENCE_DURATIONS, canSilenceFor, recordAuditLog, cleanTheme, BAN_DURATIONS } from "./_lib.js";

// Default MySpace look (Build 5 layout reset) — the same free classic
// look a brand-new signup gets in profile.js: classic vibe, navy
// accent, retro buttons, ticker effect, radio soundscape, vinyl skin.
const DEFAULT_LAYOUT_THEME = cleanTheme({
  vibe: "classic", accent_color: "#003399", button_style: "retro",
  effects: ["ticker-effect"], soundscape: "radio", player_skin: "vinyl",
  topfriends_count: 8, buttons_show: true, buttons_visible: null,
  website_buttons: false,
});

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
  // Build 5 — banned_until (timed bans) + is_test (18+ test mode) ride
  // along the same way; a table without them falls back below.
  const noCol = (e) => /no such column|no column named/i.test(String((e && e.message) || e));
  var results;
  try {
    const q = await db.prepare(
      "SELECT id, username, avatar_blob_key, role, is_operator, banned, banned_reason, banned_until, is_test, muted_until, muted_reason, age_verified, presence_status, last_seen, created_at, seller_types, buyer_types FROM profiles ORDER BY id ASC",
    ).all();
    results = q.results;
  } catch (e) {
    if (!noCol(e)) throw e;
    try {
      const q = await db.prepare(
        "SELECT id, username, avatar_blob_key, role, is_operator, banned, banned_reason, muted_until, muted_reason, age_verified, presence_status, last_seen, created_at, seller_types, buyer_types FROM profiles ORDER BY id ASC",
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
  // Dispute record per member — how many disputes they filed, and how
  // many were found to be false claims. Computed from the reports table;
  // stays 0 when the protection migration hasn't run yet.
  let disputeCounts = new Map();
  try {
    const { results: dc } = await db.prepare(
      "SELECT reporter_id, COUNT(*) AS filed, SUM(CASE WHEN outcome = 'buyer_fault' THEN 1 ELSE 0 END) AS false_n FROM reports WHERE target_type IN ('order', 'receipt') GROUP BY reporter_id",
    ).all();
    for (const row of (dc || [])) disputeCounts.set(row.reporter_id, { filed: row.filed || 0, false_n: row.false_n || 0 });
  } catch { disputeCounts = new Map(); }
  return json({
    ok: true,
    members: (results || []).map((r) => ({
      id: r.id, username: r.username, avatar_url: imageUrl(r.avatar_blob_key),
      role: roleOf(r), banned: r.banned === 1, banned_reason: r.banned_reason ?? "",
      banned_until: r.banned_until == null ? null : Number(r.banned_until),
      is_test: r.is_test === 1,
      muted_until: r.muted_until ?? null, muted_reason: r.muted_reason ?? "",
      age_verified: r.age_verified === 1, presence: presenceOf(r),
      seller_types: parsePrefs(r.seller_types),
      buyer_types: parsePrefs(r.buyer_types),
      disputes_filed: (disputeCounts.get(r.id) || {}).filed || 0,
      disputes_false: (disputeCounts.get(r.id) || {}).false_n || 0,
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
    await recordAuditLog(db, { actorId: me.id, action: "role-change", targetId, detail: `role -> ${role}` });
    return json({ ok: true, error: null, role });
  }
  if (action === "ban") {
    if (!needOperator(env, me)) return json({ ok: false, error: "Only the operator can ban — admins silence for up to 3 months instead." });
    const banned = a.banned === true || a.banned === 1;
    const reason = String(a.reason || "").trim().slice(0, 200);
    // Timed ban (Build 5): a duration key sets banned_until and the ban
    // lifts itself when the time passes. "permanent" — or no duration
    // on the old call — is the old permanent ban (banned_until NULL).
    // Unban clears both the flag and the timer.
    const durKey = String(a.duration || "").toLowerCase();
    const dur = BAN_DURATIONS.find((d) => d.key === durKey);
    if (banned && durKey && !dur) return json({ ok: false, error: "Pick a ban length — 1 day, a few days, 1 week, 2 weeks, 6 weeks, 3 months, or permanent." });
    const until = banned && dur && dur.ms != null ? nowMs() + dur.ms : null;
    const noCol = (e) => /no such column|no column named/i.test(String((e && e.message) || e));
    try {
      await db.prepare("UPDATE profiles SET banned = ?, banned_at = ?, banned_reason = ?, banned_until = ? WHERE id = ?")
        .bind(banned ? 1 : 0, banned ? nowMs() : null, banned ? reason : "", until, targetId).run();
    } catch (e) {
      if (!noCol(e)) throw e;
      // banned_until column not there yet — the ban still lands as the
      // old permanent flag, and the client is told the timer didn't stick.
      await db.prepare("UPDATE profiles SET banned = ?, banned_at = ?, banned_reason = ? WHERE id = ?")
        .bind(banned ? 1 : 0, banned ? nowMs() : null, banned ? reason : "", targetId).run();
      if (banned && until) return json({ ok: true, error: null, banned, banned_until_pending: true });
    }
    await recordAuditLog(db, {
      actorId: me.id, action: banned ? "ban" : "unban", targetId,
      detail: banned ? `banned ${dur ? dur.label : "permanently"}${reason ? " — " + reason : ""}` : "unbanned",
    });
    return json({ ok: true, error: null, banned, banned_until: until });
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
      // banned_until is cleared (NULL = permanent) so a stale timer
      // from an earlier timed ban can't silently lift this one.
      await db.prepare("UPDATE profiles SET banned = 1, banned_at = ?, banned_reason = ?, banned_until = NULL, muted_until = NULL, muted_reason = ? WHERE id = ?")
        .bind(nowMs(), reason, reason, targetId).run();
      await recordAuditLog(db, { actorId: me.id, action: "ban", targetId, detail: `banned permanently (via silence)${reason ? " — " + reason : ""}` });
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
    await recordAuditLog(db, { actorId: me.id, action: "silence", targetId, detail: `silenced ${dur.label}${reason ? " — " + reason : ""}` });
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
    await recordAuditLog(db, { actorId: me.id, action: "unsilence", targetId, detail: "silence cleared" });
    return json({ ok: true, error: null });
  }
  if (action === "reset-layout") {
    if (!needOperator(env, me)) return json({ ok: false, error: "Only the operator can reset a member's layout." });
    // The default MySpace look: classic preset, no custom CSS, the
    // default theme JSON. Top Friends / links / bio are untouched —
    // only the look resets. Graceful when the v2/v3 columns aren't
    // there yet: the preset + theme just don't stick, and the client
    // is told via layout_pending.
    const noCol = (e) => /no such column|no column named/i.test(String((e && e.message) || e));
    try {
      await db.prepare("UPDATE profiles SET layout_preset = 'classic', layout_css = '', profile_theme = ?, updated_at = ? WHERE id = ?")
        .bind(DEFAULT_LAYOUT_THEME, nowMs(), targetId).run();
    } catch (e) {
      if (!noCol(e)) throw e;
      return json({ ok: false, error: "Layout reset needs the database update — the shop is still running it. Try again later.", layout_pending: true });
    }
    await recordAuditLog(db, { actorId: me.id, action: "reset-layout", targetId, detail: "layout reset to the default MySpace look" });
    return json({ ok: true, error: null, reset: true });
  }
  if (action === "delete-profile") {
    if (!needOperator(env, me)) return json({ ok: false, error: "Only the operator can delete profiles." });
    await db.prepare("DELETE FROM profiles WHERE id = ?").bind(targetId).run();
    await recordAuditLog(db, { actorId: me.id, action: "delete-profile", targetId, detail: "profile deleted" });
    return json({ ok: true, error: null, deleted: true });
  }
  return json({ ok: false, error: "Unknown admin action." });
}
