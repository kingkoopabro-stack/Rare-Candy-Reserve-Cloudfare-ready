// GET /api/groups?device_id= — groups I own, with member ids.
// POST /api/groups — create a group ({name}), or add/remove a member
// ({group_id, member_id, action: "add"|"remove"}). Only the group owner
// may add or remove members, and the owner can't add themself.
// Requires the v3.6 migration (groups + group_members tables).
import { json, noDb, getDb, readJson, profileByDevice, nowMs } from "./_lib.js";

async function myGroups(db, ownerId) {
  const { results: groups } = await db.prepare("SELECT id, name FROM groups WHERE owner_id = ? ORDER BY name ASC").bind(ownerId).all();
  const out = [];
  for (const g of (groups || [])) {
    const { results: members } = await db.prepare("SELECT profile_id FROM group_members WHERE group_id = ?").bind(g.id).all();
    out.push({ id: g.id, name: g.name, member_ids: (members || []).map((x) => x.profile_id) });
  }
  return out;
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me) return json({ groups: [] });
  let groups = [];
  try { groups = await myGroups(db, me.id); } catch { groups = []; }
  return json({ groups });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first — groups are for members." });
  try {
    // Create a group.
    if (typeof a.name === "string" && !a.group_id) {
      const name = String(a.name || "").trim().slice(0, 40);
      if (!name) return json({ ok: false, error: "Give the group a name." });
      const r = await db.prepare("INSERT INTO groups (owner_id, name, created_at) VALUES (?, ?, ?)").bind(me.id, name, nowMs()).run();
      const group = await db.prepare("SELECT id, name FROM groups WHERE id = ? LIMIT 1").bind(r.meta.last_row_id).first();
      return json({ ok: true, error: null, group: { id: group.id, name: group.name, member_ids: [] } });
    }
    // Add / remove a member.
    const groupId = Math.round(Number(a.group_id) || 0);
    const memberId = Math.round(Number(a.member_id) || 0);
    const action = String(a.action || "");
    if (!groupId || !memberId) return json({ ok: false, error: "Pick a group and a member." });
    if (action !== "add" && action !== "remove") return json({ ok: false, error: "Pick add or remove." });
    if (memberId === me.id) return json({ ok: false, error: "You're already in your own group — it's yours." });
    const group = await db.prepare("SELECT id, owner_id FROM groups WHERE id = ? LIMIT 1").bind(groupId).first();
    if (!group) return json({ ok: false, error: "That group doesn't exist." });
    if (group.owner_id !== me.id) return json({ ok: false, error: "Only the group owner can add or remove members." });
    const target = await db.prepare("SELECT id FROM profiles WHERE id = ? LIMIT 1").bind(memberId).first();
    if (!target) return json({ ok: false, error: "That member doesn't exist." });
    if (action === "add") {
      await db.prepare("INSERT OR IGNORE INTO group_members (group_id, profile_id, created_at) VALUES (?, ?, ?)").bind(groupId, memberId, nowMs()).run();
    } else {
      await db.prepare("DELETE FROM group_members WHERE group_id = ? AND profile_id = ?").bind(groupId, memberId).run();
    }
    return json({ ok: true, error: null, groups: await myGroups(db, me.id) });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) {
      return json({ ok: false, error: "Groups aren't switched on yet — the shop is still running a quick database update. Try again later." });
    }
    throw e;
  }
}
