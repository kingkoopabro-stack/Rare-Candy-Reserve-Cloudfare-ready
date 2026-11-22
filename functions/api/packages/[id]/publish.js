// POST /api/packages/:id/publish — list a staged package into a
// menu slot (the deliberate "List this package" tap — publishing is
// never automatic on upload).
//
// { device_id, slot 1-4, price_cents? (or whole dollars in `price`),
//   title? }. The price defaults to the price already on that slot,
// when the slot is occupied; a fresh slot needs a price in the body.
// The package must have its zip uploaded. The menu slot sells the
// package (kind 'existing') at one price; the package flips to
// 'listed'. Badge + toggle gate enforced (operator may publish for
// moderation).
import { json, noDb, getDb, readJson, profileByDevice, nowMs, isOperator } from "../../_lib.js";
import {
  CREATOR_NOT_SETUP_MSG, MENU_MAX_SLOTS, creatorSalesGate,
  menuPriceFrom, upsertMenuItem, shapeMenuItem, menuPackageRow,
} from "../../_creator.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, item: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your account first.");
  const id = Number(params.id);
  let pkg = null;
  try {
    pkg = await db.prepare("SELECT * FROM creator_packages WHERE id = ? LIMIT 1").bind(id).first();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail(CREATOR_NOT_SETUP_MSG);
    throw e;
  }
  if (!pkg) return fail("That package is gone.");
  const operator = isOperator(env, me);
  if (pkg.profile_id !== me.id && !operator) return fail("That package isn't yours.");
  if (!operator) {
    const gate = creatorSalesGate(me);
    if (gate) return fail(gate);
  }
  if (!pkg.zip_key) return fail("Upload the package zip first — a listed package needs its files.");
  const slot = Number(a.slot || 0);
  if (!Number.isInteger(slot) || slot < 1 || slot > MENU_MAX_SLOTS) return fail(`Pick a slot from 1 to ${MENU_MAX_SLOTS}.`);
  // Price: body first, else the price already sitting on that slot.
  let priceCents = null;
  const price = menuPriceFrom(a);
  if (!price.error) priceCents = price.cents;
  let existingSlot = null;
  try {
    existingSlot = await db.prepare("SELECT * FROM creator_menu_items WHERE profile_id = ? AND slot = ? LIMIT 1").bind(pkg.profile_id, slot).first();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail(CREATOR_NOT_SETUP_MSG);
    throw e;
  }
  if (priceCents == null) {
    if (existingSlot) priceCents = existingSlot.price_cents;
    else return fail("Set a price for this package first (whole dollars, $1–$10,000).");
  }
  const title = String(a.title || "").trim().replace(/\s+/g, " ") || pkg.title;
  if (title.length > 60) return fail("Keep the menu name to 60 characters.");
  const saved = await upsertMenuItem(db, pkg.profile_id, slot, {
    title, price_cents: priceCents, kind: "existing",
    package_id: pkg.id, post_id: null, listing_id: null,
    pay_methods: existingSlot ? existingSlot.pay_methods : null,
    auto_accept: existingSlot ? existingSlot.auto_accept : 0,
  });
  if (saved.error) return fail(saved.error);
  await db.prepare("UPDATE creator_packages SET status = 'listed', updated_at = ? WHERE id = ?").bind(nowMs(), pkg.id).run();
  return json({ ok: true, error: null, item: shapeMenuItem(saved.item, await menuPackageRow(db, saved.item)) });
}
