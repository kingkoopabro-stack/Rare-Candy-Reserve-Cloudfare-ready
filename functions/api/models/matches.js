// POST /api/models/matches — findMatches ("Find My Girl or Guy", 18+ area,
// age-verified callers only). Models are scored against ONLY the optional
// details each model chose to share; best matches first.
import { json, noDb, getDb, readJson, profileByDevice, shapeModelCard, ageFromBirthday } from "../_lib.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const caller = await profileByDevice(db, String(a.device_id || ""));
  if (!caller || caller.age_verified !== 1) return json({ criteria_total: 0, models: [] });
  const gender = ["any", "girl", "guy"].includes(a.gender) ? a.gender : "any";
  const ageMin = Number.isInteger(a.age_min) && a.age_min >= 18 && a.age_min <= 99 ? a.age_min : null;
  const ageMax = Number.isInteger(a.age_max) && a.age_max >= 18 && a.age_max <= 99 ? a.age_max : null;
  const eyeColor = String(a.eye_color || "").trim();
  const weight = ["any", "under120", "120-150", "150-180", "over180"].includes(a.weight) ? a.weight : "any";
  const style = String(a.style || "").trim();
  const musicNeedle = String(a.music || "").trim().toLowerCase();
  const gamer = a.gamer === "yes" ? "yes" : "any";
  const breast = ["any", "Small", "Big"].includes(a.breast) ? a.breast : "any";
  const ink = ["any", "has", "none"].includes(a.ink) ? a.ink : "any";

  let total = 0;
  if (gender !== "any") total++;
  if (ageMin != null || ageMax != null) total++;
  if (eyeColor) total++;
  if (weight !== "any") total++;
  if (style) total++;
  if (musicNeedle) total++;
  if (gamer === "yes") total++;
  if (breast !== "any") total++;
  if (ink !== "any") total++;

  const { results } = await db.prepare(
    "SELECT * FROM profiles WHERE is_model = 1 AND age_verified = 1 ORDER BY id DESC LIMIT 200",
  ).all();
  const scored = [];
  for (const r of (results || [])) {
    let score = 0;
    if (gender !== "any" && (r.model_gender ?? "") === gender) score++;
    if (ageMin != null || ageMax != null) {
      const age = ageFromBirthday(r.birthday ?? null);
      if (age != null && (ageMin == null || age >= ageMin) && (ageMax == null || age <= ageMax)) score++;
    }
    if (eyeColor && (r.model_eye_color ?? "") === eyeColor) score++;
    if (weight !== "any" && r.model_weight_lbs != null) {
      const w = r.model_weight_lbs;
      const ok = weight === "under120" ? w < 120
        : weight === "120-150" ? w >= 120 && w <= 150
        : weight === "150-180" ? w > 150 && w <= 180
        : w > 180;
      if (ok) score++;
    }
    if (style && (r.model_styles ?? "").split(",").map((s) => s.trim()).includes(style)) score++;
    if (musicNeedle && (r.model_music ?? "").toLowerCase().includes(musicNeedle)) score++;
    if (gamer === "yes" && (r.model_gamer ?? "") === "yes") score++;
    if (breast !== "any" && (r.model_breast ?? "") === breast) score++;
    if (ink === "has" && ["Tattoos", "Piercings", "Tattoos & piercings"].includes(r.model_ink ?? "")) score++;
    if (ink === "none" && (r.model_ink ?? "") === "None") score++;
    if (total === 0 || score > 0) scored.push({ card: shapeModelCard(r), score });
  }
  scored.sort((x, y) => y.score - x.score || y.card.id - x.card.id);
  return json({
    criteria_total: total,
    models: scored.slice(0, 30).map((s) => ({ ...s.card, match_count: s.score })),
  });
}
