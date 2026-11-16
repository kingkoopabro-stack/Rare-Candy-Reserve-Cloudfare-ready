// GET /api/challenge — getSignupChallenge (tiny math human-check).
import { json, makeChallenge } from "./_lib.js";

export async function onRequestGet() {
  return json(makeChallenge());
}
