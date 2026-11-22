// GET /api/price-suggest?name=&set=&number=&graded=&grade= — suggest
// a listing price for a collectible, from a REAL free source.
// Source: TCGdex (tcgdex.dev) — free, no API key, keyless. The card
// response carries TCGplayer USD market prices (raw / near-mint) and
// Cardmarket EUR. What it does NOT give: graded prices (PSA/CGC) or
// per-condition prices — no free source does. For a graded card the
// endpoint returns the raw market price PLUS an honest note and a
// prefilled eBay sold-search link, and never presents a made-up
// graded number as a market price.
// Do NOT build on pokemontcg.io (deprecated, no new keys, dies
// 2027-03-01) or the TCGplayer API (closed to new developers).
import { json, noDb, getDb } from "./_lib.js";

const TCGDEX = "https://api.tcgdex.net/v2/en";

async function tcgdex(path) {
  let res;
  try {
    res = await fetch(TCGDEX + path, { headers: { "user-agent": "RareCandyReserve/1.0 (price suggest)" }, signal: AbortSignal.timeout(10000) });
  } catch { return null; }
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

function pickPrice(card) {
  // TCGdex card detail carries pricing in a few shapes; take the
  // TCGplayer USD market price for a normal/holofoil finish, whichever
  // is there. Returns { cents, finish, updatedAt } or null.
  const p = card && card.pricing;
  if (!p) return null;
  const tp = p.tcgplayer || p.TCGplayer;
  if (tp) {
    for (const finish of ["holofoil", "normal", "reverseHolofoil", "1stEdition", "unlimited"]) {
      const f = tp[finish];
      if (f && typeof f.market === "number") {
        return { cents: Math.round(f.market * 100), finish, updatedAt: tp.updatedAt || f.updatedAt || null };
      }
    }
  }
  const cm = p.cardmarket || p.Cardmarket;
  if (cm && typeof cm.averageSellPrice === "number") {
    return { cents: Math.round(cm.averageSellPrice * 100), finish: "cardmarket-eur", updatedAt: cm.updatedAt || null, currency: "EUR" };
  }
  return null;
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const name = (q.get("name") || "").trim();
  const setName = (q.get("set") || "").trim();
  const number = (q.get("number") || "").trim();
  const graded = q.get("graded") === "1" || q.get("graded") === "true";
  const grade = (q.get("grade") || "").trim().slice(0, 20);
  if (name.length < 2) return json({ ok: false, error: "Type at least 2 letters of the card name." });
  const list = await tcgdex("/cards?name=" + encodeURIComponent(name));
  if (!list || !Array.isArray(list) || !list.length) {
    return json({ ok: false, error: "No card by that name in the free price database — check the spelling, or set your own price." });
  }
  // Prefer an exact set + number match; otherwise the first name match.
  let match = list[0];
  if (setName || number) {
    const exact = list.find((c) => {
      const setOk = !setName || String((c.set && c.set.name) || "").toLowerCase().includes(setName.toLowerCase());
      const numOk = !number || String(c.number || "").toLowerCase() === number.toLowerCase();
      return setOk && numOk;
    });
    if (exact) match = exact;
  }
  const detail = await tcgdex("/cards/" + encodeURIComponent(match.id));
  const card = detail || match;
  const price = pickPrice(card);
  const ebayUrl = "https://www.ebay.com/sch/i.html?_nkw=" + encodeURIComponent(name + (setName ? " " + setName : "") + (number ? " " + number : "") + (graded && grade ? " PSA " + grade : "")) + "&LH_Sold=1&LH_Complete=1";
  if (!price) {
    return json({
      ok: true, found: true, price_cents: null,
      card_name: card.name || match.name, set_name: (card.set && card.set.name) || (match.set && match.set.name) || "",
      number: card.number || match.number || "",
      source: "TCGdex (free, no key) — card found, but no market price in its response",
      note: "No live price for this one — set your own, or check real sold prices on eBay.",
      ebay_sold_url: ebayUrl,
    });
  }
  if (graded) {
    return json({
      ok: true, found: true, price_cents: price.cents,
      card_name: card.name || match.name, set_name: (card.set && card.set.name) || (match.set && match.set.name) || "",
      number: card.number || match.number || "", grade: grade || "graded",
      source: "TCGplayer market price (raw / near-mint) via TCGdex — free, no key. Updated " + (price.updatedAt ? new Date(price.updatedAt).toLocaleDateString() : "recently"),
      note: "That number is the RAW card's market price — no free source gives real graded (PSA/CGC) sold prices. A graded " + (grade || "") + " usually sells for more; check eBay sold listings for this exact grade before you price it, or list at the raw price and let offers come in.",
      graded_estimate: true,
      ebay_sold_url: ebayUrl,
    });
  }
  return json({
    ok: true, found: true, price_cents: price.cents,
    card_name: card.name || match.name, set_name: (card.set && card.set.name) || (match.set && match.set.name) || "",
    number: card.number || match.number || "",
    source: "TCGplayer market price (raw / near-mint" + (price.finish && price.finish !== "normal" ? ", " + price.finish : "") + ") via TCGdex — free, no key. Updated " + (price.updatedAt ? new Date(price.updatedAt).toLocaleDateString() : "recently"),
    note: "A guide, not a promise — check the card's condition against the price, and recent sold listings if it's an expensive one.",
    ebay_sold_url: ebayUrl,
  });
}
