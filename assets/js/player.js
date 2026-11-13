/* ============================================================
   RCR cassette player — "a steady heart"
   TO SWAP TRACKS: just edit the TRACKS array below. Each entry is
   { title, file, note }. Files live in site/audio/.
   ============================================================ */
const TRACKS = [
  { title: "Break habits, not hearts", file: "audio/01%20-%20Break%20habits%2C%20not%20hearts.mp3", note: "End of the year" },
  { title: "Untold weapons", file: "audio/02%20-%20Untold%20weapons.mp3", note: "End of the year" },
  { title: "Voice inside my head original", file: "audio/03%20-%20Voice%20inside%20my%20head%20original.mp3", note: "End of the year" },
  { title: "Sunk for you", file: "audio/04%20-%20Sunk%20for%20you.mp3", note: "End of the year" },
  { title: "I'll prove everything", file: "audio/05%20-%20I%27ll%20prove%20everything.mp3", note: "End of the year" },
  { title: "Mr.Selfish", file: "audio/06%20-%20Mr.Selfish.mp3", note: "End of the year" },
  { title: "Sweet BBgirl", file: "audio/07%20-%20Sweet%20BBgirl.mp3", note: "End of the year" },
  { title: "Let's Travel", file: "audio/08%20-%20Let%27s%20Travel.mp3", note: "End of the year" },
  { title: "Straight to pieces", file: "audio/09%20-%20Straight%20to%20pieces.mp3", note: "End of the year" },
  { title: "The day she came to be", file: "audio/10%20-%20The%20day%20she%20came%20to%20be.mp3", note: "End of the year" },
  { title: "Djentlemen Thief", file: "audio/11%20-%20Djentlemen%20Thief.mp3", note: "End of the year" },
  { title: "Guess how it ends", file: "audio/12%20-%20Guess%20how%20it%20ends.mp3", note: "End of the year" },
  { title: "On top of it Feat. Chest Club", file: "audio/13%20-%20On%20top%20of%20it%20Feat.%20Chest%20Club.mp3", note: "End of the year" },
  { title: "Monster in disguise", file: "audio/14%20-%20Monster%20in%20disguise.mp3", note: "End of the year" },
  { title: "Stay until sunrise", file: "audio/15%20-%20Stay%20until%20sunrise.mp3", note: "End of the year" },
  { title: "Read between the lines", file: "audio/16%20-%20Read%20between%20the%20lines.mp3", note: "End of the year" },
  { title: "Introduction to heartache", file: "audio/17%20-%20Introduction%20to%20heartache.mp3", note: "End of the year" },
  { title: "We will meet again I swear", file: "audio/18%20-%20We%20will%20meet%20again%20I%20swear.mp3", note: "End of the year" },
  { title: "Dance till they drop", file: "audio/19%20-%20Dance%20till%20they%20drop.mp3", note: "End of the year" },
  { title: "Aiming to tease part 2", file: "audio/20%20-%20Aiming%20to%20tease%20part%202.mp3", note: "End of the year" },
  { title: "Give them the world", file: "audio/21%20-%20Give%20them%20the%20world.mp3", note: "End of the year" },
];
const COVER_ART = "images/end-of-the-year-cover.jpg";

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
