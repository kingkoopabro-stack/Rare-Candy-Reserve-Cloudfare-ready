// GET /api/reports/:id — one dispute, for the team or either party to
// the deal. Returns the report (reason, detail, outcome, resolution
// note), the order/receipt snapshot (status, tracking, amount, CS#),
// and the notes thread. Other members get nothing — a dispute is
// between the buyer, the seller, and the team.
import { json, noDb, getDb, profileByDevice, roleOf, isTeamRole, iso, money } from "../_lib.js";

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first." });
  const id = Number(params.id);
  const r = await db.prepare("SELECT * FROM reports WHERE id = ? LIMIT 1").bind(id).first();
  if (!r) return json({ ok: false, error: "That dispute is gone." });
  if (r.target_type !== "order" && r.target_type !== "receipt") {
    return json({ ok: false, error: "This is a content report, not a dispute — it lives in the team queue." });
  }
  // Who may see it: team, the reporter, or the other party.
  let allowed = isTeamRole(roleOf(me));
  let orderSnap = null;
  if (r.target_type === "order") {
    const o = await db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1").bind(r.target_id).first();
    if (o) {
      if (o.buyer_id === me.id || o.seller_id === me.id) allowed = true;
      const byId = new Map();
      try {
        const { results: ps } = await db.prepare("SELECT id, username FROM profiles WHERE id IN (?, ?)").bind(o.buyer_id, o.seller_id).all();
        for (const p of (ps || [])) byId.set(p.id, p.username);
      } catch { /* usernames stay "member" */ }
      let csNumber = null;
      try {
        const cs = await db.prepare("SELECT cs_number FROM content_sales WHERE listing_id = ? AND buyer_id = ? LIMIT 1").bind(o.listing_id, o.buyer_id).first();
        csNumber = cs ? cs.cs_number : null;
      } catch { csNumber = null; }
      orderSnap = {
        order_id: o.id, item_title: o.item_title, status: o.status,
        carrier: o.carrier ?? "", tracking_number: o.tracking_number ?? "",
        amount_cents: o.amount_cents, shipping_cents: o.shipping_cents ?? 0,
        cs_number: csNumber,
        buyer_id: o.buyer_id, buyer_username: byId.get(o.buyer_id) ?? "member",
        seller_id: o.seller_id, seller_username: byId.get(o.seller_id) ?? "member",
        buyer_confirmed_at: iso(o.buyer_confirmed_at ?? null),
        created_at: iso(o.created_at),
      };
    }
  } else {
    const rc = await db.prepare("SELECT * FROM receipts WHERE id = ? LIMIT 1").bind(r.target_id).first();
    if (rc) {
      if (rc.profile_id === me.id || rc.other_profile_id === me.id) allowed = true;
      orderSnap = { receipt_id: rc.id, note: rc.note ?? "", amount_cents: rc.amount_cents, other_profile_id: rc.other_profile_id, owner_id: rc.profile_id, created_at: iso(rc.created_at) };
    }
  }
  if (r.reporter_id === me.id) allowed = true;
  if (!allowed) return json({ ok: false, error: "That's not your dispute." });
  let notes = [];
  try {
    const { results } = await db.prepare(
      "SELECT n.*, p.username AS author_username FROM dispute_notes n LEFT JOIN profiles p ON p.id = n.author_id WHERE n.report_id = ? ORDER BY n.created_at ASC, n.id ASC",
    ).bind(id).all();
    notes = (results || []).map((n) => ({ id: n.id, author_id: n.author_id, author_username: n.author_username ?? "member", body: n.body ?? "", created_at: iso(n.created_at) }));
  } catch { notes = []; }
  const reporter = await db.prepare("SELECT username FROM profiles WHERE id = ? LIMIT 1").bind(r.reporter_id).first();
  return json({
    ok: true,
    report: {
      id: r.id, target_type: r.target_type, target_id: r.target_id, status: r.status === "reviewed" ? "resolved" : r.status,
      reason: r.reason ?? "", detail: r.detail ?? "", outcome: r.outcome ?? "", resolution_note: r.resolution_note ?? "",
      reporter_id: r.reporter_id, reporter_username: (reporter && reporter.username) || "member",
      assignee_id: r.assignee_id ?? null, created_at: iso(r.created_at), resolved_at: iso(r.resolved_at ?? null),
      order: orderSnap, notes,
    },
  });
}
