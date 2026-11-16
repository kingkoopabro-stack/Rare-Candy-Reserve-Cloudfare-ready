// GET /api/models — listModels (age-verified callers only; search by
// name/keyword and/or one category). Each card carries ONLY what the model
// chose to share.
// POST /api/models — saveModelProfile. Saves the caller's opt-in model
// listing for the 18+ area. Only age-verified members can be listed.
import {
  json, noDb, getDb, readJson, profileByDevice, shapeModelCard,
  ADULT_CATEGORIES, MODEL_EYE_COLORS, MODEL_STYLES, putImage, nowMs,
} from "./_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const deviceId = q.get("device_id") || "";
  const caller = await profileByDevice(db, deviceId);
  if (!caller || caller.age_verified !== 1) return json({ models: [] });
  const query = (q.get("query") || "").trim().toLowerCase();
  const category = q.get("category") || null;
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "30", 10) || 30, 1), 60);
  const { results } = await db.prepare("SELECT * FROM profiles WHERE is_model = 1 ORDER BY id DESC").all();
  const out = [];
  for (const r of (results || [])) {
    if (r.age_verified !== 1) continue;
    const cats = (r.model_categories ?? "").split(",").map((c) => c.trim()).filter(Boolean);
    if (category && !cats.includes(category)) continue;
    if (query && !r.username.toLowerCase().includes(query) && !(r.model_bio ?? "").toLowerCase().includes(query)
      && !cats.some((c) => c.toLowerCase().includes(query))
      && !(r.model_styles ?? "").toLowerCase().includes(query)
      && !(r.model_music ?? "").toLowerCase().includes(query)) continue;
    out.push(shapeModelCard(r));
    if (out.length >= limit) break;
  }
  return json({ models: out });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  if (a.opt_in && me.age_verified !== 1) {
    return json({ ok: false, error: "Only age-verified members can be listed in the model search — verify your age with a photo ID first (Rules & After Dark). That's what makes the model directory a verified one." });
  }
  const cats = [];
  for (const c of (a.model_categories || [])) {
    if (ADULT_CATEGORIES.includes(c) && !cats.includes(c)) cats.push(c);
    if (cats.length >= 6) break;
  }
  const styles = [];
  for (const s of (a.model_styles || [])) {
    if (MODEL_STYLES.includes(s) && !styles.includes(s)) styles.push(s);
    if (styles.length >= 3) break;
  }
  const eyeColor = MODEL_EYE_COLORS.includes(a.model_eye_color) ? a.model_eye_color : "";
  let displayKey = undefined; // undefined = keep
  if (a.remove_display_image) displayKey = null;
  else if (a.display_image) {
    const up = await putImage(env, "model-display", String(a.device_id), a.display_image, 2500000);
    if (!up.ok) return json({ ok: false, error: up.error });
    displayKey = up.key;
  }
  const sets = [
    "is_model = ?", "model_bio = ?", "model_categories = ?", "model_gender = ?",
    "model_eye_color = ?", "model_weight_lbs = ?", "model_styles = ?", "model_music = ?",
    "model_gamer = ?", "model_breast = ?", "model_ink = ?", "updated_at = ?",
  ];
  const vals = [
    a.opt_in ? 1 : 0, String(a.model_bio || "").trim().slice(0, 280), cats.join(","),
    ["", "girl", "guy"].includes(a.model_gender) ? a.model_gender : "",
    eyeColor,
    Number.isInteger(a.model_weight_lbs) && a.model_weight_lbs >= 70 && a.model_weight_lbs <= 700 ? a.model_weight_lbs : null,
    styles.join(","),
    String(a.model_music || "").trim().slice(0, 80),
    ["", "yes", "no"].includes(a.model_gamer) ? a.model_gamer : "",
    ["", "Small", "Medium", "Big"].includes(a.model_breast) ? a.model_breast : "",
    ["", "None", "Tattoos", "Piercings", "Tattoos & piercings"].includes(a.model_ink) ? a.model_ink : "",
    nowMs(),
  ];
  if (displayKey !== undefined) { sets.push("model_display_blob_key = ?"); vals.push(displayKey); }
  vals.push(me.id);
  await db.prepare(`UPDATE profiles SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  return json({ ok: true, error: null });
}
