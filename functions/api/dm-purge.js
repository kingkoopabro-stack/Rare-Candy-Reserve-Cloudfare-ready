// POST /api/dm-purge — the private-message auto-delete sweep. Deletes
// every DM past its 24 hours, rows AND attached file blobs. Safe to
// call by anyone: it only removes what was already due to die (the
// read side already hides expired messages). Call it once a day from a
// scheduled job (the headlines cron pattern works); the lazy purge on
// thread-open covers threads in between. Live chat and group chats
// are untouched — DMs only. There is no archive: deleted means gone.
import { json, noDb, getDb, nowMs, deleteBlob } from "./_lib.js";

export async function onRequestPost({ env }) {
  const db = getDb(env);
  if (!db) return noDb();
  const now = nowMs();
  let rows = [];
  try {
    const { results } = await db.prepare(
      "SELECT id, attachment_key FROM direct_messages WHERE expires_at IS NOT NULL AND expires_at <= ? LIMIT 500",
    ).bind(now).all();
    rows = results || [];
  } catch {
    return json({ ok: false, error: "DM auto-delete isn't set up yet — the shop is still running a quick database update." });
  }
  for (const r of rows) {
    if (r.attachment_key) await deleteBlob(env, r.attachment_key);
  }
  let deleted = 0;
  if (rows.length) {
    try {
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");
      const res = await db.prepare(`DELETE FROM direct_messages WHERE id IN (${placeholders})`).bind(...ids).run();
      deleted = (res.meta && res.meta.changes) || rows.length;
    } catch { deleted = 0; }
  }
  return json({ ok: true, error: null, deleted, checked_at: new Date(now).toISOString() });
}
