// POST /api/packages/:id/upload-part — send one chunk of the
// package zip.
//
// { device_id, upload_id, part_number, chunk: { dataBase64, mimeType } }.
// part_number starts at 1. Each part except the last must be ≥5 MB
// (the R2/S3 multipart rule — enforced at upload-complete, where the
// last part is known); each part here is capped at 32 MB so one JSON
// request stays well under the Functions body limit. Parts are
// recorded in package_uploads (part_number + etag + size) so
// upload-complete can verify the set before completing. Re-sending
// a part number replaces the earlier attempt.
import { json, noDb, getDb, readJson, profileByDevice, isOperator } from "../../_lib.js";
import { CREATOR_NOT_SETUP_MSG, R2_PART_MAX_BYTES, decodeZipChunk } from "../../_creator.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, etag: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your account first.");
  const id = Number(params.id);
  const uploadId = String(a.upload_id || "").trim();
  if (!uploadId) return fail("Start the upload first — no upload id on this chunk.");
  const partNumber = Number(a.part_number || 0);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) return fail("Part number needs to be 1 or higher.");
  let up = null;
  try {
    up = await db.prepare("SELECT * FROM package_uploads WHERE upload_id = ? LIMIT 1").bind(uploadId).first();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail(CREATOR_NOT_SETUP_MSG);
    throw e;
  }
  if (!up || up.package_id !== id) return fail("That upload isn't for this package — start a fresh upload.");
  if (up.profile_id !== me.id && !isOperator(env, me)) return fail("That upload isn't yours.");
  const dec = decodeZipChunk(a.chunk, R2_PART_MAX_BYTES);
  if (!dec.ok) return fail(dec.error);
  if (!env.IMAGES || typeof env.IMAGES.uploadPart !== "function") {
    return fail("Package uploads aren't switched on yet — multipart upload isn't available on this storage binding.");
  }
  let res;
  try {
    res = await env.IMAGES.uploadPart(up.r2_key, uploadId, partNumber, dec.bytes);
  } catch (e) {
    return fail("That chunk didn't land — try sending it again.");
  }
  let parts = [];
  try { parts = JSON.parse(up.parts_json || "[]"); } catch { parts = []; }
  if (!Array.isArray(parts)) parts = [];
  parts = parts.filter((p) => p.part_number !== partNumber);
  parts.push({ part_number: partNumber, etag: String(res.etag || ""), size: dec.bytes.length });
  parts.sort((x, y) => x.part_number - y.part_number);
  await db.prepare("UPDATE package_uploads SET parts_json = ? WHERE upload_id = ?").bind(JSON.stringify(parts), uploadId).run();
  return json({ ok: true, error: null, etag: String(res.etag || ""), part_number: partNumber, size: dec.bytes.length });
}
