/* ============================================================
   Rare Candy Reserve — shared site JS
   Single shared script for all pages. Cart is client-side only
   (localStorage). No backend, no real payments.
   ============================================================ */
const STRIPE_PUBLISHABLE_KEY = "pk_live_51U2qoIQpMlvNGy77xhL3IChHqa8IbKKalGIkIkdbP5dBZTnGULeHtYxOXTnIse5uu0OHBLtPmjikPGxhgmeSgnxV00CBibaT2E"; // LIVE publishable key — public by design, safe in frontend code
const SHOP_CONTACT_EMAIL = "asteadyheartmusic@gmail.com"; // shop contact email
// PAYPAL: set this to the PayPal Business email once Ash gives it — then PayPal cart checkout is fully automated (buyer pays on PayPal, PayPal notifies the shop, no invoice from Ash). Do NOT put a password or secret here.
const PAYPAL_EMAIL = "7acrewoodnursery@gmail.com"; // PayPal Business email, given by Chris 2026-11-10 — automated PayPal cart checkout
const ALLMYLINKS_URL = "https://allmylinks.com/Ashmusic";

/* Verified music/social links (from Ash's AllMyLinks page, 2026-11-06).
   NO Pandora link exists on that page — do not add one. */
const MUSIC_LINKS = {
  spotify:  "https://open.spotify.com/artist/5Yu8YngzEdVTot78vdFgnB?si=VS_KNNypRvWCdnMHzqO6FQ",
  apple:    "https://music.apple.com/us/artist/a-steady-heart/1870402975",
  youtube:  "https://www.youtube.com/watch?v=ZP8E9h7V6_E",
  iheart:   "https://www.iheart.com/artist/a-steady-heart-49338635/songs/grew-in-the-wrong-direction-406660075",
  soundcloud: "https://soundcloud.com/ASteadyHeart",
  lyrics:   "https://lyricsondemand.com/a_steady_heart",
  facebook: "https://facebook.com/ASteadyheartmusic",
  vote:     "https://distrokid.com/spotlight/asteadyheart/vote/",
  hyperfollow: "https://distrokid.com/hyperfollow/asteadyheart/grew-in-the-wrong-direction",
  donate:   "https://buy.stripe.com/6oU14p4MW7MFeBy57c6sw00"
};

/* ---------- Steady Heart Radio time-of-day banner ----------
   Decorative banner art on the home + podcast heroes. Swapped on load
   from the visitor's LOCAL time — morning 05:00–11:59, afternoon
   12:00–17:59, night 18:00–04:59. Any <img data-radio-banner> gets
   swapped; an optional [data-radio-banner-caption] gets the label. */
const RADIO_BANNERS = {
  morning:   { src: "images/radio-morning.jpg",   label: "Steady Heart Radio — morning" },
  afternoon: { src: "images/radio-afternoon.jpg", label: "Steady Heart Radio — afternoon" },
  night:     { src: "images/radio-night.jpg",     label: "Steady Heart Radio — night" }
};
function radioBannerForHour(h){
  if(h >= 5 && h < 12) return RADIO_BANNERS.morning;
  if(h >= 12 && h < 18) return RADIO_BANNERS.afternoon;
  return RADIO_BANNERS.night;
}
function setTimeOfDayBanner(){
  const img = document.querySelector("img[data-radio-banner]");
  if(!img) return;
  const b = radioBannerForHour(new Date().getHours());
  img.src = b.src;
  img.alt = b.label + " — Steady Heart Radio art";
  const cap = document.querySelector("[data-radio-banner-caption]");
  if(cap) cap.textContent = b.label;
}

/* ---------- shop data (copy + prices verbatim from the live site / eBay) ---------- */
const PRODUCTS = [
  {id:"airpods-vice-case", slug:"airpods-vice-case", tag:"3D PRINT · RCR Brand PETG", name:"Neon Vice AirPods Pro Case Cover — Teal & Hot Pink",
   desc:"Custom 3D-printed hard-shell cover for AirPods Pro 2nd generation (USB-C) — hot pink lid, teal base, embossed palms, VI emblem and Vice City script on the lid. Snug fit, lid opens free, cutouts for charging + pairing button, lanyard loop ready. AirPods and charging case NOT included — cover only. Unofficial fan-inspired design; not affiliated with Apple Inc. or Rockstar Games.",
   price:22.00, stripe:"https://buy.stripe.com/cNi28tbbk7MF652gPU6sw03", ship:"+ shipping (by location)", icon:"🎧",
   imgs:["images/airpods-case-closed.jpg"]},
  {id:"dnd-dice-set", slug:"dnd-dice-set", tag:"CUSTOM · Tabletop Dice", name:"Custom Set of D&D Dice — Choose Two Colors",
   desc:"Custom 3D-printed set of D&D dice. Choose two colors: red, yellow, white, blue, black, pink, or green. No satchel included — the satchel was sold.",
   price:18.00, ship:"+ shipping (by location)", icon:"🎲", stripe:"https://buy.stripe.com/00w3cxbbkd6ZdxubvA6sw02",
   imgs:["images/dice-3d-printed.jpg"]},
  {id:"amby-deck", slug:"modded-amby-deck", tag:"HANDHELD · Modded Amby Deck", name:"Modded Amby Deck — Fully Modded Handheld (Choose Black or Pink)",
   desc:"Fully modded and playable — faster than most PCs out of the box. Big 120Hz touchscreen, RGB backlit sticks, 8GB RAM + 128GB storage, Android. Plays PS2, GameCube, 3DS, PSP and Dreamcast, plus PC games via Winlator. Loaded with free ports and cool stuff. Protective case + wrist strap included, modded to order. (we do not condone piracy of any kind)",
   price:220.00, ship:"+ shipping (by location)", icon:"🎮",
   imgs:["images/amby-deck-two.jpg"],
   variations:[{label:"Black", price:220.00},{label:"Pink", price:220.00}]},
  {id:"retro-keychain", slug:"retro-keychain", tag:"MINI PRINT · 3D Print", name:"Retro Console Keychain",
   desc:"Miniature handheld consoles, printed to order. Pick your console — Game Boy, GBA SP, DS, Switch, and more.",
   price:12.00, stripe:"https://buy.stripe.com/cNi8wRbbkeb3ali8jo6sw05", ship:"free shipping if bundled · solo: shipping by location", icon:"🎮",
   imgs:["images/pokemon-keychains.jpg"]},
];
/* Live eBay inventory — titles + prices exact (verified 2026-11-06).
   Photos wired from Ash's Drive (drive-photo-map.md, 2026-11-09); Sunflora still has
   no photo in Drive — it keeps the placeholder until he sends one.
   Variation labels for Beholder / extender are unknown — shown as Variation 1/2/3, Style 1/2.
   comingSoon entries are photographed but unpriced (no price, not buyable);
   draft entries are approved but not posted yet (price shown, not buyable). */
const CATALOG = [
  {id:"cat-gengar", slug:"gengar-cgc9", ebay:"168803766775", icon:"👻", tag:"Graded Card · CGC 9", name:"CGC 9 Gengar ex 047/071 Japanese Wild Force", price:22.00, img:null, outOfStock:true,
   imgs:["images/gengar-ex-front.jpg"]},
  {id:"cat-cyberjudge", slug:"cyber-judge-pack", ebay:"168803775765", icon:"🃏", tag:"Sealed Pack", name:"Pokemon Cyber Judge sv5M Japanese Booster Pack", price:5.99, stripe:"https://buy.stripe.com/3cIeVf1AK6IB9he7fk6sw07", ship:"+ $2.00 shipping", img:null,
   imgs:["images/cyber-judge-pack-front.jpg"]},
  {id:"cat-beholder", slug:"beholder-mini", ebay:"168803858135", icon:"👁", tag:"Tabletop Miniature", name:"3D Printed Beholder Tabletop Miniature", price:15.00, img:null,
   imgs:["images/mini-beholder-group.jpg"],
   variations:[{label:"Variation 1", price:20.00},{label:"Variation 2", price:28.00},{label:"Variation 3", price:60.00}]},
  {id:"cat-pluspower", slug:"pluspower-psa9", ebay:"168804953637", icon:"⚡", tag:"Graded Card · PSA 9", name:"PSA 9 1998 Japanese PlusPower Gym Deck Trainer", price:42.00, stripe:"https://buy.stripe.com/00wdRb6V47MFfFCfLQ6sw08", img:null,
   imgs:["images/pluspower-psa9-front.jpg"]},
  {id:"cat-turok", slug:"turok-lot", ebay:"168390092126", icon:"🦖", tag:"Comic Lot", name:"Turok Comic Lot Gold Foil #1 + Turok #1-3 Blood Hunt + N64 Pin", price:35.00, stripe:"https://buy.stripe.com/4gM9AV1AKaYR3WU9ns6sw09", img:null,
   imgs:["images/turok-1.jpg"]},
  {id:"cat-xmen", slug:"xmen-lot", ebay:"168390280510", icon:"❌", tag:"Comic Lot", name:"Marvel X-Men / Mutant 6-comic Starter Collection", price:38.00, stripe:"https://buy.stripe.com/aFa3cx6V46IBfFCbvA6sw0a", img:null,
   imgs:["images/xmen-xforce-1.jpg"]},
  {id:"cat-sunflora", slug:"sunflora-cgc10", ebay:"168711754988", icon:"🌻", tag:"Graded Card · CGC Pristine 10", name:"2024 Sunflora AR 102/101 CGC Pristine 10", price:30.00, stripe:"https://buy.stripe.com/5kQbJ31AKeb38daarw6sw0b", img:null},
  {id:"cat-glaceon", slug:"glaceon-vmax", ebay:"168818972853", icon:"❄️", tag:"Graded Card · CGC 8.5", name:"CGC 8.5 Glaceon VMAX 041/203 Evolving Skies", price:12.00, stripe:"https://buy.stripe.com/9B67sNbbkeb39heczE6sw0d", img:null,
   imgs:["images/glaceon-vmax-front.jpg"]},
  {id:"cat-rayquaza", slug:"rayquaza-v", ebay:"168818990115", icon:"🐉", tag:"Graded Card · CGC 9", name:"CGC 9 Rayquaza V 107/172 Japanese VSTAR Universe", price:18.00, img:null, outOfStock:true,
   imgs:["images/rayquaza-v-front.jpg"]},
  {id:"cat-vulpix", slug:"vulpix-v", ebay:"168819002299", icon:"🦊", tag:"Graded Card · CGC 8.5", name:"CGC 8.5 Alolan Vulpix V 033/195 Silver Tempest", price:12.00, stripe:"https://buy.stripe.com/6oU9AV1AKff7alidDI6sw0e", img:null,
   imgs:["images/vulpix-v-front.jpg"]},
  /* Copperajah draft — approved $15.00 price, NOT posted to eBay yet. Do not make it buyable. */
  {id:"cat-copperajah", slug:"copperajah-cgc10", ebay:null, icon:"🐘", tag:"Graded Card · CGC 10 · DRAFT", name:"CGC 10 Copperajah ex 088/071 Japanese Snow Hazard", price:15.00, img:null,
   imgs:["images/copperajah-ex-front.jpg"],
   desc:"Draft listing — approved price $15.00, not posted to eBay yet. CGC GEM MINT 10, cert 6102490197, 300 HP, Snow Hazard 088/071 Super Rare Holo."},
  /* New slabs — photographed, not priced yet. comingSoon: show photo + assessment, no price, not buyable. */
  {id:"cat-spearow", slug:"spearow-psa10", ebay:null, icon:"🐦", tag:"Graded Card · PSA 10", name:"Spearow — Art Rare, PSA 10 GEM MT", price:40.00, img:null,
   imgs:["images/spearow-psa10-front.jpg"],
   desc:"Spearow, 2025 Pokémon M1L JP #074, Art Rare, Japanese. PSA GEM MT 10, cert 127913713."},
  {id:"cat-mrmime", slug:"sabrinas-mr-mime", ebay:null, icon:"🎩", tag:"Graded Card · CGC 9", name:"Sabrina's Mr. Mime — CGC 9 MINT", price:null, img:null, comingSoon:true,
   imgs:["images/sabrina-mr-mime-front.jpg"],
   desc:"Sabrina's Mr. Mime, Pokémon (1999) Japanese, Gym 2: Challenge from the Darkness. CGC MINT 9, cert 6016734017."},
  {id:"cat-grovyle", slug:"grovyle-cgc9", ebay:null, icon:"🦎", tag:"Graded Card · CGC 9 · SOLD OUT", name:"Grovyle — Reverse Holo, CGC 9 MINT", price:null, img:null, outOfStock:true,
   imgs:["images/grovyle-cgc9-front.jpg"],
   desc:"Grovyle, Pokémon (2009), Arceus 39/99, Reverse Holo. Attacks Quick Attack / Cut, 80 HP. CGC MINT 9, cert 6098149057."},
  /* Unpriced inventory (Drive photo map, section C) — assessment-based filler until Ash prices them. */
  {id:"cat-mewtwo-ex", slug:"mewtwo-ex-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Mewtwo ex — XY Black Star Promo XY107, Raw (170 HP)", price:50.00, img:null,
   imgs:["images/mewtwo-ex-raw.jpg"],
   desc:"Mewtwo ex, XY Black Star Promo XY107, 170 HP, Shatter Shot / Damage Change. Pristine condition — this card grades for a lot: a PSA 10 of this exact card sells for $1,050+ (PriceCharting $1,225). Authenticity and shape of the card guaranteed. Comes in a penny sleeve + top loader with the red/white 3D-printed slab bumper on a stand. PLUS a FREE surprise Mew card included with your order. Best Offer accepted — message the shop."},
  {id:"cat-mewtwo-130", slug:"mewtwo-130-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Mewtwo — Raw (130 HP)", price:8.00, img:null,
   imgs:["images/mewtwo-130-raw.jpg"],
   desc:"Raw Mewtwo, 130 HP, attacks Life Sucker (20) / Psy Burn (110). Sleeved. Best Offer accepted — strong grading potential, message the shop."},
  {id:"cat-lycanroc", slug:"lycanroc-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Lycanroc — Raw (120 HP)", price:3.00, img:null,
   imgs:["images/lycanroc-raw.jpg"],
   desc:"Raw Lycanroc, Stage 1, 120 HP. Ability Spike Clad; attack Clamping Fangs 40+. Sleeved."},
  {id:"cat-volcanion", slug:"volcanion-firered", ebay:null, icon:"🃏", tag:"Raw Card · Game", name:"Volcanion Cards + Pokémon FireRed GBA", price:100.00, img:null,
   imgs:["images/volcanion-firered.jpg"],
   desc:"Two Volcanion cards (130 HP, one English, one Japanese) plus a Pokémon FireRed GBA cartridge in a clear case, photographed with an Eevee keychain."},
  {id:"cat-zekrom-ex", slug:"zekrom-ex-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Zekrom ex — Raw, Japanese (230 HP)", price:5.00, img:null,
   imgs:["images/zekrom-ex-raw.jpg"],
   desc:"Raw Zekrom ex, Japanese, 230 HP, black card. Sleeved; single front photo with some glare."},
  {id:"cat-mimikyu", slug:"mimikyu-gx-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Mimikyu Horror House GX — Raw", price:300.00, img:null,
   imgs:["images/mimikyu-gx-raw.jpg"],
   desc:"Raw Mimikyu TAG TEAM GX card (Horror House GX). Sleeved, held in hand. Best Offer accepted — strong grading potential (PSA 10 is 5–8x raw), message the shop."},
  {id:"cat-ex-trio", slug:"ex-trio-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Gengar ex + Zekrom ex + Koraidon ex — Raw", price:10.00, img:null,
   imgs:["images/ex-trio-raw.jpg"],
   desc:"Three raw ex cards: Gengar ex (Japanese), Zekrom ex (Japanese, 230 HP), Koraidon ex (230 HP, Wild Impact). Loose group shot."},
  {id:"cat-cubone", slug:"cubone-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Cubone — Raw", price:3.00, img:null,
   imgs:["images/cubone-raw.jpg"],
   desc:"Raw Cubone, yellow-border card, 40 HP era. Sleeved."},
  {id:"cat-toploader-display", slug:"toploader-display-green", ebay:null, icon:"🖼️", tag:"3D PRINT · Display", name:"3D-Printed Toploader Display Frame — Green", price:15.00, img:null,
   imgs:["images/reshiram-zekrom-gx-charizard.jpg"],
   desc:"Green 3D-printed toploader display frame — holds your card up for display. Frame only; cards shown are for display only and are NOT included. Best Offer accepted — message the shop."},
  {id:"cat-mega-evo", slug:"mega-evolution-packs", ebay:null, icon:"🃏", tag:"Sealed Pack", name:"Pokémon Mega Evolution Sealed Booster Packs", price:8.00, img:null,
   imgs:["images/mega-evolution-pack.jpg"],
   desc:"Sealed Pokémon TCG Mega Evolution booster packs (10 additional game cards), English. At least 2 packs on hand."},
  {id:"cat-jp-pack", slug:"japanese-pack-pink", ebay:null, icon:"🃏", tag:"Sealed Pack", name:"Sealed Japanese Booster Pack — Pink/Red Art", price:5.00, img:null,
   imgs:["images/japanese-pack-pink.jpg"],
   desc:"Sealed Japanese booster pack, pink/red art, barcode 4 521329 283982. Set name not readable from the photos."},
  {id:"cat-babe-ruth", slug:"babe-ruth-tin", ebay:null, icon:"⚾", tag:"Sports Card", name:"Babe Ruth Metallic Impressions Collector Tin + 6-Card Set", price:18.00, img:null,
   imgs:["images/babe-ruth-tin.jpg"],
   desc:"Metallic Impressions “Special 6-Card Babe Ruth Edition” collector tin with the 6-card set — batting pose, “NEW YORK” jersey, pitching pose, and holding-bats designs, fronts and backs with bio/stats text."},
  {id:"cat-earthworm-jim", slug:"earthworm-jim-2", ebay:null, icon:"🪱", tag:"Comic · Figure", name:"Earthworm Jim #2 Comic + Figure", price:60.00, img:null,
   imgs:["images/earthworm-jim-2.jpg"],
   desc:"Earthworm Jim #2 (Marvel) front cover plus a small Earthworm Jim figure."},
  {id:"cat-buster-sword", slug:"buster-sword-keychain", ebay:null, icon:"🔑", tag:"Keychain", name:"Cloud's Buster Sword Keychain (Final Fantasy VII)", price:15.00, img:null,
   imgs:["images/buster-sword-keychain.jpg"],
   desc:"Black metal Buster Sword keychain."},
  {id:"cat-shield", slug:"pokemon-shield-switch-loose", ebay:null, icon:"🎮", tag:"Video Game · Loose Cart", name:"Pokémon Shield — Nintendo Switch, Loose Cartridge Only", price:29.99, stripe:"https://buy.stripe.com/5kQeVf7Z87MFgJG7fk6sw0f", img:null,
   imgs:["images/pokemon-shield-cart-1.jpg","images/pokemon-shield-cart-2.jpg","images/pokemon-shield-cart-3.jpg"],
   desc:"Pokémon Shield (2019) for Nintendo Switch — loose cartridge only, no case or box. Tested working. Fair eBay loose price — recent sold listings $25–$35."},
  {id:"cat-deadlands-lot", slug:"deadlands-lot-25", ebay:null, icon:"🃏", tag:"TCG Lot · Deadlands", name:"Deadlands TCG — Shrink-Wrapped Lot, 25 Cards", price:12.00, stripe:"https://buy.stripe.com/8x28wR0wG9UN3WU9ns6sw0g", img:null,
   imgs:["images/placeholder.svg"],
   desc:"25 Deadlands cards, shrink-wrapped as a lot. Best quantity for a playable / collectible starter lot — 25 cards, mixed."},
  {id:"cat-custom-mini", slug:"custom-mini", ebay:null, icon:"♟", tag:"Custom Miniature", name:"Custom Tabletop Mini — Choose a Type or Design Your Own", price:12.00, img:null,
   imgs:["images/mini-beholder-group.jpg"],
   variations:[{label:"Standard mini — from $12", price:12.00},{label:"Beholder — $20", price:20.00},{label:"Dragon — $25", price:25.00},{label:"Knight / Paladin — $18", price:18.00},{label:"Wizard — $18", price:18.00},{label:"Rogue — $18", price:18.00},{label:"Design your own — $25", price:25.00}],
   desc:"Order a custom tabletop mini: pick a type — Beholder, Dragon, Knight/Paladin, Wizard, Rogue — or design your own and describe it in the custom order form. Printed to order."},
  {id:"cat-trimui-smart-pro", slug:"trimui-smart-pro-modded", ebay:null, icon:"🎮", tag:"Handheld · Modded TSP", name:"TSP — Modded Trimui Smart Pro (CrossMix, 128GB Card, Pink Case + Wrist Strap)", price:99.00, img:null,
   imgs:["images/trimui-smart-pro.jpg","images/trimui-smart-pro-black.jpg"],
   desc:"Modded TSP (Trimui Smart Pro) — better than stock. CrossMix OS installed, fresh 128GB name-brand microSD (stock card replaced), pink protective case + wrist strap included. Big 4.96-inch 720p screen, RGB-lit sticks, 5000mAh battery. Plays PS1, PSP, DS and more full speed, plus Morrowind, GTA and PC classics via PortMaster. Loaded with free ports and cool stuff. Modded to order — ready to play out of the box. (we do not condone piracy of any kind)"},
  {id:"cat-ambyrg", slug:"modded-ambyrg-rg476h", ebay:null, icon:"🎮", tag:"Handheld · Modded AmbyRG", name:"Modded AmbyRG — Anbernic RG476H in All Its Glory", price:179.00, img:null,
   imgs:["images/anbernic-rg476h-rgb.jpg","images/anbernic-rg476h.jpg"],
   desc:"Modded AmbyRG — the Anbernic RG476H in all its glory. Gorgeous 4.7-inch 120Hz touchscreen, RGB backlit sticks that glow blue, pink and cyan, Hall-effect sticks, 8GB RAM + 128GB storage, Android 13. Plays PS2, GameCube, 3DS, PSP and Dreamcast, plus Android apps and PC games via Winlator (Oblivion runs at low settings). Protective case + wrist strap included. Modded to order — ready to play out of the box. (we do not condone piracy of any kind)"},
];
const SOON = [
  {icon:"🃏", tag:"Graded Card", name:"PSA 9–10 slab, rotating stock", price:"Priced per card", note:"Listings loading soon"},
  {icon:"📚", tag:"Comic", name:"Mint / NM back issues", price:"Priced per issue", note:"Listings loading soon"},
  {icon:"♟", tag:"Miniature", name:"Custom-printed tabletop mini", price:"From $12", note:"Order via Character Forge"},
  {icon:"🔮", tag:"Planter", name:"Crystal-cluster planter print", price:"From $18", note:"Listings loading soon"},
  {icon:"🥧", tag:"Tech", name:"Printed Raspberry Pi enclosure", price:"From $15", note:"Listings loading soon"},
  {icon:"🎴", tag:"Manga", name:"Volume sets, various series", price:"Priced per volume", note:"Listings loading soon"},
  {icon:"💠", tag:"TCG Singles", name:"Singles across major TCGs", price:"Priced per card", note:"Listings loading soon"},
  {icon:"🗡", tag:"Cosplay", name:"LARP-ready prop weapon", price:"Quote on request", note:""},
];
const SERVICES = [
  ["🧊","High-grade 3D printing","PLA+ and PETG, eco-friendly stock, any color. Full custom jobs welcome."],
  ["🪴","Plant & mycology prints","Crystal planters, mushroom stands, and terrarium pieces printed to order."],
  ["🛡","Graded cards","PSA and CGC 8.5–10, every listing professionally authenticated before it ships."],
  ["🎨","Print-on-demand","Custom color jobs, one-offs, and small batch runs made to spec."],
  ["♟","Miniatures","Tabletop minis and terrain — send a design or pick from our library."],
  ["📖","Comics & manga","Mint and near-mint back issues, trades, and volumes."],
  ["🗡","Cosplay & LARP gear","Props and weapons printed for more than display — built to actually hold up."],
  ["🔧","Tech & gadgets","Printed Raspberry Pi shells, wiring, and small custom electronics builds."],
];
const GALLERY = [
  ["🖨","Resident Evil-themed printer setup","Hardware check — the production setup"],
  ["🎨","Airbrush & paint-station stands","Sculpted holders for airbrushes, paints and tools"],
  ["🗄","Booth shelving inserts","Riser inserts sized to existing shelves"],
  ["🌀","Filament dryer with spool","Replacement parts & shop upkeep"],
  ["🃏","Pokémon graded cards & booster flatlay","Collector display gear"],
];
const SLABS = [
  ["images/copperajah-ex-front.jpg","Copperajah ex","Snow Hazard · CGC 10 GEM MINT"],
  ["images/vulpix-v-front.jpg","Alolan Vulpix V","Silver Tempest · CGC 8.5"],
  ["images/spearow-psa10-front.jpg","Spearow — Art Rare","2025 M1L JP · PSA 10 GEM MT"],
  ["images/sabrina-mr-mime-front.jpg","Sabrina's Mr. Mime","Gym 2, 1999 JP · CGC 9 MINT"],
  ["images/grovyle-cgc9-front.jpg","Grovyle — Reverse Holo","Arceus 39/99 · CGC 9 MINT · SOLD OUT"],
  ["images/rayquaza-v-front.jpg","Rayquaza V","Japanese VSTAR Universe · CGC 9 · SOLD OUT"],
];
const VENDOR = [
  ["🎨","Airbrush & paint-station stands","Sculpted holders to keep airbrushes, paints and tools organized at a booth or bench."],
  ["🗄","Booth shelving inserts","Riser inserts sized to existing shelves for slabs, raw cards or minis."],
  ["🔧","Replacement parts","If you have a discontinued or broken piece, send a picture and measurements and we'll see if it can be modeled."],
];
const PRICE_TABLE =
  '<table><tr><th>Size</th><th>Approx. filament</th><th>PLA Basic</th><th>PLA+</th><th>PETG</th></tr>'+
  '<tr><td><b>Small</b> — charms / small minis</td><td>≤ 15g</td><td>$8</td><td>$10</td><td>$12</td></tr>'+
  '<tr><td><b>Medium</b> — 2–4in / display pieces</td><td>15–60g</td><td>$18</td><td>$22</td><td>$26</td></tr>'+
  '<tr><td><b>Large</b> — 4–7in / terrain / vases</td><td>60–150g</td><td>$35</td><td>$42</td><td>$50</td></tr>'+
  '<tr><td><b>XL</b> — 7in+ / statues / large props</td><td>150g+</td><td>from $65</td><td>from $75</td><td>from $90</td></tr></table>';
const money = n => "$" + n.toFixed(2);
const PLACEHOLDER_IMG = "images/placeholder.svg";

/* ---------- shared chrome: cart drawer + lightbox (injected on every page) ---------- */
function injectChrome(){
  if(!document.getElementById("cartDrawer")){
    const d = document.createElement("div");
    d.innerHTML =
      '<div class="drawer-scrim" id="drawerScrim" onclick="closeCart()"></div>' +
      '<aside class="cart-drawer" id="cartDrawer" aria-label="Shopping cart">' +
        '<header><b>🛒 Your cart</b><button class="btn ghost small" onclick="closeCart()">Close ✕</button></header>' +
        '<div class="body" id="cartBody"></div>' +
        '<div class="foot"><div id="cartFootTotal" style="font-weight:900;font-size:18px"></div>' +
        '<p style="margin:10px 0 0"><a class="btn" href="shop.html#checkout" onclick="closeCart()">Go to checkout →</a></p></div>' +
      '</aside>' +
      '<div class="lightbox" id="lightbox" onclick="if(event.target===this)closeLightbox()">' +
        '<div class="box"><div class="photo" id="lbPhoto" style="cursor:default"></div>' +
        '<div class="lb-nav"><button class="btn ghost" onclick="lbPrev()">← Prev</button>' +
        '<span id="lbLabel" style="font-weight:700"></span>' +
        '<button class="btn ghost" onclick="lbNext()">Next →</button></div>' +
        '<p style="text-align:center;margin:12px 0 0"><button class="btn" onclick="closeLightbox()">Close</button></p></div>' +
      '</div>';
    document.body.appendChild(d);
  }
}

/* ---------- cart (localStorage) ---------- */
let cart = [];
try { cart = JSON.parse(localStorage.getItem("rcr-cart") || "[]"); } catch(e){ cart = []; }
function saveCart(){ try { localStorage.setItem("rcr-cart", JSON.stringify(cart)); } catch(e){} updateCount(); }
function updateCount(){
  const el = document.getElementById("cartCount");
  if(el) el.textContent = cart.reduce((n,i)=>n+i.qty,0);
}
function findItem(id){ return PRODUCTS.find(x => x.id === id) || CATALOG.find(x => x.id === id); }
function entryPrice(e){ return (e.varPrice != null) ? e.varPrice : findItem(e.id).price; }
function addToCart(id){
  const item = cart.find(i => i.id === id && i.varLabel == null);
  if(item) item.qty++; else cart.push({id, qty:1});
  saveCart(); openCart();
}
function addProductVarToCart(id){
  const p = PRODUCTS.find(x => x.id === id); if(!p) return;
  let varLabel = null, varPrice = null;
  if(p.variations){
    const sel = document.getElementById("var-"+id);
    const v = p.variations[parseInt(sel.value, 10)];
    varLabel = v.label; varPrice = v.price;
  }
  const item = cart.find(i => i.id === id && (i.varLabel || null) === (varLabel || null));
  if(item) item.qty++; else cart.push({id, qty:1, varLabel, varPrice});
  saveCart(); openCart();
}
function addCatalogToCart(catId){
  const c = CATALOG.find(x => x.id === catId); if(!c || c.outOfStock || c.comingSoon || c.draft) return;
  let varLabel = null, varPrice = null;
  if(c.variations){
    const sel = document.getElementById("var-"+catId);
    const v = c.variations[parseInt(sel.value, 10)];
    varLabel = v.label; varPrice = v.price;
  }
  const item = cart.find(i => i.id === catId && (i.varLabel || null) === (varLabel || null));
  if(item) item.qty++; else cart.push({id:catId, qty:1, varLabel, varPrice});
  saveCart(); openCart();
}
function setQty(idx, d){
  const item = cart[idx]; if(!item) return;
  item.qty += d; if(item.qty <= 0) cart.splice(idx,1);
  saveCart(); renderCart();
}
function cartTotal(){ return cart.reduce((t,i) => t + entryPrice(i)*i.qty, 0); }
function renderCart(){
  const body = document.getElementById("cartBody"); if(!body) return;
  const foot = document.getElementById("cartFootTotal");
  if(!cart.length){
    body.innerHTML = '<div class="note">Your cart is empty. <a href="shop.html">Browse the shop →</a></div>';
    if(foot) foot.textContent = "";
  } else {
    body.innerHTML = cart.map((i,idx) => { const p = findItem(i.id); const unit = entryPrice(i); return `
      <div class="cart-line">
        <div><b>${p.name}</b>${i.varLabel ? `<br><span style="color:var(--muted);font-size:13px">${i.varLabel}</span>` : ""}<br><span style="color:var(--muted);font-size:13px">${money(unit)}${p.ship ? " · "+p.ship : ""}</span></div>
        <div class="qty"><button onclick="setQty(${idx},-1)">−</button> <b>${i.qty}</b> <button onclick="setQty(${idx},1)">+</button></div>
        <div><b>${money(unit*i.qty)}</b></div>
      </div>`; }).join("");
    if(foot) foot.textContent = "Subtotal: " + money(cartTotal());
  }
  const page = document.getElementById("cartPageBody");
  if(page){
    if(!cart.length){
      page.innerHTML = '<div class="note">Your cart is empty. <a href="shop.html">Browse the shop →</a></div>';
      document.getElementById("checkoutBox").style.display = "none";
    } else {
      page.innerHTML = cart.map((i,idx) => { const p = findItem(i.id); const unit = entryPrice(i); return `
        <div class="cart-line">
          <div><b>${p.name}</b>${i.varLabel ? `<br><span style="color:var(--muted);font-size:13px">${i.varLabel}</span>` : ""}<br><span style="color:var(--muted);font-size:13px">${money(unit)}${p.ship ? " · "+p.ship : ""}</span></div>
          <div class="qty"><button onclick="setQty(${idx},-1)">−</button> <b>${i.qty}</b> <button onclick="setQty(${idx},1)">+</button></div>
          <div><b>${money(unit*i.qty)}</b></div>
        </div>`; }).join("") +
        `<div class="cart-line" style="border-bottom:0"><div><b>Subtotal</b></div><div></div><div><b>${money(cartTotal())}</b></div></div>
         <p style="color:var(--muted);font-size:13px">Shipping is by location unless the item says free shipping — calculated at checkout. No charge is made until you pay with Stripe or PayPal.</p>`;
      document.getElementById("checkoutBox").style.display = "block";
      const pp = document.getElementById("paypalCartBox");
      if(pp){
        if(PAYPAL_EMAIL){
          pp.innerHTML = `<form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank">
            <input type="hidden" name="cmd" value="_xclick">
            <input type="hidden" name="business" value="${PAYPAL_EMAIL}">
            <input type="hidden" name="item_name" value="Rare Candy Reserve order">
            <input type="hidden" name="amount" value="${cartTotal().toFixed(2)}">
            <input type="hidden" name="currency_code" value="USD">
            <input type="hidden" name="no_shipping" value="2">
            <button class="btn" type="submit">Pay $${cartTotal().toFixed(2)} with PayPal →</button>
          </form><p style="font-size:13px;color:var(--muted)">PayPal checkout is automated — PayPal takes the payment and notifies the shop. No invoice needed.</p>`;
        } else {
          pp.innerHTML = `<p style="font-size:13px;color:var(--muted)">PayPal checkout is being wired up — Stripe checkout works now.</p>`;
        }
      }
    }
  }
}
function openCart(){ renderCart(); document.getElementById("cartDrawer").classList.add("open"); document.getElementById("drawerScrim").classList.add("show"); }
function closeCart(){ document.getElementById("cartDrawer").classList.remove("open"); document.getElementById("drawerScrim").classList.remove("show"); }
function submitOrder(e){
  e.preventDefault();
  document.getElementById("orderMsg").textContent = "✓ This order was NOT placed and no card was charged. Checkout runs through Stripe or PayPal — pick one below.";
  return false;
}

/* ---------- rendering ---------- */
function photoHTML(p, idx){
  const total = (p.imgs && p.imgs.length) || 3;
  if(p.imgs && p.imgs[idx]){
    return `<div class="photo${idx===0 ? " tall" : ""}" onclick="openLightbox('${p.id}',${idx})">
    <span class="count">📷 ${idx+1} / ${total}</span>
    <img src="${p.imgs[idx]}" alt="${p.name} — photo ${idx+1}" onerror="this.style.display='none'">
  </div>`;
  }
  return `<div class="photo" onclick="openLightbox('${p.id}',${idx})">
    <span class="count">📷 ${idx+1} / 3</span>
    <img src="${PLACEHOLDER_IMG}" alt="Photo placeholder — ${p.name}" onerror="this.style.display='none'">
    <div class="big">${p.icon}</div>
    <div class="lbl">Photo ${idx+1} — not uploaded yet</div>
    <div class="sub">${p.name}<br>Drop into Drive folder or send via chat</div>
  </div>`;
}
function productCard(p){
  const thumbs = (p.imgs && p.imgs.length > 1)
    ? p.imgs.slice(1).map((_,i)=>photoHTML(p,i+1)).join("")
    : photoHTML(p,1)+photoHTML(p,2);
  let priceLine, buyBtn;
  if(p.variations){
    const opts = p.variations.map((v,i)=>`<option value="${i}">${v.label} — ${money(v.price)}</option>`).join("");
    const lo = Math.min(...p.variations.map(v=>v.price)), hi = Math.max(...p.variations.map(v=>v.price));
    priceLine = `<p><span class="price">${lo===hi ? money(lo) : money(lo)+" – "+money(hi)}</span> <span class="ship">${p.ship}</span></p>
      <label style="margin-top:2px">Choose:</label><select id="var-${p.id}">${opts}</select>`;
    buyBtn = `<button class="btn" style="margin-top:10px" onclick="addProductVarToCart('${p.id}')">Add to cart</button>`;
  } else {
    priceLine = `<p><span class="price">${money(p.price)}</span> <span class="ship">${p.ship}</span></p>`;
    buyBtn = `<button class="btn" onclick="addToCart('${p.id}')">Add to cart</button>`;
  }
  return `<div class="card">
    ${photoHTML(p,0)}
    <div class="thumbs">${thumbs}</div>
    <div class="tag" style="margin-top:12px">${p.tag}</div>
    <h3>${p.name}</h3><p>${p.desc}</p>
    ${priceLine}
    <p>${buyBtn}${p.stripe ? ` <a class="btn ghost" href="${p.stripe}" target="_blank" rel="noopener" style="margin-left:8px">Buy with Stripe →</a>` : ""}</p>
  </div>`;
}
function catalogCard(c){
  const photo = (c.imgs && c.imgs.length)
    ? photoHTML(c,0)
    : `<div class="photo" onclick="openLightbox('${c.id}',0)">
    <span class="count">📷 1 / 3</span>
    <img src="${PLACEHOLDER_IMG}" alt="Photo placeholder — ${c.name}" onerror="this.style.display='none'">
    <div class="big">${c.icon}</div>
    <div class="lbl">Photo — not uploaded yet</div>
    <div class="sub">${c.name}<br>Upload via Drive folder or chat</div>
  </div>`;
  let priceLine, buyBtn;
  if(c.outOfStock){
    priceLine = (c.price != null ? `<p><span class="price">${money(c.price)}</span></p>` : ``) +
      `<p><span class="pill" style="border-color:var(--pink);color:var(--pink)">🔴 SOLD OUT — not for sale</span></p>
      <p style="font-size:13px">Sold out — no longer available.</p>`;
    buyBtn = `<button class="btn" disabled>Sold out</button>`;
  } else if(c.draft){
    priceLine = `<p><span class="price">${money(c.price)}</span></p>
      <p><span class="pill">✏️ DRAFT — not posted yet</span></p>`;
    buyBtn = `<button class="btn" disabled>Draft — not for sale yet</button>`;
  } else if(c.comingSoon){
    priceLine = `<p><span class="pill">🕐 PRICE COMING SOON</span></p>
      <p style="font-size:13px">Photo + assessment on file — Ash prices it before it goes on sale.</p>`;
    buyBtn = `<button class="btn" disabled>Price coming soon</button>`;
  } else if(c.variations){
    const opts = c.variations.map((v,i)=>`<option value="${i}">${v.label} — ${money(v.price)}</option>`).join("");
    const lo = Math.min(...c.variations.map(v=>v.price)), hi = Math.max(...c.variations.map(v=>v.price));
    priceLine = `<p><span class="price">${lo===hi ? money(lo) : money(lo)+" – "+money(hi)}</span></p>
      <label style="margin-top:2px">Choose:</label><select id="var-${c.id}">${opts}</select>`;
    buyBtn = `<button class="btn" style="margin-top:10px" onclick="addCatalogToCart('${c.id}')">Add to cart</button>`;
  } else {
    priceLine = `<p><span class="price">${money(c.price)}</span>${c.ship ? ` <span class="ship">${c.ship}</span>` : ""}</p>`;
    buyBtn = `<button class="btn" onclick="addCatalogToCart('${c.id}')">Add to cart</button>`;
  }
  const ebayLink = c.ebay ? ` <a href="https://www.ebay.com/itm/${c.ebay}" target="_blank" rel="noopener" style="font-size:13px">View on eBay ↗</a>` : "";
  return `<div class="card">${photo}
    <div class="tag" style="margin-top:12px">${c.tag}</div>
    <h3><a href="shop.html?item=${c.id}" style="color:var(--ink);text-decoration:none">${c.name}</a></h3>
    ${c.desc ? `<p style="color:var(--muted);font-size:14px">${c.desc}</p>` : ""}
    ${priceLine}
    <p>${buyBtn}${c.stripe ? ` <a class="btn ghost" href="${c.stripe}" target="_blank" rel="noopener">Buy with Stripe →</a>` : ""}${ebayLink}</p>
  </div>`;
}
function renderPageSections(){
  const set = (id, html) => { const el = document.getElementById(id); if(el) el.innerHTML = html; };
  set("servicesGrid", SERVICES.map(s => `<div class="card"><div style="font-size:28px">${s[0]}</div><h3>${s[1]}</h3><p>${s[2]}</p></div>`).join(""));
  set("pricingTableHome", PRICE_TABLE);
  set("pricingTableServices", PRICE_TABLE);
  set("productGrid", PRODUCTS.map(productCard).join(""));
  set("soonGrid", SOON.map(s => `<div class="card"><div style="font-size:28px">${s.icon}</div>
    <div class="tag">${s.tag}</div><h3>${s.name}</h3>
    <p><b style="color:var(--ink)">${s.price}</b>${s.note ? " · "+s.note : ""}</p></div>`).join(""));
  set("catalogGrid", CATALOG.map(catalogCard).join(""));
  set("galleryGrid", GALLERY.map(g => `<div class="card"><div class="photo" style="cursor:default"><div class="big">${g[0]}</div>
    <div class="lbl">Photo — not uploaded yet</div><div class="sub">${g[1]}</div></div>
    <h3 style="margin-top:10px">${g[1]}</h3><p>${g[2]}</p></div>`).join(""));
  set("slabGrid", SLABS.map(s => `<div class="card"><div class="photo" style="cursor:default"><img src="${s[0]}" alt="${s[1]}"></div>
    <h3 style="margin-top:10px">${s[1]}</h3><p>${s[2]}<br>Individual market-based listing</p></div>`).join(""));
  set("vendorGrid", VENDOR.map(v => `<div class="card"><div style="font-size:28px">${v[0]}</div><h3>${v[1]}</h3><p>${v[2]}</p></div>`).join(""));
  set("followRow", followRowHTML());
  const follow2 = document.getElementById("followRowMusic");
  if(follow2) follow2.innerHTML = followRowHTML(true);
}
function followRowHTML(withExtra){
  const links = [
    ["🎵 Spotify", MUSIC_LINKS.spotify, false],
    ["🍎 Apple Music", MUSIC_LINKS.apple, false],
    ["▶ YouTube", MUSIC_LINKS.youtube, false],
    ["📻 iHeart", MUSIC_LINKS.iheart, false],
    ["☁️ SoundCloud", MUSIC_LINKS.soundcloud, false],
    ["📝 Lyrics", MUSIC_LINKS.lyrics, false],
    ["📘 Facebook", MUSIC_LINKS.facebook, false],
    ["🗳 Vote for his song", MUSIC_LINKS.vote, true],
    ["❤️ Donate", "donate.html", true, true],
  ];
  if(withExtra) links.push(["🔗 HyperFollow", MUSIC_LINKS.hyperfollow, true]);
  return links.map(l => `<a href="${l[1]}"${l[3] ? "" : ' target="_blank" rel="noopener"'}${l[2] ? ' class="hot"' : ""}>${l[0]}</a>`).join("");
}

/* ---------- lightbox (3 photos per item, click to view) ---------- */
let lbProduct = null, lbIndex = 0;
function openLightbox(id, idx){
  lbProduct = findItem(id); if(!lbProduct) return;
  lbIndex = idx || 0;
  renderLightbox();
  document.getElementById("lightbox").classList.add("open");
}
function renderLightbox(){
  const p = lbProduct;
  const total = (p.imgs && p.imgs.length) || 3;
  const lbPhoto = document.getElementById("lbPhoto");
  if(p.imgs && p.imgs[lbIndex]){
    lbPhoto.innerHTML =
      `<span class="count">📷 ${lbIndex+1} / ${total}</span>
       <img src="${p.imgs[lbIndex]}" alt="${p.name} — photo ${lbIndex+1}" onerror="this.style.display='none'">`;
    lbPhoto.classList.add("tall");
  } else {
    lbPhoto.innerHTML =
      `<span class="count">📷 ${lbIndex+1} / ${total}</span>
       <img src="${PLACEHOLDER_IMG}" alt="Photo placeholder" onerror="this.style.display='none'">
       <div class="big">${p.icon}</div>
       <div class="lbl">Photo ${lbIndex+1} of ${total} — not uploaded yet</div>
       <div class="sub">${p.name}<br>Upload: Drive folder or chat, named ${(p.slug || p.id)}-${lbIndex+1}.jpg</div>`;
    lbPhoto.classList.remove("tall");
  }
  document.getElementById("lbLabel").textContent = p.name + " — photo " + (lbIndex+1) + " of " + total;
}
function lbPrev(){ const t = (lbProduct.imgs && lbProduct.imgs.length) || 3; lbIndex = (lbIndex+t-1)%t; renderLightbox(); }
function lbNext(){ const t = (lbProduct.imgs && lbProduct.imgs.length) || 3; lbIndex = (lbIndex+1)%t; renderLightbox(); }
function closeLightbox(){ const lb = document.getElementById("lightbox"); if(lb) lb.classList.remove("open"); }
document.addEventListener("keydown", e => { if(e.key === "Escape"){ closeLightbox(); closeCart(); } });

/* ---------- shop detail view (?item=) ---------- */
function showDetail(id){
  const c = findItem(id); if(!c) return false;
  const grid = document.getElementById("catalogSection"), feat = document.getElementById("featuredSection");
  const det = document.getElementById("detailView"); if(!det) return false;
  if(grid) grid.style.display = "none";
  if(feat) feat.style.display = "none";
  let buyHtml = "";
  if(c.outOfStock){
    buyHtml = `<p><span class="pill" style="border-color:var(--pink);color:var(--pink)">⛔ OUT OF STOCK — not for sale</span></p>
      <p style="font-size:14px">Sold — no longer available.</p>
      <button class="btn" disabled>Out of stock</button>`;
  } else if(c.draft){
    buyHtml = `<p><span class="price">${money(c.price)}</span></p>
      <p><span class="pill">✏️ DRAFT — not posted yet</span></p>
      <button class="btn" disabled>Draft — not for sale yet</button>`;
  } else if(c.comingSoon){
    buyHtml = `<p><span class="pill">🕐 PRICE COMING SOON</span></p>
      <p style="font-size:14px">Photo + assessment on file — Ash prices it before it goes on sale.</p>
      <button class="btn" disabled>Price coming soon</button>`;
  } else if(c.variations){
    const opts = c.variations.map((v,i)=>`<option value="${i}">${v.label} — ${money(v.price)}</option>`).join("");
    const lo = Math.min(...c.variations.map(v=>v.price)), hi = Math.max(...c.variations.map(v=>v.price));
    buyHtml = `<p><span class="price">${lo===hi ? money(lo) : money(lo)+" – "+money(hi)}</span></p>
      <label>Choose:</label><select id="var-${c.id}">${opts}</select>
      <p style="margin-top:12px"><button class="btn" onclick="addCatalogToCart('${c.id}')">Add to cart</button></p>`;
  } else if(c.price != null){
    buyHtml = `<p><span class="price">${money(c.price)}</span>${c.ship ? ` <span class="ship">${c.ship}</span>` : ""}</p>
      <p><button class="btn" onclick="${CATALOG.includes(c) ? "addCatalogToCart" : "addToCart"}('${c.id}')">Add to cart</button></p>`;
  }
  const detThumbs = (c.imgs && c.imgs.length > 1)
    ? c.imgs.slice(1).map((_,i)=>photoHTML(c,i+1)).join("")
    : photoHTML(c,1)+photoHTML(c,2);
  det.innerHTML = `
    <p><a href="shop.html" onclick="hideDetail(event)">← Back to the full catalog</a></p>
    <div class="detail">
      <div>
        ${photoHTML(c,0)}
        <div class="thumbs">${detThumbs}</div>
      </div>
      <div>
        <div class="tag">${c.tag}</div>
        <h1 style="font-size:30px">${c.name}</h1>
        ${c.desc ? `<p style="color:var(--muted)">${c.desc}</p>` : ""}
        ${buyHtml}
        ${c.ebay ? `<p><a href="https://www.ebay.com/itm/${c.ebay}" target="_blank" rel="noopener">View this item on eBay ↗</a></p>` : ""}
      </div>
    </div>`;
  det.style.display = "block";
  window.scrollTo(0,0);
  return true;
}
function hideDetail(e){
  if(e) e.preventDefault();
  const det = document.getElementById("detailView");
  const grid = document.getElementById("catalogSection"), feat = document.getElementById("featuredSection");
  if(det) det.style.display = "none";
  if(grid) grid.style.display = "";
  if(feat) feat.style.display = "";
  history.replaceState(null, "", "shop.html");
}

/* ---------- estimator (live-site tiers) ---------- */
const BASE = {small:{pla:8,"pla+":10,petg:12}, medium:{pla:18,"pla+":22,petg:26}, large:{pla:35,"pla+":42,petg:50}, xl:{pla:65,"pla+":75,petg:90}};
function estimate(){
  const sizeEl = document.getElementById("estSize"); if(!sizeEl) return;
  const size = sizeEl.value, mat = document.getElementById("estMat").value;
  const colors = parseInt(document.getElementById("estColors").value,10);
  const rush = document.getElementById("estRush").checked;
  if(!BASE[size] || BASE[size][mat] == null) return;
  let price = BASE[size][mat] + (colors-1)*3;
  if(rush) price *= 1.25;
  const out = document.getElementById("estOut");
  if(out) out.textContent = money(price) + (size === "xl" ? " (from)" : "");
}

/* ---------- character forge ---------- */
function forgePreview(){
  const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
  const set = (id, t) => { const el = document.getElementById(id); if(el) el.textContent = t; };
  set("forgeOutName", v("forgeName") || "Unnamed Character");
  set("forgeOutAlign", v("forgeAlign") || "True Neutral");
  set("forgeOutRace", v("forgeRace") || "Human");
  set("forgeOutClass", v("forgeClass") || "—");
  set("forgeOutOrigin", v("forgeOrigin") || "—");
  set("forgeOutStory", v("forgeStory") || "Their backstory will appear here as you type.");
}
function forgeRequest(){
  const el = document.getElementById("forgeMsg");
  if(el) el.textContent = "✓ Noted — this sends the sheet with the custom-mini request. (Character Forge mini starts from $12.)";
}

/* ---------- forms: validate, then open a pre-addressed email draft ---------- */
function validEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function fieldErr(id, msgId, bad){
  const f = document.getElementById(id), m = document.getElementById(msgId);
  if(f) f.classList.toggle("err", bad);
  if(m) m.textContent = bad ? "Required." : "";
  return !bad;
}
function openMailDraft(to, subject, body){
  const url = "mailto:" + encodeURIComponent(to)
    + "?subject=" + encodeURIComponent(subject)
    + "&body=" + encodeURIComponent(body);
  window.location.href = url;
}
function submitContact(e){
  e.preventDefault();
  const name = document.getElementById("cName").value.trim();
  const email = document.getElementById("cEmail").value.trim();
  const msg = document.getElementById("cMsg").value.trim();
  let ok = true;
  ok = fieldErr("cName","cNameMsg", !name) && ok;
  const emailBad = !email || !validEmail(email);
  const ef = document.getElementById("cEmail"), em = document.getElementById("cEmailMsg");
  if(ef) ef.classList.toggle("err", emailBad);
  if(em) em.textContent = emailBad ? (email ? "That email doesn't look right." : "Required.") : "";
  ok = !emailBad && ok;
  ok = fieldErr("cMsg","cMsgMsg", !msg) && ok;
  if(!ok) return false;
  openMailDraft(SHOP_CONTACT_EMAIL, "Website contact — " + name,
    "Name: " + name + "\nEmail: " + email + "\n\n" + msg +
    "\n\n— Sent from the Rare Candy Reserve contact form");
  document.getElementById("contactMsg").textContent =
    "✓ Your email app should have opened with a draft addressed to the shop (" + SHOP_CONTACT_EMAIL + "). Hit send there to finish. (Recipient address still needs Ash's confirmation.)";
  return false;
}
function submitQuote(e){
  e.preventDefault();
  const name = document.getElementById("qName").value.trim();
  const email = document.getElementById("qEmail").value.trim();
  const details = document.getElementById("qDetails").value.trim();
  const photos = document.getElementById("qPhotos").value.trim();
  let ok = true;
  ok = fieldErr("qName","qNameMsg", !name) && ok;
  const emailBad = !email || !validEmail(email);
  const ef = document.getElementById("qEmail"), em = document.getElementById("qEmailMsg");
  if(ef) ef.classList.toggle("err", emailBad);
  if(em) em.textContent = emailBad ? (email ? "That email doesn't look right." : "Required.") : "";
  ok = !emailBad && ok;
  ok = fieldErr("qDetails","qDetailsMsg", !details) && ok;
  if(!ok) return false;
  openMailDraft(SHOP_CONTACT_EMAIL, "Custom print quote request — " + name,
    "Name: " + name + "\nEmail: " + email + "\nProject details: " + details +
    (photos ? "\nReference pictures: " + photos : "") +
    "\n\n— Sent from the Rare Candy Reserve custom-order form");
  document.getElementById("quoteMsg").textContent =
    "✓ Your email app should have opened with a draft addressed to the shop (" + SHOP_CONTACT_EMAIL + "). Hit send there to finish. (Recipient address still needs Ash's confirmation.)";
  return false;
}

/* ---------- shared form handler (radio / community / nerd pages) ----------
   One generic handler for every mailto-backed form on the new pages.
   Fields marked data-req are required (checkboxes must be checked).
   Gathers every named field into the email body and opens a pre-addressed
   draft to the shop, the same way the contact + quote forms already do. */
function submitSiteForm(e, subject){
  e.preventDefault();
  const f = e.target;
  let ok = true;
  f.querySelectorAll("[data-req]").forEach(el => {
    const bad = el.type === "checkbox" ? !el.checked : !el.value.trim();
    el.classList.toggle("err", bad);
    if(bad) ok = false;
  });
  if(!ok) return false;
  const lines = [];
  f.querySelectorAll("input,select,textarea").forEach(el => {
    if(!el.name) return;
    if(el.type === "checkbox") lines.push(el.name + ": " + (el.checked ? "Yes" : "No"));
    else if(el.value.trim()) lines.push(el.name + ": " + el.value.trim());
  });
  openMailDraft(SHOP_CONTACT_EMAIL, subject,
    lines.join("\n") + "\n\n— Sent from the Rare Candy Reserve website");
  const msg = f.querySelector(".form-msg");
  if(msg) msg.textContent = "✓ Your email app should have opened with a draft addressed to the shop (" + SHOP_CONTACT_EMAIL + "). Hit send there to finish.";
  return false;
}

/* ---------- boot ---------- */
function boot(){
  injectChrome();
  const page = document.body.dataset.page || "";
  document.querySelectorAll("#mainNav a").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  renderPageSections();
  updateCount();
  estimate();
  forgePreview();
  renderCart();
  setTimeOfDayBanner();
  if(page === "shop"){
    const item = new URLSearchParams(location.search).get("item");
    if(item) showDetail(item);
    if(location.hash === "#checkout"){
      const cb = document.getElementById("checkoutBox");
      if(cb) cb.scrollIntoView();
    }
  }
}
document.addEventListener("DOMContentLoaded", boot);
