// POST /api/card-check — verifyCardImage. Runs an AI vision check on a
// card photo: real-or-fake first look PLUS a price look. FOR ENTERTAINMENT /
// INFORMATIONAL USE ONLY: every price is an AI estimate, NOT live
// sold-listing data and NOT a professional grade or authentication.
//
// WIRING NOTE: the vision check needs the Workers AI binding (env.AI).
// If it is not bound, this endpoint answers honestly that the check isn't
// available yet — it never invents a verdict. On the website the
// community's real-sales price chart (Card Check corner) is the live data;
// the AI check is advisory only and the community votes decide. Trade
// listings stay gated until a completed check exists.
import { json, noDb, getDb, readJson } from "./_lib.js";

const EMPTY = { card_name: "", set_info: "", estimated_grade: "", raw_price: "", graded_price: "", price_notes: "" };

export async function onRequestPost({ env, request }) {
  // DB not required for the check itself, but keep the setup-state contract.
  if (!getDb(env)) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, status: "not_checked", summary: "", signs: [], ...EMPTY });
  const img = a.image || {};
  if (img.mimeType !== "image/jpeg" && img.mimeType !== "image/png") {
    return fail("Use a JPG or PNG photo for the check.");
  }
  if (!env.AI) {
    return fail("The AI check isn't connected on the website yet — post the card in Card Check and let the community vote. The price chart there is built from real reported sales.");
  }
  try {
    // Workers AI vision (llava) — text answer, parsed for a status line.
    const out = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
      image: img.dataBase64,
      prompt: `Look at this trading card photo and answer in short lines, one per line:
STATUS: one of looks_consistent, suspicious, likely_fake_or_proxy, needs_clearer_photo
SUMMARY: one sentence on what you see (centering, print quality, holo pattern, fonts, set symbols, borders, colors).
SIGNS: up to 4 short things you actually see, separated by " | "
CARD: the card name, set and number if you can identify it, or "unknown"
GRADE: a likely grade estimate (e.g. "around PSA 8") or "can't judge from one photo"
RAW: a raw/loose selling-price range (e.g. "$12-$18") or "can't price an unidentified card"
GRADED: a graded selling-price range at that estimated grade, or "can't price an unidentified card"
NOTE: remind the reader these are AI estimates for entertainment/informational use only — not live sold-listing data, not a professional grade.
Context from the owner: ${(a.context || "none").slice(0, 300)}`,
      max_tokens: 512,
    });
    const text = String(out?.response || out?.description || "");
    const pick = (label) => {
      const m = text.match(new RegExp(`${label}:\\s*([^\\n]+)`, "i"));
      return m ? m[1].trim() : "";
    };
    const statusRaw = pick("STATUS").toLowerCase();
    const status = ["looks_consistent", "suspicious", "likely_fake_or_proxy", "needs_clearer_photo"].includes(statusRaw) ? statusRaw : "needs_clearer_photo";
    const signs = pick("SIGNS").split("|").map((s) => s.trim()).filter(Boolean).slice(0, 4);
    return json({
      ok: true, error: null, status,
      summary: pick("SUMMARY"), signs,
      card_name: pick("CARD"), set_info: pick("CARD"),
      estimated_grade: pick("GRADE"), raw_price: pick("RAW"),
      graded_price: pick("GRADED"), price_notes: pick("NOTE"),
    });
  } catch {
    return fail("The AI check could not run on that photo. You can still post it for community votes.");
  }
}
