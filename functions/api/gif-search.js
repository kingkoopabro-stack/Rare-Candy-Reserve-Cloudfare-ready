import { json } from "./_lib.js";
const GIPHY_SEARCH = "https://api.giphy.com/v1/gifs/search";
export async function onRequestGet({ env, request }) {
  const key = String((env && env.GIPHY_API_KEY) || "").trim();
  if (!key) {
    return json({ ok: false, configured: false, error: "GIF search isn't set up yet — add GIPHY_API_KEY first." });
  }
  const params = new URL(request.url).searchParams;
  const term = String(params.get("q") || "").trim().slice(0, 50);
  if (term.length < 2) return json({ ok: false, error: "Type at least 2 letters to search GIFs." });
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "12", 10) || 12, 1), 12);
  const url = GIPHY_SEARCH + "?api_key=" + encodeURIComponent(key) + "&q=" + encodeURIComponent(term) + "&limit=" + limit + "&rating=pg-13&lang=en&bundle=messaging_non_clips";
  let res;
  try {
    res = await fetch(url, { headers: { "user-agent": "RareCandyReserve/1.0 (gif-search)" }, signal: AbortSignal.timeout(10000) });
  } catch (e) {
    return json({ ok: false, error: "Couldn't reach Giphy — check your connection and try again." });
  }
  if (res.status === 429) return json({ ok: false, rate_limited: true, error: "Too many GIF searches right now — try again in a bit." });
  if (res.status === 401 || res.status === 403) return json({ ok: false, error: "GIF search key isn't working — Chris needs to check the Giphy key." });
  if (!res.ok) return json({ ok: false, error: "GIF search didn't answer — try again." });
  let body = null;
  try { body = await res.json(); } catch (e) { return json({ ok: false, error: "GIF search gave a bad answer — try again." }); }
  const gifs = (body && Array.isArray(body.data) ? body.data : []).map(function (g) {
    const id = String((g && g.id) || "").trim();
    if (!/^[A-Za-z0-9]+$/.test(id)) return null;
    const imgs = (g && g.images) || {};
    const small = imgs.fixed_width_small || imgs.fixed_width || {};
    const preview = typeof small.url === "string" && /^https:\/\//i.test(small.url) ? small.url : "";
    const page = typeof g.url === "string" && /^https:\/\/giphy\.com\//i.test(g.url) ? g.url : "";
    return { id: id, label: String((g && g.title) || "GIF").slice(0, 80) || "GIF", url: "https://media.giphy.com/media/" + id + "/giphy.gif", preview: preview || ("https://media.giphy.com/media/" + id + "/giphy.gif"), pageUrl: page };
  }).filter(Boolean).slice(0, limit);
  return json({ ok: true, configured: true, gifs: gifs });
}
