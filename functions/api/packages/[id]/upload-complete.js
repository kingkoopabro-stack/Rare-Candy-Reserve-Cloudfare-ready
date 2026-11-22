// POST /api/packages/:id/upload-complete — finish a chunked
// multipart upload.
//
// { device_id, upload_id, parts: [{ part_number, etag }],
//   file_count?, contents_summary? }. Verifies the part set against
// the recorded parts (same numbers + etags), enforces the R2/S3 rule
// that every part except the last is ≥5 MB, re-checks the 1 GB
// package cap and the 10 GB vault cap on the ACTUAL bytes, then
// completes the multipart upload in R2 and points the package at the
// zip. file_count + contents_summary (a JSON object, e.g.
// {"photos":12,"videos":1,"tags":["goth"]}) come from the client —
// the server never unzips the package to count its files. The zip
// is stored as-is; the buyer unzips it client-side (JSZip) in
// "My stuff".
import { json, noDb, getDb, readJson, profileByDevice, nowMs, isOperator } from "../../_lib.js";
import {
  CREATOR_NOT_SETUP_MSG, PACKAGE_MAX_BYTES, VAULT_MAX_BYTES,
  R2_MULTIPART_MIN_BYTES, vaultUsedBytes,
} from "../../_creator.js";

function cleanContentsSummary(input) {
  if (input == null) return null;
  if (typeof input === "string") {
    try { const p = JSON.parse(input); return (p && typeof p === "object" && !Array.isArray(p)) ? p : null; } catch { return null; }
  }
  if (typeof input === "object" && !Array.isArray(input)) return input;
  return null;
}

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, package: null });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your account first.");
  const id = Number(params.id);
  const uploadId = String(a.upload_id || "").trim();
  if (!uploadId) return fail("Start the upload first — no upload id to complete.");
  let up = null;
  let pkg = null;
  try {
    up = await db.prepare("SELECT * FROM package_uploads WHERE upload_id = ? LIMIT 1").bind(uploadId).first();
    pkg = await db.prepare("SELECT * FROM creator_packages WHERE id = ? LIMIT 1").bind(id).first();
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail(CREATOR_NOT_SETUP_MSG);
    throw e;
  }
  if (!up || up.package_id !== id) return fail("That upload isn't for this package — start a fresh upload.");
  if (!pkg) return fail("That package is gone.");
  if (up.profile_id !== me.id && !isOperator(env, me)) return fail("That upload isn't yours.");
  const sent = Array.isArray(a.parts) ? a.parts : [];
  if (!sent.length) return fail("Send the list of uploaded parts to complete.");
  let recorded = [];
  try { recorded = JSON.parse(up.parts_json || "[]"); } catch { recorded = []; }
  if (!Array.isArray(recorded) || !recorded.length) return fail("No chunks landed for this upload yet — send the parts first.");
  const byNum = new Map(recorded.map((p) => [Number(p.part_number), p]));
  const parts = [];
  for (const p of sent) {
    const n = Number(p.part_number || 0);
    const rec = byNum.get(n);
    if (!rec || String(p.etag || "") !== String(rec.etag || "")) {
      return fail(`Part ${n} doesn't match what landed — re-send that chunk and try again.`);
    }
    parts.push({ partNumber: n, etag: String(rec.etag) });
  }
  parts.sort((x, y) => x.partNumber - y.partNumber);
  if (parts.length !== recorded.length) return fail("The part list doesn't cover every chunk that landed — send all of them.");
  // R2/S3 multipart rule: every part except the last must be ≥5 MB.
  const lastNum = parts[parts.length - 1].partNumber;
  for (const rec of recorded) {
    if (Number(rec.part_number) !== lastNum && Number(rec.size || 0) < R2_MULTIPART_MIN_BYTES) {
      try { await env.IMAGES.abortMultipartUpload(up.r2_key, uploadId); } catch { /* already gone */ }
      await db.prepare("DELETE FROM package_uploads WHERE upload_id = ?").bind(uploadId).run();
      return fail("One of the middle chunks is under 5 MB — R2 needs 5 MB or more per chunk except the last. Re-upload with bigger chunks.");
    }
  }
  const totalBytes = recorded.reduce((s, p) => s + Number(p.size || 0), 0);
  if (totalBytes <= 0) return fail("That upload is empty.");
  if (totalBytes > PACKAGE_MAX_BYTES) {
    try { await env.IMAGES.abortMultipartUpload(up.r2_key, uploadId); } catch { /* already gone */ }
    await db.prepare("DELETE FROM package_uploads WHERE upload_id = ?").bind(uploadId).run();
    return fail("That package is over 1 GB — split it into two packages.");
  }
  try {
    const used = await vaultUsedBytes(db, pkg.profile_id);
    if (used - Number(pkg.size_bytes || 0) + totalBytes > VAULT_MAX_BYTES) {
      try { await env.IMAGES.abortMultipartUpload(up.r2_key, uploadId); } catch { /* already gone */ }
      await db.prepare("DELETE FROM package_uploads WHERE upload_id = ?").bind(uploadId).run();
      return fail("That would put your vault over 10 GB — delete or unlist a package to make room.");
    }
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) return fail(CREATOR_NOT_SETUP_MSG);
    throw e;
  }
  if (!env.IMAGES || typeof env.IMAGES.completeMultipartUpload !== "function") {
    return fail("Package uploads aren't switched on yet — multipart upload isn't available on this storage binding.");
  }
  try {
    await env.IMAGES.completeMultipartUpload(up.r2_key, uploadId, parts);
  } catch (e) {
    try { await env.IMAGES.abortMultipartUpload(up.r2_key, uploadId); } catch { /* already gone */ }
    return fail("Couldn't finish the upload — the chunks are still there, try completing it again.");
  }
  const fileCount = Number.isInteger(a.file_count) ? Math.max(0, Math.min(a.file_count, 10000)) : Number(pkg.file_count || 0);
  const contents = cleanContentsSummary(a.contents_summary);
  const now = nowMs();
  await db.prepare(
    "UPDATE creator_packages SET zip_key = ?, size_bytes = ?, file_count = ?, contents_summary = ?, updated_at = ? WHERE id = ?",
  ).bind(
    up.r2_key, totalBytes, fileCount,
    contents ? JSON.stringify(contents).slice(0, 2000) : (pkg.contents_summary || "{}"),
    now, id,
  ).run();
  await db.prepare("DELETE FROM package_uploads WHERE upload_id = ?").bind(uploadId).run();
  const row = await db.prepare("SELECT * FROM creator_packages WHERE id = ? LIMIT 1").bind(id).first();
  let summary = null;
  try { summary = row.contents_summary ? JSON.parse(row.contents_summary) : null; } catch { summary = null; }
  return json({
    ok: true, error: null,
    package: {
      id: row.id, profile_id: row.profile_id, title: row.title ?? "", genre: row.genre ?? "",
      kind: row.kind ?? "existing", status: row.status ?? "staged",
      zip_ready: !!row.zip_key, size_bytes: row.size_bytes ?? 0, file_count: row.file_count ?? 0,
      contents_summary: summary, updated_at: row.updated_at,
    },
  });
}
