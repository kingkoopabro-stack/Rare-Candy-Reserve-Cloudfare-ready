// Shared Stripe helper for the Flea Market platform flow — destination
// charges to sellers' Connect Express accounts, with the 6% platform
// cut as application_fee_amount. This is NOT the operator catalog's
// restricted key (STRIPE_SECRET_KEY — Prices + Payment Links only).
// The platform key lives ONLY in the Cloudflare Pages env var
// STRIPE_PLATFORM_KEY: a secret key with Connect + Checkout Sessions
// permissions, created by Chris in the Stripe Dashboard. No key in
// code, ever. Until the key is set, every call below answers
// "not configured" and the buy/offer/connect flows fail plainly
// instead of taking money they can't route.
import { PLATFORM_FEE_PERCENT } from "./_lib.js";

const STRIPE_API = "https://api.stripe.com/v1";

export function stripePlatformConfigured(env) {
  return Boolean(env && env.STRIPE_PLATFORM_KEY);
}

// The 6% street cut, on the ITEM PRICE ONLY — never on shipping or tax.
export function platformFeeCents(amountCents) {
  return Math.round((Number(amountCents) || 0) * (PLATFORM_FEE_PERCENT / 100));
}

// One Stripe API call. Returns { ok, data } or { ok: false, error }
// with Stripe's own message, plain. Single attempt, 15s timeout.
export async function stripePlatformCall(env, method, path, params, idemKey) {
  const key = env.STRIPE_PLATFORM_KEY;
  if (!key) return { ok: false, error: "Stripe checkout isn't switched on yet — the shop is still setting it up. Nothing was charged." };
  let res;
  try {
    const headers = { authorization: "Bearer " + key, "content-type": "application/x-www-form-urlencoded" };
    if (idemKey) headers["idempotency-key"] = idemKey;
    const init = { method, headers, signal: AbortSignal.timeout(15000) };
    if (params) init.body = new URLSearchParams(params);
    res = await fetch(STRIPE_API + path, init);
  } catch (e) {
    return { ok: false, error: "Couldn't reach Stripe — nothing was charged. Try again in a bit." };
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || ("Stripe returned an error (" + res.status + ").");
    return { ok: false, error: msg };
  }
  return { ok: true, data };
}

// Create a Checkout Session for a Flea Market purchase — destination
// charge: the money lands in the seller's Connect account, minus the
// 6% platform cut (application_fee_amount) and Stripe's own processing
// fee. Payment is captured at checkout. Returns { url, sessionId }.
// Digital sales carry the "Digital Asset" label in the product name
// (and no shipping, no sales tax — digital downloads aren't taxable
// in FL). When STRIPE_TAX_ENABLED=1 (the tax build's flag), Stripe Tax
// runs on the session; the digital-goods tax code itself is a
// Stripe-Dashboard setting Chris confirms before flipping the flag.
// opts.imageUrl (absolute) puts the item's photo on the checkout page.
export async function createCheckoutSession(env, opts) {
  const fee = platformFeeCents(opts.amountCents);
  const itemName = opts.digitalAsset ? opts.itemName + " — Digital Asset" : opts.itemName;
  const params = {
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": itemName,
    "line_items[0][price_data][unit_amount]": String(opts.amountCents),
    "line_items[0][quantity]": "1",
    "payment_intent_data[transfer_data][destination]": opts.destinationAccount,
    "payment_intent_data[application_fee_amount]": String(fee),
    "metadata[order_id]": String(opts.orderId),
    "metadata[listing_id]": String(opts.listingId),
    "metadata[digital_asset]": opts.digitalAsset ? "1" : "0",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  };
  if (opts.imageUrl) params["line_items[0][price_data][product_data][images][0]"] = opts.imageUrl;
  if (String(env.STRIPE_TAX_ENABLED || "") === "1") params["automatic_tax[enabled]"] = "true";
  if (opts.shippingCents > 0) {
    params["line_items[1][price_data][currency]"] = "usd";
    params["line_items[1][price_data][product_data][name]"] = "Shipping";
    params["line_items[1][price_data][unit_amount]"] = String(opts.shippingCents);
    params["line_items[1][quantity]"] = "1";
  }
  const res = await stripePlatformCall(env, "POST", "/checkout/sessions", params, "rcr-checkout-" + opts.orderId);
  if (!res.ok) return { error: res.error };
  return { url: res.data.url, sessionId: res.data.id };
}

// Stripe webhook signature check (creator menu, 2026-11-21). The
// webhook endpoint reads the RAW body and verifies the
// `Stripe-Signature` header (t + v1 HMAC-SHA256 with
// STRIPE_WEBHOOK_SECRET) before trusting anything in the payload —
// an unverified request must never mark an order paid. ~5 minute
// tolerance on the timestamp, same as Stripe's own libraries.
// Returns true only when a v1 signature matches.
export async function verifyStripeWebhookSignature(rawBody, header, secret) {
  if (!secret || !header || !rawBody) return false;
  const parts = String(header).split(",");
  let t = 0;
  const v1s = [];
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    if (k === "t") t = Number(v) || 0;
    if (k === "v1" && v) v1s.push(v);
  }
  if (!t || !v1s.length) return false;
  if (Math.abs(Date.now() / 1000 - t) > 300) return false;
  let hex = "";
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + rawBody));
    hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return false; }
  // Constant-time-ish compare per candidate (length first, then every char).
  for (const cand of v1s) {
    if (cand.length !== hex.length) continue;
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ cand.charCodeAt(i);
    if (diff === 0) return true;
  }
  return false;
}

// Charge a saved card off-session (offer accepted). The payment method
// must already be attached to the buyer's Stripe Customer — see
// offer.js, which attaches it at offer time. Returns the PaymentIntent
// or { error }.
export async function chargeSavedCard(env, opts) {
  const fee = platformFeeCents(opts.amountCents);
  const params = {
    amount: String(opts.amountCents + (opts.shippingCents || 0)),
    currency: "usd",
    customer: opts.customerId,
    payment_method: opts.paymentMethodId,
    off_session: "true",
    confirm: "true",
    "transfer_data[destination]": opts.destinationAccount,
    application_fee_amount: String(fee),
    description: opts.description,
    "metadata[order_id]": String(opts.orderId),
    "metadata[listing_id]": String(opts.listingId),
  };
  const res = await stripePlatformCall(env, "POST", "/payment_intents", params, "rcr-offer-charge-" + opts.orderId);
  if (!res.ok) return { error: res.error };
  if (res.data.status !== "succeeded") {
    return { error: "The charge didn't go through (" + (res.data.status || "unknown") + ") — the card wasn't charged. The seller can try again, or the buyer can pay by card at checkout." };
  }
  return { paymentIntentId: res.data.id };
}
