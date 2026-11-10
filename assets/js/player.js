/* ============================================================
   RCR cassette player — "a steady heart"
   TO SWAP TRACKS: just edit the TRACKS array below. Each entry is
   { title, file, note }. Files live in site/audio/.
   ============================================================ */
const TRACKS = [
  { title: "I sunk for you",               file: "audio/Sunk%20for%20you.mp3",                note: "End of the year" },
  { title: "Introduction to heartbreak",   file: "audio/Introduction%20to%20heartbreak.mp3",  note: "" },
];
const COVER_ART = "images/allison-album-artwork.png"; // "Finished Allison Album artwork end of the year.png"

let currentTrack = 0;
let audio = null;

function fmtTime(s){
  if(!isFinite(s) || s == null) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ":" + String(sec).padStart(2, "0");
}
function trackEl(i){ return document.querySelectorAll("#trackList button")[i]; }

function loadTrack(i, autoplay){
  currentTrack = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
  const t = TRACKS[currentTrack];
  if(!audio){
    audio = new Audio();
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onTimeUpdate);
    audio.addEventListener("ended", () => loadTrack(currentTrack + 1, true));
    audio.addEventListener("error", () => {
      const err = document.getElementById("playerMsg");
      if(err) err.textContent = "⚠ Couldn't load “" + t.title + "” — the file may be missing from the audio folder.";
    });
  }
  audio.src = t.file;
  document.getElementById("nowTitle").textContent = t.title;
  document.getElementById("nowNote").textContent = t.note || ("Track " + (currentTrack + 1) + " of " + TRACKS.length);
  document.querySelectorAll("#trackList button").forEach((b, bi) => b.classList.toggle("active", bi === currentTrack));
  if(autoplay) audio.play().catch(()=>{});
  updatePlayUI();
}
function togglePlay(){
  if(!audio){ loadTrack(currentTrack, true); return; }
  if(audio.paused) audio.play().catch(()=>{}); else audio.pause();
  updatePlayUI();
}
function nextTrack(){ loadTrack(currentTrack + 1, true); }
function prevTrack(){ loadTrack(currentTrack - 1, true); }
function updatePlayUI(){
  const playing = audio && !audio.paused;
  const shell = document.getElementById("cassette");
  if(shell) shell.classList.toggle("playing", !!playing);
  const btn = document.getElementById("playBtn");
  if(btn) btn.textContent = playing ? "⏸" : "▶";
}
function onTimeUpdate(){
  if(!audio) return;
  const bar = document.getElementById("seekBar");
  const cur = document.getElementById("timeCur"), tot = document.getElementById("timeTot");
  if(audio.duration && isFinite(audio.duration)){
    bar.max = Math.floor(audio.duration);
    bar.value = Math.floor(audio.currentTime);
    if(tot) tot.textContent = fmtTime(audio.duration);
  }
  if(cur) cur.textContent = fmtTime(audio.currentTime);
}
function seekTo(){
  const bar = document.getElementById("seekBar");
  if(audio && bar) audio.currentTime = parseFloat(bar.value);
}
function renderTrackList(){
  const list = document.getElementById("trackList");
  if(!list) return;
  list.innerHTML = TRACKS.map((t, i) =>
    `<button type="button" onclick="loadTrack(${i}, true)">
       <span class="num">${String(i + 1).padStart(2, "0")}</span>
       <span class="t-name">${t.title}${t.note ? " — " + t.note : ""}</span>
       <span class="t-len">▶</span>
     </button>`).join("");
}
function initPlayer(){
  renderTrackList();
  const cover = document.getElementById("coverArt");
  if(cover) cover.src = COVER_ART;
  loadTrack(0, false);
  const bar = document.getElementById("seekBar");
  if(bar) bar.addEventListener("input", seekTo);
  if(audio) audio.addEventListener("play", updatePlayUI);
  if(audio) audio.addEventListener("pause", updatePlayUI);
}
document.addEventListener("DOMContentLoaded", initPlayer);
