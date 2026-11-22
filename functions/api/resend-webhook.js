// Resend webhook (2026-11-22) — closes the unsubscribe loop.
//   POST /api/resend-webhook
// Resend signs every webhook with Svix headers (svix-id,
// svix-timestamp, svix-signature) — verified against the RAW body
// with the whsec_... secret in RESEND_WEBHOOK_SECRET (see _mail.js).
// Without the secret configured the endpoint refuses everything (501)
// rather than trusting unsigned mail.
// Events handled:
//   contact.updated with unsubscribed=true  → mark D1 unsubscribed
//   contact.deleted                         → mark D1 unsubscribed
// Everything else is ignored: the site list is the source of truth,
// so a contact added in the Resend dashboard does NOT join D1 (add
// subscribers through the site form only). The D1 update is a plain
// idempotent UPDATE, so a replayed webhook is harmless. No auth
// beyond the signature — Resend is the only caller.
import { json, noDb, getDb, nowMs } from "./_lib.js";
import { verifySvixSignature } from "./_mail.js";

async function markUnsubscribed(db, email) {
  try {
    await db.prepare(
      "UPDATE mailing_list SET status = 'unsubscribed', unsubscribed_at = ?, unsubscribe_token_hash = '' WHERE email = ? AND status = 'subscribed'",
    ).bind(nowMs(), email).run();
  } catch { /* table not there yet */ }
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const secret = env.RESEND_WEBHOOK_SECRET || "";
  if (!secret) return json({ ok: false, error: "Webhook isn't switched on — add RESEND_WEBHOOK_SECRET first." }, 501);
  const raw = await request.text();
  const ok = await verifySvixSignature(secret, request.headers, raw);
  if (!ok) return json({ ok: false, error: "Bad signature." }, 401);
  let evt = null;
  try { evt = JSON.parse(raw); } catch { return json({ ok: false, error: "Bad JSON." }, 400); }
  const type = String(evt.type || "");
  const email = String((evt.data && evt.data.email) || "").trim().toLowerCase();
  if (!email) return json({ ok: true });
  if (type === "contact.updated" && evt.data && evt.data.unsubscribed === true) {
    await markUnsubscribed(db, email);
  } else if (type === "contact.deleted") {
    await markUnsubscribed(db, email);
  }
  return json({ ok: true });
}
