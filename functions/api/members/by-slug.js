// GET /api/members/by-slug?slug= — resolve a vanity page URL slug to a
// member id for the #/u/<slug> route. Returns { member_id } or
// { member_id: null } when no member has that slug.
import { json, noDb, getDb, SLUG_RE } from "../_lib.js";

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const slug = String(new URL(request.url).searchParams.get("slug") || "").trim();
  if (!SLUG_RE.test(slug)) return json({ member_id: null });
  let row = null;
  try {
    row = await db.prepare("SELECT id FROM profiles WHERE lower(page_slug) = lower(?) LIMIT 1").bind(slug).first();
  } catch { row = null; }
  return json({ member_id: row ? row.id : null });
}
