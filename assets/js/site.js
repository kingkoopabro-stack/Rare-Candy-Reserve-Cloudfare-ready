/* ============================================================
   Rare Candy Reserve — shared site JS
   Single shared script for all pages. Cart is client-side only
   (localStorage). No backend, no real payments.
   ============================================================ */
const STRIPE_PUBLISHABLE_KEY = "pk_live_51U2qoIQpMlvNGy77xhL3IChHqa8IbKKalGIkIkdbP5dBZTnGULeHtYxOXTnIse5uu0OHBLtPmjikPGxhgmeSgnxV00CBibaT2E"; // LIVE publishable key — public by design, safe in frontend code
const SHOP_CONTACT_EMAIL = "asteadyheartmusic@gmail.com"; // <-- CONFIRM WITH ASH: shop contact email (alt: kingkoopabro@gmail.com)
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
   price:22.00, ship:"+ shipping (by location)", icon:"🎧",
   imgs:["images/airpods-case-closed.jpg"]},
  {id:"dice-satchel", slug:"dice-satchel", tag:"1 OF 1 · Tabletop Gear", name:"Faux-Leather Nordic Dice Satchel",
   desc:"Celtic-tooled faux leather pouch with snap closure — comes with one professionally-made d8, color customizable on request.",
   price:25.00, ship:"+ shipping (by location)", icon:"🎲"},
  {id:"mcr-vinyl", slug:"mcr-vinyl", tag:"SEALED · Collectible Vinyl", name:"MCR — Three Cheers for Sweet Revenge",
   desc:"Still-sealed collector's pressing, includes a preservation stand so it displays like a graded card.",
   price:26.00, ship:"free shipping", icon:"💿"},
  {id:"retro-keychain", slug:"retro-keychain", tag:"MINI PRINT · 3D Print", name:"Retro Console Keychain",
   desc:"Miniature handheld consoles, printed to order. Pick your console — Game Boy, GBA SP, DS, Switch, and more.",
   price:12.00, ship:"free shipping if bundled · solo: shipping by location", icon:"🎮"},
  {id:"killer-klown", slug:"killer-klown", tag:"COMPLETE SET · Cosplay", name:"Killer Klown Costume + Ray Gun",
   desc:"Full mask and costume set, includes the cotton candy ray gun prop.",
   price:50.00, ship:"+ shipping (by location)", icon:"🤡"},
];
/* Live eBay inventory — titles + prices exact (verified 2026-11-06).
   Photos wired from Ash's Drive (drive-photo-map.md, 2026-11-09); Sunflora still has
   no photo in Drive — it keeps the placeholder until he sends one.
   Variation labels for Beholder / extender are unknown — shown as Variation 1/2/3, Style 1/2.
   comingSoon entries are photographed but unpriced (no price, not buyable);
   draft entries are approved but not posted yet (price shown, not buyable). */
const CATALOG = [
  {id:"cat-lincoln", slug:"lincoln-bust", ebay:"168803752868", icon:"🗿", tag:"Statue / Decor", name:"Vintage Bronze Abraham Lincoln Bust Statue", price:35.00, img:null,
   imgs:["images/lincoln-bust-front.jpg"]},
  {id:"cat-capodimonte", slug:"capodimonte-clock", ebay:"168803759905", icon:"🕰", tag:"Vintage Clock", name:"R. Capodimonte Italy Porcelain Wall Clock", price:110.00, img:null,
   imgs:["images/capodimonte-clock-front.jpg"]},
  {id:"cat-sonic", slug:"sonic-clock", ebay:"168803762884", icon:"🦔", tag:"Clock", name:"Sonic the Hedgehog Twin Bell Alarm Clock", price:24.99, img:null,
   imgs:["images/sonic-clock-front.jpg"]},
  {id:"cat-gengar", slug:"gengar-cgc9", ebay:"168803766775", icon:"👻", tag:"Graded Card · CGC 9", name:"CGC 9 Gengar ex 047/071 Japanese Wild Force", price:22.00, img:null, outOfStock:true,
   imgs:["images/gengar-ex-front.jpg"]},
  {id:"cat-cyberjudge", slug:"cyber-judge-pack", ebay:"168803775765", icon:"🃏", tag:"Sealed Pack", name:"Pokemon Cyber Judge sv5M Japanese Booster Pack", price:5.99, ship:"+ $2.00 shipping", img:null,
   imgs:["images/cyber-judge-pack-front.jpg"]},
  {id:"cat-beholder", slug:"beholder-mini", ebay:"168803858135", icon:"👁", tag:"Tabletop Miniature", name:"3D Printed Beholder Tabletop Miniature", price:null, img:null,
   imgs:["images/mini-beholder-group.jpg"],
   variations:[{label:"Variation 1", price:20.00},{label:"Variation 2", price:28.00},{label:"Variation 3", price:60.00}]},
  {id:"cat-pluspower", slug:"pluspower-psa9", ebay:"168804953637", icon:"⚡", tag:"Graded Card · PSA 9", name:"PSA 9 1998 Japanese PlusPower Gym Deck Trainer", price:42.00, img:null,
   imgs:["images/pluspower-psa9-front.jpg"]},
  {id:"cat-extender", slug:"wifi-extender", ebay:"168805013177", icon:"📶", tag:"Tech", name:"WiFi Range Extender Signal Booster", price:18.00, img:null,
   imgs:["images/wifi-extender-front.jpg"],
   variations:[{label:"Style 1", price:18.00},{label:"Style 2", price:18.00}]},
  {id:"cat-turok", slug:"turok-lot", ebay:"168390092126", icon:"🦖", tag:"Comic Lot", name:"Turok Comic Lot Gold Foil #1 + Turok #1-3 Blood Hunt + N64 Pin", price:35.00, img:null,
   imgs:["images/turok-1.jpg"]},
  {id:"cat-xmen", slug:"xmen-lot", ebay:"168390280510", icon:"❌", tag:"Comic Lot", name:"Marvel X-Men / Mutant 6-comic Starter Collection", price:38.00, img:null,
   imgs:["images/xmen-xforce-1.jpg"]},
  {id:"cat-sunflora", slug:"sunflora-cgc10", ebay:"168711754988", icon:"🌻", tag:"Graded Card · CGC Pristine 10", name:"2024 Sunflora AR 102/101 CGC Pristine 10", price:27.99, img:null},
  {id:"cat-klowns", slug:"killer-klowns", ebay:"168818855550", icon:"🤡", tag:"Cosplay", name:"Spirit Halloween Killer Klowns Costume Adult XL + Cotton Candy Gun", price:140.00, img:null,
   imgs:["images/killer-klowns-costume-1.jpg"]},
  {id:"cat-glaceon", slug:"glaceon-vmax", ebay:"168818972853", icon:"❄️", tag:"Graded Card · CGC 8.5", name:"CGC 8.5 Glaceon VMAX 041/203 Evolving Skies", price:12.00, img:null,
   imgs:["images/glaceon-vmax-front.jpg"]},
  {id:"cat-rayquaza", slug:"rayquaza-v", ebay:"168818990115", icon:"🐉", tag:"Graded Card · CGC 9", name:"CGC 9 Rayquaza V 107/172 Japanese VSTAR Universe", price:18.00, img:null, outOfStock:true,
   imgs:["images/rayquaza-v-front.jpg"]},
  {id:"cat-vulpix", slug:"vulpix-v", ebay:"168819002299", icon:"🦊", tag:"Graded Card · CGC 8.5", name:"CGC 8.5 Alolan Vulpix V 033/195 Silver Tempest", price:28.00, img:null,
   imgs:["images/vulpix-v-front.jpg"]},
  {id:"cat-marshydro", slug:"mars-hydro-300", ebay:"168820814201", icon:"💡", tag:"Grow Light", name:"Mars Hydro 300 LED Grow Light", price:68.00, img:null,
   imgs:["images/mars-hydro-label.jpg"],
   desc:"Photo shows the back label only (support URL + QR) — no front product shot in Drive yet."},
  /* Copperajah draft — approved $15.00 price, NOT posted to eBay yet. Do not make it buyable. */
  {id:"cat-copperajah", slug:"copperajah-cgc10", ebay:null, icon:"🐘", tag:"Graded Card · CGC 10 · DRAFT", name:"CGC 10 Copperajah ex 088/071 Japanese Snow Hazard", price:15.00, img:null, draft:true,
   imgs:["images/copperajah-ex-front.jpg"],
   desc:"Draft listing — approved price $15.00, not posted to eBay yet. CGC GEM MINT 10, cert 6102490197, 300 HP, Snow Hazard 088/071 Super Rare Holo."},
  /* New slabs — photographed, not priced yet. comingSoon: show photo + assessment, no price, not buyable. */
  {id:"cat-spearow", slug:"spearow-psa10", ebay:null, icon:"🐦", tag:"Graded Card · PSA 10", name:"Spearow — Art Rare, PSA 10 GEM MT", price:null, img:null, comingSoon:true,
   imgs:["images/spearow-psa10-front.jpg"],
   desc:"Spearow, 2025 Pokémon M1L JP #074, Art Rare, Japanese. PSA GEM MT 10, cert 127913713."},
  {id:"cat-mrmime", slug:"sabrinas-mr-mime", ebay:null, icon:"🎩", tag:"Graded Card · CGC 9", name:"Sabrina's Mr. Mime — CGC 9 MINT", price:null, img:null, comingSoon:true,
   imgs:["images/sabrina-mr-mime-front.jpg"],
   desc:"Sabrina's Mr. Mime, Pokémon (1999) Japanese, Gym 2: Challenge from the Darkness. CGC MINT 9, cert 6016734017."},
  {id:"cat-grovyle", slug:"grovyle-cgc9", ebay:null, icon:"🦎", tag:"Graded Card · CGC 9", name:"Grovyle — Reverse Holo, CGC 9 MINT", price:null, img:null, comingSoon:true,
   imgs:["images/grovyle-cgc9-front.jpg"],
   desc:"Grovyle, Pokémon (2009), Arceus 39/99, Reverse Holo. Attacks Quick Attack / Cut, 80 HP. CGC MINT 9, cert 6098149057."},
  /* Unpriced inventory (Drive photo map, section C) — assessment-based filler until Ash prices them. */
  {id:"cat-mewtwo-ex", slug:"mewtwo-ex-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Mewtwo ex — Raw (170 HP)", price:null, img:null, comingSoon:true,
   imgs:["images/mewtwo-ex-raw.jpg"],
   desc:"Raw Mewtwo ex, 170 HP, attacks Shatter Shot / Damage Change. Shown in a red/white 3D-printed slab bumper on a stand. Set not identifiable from the photos."},
  {id:"cat-mewtwo-130", slug:"mewtwo-130-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Mewtwo — Raw (130 HP)", price:null, img:null, comingSoon:true,
   imgs:["images/mewtwo-130-raw.jpg"],
   desc:"Raw Mewtwo, 130 HP, attacks Life Sucker (20) / Psy Burn (110). Sleeved."},
  {id:"cat-lycanroc", slug:"lycanroc-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Lycanroc — Raw (120 HP)", price:null, img:null, comingSoon:true,
   imgs:["images/lycanroc-raw.jpg"],
   desc:"Raw Lycanroc, Stage 1, 120 HP. Ability Spike Clad; attack Clamping Fangs 40+. Sleeved."},
  {id:"cat-volcanion", slug:"volcanion-firered", ebay:null, icon:"🃏", tag:"Raw Card · Game", name:"Volcanion Cards + Pokémon FireRed GBA", price:null, img:null, comingSoon:true,
   imgs:["images/volcanion-firered.jpg"],
   desc:"Two Volcanion cards (130 HP, one English, one Japanese) plus a Pokémon FireRed GBA cartridge in a clear case, photographed with an Eevee keychain."},
  {id:"cat-zekrom-ex", slug:"zekrom-ex-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Zekrom ex — Raw, Japanese (230 HP)", price:null, img:null, comingSoon:true,
   imgs:["images/zekrom-ex-raw.jpg"],
   desc:"Raw Zekrom ex, Japanese, 230 HP, black card. Sleeved; single front photo with some glare."},
  {id:"cat-mimikyu", slug:"mimikyu-gx-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Mimikyu Horror House GX — Raw", price:null, img:null, comingSoon:true,
   imgs:["images/mimikyu-gx-raw.jpg"],
   desc:"Raw Mimikyu TAG TEAM GX card (Horror House GX). Sleeved, held in hand."},
  {id:"cat-ex-trio", slug:"ex-trio-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Gengar ex + Zekrom ex + Koraidon ex — Raw", price:null, img:null, comingSoon:true,
   imgs:["images/ex-trio-raw.jpg"],
   desc:"Three raw ex cards: Gengar ex (Japanese), Zekrom ex (Japanese, 230 HP), Koraidon ex (230 HP, Wild Impact). Loose group shot."},
  {id:"cat-cubone", slug:"cubone-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Cubone — Raw", price:null, img:null, comingSoon:true,
   imgs:["images/cubone-raw.jpg"],
   desc:"Raw Cubone, yellow-border card, 40 HP era. Sleeved."},
  {id:"cat-reshiram-zekrom", slug:"reshiram-zekrom-gx", ebay:null, icon:"🃏", tag:"Raw Card", name:"Reshiram & Zekrom GX TAG TEAM + Charizard — Raw", price:null, img:null, comingSoon:true,
   imgs:["images/reshiram-zekrom-gx-charizard.jpg"],
   desc:"Raw Reshiram & Zekrom GX TAG TEAM, 270 HP, in a green 3D-printed frame, shown with a raw Charizard (100 HP, base-set style art)."},
  {id:"cat-mega-evo", slug:"mega-evolution-packs", ebay:null, icon:"🃏", tag:"Sealed Pack", name:"Pokémon Mega Evolution Sealed Booster Packs", price:null, img:null, comingSoon:true,
   imgs:["images/mega-evolution-pack.jpg"],
   desc:"Sealed Pokémon TCG Mega Evolution booster packs (10 additional game cards), English. At least 2 packs on hand."},
  {id:"cat-jp-pack", slug:"japanese-pack-pink", ebay:null, icon:"🃏", tag:"Sealed Pack", name:"Sealed Japanese Booster Pack — Pink/Red Art", price:null, img:null, comingSoon:true,
   imgs:["images/japanese-pack-pink.jpg"],
   desc:"Sealed Japanese booster pack, pink/red art, barcode 4 521329 283982. Set name not readable from the photos."},
  {id:"cat-babe-ruth", slug:"babe-ruth-tin", ebay:null, icon:"⚾", tag:"Sports Card", name:"Babe Ruth Metallic Impressions Collector Tin + 6-Card Set", price:null, img:null, comingSoon:true,
   imgs:["images/babe-ruth-tin.jpg"],
   desc:"Metallic Impressions “Special 6-Card Babe Ruth Edition” collector tin with the 6-card set — batting pose, “NEW YORK” jersey, pitching pose, and holding-bats designs, fronts and backs with bio/stats text."},
  {id:"cat-earthworm-jim", slug:"earthworm-jim-2", ebay:null, icon:"🪱", tag:"Comic · Figure", name:"Earthworm Jim #2 Comic + Figure", price:null, img:null, comingSoon:true,
   imgs:["images/earthworm-jim-2.jpg"],
   desc:"Earthworm Jim #2 (Marvel) front cover plus a small Earthworm Jim figure."},
  {id:"cat-celtics", slug:"celtics-bulk", ebay:null, icon:"🏀", tag:"Sports Card", name:"Boston Celtics / Basketball Card Bulk — Fleer Era", price:null, img:null, comingSoon:true,
   imgs:["images/celtics-binder.jpg"],
   desc:"Boston Celtics binder pages (Larry Bird, Kevin McHale, Robert Parish, Dennis Johnson, Kevin Gamble, Brian Shaw, Jim Paxson, Ed Pinckney, Joe Kleine) plus a loose pile of basketball cards and a Fleer Larry Bird card. Bulk lot; count not established from photos."},
  {id:"cat-kansas", slug:"kansas-vinyl", ebay:null, icon:"💿", tag:"Vinyl", name:"Kansas — Leftoverture Vinyl LP", price:null, img:null, comingSoon:true,
   imgs:["images/kansas-vinyl.jpg"],
   desc:"Kansas “Leftoverture” LP, from a stack of vinyl."},
  {id:"cat-jackson-browne", slug:"jackson-browne-vinyl", ebay:null, icon:"💿", tag:"Vinyl", name:"Jackson Browne — The Pretender Vinyl LP", price:null, img:null, comingSoon:true,
   imgs:["images/jackson-browne-vinyl.jpg"],
   desc:"Jackson Browne “The Pretender” LP."},
  {id:"cat-mcr-drive", slug:"mcr-vinyl-drive", ebay:null, icon:"💿", tag:"Vinyl", name:"My Chemical Romance — Three Cheers for Sweet Revenge Vinyl LP", price:null, img:null, comingSoon:true,
   imgs:["images/mcr-vinyl-drive.jpg"],
   desc:"My Chemical Romance “Three Cheers for Sweet Revenge” LP, front and back. May be the same copy as the site's $26 sealed MCR vinyl listing — verify with Ash before pricing."},
  {id:"cat-hollow-knight", slug:"hollow-knight-figure", ebay:null, icon:"⚔️", tag:"Figure", name:"Hollow Knight Figure", price:null, img:null, comingSoon:true,
   imgs:["images/hollow-knight-figure.jpg"],
   desc:"Hollow Knight figure (white mask, grey cloak) on a black base."},
  {id:"cat-cloud-aerith", slug:"cloud-aerith-figures", ebay:null, icon:"⚔️", tag:"Figure", name:"Cloud + Aerith Final Fantasy VII Chibi Figures", price:null, img:null, comingSoon:true,
   imgs:["images/cloud-aerith-figures.jpg"],
   desc:"Chibi-style Cloud Strife (Buster Sword) and Aerith Gainsborough figures on black bases."},
  {id:"cat-link-boxed", slug:"link-figure-boxed", ebay:null, icon:"🗡️", tag:"Figure", name:"Link Figure — Boxed (Breath of the Wild)", price:null, img:null, comingSoon:true,
   imgs:["images/link-figure-boxed.jpg"],
   desc:"Link action figure in original packaging (The Legend of Zelda, Breath of the Wild)."},
  {id:"cat-quadro", slug:"quadro-gpu", ebay:null, icon:"🖥️", tag:"Tech", name:"NVIDIA Quadro Graphics Card", price:null, img:null, comingSoon:true,
   imgs:["images/quadro-gpu.jpg"],
   desc:"NVIDIA Quadro workstation graphics card, single-fan, 4× DisplayPort outputs. Model number not readable from the photos."},
  {id:"cat-ryzen3", slug:"ryzen3-cpu", ebay:null, icon:"🖥️", tag:"Tech", name:"AMD Ryzen 3 CPU + Box", price:null, img:null, comingSoon:true,
   imgs:["images/ryzen3-cpu.jpg"],
   desc:"AMD Ryzen 3 processor (AM4, in clamshell) with retail box (“Processor with Radeon Graphics”)."},
  {id:"cat-pins", slug:"enamel-pins", ebay:null, icon:"📌", tag:"Pins", name:"Enamel Pins + Rings Lot", price:null, img:null, comingSoon:true,
   imgs:["images/enamel-pins.jpg"],
   desc:"Enamel pins (Earthworm Jim, N64 logo, PaRappa the Rapper, DJ at a turntable, flower, “autistic” text pin) plus bags of spinner/mood rings."},
  {id:"cat-pkmn-keychains", slug:"pokemon-keychains", ebay:null, icon:"🔑", tag:"Keychain", name:"Pokémon Keychains / Charms", price:null, img:null, comingSoon:true,
   imgs:["images/pokemon-keychains.jpg"],
   desc:"Rubber/plastic Pokémon keychains: Eevee evolutions (Flareon, Umbreon, Glaceon, Vaporeon), Pikachu, and more, on straps."},
  {id:"cat-zelda-keychains", slug:"zelda-keychains", ebay:null, icon:"🔑", tag:"Keychain", name:"Zelda / Gaming Keychains", price:null, img:null, comingSoon:true,
   imgs:["images/zelda-keychains.jpg"],
   desc:"Majora's Mask keychain, Kingdom Hearts Keyblade keychain, Mario/Bowser charms, and gem/jewel charms, each in an iridescent zip bag."},
  {id:"cat-dice-3d", slug:"dice-3d-printed", ebay:null, icon:"🎲", tag:"Dice", name:"3D-Printed Dice + Numbered Rings", price:null, img:null, comingSoon:true,
   imgs:["images/dice-3d-printed.jpg"],
   desc:"3D-printed chunky dice (numbered, “M” logo) plus green numbered rings."},
  {id:"cat-buster-sword", slug:"buster-sword-keychain", ebay:null, icon:"🔑", tag:"Keychain", name:"Cloud's Buster Sword Keychain (Final Fantasy VII)", price:null, img:null, comingSoon:true,
   imgs:["images/buster-sword-keychain.jpg"],
   desc:"Black metal Buster Sword keychain."},
  {id:"cat-dice-bags", slug:"dice-bags-leather", ebay:null, icon:"🎲", tag:"Tabletop Gear", name:"Leather Dice Bags + Dice", price:null, img:null, comingSoon:true,
   imgs:["images/dice-bags-leather.jpg"],
   desc:"Brown leather drawstring dice bags (Celtic-knot tooling) with blue polyhedral dice, photographed with Poké Balls. May be the same product as the site's Nordic dice satchel ($25) or additional stock — verify with Ash."},
  {id:"cat-puffins", slug:"puffins-figure", ebay:null, icon:"🐧", tag:"Figure", name:"Puffin Figurine Group", price:null, img:null, comingSoon:true,
   imgs:["images/puffins-figure.jpg"],
   desc:"Three puffins on a rock base, painted resin/ceramic figurine."},
  {id:"cat-panam", slug:"pan-am-kit", ebay:null, icon:"✈️", tag:"Collectible", name:"Vintage Pan Am Amenity Kit", price:null, img:null, comingSoon:true,
   imgs:["images/pan-am-kit.jpg"],
   desc:"Vintage Pan Am amenity kit: grey/blue pouch with PAN AM clasp, plus Lancôme moisturizer, shave kit, eau de toilette, toothpaste, brush, comb, sewing kit, and towel."},
  {id:"cat-plush", slug:"plush-lot", ebay:null, icon:"🧸", tag:"Plush", name:"Plush Lot — Jack Skellington, Luigi, Tails, Squishmallows", price:null, img:null, comingSoon:true,
   imgs:["images/plush-lot.jpg"],
   desc:"Plush pile: Jack Skellington, Luigi, Tails the Fox, plus two Squishmallows."},
  {id:"cat-papyrus", slug:"papyrus-art", ebay:null, icon:"🖼️", tag:"Art", name:"Framed Egyptian Papyrus Art — Chariot + Horse", price:null, img:null, comingSoon:true,
   imgs:["images/papyrus-art.jpg"],
   desc:"Framed papyrus-style artwork: horse-drawn chariot scene, signed in the lower corner. Note: glass appears cracked."},
  {id:"cat-bird-skeleton", slug:"bird-skeleton", ebay:null, icon:"🦅", tag:"Figure", name:"Bird Skeleton Figure (Raven/Crow)", price:null, img:null, comingSoon:true,
   imgs:["images/bird-skeleton.jpg"],
   desc:"White bird skeleton figure (raven/crow) on a black round base."},
  {id:"cat-brass-clock", slug:"brass-alarm-clock", ebay:null, icon:"🕰", tag:"Clock", name:"Small Brass Alarm Clock + Celestial Shelf", price:null, img:null, comingSoon:true,
   imgs:["images/brass-alarm-clock.jpg"],
   desc:"Small brass twin-bell alarm clock (face about 2 inches) on a black/gold shelf decorated with a hand and sun/moon/stars."},
  {id:"cat-lady-statue", slug:"lady-statue", ebay:null, icon:"🗿", tag:"Statue", name:"Classical Lady Statue in Arched Niche", price:null, img:null, comingSoon:true,
   imgs:["images/lady-statue.jpg"],
   desc:"Cream-colored classical lady statue in an arched niche with columns."},
  {id:"cat-hunting-painting", slug:"hunting-painting", ebay:null, icon:"🖼️", tag:"Art", name:"Framed Miniature Hunting Painting", price:null, img:null, comingSoon:true,
   imgs:["images/hunting-painting.jpg"],
   desc:"Long horizontal framed miniature painting: hunting scene with horses and riders, ornate dark frame with light inlay."},
  {id:"cat-mad-book", slug:"mad-book", ebay:null, icon:"📖", tag:"Book", name:"MAD — Goes to the Dogs & Other Beasties! Book", price:null, img:null, comingSoon:true,
   imgs:["images/mad-book.jpg"],
   desc:"MAD book (“Fidos, Felines, Fluffies, Gizmos, Gorillas, Guppies”)."},
  {id:"cat-coke-bottle", slug:"coke-jaguars-bottle", ebay:null, icon:"🥤", tag:"Collectible", name:"Coca-Cola Bottle — Jacksonville Jaguars Label", price:null, img:null, comingSoon:true,
   imgs:["images/coke-jaguars-bottle.jpg"],
   desc:"Glass 8 fl oz Coca-Cola Classic bottle with a Jacksonville Jaguars label. Full bottle, cap on."},
  {id:"cat-pikachu-backpack", slug:"pikachu-backpack", ebay:null, icon:"🎒", tag:"Bag", name:"Yellow Pikachu Backpack / Lunchbox", price:null, img:null, comingSoon:true,
   imgs:["images/pikachu-backpack.jpg"],
   desc:"Yellow soft backpack/lunchbox with a large Pikachu print."},
  {id:"cat-spellbook", slug:"spellbook-red", ebay:null, icon:"📕", tag:"Tabletop Gear", name:"Red Leather Spellbook / Box", price:null, img:null, comingSoon:true,
   imgs:["images/spellbook-red.jpg"],
   desc:"Red leather-bound book/box with an embossed circular multicolor emblem and corner designs. D&D-style spellbook or deck box."},
  {id:"cat-charizard-coin", slug:"charizard-coin-frame", ebay:null, icon:"🪙", tag:"Collectible", name:"Charizard Coin + 3D-Printed Coin Holder Frame", price:null, img:null, comingSoon:true,
   imgs:["images/charizard-coin-frame.jpg"],
   desc:"Round metal coins in 3D-printed frames: a Charizard coin in a purple frame and a silver coin (wolf design) in a green frame. The Blooming Waters Charizard coin is currently a free bonus on bigger orders — the holder frames are the printed item here."},
  {id:"cat-vhs", slug:"vhs-lot", ebay:null, icon:"📼", tag:"Media", name:"VHS Tapes Lot", price:null, img:null, comingSoon:true,
   imgs:["images/vhs-lot.jpg"],
   desc:"Row of VHS tapes: “Sophie's Choice” (Meryl Streep), “White Wolves”, “Beginning Guitar with Will Schmid”, and others."},
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
  ["images/grovyle-cgc9-front.jpg","Grovyle — Reverse Holo","Arceus 39/99 · CGC 9 MINT"],
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
         <p style="color:var(--muted);font-size:13px">Shipping is by location unless the item says free shipping — calculated at checkout once Stripe and Square are connected. No charge is made until checkout is connected.</p>`;
      document.getElementById("checkoutBox").style.display = "block";
    }
  }
}
function openCart(){ renderCart(); document.getElementById("cartDrawer").classList.add("open"); document.getElementById("drawerScrim").classList.add("show"); }
function closeCart(){ document.getElementById("cartDrawer").classList.remove("open"); document.getElementById("drawerScrim").classList.remove("show"); }
function submitOrder(e){
  e.preventDefault();
  document.getElementById("orderMsg").textContent = "✓ This order was NOT placed and no card was charged. Checkout will run through Stripe or Square once payment links are wired.";
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
  return `<div class="card">
    ${photoHTML(p,0)}
    <div class="thumbs">${thumbs}</div>
    <div class="tag" style="margin-top:12px">${p.tag}</div>
    <h3>${p.name}</h3><p>${p.desc}</p>
    <p><span class="price">${money(p.price)}</span> <span class="ship">${p.ship}</span></p>
    <button class="btn" onclick="addToCart('${p.id}')">Add to cart</button>
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
    priceLine = `<p><span class="price">${money(c.price)}</span></p>
      <p><span class="pill" style="border-color:var(--pink);color:var(--pink)">⛔ OUT OF STOCK — not for sale</span></p>
      <p style="font-size:13px">Sold — no longer available.</p>`;
    buyBtn = `<button class="btn" disabled>Out of stock</button>`;
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
    <p>${buyBtn}${ebayLink}</p>
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
