// Shared helpers for the creator menu + content vault (2026-11-21).
// NOT a route (leading underscore) — imported by the menu / packages /
// requests / orders / my-stuff / signals / webhook endpoints.
//
// Money rules (unchanged): 6% platform fee on the ITEM PRICE ONLY —
// never on shipping or tax — taken automatically as
// application_fee_amount on Stripe sales. Manual sales owe the 6% but
// the site cannot collect it. No Lucre for menu sales. No escrow: the
// site never holds money and cannot force a refund.
//
// Storage caps (Chris, 2026-11-21 ~23:04-23:05 EST): 1 GB per package,
// 10 GB per creator vault (staged + listed), 5 GB "My stuff" kept
// downloads per buyer. Buying is NEVER blocked by the quota — only
// keeping a stored copy is.
import {
  nowMs, iso, money,
  notifyBuyerSeller, notifyTeam, createContentSale,
} from "./_lib.js";
import { platformFeeCents, createCheckoutSession, stripePlatformConfigured } from "./_stripe.js";

export const MENU_MIN_CENTS = 100; // $1
export const MENU_MAX_CENTS = 1000000; // $10,000
export const MENU_MAX_SLOTS = 4;
export const PACKAGE_MAX_BYTES = 1073741824; // 1 GB per package
export const VAULT_MAX_BYTES = 10737418240; // 10 GB per creator vault
export const MY_STUFF_QUOTA_BYTES = 5368709120; // 5 GB per buyer
export const R2_MULTIPART_MIN_BYTES = 5242880; // 5 MB — R2/S3 minimum per part except the last
export const R2_PART_MAX_BYTES = 33554432; // 32 MB per JSON chunk — keeps one request well under the Functions body limit
export const ADULT_AREA_MSG = "The 18+ area is for age-verified members only — verify your age with a photo ID (Rules & After Dark). A typed birthday alone is never enough.";
export const CREATOR_NOT_SETUP_MSG = "Content sales aren't switched on yet — the shop is still running a quick database update. Try again in a bit.";
export const PAY_METHODS = ["cashapp", "paypal", "venmo", "chime"];

// --- Gates ---------------------------------------------------------------
// The master gate for the whole feature: 18+ badge AND the
// "Content sales enabled" toggle. Returns an error string, or null
// when the profile may sell. A profile row from before the migration
// has no content_sales_enabled column at all — that reads as "not
// switched on yet", never as opted in.
export function creatorSalesGate(profile) {
  if (!profile) return "Create your account first.";
  if (!("content_sales_enabled" in profile)) return CREATOR_NOT_SETUP_MSG;
  if (profile.age_verified !== 1) return ADULT_AREA_MSG;
  if (profile.content_sales_enabled !== 1) return "Content sales are turned off on this profile — turn on \"Content sales enabled\" in Edit Profile first.";
  return null;
}
export function canSell(profile) {
  return creatorSalesGate(profile) === null;
}

// --- Menu items ----------------------------------------------------------

export function shapeMenuItem(row, pkg) {
  let contents = null;
  if (pkg && pkg.contents_summary) {
    try { contents = JSON.parse(pkg.contents_summary); } catch { contents = null; }
  }
  return {
    id: row.id, profile_id: row.profile_id, slot: row.slot,
    title: row.title ?? "", price_cents: row.price_cents ?? 0,
    price: money(row.price_cents ?? 0),
    kind: row.kind ?? "existing",
    package_id: row.package_id ?? null,
    post_id: row.post_id ?? null,
    listing_id: row.listing_id ?? null,
    pay_methods: parsePayMethods(row.pay_methods),
    pay_note: row.pay_note ?? "",
    auto_accept: row.auto_accept === 1,
    contents_summary: contents,
    package_status: pkg ? (pkg.status ?? null) : null,
    created_at: iso(row.created_at), updated_at: iso(row.updated_at),
  };
}

export function parsePayMethods(stored) {
  if (!stored) return null;
  try {
    const arr = JSON.parse(stored);
    if (!Array.isArray(arr)) return null;
    return arr.filter((m) => PAY_METHODS.includes(m));
  } catch { return null; }
}

export function cleanPayMethods(input) {
  if (input == null) return null;
  if (!Array.isArray(input)) return null;
  const out = [];
  for (const m of input) {
    const v = String(m || "").trim().toLowerCase();
    if (PAY_METHODS.includes(v) && !out.includes(v)) out.push(v);
  }
  return out.length ? out : null;
}

// Price arrives as price_cents (preferred) or whole dollars in
// `price`. Returns { cents } or { error }.
export function menuPriceFrom(body) {
  let cents = null;
  if (Number.isInteger(body.price_cents)) cents = body.price_cents;
  else if (typeof body.price === "number" && Number.isFinite(body.price)) cents = Math.round(body.price * 100);
  else if (typeof body.price === "string" && /^\d+(\.\d{1,2})?$/.test(body.price.trim())) cents = Math.round(Number(body.price) * 100);
  if (cents == null) return { error: "Set a price for this item." };
  if (cents < MENU_MIN_CENTS || cents > MENU_MAX_CENTS) return { error: "Menu prices run $1 to $10,000, whole dollars only." };
  if (cents % 100 !== 0) return { error: "Menu prices are whole dollars — no cents." };
  return { cents };
}

// Validate that a menu pointer (package / post / listing) belongs to
// the creator and is sellable adult/creator content. Returns an error
// string or null. kind='existing' needs at least one pointer;
// kind='custom' takes none (the work doesn't exist yet).
export async function validateMenuPointers(db, ownerId, kind, ptr) {
  const hasAny = ptr.package_id != null || ptr.post_id != null || ptr.listing_id != null;
  if (kind === "custom") {
    if (hasAny) return "Custom items are made on request — they don't point at uploaded content yet.";
    return null;
  }
  if (kind !== "existing") return "Pick whether this item sells something already uploaded or is made custom on request.";
  if (!hasAny) return "Pick which uploaded package, post, or digital listing this item sells.";
  if (ptr.package_id != null) {
    const p = await db.prepare("SELECT * FROM creator_packages WHERE id = ? LIMIT 1").bind(Number(ptr.package_id)).first();
    if (!p) return "That package is gone.";
    if (p.profile_id !== ownerId) return "That package isn't yours.";
    if (p.status !== "staged" && p.status !== "listed") return "That package isn't ready to sell.";
  }
  if (ptr.post_id != null) {
    const p = await db.prepare("SELECT * FROM posts WHERE id = ? LIMIT 1").bind(Number(ptr.post_id)).first();
    if (!p) return "That post is gone.";
    if (p.profile_id !== ownerId) return "That post isn't yours.";
    if (p.kind !== "adult" || p.is_creator !== 1) return "A menu item can only sell one of your creator posts from the 18+ area.";
  }
  if (ptr.listing_id != null) {
    const l = await db.prepare("SELECT * FROM listings WHERE id = ? LIMIT 1").bind(Number(ptr.listing_id)).first();
    if (!l) return "That listing is gone.";
    if (l.profile_id !== ownerId) return "That listing isn't yours.";
    if (l.status !== "active") return "That listing already sold.";
    if ((l.listing_type ?? "physical") !== "digital") return "A menu item can only sell a digital listing — physical items go through the normal listing flow.";
  }
  return null;
}

// One package/post/listing on one slot only — a second slot pointing
// at the same thing is a duplicate storefront, not a second product.
export async function menuPointerClash(db, ownerId, slot, ptr) {
  const { results } = await db.prepare(
    "SELECT id, slot, package_id, post_id, listing_id FROM creator_menu_items WHERE profile_id = ? AND slot != ?",
  ).bind(ownerId, slot).all();
  for (const r of (results || [])) {
    if (ptr.package_id != null && r.package_id === Number(ptr.package_id)) return `That package is already on your menu in slot ${r.slot}.`;
    if (ptr.post_id != null && r.post_id === Number(ptr.post_id)) return `That post is already on your menu in slot ${r.slot}.`;
    if (ptr.listing_id != null && r.listing_id === Number(ptr.listing_id)) return `That listing is already on your menu in slot ${r.slot}.`;
  }
  return null;
}

// Insert-or-update one menu slot (the UNIQUE(profile_id, slot) keeps
// the 4-item limit in the schema, not just the UI). fields: title,
// price_cents, kind, package_id, post_id, listing_id, pay_methods
// (JSON string or null), auto_accept (0/1). Returns { item } or
// { error }.
export async function upsertMenuItem(db, ownerId, slot, fields) {
  const now = nowMs();
  const clash = await menuPointerClash(db, ownerId, slot, fields);
  if (clash) return { error: clash };
  const existing = await db.prepare(
    "SELECT id FROM creator_menu_items WHERE profile_id = ? AND slot = ? LIMIT 1",
  ).bind(ownerId, slot).first();
  if (existing) {
    await db.prepare(
      "UPDATE creator_menu_items SET title = ?, price_cents = ?, kind = ?, package_id = ?, post_id = ?, listing_id = ?, pay_methods = ?, pay_note = ?, auto_accept = ?, updated_at = ? WHERE id = ?",
    ).bind(fields.title, fields.price_cents, fields.kind, fields.package_id ?? null, fields.post_id ?? null, fields.listing_id ?? null, fields.pay_methods ?? null, fields.pay_note ?? null, fields.auto_accept ? 1 : 0, now, existing.id).run();
    const row = await db.prepare("SELECT * FROM creator_menu_items WHERE id = ? LIMIT 1").bind(existing.id).first();
    return { item: row };
  }
  const r = await db.prepare(
    "INSERT INTO creator_menu_items (profile_id, slot, title, price_cents, kind, package_id, post_id, listing_id, pay_methods, pay_note, auto_accept, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(ownerId, slot, fields.title, fields.price_cents, fields.kind, fields.package_id ?? null, fields.post_id ?? null, fields.listing_id ?? null, fields.pay_methods ?? null, fields.pay_note ?? null, fields.auto_accept ? 1 : 0, now, now).run();
  const row = await db.prepare("SELECT * FROM creator_menu_items WHERE id = ? LIMIT 1").bind(r.meta.last_row_id).first();
  return { item: row };
}

export async function menuPackageRow(db, item) {
  if (!item || !item.package_id) return null;
  try {
    return await db.prepare("SELECT * FROM creator_packages WHERE id = ? LIMIT 1").bind(item.package_id).first();
  } catch { return null; }
}

// --- Vault quotas --------------------------------------------------------

export async function vaultUsedBytes(db, profileId) {
  const r = await db.prepare(
    "SELECT COALESCE(SUM(size_bytes), 0) AS n FROM creator_packages WHERE profile_id = ? AND status IN ('staged', 'listed')",
  ).bind(profileId).first();
  return Number(r?.n || 0);
}

// --- Zip chunks (R2 multipart) -------------------------------------------
// One uploaded chunk arrives as base64 JSON ({ dataBase64, mimeType }).
// Only zip bytes ride this path — the client zips (JSZip) before
// upload, and unzips (JSZip) in "My stuff" on download. No
// server-side zip handling.
export function decodeZipChunk(chunk, maxBytes) {
  if (!chunk || typeof chunk.dataBase64 !== "string" || !chunk.mimeType) return { ok: false, error: "No file data in that chunk." };
  if (!["application/zip", "application/x-zip-compressed"].includes(chunk.mimeType)) return { ok: false, error: "Package chunks must be zip data — zip the files in the browser first." };
  let bytes;
  try {
    const bin = atob(String(chunk.dataBase64).replace(/\s/g, ""));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch { return { ok: false, error: "That chunk couldn't be read — try uploading it again." }; }
  if (bytes.length === 0) return { ok: false, error: "That chunk is empty." };
  if (bytes.length > maxBytes) return { ok: false, error: `That chunk is too big — keep each chunk under ${Math.round(maxBytes / 1048576)} MB.` };
  return { ok: true, bytes, mime: chunk.mimeType };
}

// --- Digital delivery (CS#) ----------------------------------------------
// Is this order a digital sale? A menu/package order always is; a
// listing order is when the listing is digital.
export async function orderIsDigital(db, order) {
  if (!order) return false;
  if (order.menu_item_id || order.package_id) return true;
  if (!order.listing_id) return false;
  try {
    const l = await db.prepare("SELECT listing_type FROM listings WHERE id = ? LIMIT 1").bind(order.listing_id).first();
    return !!(l && l.listing_type === "digital");
  } catch { return false; }
}

// Resolve the content pointers for a digital sale: the menu item's
// post/package when the order came from the menu, else the listing's
// package when it came from a private digital listing. The CS# row is
// what unlocks the buyer's copy in "My stuff" — the pointers are how
// the client finds the post to unblur and the package zip to download.
export async function orderContentPointers(db, order) {
  const ptr = { listingId: order.listing_id || null, postId: null, packageId: order.package_id ?? null, menuItemId: order.menu_item_id ?? null };
  try {
    if (order.menu_item_id) {
      const item = await db.prepare("SELECT * FROM creator_menu_items WHERE id = ? LIMIT 1").bind(order.menu_item_id).first();
      if (item) {
        ptr.postId = item.post_id ?? null;
        if (ptr.packageId == null) ptr.packageId = item.package_id ?? null;
        if (!ptr.listingId) ptr.listingId = item.listing_id ?? null;
      }
    } else if (order.listing_id) {
      const l = await db.prepare("SELECT package_id FROM listings WHERE id = ? LIMIT 1").bind(order.listing_id).first();
      if (l && ptr.packageId == null) ptr.packageId = l.package_id ?? null;
    }
  } catch { /* pointers stay as the order already had them */ }
  return ptr;
}

// Log the CS# sale for a digital order (sequential CS#, buyer IP
// server-side only, watermark text built server-side). Returns
// { isDigital, csNumber, watermarkText }. A missing content_sales
// table just yields csNumber null — the order is still paid.
export async function logDigitalSaleForOrder(db, order, buyerIp, now) {
  const isDigital = await orderIsDigital(db, order);
  if (!isDigital) return { isDigital: false, csNumber: null, watermarkText: "" };
  const ptr = await orderContentPointers(db, order);
  let buyerUsername = "";
  let sellerUsername = "";
  try {
    const b = await db.prepare("SELECT username FROM profiles WHERE id = ? LIMIT 1").bind(order.buyer_id).first();
    if (b) buyerUsername = b.username || "";
    const s = await db.prepare("SELECT username FROM profiles WHERE id = ? LIMIT 1").bind(order.seller_id).first();
    if (s) sellerUsername = s.username || "";
  } catch { /* usernames stay blank — the CS# still logs */ }
  const cs = await createContentSale(db, {
    listingId: ptr.listingId, postId: ptr.postId, packageId: ptr.packageId, menuItemId: ptr.menuItemId,
    buyerId: order.buyer_id, buyerUsername, sellerId: order.seller_id, sellerUsername,
    itemTitle: order.item_title, amountCents: order.amount_cents,
    buyerIp: buyerIp || "", now, digital_asset: true,
  });
  return { isDigital: true, csNumber: cs.csNumber, watermarkText: cs.watermarkText };
}

// --- Paid finalization (shared by /api/checkout/confirm + webhook) ------
// Marks a verified-paid order paid + sold, logs the CS# for digital
// sales, and notifies both sides — exactly the block checkout/confirm
// used to own. Idempotent: an already-paid order returns already:true
// and nothing is written twice. `actor` is the buyer profile for the
// client-return path, null for the webhook (no actor exists there).
// `session` is the verified Stripe session (payment_intent recorded
// when present); pass null for manual mark-paid — but manual orders
// should use markPaidManual below, not this, so the wording stays
// honest about how the money moved.
export async function finalizePaidOrder(db, order, session, buyerIp, actor) {
  const now = nowMs();
  if (order.status === "paid" || order.status === "shipped" || order.status === "delivered") {
    return { already: true, csNumber: null, watermarkText: "", isDigital: false, isPrivate: false };
  }
  await db.prepare("UPDATE orders SET status = 'paid', updated_at = ? WHERE id = ?").bind(now, order.id).run();
  if (order.listing_id) {
    try { await db.prepare("UPDATE listings SET status = 'sold', updated_at = ? WHERE id = ?").bind(now, order.listing_id).run(); } catch { /* listing already gone — order still counts */ }
  }
  if (session && session.payment_intent) {
    try { await db.prepare("UPDATE orders SET stripe_payment_intent_id = ? WHERE id = ?").bind(session.payment_intent, order.id).run(); } catch { /* column not there yet — harmless */ }
  }
  const { isDigital, csNumber, watermarkText } = await logDigitalSaleForOrder(db, order, buyerIp, now);
  // A custom request paid through its order moves requested/accepted → paid.
  try {
    await db.prepare("UPDATE creator_requests SET status = 'paid', updated_at = ? WHERE order_id = ? AND status = 'accepted'").bind(now, order.id).run();
  } catch { /* requests table not there yet — nothing to move */ }
  let isPrivate = false;
  try {
    if (order.listing_id) {
      const l = await db.prepare("SELECT is_private FROM listings WHERE id = ? LIMIT 1").bind(order.listing_id).first();
      isPrivate = !!(l && l.is_private === 1);
    }
  } catch { isPrivate = false; }
  const sellerProfile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(order.seller_id).first();
  const buyerProfile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(order.buyer_id).first();
  const buyerName = (buyerProfile && buyerProfile.username) || "member";
  const sellerName = (sellerProfile && sellerProfile.username) || "member";
  const isMenuOrder = !!(order.menu_item_id || order.package_id);
  if (isMenuOrder || isDigital) {
    await notifyBuyerSeller(db, sellerProfile, actor, "sale",
      "💰 @" + buyerName + " bought your \"" + order.item_title + "\" for " + money(order.amount_cents) + " — payment captured, on its way to your bank on Stripe's payout schedule (typically ~2 business days). Their copy is unlocked in their My stuff.",
      "#/orders", "order", order.id);
    await notifyBuyerSeller(db, buyerProfile, actor, "order",
      "✅ Your order for \"" + order.item_title + "\" is paid — " + money(order.amount_cents) + ". It's in your My stuff now.",
      "#/orders", "order", order.id);
  } else {
    await notifyBuyerSeller(db, sellerProfile, actor, "sale",
      "💰 @" + buyerName + " bought your \"" + order.item_title + "\" for " + money(order.amount_cents) + " — payment captured, on its way to your bank on Stripe's payout schedule (typically ~2 business days).",
      "#/orders", "order", order.id);
    await notifyBuyerSeller(db, buyerProfile, actor, "order",
      "✅ Your order for \"" + order.item_title + "\" is paid — " + money(order.amount_cents) + ". The seller ships it with tracking; tap \"I got it\" when it lands.",
      "#/orders", "order", order.id);
  }
  if (isPrivate) {
    await notifyTeam(db, actor || buyerProfile, "🔒 Private sale: @" + buyerName + " bought \"" + order.item_title + "\" from @" + sellerName + " for " + money(order.amount_cents) + (isDigital ? " (Digital Asset)" : " (physical)") + " — payment captured.", "#/orders", order.id);
  }
  return { already: false, csNumber, watermarkText, isDigital, isPrivate };
}

// Manual mark-paid: the seller/team records that outside money landed
// (Cash App / PayPal / Venmo — the site cannot see it). Same paid
// stamp + digital unlock as a Stripe payment, but the wording says
// plainly it was marked paid by a person, never that Stripe verified
// it. The light flips green with the manual tag.
export async function markOrderPaidManual(db, order, marker, note) {
  const now = nowMs();
  if (order.status === "paid" || order.status === "shipped" || order.status === "delivered") {
    return { already: true, csNumber: null, watermarkText: "", isDigital: false };
  }
  try {
    await db.prepare("UPDATE orders SET status = 'paid', marked_paid_by = ?, marked_paid_at = ?, updated_at = ? WHERE id = ?").bind(marker.id, now, now, order.id).run();
  } catch (e) {
    if (/no such column|no column named/i.test(String((e && e.message) || e))) {
      await db.prepare("UPDATE orders SET status = 'paid', updated_at = ? WHERE id = ?").bind(now, order.id).run();
    } else throw e;
  }
  const { isDigital, csNumber, watermarkText } = await logDigitalSaleForOrder(db, order, "", now);
  // A custom request paid through its order moves accepted → paid
  // (same transition the Stripe path makes in finalizePaidOrder).
  try {
    await db.prepare("UPDATE creator_requests SET status = 'paid', updated_at = ? WHERE order_id = ? AND status = 'accepted'").bind(now, order.id).run();
  } catch { /* requests table not there yet — nothing to move */ }
  const sellerProfile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(order.seller_id).first();
  const buyerProfile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(order.buyer_id).first();
  const cleanNote = String(note || "").trim().slice(0, 140);
  await notifyBuyerSeller(db, buyerProfile, marker, "order",
    "✅ Your order for \"" + order.item_title + "\" (" + money(order.amount_cents) + ") was marked paid" + (cleanNote ? " — " + cleanNote : "") + ". " + (isDigital ? "It's in your My stuff now." : "The seller ships it with tracking; tap \"I got it\" when it lands."),
    "#/orders", "order", order.id);
  if (sellerProfile && sellerProfile.id !== marker.id) {
    await notifyBuyerSeller(db, sellerProfile, marker, "order",
      "✅ @" + marker.username + " marked the \"" + order.item_title + "\" order (" + money(order.amount_cents) + ") paid as manual." + (cleanNote ? " Note: " + cleanNote : ""),
      "#/orders", "order", order.id);
  }
  return { already: false, csNumber, watermarkText, isDigital };
}

// --- Menu buy (shared shape) ---------------------------------------------
// Build a pending_payment order row for a menu item. Price is ALWAYS
// re-read from the DB row — never trusted from the client. listing_id
// is 0 when the item points at a package/post only (orders.listing_id
// is NOT NULL in the base schema, and 0 is the "no listing" sentinel:
// shapeOrder and confirm treat it as "no listing row", never as sold).
export async function insertMenuOrder(db, item, buyerId, paymentMethod) {
  const now = nowMs();
  const listingId = item.listing_id ? Number(item.listing_id) : 0;
  let r;
  try {
    r = await db.prepare(
      "INSERT INTO orders (listing_id, buyer_id, seller_id, item_title, amount_cents, shipping_cents, status, created_at, updated_at, package_id, menu_item_id, payment_method) VALUES (?, ?, ?, ?, ?, 0, 'pending_payment', ?, ?, ?, ?, ?)",
    ).bind(listingId, buyerId, item.profile_id, item.title, item.price_cents, now, now, item.package_id ?? null, item.id, paymentMethod).run();
  } catch (e) {
    if (/no such column|no column named/i.test(String((e && e.message) || e))) {
      throw new Error("MENU_NOT_SETUP");
    }
    throw e;
  }
  return { orderId: r.meta.last_row_id, now };
}

// Start a Stripe Checkout Session for a menu order (destination
// charge, 6% on the item price only). Returns { url, sessionId } or
// { error }. Never uses the catalog's STRIPE_SECRET_KEY — only the
// platform key, exactly like the Flea Market buy path.
export async function startMenuCheckout(env, db, request, order, item, seller) {
  if (!stripePlatformConfigured(env)) {
    return { error: "Card checkout isn't switched on yet — the shop is still setting it up. Nothing was charged." };
  }
  const origin = new URL(request.url).origin;
  const checkout = await createCheckoutSession(env, {
    orderId: order.orderId, listingId: item.listing_id ? Number(item.listing_id) : 0,
    itemName: item.title + " — Rare Candy Reserve",
    amountCents: item.price_cents, shippingCents: 0,
    destinationAccount: seller.connect_account_id,
    digitalAsset: true,
    imageUrl: null,
    successUrl: origin + "/community.html#/orders?checkout=success&session_id={CHECKOUT_SESSION_ID}&order_id=" + order.orderId,
    cancelUrl: origin + "/community.html#/member/" + item.profile_id + "?checkout=cancelled",
  });
  if (checkout.error) return { error: checkout.error };
  try {
    await db.prepare("UPDATE orders SET stripe_session_id = ? WHERE id = ?").bind(checkout.sessionId, order.orderId).run();
  } catch { /* stripe_session_id column not there yet — confirm still works off the session id */ }
  return { url: checkout.url, sessionId: checkout.sessionId };
}

export { platformFeeCents };
