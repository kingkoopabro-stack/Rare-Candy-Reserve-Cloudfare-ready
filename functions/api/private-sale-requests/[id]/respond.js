// POST /api/private-sale-requests/:id/respond — the SELLER answers a
// buy request. Two actions, nothing else:
//   accept — marks the request accepted and tells the buyer the sale
//     is being set up. The seller then lists it with the normal
//     private-sale form (that's where physical/digital + shipping are
//     picked, and where the linked-bank gate runs — same as any private
//     sale). No listing is created here and nobody is charged here.
//   decline — marks it declined and tells the buyer. Nothing charged.
// A request can only be answered once, while it is still open and
// unexpired (3 days, like Flea Market offers). The follow-up DMs
// start with "✓ Buy request #N" / "✗ Buy request #N" so the chat can
// tell an answered request apart from an open one and hide the
// Accept/Decline buttons — change that prefix here and in renderIMLog
// together if it ever changes.
import { json, noDb, getDb, readJson, profileByDevice, nowMs, sendDM, money } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your account first.");
  const id = Number(params.id);
  let req;
  try {
    req = await db.prepare("SELECT * FROM private_sale_requests WHERE id = ? LIMIT 1").bind(id).first();
  } catch {
    return fail("Buy requests aren't switched on yet — the shop is still running a quick database update. Try again in a bit.");
  }
  if (!req) return fail("That request is gone.");
  if (req.seller_id !== me.id) return fail("Only the seller answers this request.");
  if (req.status !== "open") return fail("That request is already " + req.status + ".");
  if (req.expires_at && req.expires_at < nowMs()) {
    await db.prepare("UPDATE private_sale_requests SET status = 'expired', updated_at = ? WHERE id = ?").bind(nowMs(), id).run();
    return fail("That request expired — buy requests last 3 days. They can send a fresh one.");
  }
  const buyer = await db.prepare("SELECT id, username FROM profiles WHERE id = ? LIMIT 1").bind(req.buyer_id).first();
  if (!buyer) return fail("That buyer doesn't exist anymore.");
  const now = nowMs();
  const cleanTitle = String(req.title || "").replace(/"/g, "'");
  if (String(a.action || "") === "decline") {
    await db.prepare("UPDATE private_sale_requests SET status = 'declined', updated_at = ? WHERE id = ?").bind(now, id).run();
    await sendDM(db, me, req.buyer_id, `✗ Buy request #${id} declined — I'm not selling "${cleanTitle}" right now. Nothing was charged.`);
    return json({ ok: true, error: null, action: "declined" });
  }
  if (String(a.action || "") === "accept") {
    await db.prepare("UPDATE private_sale_requests SET status = 'accepted', updated_at = ? WHERE id = ?").bind(now, id).run();
    await sendDM(db, me, req.buyer_id, `✓ Buy request #${id} accepted — I'm setting up the sale for "${cleanTitle}" (${money(req.price_cents)}) now. You'll get the payment link here.`);
    return json({ ok: true, error: null, action: "accepted" });
  }
  return fail("Pick accept or decline.");
}
