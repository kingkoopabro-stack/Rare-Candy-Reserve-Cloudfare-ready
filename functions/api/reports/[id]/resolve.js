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
// Disputes resolve with an outcome: resolved | refunded | seller_fault
// | buyer_fault | dismissed, plus a resolution note. buyer_fault (a
// false claim — it costs the filer dispute rights) is operator-only.
// Both sides of a dispute get told how it landed.
// Page URL appeals (target_type 'slug_appeal') also have two
// operator-only actions: 'approve' grants the appealed slug — it sets
// the member's page_slug, bumps their change count, stamps changed_at
// (so the 1-year cooldown restarts), and resolves the report with
// outcome 'slug_granted'; 'deny' resolves it with outcome
// 'slug_denied' and changes nothing. The appealed slug is parsed from
// the report reason and validated against SLUG_RE; a slug already
// taken by another member is refused plainly. No other report type
// accepts approve/deny, and no non-operator can call either.
import { json, noDb, getDb, readJson, profileByDevice, roleOf, isTeamRole, notifyTeam, createNotification, nowMs, SLUG_RE, SLUG_WINDOW_MS } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me || !isTeamRole(roleOf(me))) return json({ ok: false, error: "Team only — reports are handled by the operator, admins, and mods." });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: "Pick a report first." });
  const action = String(a.action || "resolve").toLowerCase();
  if (action !== "claim" && action !== "release" && action !== "resolve" && action !== "approve" && action !== "deny") {
    return json({ ok: false, error: "Unknown report action." });
  }
  const report = await db.prepare("SELECT * FROM reports WHERE id = ? LIMIT 1").bind(id).first();
  if (!report) return json({ ok: false, error: "That report is gone." });
  const status = report.status === "reviewed" ? "resolved" : report.status;
  const meRole = roleOf(me);
  const now = nowMs();
  if (action === "approve" || action === "deny") {
    // Page URL appeal — operator only, appeals only.
    if (report.target_type !== "slug_appeal") return json({ ok: false, error: "Approve and deny are only for page URL appeals." });
    if (meRole !== "operator") return json({ ok: false, error: "Only the operator can approve or deny a page URL appeal." });
    if (status === "resolved") return json({ ok: false, error: "That report is already resolved." });
    // The appealed slug is the report reason, exactly as the member
    // typed it when they filed the appeal.
    const appealed = String(report.reason || "").trim();
    if (!SLUG_RE.test(appealed)) return json({ ok: false, error: "That appealed page URL isn't valid — 3–24 letters, numbers, _ . or - only." });
    const member = await db.prepare("SELECT id, username, page_slug, page_slug_changes, page_slug_window_start, page_slug_changed_at FROM profiles WHERE id = ? LIMIT 1").bind(report.target_id).first();
    if (!member) return json({ ok: false, error: "That member is gone." });
    // Resolve with an outcome, the same way the plain resolve below
    // does — including its fallback for a database that hasn't got the
    // outcome columns yet (then the report still closes, just without
    // the recorded outcome).
    const resolveWithOutcome = async (outcome, resolutionNote) => {
      try {
        await db.prepare("UPDATE reports SET status = 'resolved', resolved_at = ?, resolved_by = ?, outcome = ?, resolution_note = ? WHERE id = ?").bind(now, me.id, outcome, resolutionNote, id).run();
        return true;
      } catch (e) {
        if (/no such column/i.test(String((e && e.message) || e))) {
          try {
            await db.prepare("UPDATE reports SET status = 'resolved', resolved_at = ?, resolved_by = ? WHERE id = ?").bind(now, me.id, id).run();
            return true;
          } catch { return false; }
        }
        return false;
      }
    };
    if (action === "deny") {
      const note = String(a.resolution_note || "").trim().slice(0, 500);
      if (!await resolveWithOutcome("slug_denied", note)) return json({ ok: false, error: "Resolving isn't switched on yet — the shop is still running a quick database update. Try again later." });
      await notifyTeam(db, me, `@${me.username} denied @${member.username || "member"}'s page URL appeal (“${appealed}”)`, "#/team", id);
      await createNotification(db, { profile_id: member.id, actor_profile_id: me.id, kind: "slug_appeal", ref_type: "report", ref_id: id, text: `Your page URL appeal for “${appealed}” was declined.${note ? " " + note : ""}`, link: "#/reports" });
      return json({ ok: true, error: null, status: "resolved", outcome: "slug_denied" });
    }
    // approve — grant the slug. The grant IS the bypass of the
    // 3-change limit / 1-year cooldown, so it never runs
    // slugChangeCheck; it keeps the window arithmetic instead, so a
    // grant after a window expiry starts a fresh window at change #1.
    const current = String(member.page_slug || "").trim();
    if (appealed.toLowerCase() === current.toLowerCase()) return json({ ok: false, error: "They already have that page URL." });
    let clash = null;
    try {
      clash = await db.prepare("SELECT id FROM profiles WHERE lower(page_slug) = lower(?) LIMIT 1").bind(appealed).first();
    } catch (e) {
      if (/no such column/i.test(String((e && e.message) || e))) return json({ ok: false, error: "Page URLs aren't switched on yet — the shop is still running a quick database update. Try again later." });
      throw e;
    }
    if (clash && clash.id !== member.id) return json({ ok: false, error: "That page URL is already taken by another member." });
    let changes = Number(member.page_slug_changes || 0);
    let windowStart = member.page_slug_window_start ?? null;
    if (!windowStart || now - windowStart > SLUG_WINDOW_MS) { changes = 0; windowStart = now; }
    const newChanges = changes + 1;
    try {
      await db.prepare("UPDATE profiles SET page_slug = ?, page_slug_changes = ?, page_slug_window_start = ?, page_slug_changed_at = ? WHERE id = ?").bind(appealed, newChanges, windowStart, now, member.id).run();
    } catch (e) {
      if (/no such column/i.test(String((e && e.message) || e))) return json({ ok: false, error: "Page URLs aren't switched on yet — the shop is still running a quick database update. Try again later." });
      throw e;
    }
    const grantNote = `Granted page URL “${appealed}” (was “${current || "none"}”).`;
    if (!await resolveWithOutcome("slug_granted", grantNote)) return json({ ok: false, error: "The page URL was granted, but the report wouldn't close — tell the team." });
    await notifyTeam(db, me, `@${me.username} granted @${member.username || "member"} the page URL “${appealed}”`, "#/team", id);
    await createNotification(db, { profile_id: member.id, actor_profile_id: me.id, kind: "slug_appeal", ref_type: "report", ref_id: id, text: `Your page URL appeal was approved — your page is now rarecandyreserve.org/community.html#/u/${appealed}.`, link: "#/u/" + appealed });
    return json({ ok: true, error: null, status: "resolved", outcome: "slug_granted", slug: appealed });
  }
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
  const isDispute = report.target_type === "order" || report.target_type === "receipt";
  const OUTCOMES = ["resolved", "refunded", "seller_fault", "buyer_fault", "dismissed"];
  const outcomeRaw = String(a.outcome || "resolved").toLowerCase();
  const finalOutcome = isDispute && OUTCOMES.includes(outcomeRaw) ? outcomeRaw : "resolved";
  if (finalOutcome === "buyer_fault" && meRole !== "operator") {
    return json({ ok: false, error: "Only the operator can mark a dispute as a false claim — that takes away the member's dispute filing." });
  }
  const resolutionNote = String(a.resolution_note || "").trim().slice(0, 500);
  try {
    await db.prepare("UPDATE reports SET status = 'resolved', resolved_at = ?, resolved_by = ?, outcome = ?, resolution_note = ? WHERE id = ?").bind(now, me.id, finalOutcome, resolutionNote, id).run();
  } catch (e) {
    if (/no such column/i.test(String((e && e.message) || e))) {
      // Protection migration hasn't run yet — resolve the old way so
      // plain content reports still close instead of breaking.
      try {
        await db.prepare("UPDATE reports SET status = 'resolved', resolved_at = ?, resolved_by = ? WHERE id = ?").bind(now, me.id, id).run();
      } catch {
        return json({ ok: false, error: "Resolving isn't switched on yet — the shop is still running a quick database update. Try again later." });
      }
    } else {
      return json({ ok: false, error: "Resolving isn't switched on yet — the shop is still running a quick database update. Try again later." });
    }
  }
  await notifyTeam(db, me, `@${me.username} resolved report #${id}${isDispute ? " — " + finalOutcome : ""}`, "#/team", id);
  if (isDispute) {
    // Tell both sides how it landed — the reporter and the other party
    // to the deal. The note is the plain-language reason.
    const parties = new Set([report.reporter_id]);
    if (report.target_type === "order") {
      const o = await db.prepare("SELECT buyer_id, seller_id FROM orders WHERE id = ? LIMIT 1").bind(report.target_id).first();
      if (o) { parties.add(o.buyer_id); parties.add(o.seller_id); }
    } else {
      const rc = await db.prepare("SELECT profile_id, other_profile_id FROM receipts WHERE id = ? LIMIT 1").bind(report.target_id).first();
      if (rc) { parties.add(rc.profile_id); parties.add(rc.other_profile_id); }
    }
    const label = report.target_type === "order" ? `Order #${report.target_id}` : `Receipt #${report.target_id}`;
    for (const pid of parties) {
      if (!pid || pid === me.id) continue;
      await createNotification(db, { profile_id: pid, actor_profile_id: me.id, kind: "dispute", ref_type: "report", ref_id: id, text: `Your dispute on ${label} was resolved — ${finalOutcome}${resolutionNote ? ": " + resolutionNote : "."}`, link: "#/orders" });
    }
  }
  return json({ ok: true, error: null, status: "resolved", outcome: finalOutcome });
}
