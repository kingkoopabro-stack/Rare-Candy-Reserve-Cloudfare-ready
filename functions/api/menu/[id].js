// Creator menu — GET /api/menu/:profileId (public read of one
// creator's menu) and DELETE /api/menu/:id (remove one slot).
//
// The read is age-gated server-side, exactly like adult listings
// and posts: guests and non-verified members get an empty menu — no
// item names, no prices, nothing leaks. A creator whose toggle is
// OFF has no visible menu either. The operator sees any menu (for
// moderation). Delete is owner or operator.
import { json, noDb, getDb, profileByDevice, isOperator } from "../_lib.js";
import { CREATOR_NOT_SETUP_MSG, shapeMenuItem, menuPackageRow } from "../_creator.js";

export async function onRequestGet({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const profileId = Number(params.id);
  const me = q.get("device_id") ? await profileByDevice(db, q.get("device_id")) : null;
  const verified = !!me && me.age_verified === 1;
  const operator = !!me && isOperator(env, me);
  // Not verified (and not the operator): the menu does not exist for
  // you. Empty list, no error — the profile page just shows no menu.
  if (!verified && !operator) return json({ ok: true, items: [] });
  const owner = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(profileId).first();
  if (!owner) return json({ ok: false, error: "That member doesn't exist.", items: [] });
  if (!operator && owner.content_sales_enabled !== 1) return json({ ok: true, items: [] });
  try {
    const { results } = await db.prepare(
      "SELECT * FROM creator_menu_items WHERE profile_id = ? ORDER BY slot ASC",
    ).bind(profileId).all();
    const items = [];
    for (const r of (results || [])) items.push(shapeMenuItem(r, await menuPackageRow(db, r)));
    return json({ ok: true, items });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG, items: [] });
    throw e;
  }
}

export async function onRequestDelete({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first." });
  const id = Number(params.id);
  let item = null;
  try {
    item = await db.prepare("SELECT * FROM creator_menu_items WHERE id = ? LIMIT 1").bind(id).first();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return json({ ok: false, error: CREATOR_NOT_SETUP_MSG });
    throw e;
  }
  if (!item) return json({ ok: false, error: "That menu item is gone." });
  if (item.profile_id !== me.id && !isOperator(env, me)) {
    return json({ ok: false, error: "You can only remove your own menu items." });
  }
  await db.prepare("DELETE FROM creator_menu_items WHERE id = ?").bind(id).run();
  return json({ ok: true, error: null });
}
