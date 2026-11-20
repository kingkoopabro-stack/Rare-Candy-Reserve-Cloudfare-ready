/* DJ rotation — shared Auto DJ no-repeat logic for the full DJ console
   (dj-console.html) and the Pocket DJ (dj-lite.html). Pure logic, no DOM:
   play history + rotation settings live in localStorage, the queue builder
   takes the show pool (tracks/ads) and returns the play order.
   Rules: a song can't repeat within songRepeatHours (default 4h); an ad
   can't repeat within adRepeatMinutes (default 60min); ads at least
   minSongsBetweenAds songs apart (default 3). If everything is blocked,
   the builder falls back to the least-recently-played item — never dead
   air. The 4:20 Smoke Sesh stays a fixed 10-minute slot in the rundown.
   NOTE: history lives in this browser's localStorage, so it only knows
   what THIS device played — the PC and the phone each keep their own. */
(function () {
  "use strict";
  var HISTORY_KEY = "dj-play-history";
  var SETTINGS_KEY = "dj-rotation-settings";
  var HISTORY_CAP = 200;
  var DEFAULTS = { songRepeatHours: 4, adRepeatMinutes: 60, minSongsBetweenAds: 3 };

  /* Same show pool the full console uses (21 album tracks + 6 ads). */
  var POOL = {
    tracks: [
      "Break habits, not hearts", "Untold weapons", "Voice inside my head original",
      "Sunk for you", "I'll prove everything", "Mr.Selfish", "Sweet BBgirl",
      "Let's Travel", "Straight to pieces", "The day she came to be",
      "Djentlemen Thief", "Guess how it ends", "On top of it (feat. Chest Club)",
      "Monster in disguise", "Stay until sunrise", "Read between the lines",
      "Introduction to heartache", "We will meet again I swear", "Dance till they drop",
      "Aiming to tease part 2", "Give them the world"
    ],
    ads: [
      { title: "Rare Candy Reserve", sub: "Graded cards, collectibles & custom 3D prints — “Collect from the best of the best.”" },
      { title: "7 Acre Wood Nursery", sub: "Plants & nursery goods from the 7 Acre Wood crew." },
      { title: "ASH Supply Co.", sub: "Fox Mask Tee and the End of the Year drop — print-on-demand, no upfront cost." },
      { title: "Vita Nova Records", sub: "Independent artists: submit your music for review and a shot at airplay." },
      { title: "A Steady Heart — blooming season", sub: "Ash's earlier album, streaming now on Spotify." },
      { title: "Spoof ad — Left-Handed Screwdriver Co.", sub: "For all your right-handed problems. (Spoof spot — the show bible mixes these in with the real ones.)" }
    ],
    songSlot: Math.round(4501 / 21), /* album total 1:15:01 across 21 tracks */
    smokeTime: 16 * 60 + 20 /* 4:20 PM, in minutes */
  };

  function loadSettings() {
    var s = { songRepeatHours: DEFAULTS.songRepeatHours, adRepeatMinutes: DEFAULTS.adRepeatMinutes, minSongsBetweenAds: DEFAULTS.minSongsBetweenAds };
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p) {
          if (isFinite(+p.songRepeatHours)) s.songRepeatHours = Math.max(1, Math.min(12, +p.songRepeatHours));
          if (isFinite(+p.adRepeatMinutes)) s.adRepeatMinutes = Math.max(15, Math.min(180, +p.adRepeatMinutes));
          if (isFinite(+p.minSongsBetweenAds)) s.minSongsBetweenAds = Math.max(1, Math.min(10, Math.round(+p.minSongsBetweenAds)));
        }
      }
    } catch (e) { /* defaults stand */ }
    return s;
  }
  function saveSettings(s) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        songRepeatHours: Math.max(1, Math.min(12, +s.songRepeatHours || DEFAULTS.songRepeatHours)),
        adRepeatMinutes: Math.max(15, Math.min(180, +s.adRepeatMinutes || DEFAULTS.adRepeatMinutes)),
        minSongsBetweenAds: Math.max(1, Math.min(10, Math.round(+s.minSongsBetweenAds || DEFAULTS.minSongsBetweenAds)))
      }));
    } catch (e) { /* storage unavailable — settings just don't persist */ }
  }
  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var h = JSON.parse(raw);
      if (!Array.isArray(h)) return [];
      return h.filter(function (e) { return e && typeof e.title === "string" && typeof e.playedAt === "number"; }).slice(-HISTORY_CAP);
    } catch (e) { return []; }
  }
  function saveHistory(h) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-HISTORY_CAP))); } catch (e) { /* ignore */ }
  }
  function recordPlay(title, type) {
    var h = loadHistory();
    h.push({ title: title, type: type || "song", playedAt: Date.now() });
    saveHistory(h);
    return h;
  }
  function timeAgo(ms) {
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return s + "s ago";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Build a fresh Auto DJ queue from the pool. pool: {tracks:[names],
     ads:[{title,sub}], songSlot, smokeTime}. startMin: show start in
     minutes after midnight. Returns blocks like the fixed rundown
     ({type,title,sub,dur,trackNo?,startMin,endMin}) with clock times. */
  function buildAutoQueue(pool, settings, history, startMin) {
    var now = Date.now();
    var songGap = (settings.songRepeatHours || DEFAULTS.songRepeatHours) * 3600000;
    var adGap = (settings.adRepeatMinutes || DEFAULTS.adRepeatMinutes) * 60000;
    var adSpacing = settings.minSongsBetweenAds || DEFAULTS.minSongsBetweenAds;
    function lastPlayed(title) {
      var t = 0;
      for (var i = history.length - 1; i >= 0; i--) {
        if (history[i].title === title) { t = history[i].playedAt; break; }
      }
      return t;
    }
    /* Songs: unblocked ones (not played within the gap), shuffled. If
       every song is blocked, fall back to all of them, least-recent first.
       Track entries are strings (album tracks) or objects {name, dur,
       zip:true, zipKey} (tracks from an uploaded zip playlist). */
    var songPool = pool.tracks.map(function (entry, i) {
      var isObj = entry && typeof entry === "object";
      var name = isObj ? entry.name : entry;
      return {
        name: name,
        trackNo: isObj ? (entry.trackNo || null) : (i + 1),
        dur: isObj && isFinite(+entry.dur) && +entry.dur > 0 ? +entry.dur : pool.songSlot,
        zip: !!(isObj && entry.zip),
        zipKey: isObj ? (entry.zipKey || null) : null,
        last: lastPlayed(name)
      };
    });
    var eligible = songPool.filter(function (s) { return now - s.last >= songGap; });
    var songs = eligible.length
      ? shuffle(eligible)
      : songPool.slice().sort(function (a, b) { return a.last - b.last; });
    /* Ads: per slot, least-recently-played among the unblocked ones,
       preferring ads not already used in this cycle. If every ad is
       blocked, the least-recently-played ad overall still goes in. */
    var adPool = pool.ads.map(function (ad) {
      return { title: "Ad — " + ad.title, sub: ad.sub, last: lastPlayed("Ad — " + ad.title) };
    });
    var usedAds = {};
    function pickAd() {
      var cands = adPool.filter(function (a) { return !usedAds[a.title] && now - a.last >= adGap; });
      if (!cands.length) cands = adPool.filter(function (a) { return !usedAds[a.title]; });
      if (!cands.length) cands = adPool.slice();
      if (!cands.length) return null;
      cands.sort(function (a, b) { return a.last - b.last; });
      var pick = cands[0];
      usedAds[pick.title] = true;
      return pick;
    }
    var list = [];
    list.push({ type: "intro", title: "Show open — Vita Nova Radio", sub: "Slabb welcomes everyone in · station ID", dur: 30 });
    var sinceAd = 0, songCount = 0;
    for (var i = 0; i < songs.length; i++) {
      var s = songs[i];
      list.push({ type: "intro", title: "Intro — " + s.name, sub: "Slabb introduces the song", dur: 15, trackNo: s.trackNo });
      list.push({ type: "song", title: s.name, sub: s.zip ? "Uploaded track · your zip playlist" : "A Steady Heart · End of the year · Track " + s.trackNo + " of 21", dur: s.dur, trackNo: s.trackNo, zipKey: s.zipKey });
      songCount++;
      sinceAd++;
      if (songCount % 7 === 0 && i !== songs.length - 1) {
        list.push({ type: "break", title: "Thank-you segment", sub: "Vita Nova Records · Rare Candy Reserve · Chris J · Ash", dur: 20 });
      }
      if (songCount === 11) {
        list.push({ type: "talk", title: "Podcast break — Slabb & Jordan", sub: "Ten minutes of banter between the songs", dur: 600 });
      }
      if (sinceAd >= adSpacing && i !== songs.length - 1) {
        var ad = pickAd();
        if (ad) list.push({ type: "ad", title: ad.title, sub: ad.sub, dur: 30 });
        sinceAd = 0;
      }
    }
    list.push({ type: "break", title: "Show close — thank you for listening", sub: "Vita Nova Records · Rare Candy Reserve", dur: 20 });
    /* Smoke Sesh drops into the slot that lands on 4:20 PM — same slot
       logic as the fixed rundown, so it never moves off its time. */
    var smoke = { type: "talk", title: "Smoke Sesh Discussions", sub: "The 4:20 talk segment — Slabb & Jordan", dur: 600 };
    var cum = 0, insertAt = -1;
    for (var j = 0; j < list.length; j++) {
      var bs = startMin + cum / 60;
      var be = bs + list[j].dur / 60;
      if (bs < pool.smokeTime && be >= pool.smokeTime) { insertAt = j + 1; break; }
      if (bs >= pool.smokeTime) { insertAt = j; break; }
      cum += list[j].dur;
    }
    if (insertAt === -1) list.splice(Math.max(1, list.length - 1), 0, smoke);
    else list.splice(insertAt, 0, smoke);
    /* Clock times. */
    cum = 0;
    for (var k = 0; k < list.length; k++) {
      list[k].startMin = startMin + cum / 60;
      cum += list[k].dur;
      list[k].endMin = startMin + cum / 60;
    }
    return list;
  }

  window.DJRotation = {
    POOL: POOL,
    DEFAULTS: DEFAULTS,
    HISTORY_KEY: HISTORY_KEY,
    SETTINGS_KEY: SETTINGS_KEY,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    loadHistory: loadHistory,
    saveHistory: saveHistory,
    recordPlay: recordPlay,
    timeAgo: timeAgo,
    shuffle: shuffle,
    buildAutoQueue: buildAutoQueue
  };
})();
