// Admin panel (v3.7) — operator-only (Chris).
// GET /api/admin/members?device_id= — list all members with role, ban
// status, presence, age verification. The operator uses this to keep an
// eye on things, ban, and grant mod/admin.
// POST /api/admin/set-role — grant/revoke a role (admin/mod/member).
//   Only the operator. Cannot change the operator (id 1) or yourself.
// POST /api/admin/ban — ban/unban a member with a reason. Only the
//   operator. Cannot ban the operator or yourself. A banned member's
//   posts/listings are hidden by the frontend; the flag is the record.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, roleOf, imageUrl, presenceOf, iso, nowMs } from "./_lib.js";

function needOperator(env, me) {
  return me && isOperator(env, me);
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!needOperator(env, me)) return json({ ok: false, error: "Operator only.", members: [] });
  const { results } = await db.prepare(
    "SELECT id, username, avatar_blob_key, role, is_operator, banned, banned_reason, age_verified, presence_status, last_seen, created_at FROM profiles ORDER BY id ASC",
  ).all();
  return json({
    ok: true,
    members: (results || []).map((r) => ({
      id: r.id, username: r.username, avatar_url: imageUrl(r.avatar_blob_key),
      role: roleOf(r), banned: r.banned === 1, banned_reason: r.banned_reason ?? "",
      age_verified: r.age_verified === 1, presence: presenceOf(r),
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
  if (!needOperator(env, me)) return json({ ok: false, error: "Operator only." });
  const targetId = Number(a.profile_id);
  if (!Number.isInteger(targetId) || targetId <= 0) return json({ ok: false, error: "Pick a member first." });
  if (targetId === me.id) return json({ ok: false, error: "You can't change your own role or ban yourself." });
  const target = await db.prepare("SELECT id, is_operator, role FROM profiles WHERE id = ? LIMIT 1").bind(targetId).first();
  if (!target) return json({ ok: false, error: "That member doesn't exist." });
  if (target.is_operator === 1) return json({ ok: false, error: "The operator can't be changed or banned." });
  if (action === "set-role") {
    const role = String(a.role || "").toLowerCase();
    if (role !== "admin" && role !== "mod" && role !== "member") {
      return json({ ok: false, error: "Role must be admin, mod, or member." });
    }
    await db.prepare("UPDATE profiles SET role = ? WHERE id = ?").bind(role, targetId).run();
    return json({ ok: true, error: null, role });
  }
  if (action === "ban") {
    const banned = a.banned === true || a.banned === 1;
    const reason = String(a.reason || "").trim().slice(0, 200);
    await db.prepare("UPDATE profiles SET banned = ?, banned_at = ?, banned_reason = ? WHERE id = ?")
      .bind(banned ? 1 : 0, banned ? nowMs() : null, banned ? reason : "", targetId).run();
    return json({ ok: true, error: null, banned });
  }
  return json({ ok: false, error: "Unknown admin action." });
}
