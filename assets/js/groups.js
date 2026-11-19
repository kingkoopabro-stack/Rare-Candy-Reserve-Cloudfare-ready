/* Group Up — Nerd Hub squad finder (nerd.html).
   Small 4-person gaming groups: create / find / join with PIN, an ephemeral
   text chat room, and optional voice chat per group (WebRTC mesh, REST
   signaling, STUN only — no TURN, so voice may fail on strict symmetric
   NATs). Members only to create/join/chat; guests can browse open groups.
   The chat is ephemeral: leave the group and you can't see it anymore;
   when the last member leaves, the group deletes itself. */
(function () {
  "use strict";
  var API = "/api";
  var DEVICE_KEY = "dwc-device-id";
  var PLATFORMS = ["Switch", "Switch 2", "PS4", "PS5", "PC", "Xbox One", "Retro gaming", "Stream", "Crossplay"];
  var PLAYTIMES = ["An hour or two", "A few hours", "Campaign length"];
  var STUN_URL = "stun:stun.l.google.com:19302";

  var profile = null; // {id, username, ...} or null (guest)
  var currentSquad = null; // shaped squad object for the open room
  var lastMsgId = 0;
  var msgTimer = null, memberTimer = null, sigTimer = null;
  var roomGone = false;

  /* ---------- voice state ---------- */
  var voiceOn = false, voiceMuted = false;
  var localStream = null;
  var peers = {}; // profileId -> {pc, audioEl, analyser, dataArr, pendingIce: []}
  var lastSignalId = 0;
  var audioCtx = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var NICK_COLORS = ["#ff2d95", "#00e5ff", "#ff9a00", "#7c4dff", "#39ff88", "#ffd75e", "#ff5c5c", "#00c2ff", "#e060f0", "#7dff5e", "#ff7ad9", "#5ee6ff"];
  function nickColor(name) {
    var h = 0, s = String(name || "?");
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return NICK_COLORS[Math.abs(h) % NICK_COLORS.length];
  }
  function chatTime(isoStr) {
    var d = new Date(isoStr || "");
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function deviceId() {
    try {
      var ex = localStorage.getItem(DEVICE_KEY);
      if (ex) return ex;
      var id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : "dev-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_KEY, id);
      return id;
    } catch (e) { return "dev-shared-fallback"; }
  }

  function apiGet(path) {
    return fetch(API + path).then(function (r) { return r.json().catch(function () { return null; }); })
      .catch(function () { return null; });
  }
  function apiPost(path, body) {
    return fetch(API + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .catch(function () { return null; });
  }

  function setMsg(text, isErr) {
    var el = $("grpMsg");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = isErr ? "#ff5c5c" : "var(--green)";
  }
  function setRoomMsg(text, isErr) {
    var el = $("grpRoomMsg");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = isErr ? "#ff5c5c" : "var(--green)";
  }

  /* ---------- views ---------- */
  var VIEWS = ["grpFind", "grpCreate", "grpPinView", "grpRoom"];
  function showView(name) {
    VIEWS.forEach(function (v) { var el = $(v); if (el) el.hidden = (v !== name); });
    if (name === "grpFind") loadSquads();
  }

  /* ---------- gating ---------- */
  function applyGating() {
    var gate = $("grpGate"), controls = $("grpControls");
    var isMember = !!profile;
    if (gate) gate.hidden = isMember;
    if (controls) controls.hidden = !isMember;
    var who = $("grpWho");
    if (who) {
      who.textContent = isMember
        ? "You're grouping up as @" + (profile.chat_name || profile.username)
        : "Members only — sign up to create or join a group. You can still browse open groups below.";
    }
  }

  /* ---------- find / browse ---------- */
  function loadSquads() {
    var cards = $("grpCards");
    if (cards) cards.innerHTML = '<p style="color:var(--muted)">Loading groups…</p>';
    var p = new URLSearchParams();
    p.set("device_id", deviceId());
    var pf = $("grpFilterPlatform"), gf = $("grpFilterGame"), tf = $("grpFilterPlaytime");
    if (pf && pf.value) p.set("platform", pf.value);
    if (gf && gf.value.trim()) p.set("game", gf.value.trim());
    if (tf && tf.value) p.set("playtime", tf.value);
    apiGet("/squads?" + p.toString()).then(function (data) {
      if (!data) { if (cards) cards.innerHTML = '<p style="color:#ff5c5c">Couldn\'t load groups — check your connection and try again.</p>'; return; }
      if (data.error && !(data.squads || []).length) { if (cards) cards.innerHTML = "<p style=\"color:var(--muted)\">" + esc(data.error) + "</p>"; return; }
      renderCards(data.squads || []);
    });
  }

  function renderCards(squads) {
    var cards = $("grpCards");
    if (!cards) return;
    if (!squads.length) {
      cards.innerHTML = '<p style="color:var(--muted)">No open groups match that — create one and get the squad started.</p>';
      return;
    }
    cards.innerHTML = squads.map(function (s) {
      var full = s.member_count >= (s.max_players || 4);
      var mine = s.is_member;
      var btn;
      if (!profile) btn = '<button type="button" class="btn ghost" disabled title="Sign up to join">Join — members only</button>';
      else if (mine) btn = '<button type="button" class="btn" data-grp-open="' + s.id + '">Open room →</button>';
      else if (full) btn = '<button type="button" class="btn ghost" disabled>Full (4/4)</button>';
      else btn = '<button type="button" class="btn" data-grp-join="' + s.id + '">Join group</button>';
      return '<div class="card grp-card">' +
        '<div class="tag">' + esc(s.platform) + ' · ' + esc(s.playtime) + '</div>' +
        '<h3 style="margin-top:8px">' + esc(s.game) + '</h3>' +
        '<p style="font-weight:800;margin:0">' + esc(s.title) + '</p>' +
        (s.description ? '<p style="color:var(--muted);margin:6px 0 0">' + esc(s.description) + '</p>' : "") +
        '<p class="grp-meta">Players: <b>' + s.member_count + '/' + (s.max_players || 4) + '</b> · Status: <b>' + (s.is_private ? "🔒 Private" : "🟢 Open") + '</b></p>' +
        '<p class="grp-meta" style="margin-top:2px">Host: @' + esc(s.creator_username) + '</p>' +
        '<p style="margin-top:12px">' + btn + '</p>' +
        '</div>';
    }).join("");
    cards.querySelectorAll("[data-grp-join]").forEach(function (b) {
      b.addEventListener("click", function () { joinSquad(Number(b.getAttribute("data-grp-join")), null); });
    });
    cards.querySelectorAll("[data-grp-open]").forEach(function (b) {
      b.addEventListener("click", function () { openRoom(Number(b.getAttribute("data-grp-open"))); });
    });
  }

  function joinSquad(id, pin) {
    if (!profile) { setMsg("Sign up to join a group.", true); return; }
    setMsg("Joining…");
    apiPost("/squads/" + id + "/join", { device_id: deviceId(), pin: pin || "" }).then(function (data) {
      if (!data) { setMsg("Couldn't reach the Community — try again.", true); return; }
      if (!data.ok) { setMsg(data.error || "Couldn't join that group.", true); return; }
      setMsg("");
      openRoom(id);
    });
  }

  /* ---------- create ---------- */
  function initCreateForm() {
    var plat = $("grpPlatform"), play = $("grpPlaytime");
    if (plat) plat.innerHTML = PLATFORMS.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join("");
    if (play) play.innerHTML = PLAYTIMES.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join("");
    var priv = $("grpPrivate"), pinRow = $("grpPinRow");
    if (priv && pinRow) {
      priv.addEventListener("change", function () { pinRow.hidden = !priv.checked; });
      pinRow.hidden = !priv.checked;
    }
    var form = $("grpCreateForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        submitCreate();
      });
    }
  }

  function submitCreate() {
    if (!profile) { setMsg("Sign up to create a group.", true); return; }
    var isPrivate = !!($("grpPrivate") && $("grpPrivate").checked);
    var pin = ($("grpPin") && $("grpPin").value || "").trim();
    if (isPrivate && !/^\d{4}$/.test(pin)) { setMsg("Private groups need a 4-digit PIN code.", true); return; }
    var body = {
      device_id: deviceId(),
      platform: $("grpPlatform") ? $("grpPlatform").value : "",
      game: $("grpGame") ? $("grpGame").value.trim() : "",
      title: $("grpTitle") ? $("grpTitle").value.trim() : "",
      description: $("grpDesc") ? $("grpDesc").value.trim() : "",
      is_private: isPrivate,
      pin: isPrivate ? pin : "",
      playtime: $("grpPlaytime") ? $("grpPlaytime").value : "",
    };
    setMsg("Creating your group…");
    apiPost("/squads", body).then(function (data) {
      if (!data) { setMsg("Couldn't reach the Community — try again.", true); return; }
      if (!data.ok) { setMsg(data.error || "Couldn't create the group.", true); return; }
      setMsg("");
      var form = $("grpCreateForm");
      if (form) form.reset();
      var pinRow = $("grpPinRow");
      if (pinRow) pinRow.hidden = true;
      openRoom(data.squad.id);
    });
  }

  /* ---------- join with PIN ---------- */
  function initPinForm() {
    var form = $("grpPinForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var pin = ($("grpPinInput") && $("grpPinInput").value || "").trim();
        if (!/^\d{4}$/.test(pin)) { setMsg("Enter the group's 4-digit PIN code.", true); return; }
        setMsg("Looking for that group…");
        apiPost("/squads/join-by-pin", { device_id: deviceId(), pin: pin }).then(function (data) {
          if (!data) { setMsg("Couldn't reach the Community — try again.", true); return; }
          if (!data.ok) { setMsg(data.error || "No group found with that PIN.", true); return; }
          setMsg("");
          openRoom(data.squad.id);
        });
      });
    }
  }

  /* ---------- room ---------- */
  function openRoom(id) {
    stopPolls();
    leaveVoice();
    roomGone = false;
    lastMsgId = 0;
    apiGet("/squads/" + id + "?device_id=" + encodeURIComponent(deviceId())).then(function (data) {
      if (!data || !data.squad) {
        setMsg("That group is gone.", true);
        showView("grpFind");
        return;
      }
      currentSquad = data.squad;
      renderRoomHeader();
      renderMembers();
      showView("grpRoom");
      loadMessages(true);
      msgTimer = setInterval(function () { loadMessages(false); }, 5000);
      memberTimer = setInterval(refreshMembers, 10000);
      var log = $("grpChatLog");
      if (log) log.innerHTML = "";
    });
  }

  function renderRoomHeader() {
    if (!currentSquad) return;
    var h = $("grpRoomHeader");
    if (!h) return;
    h.innerHTML =
      '<div class="tag">' + esc(currentSquad.platform) + ' · ' + esc(currentSquad.playtime) + '</div>' +
      '<h3 style="margin-top:8px">' + esc(currentSquad.game) + '</h3>' +
      '<p style="font-weight:800;margin:0">' + esc(currentSquad.title) + '</p>' +
      (currentSquad.description ? '<p style="color:var(--muted);margin:6px 0 0">' + esc(currentSquad.description) + '</p>' : "") +
      '<p class="grp-meta">Players: <b><span id="grpRoomCount">' + currentSquad.member_count + '/' + (currentSquad.max_players || 4) + '</span></b> · Status: <b>' + (currentSquad.is_private ? "🔒 Private" : "🟢 Open") + '</b>' +
      (currentSquad.expired ? ' · <span style="color:#ff9a00">⏰ Playtime\'s up — wrap up when you\'re ready</span>' : "") + '</p>';
  }

  function renderMembers() {
    var list = $("grpMembers");
    if (!list || !currentSquad) return;
    list.innerHTML = (currentSquad.members || []).map(function (m) {
      var inVoice = voiceOn && peers[m.id];
      var meTag = profile && m.id === profile.id ? " (you)" : "";
      var mic = "";
      if (inVoice) mic = '<span class="grp-mic" data-grp-mic="' + m.id + '">🎙️ in voice</span>';
      else if (voiceOn && profile && m.id === profile.id) mic = '<span class="grp-mic">' + (voiceMuted ? "🔇 muted" : "🎙️ mic on") + '</span>';
      return '<div class="grp-member" data-grp-member="' + m.id + '">' +
        '<span class="grp-name" style="color:' + nickColor(m.username) + '">@' + esc(m.username) + meTag + '</span> ' + mic +
        '</div>';
    }).join("") || '<p style="color:var(--muted)">Nobody here yet.</p>';
  }

  function refreshMembers() {
    if (!currentSquad || roomGone) return;
    apiGet("/squads/" + currentSquad.id + "?device_id=" + encodeURIComponent(deviceId())).then(function (data) {
      if (!data || !data.squad) { groupGone(); return; }
      var before = (currentSquad.members || []).map(function (m) { return m.id; });
      currentSquad = data.squad;
      renderRoomHeader();
      renderMembers();
      // Voice: connect to anyone new who showed up while we're in voice.
      if (voiceOn) {
        (currentSquad.members || []).forEach(function (m) {
          if (m.id !== profile.id && before.indexOf(m.id) === -1 && !peers[m.id]) startPeer(m.id, true);
        });
        // Drop peers who left.
        Object.keys(peers).forEach(function (pid) {
          if (!currentSquad.members.some(function (m) { return String(m.id) === String(pid); })) closePeer(Number(pid));
        });
      }
    });
  }

  function groupGone() {
    if (roomGone) return;
    roomGone = true;
    stopPolls();
    leaveVoice();
    currentSquad = null;
    setMsg("This group is gone.", true);
    showView("grpFind");
  }

  function stopPolls() {
    if (msgTimer) { clearInterval(msgTimer); msgTimer = null; }
    if (memberTimer) { clearInterval(memberTimer); memberTimer = null; }
    if (sigTimer) { clearInterval(sigTimer); sigTimer = null; }
  }

  /* ---------- text chat ---------- */
  function nearBottom() {
    var log = $("grpChatLog");
    if (!log) return true;
    return (log.scrollHeight - log.scrollTop - log.clientHeight) < 90;
  }

  function loadMessages(first) {
    if (!currentSquad || roomGone) return;
    apiGet("/squads/" + currentSquad.id + "/messages?device_id=" + encodeURIComponent(deviceId()) + "&since=" + lastMsgId).then(function (data) {
      if (!data) return;
      if (data.error) { groupGone(); return; }
      var msgs = data.messages || [];
      if (!msgs.length) return;
      var log = $("grpChatLog");
      if (!log) return;
      var stick = first || nearBottom();
      msgs.forEach(function (m) {
        lastMsgId = Math.max(lastMsgId, m.id);
        var mine = profile && m.profile_id === profile.id;
        var div = document.createElement("div");
        div.className = "grp-chat-msg" + (mine ? " grp-mine" : "");
        div.innerHTML = '<span class="grp-chat-name" style="color:' + nickColor(m.username) + '">@' + esc(m.username) + '</span> ' +
          '<span class="grp-chat-time">' + esc(chatTime(m.created_at)) + '</span><br>' + esc(m.body);
        log.appendChild(div);
      });
      if (stick) log.scrollTop = log.scrollHeight;
    });
  }

  function initChatForm() {
    var form = $("grpChatForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!currentSquad) return;
      var input = $("grpChatInput");
      var text = input ? input.value.trim() : "";
      if (!text) return;
      if (input) input.value = "";
      apiPost("/squads/" + currentSquad.id + "/messages", { device_id: deviceId(), text: text }).then(function (data) {
        if (!data) { setRoomMsg("Couldn't send — check your connection.", true); return; }
        if (!data.ok) { setRoomMsg(data.error || "Couldn't send that.", true); if (data.error && /gone|join/i.test(data.error)) groupGone(); return; }
        setRoomMsg("");
        loadMessages(false);
      });
    });
  }

  function leaveGroup() {
    if (!currentSquad) return;
    var id = currentSquad.id;
    stopPolls();
    leaveVoice();
    currentSquad = null;
    apiPost("/squads/" + id + "/leave", { device_id: deviceId() }).then(function () {
      setMsg("You left the group.");
      showView("grpFind");
    });
  }

  /* ---------- voice chat (WebRTC mesh, REST signaling) ---------- */
  function voiceButtons() {
    var join = $("grpVoiceJoin"), mute = $("grpVoiceMute"), leave = $("grpVoiceLeave");
    if (join) join.hidden = voiceOn;
    if (mute) { mute.hidden = !voiceOn; mute.textContent = voiceMuted ? "🔇 Unmute" : "🎙️ Mute"; }
    if (leave) leave.hidden = !voiceOn;
    var st = $("grpVoiceStatus");
    if (st) st.textContent = voiceOn ? (voiceMuted ? "Voice on — you're muted" : "Voice on — mic live") : "";
  }

  function joinVoice() {
    if (!currentSquad || voiceOn) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRoomMsg("Voice chat isn't supported in this browser — text chat still works.", true);
      return;
    }
    setRoomMsg("Asking for your mic…");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      localStream = stream;
      voiceOn = true;
      voiceMuted = false;
      setRoomMsg("");
      voiceButtons();
      renderMembers();
      // Offer a connection to everyone already in the room.
      (currentSquad.members || []).forEach(function (m) {
        if (profile && m.id !== profile.id) startPeer(m.id, true);
      });
      lastSignalId = 0;
      sigTimer = setInterval(pollSignals, 2000);
      pollSignals();
      requestAnimationFrame(voiceLoop);
    }).catch(function () {
      setRoomMsg("Mic access was blocked — text chat still works. Allow the mic and tap Join voice again to talk.", true);
    });
  }

  function leaveVoice() {
    if (!voiceOn && !localStream && !Object.keys(peers).length) { voiceButtons(); return; }
    Object.keys(peers).forEach(function (pid) { closePeer(Number(pid)); });
    if (localStream) { localStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); localStream = null; }
    voiceOn = false;
    voiceMuted = false;
    if (sigTimer) { clearInterval(sigTimer); sigTimer = null; }
    voiceButtons();
    renderMembers();
  }

  function toggleMute() {
    if (!voiceOn || !localStream) return;
    voiceMuted = !voiceMuted;
    localStream.getAudioTracks().forEach(function (t) { t.enabled = !voiceMuted; });
    voiceButtons();
    renderMembers();
  }

  function startPeer(peerId, initiator) {
    if (peers[peerId]) return peers[peerId];
    var pc;
    try {
      pc = new RTCPeerConnection({ iceServers: [{ urls: STUN_URL }] });
    } catch (e) { return null; }
    var peer = { pc: pc, audioEl: null, analyser: null, dataArr: null, pendingIce: [] };
    peers[peerId] = peer;
    if (localStream) localStream.getTracks().forEach(function (t) { pc.addTrack(t, localStream); });
    pc.onicecandidate = function (e) {
      if (e.candidate && currentSquad) {
        apiPost("/squads/" + currentSquad.id + "/signals", {
          device_id: deviceId(), to_profile_id: peerId, type: "ice-candidate", payload: JSON.stringify(e.candidate),
        });
      }
    };
    pc.ontrack = function (e) {
      var stream = (e.streams && e.streams[0]) || null;
      if (!stream) return;
      var wrap = $("grpAudioWrap");
      var audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      audio.srcObject = stream;
      if (wrap) wrap.appendChild(audio);
      peer.audioEl = audio;
      setupAnalyser(peerId, stream);
      renderMembers();
    };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
        if (peers[peerId] && peers[peerId].pc === pc) closePeer(peerId);
      }
    };
    if (initiator) {
      pc.createOffer().then(function (offer) {
        return pc.setLocalDescription(offer).then(function () {
          if (currentSquad) {
            apiPost("/squads/" + currentSquad.id + "/signals", {
              device_id: deviceId(), to_profile_id: peerId, type: "offer", payload: JSON.stringify(offer),
            });
          }
        });
      }).catch(function () { closePeer(peerId); });
    }
    return peer;
  }

  function closePeer(peerId) {
    var peer = peers[peerId];
    if (!peer) return;
    delete peers[peerId];
    try { peer.pc.close(); } catch (e) {}
    if (peer.audioEl && peer.audioEl.parentNode) peer.audioEl.parentNode.removeChild(peer.audioEl);
    renderMembers();
  }

  function flushIce(peer) {
    if (!peer.pc.remoteDescription) return;
    var queued = peer.pendingIce.splice(0);
    queued.forEach(function (c) {
      peer.pc.addIceCandidate(new RTCIceCandidate(c)).catch(function () {});
    });
  }

  // Glare handling (both sides offering at once): the member with the
  // LOWER profile id is the polite peer — it rolls back its own offer
  // and accepts the other side's. The higher id ignores the colliding
  // offer and its own offer wins. Standard polite/impolite pattern.
  function acceptOffer(peer, fromId, payload) {
    peer.pc.setRemoteDescription(new RTCSessionDescription(payload)).then(function () {
      flushIce(peer);
      return peer.pc.createAnswer();
    }).then(function (answer) {
      return peer.pc.setLocalDescription(answer).then(function () {
        apiPost("/squads/" + currentSquad.id + "/signals", {
          device_id: deviceId(), to_profile_id: fromId, type: "answer", payload: JSON.stringify(answer),
        });
      });
    }).catch(function () {});
  }

  function handleSignal(sig) {
    if (!currentSquad || !voiceOn) return;
    var fromId = sig.from_profile_id;
    if (fromId === (profile && profile.id)) return;
    var peer = peers[fromId];
    var payload = null;
    try { payload = JSON.parse(sig.payload); } catch (e) { return; }
    if (sig.type === "offer") {
      if (!peer) peer = startPeer(fromId, false);
      if (!peer) return;
      var polite = profile && profile.id < fromId;
      if (peer.pc.signalingState !== "stable") {
        if (!polite) return; // impolite: ignore the colliding offer, ours wins
        peer.pc.setLocalDescription({ type: "rollback" }).then(function () {
          acceptOffer(peer, fromId, payload);
        }).catch(function () {});
        return;
      }
      acceptOffer(peer, fromId, payload);
    } else if (sig.type === "answer") {
      if (!peer) return;
      if (peer.pc.signalingState !== "have-local-offer") return; // stale answer (rolled back) — ignore
      peer.pc.setRemoteDescription(new RTCSessionDescription(payload)).then(function () {
        flushIce(peer);
      }).catch(function () {});
    } else if (sig.type === "ice-candidate") {
      if (!peer) { peer = startPeer(fromId, false); if (!peer) return; }
      if (peer.pc.remoteDescription) {
        peer.pc.addIceCandidate(new RTCIceCandidate(payload)).catch(function () {});
      } else {
        peer.pendingIce.push(payload);
      }
    }
  }

  function pollSignals() {
    if (!currentSquad || !voiceOn) return;
    apiGet("/squads/" + currentSquad.id + "/signals?device_id=" + encodeURIComponent(deviceId()) + "&since=" + lastSignalId).then(function (data) {
      if (!data) return;
      if (data.error) return;
      (data.signals || []).forEach(function (sig) {
        lastSignalId = Math.max(lastSignalId, sig.id);
        handleSignal(sig);
      });
    });
  }

  function setupAnalyser(peerId, stream) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      var src = audioCtx.createMediaStreamSource(stream);
      var an = audioCtx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      peers[peerId].analyser = an;
      peers[peerId].dataArr = new Uint8Array(an.fftSize);
    } catch (e) { /* speaking indicator is a bonus — voice still works without it */ }
  }

  function voiceLoop() {
    if (!voiceOn) return;
    Object.keys(peers).forEach(function (pid) {
      var p = peers[pid];
      if (!p.analyser || !p.dataArr) return;
      p.analyser.getByteTimeDomainData(p.dataArr);
      var sum = 0;
      for (var i = 0; i < p.dataArr.length; i++) { var v = (p.dataArr[i] - 128) / 128; sum += v * v; }
      var rms = Math.sqrt(sum / p.dataArr.length);
      var el = document.querySelector('[data-grp-mic="' + pid + '"]');
      if (el) {
        var speaking = rms > 0.02;
        el.textContent = speaking ? "🔊 speaking" : "🎙️ in voice";
        el.classList.toggle("grp-speaking", speaking);
      }
    });
    requestAnimationFrame(voiceLoop);
  }

  /* ---------- init ---------- */
  function init() {
    var root = $("groupup");
    if (!root) return;
    // Top buttons.
    var bCreate = $("grpBtnCreate"), bFind = $("grpBtnFind"), bPin = $("grpBtnPin");
    if (bCreate) bCreate.addEventListener("click", function () { setMsg(""); showView("grpCreate"); });
    if (bFind) bFind.addEventListener("click", function () { setMsg(""); showView("grpFind"); });
    if (bPin) bPin.addEventListener("click", function () { setMsg(""); showView("grpPinView"); });
    var refresh = $("grpRefresh");
    if (refresh) refresh.addEventListener("click", loadSquads);
    // Filters refresh the list as they change.
    ["grpFilterPlatform", "grpFilterPlaytime"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("change", loadSquads);
    });
    var gf = $("grpFilterGame");
    if (gf) gf.addEventListener("input", function () { loadSquads(); });
    initCreateForm();
    initPinForm();
    initChatForm();
    var leaveBtn = $("grpLeaveBtn");
    if (leaveBtn) leaveBtn.addEventListener("click", leaveGroup);
    var vJoin = $("grpVoiceJoin"), vMute = $("grpVoiceMute"), vLeave = $("grpVoiceLeave");
    if (vJoin) vJoin.addEventListener("click", joinVoice);
    if (vMute) vMute.addEventListener("click", toggleMute);
    if (vLeave) vLeave.addEventListener("click", leaveVoice);
    // Who am I? (same device_id the Community uses)
    apiGet("/profile?device_id=" + encodeURIComponent(deviceId())).then(function (data) {
      profile = (data && data.profile) || null;
      applyGating();
      showView("grpFind");
    }).catch(function () {
      profile = null;
      applyGating();
      showView("grpFind");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
