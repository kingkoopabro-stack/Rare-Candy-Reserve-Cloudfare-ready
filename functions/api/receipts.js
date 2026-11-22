// Receipts (v3.1) — the invoice / money-spent history for private chats.
// A receipt is saved when a buyer and seller agree a sale happened in a
// private chat ("Mark transaction done"). The chat messages are still
// deleted when the chat closes — but the receipt survives, because it is
// the only record of the money.
//
// Per-user by design: every receipt row belongs to ONE member
// (profile_id = the owner). GET returns ONLY the caller's own receipts —
// a member never sees anyone else's spending. A receipt shows the amount,
// what was bought (the note), the other party's username, whether this
// member spent or received, and the date. NO chat content is kept — the
// note is the only description, written by the member who marked it.
//
// One transaction per conversation: marking a second one is refused, so a
// sale can't be double-recorded by accident. Both parties get a receipt
// (the buyer a "spent" one, the seller a "received" one) so each side has
// its own invoice.
//
// GET /api/receipts?device_id= — my receipts, newest first.
// POST /api/receipts — { device_id, conversation_id, amount_dollars
//   (whole dollars, 1–100000) or amount_cents, note (max 140 chars),
//   role: "buyer" (I bought it — I spent) | "seller" (I sold it — I
//   received) }. The caller must be a participant in an OPEN conversation.
// If the v3 migration (with the receipts table) hasn't run yet, both
// answer a clean "not set up yet" instead of crashing.
import { json, noDb, getDb, readJson, profileByDevice, iso, money, nowMs } from "./_lib.js";

function notSetup() {
  return json({ ok: false, error: "Receipts aren't set up yet — the shop is still running a quick database update." });
}

function shapeReceipt(row) {
  return {
    id: row.id,
    kind: row.kind, // "spent" | "received"
    amount_cents: row.amount_cents,
    amount: money(row.amount_cents),
    note: row.note ?? "",
    other_username: row.other_username ?? "member",
    other_profile_id: row.other_profile_id,
    conversation_id: row.conversation_id ?? null,
    // Content sale number for this chat, when the sale was a creator
    // post (null when the chat wasn't about a post, or the sale was
    // recorded before the CS# log existed).
    cs_number: row.cs_number ?? null,
    post_id: row.cs_post_id ?? null,
    // Open dispute on this receipt, if any (protection UI).
    dispute_status: row.dispute_status ?? null,
    dispute_id: row.dispute_id ?? null,
    created_at: iso(row.created_at),
  };
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first to see your receipts.", receipts: [] });
  // Joins are tried widest first and fall back when a table hasn't
  // landed yet (migration not run) — the receipts list never breaks.
  const base = (withCs, withDispute) => {
    const joins = [];
    if (withCs) joins.push("LEFT JOIN content_sales cs ON cs.conversation_id = r.conversation_id");
    if (withDispute) joins.push("LEFT JOIN reports d ON d.target_type = 'receipt' AND d.target_id = r.id AND d.status IN ('open', 'claimed')");
    const cols = ["r.*"];
    if (withCs) cols.push("cs.cs_number AS cs_number", "cs.post_id AS cs_post_id");
    if (withDispute) cols.push("d.id AS dispute_id", "d.status AS dispute_status");
    return `SELECT ${cols.join(", ")} FROM receipts r ${joins.join(" ")} WHERE r.profile_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 100`;
  };
  const noTable = (e) => /no such table/i.test(String((e && e.message) || e));
  try {
    const { results } = await db.prepare(base(true, true)).bind(me.id).all();
    return json({ receipts: (results || []).map(shapeReceipt) });
  } catch (e) { if (!noTable(e)) throw e; }
  try {
    const { results } = await db.prepare(base(false, true)).bind(me.id).all();
    return json({ receipts: (results || []).map(shapeReceipt) });
  } catch (e) { if (!noTable(e)) throw e; }
  try {
    const { results } = await db.prepare(
      `SELECT * FROM receipts WHERE profile_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`,
    ).bind(me.id).all();
    return json({ receipts: (results || []).map(shapeReceipt) });
  } catch (e2) {
    if (noTable(e2)) return notSetup();
    throw e2;
  }
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first." });
  if (me.age_verified !== 1) {
    return json({ ok: false, error: "Receipts are for 18+ private chats — verify your age first (Rules & After Dark)." });
  }
  const convId = Number(a.conversation_id || 0);
  if (!convId) return json({ ok: false, error: "Pick a private chat to record a transaction for." });
  const role = a.role === "seller" ? "seller" : "buyer";
  // Amount: whole dollars from the client, or cents directly. 1–$100,000.
  let amountCents = 0;
  if (Number.isInteger(a.amount_cents)) amountCents = a.amount_cents;
  else if (Number.isInteger(a.amount_dollars)) amountCents = a.amount_dollars * 100;
  else if (typeof a.amount_dollars === "number") amountCents = Math.round(a.amount_dollars * 100);
  if (!Number.isFinite(amountCents) || amountCents < 100 || amountCents > 10000000) {
    return json({ ok: false, error: "Amount needs to be $1 to $100,000, in whole dollars." });
  }
  const note = String(a.note || "").trim().slice(0, 140);
  if (!note) return json({ ok: false, error: "Say what was bought — one short line (up to 140 characters)." });
  try {
    const conv = await db.prepare("SELECT * FROM ephemeral_conversations WHERE id = ? LIMIT 1").bind(convId).first();
    if (!conv) return json({ ok: false, error: "That chat doesn't exist." });
    const isParticipant = conv.member_a_id === me.id || conv.member_b_id === me.id;
    if (!isParticipant) return json({ ok: false, error: "That's not your chat." });
    if (conv.closed_at) return json({ ok: false, error: "That chat was closed — its messages were deleted. Start a new one for a new sale." });
    // One transaction per conversation — a sale can't be double-recorded.
    const existing = await db.prepare("SELECT id FROM receipts WHERE conversation_id = ? LIMIT 1").bind(convId).first();
    if (existing) {
      return json({ ok: false, error: "A transaction is already recorded for this chat — check My receipts. Start a new chat for a new sale." });
    }
    const otherId = conv.member_a_id === me.id ? conv.member_b_id : conv.member_a_id;
    const other = await db.prepare("SELECT id, username FROM profiles WHERE id = ? LIMIT 1").bind(otherId).first();
    const otherName = other ? other.username : "member";
    const now = nowMs();
    // Both parties get a receipt: the buyer a "spent" one, the seller a
    // "received" one. Each sees only their own, in My receipts.
    const myKind = role === "buyer" ? "spent" : "received";
    const theirKind = role === "buyer" ? "received" : "spent";
    const inserted = await db.batch([
      db.prepare(
        `INSERT INTO receipts (profile_id, conversation_id, other_profile_id, other_username, kind, amount_cents, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(me.id, convId, otherId, otherName, myKind, amountCents, note, now),
      db.prepare(
        `INSERT INTO receipts (profile_id, conversation_id, other_profile_id, other_username, kind, amount_cents, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(otherId, convId, me.id, me.username, theirKind, amountCents, note, now),
    ]);
    const receiptId = inserted && inserted[0] && inserted[0].meta ? inserted[0].meta.last_row_id : null;
    // Content sale log (CS#) — only when this chat started from a
    // creator post: the sale gets a sequential number and a watermark
    // line for the buyer, so a leaked copy traces back to who bought it.
    // The buyer is whoever spent; the seller is the other side. The
    // buyer IP comes from Cloudflare (cf-connecting-ip) and is stored
    // server-side only — it never leaves the server except to the
    // operator's CS# lookup. If the content_sales table isn't there yet
    // (migration not run), the receipt still saves and cs_number comes
    // back null. If the CS# insert itself fails, the receipt still saves
    // — a missing number is visible to the operator (numbers skip),
    // which beats losing the whole receipt to an error.
    let csNumber = null;
    let watermarkText = "";
    if (conv.post_id) {
      const post = await db.prepare("SELECT id, title FROM posts WHERE id = ? LIMIT 1").bind(conv.post_id).first();
      const buyerId = role === "buyer" ? me.id : otherId;
      const buyerName = role === "buyer" ? me.username : otherName;
      const sellerId = role === "buyer" ? otherId : me.id;
      const sellerName = role === "buyer" ? otherName : me.username;
      const buyerIp = request.headers.get("cf-connecting-ip") || "";
      const itemTitle = (post && post.title) || note;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const mx = await db.prepare("SELECT MAX(cs_number) AS m FROM content_sales").first();
          const next = (mx && mx.m ? mx.m : 0) + 1;
          const wm = "RareCandyReserve.org • @" + buyerName + " • CS#" + next + " • redistribution of this is punishable by law";
          await db.prepare(
            `INSERT INTO content_sales (cs_number, conversation_id, receipt_id, post_id, buyer_id, buyer_username, seller_id, seller_username, item_title, amount_cents, buyer_ip, watermark_text, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(next, convId, receiptId, conv.post_id, buyerId, buyerName, sellerId, sellerName, itemTitle, amountCents, buyerIp, wm, now).run();
          csNumber = next;
          watermarkText = wm;
          break;
        } catch (e2) {
          const msg2 = String((e2 && e2.message) || e2);
          if (/no such table/i.test(msg2)) { csNumber = null; watermarkText = ""; break; }
          if (/UNIQUE constraint failed/i.test(msg2) && attempt === 0) continue;
          csNumber = null;
          watermarkText = "";
          break;
        }
      }
    }
    return json({ ok: true, error: null, receipt_id: receiptId, amount_cents: amountCents, amount: money(amountCents), note, cs_number: csNumber, watermark_text: watermarkText });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return notSetup();
    throw e;
  }
}
