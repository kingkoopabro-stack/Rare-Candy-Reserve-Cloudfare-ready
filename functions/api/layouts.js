// Member-published layouts (v3.12) — the Layout Store's community shelf.
// A member publishes their OWN hand-written CSS from the My Code box as
// a free layout, with their name on it. Other members grab it with its
// code (U<id>) and apply it like any store preset. Priced layouts stay
// the shop's only — user layouts are free, always.
// GET /api/layouts — { ok, layouts: [{ id, name, description, css,
//   theme_json, author_id, author_name, created_at }] }
// POST /api/layouts { device_id, action: "publish", name, description,
//   css, theme_json } — { ok, id, code }
// POST /api/layouts { device_id, action: "unpublish", id } — { ok }
// CSS is sanitized server-side with the same sanitizer as the profile
// (no @import, no external url(), no javascript:, no position:fixed).
// Fails soft until the user_layouts migration has run: GET returns an
// empty shelf, POST says the store isn't switched on yet.
import { json, noDb, getDb, readJson, profileByDevice, sanitizeLayoutCss, nowMs } from "./_lib.js";

const MAX_NAME = 40;
const MAX_DESC = 120;
const MAX_CSS = 8000;
const MAX_PER_MEMBER = 10;

export async function onRequestGet({ env }) {
  const db = getDb(env);
  if (!db) return noDb();
  let rows = [];
  try {
    const res = await db.prepare(
      "SELECT l.id, l.name, l.description, l.css, l.theme_json, l.author_id, l.created_at, p.username AS author_name " +
      "FROM user_layouts l LEFT JOIN profiles p ON p.id = l.author_id " +
      "WHERE l.is_live = 1 ORDER BY l.created_at DESC LIMIT 100",
    ).all();
    rows = res.results || [];
  } catch { return json({ ok: true, layouts: [] }); /* table not there yet — run the migration */ }
  return json({
    ok: true,
    layouts: rows.map((r) => ({
      id: r.id,
      name: String(r.name || ""),
      description: String(r.description || ""),
      css: String(r.css || ""),
      theme_json: String(r.theme_json || ""),
      author_id: r.author_id,
      author_name: String(r.author_name || "member"),
      created_at: r.created_at,
    })),
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!me) return json({ ok: false, error: "Sign in to publish a layout." });
  const action = String(a.action || "");
  if (action === "publish") {
    const name = String(a.name || "").trim().slice(0, MAX_NAME);
    if (!name) return json({ ok: false, error: "Give your layout a name first." });
    const description = String(a.description || "").trim().slice(0, MAX_DESC);
    const css = sanitizeLayoutCss(String(a.css || "").slice(0, MAX_CSS));
    if (!css.trim()) return json({ ok: false, error: "Your layout has no usable CSS — write some in the My Code box first." });
    let themeJson = "";
    try {
      const t = JSON.parse(String(a.theme_json || "{}"));
      themeJson = JSON.stringify(t && typeof t === "object" ? t : {});
    } catch { themeJson = ""; }
    try {
      const count = await db.prepare("SELECT COUNT(*) AS n FROM user_layouts WHERE author_id = ? AND is_live = 1").bind(me.id).first();
      if (count && Number(count.n) >= MAX_PER_MEMBER) {
        return json({ ok: false, error: "You've got 10 layouts live already — take one down before publishing another." });
      }
      const res = await db.prepare(
        "INSERT INTO user_layouts (author_id, name, description, css, theme_json, is_live, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
      ).bind(me.id, name, description, css, themeJson, nowMs(), nowMs()).run();
      const id = res && res.meta ? res.meta.last_row_id : null;
      return json({ ok: true, id, code: id ? "U" + id : "" });
    } catch {
      return json({ ok: false, error: "The Layout Store isn't switched on yet — run the MySpace update first." });
    }
  }
  if (action === "unpublish") {
    const id = Number(a.id);
    if (!id) return json({ ok: false, error: "Which layout? Try again." });
    try {
      const row = await db.prepare("SELECT author_id FROM user_layouts WHERE id = ? LIMIT 1").bind(id).first();
      if (!row) return json({ ok: false, error: "That layout isn't in the store anymore." });
      if (Number(row.author_id) !== Number(me.id)) return json({ ok: false, error: "Only the member who published it can take it down." });
      await db.prepare("UPDATE user_layouts SET is_live = 0, updated_at = ? WHERE id = ?").bind(nowMs(), id).run();
    } catch {
      return json({ ok: false, error: "The Layout Store isn't switched on yet — run the MySpace update first." });
    }
    return json({ ok: true });
  }
  return json({ ok: false, error: "Unknown action." });
}
