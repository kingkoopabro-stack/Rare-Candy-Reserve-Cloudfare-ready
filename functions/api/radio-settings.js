// Radio player text settings — GET /api/radio-settings (public: all
// settings rows) and POST /api/radio-settings (operator or admin only:
// upsert key/value pairs).
// Keys: station_tagline, dj_greeting, dj_message, ticker, onair_label,
// stream_url (the live-video stream link the music page plays).
// The table holds edits only: radio.html and music.html keep their
// hardcoded / live-video.json values as the fallback, so an empty or
// missing table changes nothing — GET answers { settings: {} } instead
// of crashing when the migration hasn't run yet.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, roleOf, nowMs } from "./_lib.js";

const ALLOWED_KEYS = ["station_tagline", "dj_greeting", "dj_message", "ticker", "onair_label", "stream_url"];

function isRadioAdmin(env, me) {
  if (!me) return false;
  if (isOperator(env, me)) return true;
  return roleOf(me) === "admin";
}

function cleanSettings(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const k of Object.keys(input)) {
    if (ALLOWED_KEYS.indexOf(k) === -1) continue;
    const v = String(input[k] == null ? "" : input[k]);
    if (v.length > 500) continue;
    out[k] = v;
  }
  return out;
}

export async function onRequestGet({ env }) {
  const db = getDb(env);
  if (!db) return noDb();
  let rows;
  try {
    const q = await db.prepare("SELECT key, value FROM radio_settings").all();
    rows = q.results || [];
  } catch (e) {
    // Table not created yet (migration not run) — the radio page and the
    // music page fall back to their hardcoded values; never crash them.
    return json({ ok: true, settings: {}, setup: false, note: "Radio settings aren't set up yet." });
  }
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  return json({ ok: true, settings, setup: true });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!isRadioAdmin(env, me)) return json({ ok: false, error: "Operator or admin only." });
  // Accept { settings: { key: value } } or flat top-level keys.
  const incoming = (a.settings && typeof a.settings === "object") ? a.settings : a;
  const settings = cleanSettings(incoming);
  const keys = Object.keys(settings);
  if (!keys.length) return json({ ok: false, error: "No valid settings to save." });
  const now = nowMs();
  for (const k of keys) {
    await db.prepare(
      "INSERT INTO radio_settings (key, value, updated_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
    ).bind(k, settings[k], now).run();
  }
  const q = await db.prepare("SELECT key, value FROM radio_settings").all();
  const all = {};
  for (const r of (q.results || [])) all[r.key] = r.value;
  return json({ ok: true, settings: all });
}
