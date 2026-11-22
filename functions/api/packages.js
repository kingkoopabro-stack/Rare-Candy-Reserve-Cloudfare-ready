// Creator packages — GET /api/packages?mine=1 (my staged + listed
// packages, the private staging spot) and POST /api/packages
// (assemble a new package: { device_id, title ≤60, genre, kind
// 'existing'|'custom' }).
//
// Staging is seller + operator ONLY — buyers never see it, and
// admins/mods can NOT see it (same line as Private pictures). An
// operator may pass ?profile_id= to review one creator's staging.
// A package is a bundle of files sold as one item at one price; the
// zip itself arrives through the upload-start / upload-part /
// upload-complete endpoints. New packages start 'staged' — nothing
// is for sale until the seller publishes it into a menu slot.
import { json, noDb, getDb, readJson, profileByDevice, nowMs, iso, isOperator, CREATOR_GENRES } from "./_lib.js";
import { CREATOR_NOT_SETUP_MSG, creatorSalesGate } from "./_creator.js";

function shapePackage(row) {
  let contents = null;
  try { contents = row.contents_summary ? JSON.parse(row.contents_summary) : null; } catch { contents = null; }
  return {
    id: row.id, profile_id: row.profile_id, title: row.title ?? "",
    genre: row.genre ?? "", kind: row.kind ?? "existing",
    status: row.status ?? "staged",
    zip_ready: !!row.zip_key,
    size_bytes: row.size_bytes ?? 0, file_count: row.file_count ?? 0,
    contents_summary: contents,
    created_at: iso(row.created_at), updated_at: iso(row.updated_at),
  };
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first.", packages: [] });
  const operator = isOperator(env, me);
  let ownerId = me.id;
  if (q.get("profile_id") != null) {
    if (!operator) return json({ ok: false, error: "Staging is private — only the seller and the operator see it.", packages: [] });
    ownerId = Number(q.get("profile_id"));
    if (!ownerId) return json({ ok: false, error: "Pick a member.", packages: [] });
  }
  try {
    const { results } = await db.prepare(
      "SELECT * FROM creator_packages WHERE profile_id = ? ORDER BY updated_at DESC LIMIT 100",
    ).bind(ownerId).all();
    return json({ ok: true, packages: (results || []).map(shapePackage) });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG, packages: [] });
    throw e;
  }
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, package: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your account first.");
  const gate = creatorSalesGate(me);
  if (gate) return fail(gate);
  const title = String(a.title || "").trim().replace(/\s+/g, " ");
  if (title.length < 1 || title.length > 60) return fail("Give the package a name (1–60 characters).");
  const genre = String(a.genre || "").trim();
  if (!CREATOR_GENRES.includes(genre)) return fail("Pick a genre for the package.");
  // kind: 'existing' = already-assembled content, sold instantly;
  // 'custom' = work not yet made, sold through the Request flow.
  const kind = String(a.kind || "existing").trim();
  if (kind !== "existing" && kind !== "custom") return fail("Pick whether this package is already made or custom work.");
  const now = nowMs();
  let r;
  try {
    r = await db.prepare(
      "INSERT INTO creator_packages (profile_id, title, genre, kind, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'staged', ?, ?)",
    ).bind(me.id, title, genre, kind, now, now).run();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail(CREATOR_NOT_SETUP_MSG);
    throw e;
  }
  const row = await db.prepare("SELECT * FROM creator_packages WHERE id = ? LIMIT 1").bind(r.meta.last_row_id).first();
  return json({ ok: true, error: null, package: shapePackage(row) });
}
