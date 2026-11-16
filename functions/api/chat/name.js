// POST /api/chat/name — setChatName (defaults to username).
import { json, noDb, getDb, readJson, profileByDevice, nowMs } from "../_lib.js";

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return json({ ok: false, error: "Create your account first to set a chat name.", chat_name: "" });
  const chatName = String(a.chat_name || "").trim().slice(0, 24);
  await db.prepare("UPDATE profiles SET chat_name = ?, updated_at = ? WHERE id = ?").bind(chatName, nowMs(), me.id).run();
  return json({ ok: true, error: null, chat_name: chatName });
}
