// POST /api/packages/:id/upload-start — begin a chunked multipart
// upload of the package zip into R2 (dwc-images, `packages/` prefix).
//
// { device_id, filename, size_bytes }. The filename must be a .zip
// (the client zips with JSZip before upload — the server never zips
// or unzips). Caps enforced here, before any bytes move: 1 GB per
// package, 10 GB per-creator vault (staged + listed). Returns
// { upload_id, part_min_bytes }: parts must be ≥5 MB except the last
// (the R2/S3 multipart rule) — the client chunks accordingly.
// The R2 multipart upload id + the recorded parts live in
// package_uploads until upload-complete.
import { json, noDb, getDb, readJson, profileByDevice, nowMs, isOperator } from "../../_lib.js";
import {
  CREATOR_NOT_SETUP_MSG, PACKAGE_MAX_BYTES, VAULT_MAX_BYTES,
  R2_MULTIPART_MIN_BYTES, creatorSalesGate, vaultUsedBytes,
} from "../../_creator.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, upload_id: null });
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
  if (pkg.status === "listed") return fail("That package is listed — unlist it first, then upload a new version.");
  const filename = String(a.filename || "").trim().slice(0, 120);
  if (!filename.toLowerCase().endsWith(".zip") || filename.length < 5) return fail("Upload a .zip file — zip the package in the browser first.");
  const sizeBytes = Math.round(Number(a.size_bytes) || 0);
  if (sizeBytes <= 0) return fail("Say how big the zip is before uploading.");
  if (sizeBytes > PACKAGE_MAX_BYTES) return fail("That package is over 1 GB — split it into two packages.");
  let used = 0;
  try {
    used = await vaultUsedBytes(db, pkg.profile_id);
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail(CREATOR_NOT_SETUP_MSG);
    throw e;
  }
  // The package's own current size doesn't count twice on re-upload.
  const currentSize = Number(pkg.size_bytes || 0);
  if (used - currentSize + sizeBytes > VAULT_MAX_BYTES) {
    return fail("That would put your vault over 10 GB — delete or unlist a package to make room.");
  }
  if (!env.IMAGES) return fail("File storage isn't connected yet — the shop is still setting up community file storage.");
  if (typeof env.IMAGES.createMultipartUpload !== "function") {
    return fail("Package uploads aren't switched on yet — multipart upload isn't available on this storage binding.");
  }
  const key = `packages/${pkg.profile_id}-${pkg.id}-${Date.now()}.zip`;
  let upload;
  try {
    upload = await env.IMAGES.createMultipartUpload(key, { httpMetadata: { contentType: "application/zip" } });
  } catch (e) {
    return fail("Couldn't start the upload — try again in a bit.");
  }
  const now = nowMs();
  try {
    await db.prepare(
      "INSERT INTO package_uploads (upload_id, package_id, profile_id, r2_key, filename, size_bytes, parts_json, created_at) VALUES (?, ?, ?, ?, ?, ?, '[]', ?)",
    ).bind(String(upload.uploadId), pkg.id, pkg.profile_id, key, filename, sizeBytes, now).run();
  } catch (e) {
    try { await env.IMAGES.abortMultipartUpload(key, String(upload.uploadId)); } catch { /* already gone */ }
    if (/no such table/i.test(String((e && e.message) || e))) return fail(CREATOR_NOT_SETUP_MSG);
    throw e;
  }
  return json({ ok: true, error: null, upload_id: String(upload.uploadId), key, part_min_bytes: R2_MULTIPART_MIN_BYTES, package_max_bytes: PACKAGE_MAX_BYTES });
}
