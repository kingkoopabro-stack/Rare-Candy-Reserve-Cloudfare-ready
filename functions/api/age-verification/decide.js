// POST /api/age-verification/decide — OPERATOR ONLY. Approves or rejects a
// pending ID review. On approval the member's age_verified flag is set.
// Either way the ID image is DELETED from the ID_VAULT bucket immediately
// and the request row's blob_key is cleared — the only record kept is the
// decision (status + timestamps) and the age_verified flag on the profile.
import { json, noDb, getDb, readJson, profileByDevice, isOperator, nowMs } from "../../_lib.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me || !isOperator(env, me)) return json({ ok: false, error: "Only the operator reviews IDs." });
  if (!["approve", "reject"].includes(a.decision)) return json({ ok: false, error: "Pick approve or reject." });
  const id = Number(a.request_id || 0);
  const row = await db.prepare("SELECT * FROM age_verification_requests WHERE id = ? LIMIT 1").bind(id).first();
  if (!row) return json({ ok: false, error: "That review request is gone." });
  if (row.status !== "pending") return json({ ok: false, error: "That request was already decided." });
  const status = a.decision === "approve" ? "approved" : "rejected";
  const now = nowMs();
  await db.batch([
    db.prepare("UPDATE age_verification_requests SET status = ?, blob_key = NULL, decided_at = ?, decided_by_profile_id = ? WHERE id = ?")
      .bind(status, now, me.id, id),
    ...(a.decision === "approve"
      ? [db.prepare("UPDATE profiles SET age_verified = 1, updated_at = ? WHERE id = ?").bind(now, row.profile_id)]
      : []),
  ]);
  // Delete the ID image immediately after the decision, whatever it was.
  if (row.blob_key && env.ID_VAULT) {
    try { await env.ID_VAULT.delete(row.blob_key); } catch { /* already gone — decision still stands */ }
  }
  return json({ ok: true, error: null, status });
}
