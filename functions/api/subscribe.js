// Mailing list (2026-11-22) — the site's own list, stored in D1.
// DOUBLE opt-in, deliberately: the form is public, so a single opt-in
// would let anyone subscribe someone else's inbox. A row starts
// 'pending' until the person clicks the confirm link in the email
// (24h). Only SHA-256 hashes of tokens are stored — a leaked table
// can't confirm or unsubscribe anyone.
//   POST /api/subscribe { action: "subscribe", email, source }
//   POST /api/subscribe { action: "request-unsubscribe", email }
//   GET  /api/subscribe?confirm=<token>  — one-click confirm (HTML page)
//   GET  /api/subscribe?export=1&device_id=<operator> — CSV of subscribers
// Newsletters themselves go out as Resend Broadcasts from the Resend
// dashboard, to the Audience the confirmed list mirrors into
// (RESEND_AUDIENCE_ID). The site never sends bulk mail — one sending
// system only. Unsubscribes land back here from three places: the
// one-click link in every mail, the Resend webhook (resend-webhook.js),
// and the dashboard (manual removal + CSV export). Reset / recovery
// mail is transactional — it is NOT affected by list unsubscribes.
// The footer form (site.js) + the homepage section (index.html) post
// here. The list is closed until a mail provider is configured.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, nowMs } from "./_lib.js";
import { mailConfigured, sendMail, listEmailHtml, audienceAddContact } from "./_mail.js";
import { randomToken, sha256Hex, checkRateLimit, isValidEmail } from "./_auth.js";

const CONFIRM_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function pageHtml(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Rare Candy Reserve</title></head><body style="margin:0;background:#0a0714;color:#f2eef7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif"><main style="max-width:560px;margin:0 auto;padding:48px 20px"><p style="margin:0 0 4px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#ff2d95;font-weight:700">Rare Candy Reserve</p><h1 style="margin:0 0 16px;font-size:24px">${title}</h1>${body}<p style="margin:32px 0 0"><a href="/" style="color:#ff2d95">← Back to Rare Candy Reserve</a></p></main></body></html>`;
}

function page(title, body, status) {
  return new Response(pageHtml(title, body), {
    status: status || 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function sendConfirmEmail(env, request, email, rawToken) {
  const link = `${new URL(request.url).origin}/api/subscribe?confirm=${encodeURIComponent(rawToken)}`;
  return sendMail(env, {
    to: email,
    subject: "Confirm your Rare Candy Reserve mailing list signup",
    text: `Thanks for signing up for the Rare Candy Reserve mailing list — shop drops, community news, and the odd giveaway.\n\nClick this link within 24 hours to confirm:\n\n${link}\n\nIf that wasn't you, ignore this email.`,
    html: listEmailHtml({
      title: "One more click — confirm your signup",
      paragraphs: [
        "Thanks for signing up for the Rare Candy Reserve mailing list — shop drops, community news, and the odd giveaway.",
        "Click the button below within 24 hours to confirm. If that wasn't you, ignore this email.",
      ],
      action: { label: "Yes, sign me up →", url: link },
    }),
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const action = String(a.action || "");
  const now = nowMs();

  if (action === "subscribe") {
    // Honeypot: a hidden "website" field real humans never fill. Bots
    // get the happy reply and nothing else.
    if (String(a.website || "").trim()) {
      return json({ ok: true, message: "Check your inbox — click the confirm link within 24 hours and you're on the list." });
    }
    const email = String(a.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) return json({ ok: false, error: "That doesn't look like an email address." });
    const source = ["footer", "homepage"].includes(String(a.source || "")) ? String(a.source) : "footer";
    if (!mailConfigured(env)) {
      return json({ ok: false, error: "The mailing list isn't open yet — the shop is still switching email on. Try again in a bit." });
    }
    const rl = await checkRateLimit(db, "subscribe:" + email, 3, 60 * 60 * 1000);
    if (!rl.allowed) return json({ ok: false, error: "Too many signup tries for that address — try again in a bit." });
    const rawToken = randomToken(32);
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = now + CONFIRM_TTL_MS;
    let row = null;
    try { row = await db.prepare("SELECT * FROM mailing_list WHERE email = ? LIMIT 1").bind(email).first(); } catch { return json({ ok: false, error: "The mailing list isn't set up yet — the shop is still running the database update." }); }
    if (row && row.status === "subscribed") {
      return json({ ok: true, message: "You're already on the list." });
    }
    try {
      if (row) {
        await db.prepare(
          "UPDATE mailing_list SET status = 'pending', source = ?, confirm_token_hash = ?, confirm_expires_at = ?, unsubscribed_at = NULL WHERE id = ?",
        ).bind(source, tokenHash, expiresAt, row.id).run();
      } else {
        await db.prepare(
          "INSERT INTO mailing_list (email, status, source, confirm_token_hash, confirm_expires_at, created_at) VALUES (?, 'pending', ?, ?, ?, ?)",
        ).bind(email, source, tokenHash, expiresAt, now).run();
      }
    } catch { return json({ ok: false, error: "Couldn't save that signup — try again." }); }
    const sent = await sendConfirmEmail(env, request, email, rawToken);
    if (!sent.ok) {
      return json({ ok: false, error: "Couldn't send the confirmation email — try again in a bit." });
    }
    return json({ ok: true, message: "Check your inbox — click the confirm link within 24 hours and you're on the list." });
  }

  if (action === "request-unsubscribe") {
    // The "I lost the link" path: the site emails the one-click
    // unsubscribe link to the address itself. A fresh token is minted
    // each time (the old one dies), and the reply stays generic either
    // way — no leak of whether the address is on the list.
    const email = String(a.email || "").trim().toLowerCase();
    const generic = "If that address is on the list, an unsubscribe link is on its way to it.";
    if (!isValidEmail(email)) return json({ ok: true, message: generic });
    if (!mailConfigured(env)) return json({ ok: false, error: "Email isn't switched on yet — the shop is still setting it up. Try again in a bit." });
    const rl = await checkRateLimit(db, "subscribe:" + email, 3, 60 * 60 * 1000);
    if (!rl.allowed) return json({ ok: true, message: generic });
    let row = null;
    try { row = await db.prepare("SELECT * FROM mailing_list WHERE email = ? LIMIT 1").bind(email).first(); } catch { return json({ ok: true, message: generic }); }
    if (!row || row.status !== "subscribed") return json({ ok: true, message: generic });
    const rawToken = randomToken(32);
    const tokenHash = await sha256Hex(rawToken);
    try {
      await db.prepare("UPDATE mailing_list SET unsubscribe_token_hash = ? WHERE id = ?").bind(tokenHash, row.id).run();
    } catch { return json({ ok: true, message: generic }); }
    const link = `${new URL(request.url).origin}/api/unsubscribe?token=${encodeURIComponent(rawToken)}`;
    await sendMail(env, {
      to: email,
      subject: "Unsubscribe from the Rare Candy Reserve mailing list",
      text: `Here's the one-click unsubscribe link you asked for:\n\n${link}\n\nClick it and you're off the list — no more shop drops or community news by email. (Your account emails, like password resets, aren't affected.)`,
      html: listEmailHtml({
        title: "Unsubscribe from the mailing list",
        unsubUrl: link,
        paragraphs: [
          "Here's the one-click unsubscribe link you asked for. Click it and you're off the list — no more shop drops or community news by email.",
          "Your account emails, like password resets, aren't affected.",
        ],
        action: { label: "Unsubscribe me →", url: link },
      }),
    });
    return json({ ok: true, message: generic });
  }

  return json({ ok: false, error: "Unknown subscribe action." });
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const now = nowMs();

  // Operator-only CSV export (for a manual Resend import if the
  // Audience sync ever drifts). Subscribed rows only.
  if (url.searchParams.get("export") === "1") {
    const me = await profileByDevice(db, url.searchParams.get("device_id") || "");
    if (!me || !isOperator(env, me)) return json({ ok: false, error: "Operator only." }, 403);
    let rows = [];
    try {
      const r = await db.prepare("SELECT email, subscribed_at, source FROM mailing_list WHERE status = 'subscribed' ORDER BY subscribed_at ASC").all();
      rows = r.results || [];
    } catch { return json({ ok: false, error: "The mailing list isn't set up yet." }); }
    const csv = "email,subscribed_at,source\n" + rows.map((r) => [r.email, r.subscribed_at || "", r.source || ""].join(",")).join("\n") + "\n";
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="rare-candy-reserve-mailing-list.csv"',
      },
    });
  }

  // One-click confirm.
  const token = url.searchParams.get("confirm") || "";
  if (!token) return page("Nothing here", "<p>That link doesn't do anything on its own — sign up from the form in the footer of any page.</p>", 404);
  let row = null;
  try {
    const tokenHash = await sha256Hex(token);
    row = await db.prepare("SELECT * FROM mailing_list WHERE confirm_token_hash = ? AND status = 'pending' LIMIT 1").bind(tokenHash).first();
  } catch { return page("Not set up yet", "<p>The mailing list isn't set up yet — the shop is still running the database update.</p>", 500); }
  if (!row || !row.confirm_expires_at || row.confirm_expires_at < now) {
    return page("That link didn't work", "<p>It may have expired (confirm links last 24 hours) or already been used. Sign up again from the form in the footer of any page and a fresh link will come through.</p>", 400);
  }
  // Confirm + mint the unsubscribe token in one go. The confirm hash
  // is cleared so the link can't be replayed.
  const rawUnsub = randomToken(32);
  const unsubHash = await sha256Hex(rawUnsub);
  try {
    await db.prepare(
      "UPDATE mailing_list SET status = 'subscribed', subscribed_at = ?, confirm_token_hash = '', unsubscribe_token_hash = ? WHERE id = ?",
    ).bind(now, unsubHash, row.id).run();
  } catch { return page("Couldn't confirm", "<p>Something went wrong saving that — try signing up again.</p>", 500); }
  // Mirror into the Resend Audience (best-effort — the D1 row is the
  // truth; a failed sync just means the dashboard export covers it).
  try {
    const sync = await audienceAddContact(env, row.email);
    if (sync.ok) {
      await db.prepare("UPDATE mailing_list SET resend_contact_id = ?, audience_synced = 1 WHERE id = ?").bind(String(sync.id || ""), row.id).run();
    }
  } catch { /* best effort */ }
  // Welcome email, with the one-click unsubscribe link in it.
  const unsubLink = `${url.origin}/api/unsubscribe?token=${encodeURIComponent(rawUnsub)}`;
  sendMail(env, {
    to: row.email,
    subject: "You're on the Rare Candy Reserve mailing list",
    text: `You're in — shop drops, community news, and the odd giveaway, in your inbox.\n\nChanged your mind? Unsubscribe any time, one click, no login:\n\n${unsubLink}`,
    html: listEmailHtml({
      title: "You're on the list",
      unsubUrl: unsubLink,
      paragraphs: [
        "You're in — shop drops, community news, and the odd giveaway, in your inbox.",
        "Changed your mind? Unsubscribe any time, one click, no login — the button below does it.",
      ],
      action: { label: "Unsubscribe", url: unsubLink },
    }),
  }).catch(() => { /* welcome mail is best-effort */ });
  return page("You're on the list ✓",
    "<p>Thanks — you'll get shop drops, community news, and the odd giveaway by email. A welcome email is on its way, and every mail has a one-click unsubscribe link at the bottom.</p>");
}
