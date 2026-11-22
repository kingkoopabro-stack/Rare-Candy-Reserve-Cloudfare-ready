// One-click unsubscribe (2026-11-22) — no login, no account needed.
//   GET /api/unsubscribe?token=<raw>
// The link goes out in the welcome email and in every list mail's
// footer. The token is single-use: it dies the moment it works, so a
// forwarded email can't unsubscribe someone twice over. The removal
// mirrors back to the Resend Audience (best-effort) so Broadcasts stop
// too. Transactional mail (resets, recovery codes) is NOT affected —
// unsubscribing from the list never blocks account emails.
import { json, noDb, getDb, nowMs } from "./_lib.js";
import { audienceRemoveContact } from "./_mail.js";
import { sha256Hex } from "./_auth.js";

function page(title, body, status) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Rare Candy Reserve</title></head><body style="margin:0;background:#0a0714;color:#f2eef7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif"><main style="max-width:560px;margin:0 auto;padding:48px 20px"><p style="margin:0 0 4px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#ff2d95;font-weight:700">Rare Candy Reserve</p><h1 style="margin:0 0 16px;font-size:24px">${title}</h1>${body}<p style="margin:32px 0 0"><a href="/" style="color:#ff2d95">← Back to Rare Candy Reserve</a></p></main></body></html>`;
  return new Response(html, { status: status || 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!token) {
    return page("Unsubscribe", "<p>This link needs a token to work — it comes in the footer of every mailing-list email. Lost it? <a href=\"/unsubscribe.html\" style=\"color:#ff2d95\">Ask for a fresh link</a> and it'll come to your inbox.</p>", 400);
  }
  let row = null;
  try {
    const tokenHash = await sha256Hex(token);
    row = await db.prepare("SELECT * FROM mailing_list WHERE unsubscribe_token_hash = ? LIMIT 1").bind(tokenHash).first();
  } catch {
    return page("Not set up yet", "<p>The mailing list isn't set up yet — the shop is still running the database update.</p>", 500);
  }
  if (!row) {
    return page("That link didn't work", "<p>It may have already been used, or it's not a real unsubscribe link. <a href=\"/unsubscribe.html\" style=\"color:#ff2d95\">Ask for a fresh link</a> and it'll come to your inbox.</p>", 400);
  }
  if (row.status === "unsubscribed") {
    return page("Already unsubscribed", `<p>${row.email} is already off the mailing list — nothing more to do. Changed your mind? Sign up again from the footer of any page.</p>`);
  }
  try {
    await db.prepare(
      "UPDATE mailing_list SET status = 'unsubscribed', unsubscribed_at = ?, unsubscribe_token_hash = '' WHERE id = ?",
    ).bind(nowMs(), row.id).run();
  } catch {
    return page("Couldn't unsubscribe", "<p>Something went wrong saving that — try the link again, or ask Chris.</p>", 500);
  }
  // Mirror the removal to the Resend Audience (best-effort — the D1
  // row is the truth; a failed sync just means the dashboard export
  // covers it, and the webhook closes the loop the other way).
  try { await audienceRemoveContact(env, row.email); } catch { /* best effort */ }
  return page("You're unsubscribed",
    `<p>${row.email} is off the mailing list — no more shop drops or community news by email.</p><p>Changed your mind later? Sign up again from the footer of any page.</p><p style="color:#8b8496;font-size:13px">Your account emails (like password resets) aren't affected by this — those aren't marketing.</p>`);
}
