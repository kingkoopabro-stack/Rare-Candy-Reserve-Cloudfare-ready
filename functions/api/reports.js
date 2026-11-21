// GET /api/reports — listReports. TEAM ONLY (v3.18): the operator,
// admins, and mods all see the reports queue — it surfaces in the Team
// panel, not only in the operator's Reports inbox. Other members get an
// empty list.
// POST /api/reports — reportContent. Files a member report on a post,
// comment, or listing. One open report per member per item.
import { json, noDb, getDb, readJson, profileByDevice, roleOf, isTeamRole, iso } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me || !isTeamRole(roleOf(me))) return json({ reports: [] });
  let results;
  try {
    const q = await db.prepare("SELECT * FROM reports ORDER BY id DESC LIMIT 100").all();
    results = q.results;
  } catch { return json({ reports: [] }); }
  const { results: profiles } = await db.prepare("SELECT id, username FROM profiles").all();
  const byId = new Map((profiles || []).map((p) => [p.id, p]));
  const out = [];
  for (const r of (results || [])) {
    let label = `${r.target_type} #${r.target_id}`;
    let targetAuthorId = null;
    if (r.target_type === "post") {
      const p = await db.prepare("SELECT title, profile_id FROM posts WHERE id = ? LIMIT 1").bind(r.target_id).first();
      if (p) { label = `Post: “${p.title}”`; targetAuthorId = p.profile_id; }
    } else if (r.target_type === "listing") {
      const l = await db.prepare("SELECT title, profile_id FROM listings WHERE id = ? LIMIT 1").bind(r.target_id).first();
      if (l) { label = `Listing: “${l.title}”`; targetAuthorId = l.profile_id; }
    } else if (r.target_type === "comment") {
      const c = await db.prepare("SELECT body, profile_id FROM comments WHERE id = ? LIMIT 1").bind(r.target_id).first();
      if (c) { label = `Comment: “${String(c.body).slice(0, 60)}”`; targetAuthorId = c.profile_id; }
    } else if (r.target_type === "profile") {
      const u = byId.get(r.target_id)?.username;
      label = u ? `Profile: @${u}` : `Profile #${r.target_id}`;
      targetAuthorId = r.target_id;
    } else if (r.target_type === "slug_appeal") {
      const u = byId.get(r.target_id)?.username;
      label = u ? `Page URL appeal from @${u}` : `Page URL appeal #${r.target_id}`;
      targetAuthorId = r.target_id;
    }
    const status = r.status === "reviewed" ? "resolved" : r.status;
    out.push({
      id: r.id, target_type: r.target_type, target_id: r.target_id, target_label: label,
      target_author_id: targetAuthorId,
      target_author_username: targetAuthorId ? (byId.get(targetAuthorId)?.username ?? "member") : null,
      reason: r.reason ?? "", status,
      reporter_username: byId.get(r.reporter_id)?.username ?? "member",
      assignee_id: r.assignee_id ?? null,
      assignee_username: r.assignee_id ? (byId.get(r.assignee_id)?.username ?? "member") : null,
      claimed_at: iso(r.claimed_at ?? null),
      resolved_at: iso(r.resolved_at ?? null),
      created_at: iso(r.created_at),
    });
  }
  const rank = (s) => (s === "open" ? 0 : s === "claimed" ? 1 : 2);
  out.sort((a, b) => (rank(a.status) - rank(b.status)) || (b.id - a.id));
  return json({ reports: out });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first — reports come from members so they're accountable." });
  if (!["post", "comment", "listing", "profile", "slug_appeal"].includes(a.target_type)) return json({ ok: false, error: "Pick what you're reporting." });
  const targetId = Math.round(Number(a.target_id) || 0);
  if (targetId <= 0) return json({ ok: false, error: "Missing item to report." });
  // A profile report needs a real member; a page-URL appeal can only be
  // filed by the member themself, for their own page.
  if (a.target_type === "profile") {
    const target = await db.prepare("SELECT id FROM profiles WHERE id = ? LIMIT 1").bind(targetId).first();
    if (!target) return json({ ok: false, error: "That member doesn't exist." });
    if (targetId === me.id) return json({ ok: false, error: "You can't report your own profile." });
  }
  if (a.target_type === "slug_appeal" && targetId !== me.id) {
    return json({ ok: false, error: "You can only appeal for your own page URL." });
  }
  const exists = await db.prepare(
    "SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open' LIMIT 1",
  ).bind(me.id, a.target_type, targetId).first();
  if (exists) return json({ ok: true, error: null });
  await db.prepare(
    "INSERT INTO reports (reporter_id, target_type, target_id, reason, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)",
  ).bind(me.id, a.target_type, targetId, String(a.reason || "").trim().slice(0, 300), Date.now()).run();
  return json({ ok: true, error: null });
}
