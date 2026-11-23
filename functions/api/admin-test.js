// 18+ TEST MODE (Build 5, 2026-11-23) — operator only, server-enforced.
// A sandbox test member lets the operator run the 18+ upload + age-gating
// flow end-to-end WITHOUT touching a real member or a real 18+ photo.
//   GET  /api/admin-test?device_id= — list test members + their counts.
//   POST /api/admin-test — actions, all operator-only:
//     create-test-member  — inserts a member with is_test=1, a generated
//                           device id, and no real personal data. The
//                           device id is returned so the test panel can
//                           call the real endpoints AS that member.
//     verify-test-member  — sets age_verified=1 on a TEST member only.
//                           This is a test action, not a toggle: real
//                           members still get age_verified ONLY through
//                           the operator's ID decision (decide.js).
//     unverify-test-member — clears age_verified on a TEST member only.
//     purge-test-data     — deletes every is_test=1 member and their
//                           posts, listings, comments, and gallery rows.
// RULES, enforced here (never just UI):
//   - is_test can never be set on a real member (no endpoint takes it
//     as input; only create-test-member writes it, and only as 1).
//   - No ?test=1 URL bypass exists anywhere — test status comes only
//     from the is_test column, read server-side.
//   - Test images must be NON-SENSITIVE: /api/images serves raw R2
//     bytes to anyone with the URL, so a test photo is never an 18+
//     photo. The test flow below uses no photo at all (text-only posts).
import { json, noDb, getDb, readJson, profileByDevice, isOperator, nowMs, recordAuditLog } from "./_lib.js";

function needOperator(env, me) {
  return me && isOperator(env, me);
}

async function testMemberCounts(db, ids) {
  const counts = new Map();
  for (const id of ids) counts.set(id, { posts: 0, listings: 0 });
  try {
    const { results } = await db.prepare(
      `SELECT profile_id, COUNT(*) AS n FROM posts WHERE profile_id IN (${ids.map(() => "?").join(",")}) GROUP BY profile_id`,
    ).bind(...ids).all();
    for (const r of (results || [])) counts.get(r.profile_id).posts = r.n || 0;
  } catch { /* posts table missing — counts stay 0 */ }
  try {
    const { results } = await db.prepare(
      `SELECT profile_id, COUNT(*) AS n FROM listings WHERE profile_id IN (${ids.map(() => "?").join(",")}) GROUP BY profile_id`,
    ).bind(...ids).all();
    for (const r of (results || [])) counts.get(r.profile_id).listings = r.n || 0;
  } catch { /* listings table missing — counts stay 0 */ }
  return counts;
}

export async function onRequestGet({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("device_id") || "";
  const me = await profileByDevice(db, deviceId);
  if (!needOperator(env, me)) return json({ ok: false, error: "Operator only.", test_members: [] });
  let rows = [];
  try {
    const q = await db.prepare(
      "SELECT id, username, device_id, age_verified, banned, created_at FROM profiles WHERE is_test = 1 ORDER BY id ASC",
    ).all();
    rows = q.results || [];
  } catch {
    // is_test column not there yet (migration pending) — no test
    // members can exist, so the panel just shows an empty list.
    return json({ ok: true, test_members: [], test_mode_ready: false });
  }
  const ids = rows.map((r) => r.id);
  const counts = ids.length ? await testMemberCounts(db, ids) : new Map();
  return json({
    ok: true,
    test_mode_ready: true,
    test_members: rows.map((r) => ({
      id: r.id, username: r.username, test_device_id: r.device_id,
      age_verified: r.age_verified === 1, banned: r.banned === 1,
      posts: (counts.get(r.id) || {}).posts || 0,
      listings: (counts.get(r.id) || {}).listings || 0,
      created_at: r.created_at,
    })),
  });
}

export async function onRequestPost({ env, request }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const action = String(a.action || "");
  const me = a.device_id ? await profileByDevice(db, String(a.device_id)) : null;
  if (!needOperator(env, me)) return json({ ok: false, error: "Operator only." });

  if (action === "create-test-member") {
    // A fresh sandbox member: generated device id, a test- username,
    // no real name, a placeholder birthday (2000-01-01 — adult, so the
    // only gate under test is the ID-verification one), terms agreed.
    // is_test=1 is written ONLY here, never from client input.
    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    const testDeviceId = `test-${stamp}-${rand}`;
    const username = `test-member-${stamp}`;
    let r;
    try {
      r = await db.prepare(
        `INSERT INTO profiles (device_id, username, full_name, birthday, terms_agreed_at, chat_name, occupation, bio, top_friends, is_test, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ).bind(testDeviceId, username, "Test Member", "2000-01-01", nowMs(), "Test Member", "", "18+ test-mode sandbox member — not a real person.", "1", nowMs(), nowMs()).run();
    } catch (e) {
      if (/no such column|no column named/i.test(String((e && e.message) || e))) {
        return json({ ok: false, error: "Test mode needs the database update first — run admin-audit-log-migration.sql in the D1 console, then try again." });
      }
      throw e;
    }
    const id = r.meta.last_row_id;
    await recordAuditLog(db, { actorId: me.id, action: "create-test-member", targetId: id, detail: `sandbox test member @${username} created` });
    return json({ ok: true, error: null, profile_id: id, username, test_device_id: testDeviceId });
  }

  // Delete-all-test-data comes BEFORE the per-member target check —
  // it takes no profile_id (it purges EVERY test member at once).
  if (action === "purge-test-data") {
    // Delete-all-test-data: every test member's content first, then
    // the members. Best-effort per table — a missing table just skips.
    // R2 bytes uploaded by a test member are NOT deleted here (no
    // photo is ever uploaded in the test flow, so there should be none).
    const ids = [];
    try {
      const { results } = await db.prepare("SELECT id FROM profiles WHERE is_test = 1").all();
      for (const r of (results || [])) ids.push(r.id);
    } catch { /* column missing — nothing to purge */ }
    let purged = { members: 0, posts: 0, listings: 0, comments: 0, gallery: 0 };
    if (ids.length) {
      const ph = ids.map(() => "?").join(",");
      const del = async (sql, key, params) => {
        try {
          const r = await db.prepare(sql).bind(...(params || ids)).run();
          purged[key] = r.meta.changes || 0;
        } catch { /* table missing — nothing to delete */ }
      };
      await del(`DELETE FROM profile_comments WHERE profile_id IN (${ph}) OR author_id IN (${ph})`, "comments", [...ids, ...ids]);
      await del(`DELETE FROM posts WHERE profile_id IN (${ph})`, "posts");
      await del(`DELETE FROM listings WHERE profile_id IN (${ph})`, "listings");
      await del(`DELETE FROM gallery_photos WHERE profile_id IN (${ph})`, "gallery");
      try {
        const r = await db.prepare(`DELETE FROM profiles WHERE is_test = 1`).run();
        purged.members = r.meta.changes || 0;
      } catch { /* column missing — nothing to purge */ }
    }
    await recordAuditLog(db, { actorId: me.id, action: "purge-test-data", targetId: null, detail: `deleted all test data: ${purged.members} members, ${purged.posts} posts, ${purged.listings} listings, ${purged.comments} comments, ${purged.gallery} gallery photos` });
    return json({ ok: true, error: null, purged });
  }

  const targetId = Number(a.profile_id);
  if (!Number.isInteger(targetId) || targetId <= 0) return json({ ok: false, error: "Pick a test member first." });
  // Every target below must be a TEST member — a real member can never
  // be verified or unverified through this endpoint. (Purge is handled
  // above; it takes no target and only ever touches is_test=1 rows.)
  let target = null;
  try {
    target = await db.prepare("SELECT id, username, is_test FROM profiles WHERE id = ? LIMIT 1").bind(targetId).first();
  } catch {
    return json({ ok: false, error: "Test mode needs the database update first — run admin-audit-log-migration.sql in the D1 console, then try again." });
  }
  if (!target) return json({ ok: false, error: "That member doesn't exist." });
  if (target.is_test !== 1) return json({ ok: false, error: "That isn't a test member — test actions only work on sandbox test members." });

  if (action === "verify-test-member") {
    await db.prepare("UPDATE profiles SET age_verified = 1, updated_at = ? WHERE id = ?").bind(nowMs(), targetId).run();
    await recordAuditLog(db, { actorId: me.id, action: "verify-test-member", targetId, detail: `test member @${target.username} marked age-verified (test only)` });
    return json({ ok: true, error: null, age_verified: true });
  }
  if (action === "unverify-test-member") {
    await db.prepare("UPDATE profiles SET age_verified = 0, updated_at = ? WHERE id = ?").bind(nowMs(), targetId).run();
    await recordAuditLog(db, { actorId: me.id, action: "unverify-test-member", targetId, detail: `test member @${target.username} age verification cleared (test only)` });
    return json({ ok: true, error: null, age_verified: false });
  }
  return json({ ok: false, error: "Unknown test action." });
}
