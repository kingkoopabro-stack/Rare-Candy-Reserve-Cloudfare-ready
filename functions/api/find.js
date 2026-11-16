// Find a Seller / Find a Buyer (v3, Creator/Seller area).
// GET /api/find?device_id=&role=seller — sellers whose "What I sell"
//   matches MY buyer wants, best-first (display pic + public info only).
// GET /api/find?device_id=&role=buyer — buyers whose wants match MY
//   "What I sell", best-first.
// POST /api/find — save my seller/buyer prefs { device_id,
//   seller: { types, tags, open_to, price_min_cents, price_max_cents },
//   buyer: { types, tags, budget_max_cents } }.
// 18+ only: the caller must be age-verified, and only age-verified
// members are ever listed. No payout handle, full name, or device id
// is ever returned — the same public shape as a member card.
import {
  json, noDb, getDb, readJson, profileByDevice, shapeMember,
  parsePrefs, cleanCreatorTypes, cleanPrefTags, matchScore, nowMs,
} from "./_lib.js";

function publicFindCard(row, score, matchedTypes, matchedTags) {
  const m = shapeMember(row);
  return {
    ...m,
    match_score: score,
    matched_types: matchedTypes,
    matched_tags: matchedTags,
  };
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const role = q.get("role") === "buyer" ? "buyer" : "seller";
  const deviceId = q.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me) return json({ ok: false, error: "Create your account first.", results: [] });
  if (me.age_verified !== 1) return json({ results: [] });
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "30", 10) || 30, 1), 60);
  try {
    const { results } = await db.prepare("SELECT * FROM profiles WHERE id != ? ORDER BY id DESC LIMIT 200").bind(me.id).all();
    const out = [];
    for (const r of (results || [])) {
      if (r.age_verified !== 1) continue;
      if (role === "seller") {
        // I'm a buyer: match their "What I sell" against my wants.
        const sellerTypes = parsePrefs(r.seller_types);
        const sellerTags = parsePrefs(r.seller_tags);
        if (!sellerTypes.length && !sellerTags.length) continue;
        const myTypes = parsePrefs(me.buyer_types);
        const myTags = parsePrefs(me.buyer_tags);
        const score = matchScore(
          sellerTypes, sellerTags, myTypes, myTags,
          r.seller_price_max_cents ?? 0, me.buyer_budget_max_cents ?? 0,
        );
        if (score <= 0) continue;
        const matchedTypes = myTypes.filter((t) => sellerTypes.map((x) => x.toLowerCase()).includes(t.toLowerCase()));
        const matchedTags = myTags.filter((t) => sellerTags.map((x) => x.toLowerCase()).includes(t.toLowerCase()));
        out.push(publicFindCard(r, score, matchedTypes, matchedTags));
      } else {
        // I'm a seller: match their wants against my "What I sell".
        const buyerTypes = parsePrefs(r.buyer_types);
        const buyerTags = parsePrefs(r.buyer_tags);
        if (!buyerTypes.length && !buyerTags.length) continue;
        const myTypes = parsePrefs(me.seller_types);
        const myTags = parsePrefs(me.seller_tags);
        // Price fit: their budget covers the lowest price I'd take.
        const score = matchScore(
          buyerTypes, buyerTags, myTypes, myTags,
          me.seller_price_min_cents ?? 0, r.buyer_budget_max_cents ?? 0,
        );
        if (score <= 0) continue;
        const matchedTypes = myTypes.filter((t) => buyerTypes.map((x) => x.toLowerCase()).includes(t.toLowerCase()));
        const matchedTags = myTags.filter((t) => buyerTags.map((x) => x.toLowerCase()).includes(t.toLowerCase()));
        out.push(publicFindCard(r, score, matchedTypes, matchedTags));
      }
    }
    out.sort((a, b) => b.match_score - a.match_score || b.id - a.id);
    return json({ results: out.slice(0, limit) });
  } catch (e) {
    if (/no such column|no column named/i.test(String((e && e.message) || e))) {
      return json({ ok: false, error: "Find isn't set up yet — the shop is still running a quick database update.", results: [] });
    }
    throw e;
  }
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  if (me.age_verified !== 1) {
    return json({ ok: false, error: "Find a Seller / Buyer is 18+ — verify your age with a photo ID first (Rules & After Dark)." });
  }
  const seller = a.seller || {};
  const buyer = a.buyer || {};
  const str = (v, max) => String(v ?? "").trim().slice(0, max);
  const sTypes = cleanCreatorTypes(seller.types);
  const sTags = cleanPrefTags(seller.tags);
  const bTypes = cleanCreatorTypes(buyer.types);
  const bTags = cleanPrefTags(buyer.tags);
  const sLo = Number.isInteger(seller.price_min_cents) ? Math.max(0, Math.min(seller.price_min_cents, 10000000)) : 0;
  const sHi = Number.isInteger(seller.price_max_cents) ? Math.max(0, Math.min(seller.price_max_cents, 10000000)) : 0;
  const bBudget = Number.isInteger(buyer.budget_max_cents) ? Math.max(0, Math.min(buyer.budget_max_cents, 10000000)) : 0;
  const now = nowMs();
  try {
    await db.prepare(
      `UPDATE profiles SET seller_types = ?, seller_tags = ?, seller_open_to = ?, seller_price_min_cents = ?, seller_price_max_cents = ?, buyer_types = ?, buyer_tags = ?, buyer_budget_max_cents = ?, updated_at = ? WHERE id = ?`,
    ).bind(
      sTypes.join(","), sTags.join(","), str(seller.open_to, 140), sLo, sHi >= sLo ? sHi : sLo,
      bTypes.join(","), bTags.join(","), bBudget, now, me.id,
    ).run();
  } catch (e) {
    if (/no such column|no column named/i.test(String((e && e.message) || e))) {
      return json({ ok: false, error: "Find isn't set up yet — the shop is still running a quick database update." });
    }
    throw e;
  }
  const row = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(me.id).first();
  return json({ ok: true, error: null, profile: shapeMember(row) });
}
