// POST /api/age-verification/submit — OPERATOR REVIEW (not AI auto-check).
// The member uploads a photo of a government-issued photo ID. The Function
// stores the image in the separate ID_VAULT R2 bucket (it survives only
// until review) and queues one row in age_verification_requests with
// status 'pending'. The operator reviews it and approves/rejects from the
// Reports/owner inbox. On decision the R2 object is deleted immediately
// and the row's blob_key is cleared — the ID image is NEVER written to the
// D1 database, and no name, birthdate, or ID number from it is ever stored.
//
// STORAGE GAP: if the ID_VAULT bucket is not bound yet, this endpoint
// returns a clean error and does NOT accept the ID — an ID must never be
// accepted into a place it cannot be reviewed from and deleted from.
import { json, noDb, getDb, readJson, profileByDevice, decodeImage, nowMs } from "../_lib.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first.", age_verified: false, pending: false });
  if (me.age_verified === 1) return json({ ok: true, error: null, age_verified: true, pending: false });
  const pending = await db.prepare(
    "SELECT id FROM age_verification_requests WHERE profile_id = ? AND status = 'pending' LIMIT 1",
  ).bind(me.id).first();
  if (pending) return json({ ok: true, error: null, age_verified: false, pending: true, message: "Your ID is already waiting for review — Chris reviews every ID himself. You'll see your age-verified mark here once it's approved." });
  if (!env.ID_VAULT) {
    return json({ ok: false, error: "Age verification isn't set up yet — the operator is still setting up private ID review. Check back soon; nothing was uploaded.", age_verified: false, pending: false });
  }
  const img = a.id_image || {};
  if (img.mimeType !== "image/jpeg" && img.mimeType !== "image/png") {
    return json({ ok: false, error: "Use a JPG or PNG photo of your ID.", age_verified: false, pending: false });
  }
  const dec = decodeImage(img, 2500000);
  if (!dec.ok) return json({ ok: false, error: dec.error, age_verified: false, pending: false });
  const key = `id-review/${me.id}-${Date.now()}`;
  await env.ID_VAULT.put(key, dec.bytes, { httpMetadata: { contentType: dec.mime } });
  await db.prepare(
    "INSERT INTO age_verification_requests (profile_id, blob_key, status, created_at) VALUES (?, ?, 'pending', ?)",
  ).bind(me.id, key, nowMs()).run();
  return json({ ok: true, error: null, age_verified: false, pending: true, message: "Received — Chris reviews every ID himself. Your ID is held privately for that review only and is permanently deleted the moment he decides. You'll see your age-verified mark here once it's approved." });
}
