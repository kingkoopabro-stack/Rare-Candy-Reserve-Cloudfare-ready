// POST /api/owner/setup — first-run operator claim. Marks the caller's
// profile as the operator (is_operator = 1). Works ONLY while no operator
// exists yet — the first claim wins, so Chris must claim it before the
// Community is opened to members. (A stronger pin is also available: set
// the OPERATOR_DEVICE_ID Pages variable in the dashboard to Chris's device
// id; that matches regardless of the claim.)
//
// The operator can: view + resolve the Reports inbox, review ID photos
// and approve/reject age verification, and set the 18+ welcome picture.
import { json, noDb, getDb, readJson, profileByDevice, nowMs } from "../_lib.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first — the operator claim lives on an account." });
  if (me.is_operator === 1) return json({ ok: true, error: null, is_operator: true, message: "This account is already the operator." });
  const existing = await db.prepare("SELECT id FROM profiles WHERE is_operator = 1 LIMIT 1").first();
  if (existing) return json({ ok: false, error: "An operator is already set — only the operator can change operator rights.", is_operator: false });
  await db.prepare("UPDATE profiles SET is_operator = 1, updated_at = ? WHERE id = ?").bind(nowMs(), me.id).run();
  return json({ ok: true, error: null, is_operator: true, message: "Operator claimed. This account can now see the Reports inbox, review photo IDs, and set the 18+ welcome picture." });
}
