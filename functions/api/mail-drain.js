// Mail queue drain (2026-11-22) — operator only.
//   POST /api/mail-drain { device_id }
// Two jobs, in order:
//   1. EXPIRE stale rows. A queued message carries a token or code
//      with a real TTL (reset link 1h, everything else 24h). Past that
//      the row is dead — mark it "expired" and never send it. Old
//      codes must never be blasted.
//   2. RETRY fresh rows that have a recipient (to_address). The queue
//      stores the text body, so a retry sends text-only — the HTML
//      version only goes out on the first, inline send. A retry of a
//      recovery-code row re-sends the SAME code (still valid inside
//      its 24h); a retry of a reset row re-sends the same link.
// Rows with no recipient (shop notifications queued by
// notifyBuyerSeller) are skipped — there is nowhere to send them.
// Run it from the Admin panel ("Send queued mail now") or by hand
// after the migration, to flush anything queued while the provider
// was off. Returns { ok, sent, failed, expired }.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, nowMs, OUTBOUND_TTL_MS } from "./_lib.js";
import { mailConfigured, sendMail } from "./_mail.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me || !isOperator(env, me)) return json({ ok: false, error: "Operator only." }, 403);
  if (!mailConfigured(env)) return json({ ok: false, error: "Email isn't switched on yet — add RESEND_API_KEY first." });
  const now = nowMs();
  let expired = 0, sent = 0, failed = 0;
  // 1. Expire anything past its TTL.
  for (const kind of Object.keys(OUTBOUND_TTL_MS)) {
    try {
      const r = await db.prepare(
        "UPDATE notifications_outbound SET status = 'expired' WHERE kind = ? AND status IN ('waiting_provider', 'failed') AND created_at < ?",
      ).bind(kind, now - OUTBOUND_TTL_MS[kind]).run();
      expired += (r.meta && r.meta.changes) || 0;
    } catch { /* queue table not there yet */ }
  }
  // 2. Retry fresh rows that have a recipient.
  let rows = [];
  try {
    const r = await db.prepare(
      "SELECT id, subject, body, to_address FROM notifications_outbound WHERE status IN ('waiting_provider', 'failed') AND to_address != '' ORDER BY created_at ASC LIMIT 50",
    ).all();
    rows = r.results || [];
  } catch { rows = []; }
  for (const row of rows) {
    const res = await sendMail(env, { to: row.to_address, subject: row.subject, text: row.body });
    try {
      if (res.ok) {
        await db.prepare("UPDATE notifications_outbound SET status = 'sent', sent_at = ? WHERE id = ?").bind(now, row.id).run();
        sent++;
      } else {
        await db.prepare("UPDATE notifications_outbound SET status = 'failed', error = ? WHERE id = ?").bind(String(res.error || "send failed").slice(0, 300), row.id).run();
        failed++;
      }
    } catch { /* best effort */ }
  }
  return json({ ok: true, sent, failed, expired });
}
