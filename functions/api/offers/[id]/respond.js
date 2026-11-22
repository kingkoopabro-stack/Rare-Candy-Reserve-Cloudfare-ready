// POST /api/offers/:id/respond — answer an offer. Actions:
//   accept — seller accepts a buyer's open offer, or buyer accepts a
//     seller's counter. If the buyer saved a card with the offer, the
//     card is charged automatically right now (off-session, destination
//     charge to the seller's Connect account, 6% cut). Without a saved
//     card, the order is recorded as pending_payment and the buyer gets
//     a Checkout link to pay — no charge until they pay. Either way the
//     listing is marked sold only once money is captured.
//   decline — seller declines an offer, or buyer declines a counter.
//     Nothing is ever charged.
//   counter — seller only, on a buyer's open offer. Names a new price;
//     the buyer then accepts or declines the counter. The original
//     offer is replaced, not revived.
import { json, noDb, getDb, readJson, profileByDevice, nowMs, notifyBuyerSeller, notifyTeam, money, createContentSale, imageUrl } from "../../_lib.js";
import { stripePlatformConfigured, stripePlatformCall, createCheckoutSession, chargeSavedCard } from "../../_stripe.js";

const OFFER_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, order_id: null, checkout_url: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your account first.");
  const id = Number(params.id);
  const action = String(a.action || "");
  let offer;
  try {
    offer = await db.prepare("SELECT * FROM listing_offers WHERE id = ? LIMIT 1").bind(id).first();
  } catch {
    return fail("Offers aren't switched on yet — the shop is still running a quick database update. Try again in a bit.");
  }
  if (!offer) return fail("That offer is gone.");
  const l = await db.prepare("SELECT * FROM listings WHERE id = ? LIMIT 1").bind(offer.listing_id).first();
  if (!l) return fail("That listing is gone.");
  if (offer.status !== "open") return fail("That offer is already " + offer.status + ".");
  if (offer.expires_at && offer.expires_at < nowMs()) {
    await db.prepare("UPDATE listing_offers SET status = 'expired', updated_at = ? WHERE id = ?").bind(nowMs(), id).run();
    return fail("That offer expired — offers last 3 days. Make a fresh one.");
  }
  const isCounter = !!offer.parent_offer_id;
  const now = nowMs();

  if (action === "counter") {
    if (isCounter) return fail("You can't counter a counter — accept it, decline it, or make a fresh offer.");
    if (offer.seller_id !== me.id) return fail("Only the seller counters an offer.");
    const amount = Math.round(Number(a.amount_cents) || 0);
    if (amount <= 0) return fail("Counter with an amount above $0.");
    if (amount >= l.price_cents) return fail("A counter at or above the listed price makes no sense — the buyer can just buy it.");
    if (amount === offer.amount_cents) return fail("That's the same as their offer — accept it instead.");
    await db.prepare("UPDATE listing_offers SET status = 'countered', updated_at = ? WHERE id = ?").bind(now, id).run();
    const r = await db.prepare(
      "INSERT INTO listing_offers (listing_id, buyer_id, seller_id, amount_cents, status, payment_method_id, message, parent_offer_id, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)",
    ).bind(offer.listing_id, offer.buyer_id, offer.seller_id, amount, offer.payment_method_id || "", "", id, now, now, now + OFFER_TTL_MS).run();
    const buyerProfile = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(offer.buyer_id).first();
    await notifyBuyerSeller(db, buyerProfile, me, "offer",
      "🤝 @" + me.username + " countered your offer on \"" + l.title + "\" at " + money(amount) + " (you offered " + money(offer.amount_cents) + "). Accept or decline it from the listing — nothing is charged unless you accept.",
      "#/listing/" + l.id, "offer", r.meta.last_row_id);
    return json({ ok: true, error: null, offer_id: r.meta.last_row_id, action: "countered" });
  }

  if (action === "decline") {
    const allowed = isCounter ? offer.buyer_id === me.id : offer.seller_id === me.id;
    if (!allowed) return fail(isCounter ? "Only the buyer declines a counter." : "Only the seller declines an offer.");
    await db.prepare("UPDATE listing_offers SET status = 'declined', updated_at = ? WHERE id = ?").bind(now, id).run();
    const otherId = isCounter ? offer.seller_id : offer.buyer_id;
    const other = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(otherId).first();
    await notifyBuyerSeller(db, other, me, "offer",
      (isCounter ? "🤝 @" + me.username + " declined your counter of " + money(offer.amount_cents) + " on \"" + l.title + "\"." : "🤝 @" + me.username + " declined your offer of " + money(offer.amount_cents) + " on \"" + l.title + "\".") + " Nothing was charged.",
      "#/listing/" + l.id, "offer", id);
    return json({ ok: true, error: null, action: "declined" });
  }

  if (action === "accept") {
    const allowed = isCounter ? offer.buyer_id === me.id : offer.seller_id === me.id;
    if (!allowed) return fail(isCounter ? "Only the buyer accepts a counter." : "Only the seller accepts an offer.");
    if (l.status !== "active") return fail("That item already sold.");
    const seller = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(offer.seller_id).first();
    if (!seller || !seller.connect_account_id) {
      return fail("The seller hasn't linked their bank yet, so the payment can't run — the offer waits until they do. Nothing was charged.");
    }
    const buyer = await db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").bind(offer.buyer_id).first();
    const listingType = l.listing_type ?? "physical";
    const shipCents = listingType === "digital" ? 0 : Math.round(Number(l.shipping_cents) || 0);
    const amount = offer.amount_cents;
    const isDigital = listingType === "digital";
    const isPrivate = l.is_private === 1;
    // Path 1 — the buyer saved a card with the offer: charge it now.
    if (offer.payment_method_id && buyer && buyer.stripe_customer_id && stripePlatformConfigured(env)) {
      const charge = await chargeSavedCard(env, {
        orderId: "offer-" + id + "-" + now, listingId: l.id,
        customerId: buyer.stripe_customer_id, paymentMethodId: offer.payment_method_id,
        amountCents: amount, shippingCents: shipCents,
        destinationAccount: seller.connect_account_id,
        description: l.title + (isDigital ? " — Digital Asset" : "") + " — Rare Candy Reserve (accepted offer)",
      });
      if (charge.error) return fail(charge.error);
      let r;
      try {
        r = await db.prepare(
          "INSERT INTO orders (listing_id, buyer_id, seller_id, item_title, amount_cents, shipping_cents, status, offer_id, stripe_payment_intent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?)",
        ).bind(l.id, offer.buyer_id, offer.seller_id, l.title, amount, shipCents, id, charge.paymentIntentId, now, now).run();
      } catch (e) {
        if (/no such column/i.test(String((e && e.message) || e))) {
          r = await db.prepare(
            "INSERT INTO orders (listing_id, buyer_id, seller_id, item_title, amount_cents, shipping_cents, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?)",
          ).bind(l.id, offer.buyer_id, offer.seller_id, l.title, amount, shipCents, now, now).run();
        } else throw e;
      }
      const orderId = r.meta.last_row_id;
      await db.prepare("UPDATE listings SET status = 'sold', updated_at = ? WHERE id = ?").bind(now, l.id).run();
      await db.prepare("UPDATE listing_offers SET status = 'accepted', updated_at = ? WHERE id = ?").bind(now, id).run();
      if (listingType === "digital") {
        await createContentSale(db, { listingId: l.id, buyerId: offer.buyer_id, buyerUsername: buyer.username, sellerId: offer.seller_id, sellerUsername: seller.username, itemTitle: l.title, amountCents: amount, buyerIp: request.headers.get("cf-connecting-ip") || "", now, digital_asset: true });
      }
      await notifyBuyerSeller(db, buyer, me, "order",
        "✅ Your offer of " + money(amount) + " for \"" + l.title + "\" was accepted — your saved card was charged, payment captured, on its way to the seller's bank. The seller ships it with tracking; tap \"I got it\" when it lands.",
        "#/orders", "order", orderId);
      await notifyBuyerSeller(db, seller, me, "sale",
        "💰 You accepted @" + buyer.username + "'s offer of " + money(amount) + " for \"" + l.title + "\" — payment captured, on its way to your bank on Stripe's payout schedule (typically ~2 business days).",
        "#/orders", "order", orderId);
      // Private sale — the operator hears about every one, same as a
      // Flea Market sale.
      if (isPrivate) {
        await notifyTeam(db, me, "🔒 Private sale: @" + buyer.username + " bought \"" + l.title + "\" from @" + seller.username + " for " + money(amount) + (isDigital ? " (Digital Asset)" : " (physical)") + " — accepted offer, card charged.", "#/orders", orderId);
      }
      return json({ ok: true, error: null, order_id: orderId, action: "accepted", charged: true });
    }
    // Path 2 — no saved card (or Stripe not wired): record the order as
    // pending_payment and send the buyer a Checkout link. Nothing is
    // charged until the buyer pays there.
    if (!stripePlatformConfigured(env)) {
      return fail("Card checkout isn't switched on yet, so the accepted offer can't be paid — the shop is still setting it up. The offer stays open.");
    }
    let r2;
    try {
      r2 = await db.prepare(
        "INSERT INTO orders (listing_id, buyer_id, seller_id, item_title, amount_cents, shipping_cents, status, offer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?)",
      ).bind(l.id, offer.buyer_id, offer.seller_id, l.title, amount, shipCents, id, now, now).run();
    } catch (e) {
      if (/no such column/i.test(String((e && e.message) || e))) {
        r2 = await db.prepare(
          "INSERT INTO orders (listing_id, buyer_id, seller_id, item_title, amount_cents, shipping_cents, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?)",
        ).bind(l.id, offer.buyer_id, offer.seller_id, l.title, amount, shipCents, now, now).run();
      } else throw e;
    }
    const orderId2 = r2.meta.last_row_id;
    const origin = new URL(request.url).origin;
    const checkout = await createCheckoutSession(env, {
      orderId: orderId2, listingId: l.id, itemName: l.title + " — Rare Candy Reserve (accepted offer)",
      amountCents: amount, shippingCents: shipCents,
      destinationAccount: seller.connect_account_id,
      digitalAsset: isDigital,
      imageUrl: l.image_blob_key ? origin + imageUrl(l.image_blob_key) : null,
      successUrl: origin + "/community.html#/orders?checkout=success&session_id={CHECKOUT_SESSION_ID}&order_id=" + orderId2,
      cancelUrl: origin + "/community.html#/listing/" + l.id + "?checkout=cancelled",
    });
    if (checkout.error) return fail(checkout.error);
    try {
      await db.prepare("UPDATE orders SET stripe_session_id = ? WHERE id = ?").bind(checkout.sessionId, orderId2).run();
    } catch { /* column not there yet */ }
    await db.prepare("UPDATE listing_offers SET status = 'accepted', updated_at = ? WHERE id = ?").bind(now, id).run();
    await notifyBuyerSeller(db, buyer, me, "offer",
      "✅ Your offer of " + money(amount) + " for \"" + l.title + "\" was accepted! Pay by card to finish it — nothing is charged until you pay.",
      "#/orders", "offer", id);
    return json({ ok: true, error: null, order_id: orderId2, checkout_url: checkout.url, action: "accepted", charged: false });
  }

  return fail("Pick accept, decline, or counter.");
}
