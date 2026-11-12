/* ============================================================
   VCR Coin — Daily Check-In + staking (STAGING, v1)
   Profiles, streaks, balances and rewards live in localStorage
   (per-device for now). VCR Coin is the Reserve's own SITE coin
   for now — NOT a real blockchain token (yet). Earn it by
   checking in; spend it on real shop rewards.
   ============================================================ */
const VCR_PROFILE_KEY = "rcr-profile";
const VCR_BALANCE_KEY = "rcr-vcr-balance";
const VCR_CHECKIN_KEY = "rcr-checkin";
const VCR_ROLL_KEY = "rcr-vcr-last-roll";
const VCR_DISCOUNT_KEY = "rcr-vcr-5pct";
const VCR_SPECIALS_UNLOCK_KEY = "rcr-vcr-specials-unlocked";
const VCR_SPECIALS_LIST_KEY = "rcr-vcr-specials";
const VCR_DEFAULT_SPECIALS = ["cat-glaceon", "cat-vulpix", "cat-pluspower"];
const VCR_DICE_DAYS = 7;
const VCR_CHECKIN_BONUS = 5;
const VCR_DICE_MULTIPLIER = 10;

const VCR_TIERS = {
  pct5:     { cost: 50,  label: "5% off your next order" },
  freeitem: { cost: 100, label: "Free item — your pick" },
  specials: { cost: 250, label: "VCR Specials — 15% off special items in your cart" }
};
const VCR_FREE_ITEMS = [
  { id: "cat-cyberjudge", name: "Pokémon Cyber Judge booster pack", was: 5.99 },
  { id: "retro-keychain", name: "Retro Console Keychain", was: 12.00 }
];

/* ---------- tiny storage helpers ---------- */
function vcrStoreGet(key, fallback){
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
  catch(e){ return fallback; }
}
function vcrStoreSet(key, val){
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){}
}
function vcrStoreGetStr(key){
  try { return localStorage.getItem(key); } catch(e){ return null; }
}

/* ---------- dates (local calendar days) ---------- */
function vcrDayStr(d){
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
  return y + "-" + m + "-" + day;
}
function vcrTodayStr(){ return vcrDayStr(new Date()); }
function vcrYesterdayStr(){ const d = new Date(); d.setDate(d.getDate()-1); return vcrDayStr(d); }

/* ---------- profile + balance ---------- */
function vcrGetProfile(){ return vcrStoreGet(VCR_PROFILE_KEY, null); }
function vcrSaveProfile(name){
  const clean = String(name || "").trim().slice(0, 24);
  if(!clean) return null;
  const p = { name: clean, createdAt: vcrTodayStr() };
  vcrStoreSet(VCR_PROFILE_KEY, p);
  return p;
}
function vcrGetBalance(){
  const b = vcrStoreGet(VCR_BALANCE_KEY, 0);
  return (typeof b === "number" && isFinite(b) && b > 0) ? Math.floor(b) : 0;
}
function vcrAddCoins(n){
  const next = vcrGetBalance() + Math.floor(n);
  vcrStoreSet(VCR_BALANCE_KEY, next);
  return next;
}
function vcrSpendCoins(n){
  if(vcrGetBalance() < n) return false;
  vcrStoreSet(VCR_BALANCE_KEY, vcrGetBalance() - n);
  return true;
}

/* ---------- daily check-in + streak ---------- */
function vcrGetCheckin(){ return vcrStoreGet(VCR_CHECKIN_KEY, { lastDate: null, streak: 0, total: 0 }); }
function vcrCheckinStatus(){
  const s = vcrGetCheckin();
  const today = vcrTodayStr();
  /* A streak is only alive if the last check-in was today or yesterday;
     anything older means a day was missed and the streak is already broken. */
  const alive = s.lastDate === today || s.lastDate === vcrYesterdayStr();
  const streak = alive ? (s.streak || 0) : 0;
  return {
    checkedInToday: s.lastDate === today,
    streak: streak,
    total: s.total || 0,
    daysToDice: Math.max(0, VCR_DICE_DAYS - streak),
    diceUnlocked: streak >= VCR_DICE_DAYS
  };
}
function vcrCheckIn(){
  const s = vcrGetCheckin();
  const today = vcrTodayStr();
  if(s.lastDate === today) return { ok: false, already: true, streak: s.streak || 0, bonus: 0 };
  const streak = (s.lastDate === vcrYesterdayStr()) ? (s.streak || 0) + 1 : 1;
  const next = { lastDate: today, streak: streak, total: (s.total || 0) + 1 };
  vcrStoreSet(VCR_CHECKIN_KEY, next);
  const balance = vcrAddCoins(VCR_CHECKIN_BONUS);
  return { ok: true, already: false, streak: streak, bonus: VCR_CHECKIN_BONUS, balance: balance };
}

/* ---------- d20 dice (unlocked at a 7-day streak, one roll per day) ---------- */
function vcrGetLastRoll(){ return vcrStoreGet(VCR_ROLL_KEY, null); }
function vcrCanRoll(){
  const st = vcrCheckinStatus();
  const lr = vcrGetLastRoll();
  return st.diceUnlocked && !(lr && lr.date === vcrTodayStr());
}
function vcrRollDice(){
  if(!vcrCanRoll()) return null;
  const roll = 1 + Math.floor(Math.random() * 20);
  const coins = roll * VCR_DICE_MULTIPLIER;
  vcrStoreSet(VCR_ROLL_KEY, { date: vcrTodayStr(), roll: roll });
  const balance = vcrAddCoins(coins);
  return { roll: roll, coins: coins, balance: balance };
}

/* ---------- staking ---------- */
function vcrDiscountActive(){ return vcrStoreGetStr(VCR_DISCOUNT_KEY) === "1"; }
function vcrSpecialsActive(){ return vcrStoreGetStr(VCR_SPECIALS_UNLOCK_KEY) === "1"; }
function vcrGetSpecials(){
  const list = vcrStoreGet(VCR_SPECIALS_LIST_KEY, null);
  return (Array.isArray(list) && list.length) ? list : VCR_DEFAULT_SPECIALS.slice();
}
function vcrSetSpecials(ids){ vcrStoreSet(VCR_SPECIALS_LIST_KEY, ids); }
function vcrIsSpecial(id){ return vcrGetSpecials().indexOf(id) !== -1; }
function vcrStake(tierId, optionId){
  const tier = VCR_TIERS[tierId];
  if(!tier) return { ok: false, msg: "Unknown reward." };
  if(vcrGetBalance() < tier.cost){
    return { ok: false, msg: "Not enough VCR Coin — you need " + (tier.cost - vcrGetBalance()) + " more." };
  }
  if(tierId === "pct5"){
    if(vcrDiscountActive()) return { ok: false, msg: "Your 5% reward is already active — use it on your next order first." };
    if(!vcrSpendCoins(tier.cost)) return { ok: false, msg: "Not enough VCR Coin." };
    try { localStorage.setItem(VCR_DISCOUNT_KEY, "1"); } catch(e){}
    return { ok: true, msg: "Staked " + tier.cost + " VCR Coin — 5% off your next order is now active. It applies in your cart and is used up when you place the order." };
  }
  if(tierId === "freeitem"){
    const opt = VCR_FREE_ITEMS.find(o => o.id === optionId) || VCR_FREE_ITEMS[0];
    if(!vcrSpendCoins(tier.cost)) return { ok: false, msg: "Not enough VCR Coin." };
    try {
      if(typeof cart !== "undefined" && typeof saveCart === "function"){
        cart.push({ id: opt.id, qty: 1, varLabel: "🎲 VCR free reward", varPrice: 0 });
        saveCart();
      }
    } catch(e){}
    return { ok: true, msg: "Staked " + tier.cost + " VCR Coin — " + opt.name + " added to your cart FREE (was $" + opt.was.toFixed(2) + ").", openCart: true };
  }
  if(tierId === "specials"){
    if(vcrSpecialsActive()) return { ok: false, msg: "VCR Specials are already unlocked." };
    if(!vcrSpendCoins(tier.cost)) return { ok: false, msg: "Not enough VCR Coin." };
    try { localStorage.setItem(VCR_SPECIALS_UNLOCK_KEY, "1"); } catch(e){}
    return { ok: true, msg: "Staked " + tier.cost + " VCR Coin — VCR Specials unlocked! Special items are now 15% off in your cart." };
  }
  return { ok: false, msg: "Unknown reward." };
}

/* ---------- home-page UI (only runs where #vcrCard exists) ---------- */
function vcrEl(id){ return document.getElementById(id); }
function vcrSetText(id, t){ const el = vcrEl(id); if(el) el.textContent = t; }
function vcrShow(id, on){ const el = vcrEl(id); if(el) el.style.display = on ? "" : "none"; }

function vcrRender(){
  if(!vcrEl("vcrCard")) return;
  const profile = vcrGetProfile();
  vcrShow("vcrProfileSetup", !profile);
  vcrShow("vcrProfileView", !!profile);
  if(profile){
    vcrSetText("vcrProfileName", profile.name);
    document.querySelectorAll("[data-vcr-balance]").forEach(el => { el.textContent = vcrGetBalance(); });
  }
  const st = vcrCheckinStatus();
  vcrSetText("vcrStreak", String(st.streak));
  vcrSetText("vcrStreakLine", st.checkedInToday
    ? "Checked in today ✓ — streak " + st.streak + " day" + (st.streak === 1 ? "" : "s") + "."
    : (st.streak > 0
      ? "Streak: " + st.streak + " day" + (st.streak === 1 ? "" : "s") + " — check in to keep it alive."
      : "No streak yet — check in to start one."));
  vcrSetText("vcrDaysToDice", st.diceUnlocked ? "🎲 Dice unlocked!" : st.daysToDice + " more day" + (st.daysToDice === 1 ? "" : "s") + " to the d20");
  const btn = vcrEl("vcrCheckinBtn");
  if(btn){
    btn.disabled = st.checkedInToday;
    btn.textContent = st.checkedInToday ? "✓ Checked in today" : "✅ Check in today (+5 🪙)";
  }
  /* dice */
  const canRoll = vcrCanRoll();
  const die = vcrEl("vcrDie");
  const lr = vcrGetLastRoll();
  if(die && !die.classList.contains("rolling")){
    die.textContent = (lr && lr.date === vcrTodayStr()) ? String(lr.roll) : "20";
  }
  const rollBtn = vcrEl("vcrRollBtn");
  if(rollBtn){
    rollBtn.disabled = !canRoll;
    rollBtn.textContent = !st.diceUnlocked
      ? "🔒 Roll the d20 — unlocks at a 7-day streak"
      : (canRoll ? "🎲 Roll the d20!" : "🎲 Already rolled today — come back tomorrow");
  }
  vcrShow("vcrDiceLocked", !st.diceUnlocked);
  /* staking */
  const bal = vcrGetBalance();
  const pctBtn = vcrEl("vcrTierPct5Btn");
  if(pctBtn) pctBtn.disabled = bal < VCR_TIERS.pct5.cost || vcrDiscountActive();
  const freeBtn = vcrEl("vcrTierFreeBtn");
  if(freeBtn) freeBtn.disabled = bal < VCR_TIERS.freeitem.cost;
  const spBtn = vcrEl("vcrTierSpecialsBtn");
  if(spBtn) spBtn.disabled = bal < VCR_TIERS.specials.cost || vcrSpecialsActive();
  if(vcrDiscountActive()) vcrSetText("vcrTierPct5Msg", "ACTIVE — applies to your next order.");
  if(vcrSpecialsActive()) vcrSetText("vcrTierSpecialsMsg", "UNLOCKED — specials are 15% off in your cart.");
  vcrSetText("vcrSpecialsList", vcrGetSpecials().map(id => {
    const it = (typeof findItem === "function") ? findItem(id) : null;
    return it ? it.name : id;
  }).join(" · "));
}

function vcrCreateProfile(){
  const input = vcrEl("vcrNameInput");
  const p = vcrSaveProfile(input ? input.value : "");
  if(!p){ vcrSetText("vcrProfileMsg", "Pick a display name first."); return; }
  vcrSetText("vcrProfileMsg", "");
  vcrRender();
}
function vcrCheckInUI(){
  const r = vcrCheckIn();
  if(!r.ok && r.already){ vcrSetText("vcrCheckinMsg", "Already checked in today — come back tomorrow."); return; }
  vcrSetText("vcrCheckinMsg", "✓ Checked in! +" + r.bonus + " VCR Coin. Streak: " + r.streak + " day" + (r.streak === 1 ? "" : "s") + ".");
  vcrRender();
}
function vcrRollDiceUI(){
  if(!vcrCanRoll()) return;
  const die = vcrEl("vcrDie"), btn = vcrEl("vcrRollBtn");
  if(!die) return;
  if(btn) btn.disabled = true;
  die.classList.add("rolling");
  let ticks = 0;
  const iv = setInterval(() => {
    die.textContent = String(1 + Math.floor(Math.random() * 20));
    ticks++;
    if(ticks >= 16){
      clearInterval(iv);
      const r = vcrRollDice();
      die.classList.remove("rolling");
      die.classList.add("landed");
      if(r){
        die.textContent = String(r.roll);
        vcrSetText("vcrRollResult", "🎲 You rolled " + r.roll + " → " + r.roll + " × 10 = " + r.coins + " VCR Coin! New balance: " + r.balance + " 🪙");
      }
      setTimeout(() => { if(die) die.classList.remove("landed"); }, 1200);
      vcrRender();
    }
  }, 95);
}
function vcrStakeUI(tierId){
  const opt = tierId === "freeitem" ? (vcrEl("vcrFreeItem") ? vcrEl("vcrFreeItem").value : null) : null;
  const r = vcrStake(tierId, opt);
  const msgId = tierId === "pct5" ? "vcrTierPct5Msg" : tierId === "freeitem" ? "vcrTierFreeMsg" : "vcrTierSpecialsMsg";
  vcrSetText(msgId, r.msg);
  vcrRender();
  if(r.ok && r.openCart && typeof openCart === "function") openCart();
}
function vcrInitUI(){
  if(!vcrEl("vcrCard")) return;
  vcrRender();
  const form = vcrEl("vcrProfileForm");
  if(form) form.addEventListener("submit", e => { e.preventDefault(); vcrCreateProfile(); });
}
if(typeof document !== "undefined" && document.addEventListener){
  document.addEventListener("DOMContentLoaded", vcrInitUI);
}
