// GET /api/lucre?device_id= — the member's Lucre wallet: balance,
// recent earnings, weekly check-in state, owned store items.
// POST /api/lucre — actions: checkin (weekly, once per 7 days),
// purchase (a priced Layout Store item), radio-first (first radio
// listen, once ever), share (once per post/listing shared), song
// (once per song ref — wired when song uploads land), grant
// (operator only — 40 Lucre for a successful suggestion).
// Lucre is site-only currency: NOT real money, NOT crypto, NOT
// redeemable for cash. It only buys layouts and frames in Taffy's
// Layout Store. Balances are always computed server-side from the
// ledger — the client never sends a balance or a price.
import {
  json, noDb, getDb, readJson, profileByDevice, nowMs,
  LUCRE_SYMBOL, LUCRE_AWARDS, LUCRE_STORE_PRICES,
  awardLucre, lucreBalance, lucreLedger, lucreOwned,
  lucreCheckinState, lucreDoCheckin, isOperator,
} from "./_lib.js";

const REASON_LABELS = {
  post: "Posted", listing: "Listed an item", profile: "Created your profile",
  comment: "Commented", heart: "Hearted", transaction: "Completed a sale",
  suggestion: "Suggestion accepted", friend: "Added a friend",
  favorite: "Favorited a member", share: "Shared a post", song: "Uploaded a song",
  radio_first: "First radio listen", profile_complete: "Finished setting up your profile",
  checkin: "Weekly check-in", checkin_bonus: "7-week check-in bonus",
  purchase: "Bought in the Layout Store",
};
function labelFor(reason) { return REASON_LABELS[reason] || reason; }

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!me) return json({ ok: false, error: "Create your profile first — your Lucre wallet lives on it.", symbol: LUCRE_SYMBOL, balance: 0, ledger: [], checkin: null, owned: [] });
  const [balance, ledger, checkin, owned] = await Promise.all([
    lucreBalance(db, me.id), lucreLedger(db, me.id, 20),
    lucreCheckinState(db, me.id), lucreOwned(db, me.id),
  ]);
  return json({
    ok: true, error: null, symbol: LUCRE_SYMBOL, balance,
    ledger: ledger.map((e) => ({ amount: e.amount, reason: e.reason, label: labelFor(e.reason), created_at: e.created_at })),
    checkin, owned,
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, balance: 0 });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first — your Lucre wallet lives on it.");
  const action = String(a.action || "");

  // Weekly check-in — once per rolling 7 days, server-enforced.
  if (action === "checkin") {
    const res = await lucreDoCheckin(db, me.id);
    if (!res.ok) return json({ ok: false, error: res.error, balance: await lucreBalance(db, me.id), checkin: res.state });
    return json({ ok: true, error: null, balance: res.balance, streak: res.streak, bonus_paid: res.bonus_paid, checkin: res.state });
  }

  // Buy a priced Layout Store item. The price comes from the server
  // list, never from the client. Deduct + mark owned in one go; the
  // ledger unique key makes a double-tap safe (the second deduction
  // is a no-op and the item is already owned).
  if (action === "purchase") {
    const itemId = String(a.item_id || "").trim().slice(0, 60);
    const price = LUCRE_STORE_PRICES[itemId];
    if (!price) return fail("That item isn't for sale with Lucre — free layouts just apply, no purchase needed.");
    const owned = await lucreOwned(db, me.id);
    if (owned.includes(itemId)) return json({ ok: true, error: null, already_owned: true, balance: await lucreBalance(db, me.id), owned });
    const balance = await lucreBalance(db, me.id);
    if (balance < price) return fail("Not enough Lucre yet — earn more by posting, commenting, and checking in weekly.");
    const paid = await awardLucre(db, me.id, -price, "purchase", itemId);
    if (!paid.awarded) return fail("That purchase already went through — check your owned layouts.");
    try {
      await db.prepare("INSERT OR IGNORE INTO lucre_owned (profile_id, item_id, price_paid, created_at) VALUES (?, ?, ?, ?)").bind(me.id, itemId, price, nowMs()).run();
    } catch { /* table not there yet — the ledger row is the record */ }
    return json({ ok: true, error: null, already_owned: false, balance: paid.balance, owned: [...owned, itemId] });
  }

  // First radio listen — once ever per member.
  if (action === "radio-first") {
    const r = await awardLucre(db, me.id, LUCRE_AWARDS.radio_first, "radio_first", "first");
    return json({ ok: true, error: null, awarded: r.awarded, balance: r.balance });
  }

  // Share a post or listing — once per shared item per member.
  if (action === "share") {
    const refType = String(a.ref_type || "").trim();
    const refId = String(a.ref_id || "").trim();
    if ((refType !== "post" && refType !== "listing") || !refId) return fail("Share needs a post or listing to point at.");
    const r = await awardLucre(db, me.id, LUCRE_AWARDS.share, "share", refType + ":" + refId);
    return json({ ok: true, error: null, awarded: r.awarded, balance: r.balance });
  }

  // Song upload — once per song ref. No song-upload UI exists on the
  // site yet; this is the award the upload flow calls when it lands.
  if (action === "song") {
    const refId = String(a.ref_id || "").trim();
    if (!refId) return fail("Song needs a reference to point at.");
    const r = await awardLucre(db, me.id, LUCRE_AWARDS.song, "song", refId);
    return json({ ok: true, error: null, awarded: r.awarded, balance: r.balance });
  }

  // Operator grant — 40 Lucre for a successful suggestion. Chris
  // (operator) awards it by hand; the member + note are recorded.
  if (action === "grant") {
    if (!isOperator(env, me)) return fail("Only the operator can grant Lucre for a suggestion.");
    const targetId = Math.round(Number(a.profile_id) || 0);
    if (targetId <= 0) return fail("Pick the member to grant Lucre to.");
    const target = await db.prepare("SELECT id FROM profiles WHERE id = ? LIMIT 1").bind(targetId).first();
    if (!target) return fail("That member doesn't exist.");
    const note = String(a.note || "").trim().slice(0, 120) || "suggestion";
    const r = await awardLucre(db, targetId, LUCRE_AWARDS.suggestion, "suggestion", note + ":" + nowMs());
    return json({ ok: true, error: null, awarded: r.awarded, balance: r.balance, profile_id: targetId });
  }

  return fail("Unknown Lucre action.");
}
