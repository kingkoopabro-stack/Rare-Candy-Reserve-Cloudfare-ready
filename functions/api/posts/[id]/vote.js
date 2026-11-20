// POST /api/posts/:id/vote — votePost. Hearts (or un-hearts) a post — the
// ONLY reaction anywhere. No downvotes: a member either hearts a post or
// doesn't. Toggling returns the new heart count.
import { json, noDb, getDb, readJson, profileByDevice, createNotification, awardLucre, LUCRE_AWARDS } from "../../_lib.js";

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, hearts: 0, my_heart: false });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to heart posts.");
  const id = Number(params.id);
  const post = await db.prepare("SELECT kind, profile_id FROM posts WHERE id = ? LIMIT 1").bind(id).first();
  if (!post) return fail("That post is gone.");
  if ((post.kind ?? "forum") === "adult" && me.age_verified !== 1) return fail("The 18+ area is for age-verified members only.");
  const existing = await db.prepare("SELECT value FROM post_votes WHERE post_id = ? AND profile_id = ? LIMIT 1").bind(id, me.id).first();
  let myHeart;
  if (existing && existing.value === 1) {
    await db.prepare("DELETE FROM post_votes WHERE post_id = ? AND profile_id = ?").bind(id, me.id).run();
    myHeart = false;
  } else if (existing) {
    // Legacy downvote rows become hearts — negative votes no longer exist.
    await db.prepare("UPDATE post_votes SET value = 1 WHERE post_id = ? AND profile_id = ?").bind(id, me.id).run();
    myHeart = true;
  } else {
    await db.prepare("INSERT INTO post_votes (post_id, profile_id, value) VALUES (?, ?, 1)").bind(id, me.id).run();
    myHeart = true;
  }
  const row = await db.prepare("SELECT COUNT(*) AS n FROM post_votes WHERE post_id = ? AND value = 1").bind(id).first();
  // Notification (v3.8) — only on a NEW heart, never on an un-heart.
  // Skips quietly when the table isn't there yet or it's your own post.
  if (myHeart) {
    await createNotification(db, {
      profile_id: post.profile_id, actor_profile_id: me.id, kind: "heart",
      ref_type: "post", ref_id: id,
      text: `@${me.username} hearted your post`,
      link: `#/thread/${id}`,
    });
    // Lucre (v3.11) — 5 for hearting, once per post per member (the
    // ledger key makes un-heart + re-heart a no-op, never a double pay).
    await awardLucre(db, me.id, LUCRE_AWARDS.heart, "heart", "post:" + String(id));
  }
  return json({ ok: true, error: null, hearts: row?.n ?? 0, my_heart: myHeart });
}
