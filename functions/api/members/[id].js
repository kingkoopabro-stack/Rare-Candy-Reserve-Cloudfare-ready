// GET /api/members/:id — public member page: profile card + Top Friends
// + custom layout + presence. The layout CSS is returned exactly as stored
// (it was sanitized to CSS-only on save); the frontend injects it scoped
// to the member page and removes it on navigation. Never leaks full_name,
// payout handle, birthday year, or device id.
import { json, noDb, getDb, profileByDevice, shapeMember, parseTopFriendIds, topFriendCards } from "../_lib.js";

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const id = Number(params.id);
  if (!id) return json({ member: null });
  const row = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(id).first();
  if (!row) return json({ member: null });
  const deviceId = new URL(request.url).searchParams.get("device_id") || "";
  const me = deviceId ? await profileByDevice(db, deviceId) : null;
  const friends = await topFriendCards(db, parseTopFriendIds(row.top_friends));
  const m = shapeMember(row);
  return json({
    member: {
      ...m,
      age_verified: row.age_verified === 1,
      is_operator: row.is_operator === 1,
      layout_css: row.layout_css ?? "",
      layout_preset: row.layout_preset ?? "",
      top_friends: friends,
      is_mine: !!me && me.id === row.id,
    },
  });
}
