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
  parsePrefs, cleanCreatorTypes, cleanPrefTags, matchScore, signalBonus, nowMs,
} from "./_lib.js";

function publicFindCard(row, score, matchedTypes, matchedTags, extra) {
  const m = shapeMember(row);
  return {
    ...m,
    match_score: score,
    matched_types: matchedTypes,
    matched_tags: matchedTags,
    matched_signal_types: (extra && extra.signalTypes) || [],
    matched_signal_tags: (extra && extra.signalTags) || [],
    // Creator menu / packages (2026-11-21): the seller's listed
    // packages that match this search (tap one → the creator's menu).
    // [] in the buyer direction — buyers have no storefront.
    packages: (extra && extra.packages) || [],
  };
}

// Parse a package's contents_summary JSON into { tags: [] }.
function packageTags(pkg) {
  try {
    const s = pkg.contents_summary ? JSON.parse(pkg.contents_summary) : null;
    if (s && Array.isArray(s.tags)) return s.tags.map((t) => String(t)).filter(Boolean);
  } catch { /* not JSON — no tags */ }
  return [];
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
  // Discovery signals (2026-11-21): MY OWN click tally — the types /
  // tags I viewed, clicked, hearted, or searched for on this site.
  // Never another member's tally, and nothing when I opted out.
  let mySignals = [];
  if (me.signals_opt_out !== 1) {
    try {
      const { results } = await db.prepare(
        "SELECT type, tag FROM interest_signals WHERE profile_id = ?",
      ).bind(me.id).all();
      mySignals = results || [];
    } catch { mySignals = []; /* table not there yet — prefs only */ }
  }
  // Listed packages + their menu slots, loaded once for every
  // candidate (two queries, not one per member). A package only
  // surfaces when its seller has content sales switched on.
  let packagesBySeller = new Map();
  try {
    const { results: pkgs } = await db.prepare(
      "SELECT * FROM creator_packages WHERE status = 'listed'",
    ).all();
    const { results: items } = await db.prepare("SELECT * FROM creator_menu_items").all();
    const itemByPackage = new Map((items || []).map((it) => [it.package_id, it]));
    for (const p of (pkgs || [])) {
      const item = itemByPackage.get(p.id);
      if (!item) continue; // listed but in no slot — not buyable
      if (!packagesBySeller.has(p.profile_id)) packagesBySeller.set(p.profile_id, []);
      packagesBySeller.get(p.profile_id).push({ pkg: p, item });
    }
  } catch { packagesBySeller = new Map(); /* tables not there yet — no packages */ }
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
        // Packages: the seller's listed packages are matchable units
        // (genre/kind/tags), scored on top of the profile match. Typed
        // matches against package fields the profile doesn't already
        // carry count at full typed weight; signal matches count at
        // the lower signal weight (see signalBonus). The best package
        // drives the bonus; every matching package rides on the card.
        let pkgBonus = 0;
        let pkgSignalTypes = [];
        let pkgSignalTags = [];
        let packageRows = [];
        if (r.content_sales_enabled === 1) {
          const mine = packagesBySeller.get(r.id) || [];
          const profileTypesLow = new Set(sellerTypes.map((t) => t.toLowerCase()));
          const profileTagsLow = new Set(sellerTags.map((t) => t.toLowerCase()));
          for (const { pkg, item } of mine) {
            const pkgTypes = [pkg.genre, pkg.kind].filter(Boolean);
            const pkgTags = packageTags(pkg);
            const pkgTypesLow = pkgTypes.map((t) => t.toLowerCase());
            const pkgTagsLow = pkgTags.map((t) => t.toLowerCase());
            const typedTypeHit = myTypes.some((t) => pkgTypesLow.includes(t.toLowerCase()) && !profileTypesLow.has(t.toLowerCase()));
            const typedTagHit = myTags.some((t) => pkgTagsLow.includes(t.toLowerCase()) && !profileTagsLow.has(t.toLowerCase()));
            const sig = signalBonus(pkgTypes, pkgTags, mySignals);
            const anyTyped = myTypes.some((t) => pkgTypesLow.includes(t.toLowerCase())) || myTags.some((t) => pkgTagsLow.includes(t.toLowerCase()));
            if (!anyTyped && sig.bonus <= 0) continue;
            let bonus = sig.bonus;
            if (typedTypeHit) bonus += 2;
            if (typedTagHit) bonus += 1;
            pkgBonus = Math.max(pkgBonus, Math.min(4, bonus));
            pkgSignalTypes = [...new Set([...pkgSignalTypes, ...sig.types])];
            pkgSignalTags = [...new Set([...pkgSignalTags, ...sig.tags])];
            let contents = null;
            try { contents = pkg.contents_summary ? JSON.parse(pkg.contents_summary) : null; } catch { contents = null; }
            packageRows.push({
              package_id: pkg.id, title: pkg.title ?? "",
              price_cents: item.price_cents ?? 0, contents_summary: contents,
              menu_item_id: item.id,
            });
          }
        }
        // Signals against the profile fields themselves also lift the
        // score (lower weight than typed prefs, same as packages).
        const profileSig = signalBonus(sellerTypes, sellerTags, mySignals);
        const total = score + pkgBonus + profileSig.bonus;
        out.push(publicFindCard(r, total, matchedTypes, matchedTags, {
          signalTypes: [...new Set([...profileSig.types, ...pkgSignalTypes])],
          signalTags: [...new Set([...profileSig.tags, ...pkgSignalTags])],
          packages: packageRows,
        }));
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
        // My own signals lift the match too — the seller side never
        // sees the buyer's click history, only that they matched and
        // on which types/tags (which this card already shows).
        const sig = signalBonus(buyerTypes, buyerTags, mySignals);
        out.push(publicFindCard(r, score + sig.bonus, matchedTypes, matchedTags, {
          signalTypes: sig.types, signalTags: sig.tags, packages: [],
        }));
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
