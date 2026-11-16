// POST /api/posts/:id/auth-vote — castAuthVote (Real / Looks Fake /
// Not Sure on a Card Check post). Casting again changes the verdict.
import { json, noDb, getDb, readJson, profileByDevice, authTally } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, real: 0, fake: 0, unsure: 0 });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to vote.");
  if (!["real", "fake", "unsure"].includes(a.verdict)) return fail("Pick Real, Looks Fake, or Not Sure.");
  const id = Number(params.id);
  const existing = await db.prepare("SELECT 1 AS x FROM auth_votes WHERE post_id = ? AND profile_id = ? LIMIT 1").bind(id, me.id).first();
  if (existing) {
    await db.prepare("UPDATE auth_votes SET verdict = ? WHERE post_id = ? AND profile_id = ?").bind(a.verdict, id, me.id).run();
  } else {
    await db.prepare("INSERT INTO auth_votes (post_id, profile_id, verdict) VALUES (?, ?, ?)").bind(id, me.id, a.verdict).run();
  }
  const t = await authTally(db, id);
  return json({ ok: true, error: null, ...t });
}
