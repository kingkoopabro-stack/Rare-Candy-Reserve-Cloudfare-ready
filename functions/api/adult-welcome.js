// GET /api/adult-welcome — getAdultWelcome (age-verified callers only).
// POST /api/adult-welcome — setAdultWelcomeImage. OPERATOR ONLY: the
// welcome picture is the operator's slot — Chris uploads his own welcome
// picture. (The artifact let the original uploader replace it; on the
// website the slot belongs to the operator, who is the only one who should
// set the community's welcome image.) The slot starts EMPTY — no stock photo.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, imageUrl, putImage, nowMs } from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me || me.age_verified !== 1) return json({ image_url: null, can_replace: false });
  const row = await db.prepare("SELECT * FROM adult_welcome WHERE id = 1 LIMIT 1").first();
  return json({
    image_url: imageUrl(row?.image_blob_key ?? null),
    can_replace: isOperator(env, me),
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  if (me.age_verified !== 1) return json({ ok: false, error: "Age-verified members only — the welcome picture lives inside the 18+ gate." });
  if (!isOperator(env, me)) return json({ ok: false, error: "Only the operator sets the welcome picture — it's Chris's slot." });
  const up = await putImage(env, "adult-welcome", String(a.device_id), a.image, 3000000);
  if (!up.ok) return json({ ok: false, error: up.error });
  const row = await db.prepare("SELECT id FROM adult_welcome WHERE id = 1 LIMIT 1").first();
  if (row) {
    await db.prepare("UPDATE adult_welcome SET image_blob_key = ?, set_by_profile_id = ?, updated_at = ? WHERE id = 1")
      .bind(up.key, me.id, nowMs()).run();
  } else {
    await db.prepare("INSERT INTO adult_welcome (id, image_blob_key, set_by_profile_id, updated_at) VALUES (1, ?, ?, ?)")
      .bind(up.key, me.id, nowMs()).run();
  }
  return json({ ok: true, error: null });
}
