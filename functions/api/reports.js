// GET /api/reports — listReports. OPERATOR ONLY: only the operator
// (Chris) can view the reports inbox. Other members get an empty list.
// POST /api/reports — reportContent. Files a member report on a post,
// comment, or listing. One open report per member per item.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, iso } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me || !isOperator(env, me)) return json({ reports: [] });
  const { results } = await db.prepare("SELECT * FROM reports ORDER BY id DESC LIMIT 100").all();
  const { results: profiles } = await db.prepare("SELECT id, username FROM profiles").all();
  const byId = new Map((profiles || []).map((p) => [p.id, p]));
  const out = [];
  for (const r of (results || [])) {
    let label = `${r.target_type} #${r.target_id}`;
    if (r.target_type === "post") {
      const p = await db.prepare("SELECT title FROM posts WHERE id = ? LIMIT 1").bind(r.target_id).first();
      if (p) label = `Post: “${p.title}”`;
    } else if (r.target_type === "listing") {
      const l = await db.prepare("SELECT title FROM listings WHERE id = ? LIMIT 1").bind(r.target_id).first();
      if (l) label = `Listing: “${l.title}”`;
    } else if (r.target_type === "comment") {
      const c = await db.prepare("SELECT body FROM comments WHERE id = ? LIMIT 1").bind(r.target_id).first();
      if (c) label = `Comment: “${String(c.body).slice(0, 60)}”`;
    } else if (r.target_type === "profile") {
      const u = byId.get(r.target_id)?.username;
      label = u ? `Profile: @${u}` : `Profile #${r.target_id}`;
    } else if (r.target_type === "slug_appeal") {
      const u = byId.get(r.target_id)?.username;
      label = u ? `Page URL appeal from @${u}` : `Page URL appeal #${r.target_id}`;
    }
    out.push({
      id: r.id, target_type: r.target_type, target_id: r.target_id, target_label: label,
      reason: r.reason ?? "", status: r.status,
      reporter_username: byId.get(r.reporter_id)?.username ?? "member",
      created_at: iso(r.created_at),
    });
  }
  out.sort((a, b) => (a.status === b.status ? b.id - a.id : a.status === "open" ? -1 : 1));
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
