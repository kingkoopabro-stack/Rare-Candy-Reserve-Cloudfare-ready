// GET /api/reports — listReports. TEAM ONLY (v3.18): the operator,
// admins, and mods all see the reports queue — it surfaces in the Team
// panel, not only in the operator's Reports inbox. Other members get an
// empty list.
// POST /api/reports — reportContent. Files a member report on a post,
// comment, or listing. One open report per member per item.
import { json, noDb, getDb, readJson, profileByDevice, roleOf, isTeamRole, iso, money, createNotification, notifyTeam } from "./_lib.js";

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
  // Dispute notes (both sides + team) — loaded once for the whole queue.
  let notesByReport = new Map();
  try {
    const ids = (results || []).map((r) => r.id);
    if (ids.length) {
      const { results: notes } = await db.prepare(
        `SELECT n.*, p.username AS author_username FROM dispute_notes n LEFT JOIN profiles p ON p.id = n.author_id WHERE n.report_id IN (${ids.map(() => "?").join(",")}) ORDER BY n.created_at ASC, n.id ASC`,
      ).bind(...ids).all();
      for (const n of (notes || [])) {
        if (!notesByReport.has(n.report_id)) notesByReport.set(n.report_id, []);
        notesByReport.get(n.report_id).push({ id: n.id, author_id: n.author_id, author_username: n.author_username ?? "member", body: n.body ?? "", created_at: iso(n.created_at) });
      }
    }
  } catch { notesByReport = new Map(); }
  const out = [];
  for (const r of (results || [])) {
    let label = `${r.target_type} #${r.target_id}`;
    let targetAuthorId = null;
    let orderSnap = null;
    if (r.target_type === "general") label = "General ticket";
    else if (r.target_type === "post") {
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
    } else if (r.target_type === "order") {
      const o = await db.prepare("SELECT item_title, buyer_id, seller_id, status, carrier, tracking_number, amount_cents, buyer_confirmed_at FROM orders WHERE id = ? LIMIT 1").bind(r.target_id).first();
      if (o) {
        label = `Order #${r.target_id}: “${o.item_title}”`;
        targetAuthorId = o.seller_id;
        orderSnap = {
          status: o.status, carrier: o.carrier ?? "", tracking_number: o.tracking_number ?? "",
          amount_cents: o.amount_cents, buyer_id: o.buyer_id, seller_id: o.seller_id,
          buyer_username: byId.get(o.buyer_id)?.username ?? "member",
          seller_username: byId.get(o.seller_id)?.username ?? "member",
          buyer_confirmed_at: iso(o.buyer_confirmed_at ?? null),
        };
      }
    } else if (r.target_type === "receipt") {
      const rc = await db.prepare("SELECT note, amount_cents, other_profile_id, profile_id FROM receipts WHERE id = ? LIMIT 1").bind(r.target_id).first();
      if (rc) {
        label = `Receipt: “${String(rc.note || "").slice(0, 60)}” (${money(rc.amount_cents)})`;
        targetAuthorId = rc.other_profile_id;
        orderSnap = { receipt_owner_id: rc.profile_id, other_profile_id: rc.other_profile_id, amount_cents: rc.amount_cents };
      }
    }
    const status = r.status === "reviewed" ? "resolved" : r.status;
    out.push({
      id: r.id, target_type: r.target_type, target_id: r.target_id, target_label: label,
      target_author_id: targetAuthorId,
      target_author_username: targetAuthorId ? (byId.get(targetAuthorId)?.username ?? "member") : null,
      reason: r.reason ?? "", detail: r.detail ?? "", outcome: r.outcome ?? "", resolution_note: r.resolution_note ?? "",
      order: orderSnap, notes: notesByReport.get(r.id) || [],
      status,
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
  // Waiting on the buyer — shipped 14+ days ago, buyer hasn't tapped
  // "I got it" yet. Computed at read time, no cron: the team sees the
  // list and can nudge the buyer by DM.
  let waitingOnBuyer = [];
  try {
    const cutoff = Date.now() - 14 * 86400000;
    const { results: w } = await db.prepare(
      `SELECT o.id, o.item_title, o.buyer_id, o.seller_id, o.carrier, o.tracking_number, o.amount_cents, o.updated_at,
              b.username AS buyer_username, s.username AS seller_username
       FROM orders o LEFT JOIN profiles b ON b.id = o.buyer_id LEFT JOIN profiles s ON s.id = o.seller_id
       WHERE o.status = 'shipped' AND o.buyer_confirmed_at IS NULL AND o.updated_at < ? ORDER BY o.updated_at ASC LIMIT 50`,
    ).bind(cutoff).all();
    waitingOnBuyer = (w || []).map((o) => ({
      order_id: o.id, item_title: o.item_title,
      buyer_id: o.buyer_id, buyer_username: o.buyer_username ?? "member",
      seller_id: o.seller_id, seller_username: o.seller_username ?? "member",
      carrier: o.carrier ?? "", tracking_number: o.tracking_number ?? "",
      amount_cents: o.amount_cents, shipped_at: iso(o.updated_at),
      days_waiting: Math.floor((Date.now() - o.updated_at) / 86400000),
    }));
  } catch { waitingOnBuyer = []; }
  return json({ reports: out, waiting_on_buyer: waitingOnBuyer });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first — reports come from members so they're accountable." });
  // General tickets (v3.21) — a member filing for help with no specific
  // post/comment/listing attached (harassment in DMs, account help, …).
  // target_id is 0; the ticket text is the reason and it is required.
  const isGeneral = a.target_type === "general";
  if (!isGeneral && !["post", "comment", "listing", "profile", "slug_appeal", "order", "receipt"].includes(a.target_type)) return json({ ok: false, error: "Pick what you're reporting." });
  const targetId = isGeneral ? 0 : Math.round(Number(a.target_id) || 0);
  if (!isGeneral && targetId <= 0) return json({ ok: false, error: "Missing item to report." });
  // Disputes (buyer + seller protection) — target_type "order" or
  // "receipt". The caller must be a party to the deal. Reason is a fixed
  // key; detail is the story in their own words (up to 1000 chars).
  const isDispute = a.target_type === "order" || a.target_type === "receipt";
  if (isDispute) {
    const DISPUTE_REASONS = ["not_received", "not_as_described", "fake", "other"];
    const reasonKey = String(a.reason || "").trim();
    if (!DISPUTE_REASONS.includes(reasonKey)) return json({ ok: false, error: "Pick what went wrong: not received, not as described, fake, or something else." });
    const detail = String(a.detail || "").trim().slice(0, 1000);
    if (!detail) return json({ ok: false, error: "Say what happened in a line or two — the team needs the story, not just the label." });
    let otherId = null;
    if (a.target_type === "order") {
      const orderRow = await db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1").bind(targetId).first();
      if (!orderRow) return json({ ok: false, error: "That order is gone." });
      if (orderRow.buyer_id !== me.id && orderRow.seller_id !== me.id) return json({ ok: false, error: "That's not your order." });
      otherId = orderRow.buyer_id === me.id ? orderRow.seller_id : orderRow.buyer_id;
    } else {
      const rc = await db.prepare("SELECT * FROM receipts WHERE id = ? LIMIT 1").bind(targetId).first();
      if (!rc) return json({ ok: false, error: "That receipt is gone." });
      if (rc.profile_id !== me.id) return json({ ok: false, error: "That's not your receipt." });
      otherId = rc.other_profile_id;
    }
    // One open dispute per member per deal — a second filing while one
    // is open just points at the one already in the queue.
    const open = await db.prepare(
      "SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status IN ('open', 'claimed') LIMIT 1",
    ).bind(me.id, a.target_type, targetId).first();
    if (open) return json({ ok: true, error: null, already_open: true, report_id: open.id });
    // False claims cost filing rights: two disputes the operator found
    // to be false and the member can't file another one. One false claim
    // is a warning, not a ban — the response carries it for the client.
    let falseCount = 0;
    try {
      const fc = await db.prepare(
        "SELECT COUNT(*) AS n FROM reports WHERE reporter_id = ? AND target_type IN ('order', 'receipt') AND status = 'resolved' AND outcome = 'buyer_fault'",
      ).bind(me.id).first();
      falseCount = (fc && fc.n) || 0;
    } catch { falseCount = 0; }
    if (falseCount >= 2) return json({ ok: false, error: "Dispute filing is closed for your account — two of your past disputes were found to be false claims. If you think that's a mistake, contact the team." });
    let inserted;
    try {
      inserted = await db.prepare(
        "INSERT INTO reports (reporter_id, target_type, target_id, reason, detail, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)",
      ).bind(me.id, a.target_type, targetId, reasonKey, detail, Date.now()).run();
    } catch (e) {
      if (/no such column/i.test(String((e && e.message) || e))) return json({ ok: false, error: "Disputes aren't switched on yet — the shop is still running a quick database update. Try again later." });
      throw e;
    }
    const reportId = inserted && inserted.meta ? inserted.meta.last_row_id : null;
    const label = a.target_type === "order" ? `Order #${targetId}` : `Receipt #${targetId}`;
    await notifyTeam(db, me, `@${me.username} opened a dispute on ${label} — ${reasonKey}`, "#/team", reportId);
    if (otherId) await createNotification(db, { profile_id: otherId, actor_profile_id: me.id, kind: "dispute", ref_type: "report", ref_id: reportId, text: `@${me.username} opened a dispute on ${label} — the team is looking at it. You can add your side from My Orders.`, link: "#/orders" });
    return json({ ok: true, error: null, report_id: reportId, warning: falseCount === 1 ? "Heads up: one of your past disputes was found to be a false claim. One more and you lose dispute filing — only file when something really went wrong." : null });
  }
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
  const reason = String(a.reason || "").trim().slice(0, isGeneral ? 1000 : 300);
  if (isGeneral && !reason) return json({ ok: false, error: "Say what happened first — a blank ticket helps nobody." });
  // Content reports dedup (one open report per member per item); general
  // tickets don't — each ticket is its own issue.
  if (!isGeneral) {
    const exists = await db.prepare(
      "SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open' LIMIT 1",
    ).bind(me.id, a.target_type, targetId).first();
    if (exists) return json({ ok: true, error: null });
  }
  await db.prepare(
    "INSERT INTO reports (reporter_id, target_type, target_id, reason, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)",
  ).bind(me.id, a.target_type, targetId, reason, Date.now()).run();
  return json({ ok: true, error: null });
}
