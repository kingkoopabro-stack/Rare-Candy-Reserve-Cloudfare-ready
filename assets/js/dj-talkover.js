/* Smart talk-over — mic-driven auto-duck, shared by the full DJ console
   (dj-console.html) and the Pocket DJ (dj-lite.html). One system, not two.
   How it works: an AnalyserNode on the mic input measures the voice level
   in real time. When the voice is above the threshold, the music gain ducks
   to the bed level so the voice is clearly heard with the music still
   playing quietly underneath. When the voice stops, the music fades back
   up over the release time — a smooth linear ramp, not a jump. A short
   hold (400ms) keeps the duck steady through brief pauses between words.
   The controller ticks every 100ms; the host page passes isActive() (Talk
   on, or auto-duck + mic live) and onDuck() to apply the music gain.
   Defaults: bed -16 dB, release 2.5s, voice threshold -45 dB. */
(function () {
  "use strict";
  var SETTINGS_KEY = "dj-talkover-settings";
  var DEFAULTS = { bedDb: -16, releaseSec: 2.5, thresholdDb: -45 };
  var HOLD_MS = 400; /* brief pauses between words don't un-duck the music */
  var TICK_MS = 100;

  function clampSettings(s) {
    var out = { bedDb: DEFAULTS.bedDb, releaseSec: DEFAULTS.releaseSec, thresholdDb: DEFAULTS.thresholdDb };
    if (!s) return out;
    if (isFinite(+s.bedDb)) out.bedDb = Math.max(-40, Math.min(0, +s.bedDb));
    if (isFinite(+s.releaseSec)) out.releaseSec = Math.max(0.5, Math.min(10, +s.releaseSec));
    if (isFinite(+s.thresholdDb)) out.thresholdDb = Math.max(-70, Math.min(-20, +s.thresholdDb));
    return out;
  }
  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return clampSettings(JSON.parse(raw));
    } catch (e) { /* defaults stand */ }
    return { bedDb: DEFAULTS.bedDb, releaseSec: DEFAULTS.releaseSec, thresholdDb: DEFAULTS.thresholdDb };
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(clampSettings(s))); } catch (e) { /* ignore */ }
  }
  function dbToLinear(db) { return Math.pow(10, db / 20); }
  function levelDb(analyser) {
    if (!analyser) return -70;
    var buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    var sum = 0;
    for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; sum += v * v; }
    var rms = Math.sqrt(sum / buf.length);
    if (rms <= 0.001) return -70;
    return Math.max(-70, 20 * Math.log10(rms));
  }
  /* opts: getAnalyser() -> AnalyserNode|null (the mic analyser),
     isActive() -> bool (Talk on, or auto-duck + mic live),
     onDuck(duck, speaking) — host applies the music gain multiplier,
     onMeter(db, speaking, active) — host updates the talk meter. */
  function create(opts) {
    var settings = clampSettings(opts.settings || loadSettings());
    var bedLinear = dbToLinear(settings.bedDb);
    var duck = 1; /* current music multiplier: 1 = full, bedLinear = ducked */
    var lastVoiceAt = 0;
    var timer = null;
    function tick() {
      var analyser = opts.getAnalyser ? opts.getAnalyser() : null;
      var active = !!(opts.isActive && opts.isActive());
      var db = -70, speaking = false;
      if (analyser && active) {
        db = levelDb(analyser);
        speaking = db > settings.thresholdDb;
        if (speaking) lastVoiceAt = Date.now();
      }
      var target;
      if (speaking) target = bedLinear;
      else if (Date.now() - lastVoiceAt > HOLD_MS) target = 1;
      else target = duck; /* hold the duck through brief pauses */
      if (!active) target = 1; /* Talk off / mic off → music back to full */
      if (target < duck) {
        duck = target; /* fast attack — voice cuts in right away */
      } else if (target > duck) {
        /* slow linear release: bed → full over releaseSec, no jump */
        duck = Math.min(1, duck + (1 - bedLinear) * (TICK_MS / 1000 / settings.releaseSec));
      }
      if (opts.onDuck) opts.onDuck(duck, speaking);
      if (opts.onMeter) opts.onMeter(db, speaking, active);
    }
    return {
      settings: settings,
      start: function () { if (!timer) timer = setInterval(tick, TICK_MS); },
      stop: function () { if (timer) { clearInterval(timer); timer = null; } },
      tick: tick,
      setSettings: function (s) { settings = clampSettings(s); saveSettings(settings); bedLinear = dbToLinear(settings.bedDb); },
      getDuck: function () { return duck; }
    };
  }
  window.DJTalkover = {
    DEFAULTS: DEFAULTS,
    SETTINGS_KEY: SETTINGS_KEY,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    create: create
  };
})();
