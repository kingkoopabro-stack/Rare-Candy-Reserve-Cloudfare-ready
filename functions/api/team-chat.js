// Team chat (v3.7) — badge holders only (operator + admin + mod).
// GET /api/team-chat?device_id= — latest team messages, oldest last.
// POST /api/team-chat — post a team message (up to 500 characters).
// This is where the team mentions what they handled. Members and guests
// cannot read or post here.
import { json, noDb, getDb, readJson, profileByDevice, roleOf, isTeamRole, iso, nowMs, badgesForProfiles, notifyTeam } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me || !isTeamRole(roleOf(me))) return json({ ok: false, error: "Team only.", messages: [] });
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "60", 10) || 60, 1), 100);
  const { results } = await db.prepare("SELECT * FROM team_chat_messages ORDER BY id DESC LIMIT ?").bind(limit).all();
  const rows = (results || []).reverse();
  const badgeMap = await badgesForProfiles(db, rows.map((r) => r.profile_id));
  // Team chat role colors (v3.18) — each message carries its author's
  // team role so the client can color operator / admin / mod distinctly.
  const roleMap = new Map();
  try {
    const ids = [...new Set(rows.map((r) => r.profile_id).filter(Boolean))];
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const { results: profs } = await db.prepare(`SELECT id, role, is_operator FROM profiles WHERE id IN (${placeholders})`).bind(...ids).all();
      for (const p of (profs || [])) roleMap.set(p.id, roleOf(p));
    }
  } catch { /* roles fall back to member — the chat still renders */ }
  return json({
    ok: true,
    messages: rows.map((r) => ({
      id: r.id, profile_id: r.profile_id, author_name: r.author_name,
      author_role: r.profile_id ? (roleMap.get(r.profile_id) || "member") : "member",
      author_badges: r.profile_id ? (badgeMap.get(r.profile_id) || []) : [],
      body: r.body, created_at: iso(r.created_at),
    })),
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!me || !isTeamRole(roleOf(me))) return json({ ok: false, error: "Team only." });
  const bodyRaw = String(a.body || "").trim();
  if (!bodyRaw || bodyRaw.length > 500) return json({ ok: false, error: "Write a message (up to 500 characters)." });
  const authorName = me.chat_name || me.username;
  const r = await db.prepare("INSERT INTO team_chat_messages (profile_id, author_name, body, created_at) VALUES (?, ?, ?, ?)")
    .bind(me.id, authorName, bodyRaw, nowMs()).run();
  // Team ping (v3.17) — every OTHER team member gets one high-priority
  // "team" notification, so the coin sound fires for them. Never the
  // poster themself. Skips quietly when the table isn't there yet.
  await notifyTeam(db, me, `@${authorName} posted in team chat`, "#/team", r.meta.last_row_id);
  return json({ ok: true, error: null });
}
