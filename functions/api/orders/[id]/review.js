// POST /api/orders/:id/review — the buyer rates the seller after the
// order is done (delivered + "I got it" tapped). Stars 1–5 + short
// text, one review per order per buyer.
// PUBLIC: the review WORDS and the rating both show publicly on the
// seller's profile/shop page.
// CONTENT RULE (Chris's line): block HATE SPEECH only — hateful words
// targeting race, sex, ethnicity, and that kind of thing. Cursing and
// ordinary profanity are FINE and stay allowed.
// HARD RULE (Chris, 2026-11-21 ~21:35 EST): if a review contains hate
// speech of ANY kind, it does NOT submit at all. No posting, no
// masking the words, no editing around it, no saving a censored
// version — the submission is refused entirely, here, before the
// INSERT, server-side only. The buyer gets a plain message telling
// them to reword it. The blocklist lives here, server-side, narrow on
// purpose; it is NOT printed in any report or UI.
import { json, noDb, getDb, readJson, profileByDevice, nowMs, iso } from "../../_lib.js";

// Narrow blocklist — hate speech only: slurs targeting race,
// ethnicity, sex / sexual orientation / gender identity. Ordinary
// swearing is deliberately absent.
// (The words themselves stay in this file only — never in a report,
// never in the UI, never in a client bundle.)
const BLOCKED = [
  "nigger", "nigga", "niggers", "niggas",
  "kike", "kikes", "spic", "spics", "chink", "chinks",
  "faggot", "faggots", "dyke", "tranny",
];

function containsBlocked(text) {
  const lower = " " + String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ") + " ";
  for (const w of BLOCKED) {
    if (lower.includes(" " + w + " ")) return true;
  }
  return false;
}

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  const id = Number(params.id);
  const o = await db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1").bind(id).first();
  if (!o) return json({ ok: false, error: "That order is gone." });
  if (o.buyer_id !== me.id) return json({ ok: false, error: "Only the buyer rates the seller on an order." });
  if (o.status !== "delivered" || !o.buyer_confirmed_at) {
    return json({ ok: false, error: "Rate the seller once the order is delivered and you've tapped \"I got it\"." });
  }
  const stars = Math.round(Number(a.stars) || 0);
  if (stars < 1 || stars > 5) return json({ ok: false, error: "Pick 1 to 5 stars." });
  const body = String(a.body || "").trim().slice(0, 500);
  if (containsBlocked(body)) {
    return json({ ok: false, error: "That review uses words we don't allow here — reword it without the hateful language and send it again. Nothing was saved." });
  }
  const now = nowMs();
  try {
    const r = await db.prepare(
      "INSERT INTO seller_reviews (order_id, listing_id, buyer_id, seller_id, stars, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, o.listing_id, me.id, o.seller_id, stars, body, now).run();
    return json({ ok: true, error: null, review_id: r.meta.last_row_id });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: "Reviews aren't switched on yet — the shop is still running a quick database update. Try again in a bit." });
    if (/UNIQUE constraint failed/i.test(String((e && e.message) || e))) return json({ ok: false, error: "You already rated this order — one review per order." });
    throw e;
  }
}
