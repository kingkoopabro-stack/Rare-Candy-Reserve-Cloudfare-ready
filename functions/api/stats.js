// GET /api/stats — community counts (getStats).
import { json, noDb, getDb } from "./_lib.js";

export async function onRequestGet({ env }) {
  const db = getDb(env);
  if (!db) return noDb();
  const count = async (table, where) => {
    const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}${where ? ` WHERE ${where}` : ""}`).first();
    return r?.n ?? 0;
  };
  return json({
    members: await count("profiles"),
    posts: await count("posts"),
    comments: await count("comments"),
    listings: await count("listings"),
    card_checks: await count("posts", "kind = 'card_auth'"),
    open_reports: await count("reports", "status = 'open'"),
  });
}
