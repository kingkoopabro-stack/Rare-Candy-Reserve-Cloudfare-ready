// Password auth (2026-11-22) — the Community's real sign-in.
// POST /api/auth — one endpoint, dispatched on body.action:
//   signin             { login, password } -> { device_id } (the session
//                      key; the password gates its issue, nothing else)
//   set-password       { device_id, current_password?, new_password }
//                      signed-in members set (or change) their password
//   request-reset      { login } -> ALWAYS the same reply, whether the
//                      account exists or not (no existence leaks)
//   reset-password     { token, new_password } — single-use, 1h link
//   set-recovery-email { device_id, email } — new address must be
//                      verified before it replaces the old one
//   verify-email       { token } — confirms a pending recovery email
//   request-recovery   { username, contact, message } — public; notifies
//                      the operator, who verifies out-of-band
//   list-recovery      { device_id } — operator only: pending requests
//   issue-recovery     { device_id, request_id } — operator only: mints
//                      a one-time recovery code, shown ONCE to the
//                      operator, who sends it to the member privately
//   use-recovery       { code, new_password } — burns the code, sets the
//                      password
// Passwords live in D1 as PBKDF2-SHA256 hashes + per-user salts only
// (see _auth.js). Tokens live as SHA-256 hashes only. Nothing here ever
// returns or logs a password, a token, or a device id except signin's
// own session key to the member who just proved the password.
// Reset / verify emails go out through deliverOutbound (_lib.js):
// when a mail provider is configured (Resend — RESEND_API_KEY in the
// Cloudflare vars, see _mail.js) they send immediately, inline. Without
// a provider they queue as "waiting_provider" exactly as before and
// the manual operator path still works. A recovery code is emailed
// automatically ONLY to the member's VERIFIED recovery email on file —
// never to an address the requester merely typed (see request-recovery;
// that would hand an account to whoever types the victim's name).
// The member still gets the in-app notice either way.
// 2FA is a follow-up, deliberately NOT built here.
import {
  json, noDb, getDb, readJson, profileByDevice, isOperator,
  createNotification, deliverOutbound, nowMs,
} from "./_lib.js";
import { mailConfigured, txEmailHtml } from "./_mail.js";
import {
  hashPassword, verifyPassword, checkPasswordStrength, isValidEmail,
  issueToken, consumeToken, invalidateTokens, checkRateLimit, hasAuthColumns,
  RESET_TOKEN_TTL_MS, VERIFY_TOKEN_TTL_MS, RECOVERY_CODE_TTL_MS,
  LOCKOUT_AFTER_FAILURES, LOCKOUT_MS,
} from "./_auth.js";

// Fixed dummy hash/salt so a sign-in for an account that doesn't exist
// (or never set a password) still costs one PBKDF2 round — timing alone
// can't tell an attacker the account isn't there.
const DUMMY_HASH = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const DUMMY_SALT = "AAAAAAAAAAAAAAAAAAAAAA==";

const GENERIC_SIGNIN_ERROR = "That username/email or password didn't match — check both and try again.";
const GENERIC_RESET_REPLY = "If an account uses that email or username, a reset link is on its way.";
const EMAIL_NOT_CONNECTED_NOTE = " Email sending isn't connected yet, so it may take a while to arrive — the request is queued and will go out once the shop connects it.";

function fail(error) { return json({ ok: false, error }); }

async function findByLogin(db, login) {
  const value = String(login || "").trim();
  if (!value) return null;
  let row = null;
  try {
    row = await db.prepare("SELECT * FROM profiles WHERE username = ? COLLATE NOCASE LIMIT 1").bind(value).first();
  } catch { /* pre-migration table shape — fall through */ }
  if (row) return row;
  if (value.includes("@")) {
    try {
      row = await db.prepare("SELECT * FROM profiles WHERE recovery_email = ? COLLATE NOCASE AND recovery_email_verified = 1 LIMIT 1").bind(value).first();
    } catch { /* recovery columns not there yet */ }
  }
  return row || null;
}

function resetLinkFor(request, token) {
  return `${new URL(request.url).origin}/forgot-password.html?token=${encodeURIComponent(token)}`;
}
function verifyLinkFor(request, token) {
  return `${new URL(request.url).origin}/forgot-password.html?verify=${encodeURIComponent(token)}`;
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const action = String(a.action || "");
  const now = nowMs();
  // Shown only while no mail provider is connected — the setup note is
  // site-wide (not account-specific), so it leaks nothing.
  const emailNote = mailConfigured(env) ? "" : EMAIL_NOT_CONNECTED_NOTE;

  // Everything below needs the password-auth migration. One clean error
  // instead of a crash, so the site keeps working pre-migration.
  if (!(await hasAuthColumns(db))) {
    return fail("Password sign-in isn't set up yet — the shop is still running the database update. Try again once that's done.");
  }

  // --- signin ---------------------------------------------------------------
  if (action === "signin") {
    const login = String(a.login || "").trim();
    const password = String(a.password || "");
    if (!login || !password) return fail(GENERIC_SIGNIN_ERROR);
    const rl = await checkRateLimit(db, "signin:" + login.toLowerCase(), 10, 15 * 60 * 1000);
    if (!rl.allowed) return json({ ok: false, error: "Too many sign-in tries — wait a few minutes and try again." }, 429);
    const profile = await findByLogin(db, login);
    if (!profile || !profile.password_hash) {
      // Dummy round: same cost, same reply, no existence leak.
      await verifyPassword(password, DUMMY_HASH, DUMMY_SALT);
      return fail(GENERIC_SIGNIN_ERROR);
    }
    if (profile.locked_until && now < profile.locked_until) {
      return json({ ok: false, error: "Too many wrong tries — this account is locked for a few minutes. Try again shortly, or reset your password." }, 429);
    }
    const good = await verifyPassword(password, profile.password_hash, profile.password_salt);
    if (!good) {
      const fails = Number(profile.failed_login_attempts || 0) + 1;
      const lockedUntil = fails >= LOCKOUT_AFTER_FAILURES ? now + LOCKOUT_MS : (profile.locked_until || null);
      try {
        await db.prepare("UPDATE profiles SET failed_login_attempts = ?, locked_until = ? WHERE id = ?").bind(fails, lockedUntil, profile.id).run();
      } catch { /* counters not there yet — the error below still applies */ }
      if (fails >= LOCKOUT_AFTER_FAILURES) {
        return json({ ok: false, error: "Too many wrong tries — this account is locked for 15 minutes. Try again shortly, or reset your password." }, 429);
      }
      return fail(GENERIC_SIGNIN_ERROR);
    }
    try {
      await db.prepare("UPDATE profiles SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?").bind(profile.id).run();
    } catch { /* best effort */ }
    return json({ ok: true, device_id: profile.device_id, username: profile.username });
  }

  // --- set-password (signed in, via the session device id) -------------------
  if (action === "set-password") {
    const me = await profileByDevice(db, String(a.device_id || ""));
    if (!me) return fail("Sign in first — then you can set a password.");
    const strengthError = checkPasswordStrength(a.new_password);
    if (strengthError) return fail(strengthError);
    if (me.password_hash) {
      if (!(await verifyPassword(String(a.current_password || ""), me.password_hash, me.password_salt))) {
        return fail("That current password didn't match.");
      }
    }
    const { hash, salt } = await hashPassword(a.new_password);
    try {
      await db.prepare(
        "UPDATE profiles SET password_hash = ?, password_salt = ?, password_set_at = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
      ).bind(hash, salt, now, me.id).run();
    } catch (e) {
      // A half-run password migration (password_hash exists so the guard
      // passed, but a later column is missing) used to crash this whole
      // request into a "Request failed" page. One clean error instead.
      return fail("Password setup isn't finished yet — the shop's database update is incomplete. Try again once that's done.");
    }
    await invalidateTokens(db, me.id, ["reset", "recovery"]);
    await createNotification(db, {
      profile_id: me.id, actor_profile_id: null, kind: "password_changed",
      ref_type: "profile", ref_id: me.id,
      text: "Your password was changed. If that wasn't you, reset it right away or ask Chris for help.",
      link: "#/member/" + me.id,
    });
    return json({ ok: true, message: "Password saved — that's how you sign in from now on." });
  }

  // --- request-reset (identical reply whether the account exists or not) -----
  if (action === "request-reset") {
    const login = String(a.login || "").trim();
    if (!login) return json({ ok: true, message: GENERIC_RESET_REPLY + emailNote });
    const rl = await checkRateLimit(db, "reset:" + login.toLowerCase(), 3, 60 * 60 * 1000);
    if (!rl.allowed) return json({ ok: true, message: GENERIC_RESET_REPLY + emailNote });
    const profile = await findByLogin(db, login);
    if (profile && profile.recovery_email_verified === 1 && profile.recovery_email) {
      const token = await issueToken(db, profile.id, "reset", RESET_TOKEN_TTL_MS, "");
      const link = resetLinkFor(request, token);
      await deliverOutbound(env, db, profile.id, "email", "password_reset",
        "Reset your Rare Candy Reserve password",
        `Someone asked to reset the password for @${profile.username}. Use this link once within 1 hour — after that it stops working:\n\n${link}\n\nIf that wasn't you, ignore this email. Your old password still works until a reset goes through.`,
        profile.recovery_email,
        txEmailHtml({
          title: "Reset your password",
          paragraphs: [
            `Someone asked to reset the password for @${profile.username}.`,
            "Use the button below once, within 1 hour — after that it stops working. If that wasn't you, ignore this email. Your old password still works until a reset goes through.",
          ],
          action: { label: "Reset my password →", url: link },
        }));
      await createNotification(db, {
        profile_id: profile.id, actor_profile_id: null, kind: "password_reset",
        ref_type: "profile", ref_id: profile.id,
        text: "A password reset was requested for your account. If that wasn't you, ignore it — your old password still works.",
        link: "#/member/" + profile.id,
      });
    } else if (profile) {
      // Account exists but no verified recovery email: nothing to send
      // to — tell them in-app so they can fix it, still no leak outside.
      await createNotification(db, {
        profile_id: profile.id, actor_profile_id: null, kind: "password_reset",
        ref_type: "profile", ref_id: profile.id,
        text: "Someone asked to reset your password, but you have no verified recovery email — add one in Edit profile so resets can reach you.",
        link: "#/member/" + profile.id,
      });
    }
    return json({ ok: true, message: GENERIC_RESET_REPLY + emailNote });
  }

  // --- reset-password (single-use, 1h token) ----------------------------------
  if (action === "reset-password") {
    const strengthError = checkPasswordStrength(a.new_password);
    if (strengthError) return fail(strengthError);
    const row = await consumeToken(db, "reset", a.token);
    if (!row) return fail("That reset link didn't work — it may have expired or already been used. Ask for a fresh one.");
    const profile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(row.profile_id).first();
    if (!profile) return fail("That reset link didn't work — it may have expired or already been used. Ask for a fresh one.");
    const { hash, salt } = await hashPassword(a.new_password);
    await db.prepare(
      "UPDATE profiles SET password_hash = ?, password_salt = ?, password_set_at = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
    ).bind(hash, salt, now, profile.id).run();
    await invalidateTokens(db, profile.id, ["reset", "recovery"]);
    await createNotification(db, {
      profile_id: profile.id, actor_profile_id: null, kind: "password_changed",
      ref_type: "profile", ref_id: profile.id,
      text: "Your password was reset. If that wasn't you, tell Chris right away.",
      link: "#/member/" + profile.id,
    });
    if (profile.recovery_email_verified === 1 && profile.recovery_email) {
      await deliverOutbound(env, db, profile.id, "email", "password_changed",
        "Your Rare Candy Reserve password was changed",
        `The password for @${profile.username} was just changed. If that was you, nothing to do. If it wasn't, ask Chris for account recovery right away.`,
        profile.recovery_email,
        txEmailHtml({
          title: "Your password was changed",
          paragraphs: [
            `The password for @${profile.username} was just changed.`,
            "If that was you, nothing to do. If it wasn't, ask Chris for account recovery right away.",
          ],
          action: { label: "Forgot-password page →", url: `${new URL(request.url).origin}/forgot-password.html` },
        }));
    }
    return json({ ok: true, message: "Password reset — sign in with your new password." });
  }

  // --- set-recovery-email (new address verified before it replaces the old) --
  if (action === "set-recovery-email") {
    const me = await profileByDevice(db, String(a.device_id || ""));
    if (!me) return fail("Sign in first — then you can set a recovery email.");
    const email = String(a.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) return fail("That doesn't look like an email address.");
    if (me.recovery_email_verified === 1 && me.recovery_email === email) {
      return json({ ok: true, message: "That email is already verified for your account." });
    }
    let clash = null;
    try { clash = await db.prepare("SELECT id FROM profiles WHERE recovery_email = ? COLLATE NOCASE AND recovery_email_verified = 1 LIMIT 1").bind(email).first(); } catch { clash = null; }
    if (clash && clash.id !== me.id) return fail("That email is already the verified recovery email for another account.");
    await db.prepare("UPDATE profiles SET pending_email = ? WHERE id = ?").bind(email, me.id).run();
    const token = await issueToken(db, me.id, "email_verify", VERIFY_TOKEN_TTL_MS, "");
    const link = verifyLinkFor(request, token);
    await deliverOutbound(env, db, me.id, "email", "email_verify",
      "Verify your Rare Candy Reserve recovery email",
      `Confirm this email as the recovery address for @${me.username} — it lets you reset your password if you forget it:\n\n${link}\n\nThe link works for 24 hours. If you didn't ask for this, ignore it.`,
      email,
      txEmailHtml({
        title: "Verify your recovery email",
        paragraphs: [
          `Confirm this email as the recovery address for @${me.username} — it lets you reset your password if you forget it.`,
          "The link works for 24 hours. If you didn't ask for this, ignore it.",
        ],
        action: { label: "Verify this email →", url: link },
      }));
    return json({ ok: true, message: "Verification email on its way to that address — click the link in it within 24 hours and it becomes your recovery email." + emailNote });
  }

  // --- verify-email ------------------------------------------------------------
  if (action === "verify-email") {
    const row = await consumeToken(db, "email_verify", a.token);
    if (!row) return fail("That verification link didn't work — it may have expired or already been used. Ask for a fresh one from Edit profile.");
    const profile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(row.profile_id).first();
    if (!profile || !profile.pending_email) return fail("That verification link didn't work — it may have expired or already been used. Ask for a fresh one from Edit profile.");
    await db.prepare(
      "UPDATE profiles SET recovery_email = ?, recovery_email_verified = 1, pending_email = '', email_verified_at = ? WHERE id = ?",
    ).bind(profile.pending_email, now, profile.id).run();
    await invalidateTokens(db, profile.id, ["email_verify"]);
    await createNotification(db, {
      profile_id: profile.id, actor_profile_id: null, kind: "email_verified",
      ref_type: "profile", ref_id: profile.id,
      text: "Your recovery email is verified — you can now reset your password by email if you forget it.",
      link: "#/member/" + profile.id,
    });
    return json({ ok: true, message: "Recovery email verified — password resets can now reach you there." });
  }

  // --- request-recovery (public; operator verifies out-of-band) ----------------
  // AUTOMATED path (2026-11-22): if the member has a VERIFIED recovery
  // email on file AND a mail provider is configured, the one-time code
  // is emailed to THAT address right away — no operator step, no wait.
  // SAFETY — the typed contact is NEVER trusted as the destination:
  // anyone can type any address into this public form, so a code sent
  // to a typed address would let an attacker file recovery for
  // @Victim with contact=attacker@evil.com, get the code, and take the
  // account. Only the address the member verified while signed in is
  // trusted. No verified address (or the send fails) → the request
  // stays "pending" and the operator issues the code by hand, as
  // before — the manual path is the fallback for DM handles and
  // phones. The reply stays generic either way (no leak of which
  // branch ran or which address was used).
  if (action === "request-recovery") {
    const username = String(a.username || "").trim();
    const contact = String(a.contact || "").trim().slice(0, 200);
    const message = String(a.message || "").trim().slice(0, 500);
    if (!username || !contact) return fail("Leave your username and a way for Chris to reach you.");
    const rl = await checkRateLimit(db, "recovery:" + username.toLowerCase(), 5, 60 * 60 * 1000);
    if (!rl.allowed) return json({ ok: true, message: "Thanks — your request is in. Chris will check it and reach you at the contact you left." });
    const profile = await findByLogin(db, username);
    let autoSent = false;
    if (profile) {
      let reqId = null;
      try {
        const r = await db.prepare(
          "INSERT INTO recovery_requests (profile_id, username, contact, message, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
        ).bind(profile.id, profile.username, contact, message, now).run();
        reqId = (r && r.meta && r.meta.last_row_id) || null;
      } catch { /* table not there yet — operator still gets nothing; fail soft */ }
      const verifiedEmail = profile.recovery_email_verified === 1 ? String(profile.recovery_email || "") : "";
      if (reqId && verifiedEmail && mailConfigured(env)) {
        try {
          await invalidateTokens(db, profile.id, ["recovery"]); // latest code wins
          const code = await issueToken(db, profile.id, "recovery", RECOVERY_CODE_TTL_MS, String(reqId));
          const sent = await deliverOutbound(env, db, profile.id, "email", "recovery_code",
            "Your Rare Candy Reserve recovery code",
            `Your one-time recovery code for @${profile.username} is:\n\n${code}\n\nType it into the "Got a recovery code from Chris?" box on the forgot-password page, pick a new password, and you're back in. The code works once, for 24 hours — after that it stops working.\n\nIf that wasn't you, ignore this email — your old password still works until a code is used.`,
            verifiedEmail,
            txEmailHtml({
              title: "Your recovery code",
              paragraphs: [
                `Your one-time recovery code for @${profile.username} is:`,
                code,
                "Type it into the “Got a recovery code from Chris?” box on the forgot-password page, pick a new password, and you're back in. The code works once, for 24 hours — after that it stops working.",
                "If that wasn't you, ignore this email — your old password still works until a code is used.",
              ],
              action: { label: "Use my recovery code →", url: `${new URL(request.url).origin}/forgot-password.html` },
            }));
          if (sent.sent) {
            autoSent = true;
            try {
              await db.prepare("UPDATE recovery_requests SET status = 'issued', auto_sent = 1, resolved_at = ? WHERE id = ?").bind(now, reqId).run();
            } catch { /* auto_sent column not there yet — row still reads 'issued' */ }
          }
        } catch { /* send failed — request stays pending, operator issues by hand */ }
      }
      await createNotification(db, {
        profile_id: 1, actor_profile_id: profile.id, kind: "recovery_request",
        ref_type: "recovery", ref_id: profile.id,
        text: autoSent
          ? `@${profile.username} asked for account recovery — a one-time code was emailed automatically to their verified recovery address.`
          : `@${profile.username} asked for account recovery — check the recovery requests in the Admin panel.`,
        link: "#/admin",
      });
    }
    return json({ ok: true, message: autoSent
      ? "Thanks — a one-time code was emailed to the recovery address on your account. Check that inbox and use it on the forgot-password page."
      : "Thanks — your request is in. Chris will check it and reach you at the contact you left." });
  }

  // --- list-recovery (operator only) -------------------------------------------
  if (action === "list-recovery") {
    const me = await profileByDevice(db, String(a.device_id || ""));
    if (!me || !isOperator(env, me)) return fail("Operator only.");
    let rows = [];
    try {
      const { results } = await db.prepare(
        "SELECT id, profile_id, username, contact, message, status, auto_sent, created_at, resolved_at FROM recovery_requests ORDER BY created_at DESC LIMIT 50",
      ).all();
      rows = results || [];
    } catch {
      // Pre-migration table shape (no auto_sent column yet).
      try {
        const { results } = await db.prepare(
          "SELECT id, profile_id, username, contact, message, status, created_at, resolved_at FROM recovery_requests ORDER BY created_at DESC LIMIT 50",
        ).all();
        rows = results || [];
      } catch { rows = []; /* table not there yet */ }
    }
    return json({ ok: true, requests: rows });
  }

  // --- issue-recovery (operator only; code shown ONCE) -------------------------
  if (action === "issue-recovery") {
    const me = await profileByDevice(db, String(a.device_id || ""));
    if (!me || !isOperator(env, me)) return fail("Operator only.");
    const reqId = Number(a.request_id);
    if (!Number.isInteger(reqId)) return fail("Pick a recovery request first.");
    let reqRow = null;
    try {
      reqRow = await db.prepare("SELECT * FROM recovery_requests WHERE id = ? LIMIT 1").bind(reqId).first();
    } catch { return fail("Recovery requests aren't set up yet — run the password-auth migration first."); }
    if (!reqRow) return fail("That recovery request doesn't exist.");
    // Manual issue is the fallback for requests the site couldn't
    // auto-send (no verified email, or the send failed) — AND for
    // requests the site DID auto-send but the member never got (wrong
    // address on file, spam folder). A request the operator already
    // handled by hand, or one already used, stays closed.
    if (reqRow.status !== "pending" && !(reqRow.status === "issued" && reqRow.auto_sent === 1)) return fail("That request was already handled.");
    const profile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(reqRow.profile_id).first();
    if (!profile) return fail("That account doesn't exist any more.");
    // Latest code wins: any earlier code for this account (including
    // one the site auto-emailed and the member never used) dies here,
    // so only the code shown below can work.
    await invalidateTokens(db, profile.id, ["recovery"]);
    const code = await issueToken(db, profile.id, "recovery", RECOVERY_CODE_TTL_MS, String(reqRow.id));
    await db.prepare("UPDATE recovery_requests SET status = 'issued', resolved_at = ?, resolved_by = ? WHERE id = ?").bind(now, me.id, reqRow.id).run();
    // Bot DM (2026-11-24): message the member privately with the code so
    // they get an alert — the operator no longer has to send it by hand.
    // The DM auto-deletes after 24h (same as the code TTL). The code lives
    // only in the DM body, never in the notification text.
    try {
      const dmNow = nowMs();
      const dmBody = "Hi @" + profile.username + " — here's your one-time recovery code from Rare Candy Reserve:\n\n" + code + "\n\nType it into the \"Got a recovery code from Chris?\" box on the Community sign-in page, pick a new password, and you're back in. It works once, for 24 hours — after that it's dead. If that wasn't you, ignore this and tell Chris.";
      let dmRowId = null;
      try {
        const dm = await db.prepare(
          "INSERT INTO direct_messages (sender_id, recipient_id, body, is_read, created_at, expires_at) VALUES (?, ?, ?, 0, ?, ?)"
        ).bind(me.id, profile.id, dmBody, dmNow, dmNow + 24 * 60 * 60 * 1000).run();
        dmRowId = dm.meta.last_row_id;
      } catch (e) {
        // Older DM table without expires_at — save without it rather
        // than losing the message.
        if (/no such column/i.test(String((e && e.message) || e))) {
          const dm = await db.prepare(
            "INSERT INTO direct_messages (sender_id, recipient_id, body, is_read, created_at) VALUES (?, ?, ?, 0, ?)"
          ).bind(me.id, profile.id, dmBody, dmNow).run();
          dmRowId = dm.meta.last_row_id;
        } else { throw e; }
      }
      await createNotification(db, {
        profile_id: profile.id, actor_profile_id: me.id, kind: "message",
        ref_type: "direct_message", ref_id: dmRowId,
        text: "Your one-time recovery code is in your private messages from @" + me.username + ".",
        link: "#/member/" + me.id,
      });
    } catch (e) { /* best effort — the code is still shown to the operator below */ }
    // The code goes to the OPERATOR only, once, in this response — he
    // sends it to the member privately (DM/text/in person). The site
    // never emails a code the operator issues by hand; the only mail
    // the site sends goes to the member's VERIFIED recovery email
    // (see request-recovery). The code is never stored in plaintext.
    return json({ ok: true, code, username: profile.username, message: "Code issued — the member was also messaged privately with it, so they should see the alert. It works once, for 24 hours, then it's dead." });
  }

  // --- use-recovery (burns the code, sets the password) ------------------------
  if (action === "use-recovery") {
    const strengthError = checkPasswordStrength(a.new_password);
    if (strengthError) return fail(strengthError);
    const row = await consumeToken(db, "recovery", a.code);
    if (!row) return fail("That recovery code didn't work — it may have expired or already been used. Ask Chris for a fresh one.");
    const profile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(row.profile_id).first();
    if (!profile) return fail("That recovery code didn't work — it may have expired or already been used. Ask Chris for a fresh one.");
    const { hash, salt } = await hashPassword(a.new_password);
    await db.prepare(
      "UPDATE profiles SET password_hash = ?, password_salt = ?, password_set_at = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
    ).bind(hash, salt, now, profile.id).run();
    await invalidateTokens(db, profile.id, ["reset", "recovery"]);
    if (row.meta) {
      try {
        await db.prepare("UPDATE recovery_requests SET status = 'used', resolved_at = ? WHERE id = ?").bind(now, Number(row.meta)).run();
      } catch { /* best effort */ }
    }
    await createNotification(db, {
      profile_id: profile.id, actor_profile_id: null, kind: "password_changed",
      ref_type: "profile", ref_id: profile.id,
      text: "Your password was reset with a recovery code. If that wasn't you, tell Chris right away.",
      link: "#/member/" + profile.id,
    });
    return json({ ok: true, device_id: profile.device_id, username: profile.username, message: "You're back in — sign in with your new password from now on." });
  }

  return fail("Unknown auth action.");
}
