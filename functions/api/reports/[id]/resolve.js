// POST /api/reports/:id/resolve — reportAction (team only).
// The team works reports from the Team panel: claim one ("I'll take
// care of that"), release it back to the queue, or resolve it. Any team
// member (operator / admin / mod) may claim or resolve; only the
// assignee (or the operator) may release a claim. Claims and
// resolutions ping the rest of the team (notifyTeam, kind "team") so
// everyone sees who is handling what. Statuses: open → claimed →
// resolved. Legacy 'reviewed' rows read as resolved; resolving writes
// 'resolved' from here on. No action in the body = resolve (the old
// operator inbox button's call keeps working).
import { json, noDb, getDb, readJson, profileByDevice, roleOf, isTeamRole, notifyTeam, nowMs } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me || !isTeamRole(roleOf(me))) return json({ ok: false, error: "Team only — reports are handled by the operator, admins, and mods." });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: "Pick a report first." });
  const action = String(a.action || "resolve").toLowerCase();
  if (action !== "claim" && action !== "release" && action !== "resolve") {
    return json({ ok: false, error: "Unknown report action." });
  }
  const report = await db.prepare("SELECT * FROM reports WHERE id = ? LIMIT 1").bind(id).first();
  if (!report) return json({ ok: false, error: "That report is gone." });
  const status = report.status === "reviewed" ? "resolved" : report.status;
  const meRole = roleOf(me);
  const now = nowMs();
  if (action === "claim") {
    if (status !== "open") return json({ ok: false, error: "That report is already being handled." });
    try {
      await db.prepare("UPDATE reports SET status = 'claimed', assignee_id = ?, claimed_at = ? WHERE id = ?").bind(me.id, now, id).run();
    } catch {
      return json({ ok: false, error: "Claiming isn't switched on yet — the shop is still running a quick database update. Try again later." });
    }
    await notifyTeam(db, me, `@${me.username} claimed a report (#${id}) — “${String(report.reason || "").slice(0, 60)}”`, "#/team", id);
    return json({ ok: true, error: null, status: "claimed", assignee_id: me.id });
  }
  if (action === "release") {
    if (status !== "claimed") return json({ ok: false, error: "That report isn't claimed." });
    if (report.assignee_id !== me.id && meRole !== "operator") {
      return json({ ok: false, error: "Only the person handling it (or the operator) can put it back." });
    }
    try {
      await db.prepare("UPDATE reports SET status = 'open', assignee_id = NULL, claimed_at = NULL WHERE id = ?").bind(id).run();
    } catch {
      return json({ ok: false, error: "Releasing isn't switched on yet — the shop is still running a quick database update. Try again later." });
    }
    await notifyTeam(db, me, `@${me.username} put report #${id} back in the queue`, "#/team", id);
    return json({ ok: true, error: null, status: "open", assignee_id: null });
  }
  // resolve
  if (status === "resolved") return json({ ok: false, error: "That report is already resolved." });
  try {
    await db.prepare("UPDATE reports SET status = 'resolved', resolved_at = ?, resolved_by = ? WHERE id = ?").bind(now, me.id, id).run();
  } catch {
    return json({ ok: false, error: "Resolving isn't switched on yet — the shop is still running a quick database update. Try again later." });
  }
  await notifyTeam(db, me, `@${me.username} resolved report #${id}`, "#/team", id);
  return json({ ok: true, error: null, status: "resolved" });
}
