// Email sending — Resend (2026-11-22).
// One module, one provider, one sending system for the whole site:
// transactional mail (password resets, recovery codes, email
// verification, list confirmations) AND the mailing-list sync to a
// Resend Audience (newsletters go out as Broadcasts from the Resend
// dashboard — the site never sends bulk mail itself).
//
// Secrets live ONLY in Cloudflare env vars, never in code:
//   RESEND_API_KEY    — Resend API key. Needs FULL access (not
//                       send-only): contacts + audiences are
//                       management calls, not just sends.
//   MAIL_FROM         — sender, e.g. "Rare Candy Reserve
//                       <noreply@rarecandyreserve.org>". Defaults to
//                       that address when unset.
//   RESEND_AUDIENCE_ID — the Audience Chris creates in the Resend
//                       dashboard ("Rare Candy Reserve list"). When
//                       unset, the D1 list still works and the
//                       dashboard export path covers newsletters.
//   RESEND_WEBHOOK_SECRET — the whsec_... signing secret for the
//                       Resend webhook (contact unsubscribes syncing
//                       back to D1). Optional; without it the webhook
//                       endpoint refuses everything.
// Until the sending domain (rarecandyreserve.org) is verified in
// Resend, Resend only delivers to the account owner's own email —
// test with Chris's address first, then verify the domain.

const RESEND_API = "https://api.resend.com";
const DEFAULT_FROM = "Rare Candy Reserve <noreply@rarecandyreserve.org>";

export function mailConfigured(env) {
  return Boolean(env && env.RESEND_API_KEY);
}

export function mailFrom(env) {
  const from = String((env && env.MAIL_FROM) || "").trim();
  return from || DEFAULT_FROM;
}

export function audienceConfigured(env) {
  return Boolean(env && env.RESEND_AUDIENCE_ID);
}

function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// One Resend API call. Returns { ok, data } or { ok: false, error }.
// Single attempt, 15s timeout, same shape as _stripe.js's caller.
export async function resendCall(env, method, path, body) {
  const key = env && env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Email isn't switched on yet — the shop is still setting it up." };
  let res;
  try {
    const init = {
      method,
      headers: { authorization: "Bearer " + key, "content-type": "application/json" },
      signal: AbortSignal.timeout(15000),
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    res = await fetch(RESEND_API + path, init);
  } catch (e) {
    return { ok: false, error: "Couldn't reach the email service — try again in a bit." };
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const msg = (data && data.message) || (data && data.error && data.error.message) || ("The email service returned an error (" + res.status + ").");
    return { ok: false, error: msg };
  }
  return { ok: true, data };
}

// Send ONE transactional email. `to` is a single address. Returns
// { ok, id? } or { ok: false, error }. Never throws.
export async function sendMail(env, { to, subject, text, html, headers }) {
  const addr = String(to || "").trim();
  if (!addr) return { ok: false, error: "No recipient address." };
  if (!subject) return { ok: false, error: "No subject." };
  if (!text && !html) return { ok: false, error: "No email body." };
  const body = {
    from: mailFrom(env),
    to: [addr],
    subject: String(subject).slice(0, 200),
    text: text || undefined,
    html: html || undefined,
  };
  if (headers) body.headers = headers;
  const r = await resendCall(env, "POST", "/emails", body);
  if (!r.ok) return r;
  return { ok: true, id: (r.data && r.data.id) || null };
}

// Plain branded wrapper for account emails. `action` is { label, url }
// or null. The footer is honest: account mail can't be unsubscribed
// from (it isn't marketing), but it says where to change the address.
export function txEmailHtml({ title, paragraphs, action }) {
  const paras = (paragraphs || []).map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escHtml(p)}</p>`).join("");
  const button = action && action.url
    ? `<p style="margin:20px 0"><a href="${escHtml(action.url)}" style="display:inline-block;background:#ff2d95;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${escHtml(action.label)}</a></p><p style="color:#8b8496;font-size:13px;line-height:1.5">Button not working? Paste this link into your browser:<br><span style="word-break:break-all">${escHtml(action.url)}</span></p>`
    : "";
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a0714;color:#f2eef7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif"><div style="max-width:560px;margin:0 auto;padding:28px 20px"><p style="margin:0 0 4px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#ff2d95;font-weight:700">Rare Candy Reserve</p><h1 style="margin:0 0 18px;font-size:22px">${escHtml(title)}</h1>${paras}${button}<hr style="border:0;border-top:1px solid #2a2140;margin:26px 0 12px"><p style="color:#8b8496;font-size:12px;line-height:1.5">This is an account email from Rare Candy Reserve — it isn't marketing, so there's no unsubscribe link. You can change your recovery email in Edit profile on the site.</p></div></body></html>`;
}

// List-mail wrapper — same brand, different footer: this IS
// marketing mail, so the footer says so and always carries the
// one-click unsubscribe link. `unsubUrl` is required.
export function listEmailHtml({ title, paragraphs, action, unsubUrl }) {
  const paras = (paragraphs || []).map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escHtml(p)}</p>`).join("");
  const button = action && action.url
    ? `<p style="margin:20px 0"><a href="${escHtml(action.url)}" style="display:inline-block;background:#ff2d95;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${escHtml(action.label)}</a></p><p style="color:#8b8496;font-size:13px;line-height:1.5">Button not working? Paste this link into your browser:<br><span style="word-break:break-all">${escHtml(action.url)}</span></p>`
    : "";
  const unsub = unsubUrl
    ? `<p style="color:#8b8496;font-size:12px;line-height:1.5">You're getting this because you signed up for the Rare Candy Reserve mailing list. <a href="${escHtml(unsubUrl)}" style="color:#ff2d95">Unsubscribe</a> any time, one click, no login.</p>`
    : "";
  const footer = unsub ? `<hr style="border:0;border-top:1px solid #2a2140;margin:26px 0 12px">${unsub}` : "";
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a0714;color:#f2eef7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif"><div style="max-width:560px;margin:0 auto;padding:28px 20px"><p style="margin:0 0 4px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#ff2d95;font-weight:700">Rare Candy Reserve</p><h1 style="margin:0 0 18px;font-size:22px">${escHtml(title)}</h1>${paras}${button}${footer}</div></body></html>`;
}

// --- Mailing-list sync with the Resend Audience ---------------------------
// D1 is the source of truth for the site list. These calls mirror a
// confirmed subscriber into the Audience (for Broadcasts) and pull them
// back out on unsubscribe. Best-effort by design: they never throw and
// never block the D1 write — if Resend is unreachable the row still
// records the truth and the dashboard export covers the gap. The
// webhook (resend-webhook.js) closes the loop the other way: an
// unsubscribe clicked inside a Broadcast lands back in D1.
export async function audienceAddContact(env, email) {
  if (!audienceConfigured(env)) return { ok: false, error: "No Resend audience configured." };
  const r = await resendCall(env, "POST", `/audiences/${encodeURIComponent(env.RESEND_AUDIENCE_ID)}/contacts`, {
    email: String(email || "").trim().toLowerCase(),
    unsubscribed: false,
  });
  if (!r.ok) return r;
  return { ok: true, id: (r.data && (r.data.id || (r.data.data && r.data.data.id))) || null };
}

export async function audienceRemoveContact(env, email) {
  if (!audienceConfigured(env)) return { ok: false, error: "No Resend audience configured." };
  // The contacts API accepts the contact id OR the email address.
  const r = await resendCall(env, "DELETE", `/audiences/${encodeURIComponent(env.RESEND_AUDIENCE_ID)}/contacts/${encodeURIComponent(String(email || "").trim().toLowerCase())}`);
  return r;
}

// --- Svix webhook verification (Standard Webhooks) ------------------------
// Resend signs every webhook with three headers: svix-id,
// svix-timestamp, svix-signature ("v1,<base64 HMAC-SHA256>", possibly
// several space-separated candidates during a secret rotation). The
// signed content is `${svix-id}.${svix-timestamp}.${rawBody}` and the
// key is the whsec_... secret base64-decoded. Timestamp must be within
// 5 minutes (replay protection). Verifies against the RAW body bytes —
// never re-serialize parsed JSON, the bytes change and the signature
// won't match. Returns true/false, never throws.
export async function verifySvixSignature(secret, headers, rawBody) {
  try {
    const id = headers.get ? (headers.get("svix-id") || headers.get("webhook-id")) : (headers["svix-id"] || headers["webhook-id"]);
    const ts = headers.get ? (headers.get("svix-timestamp") || headers.get("webhook-timestamp")) : (headers["svix-timestamp"] || headers["webhook-timestamp"]);
    const sig = headers.get ? (headers.get("svix-signature") || headers.get("webhook-signature")) : (headers["svix-signature"] || headers["webhook-signature"]);
    if (!secret || !id || !ts || !sig) return false;
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) return false;
    if (Math.abs(Date.now() / 1000 - tsNum) > 300) return false; // 5 min window
    const b64 = String(secret).replace(/^whsec_/, "");
    const bin = atob(b64);
    const keyBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) keyBytes[i] = bin.charCodeAt(i);
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const msg = new TextEncoder().encode(`${id}.${ts}.${rawBody}`);
    const mac = await crypto.subtle.sign("HMAC", key, msg);
    const mine = btoa(String.fromCharCode(...new Uint8Array(mac)));
    const candidates = String(sig).split(/\s+/).map((c) => c.replace(/^v1,/, "")).filter(Boolean);
    return candidates.some((c) => c === mine);
  } catch {
    return false;
  }
}
