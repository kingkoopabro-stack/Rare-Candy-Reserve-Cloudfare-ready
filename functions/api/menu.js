// Creator menu — POST /api/menu (create/update one slot) and
// GET /api/menu (my own menu, for the Edit Profile editor).
//
// POST body: { device_id, slot 1-4, title ≤60, price_cents (or whole
// dollars in `price`), kind 'existing'|'custom', package_id?,
// post_id?, listing_id?, pay_methods? ["cashapp"|"paypal"|"venmo"|
// "chime"], auto_accept? 0|1 }. Price is validated server-side
// ($1–$10,000, whole dollars). kind='existing' must point at a
// package, creator post, or digital listing that belongs to the
// creator; kind='custom' points at nothing yet (the work is made on
// request). Owner or operator (operator may pass profile_id to edit
// someone else's menu for moderation). The 4-item limit is the
// UNIQUE(profile_id, slot) in the schema, not just the UI.
import { json, noDb, getDb, readJson, profileByDevice, nowMs, isOperator } from "./_lib.js";
import {
  ADULT_AREA_MSG, CREATOR_NOT_SETUP_MSG, MENU_MAX_SLOTS,
  creatorSalesGate, shapeMenuItem, cleanPayMethods, menuPriceFrom,
  validateMenuPointers, upsertMenuItem, menuPackageRow,
} from "./_creator.js";

function notSetup() {
  return json({ ok: false, error: CREATOR_NOT_SETUP_MSG, item: null });
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const q = new URL(request.url).searchParams;
  const me = await profileByDevice(db, q.get("device_id") || "");
  if (!me) return json({ ok: false, error: "Create your account first.", items: [] });
  try {
    const { results } = await db.prepare(
      "SELECT * FROM creator_menu_items WHERE profile_id = ? ORDER BY slot ASC",
    ).bind(me.id).all();
    const items = [];
    for (const r of (results || [])) items.push(shapeMenuItem(r, await menuPackageRow(db, r)));
    return json({ ok: true, items });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return notSetup();
    throw e;
  }
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, item: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your account first.");
  const operator = isOperator(env, me);
  // Operator moderation: may edit another creator's menu by passing
  // profile_id. Everyone else edits only their own.
  let ownerId = me.id;
  if (a.profile_id != null) {
    if (!operator) return fail("You can only edit your own menu.");
    ownerId = Number(a.profile_id);
    if (!ownerId) return fail("Pick a member to edit.");
  }
  const owner = ownerId === me.id ? me : await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(ownerId).first();
  if (!owner) return fail("That member doesn't exist.");
  if (!operator) {
    const gate = creatorSalesGate(owner);
    if (gate) return fail(gate);
  } else if (owner.age_verified !== 1) {
    return fail("That member isn't age-verified, so they have no menu to edit.");
  }
  const slot = Number(a.slot || 0);
  if (!Number.isInteger(slot) || slot < 1 || slot > MENU_MAX_SLOTS) return fail(`Pick a slot from 1 to ${MENU_MAX_SLOTS}.`);
  const title = String(a.title || "").trim().replace(/\s+/g, " ");
  if (title.length < 1 || title.length > 60) return fail("Give the item a name (1–60 characters).");
  const price = menuPriceFrom(a);
  if (price.error) return fail(price.error);
  const kind = String(a.kind || "existing").trim();
  if (kind !== "existing" && kind !== "custom") return fail("Pick whether this item sells something already uploaded or is made custom on request.");
  const ptr = {
    package_id: a.package_id != null ? Number(a.package_id) : null,
    post_id: a.post_id != null ? Number(a.post_id) : null,
    listing_id: a.listing_id != null ? Number(a.listing_id) : null,
  };
  if (ptr.package_id != null && !Number.isInteger(ptr.package_id)) return fail("That package isn't valid.");
  if (ptr.post_id != null && !Number.isInteger(ptr.post_id)) return fail("That post isn't valid.");
  if (ptr.listing_id != null && !Number.isInteger(ptr.listing_id)) return fail("That listing isn't valid.");
  let ptrErr = null;
  try {
    ptrErr = await validateMenuPointers(db, ownerId, kind, ptr);
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return notSetup();
    throw e;
  }
  if (ptrErr) return fail(ptrErr);
  const payMethods = cleanPayMethods(a.pay_methods);
  const payNote = typeof a.pay_note === "string" ? (a.pay_note.trim().slice(0, 80) || null) : null;
  const autoAccept = a.auto_accept === true || a.auto_accept === 1 ? 1 : 0;
  let saved;
  try {
    saved = await upsertMenuItem(db, ownerId, slot, {
      title, price_cents: price.cents, kind,
      package_id: ptr.package_id, post_id: ptr.post_id, listing_id: ptr.listing_id,
      pay_methods: payMethods ? JSON.stringify(payMethods) : null, pay_note: payNote, auto_accept: autoAccept,
    });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return notSetup();
    throw e;
  }
  if (saved.error) return fail(saved.error);
  return json({ ok: true, error: null, item: shapeMenuItem(saved.item, await menuPackageRow(db, saved.item)) });
}
