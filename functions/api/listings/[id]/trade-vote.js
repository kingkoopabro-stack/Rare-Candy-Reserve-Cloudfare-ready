// POST /api/listings/:id/trade-vote — voteTrade (good / fair / bad).
import { json, noDb, getDb, readJson, profileByDevice } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, good: 0, fair: 0, bad: 0 });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to vote.");
  if (!["good", "fair", "bad"].includes(a.verdict)) return fail("Pick good, fair, or bad.");
  const id = Number(params.id);
  const existing = await db.prepare("SELECT 1 AS x FROM trade_votes WHERE listing_id = ? AND profile_id = ? LIMIT 1").bind(id, me.id).first();
  if (existing) {
    await db.prepare("UPDATE trade_votes SET verdict = ? WHERE listing_id = ? AND profile_id = ?").bind(a.verdict, id, me.id).run();
  } else {
    await db.prepare("INSERT INTO trade_votes (listing_id, profile_id, verdict) VALUES (?, ?, ?)").bind(id, me.id, a.verdict).run();
  }
  const { results } = await db.prepare("SELECT verdict FROM trade_votes WHERE listing_id = ?").bind(id).all();
  const all = results || [];
  return json({
    ok: true, error: null,
    good: all.filter((v) => v.verdict === "good").length,
    fair: all.filter((v) => v.verdict === "fair").length,
    bad: all.filter((v) => v.verdict === "bad").length,
  });
}
