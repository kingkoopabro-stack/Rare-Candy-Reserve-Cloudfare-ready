// GET /api/members/:id — public member page: profile card + Top Friends
// + custom layout + presence. The layout CSS is returned exactly as stored
// (it was sanitized to CSS-only on save); the frontend injects it scoped
// to the member page and removes it on navigation. Never leaks full_name,
// payout handle, birthday year, or device id.
// v3.6: also returns is_friend / is_favorite (for the viewer) and
// my_groups (the viewer's own groups, with member ids) so the member
// page can render the action buttons and the Add-to-group picker.
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
  // v3.6 viewer state — wrapped so a DB that hasn't run the v3.6
  // migration yet just returns the defaults instead of erroring.
  let isFriend = false;
  let isFavorite = false;
  let myGroups = [];
  if (me && me.id !== row.id) {
    try {
      const f = await db.prepare("SELECT 1 FROM friends WHERE profile_id = ? AND friend_id = ? LIMIT 1").bind(me.id, row.id).first();
      isFriend = !!f;
      const fav = await db.prepare("SELECT 1 FROM favorites WHERE profile_id = ? AND favorite_id = ? LIMIT 1").bind(me.id, row.id).first();
      isFavorite = !!fav;
    } catch { /* v3.6 tables not there yet — defaults stand */ }
  }
  if (me) {
    try {
      const { results: groups } = await db.prepare("SELECT id, name FROM groups WHERE owner_id = ? ORDER BY name ASC").bind(me.id).all();
      for (const g of (groups || [])) {
        const { results: members } = await db.prepare("SELECT profile_id FROM group_members WHERE group_id = ?").bind(g.id).all();
        myGroups.push({ id: g.id, name: g.name, member_ids: (members || []).map((x) => x.profile_id) });
      }
    } catch { myGroups = []; }
  }
  return json({
    member: {
      ...m,
      age_verified: row.age_verified === 1,
      is_operator: row.is_operator === 1,
      layout_css: row.layout_css ?? "",
      layout_preset: row.layout_preset ?? "",
      top_friends: friends,
      is_mine: !!me && me.id === row.id,
      is_friend: isFriend,
      is_favorite: isFavorite,
      my_groups: myGroups,
    },
  });
}
