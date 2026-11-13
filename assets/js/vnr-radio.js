/* ============================================================
   VNR old-school radio — "a steady heart" station loop
   Plays audio/vnr-station-loop.mp3 on repeat: DJ intros,
   songs, a sponsor spot, and a thank-you — a taste of the
   station. The now-playing label follows the loop timeline.
   ============================================================ */
const VNR_LOOP_SRC = "audio/vnr-station-loop.mp3";
const VNR_LOOP_LEN = 674.056;
const VNR_SEGMENTS = [
  { start: 0,       end: 18.84,   label: "Slabb introduces — Break habits, not hearts", sub: "DJ Slabb · End of the year" },
  { start: 18.84,   end: 200.80,  label: "Break habits, not hearts",                  sub: "A Steady Heart · End of the year" },
  { start: 200.80,  end: 222.688, label: "Sponsor — Lead Paint Chips",                 sub: "The snack that makes you dumber" },
  { start: 222.688, end: 235.84,  label: "Slabb introduces — Sunk for you",            sub: "DJ Slabb · End of the year" },
  { start: 235.84,  end: 506.84,  label: "Sunk for you",                               sub: "A Steady Heart · End of the year" },
  { start: 506.84,  end: 539.408, label: "Thank-you — Vita Nova Records",              sub: "Rare Candy Reserve · Chris J / Ash" },
  { start: 539.408, end: 550.136, label: "Slabb introduces — Guess how it ends",       sub: "DJ Slabb · End of the year" },
  { start: 550.136, end: 674.056, label: "Guess how it ends",                          sub: "A Steady Heart · End of the year" },
];

let vnrAudio = null;

function vnrFmt(s){
  if(!isFinite(s) || s == null) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ":" + String(sec).padStart(2, "0");
}
function vnrSegment(t){
  for(const seg of VNR_SEGMENTS){
    if(t >= seg.start && t < seg.end) return seg;
  }
  return VNR_SEGMENTS[0];
}
function vnrUpdateUI(){
  const playing = vnrAudio && !vnrAudio.paused;
  const shell = document.getElementById("vnrRadio");
  if(shell) shell.classList.toggle("playing", !!playing);
  const btn = document.getElementById("vnrPlayBtn");
  if(btn) btn.textContent = playing ? "⏸" : "▶";
  const onair = document.getElementById("vnrOnAir");
  if(onair) onair.classList.toggle("lit", !!playing);
}
function vnrOnTime(){
  if(!vnrAudio) return;
  const t = vnrAudio.currentTime || 0;
  const seg = vnrSegment(t);
  const now = document.getElementById("vnrNow");
  const sub = document.getElementById("vnrSub");
  if(now) now.textContent = seg.label;
  if(sub) sub.textContent = seg.sub;
  const bar = document.getElementById("vnrSeek");
  if(bar){
    bar.max = Math.floor(VNR_LOOP_LEN);
    bar.value = Math.floor(t);
  }
  const cur = document.getElementById("vnrCur");
  const tot = document.getElementById("vnrTot");
  if(cur) cur.textContent = vnrFmt(t);
  if(tot) tot.textContent = vnrFmt(VNR_LOOP_LEN);
  const needle = document.getElementById("vnrNeedle");
  if(needle) needle.style.left = (2 + (t / VNR_LOOP_LEN) * 96) + "%";
}
function vnrToggle(){
  if(!vnrAudio){
    vnrAudio = new Audio(VNR_LOOP_SRC);
    vnrAudio.loop = true;
    vnrAudio.preload = "metadata";
    vnrAudio.addEventListener("timeupdate", vnrOnTime);
    vnrAudio.addEventListener("loadedmetadata", vnrOnTime);
    vnrAudio.addEventListener("play", vnrUpdateUI);
    vnrAudio.addEventListener("pause", vnrUpdateUI);
    vnrAudio.addEventListener("error", () => {
      const msg = document.getElementById("vnrMsg");
      if(msg) msg.textContent = "⚠ Couldn't load the station loop — the file may still be uploading.";
    });
  }
  if(vnrAudio.paused) vnrAudio.play().catch(()=>{});
  else vnrAudio.pause();
  vnrUpdateUI();
}
function vnrSeek(){
  const bar = document.getElementById("vnrSeek");
  if(vnrAudio && bar) vnrAudio.currentTime = parseFloat(bar.value);
}
function vnrInit(){
  const bar = document.getElementById("vnrSeek");
  if(bar) bar.addEventListener("input", vnrSeek);
  const tot = document.getElementById("vnrTot");
  if(tot) tot.textContent = vnrFmt(VNR_LOOP_LEN);
  vnrOnTime();
}
document.addEventListener("DOMContentLoaded", vnrInit);
