// POST /api/posts/:id/vote — react to a post.
// Reactions (v3.15): heart + sad + confused. One reaction per member
// per post; tapping the same kind again takes it off, tapping another
// kind switches. Only a NEW heart notifies the author and pays the 5
// Lucre (once per post, as before) — sad/confused are silent.
// The migration must run first: until post_reactions exists, hearts
// fall back to the legacy post_votes table and sad/confused answer
// "not switched on yet".
import { json, noDb, getDb, readJson, profileByDevice, createNotification, awardLucre, LUCRE_AWARDS, REACTION_KINDS, togglePostReaction } from "../../_lib.js";

async function legacyPostHeart(db, me, id) {
  const existing = await db.prepare("SELECT value FROM post_votes WHERE post_id = ? AND profile_id = ? LIMIT 1").bind(id, me.id).first();
  let myHeart;
  if (existing && existing.value === 1) {
    await db.prepare("DELETE FROM post_votes WHERE post_id = ? AND profile_id = ?").bind(id, me.id).run();
    myHeart = false;
  } else if (existing) {
    await db.prepare("UPDATE post_votes SET value = 1 WHERE post_id = ? AND profile_id = ?").bind(id, me.id).run();
    myHeart = true;
  } else {
    await db.prepare("INSERT INTO post_votes (post_id, profile_id, value) VALUES (?, ?, 1)").bind(id, me.id).run();
    myHeart = true;
  }
  const row = await db.prepare("SELECT COUNT(*) AS n FROM post_votes WHERE post_id = ? AND value = 1").bind(id).first();
  return { hearts: row?.n ?? 0, my_heart: myHeart };
}

export async function onRequestPost({ env, request, params }) {
  const db = getDb(env);
  if (!db) return noDb();
  const a = await readJson(request);
  const fail = (error) => json({ ok: false, error, hearts: 0, sad: 0, confused: 0, my_reaction: null, my_heart: false });
  const me = await profileByDevice(db, String(a.device_id || ""));
  if (!me) return fail("Create your profile first to react to posts.");
  const kind = REACTION_KINDS.includes(a.kind) ? a.kind : "heart";
  const id = Number(params.id);
  const post = await db.prepare("SELECT kind, profile_id FROM posts WHERE id = ? LIMIT 1").bind(id).first();
  if (!post) return fail("That post is gone.");
  if ((post.kind ?? "forum") === "adult" && me.age_verified !== 1) return fail("The 18+ area is for age-verified members only.");
  const toggled = await togglePostReaction(db, me, id, kind);
  if (!toggled) {
    // Reactions table not there yet — hearts still work the old way.
    if (kind !== "heart") return fail("Reactions aren't switched on yet — run the update first.");
    const legacy = await legacyPostHeart(db, me, id);
    if (legacy.my_heart) {
      await createNotification(db, {
        profile_id: post.profile_id, actor_profile_id: me.id, kind: "heart",
        ref_type: "post", ref_id: id,
        text: `@${me.username} hearted your post`,
        link: `#/thread/${id}`,
      });
      await awardLucre(db, me.id, LUCRE_AWARDS.heart, "heart", "post:" + String(id));
    }
    return json({ ok: true, error: null, hearts: legacy.hearts, sad: 0, confused: 0, my_reaction: legacy.my_heart ? "heart" : null, my_heart: legacy.my_heart });
  }
  // Notification (v3.8) + Lucre (v3.11) — only on a NEW heart, never
  // on an un-heart, a switch, or a sad/confused reaction.
  if (toggled.my_reaction === "heart") {
    await createNotification(db, {
      profile_id: post.profile_id, actor_profile_id: me.id, kind: "heart",
      ref_type: "post", ref_id: id,
      text: `@${me.username} hearted your post`,
      link: `#/thread/${id}`,
    });
    // Lucre — 5 for hearting, once per post per member (the ledger key
    // makes un-heart + re-heart a no-op, never a double pay).
    await awardLucre(db, me.id, LUCRE_AWARDS.heart, "heart", "post:" + String(id));
  }
  return json({ ok: true, error: null, hearts: toggled.counts.heart, sad: toggled.counts.sad, confused: toggled.counts.confused, my_reaction: toggled.my_reaction, my_heart: toggled.my_reaction === "heart" });
}
