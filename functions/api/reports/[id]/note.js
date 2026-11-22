// POST /api/reports/:id/note — add a note to a dispute. Either party
// to the deal (buyer or seller) or any team member may add their side —
// the seller's answer to a dispute lives here, in the open, where the
// team deciding it can see it. Notes are plain text, 1000 chars max.
import { json, noDb, getDb, readJson, profileByDevice, roleOf, isTeamRole, nowMs, iso } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: "Pick a dispute first." });
  const body = String(a.body || "").trim().slice(0, 1000);
  if (!body) return json({ ok: false, error: "Say something first — a blank note helps nobody." });
  const report = await db.prepare("SELECT * FROM reports WHERE id = ? LIMIT 1").bind(id).first();
  if (!report) return json({ ok: false, error: "That dispute is gone." });
  if (report.target_type !== "order" && report.target_type !== "receipt") {
    return json({ ok: false, error: "Notes are for disputes — this report isn't one." });
  }
  // Who may add: any team member, the reporter, or the other party.
  let allowed = isTeamRole(roleOf(me));
  if (!allowed) {
    if (report.reporter_id === me.id) allowed = true;
    else if (report.target_type === "order") {
      const o = await db.prepare("SELECT buyer_id, seller_id FROM orders WHERE id = ? LIMIT 1").bind(report.target_id).first();
      if (o && (o.buyer_id === me.id || o.seller_id === me.id)) allowed = true;
    } else {
      const rc = await db.prepare("SELECT profile_id, other_profile_id FROM receipts WHERE id = ? LIMIT 1").bind(report.target_id).first();
      if (rc && (rc.profile_id === me.id || rc.other_profile_id === me.id)) allowed = true;
    }
  }
  if (!allowed) return json({ ok: false, error: "Only the buyer, the seller, or the team can add to a dispute." });
  try {
    const r = await db.prepare(
      "INSERT INTO dispute_notes (report_id, author_id, body, created_at) VALUES (?, ?, ?, ?)",
    ).bind(id, me.id, body, nowMs()).run();
    return json({ ok: true, error: null, note: { id: r.meta.last_row_id, author_id: me.id, author_username: me.username, body, created_at: iso(nowMs()) } });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: "Dispute notes aren't switched on yet — the shop is still running a quick database update. Try again later." });
    throw e;
  }
}
