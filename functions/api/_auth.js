// Password auth helpers — Workers-native only (WebCrypto PBKDF2, no deps).
// Imported by functions/api/auth.js and functions/api/profile.js.
// Passwords are NEVER stored or logged in plaintext: only a PBKDF2-SHA256
// hash + a per-user random salt live in D1. Reset / verify / recovery
// tokens are stored as SHA-256 hashes too — the raw token only ever
// travels inside the email (or, for recovery codes, straight to the
// operator, once). The operator can never see a member's password.

import { nowMs } from "./_lib.js";

export const PASSWORD_MIN_LENGTH = 8;
export const PBKDF2_ITERATIONS = 210000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, single-use
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const RECOVERY_CODE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const LOCKOUT_AFTER_FAILURES = 5;
export const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// --- base64 helpers (no Buffer in Workers) --------------------------------
function bytesToB64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToB64Url(bytes) {
  return bytesToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// --- tokens -----------------------------------------------------------------
// Random token for links/codes. Returned raw (goes in the email / to the
// operator); only its SHA-256 hash is ever stored — see issueToken.
export function randomToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return bytesToB64Url(buf);
}

// Recovery code the operator reads out privately: short, typeable,
// unambiguous characters only (no 0/O, 1/I/l). Normalized on use.
export function randomRecoveryCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[buf[i] % chars.length];
  return "RCR-" + out.slice(0, 4) + "-" + out.slice(4, 8) + "-" + out.slice(8, 12);
}
export function normalizeRecoveryCode(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time-ish string compare (avoids early-exit timing leaks).
export function safeEqual(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

// --- passwords --------------------------------------------------------------
export function checkPasswordStrength(password) {
  const pw = String(password || "");
  if (pw.length < PASSWORD_MIN_LENGTH) return `Password needs at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(pw)) return "Password needs at least one letter.";
  if (!/[0-9]/.test(pw)) return "Password needs at least one number.";
  if (pw.length > 128) return "Password is too long — keep it under 128 characters.";
  return null;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || "").trim());
}

// PBKDF2-SHA256, per-user 16-byte salt, 210k iterations, 32-byte key.
// Returns { hash, salt } — both base64, safe to store in D1 TEXT.
export async function hashPassword(password) {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key, 256,
  );
  return { hash: bytesToB64(new Uint8Array(bits)), salt: bytesToB64(saltBytes) };
}

// Verify against a stored { hash, salt }. A missing/blank stored hash
// never verifies. The dummy-hash path in auth.js keeps timing flat for
// accounts that don't exist or never set a password.
export async function verifyPassword(password, storedHash, storedSalt) {
  if (!storedHash || !storedSalt) return false;
  let saltBytes;
  try { saltBytes = b64ToBytes(storedSalt); } catch { return false; }
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key, 256,
  );
  return safeEqual(bytesToB64(new Uint8Array(bits)), storedHash);
}

// --- schema guard -----------------------------------------------------------
// True when the password-auth migration has run (password columns exist).
// Every auth endpoint degrades to a clean "password_auth_pending" error
// before it, so the site never breaks on a half-migrated database.
export async function hasAuthColumns(db) {
  try {
    await db.prepare("SELECT password_hash FROM profiles LIMIT 1").first();
    return true;
  } catch { return false; }
}

// --- one-time tokens --------------------------------------------------------
// Issue a token of `kind` ("reset" | "email_verify" | "recovery") for a
// profile. Returns the RAW token (email / operator only); the row stores
// only its SHA-256 hash. `meta` is a short string (e.g. a recovery
// request id) — never a password or a device id.
export async function issueToken(db, profileId, kind, ttlMs, meta) {
  const raw = kind === "recovery" ? randomRecoveryCode() : randomToken(32);
  const tokenHash = await sha256Hex(kind === "recovery" ? normalizeRecoveryCode(raw) : raw);
  const now = nowMs();
  await db.prepare(
    "INSERT INTO auth_tokens (profile_id, kind, token_hash, meta, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
  ).bind(profileId, kind, tokenHash, meta || "", now, now + ttlMs).run();
  return raw;
}

// Look a presented token up by hash, check expiry + single use, and burn
// it. Returns the token row, or null. The raw token is never stored.
export async function consumeToken(db, kind, rawToken) {
  const presented = kind === "recovery" ? normalizeRecoveryCode(rawToken) : String(rawToken || "").trim();
  if (!presented) return null;
  const tokenHash = await sha256Hex(presented);
  let row = null;
  try {
    row = await db.prepare("SELECT * FROM auth_tokens WHERE kind = ? AND token_hash = ? LIMIT 1").bind(kind, tokenHash).first();
  } catch { return null; /* auth_tokens table not there yet */ }
  if (!row) return null;
  const now = nowMs();
  if (row.used_at) return null;
  if (row.expires_at && now > row.expires_at) return null;
  try {
    await db.prepare("UPDATE auth_tokens SET used_at = ? WHERE id = ?").bind(now, row.id).run();
  } catch { return null; }
  return row;
}

// Burn every unused token of the given kinds for a profile — used after a
// password is set/changed so old reset links die immediately.
export async function invalidateTokens(db, profileId, kinds) {
  if (!profileId || !kinds || !kinds.length) return;
  const placeholders = kinds.map(() => "?").join(",");
  try {
    await db.prepare(
      `UPDATE auth_tokens SET used_at = ? WHERE profile_id = ? AND kind IN (${placeholders}) AND used_at IS NULL`,
    ).bind(nowMs(), profileId, ...kinds).run();
  } catch { /* table not there yet — nothing to burn */ }
}

// --- rate limiting ----------------------------------------------------------
// Fixed-window counter in auth_rate_limits. Fails OPEN (allows) when the
// table isn't there yet — the per-account lockout below still applies,
// and auth endpoints refuse entirely pre-migration.
export async function checkRateLimit(db, key, max, windowMs) {
  const now = nowMs();
  try {
    const row = await db.prepare("SELECT * FROM auth_rate_limits WHERE key = ? LIMIT 1").bind(key).first();
    if (!row || now - row.window_start >= windowMs) {
      await db.prepare(
        "INSERT INTO auth_rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1",
      ).bind(key, now).run();
      return { allowed: true, retryAfterMs: 0 };
    }
    if (row.count >= max) return { allowed: false, retryAfterMs: row.window_start + windowMs - now };
    await db.prepare("UPDATE auth_rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
    return { allowed: true, retryAfterMs: 0 };
  } catch { return { allowed: true, retryAfterMs: 0 }; }
}
