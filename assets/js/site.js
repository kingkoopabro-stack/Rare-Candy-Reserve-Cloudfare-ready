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

/* ---------- Steady Wave banner ----------
   The station banner is FIXED now (2026-11-16) — the old time-of-day
   swap is gone. The radio page + home page show
   images/steady-wave-banner-top.jpg (the STEADY/HEART lettering) and
   the podcast pages show images/steady-wave-banner-bottom.jpg
   (cityscape + ON AIR). No JS swap — the <img> src in the HTML is
   the banner. Do not re-add a swap. */

/* ---------- shop data (copy + prices verbatim from the live site / eBay) ---------- */
const PRODUCTS = [
  {id:"tsp", slug:"modded-tsp", tag:"HANDHELD · Modded TSP", name:"TSP — Modded Trimui Smart Pro (CrossMix, 128GB Card)",
   desc:"Modded TSP (Trimui Smart Pro) — better than stock. CrossMix OS installed, fresh 128GB name-brand microSD (stock card replaced). Big 4.96-inch 720p screen, RGB-lit sticks, 5000mAh battery. Plays PS1, PSP, DS and more full speed, plus Morrowind, GTA and PC classics via PortMaster. Loaded with free ports and cool stuff. Fully decked out ($110) comes with everything — pink protective case + wrist strap included. Machine only ($95) is just the handheld — add the pink case for $10 or the wrist strap for $5. Modded to order — ready to play out of the box. (we do not condone piracy of any kind)",
   price:110.00, ship:"+ shipping (by location)", icon:"🎮",
   imgs:["images/trimui-smart-pro-black.jpg","images/trimui-smart-pro.jpg"],
   variations:[{label:"Fully decked out — everything included", price:110.00},{label:"Machine only — no case, no wrist strap", price:95.00},{label:"Machine only + pink case", price:105.00},{label:"Machine only + wrist strap", price:100.00}]},
  {id:"airpods-vice-case", slug:"airpods-vice-case", tag:"3D PRINT · RCR Brand PETG", name:"Neon Vice AirPods Pro Case Cover — Teal & Hot Pink",
   desc:"Custom 3D-printed hard-shell cover for AirPods Pro 2nd generation (USB-C) — hot pink lid, teal base, embossed palms, VI emblem and Vice City script on the lid. Snug fit, lid opens free, cutouts for charging + pairing button, lanyard loop ready. AirPods and charging case NOT included — cover only. Unofficial fan-inspired design; not affiliated with Apple Inc. or Rockstar Games.",
   price:22.00, stripe:"https://buy.stripe.com/cNi28tbbk7MF652gPU6sw03", ship:"+ shipping (by location)", icon:"🎧",
   imgs:["images/airpods-case-closed.jpg"]},
  {id:"enamel-pins", slug:"enamel-pins", tag:"ENAMEL PINS · Collectible", name:"Autism+Autistic Enamel Pin — Choose Your Pin",
   desc:"Enamel pins — collectible, actual size. Most pins $6 each. The three Ocarina of Time Deku Stones (Kokiri's Emerald, Goron's Ruby, Zora's Sapphire) are $6 each or $15 for all three as a set. Pick your pin from the dropdown. Unofficial fan-inspired designs.",
   price:6.00, ship:"+ shipping (by location)", icon:"📌",
   imgs:["images/autistic-pin-totem.jpg"],
   variations:[{label:"Autism+Autistic Enamel Pin", price:6.00},{label:"Parappa (Parappa the Rapper)", price:6.00},{label:"Master Onion", price:6.00},{label:"N64 Logo", price:6.00},{label:"Sunny Funny (Sunny Flower)", price:6.00},{label:"PJ Berri (the bear)", price:6.00},{label:"Deku Stone — Kokiri's Emerald", price:6.00},{label:"Deku Stone — Goron's Ruby", price:6.00},{label:"Deku Stone — Zora's Sapphire", price:6.00},{label:"Deku Stones — all three as a set", price:15.00}]},
  {id:"amby-deck", slug:"modded-amby-deck", tag:"HANDHELD · Modded Amby Deck", name:"Modded Amby Deck — Fully Modded Handheld (Choose Black, Indigo or Retro Gray)",
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. The ultimate fully moddable alternative to a Switch — cheaper, better features, and way more customization, for less cost overall, since all you need to pay for is the console and me modding it to your taste. See the real photo in the gallery — I use mine like a desktop, too. Immediate payment required. 12-day money-back guarantee. Fully modded and playable — faster than most PCs out of the box. Big 120Hz touchscreen, RGB backlit sticks, 8GB RAM + 128GB storage, Android. Plays PS2, GameCube, 3DS, PSP and Dreamcast, plus PC games via Winlator. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Loaded with free ports and cool stuff. Case applied, wrist wrap installed, and anti-shock case included. Modded to order. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)",
   price:230.00, ship:"+ shipping (by location)", icon:"🎮",
   imgs:["images/amby-deck-two.jpg","images/amby-rg476h-real.jpg"],
   variations:[{label:"Black", price:230.00},{label:"Indigo", price:230.00},{label:"Retro Gray", price:230.00}]},
  {id:"amby-flip", slug:"modded-amby-flip", tag:"HANDHELD · Modded Amby FLIP", name:"Amby FLIP — Modded Flip Handheld (Android 12, 3.5-inch Touchscreen)",
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby FLIP — the flip handheld. Flip it open to play, spin the screen, close it up and it doubles as a clock. Gorgeous 3.5-inch IPS touchscreen at 720×720, Unisoc Tiger T618 chip, 3GB RAM + 32GB storage, Android 12, 2000mAh battery. WiFi 5 + Bluetooth 5.0, USB-C DAC to 3.5mm headphone jack, high-fidelity stereo speakers, D-pad joystick mapping, swappable high/low L2/R2 shoulder buttons. Plays PS2, Wii, GameCube, 3DS, PSP, Dreamcast, Saturn, PS1, DS, N64, Arcade, NeoGeo, GBA, GBC, GB, SNES, NES, Genesis, Master System, Game Gear, MSX, PC Engine, WonderSwan and N-Gage, plus Android games and PC games via streaming. Four ways to play: cast to TV like a home console, stream and play AAA titles, handheld mode, or Wi-Fi multiplayer with a friend. Switch watch faces, raise a virtual pet, and grab games with the RixelHK game downloader and AI assistant. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Modded to order — ready to play out of the box. Choose Polar Black (aluminum alloy + ABS plastic), Aurora Silver (full aluminum alloy), or Polar Black + Bag with the carry bag included. In the box: console, USB charging cable, lanyard, high shoulder buttons (L2/R2), user manual, color box, screen protector — bag variant adds the bag. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. Buyer pays shipping. (we do not condone piracy of any kind)",
   price:105.00, ship:"+ shipping (by location)", icon:"🎮",
   imgs:["images/amby-flip-v2-01-lead.jpg?v=e3ab3ca","images/amby-flip-v2-02-specs.jpg","images/amby-flip-v2-03-box.jpg"],
   variations:[{label:"Polar Black — Modded, machine only", price:105.00},{label:"Aurora Silver — Modded, machine only", price:105.00},{label:"Polar Black + Bag — Modded, machine only + carry bag", price:115.00}]},
  {id:"bricktsp", slug:"modded-bricktsp", tag:"HANDHELD · Modded BrickTSP", name:"BrickTSP — Modded Pocket Handheld (CrossMix, 128GB Card)",
   desc:"BrickTSP — a pocket-size vertical handheld, modded and ready to play. CrossMix OS installed, fresh 128GB name-brand microSD (stock card replaced). Sharp 3.2-inch 4:3 screen, 3000mAh battery, WiFi + Bluetooth. Plays PS1, SNES, Genesis, GBA and more full speed, plus light N64/Dreamcast. Loaded with free ports and cool stuff. Fully decked out ($105) comes with everything — protective case + wrist strap included. Machine only ($90) is just the handheld — add the protective case for $10 or the wrist strap for $5. Modded to order — ready to play out of the box. (we do not condone piracy of any kind)",
   price:105.00, ship:"+ shipping (by location)", icon:"🎮",
   imgs:["images/bricktsp.jpg"],
   variations:[{label:"Fully decked out — everything included", price:105.00},{label:"Machine only — no case, no wrist strap", price:90.00},{label:"Machine only + protective case", price:100.00},{label:"Machine only + wrist strap", price:95.00}]},
  {id:"nds-tsp", slug:"modded-nds-tsp", tag:"HANDHELD · Modded NDS TSP", name:"NDS TSP — Dual-Screen Handheld, Tested Working (DS + GBA)",
   desc:"NDS TSP — the classic dual-screen handheld, cleaned, tested and ready to play. Two screens, touch screen, dual slots — plays DS games AND Game Boy Advance cartridges. Both screens tested, touch screen responsive, buttons and speakers checked. Fully decked out ($105) comes with everything — fresh battery if the old one is weak, charger, stylus + protective case included. Machine only ($90) is the handheld + charger — add the protective case for $10 or the wrist strap for $5. Tested working before it ships. (we do not condone piracy of any kind)",
   price:105.00, ship:"+ shipping (by location)", icon:"🎮",
   imgs:["images/nds-tsp.jpg"],
   variations:[{label:"Fully decked out — everything included", price:105.00},{label:"Machine only — no case, no wrist strap", price:90.00},{label:"Machine only + protective case", price:100.00},{label:"Machine only + wrist strap", price:95.00}]},
  {id:"tsp-slide", slug:"modded-tsp-slide", tag:"HANDHELD · Modded TSP SLIDE", name:"TSP SLIDE — Modded Flip Handheld (muOS, 128GB Card)",
   desc:"TSP SLIDE — the flip handheld, modded and ready to play. Folds closed to protect the screen in your pocket or bag, flips open to play. muOS installed, fresh 128GB name-brand microSD (stock card replaced). Crisp 3.5-inch 4:3 screen, 3300mAh battery, WiFi + Bluetooth, mini HDMI out. Plays GBA, NES, SNES, Genesis and PS1 full speed, plus light N64. Loaded with free ports and cool stuff. Fully decked out ($105) comes with everything — protective case + wrist strap included. Machine only ($90) is just the handheld — add the protective case for $10 or the wrist strap for $5. Modded to order — ready to play out of the box. (we do not condone piracy of any kind)",
   price:105.00, ship:"+ shipping (by location)", icon:"🎮",
   imgs:["images/tsp-slide.jpg"],
   variations:[{label:"Fully decked out — everything included", price:105.00},{label:"Machine only — no case, no wrist strap", price:90.00},{label:"Machine only + protective case", price:100.00},{label:"Machine only + wrist strap", price:95.00}]},
];
/* Live eBay inventory — titles + prices exact (verified 2026-11-06).
   Photos wired from Ash's Drive (drive-photo-map.md, 2026-11-09); Sunflora still has
   no photo in Drive — it keeps the placeholder until he sends one.
   Variation labels for Beholder / extender are unknown — shown as Variation 1/2/3, Style 1/2.
   comingSoon entries are photographed but unpriced (no price, not buyable);
   draft entries are approved but not posted yet (price shown, not buyable). */
const CATALOG = [
  {id:"cat-gengar", slug:"gengar-cgc9", ebay:"168803766775", icon:"👻", tag:"Graded Card · CGC 9", name:"CGC 9 Gengar ex 047/071 Japanese Wild Force", price:20.00, img:null,
   imgs:["images/gengar-ex-front.jpg","images/gengar-ex-display.jpg","images/gengar-ex-closeup.jpg"]},
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
  {id:"cat-sunflora", slug:"sunflora-cgc10", ebay:"168711754988", icon:"🌻", tag:"Graded Card · CGC Pristine 10", name:"2024 Sunflora AR 102/101 CGC Pristine 10", price:30.00, stripe:"https://buy.stripe.com/aFabJ3gvE3wp3WUarw6sw0h", img:"images/sunflora-cgc10-1.jpg",
   imgs:["images/sunflora-cgc10-1.jpg","images/sunflora-cgc10-2.jpg","images/sunflora-cgc10-3.jpg"]},
  {id:"cat-glaceon", slug:"glaceon-vmax", ebay:"168818972853", icon:"❄️", tag:"Graded Card · CGC 8.5", name:"CGC 8.5 Glaceon VMAX 041/203 Evolving Skies", price:30.00, stripe:"https://buy.stripe.com/14A9AV6V4d6Z1OMbvA6sw0j", img:null,
   imgs:["images/glaceon-vmax-front.jpg","images/glaceon-vmax-display.jpg","images/glaceon-vmax-closeup.jpg","images/glaceon-vmax-back.jpg"],
   desc:"Glaceon VMAX, Evolving Skies 041/203 Holo, CGC 8.5 NM/MINT+. Comes with the white PETG slab bumper. Free glow bracelet with this Pokémon card order."},
  {id:"cat-rayquaza", slug:"rayquaza-v", ebay:"168818990115", icon:"🐉", tag:"Graded Card · CGC 9", name:"CGC 9 Rayquaza V 107/172 Japanese VSTAR Universe", price:18.00, img:null, outOfStock:true,
   imgs:["images/rayquaza-v-front.jpg"]},
  {id:"cat-vulpix", slug:"vulpix-v", ebay:"168819002299", icon:"🦊", tag:"Graded Card · CGC 8.5", name:"CGC 8.5 Alolan Vulpix V 033/195 Silver Tempest", price:20.00, stripe:"https://buy.stripe.com/aFa5kFa7g9UN0KI6bg6sw0k", img:null,
   imgs:["images/vulpix-v-front.jpg","images/vulpix-v-display.jpg","images/vulpix-v-back.jpg","images/vulpix-v-closeup.jpg"],
   desc:"Alolan Vulpix V, Silver Tempest 033/195 Holo, CGC 8.5 NM/MINT+. Comes with the dark slab bumper. Free glow bracelet with this Pokémon card order."},
  /* Copperajah draft — approved $15.00 price, NOT posted to eBay yet. Do not make it buyable. */
  {id:"cat-copperajah", slug:"copperajah-cgc10", ebay:null, icon:"🐘", tag:"Graded Card · CGC 10", name:"CGC 10 Copperajah ex 088/071 Japanese Snow Hazard", price:15.00, img:null, outOfStock:true,
   imgs:["images/copperajah-ex-front.jpg"],
   desc:"Draft listing — approved price $15.00, not posted to eBay yet. CGC GEM MINT 10, cert 6102490197, 300 HP, Snow Hazard 088/071 Super Rare Holo."},
  /* New slabs — photographed, not priced yet. comingSoon: show photo + assessment, no price, not buyable. */
  {id:"cat-spearow", slug:"spearow-psa10", ebay:null, icon:"🐦", tag:"Graded Card · PSA 10", name:"Spearow — Art Rare, PSA 10 GEM MT", price:40.00, img:null,
   imgs:["images/spearow-psa10-front.jpg"],
   desc:"Spearow, 2025 Pokémon M1L JP #074, Art Rare, Japanese. PSA GEM MT 10, cert 127913713."},
  {id:"cat-mrmime", slug:"sabrinas-mr-mime", ebay:null, icon:"🎩", tag:"Graded Card · CGC 9", name:"Sabrina's Mr. Mime — CGC 9 MINT", price:null, img:null, outOfStock:true,
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
  {id:"cat-mimikyu", slug:"mimikyu-gx-raw", ebay:null, icon:"🃏", tag:"Raw Card", name:"Mimikyu Horror House GX — Raw", price:300.00, img:null,
   imgs:["images/mimikyu-gx-raw.jpg"],
   desc:"Raw Mimikyu TAG TEAM GX card (Horror House GX). Sleeved, held in hand. Best Offer accepted — strong grading potential (PSA 10 is 5–8x raw), message the shop."},
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
   imgs:["images/pokemon-shield-cart-1.jpg","images/pokemon-shield-cart-2.jpg","images/pokemon-shield-cart-3.jpg","images/pokemon-shield-cart-loose.jpg"],
   desc:"Pokémon Shield (2019) for Nintendo Switch — loose cartridge only, no case or box. Tested working. Fair eBay loose price — recent sold listings $25–$35."},
  {id:"cat-deadlands-lot", slug:"deadlands-lot-25", ebay:null, icon:"🃏", tag:"TCG Lot · Deadlands", name:"Deadlands TCG — Shrink-Wrapped Lot, 25 Cards", price:12.00, stripe:"https://buy.stripe.com/8x28wR0wG9UN3WU9ns6sw0g", img:null,
   imgs:["images/placeholder.svg"],
   desc:"25 Deadlands cards, shrink-wrapped as a lot. Best quantity for a playable / collectible starter lot — 25 cards, mixed."},
  {id:"cat-custom-mini", slug:"custom-mini", ebay:null, icon:"♟", tag:"Custom Miniature", name:"Custom Tabletop Mini — Choose a Type or Design Your Own", price:12.00, img:null,
   imgs:["images/mini-beholder-group.jpg"],
   variations:[{label:"Standard mini — from $12", price:12.00},{label:"Beholder — $20", price:20.00},{label:"Dragon — $25", price:25.00},{label:"Knight / Paladin — $18", price:18.00},{label:"Wizard — $18", price:18.00},{label:"Rogue — $18", price:18.00},{label:"Design your own — $25", price:25.00}],
   desc:"Order a custom tabletop mini: pick a type — Beholder, Dragon, Knight/Paladin, Wizard, Rogue — or design your own and describe it in the custom order form. Printed to order."},
  {id:"cat-trimui-smart-pro", slug:"trimui-smart-pro-modded", ebay:null, icon:"🎮", tag:"Handheld · Modded TSP", name:"TSP — Modded Trimui Smart Pro (CrossMix, 128GB Card)", price:110.00, img:null,
   imgs:["images/trimui-smart-pro-black.jpg","images/trimui-smart-pro.jpg"],
   variations:[{label:"Fully decked out — everything included", price:110.00},{label:"Machine only — no case, no wrist strap", price:95.00},{label:"Machine only + pink case", price:105.00},{label:"Machine only + wrist strap", price:100.00}],
   desc:"Modded TSP (Trimui Smart Pro) — better than stock. CrossMix OS installed, fresh 128GB name-brand microSD (stock card replaced). Big 4.96-inch 720p screen, RGB-lit sticks, 5000mAh battery. Plays PS1, PSP, DS and more full speed, plus Morrowind, GTA and PC classics via PortMaster. Loaded with free ports and cool stuff. Fully decked out ($110) comes with everything — pink protective case + wrist strap included. Machine only ($95) is just the handheld — add the pink case for $10 or the wrist strap for $5. Modded to order — ready to play out of the box. (we do not condone piracy of any kind)"},
  {id:"cat-ambyrg", slug:"modded-ambyrg-rg476h", ebay:null, icon:"🎮", tag:"Handheld · Modded AmbyRG", name:"Modded AmbyRG — 120Hz Android Handheld in All Its Glory", price:210.00, img:null,
   imgs:["images/anbernic-rg476h-rgb.jpg","images/anbernic-rg476h.jpg","images/amby-rg476h-real.jpg"],
   variations:[{label:"Black", price:210.00},{label:"Indigo", price:210.00},{label:"Retro Gray", price:210.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. The ultimate fully moddable alternative to a Switch — cheaper, better features, and way more customization, for less cost overall, since all you need to pay for is the console and me modding it to your taste. See the real photo in the gallery — I use mine like a desktop, too. Immediate payment required. 12-day money-back guarantee. Modded AmbyRG in all its glory. Gorgeous 4.7-inch 120Hz touchscreen, RGB backlit sticks that glow blue, pink and cyan, Hall-effect sticks, 8GB RAM + 128GB storage, Android 13. Plays PS2, GameCube, 3DS, PSP and Dreamcast, plus Android apps and PC games via Winlator (Oblivion runs at low settings). Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Modded to order — ready to play out of the box. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)"},
  {id:"cat-bricktsp", slug:"bricktsp-modded", ebay:null, icon:"🎮", tag:"Handheld · Modded BrickTSP", name:"BrickTSP — Modded Pocket Handheld (CrossMix, 128GB Card)", price:105.00, img:null,
   imgs:["images/bricktsp.jpg"],
   variations:[{label:"Fully decked out — everything included", price:105.00},{label:"Machine only — no case, no wrist strap", price:90.00},{label:"Machine only + protective case", price:100.00},{label:"Machine only + wrist strap", price:95.00}],
   desc:"BrickTSP — a pocket-size vertical handheld, modded and ready to play. CrossMix OS installed, fresh 128GB name-brand microSD (stock card replaced). Sharp 3.2-inch 4:3 screen, 3000mAh battery, WiFi + Bluetooth. Plays PS1, SNES, Genesis, GBA and more full speed, plus light N64/Dreamcast. Loaded with free ports and cool stuff. Fully decked out ($105) comes with everything — protective case + wrist strap included. Machine only ($90) is just the handheld — add the protective case for $10 or the wrist strap for $5. Modded to order — ready to play out of the box. (we do not condone piracy of any kind)"},
  {id:"cat-nds-tsp", slug:"nds-tsp-modded", ebay:null, icon:"🎮", tag:"Handheld · Modded NDS TSP", name:"NDS TSP — Dual-Screen Handheld, Tested Working (DS + GBA)", price:105.00, img:null,
   imgs:["images/nds-tsp.jpg"],
   variations:[{label:"Fully decked out — everything included", price:105.00},{label:"Machine only — no case, no wrist strap", price:90.00},{label:"Machine only + protective case", price:100.00},{label:"Machine only + wrist strap", price:95.00}],
   desc:"NDS TSP — the classic dual-screen handheld, cleaned, tested and ready to play. Two screens, touch screen, dual slots — plays DS games AND Game Boy Advance cartridges. Both screens tested, touch screen responsive, buttons and speakers checked. Fully decked out ($105) comes with everything — fresh battery if the old one is weak, charger, stylus + protective case included. Machine only ($90) is the handheld + charger — add the protective case for $10 or the wrist strap for $5. Tested working before it ships. (we do not condone piracy of any kind)"},
  {id:"cat-tsp-slide", slug:"tsp-slide-modded", ebay:null, icon:"🎮", tag:"Handheld · Modded TSP SLIDE", name:"TSP SLIDE — Modded Flip Handheld (muOS, 128GB Card)", price:105.00, img:null,
   imgs:["images/tsp-slide.jpg"],
   variations:[{label:"Fully decked out — everything included", price:105.00},{label:"Machine only — no case, no wrist strap", price:90.00},{label:"Machine only + protective case", price:100.00},{label:"Machine only + wrist strap", price:95.00}],
   desc:"TSP SLIDE — the flip handheld, modded and ready to play. Folds closed to protect the screen in your pocket or bag, flips open to play. muOS installed, fresh 128GB name-brand microSD (stock card replaced). Crisp 3.5-inch 4:3 screen, 3300mAh battery, WiFi + Bluetooth, mini HDMI out. Plays GBA, NES, SNES, Genesis and PS1 full speed, plus light N64. Loaded with free ports and cool stuff. Fully decked out ($105) comes with everything — protective case + wrist strap included. Machine only ($90) is just the handheld — add the protective case for $10 or the wrist strap for $5. Modded to order — ready to play out of the box. (we do not condone piracy of any kind)"},
  {id:"cat-amby-glow", slug:"amby-glow", ebay:null, icon:"🎮", tag:"Handheld · Modded Amby Glow", name:"Amby Glow — Modded AMOLED Flagship (Dimensity 8300)", price:337.00, img:null,
   imgs:["images/amby-glow.jpg"],
   variations:[{label:"Modded — fully decked out (case + wrist wrap + anti-shock case)", price:337.00},{label:"Modded — machine only", price:317.00},{label:"Stock — unmodded, ordered when you buy (allow extra time)", price:277.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby Glow — the brightest screen in the lineup. Big 5.48-inch AMOLED at 1920×1080, Dimensity 8300 chip, 8GB RAM + 128GB storage (12GB + 256GB available), Android 14. RGB-lit capacitive sticks, Hall triggers, 6-axis gyro, active fan + heat-pipe cooling, USB-C 1080p out, 27W fast charging, 5500mAh battery. Plays PS2, GameCube, Wii and light Switch, plus Android apps and PC games via Winlator. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Decked-out version has the case applied, wrist wrap installed, and anti-shock case included. Modded to order — ready to play out of the box. Stock version is unmodded and ordered when you buy — please allow a little extra time. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)"},
  {id:"cat-amby-metal", slug:"amby-metal", ebay:null, icon:"🎮", tag:"Handheld · Modded Amby Metal", name:"Amby Metal — Modded Metal Flagship (Dimensity 8300)", price:385.00, img:null,
   imgs:["images/amby-metal.jpg"],
   variations:[{label:"Modded — fully decked out (case + wrist wrap + anti-shock case)", price:385.00},{label:"Modded — machine only", price:365.00},{label:"Stock — unmodded, ordered when you buy (allow extra time)", price:325.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby Metal — CNC aluminum alloy body, premium in the hand. Gorgeous 4.7-inch 120Hz touchscreen, Dimensity 8300 chip, 12GB RAM + 256GB storage, Android 14, 5300mAh battery with 27W charging, Wi-Fi 6E. Plays PS2, GameCube, Wii and light Switch, plus Android apps and PC games via Winlator. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Silicone protective case included, plus case + wrist strap on the decked-out version. Modded to order — ready to play out of the box. Stock version is unmodded and ordered when you buy — please allow a little extra time. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)"},
  {id:"cat-amby-slide", slug:"amby-slide", ebay:null, icon:"🎮", tag:"Handheld · Modded Amby Slide", name:"Amby Slide — Modded Slide-Out Handheld (120Hz)", price:210.00, img:null,
   imgs:["images/amby-slide.jpg"],
   variations:[{label:"Modded — fully decked out (case + wrist wrap + anti-shock case)", price:210.00},{label:"Modded — machine only", price:190.00},{label:"Stock — unmodded, ordered when you buy (allow extra time)", price:150.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby Slide — the controls slide out, PSP Go-style, and tuck away for your pocket. Gorgeous 4.7-inch 120Hz touchscreen, Unisoc T820 chip, 8GB RAM + 128GB storage, Android 13, 5000mAh battery. Capacitive Hall joysticks, TF card up to 2TB. Plays PS2, GameCube, 3DS and light Wii, plus Android apps and PC games via Winlator. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Decked-out version has the case applied, wrist wrap installed, and anti-shock case included. Modded to order — ready to play out of the box. Stock version is unmodded and ordered when you buy — please allow a little extra time. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)"},
  {id:"cat-amby-vert", slug:"amby-vert", ebay:null, icon:"🎮", tag:"Handheld · Modded Amby Vert", name:"Amby Vert — Modded Vertical Handheld (T820)", price:230.00, img:null,
   imgs:["images/amby-vert.jpg"],
   variations:[{label:"Modded — fully decked out (case + wrist wrap + anti-shock case)", price:230.00},{label:"Modded — machine only", price:210.00},{label:"Stock — unmodded, ordered when you buy (allow extra time)", price:170.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby Vert — the vertical powerhouse. 4-inch 960×720 multi-touch screen, Unisoc T820 chip, 8GB RAM + 128GB storage, Android 13, 5500mAh battery (about 8 hours). Big-angle 3D Hall joysticks, RGB lighting, 6-axis gyro, fan + heat-pipe cooling, USB-C 1080p out. Plays PS2, GameCube and 3DS, plus Android apps and PC games via Winlator. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Decked-out version has the case applied, wrist wrap installed, and anti-shock case included. Modded to order — ready to play out of the box. Stock version is unmodded and ordered when you buy — please allow a little extra time. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)"},
  {id:"cat-amby-cube", slug:"amby-cube", ebay:null, icon:"🎮", tag:"Handheld · Modded Amby Cube", name:"Amby Cube — Modded Square-Screen Handheld (T820)", price:193.00, img:null,
   imgs:["images/amby-cube.jpg"],
   variations:[{label:"Modded — fully decked out (case + wrist wrap + anti-shock case)", price:193.00},{label:"Modded — machine only", price:173.00},{label:"Stock — unmodded, ordered when you buy (allow extra time)", price:133.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby Cube — the square one. 3.95-inch 720×720 touchscreen, Unisoc T820 chip, 8GB RAM + 128GB storage, Android 13, 5200mAh battery (about 7 hours). Hall sticks + Hall triggers, 16M-color RGB joystick lighting, 6-axis gyro, active fan cooling, USB-C 1080p out. Plays PS2, GameCube, Wii and light 3DS, plus Android apps and PC games via Winlator. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Decked-out version has the case applied, wrist wrap installed, and anti-shock case included. Modded to order — ready to play out of the box. Stock version is unmodded and ordered when you buy — please allow a little extra time. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)"},
  {id:"cat-amby-big", slug:"amby-big", ebay:null, icon:"🎮", tag:"Handheld · Modded Amby Big", name:"Amby Big — Modded Big-Screen Handheld (Snapdragon)", price:206.00, img:null,
   imgs:["images/amby-big.jpg"],
   variations:[{label:"4GB — Modded — fully decked out (case + wrist wrap + anti-shock case)", price:206.00},{label:"4GB — Modded — machine only", price:186.00},{label:"8GB — Modded — fully decked out (case + wrist wrap + anti-shock case)", price:230.00},{label:"8GB — Modded — machine only", price:210.00},{label:"4GB — Stock — unmodded, ordered when you buy (allow extra time)", price:146.00},{label:"8GB — Stock — unmodded, ordered when you buy (allow extra time)", price:170.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby Big — the biggest screen here. 5.5-inch 1920×1080 multi-touch screen, Snapdragon G1 Gen 2 chip, 4GB or 8GB RAM + 64GB or 128GB storage, Android 14, 6000mAh battery (about 8 hours), 18W charging. 3D Hall joysticks + Hall triggers, 16M-color RGB stick lighting, active cooling. Plays PS2, GameCube, Wii and 3DS, plus Android apps and PC games via Winlator. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Decked-out versions have the case applied, wrist wrap installed, and anti-shock case included. Modded to order — ready to play out of the box. Stock versions are unmodded and ordered when you buy — please allow a little extra time. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)"},
  {id:"cat-amby-duo", slug:"amby-duo", ebay:null, icon:"🎮", tag:"Handheld · Modded Amby Duo", name:"Amby Duo — Modded Dual-Screen Handheld", price:165.00, img:null,
   imgs:["images/amby-duo.jpg"],
   variations:[{label:"Modded — fully decked out (case + wrist wrap + anti-shock case)", price:165.00},{label:"Modded — machine only", price:145.00},{label:"Stock — unmodded, ordered when you buy (allow extra time)", price:105.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby Duo — two screens, the way DS games were meant to be played. Dual 4-inch IPS touch screens, Rockchip RK3568 chip, 3GB RAM + 32GB storage, Android 14 / Linux dual OS, 4000mAh battery (about 6 hours). Capacitive stylus included, Hall switch puts it to sleep when you close it, TF card up to 2TB. Plays DS natively plus PS1, N64 and light 3DS/Dreamcast. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Decked-out version has the case applied, wrist wrap installed, and anti-shock case included. Modded to order — ready to play out of the box. Stock version is unmodded and ordered when you buy — please allow a little extra time. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)"},
  {id:"cat-amby-flip", slug:"amby-flip-modded", ebay:null, icon:"🎮", tag:"Handheld · Modded Amby FLIP", name:"Amby FLIP — Modded Flip Handheld (Android 12, 3.5-inch Touchscreen)", price:105.00, img:null,
   imgs:["images/amby-flip-v2-01-lead.jpg?v=e3ab3ca","images/amby-flip-v2-02-specs.jpg","images/amby-flip-v2-03-box.jpg"],
   variations:[{label:"Polar Black — Modded, machine only", price:105.00},{label:"Aurora Silver — Modded, machine only", price:105.00},{label:"Polar Black + Bag — Modded, machine only + carry bag", price:115.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby FLIP — the flip handheld. Flip it open to play, spin the screen, close it up and it doubles as a clock. Gorgeous 3.5-inch IPS touchscreen at 720×720, Unisoc Tiger T618 chip, 3GB RAM + 32GB storage, Android 12, 2000mAh battery. WiFi 5 + Bluetooth 5.0, USB-C DAC to 3.5mm headphone jack, high-fidelity stereo speakers, D-pad joystick mapping, swappable high/low L2/R2 shoulder buttons. Plays PS2, Wii, GameCube, 3DS, PSP, Dreamcast, Saturn, PS1, DS, N64, Arcade, NeoGeo, GBA, GBC, GB, SNES, NES, Genesis, Master System, Game Gear, MSX, PC Engine, WonderSwan and N-Gage, plus Android games and PC games via streaming. Four ways to play: cast to TV like a home console, stream and play AAA titles, handheld mode, or Wi-Fi multiplayer with a friend. Switch watch faces, raise a virtual pet, and grab games with the RixelHK game downloader and AI assistant. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Modded to order — ready to play out of the box. Choose Polar Black (aluminum alloy + ABS plastic), Aurora Silver (full aluminum alloy), or Polar Black + Bag with the carry bag included. In the box: console, USB charging cable, lanyard, high shoulder buttons (L2/R2), user manual, color box, screen protector — bag variant adds the bag. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. Buyer pays shipping. (we do not condone piracy of any kind)"},
  {id:"cat-amby-pro", slug:"amby-pro", ebay:null, icon:"🎮", tag:"Handheld · Modded Amby Pro", name:"Amby Pro — Modded Dual-Boot Handheld", price:204.00, img:null,
   imgs:["images/amby-pro.jpg"],
   variations:[{label:"Modded — fully decked out (case + wrist wrap + anti-shock case)", price:204.00},{label:"Modded — machine only", price:184.00},{label:"Stock — unmodded, ordered when you buy (allow extra time)", price:144.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby Pro — two systems in one. 5.5-inch 1920×1080 touchscreen, Rockchip RK3576 chip, 4GB RAM + 64GB storage, Android 14 / Linux dual-boot, 5000mAh battery, Wi-Fi 6. Hall joysticks. Plays PS2, GameCube and 3DS, plus Android apps and PC games via Winlator. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Decked-out version has the case applied, wrist wrap installed, and anti-shock case included. Modded to order — ready to play out of the box. Stock version is unmodded and ordered when you buy — please allow a little extra time. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)"},
  {id:"cat-amby-mini", slug:"amby-mini", ebay:null, icon:"🎮", tag:"Handheld · Modded Amby Mini", name:"Amby Mini — Modded Square Pocket Handheld", price:129.00, img:null,
   imgs:["images/amby-mini.jpg?v=bf93f61"],
   variations:[{label:"Modded — fully decked out (case + wrist wrap + anti-shock case)", price:129.00},{label:"Modded — machine only", price:109.00},{label:"Stock — unmodded, ordered when you buy (allow extra time)", price:69.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby Mini — the little square one. 3.95-inch 720×720 screen (1:1, perfect for arcade and Game Boy), Allwinner H700 chip, 1GB RAM + 16GB storage, Linux, 3800mAh battery (about 6.5 hours). 16M-color RGB joystick lighting, Sega-style D-pad, dual TF slots to 512GB, Wi-Fi + Bluetooth. Plays PS1, N64 and light Dreamcast, plus some PSP. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Decked-out version has the case applied, wrist wrap installed, and anti-shock case included. Modded to order — ready to play out of the box. Stock version is unmodded and ordered when you buy — please allow a little extra time. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)"},
  {id:"cat-amby-micro", slug:"amby-micro", ebay:null, icon:"🎮", tag:"Handheld · Modded Amby Micro", name:"Amby Micro — Modded Micro Pocket Handheld", price:102.00, img:null,
   imgs:["images/amby-micro.jpg"],
   variations:[{label:"Modded — fully decked out (case + wrist wrap + anti-shock case)", price:102.00},{label:"Modded — machine only", price:82.00},{label:"Stock — unmodded, ordered when you buy (allow extra time)", price:42.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby Micro — fits in a coin pocket. 2.83-inch 640×480 screen, Allwinner H700 chip, 1GB RAM + 16GB storage, Linux, 3100mAh battery (about 8 hours). HD TV-out, vibration motor, dual TF slots to 512GB. No Wi-Fi — this one is all about the games in your pocket. Plays PS1, N64 and light Dreamcast, plus PSP. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Decked-out version has the case applied, wrist wrap installed, and anti-shock case included. Modded to order — ready to play out of the box. Stock version is unmodded and ordered when you buy — please allow a little extra time. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)"},
  {id:"cat-amby-retro", slug:"amby-retro", ebay:null, icon:"🎮", tag:"Handheld · Modded Amby Retro", name:"Amby Retro — Modded GBA-Style Vertical Handheld", price:124.00, img:null,
   imgs:["images/amby-retro.jpg"],
   variations:[{label:"Modded — fully decked out (case + wrist wrap + anti-shock case)", price:124.00},{label:"Modded — machine only", price:104.00},{label:"Stock — unmodded, ordered when you buy (allow extra time)", price:64.00}],
   desc:"A poor man’s Steam Deck — better than anything you’ll find in this country. Be one of the few who own a machine this powerful, modded to add even more functionality when it arrives. Immediate payment required. 12-day money-back guarantee. Amby Retro — the Game Boy-shaped one. 3.4-inch 720×480 screen, Allwinner H700 chip, 1GB RAM + 16GB storage, Linux, 3500mAh battery (about 7 hours). Extra X/Y + L2/R2 buttons, HDMI TV-out, vibration motor, dual TF slots to 512GB, Wi-Fi + Bluetooth. Plays PS1, N64 and light Dreamcast. Fresh name-brand microSD (stock card replaced), tuned OS and programs pre-installed to your taste. Decked-out version has the case applied, wrist wrap installed, and anti-shock case included. Modded to order — ready to play out of the box. Stock version is unmodded and ordered when you buy — please allow a little extra time. Ordered a modded one? Message Rare Candy Reserve on Facebook and tell us how you want your console customized — OS, programs, setup, anything. We order your unit when you buy and mod it to your wants when it arrives in the mail, then ship it out to you. Please allow a little extra time. (we do not condone piracy of any kind)"},
  /* --- New listings — 2026-11-16 (Chris's batch: MCR vinyl, Pi + NES shell, death whistle, octopus, Sonic clock, Gengar stand, coin holder, used games) --- */
  {id:"cat-mcr-vinyl", slug:"mcr-vinyl-three-cheers", ebay:null, icon:"🎵", tag:"Vinyl · Used — NM Record", name:"My Chemical Romance — Three Cheers for Sweet Revenge (Vinyl)", price:20.00, img:null,
   imgs:["images/mcr-vinyl.jpg"],
   desc:"My Chemical Romance — Three Cheers for Sweet Revenge on vinyl. Record is NM, case was opened, record played once. Buyer pays shipping."},
  {id:"cat-pi-nes", slug:"raspberry-pi-nes-shell", ebay:null, icon:"🍓", tag:"Raspberry Pi · Modded + Printed Shell", name:"Your first Raspberry Pi + NES shell printed (other options available) pre installed extra parts!", price:65.00, img:null,
   imgs:["images/pi-nes-shell.jpg","images/pi-gpio-diagram.jpg"],
   variations:[{label:"Raspberry Pi 3B+ — with printed NES shell + modding", price:65.00},{label:"Raspberry Pi 4B+ — with printed NES shell + modding", price:95.00}],
   desc:"Your first Raspberry Pi, in a 3D-printed NES-style shell, modded to work exactly how you need it. Custom firmware and a personalized OS with a boot splash screen of your design or mine. Heatsink(s) installed in the critical places. Power cord is optional — message the shop if you need one. Shell printed in PETG. Good for servers, app dev and developer tools, a mini PC, retro gaming, a relay, hosting your own website for free, or blocking ads on all devices on your network. The modding and the custom shell are what set it apart — you pay for the Pi and the work. Buyer pays shipping."},
  {id:"cat-death-whistle", slug:"aztec-death-whistle", ebay:null, icon:"💀", tag:"3D PRINT · Replica", name:"Aztec Death Whistle — 3D Printed Replica", price:8.00, img:null,
   imgs:["images/death-whistle.jpg"],
   desc:"3D-printed replica of the actual Aztec death whistle. Comes with a braided rope authentic necklace. Available in aged or new bone feel and look. Terrifying sound when blown. Buyer pays shipping."},
  {id:"cat-octopus-holder", slug:"octopus-holder", ebay:null, icon:"🐙", tag:"3D PRINT · Mounted Holder", name:"3D Printed Octopus Holder — Screw / Bolt Mounted", price:15.00, img:null,
   imgs:["images/octopus-holder.jpg"],
   desc:"3D-printed octopus holder, screw or bolt mounted. Holds vases, drink cans, or mini hookahs — that is what it was made for, besides soda cans — and it works for controllers and remotes too. Super sturdy, made on demand. Buyer pays shipping."},
  {id:"cat-sonic-clock", slug:"sonic-alarm-clock", ebay:null, icon:"🦔", tag:"Alarm Clock · SEGA", name:"Sonic the Hedgehog Alarm Clock (SEGA)", price:20.00, img:null,
   imgs:["images/sonic-clock-front.jpg","images/sonic-clock-back.jpg"],
   desc:"Sonic the Hedgehog twin-bell alarm clock by SEGA. Blue bells, Sonic on the dial, ©SEGA on the back. See the photos for condition — front and back shown. Buyer pays shipping."},
  {id:"cat-gengar-stand", slug:"gengar-shadow-stand", ebay:null, icon:"👻", tag:"3D PRINT · Display Stand", name:"Gengar Shadow Display Stand — 3D Printed", price:8.00, img:null,
   imgs:["images/gengar-shadow-stand.jpg","images/gengar-ex-display.jpg"],
   desc:"3D-printed Gengar shadow display stand — Gengar, Haunter, and Gastly silhouettes in a round frame with bats and bare branches. Stand only — the graded card and figure in the other photo are NOT included. Perfect for showing off a Gengar slab. Buyer pays shipping."},
  {id:"cat-coin-holder", slug:"coin-case-slip-holder", ebay:null, icon:"🪙", tag:"Coin Display · 3D Printed", name:"Coin Case Slip Holder — Charizard + Zekrom Coins", price:15.00, img:null,
   imgs:["images/coin-holders-wide.jpg","images/coin-charizard.jpg","images/coin-zekrom.jpg","images/coin-holders-bracelets.jpg"],
   desc:"Two Pokémon coins in 3D-printed slip holders — Charizard and Zekrom — so you can display your coins in card cases. One listing: both coins and both holders included. Buyer pays shipping."},
  {id:"cat-used-games", slug:"used-games", ebay:null, icon:"🎮", tag:"Video Games · Used", name:"Used Games — Loose", price:12.00, img:null,
   imgs:["images/minecraft-ps3-case.jpg","images/minecraft-ps3-label.jpg","images/minecraft-ps3-back.jpg","images/pokemon-shield-cart-loose.jpg","images/minecraft-ps3-shield.jpg"],
   variations:[{label:"Minecraft — PlayStation 3 Edition (loose disc)", price:12.00},{label:"Pokémon Shield — Nintendo Switch (loose cart)", price:29.99},{label:"Just Dance Wii combo", price:15.00}],
   desc:"Used games, loose — priced for loose condition. Pick your game from the dropdown. Minecraft PS3 Edition is the loose disc in a clear case (front, label, and back shown). Pokémon Shield is the loose Switch cartridge — it is also listed on its own. Just Dance Wii combo: a real photo is coming — the last photo here is a placeholder (the dance booklet behind the Shield cart), message the shop for exactly what is in the combo. Looking for sealed games? Sealed packs are in the catalog too — look for the “Sealed Pack” tag. Buyer pays shipping."},
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

/* ---------- shop listing overrides (listing editor) ----------
   Overrides live in D1 (shop_listing_overrides) and are fetched on
   every page load (2.5s timeout — a slow or missing endpoint never
   blocks the shop). They layer over the hardcoded PRODUCTS/CATALOG
   below: same id → name/price/description/photos/options/video/
   Stripe link replaced; unknown id → appended to CATALOG as a brand-
   new listing. Empty/missing table → hardcoded data renders as before. */
let SHOP_OVERRIDES = [];
let shopOverridesPromise = null;
function loadShopOverrides(){
  if(shopOverridesPromise) return shopOverridesPromise;
  shopOverridesPromise = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch("/api/shop-listings", { cache: "no-store", signal: ctrl.signal });
      clearTimeout(t);
      const d = await r.json();
      SHOP_OVERRIDES = (d && Array.isArray(d.listings)) ? d.listings : [];
    } catch(e){ SHOP_OVERRIDES = []; }
    applyShopOverrides();
    return SHOP_OVERRIDES;
  })();
  return shopOverridesPromise;
}
function applyShopOverrides(){
  for(const ov of SHOP_OVERRIDES){
    if(!ov || !ov.id) continue;
    const target = PRODUCTS.find(p => p.id === ov.id) || CATALOG.find(c => c.id === ov.id);
    if(target){
      if(ov.name) target.name = ov.name;
      if(typeof ov.price === "number") target.price = ov.price;
      if(ov.description != null) target.desc = ov.description;
      if(ov.photos && ov.photos.length) target.imgs = ov.photos.slice(0, 3);
      if(ov.options) target.options = ov.options;
      if(ov.video !== undefined) target.video = ov.video || null;
      if(ov.stripe_link !== undefined) target.stripe = ov.stripe_link || null;
      if(typeof ov.shipping === "number") target.shipping_charge = ov.shipping;
    } else {
      CATALOG.push({
        id: ov.id, slug: ov.id, icon: "🛍️", tag: "Shop listing",
        name: ov.name || ov.id, price: (typeof ov.price === "number" ? ov.price : 0),
        desc: ov.description || "",
        imgs: (ov.photos && ov.photos.length ? ov.photos.slice(0, 3) : []),
        options: ov.options || null, video: ov.video || null,
        stripe: ov.stripe_link || null, ship: "+ shipping (by location)", shipping_charge: (typeof ov.shipping === "number" ? ov.shipping : null), ebay: null,
      });
    }
  }
}

/* ---------- listing option groups (listing editor) ----------
   An "options" listing has dropdown groups [{label, options:[{label,
   price_delta}]}]. Total = base price + selected deltas. Stripe
   payment links are FIXED-price, so the Stripe button only shows
   when the selected total equals the base price; anything else goes
   through PayPal with the computed total. Handhelds have no Stripe
   link, so they stay PayPal-only exactly as before. When a listing
   has BOTH hardcoded variations and an options override, options win
   (the editor converts variations into one options group on first
   edit, so the two never fight in practice). */
function optSel(id, gi){
  const det = document.getElementById("detailView");
  if(det && det.style.display === "block"){
    const d = det.querySelector('[id="opt-'+id+'-'+gi+'"]');
    if(d) return d;
  }
  const all = document.querySelectorAll('[id="opt-'+id+'-'+gi+'"]');
  for(const s of all){
    if(det && det.contains(s)) continue;
    return s;
  }
  return all[0] || null;
}
function optPrice(item){
  let total = (typeof item.price === "number" ? item.price : 0);
  const labels = [];
  if(item.options){
    item.options.forEach((g, gi) => {
      const sel = optSel(item.id, gi);
      const idx = sel ? parseInt(sel.value, 10) : 0;
      const opt = g.options && g.options[idx];
      if(opt){
        total += (Number(opt.price_delta) || 0);
        labels.push(g.label + ": " + opt.label);
      }
    });
  }
  return { total, labels };
}
function optDefaultTotal(item){
  let total = (typeof item.price === "number" ? item.price : 0);
  if(item.options) item.options.forEach(g => {
    const o = g.options && g.options[0];
    if(o) total += (Number(o.price_delta) || 0);
  });
  return total;
}
function optGroupsHTML(item){
  return item.options.map((g, gi) => {
    const opts = g.options.map((o, oi) => {
      const d = Number(o.price_delta) || 0;
      const suffix = d > 0 ? " (+$" + d.toFixed(2) + ")" : d < 0 ? " (−$" + Math.abs(d).toFixed(2) + ")" : "";
      return `<option value="${oi}">${o.label}${suffix}</option>`;
    }).join("");
    return `<label style="margin-top:2px">${g.label}:</label><select id="opt-${item.id}-${gi}" onchange="updateOptPrice('${item.id}')">${opts}</select>`;
  }).join("");
}
function updateOptPrice(id){
  const item = findItem(id); if(!item || !item.options) return;
  const o = optPrice(item);
  document.querySelectorAll('[data-opt-price="' + id + '"]').forEach(el => { el.textContent = money(o.total); });
  const showStripe = !!item.stripe && o.total === item.price;
  document.querySelectorAll('[data-stripe-btn="' + id + '"]').forEach(el => { el.style.display = showStripe ? "" : "none"; });
}
function refreshOptPrices(){
  const seen = {};
  PRODUCTS.concat(CATALOG).forEach(it => {
    if(it.options && !seen[it.id]){ seen[it.id] = 1; updateOptPrice(it.id); }
  });
}

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
  /* ---------- "18+ ZONE" big neon sign (Do Whatever Community) ----------
     Chris's design (2026-11-14, sign redesign 2026-11-16): a standalone
     big flickering neon sign in the FOOTER area — NOT in the main
     navigation. Reads "18+ ZONE" in huge neon letters, with "After Dark
     Reserve. Profit from your work." underneath. Clicking it takes the
     member to the Community (community.html#/adult), which gates the 18+
     area on age verification. */
  if(!document.querySelector(".dwc-18-entry")){
    var dwcFoot = document.querySelector("footer.site .wrap");
    if(dwcFoot){
      var dwcEntry = document.createElement("div");
      dwcEntry.className = "dwc-18-entry";
      dwcEntry.innerHTML =
        '<a class="dwc-18-link" href="community.html#/adult" aria-label="18+ Zone — After Dark Reserve — enter the Community (age-verified adults only)">' +
        '<span class="dwc-18-sign">18+ ZONE</span>' +
        '<span class="dwc-18-sub">After Dark Reserve. Profit from your work.</span>' +
        '</a>';
      dwcFoot.appendChild(dwcEntry);
    }
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
/* The same item can have a variation <select> in both its catalog card and
   the detail view (same id). getElementById returns the first in DOM order,
   which can be the hidden one — so a catalog add could read the detail
   view's default instead of the buyer's pick. Always read the select from
   the view the buyer is actually looking at. */
function varSel(id){
  const det = document.getElementById("detailView");
  if(det && det.style.display === "block"){
    const d = det.querySelector('[id="var-'+id+'"]');
    if(d) return d;
  }
  const all = document.querySelectorAll('[id="var-'+id+'"]');
  for(const s of all){
    if(det && det.contains(s)) continue;
    return s;
  }
  return all[0] || null;
}
function addProductVarToCart(id){
  const p = PRODUCTS.find(x => x.id === id); if(!p) return;
  let varLabel = null, varPrice = null;
  if(p.options){
    const o = optPrice(p);
    varLabel = o.labels.join(" · ") || null; varPrice = o.total;
  } else if(p.variations){
    const sel = varSel(id);
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
  if(c.options){
    const o = optPrice(c);
    varLabel = o.labels.join(" · ") || null; varPrice = o.total;
  } else if(c.variations){
    const sel = varSel(catId);
    const v = c.variations[parseInt(sel.value, 10)];
    varLabel = v.label; varPrice = v.price;
  }
  const item = cart.find(i => i.id === catId && (i.varLabel || null) === (varLabel || null));
  if(item) item.qty++; else cart.push({id:catId, qty:1, varLabel, varPrice});
  saveCart(); openCart();
}
function buyWithPayPal(id){
  const item = findItem(id); if(!item || item.outOfStock || item.comingSoon || item.draft) return;
  let label = item.name, price = item.price;
  if(item.options){
    const o = optPrice(item);
    price = o.total;
    if(o.labels.length) label = item.name + " — " + o.labels.join(" · ");
  } else if(item.variations){
    const sel = varSel(id);
    if(sel){
      const v = item.variations[parseInt(sel.value, 10)];
      if(v){ label = item.name + " — " + v.label; price = v.price; }
    }
  }
  if(price == null) return;
  // Shipping goes to PayPal as its own line (the `shipping` var) so
  // the buyer sees item + shipping separately. Tax does NOT go here:
  // the site doesn't know the buyer's state until PayPal asks for
  // their address — tax on PayPal orders comes from Chris's own
  // sales-tax tables in his PayPal Business profile (see patch doc).
  const ship = (item.shipping_charge != null ? Number(item.shipping_charge) : 0) || 0;
  const f = document.createElement("form");
  f.method = "post"; f.action = "https://www.paypal.com/cgi-bin/webscr"; f.target = "_blank";
  const fields = {cmd:"_xclick", business:PAYPAL_EMAIL, item_name:label, amount:price.toFixed(2), currency_code:"USD", no_shipping:"2"};
  if(ship > 0) fields.shipping = ship.toFixed(2);
  for(const k in fields){
    const inp = document.createElement("input");
    inp.type = "hidden"; inp.name = k; inp.value = fields[k];
    f.appendChild(inp);
  }
  document.body.appendChild(f); f.submit(); f.remove();
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
          const shipTotal = cart.reduce((t, i) => t + (((findItem(i.id) || {}).shipping_charge || 0) * i.qty), 0);
          pp.innerHTML = `<form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank">
            <input type="hidden" name="cmd" value="_xclick">
            <input type="hidden" name="business" value="${PAYPAL_EMAIL}">
            <input type="hidden" name="item_name" value="Rare Candy Reserve order">
            <input type="hidden" name="amount" value="${cartTotal().toFixed(2)}">
            <input type="hidden" name="currency_code" value="USD">
            <input type="hidden" name="no_shipping" value="2">
            ${shipTotal > 0 ? `<input type="hidden" name="shipping" value="${shipTotal.toFixed(2)}">` : ""}
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
/* ---------- modded handheld piracy notice ---------- */
// Every electronic modded handheld (Trimui / Anbernic) carries Chris's
// piracy + no-responsibility lines in its description — render-time, so
// any future handheld with a HANDHELD tag gets them automatically.
// The "(we do not condone piracy of any kind)" line already in the
// descs stays as-is; these two lines are IN ADDITION, verbatim.
const RCR_PIRACY_NOTE_HTML = '<p class="rcr-piracy-note" style="font-size:13px;color:var(--muted);margin:8px 0 0">⚠️ RCR does NOT promote piracy, remember to only download/use games or movies you own!<br>Rare Candy Reserve and its owners do not hold any responsibility for what you do with the hardware once purchased!</p>';
function isModdedHandheld(p){ return !!(p && p.tag && /handheld/i.test(p.tag)); }
function piracyNoteHTML(p){ return isModdedHandheld(p) ? RCR_PIRACY_NOTE_HTML : ""; }
function productCard(p){
  const photoTotal = (p.imgs && p.imgs.length) || 3;
  const galleryHint = photoTotal > 1
    ? `<p style="font-size:12px;color:var(--muted);margin:6px 0 0">📷 ${photoTotal} photos — tap the photo, then use Prev / Next to browse</p>`
    : "";
  const videoHint = p.video
    ? `<p style="font-size:12px;color:var(--muted);margin:6px 0 0">🎬 Video — tap Read more to watch</p>`
    : "";
  let priceLine, buyBtn;
  if(p.options){
    const initTotal = optDefaultTotal(p);
    priceLine = `<p><span class="price" data-opt-price="${p.id}">${money(initTotal)}</span> <span class="ship">${p.ship}</span></p>` + optGroupsHTML(p);
    buyBtn = `<button class="btn" onclick="addProductVarToCart('${p.id}')">Add to cart</button>`;
  } else if(p.variations){
    const opts = p.variations.map((v,i)=>`<option value="${i}">${v.label} — ${money(v.price)}</option>`).join("");
    const lo = Math.min(...p.variations.map(v=>v.price)), hi = Math.max(...p.variations.map(v=>v.price));
    priceLine = `<p><span class="price">${lo===hi ? money(lo) : money(lo)+" – "+money(hi)}</span> <span class="ship">${p.ship}</span></p>
      <label style="margin-top:2px">Choose:</label><select id="var-${p.id}">${opts}</select>`;
    buyBtn = `<button class="btn" onclick="addProductVarToCart('${p.id}')">Add to cart</button>`;
  } else {
    priceLine = `<p><span class="price">${money(p.price)}</span> <span class="ship">${p.ship}</span></p>`;
    buyBtn = `<button class="btn" onclick="addToCart('${p.id}')">Add to cart</button>`;
  }
  return `<div class="card">
    ${photoHTML(p,0)}
    ${galleryHint}
    ${videoHint}
    <div class="tag" style="margin-top:12px">${p.tag}</div>
    <h3>${p.name}</h3><p class="card-desc">${p.desc}</p>${piracyNoteHTML(p)}
    <p class="card-more"><a href="shop.html?item=${p.id}">Read more →</a></p>
    ${priceLine}
    <p class="card-actions">${buyBtn}${p.stripe ? `<a class="btn ghost" data-stripe-btn="${p.id}" href="${p.stripe}" target="_blank" rel="noopener"${(p.options && optDefaultTotal(p) !== p.price) ? ' style="display:none"' : ''}>Buy with Stripe →</a>` : ""}<button class="btn ghost" onclick="buyWithPayPal('${p.id}')">Buy with PayPal →</button></p>
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
  } else if(c.options){
    const initTotal = optDefaultTotal(c);
    priceLine = `<p><span class="price" data-opt-price="${c.id}">${money(initTotal)}</span></p>` + optGroupsHTML(c);
    buyBtn = `<button class="btn" onclick="addCatalogToCart('${c.id}')">Add to cart</button>`;
  } else if(c.variations){
    const opts = c.variations.map((v,i)=>`<option value="${i}">${v.label} — ${money(v.price)}</option>`).join("");
    const lo = Math.min(...c.variations.map(v=>v.price)), hi = Math.max(...c.variations.map(v=>v.price));
    priceLine = `<p><span class="price">${lo===hi ? money(lo) : money(lo)+" – "+money(hi)}</span></p>
      <label style="margin-top:2px">Choose:</label><select id="var-${c.id}">${opts}</select>`;
    buyBtn = `<button class="btn" onclick="addCatalogToCart('${c.id}')">Add to cart</button>`;
  } else {
    priceLine = `<p><span class="price">${money(c.price)}</span>${c.ship ? ` <span class="ship">${c.ship}</span>` : ""}</p>`;
    buyBtn = `<button class="btn" onclick="addCatalogToCart('${c.id}')">Add to cart</button>`;
  }
  const ebayLink = c.ebay ? ` <a href="https://www.ebay.com/itm/${c.ebay}" target="_blank" rel="noopener" style="font-size:13px">View on eBay ↗</a>` : "";
  const videoHint = c.video
    ? `<p style="font-size:12px;color:var(--muted);margin:6px 0 0">🎬 Video — tap Read more to watch</p>`
    : "";
  return `<div class="card">${photo}
    ${videoHint}
    <div class="tag" style="margin-top:12px">${c.tag}</div>
    <h3><a href="shop.html?item=${c.id}" style="color:var(--ink);text-decoration:none">${c.name}</a></h3>
    ${c.desc ? `<p class="card-desc" style="color:var(--muted);font-size:14px">${c.desc}</p>${piracyNoteHTML(c)}<p class="card-more"><a href="shop.html?item=${c.id}">Read more →</a></p>` : ""}
    ${priceLine}
    <p class="card-actions">${buyBtn}${c.stripe ? `<a class="btn ghost" data-stripe-btn="${c.id}" href="${c.stripe}" target="_blank" rel="noopener"${(c.options && optDefaultTotal(c) !== c.price) ? ' style="display:none"' : ''}>Buy with Stripe →</a>` : ""}${!(c.outOfStock||c.draft||c.comingSoon) ? `<button class="btn ghost" onclick="buyWithPayPal('${c.id}')">Buy with PayPal →</button>` : ""}${ebayLink}</p>
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
    ["❤️ Donate", "about.html#donate", true, true],
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
  } else if(c.options){
    const initTotal = optDefaultTotal(c);
    const addFn = CATALOG.includes(c) ? "addCatalogToCart" : "addToCart";
    buyHtml = `<p><span class="price" data-opt-price="${c.id}">${money(initTotal)}</span></p>
      ${optGroupsHTML(c)}
      <p style="margin-top:12px"><button class="btn" onclick="${addFn}('${c.id}')">Add to cart</button> <button class="btn ghost" onclick="buyWithPayPal('${c.id}')">Buy with PayPal →</button></p>`;
  } else if(c.variations){
    const opts = c.variations.map((v,i)=>`<option value="${i}">${v.label} — ${money(v.price)}</option>`).join("");
    const lo = Math.min(...c.variations.map(v=>v.price)), hi = Math.max(...c.variations.map(v=>v.price));
    buyHtml = `<p><span class="price">${lo===hi ? money(lo) : money(lo)+" – "+money(hi)}</span></p>
      <label>Choose:</label><select id="var-${c.id}">${opts}</select>
      <p style="margin-top:12px"><button class="btn" onclick="addCatalogToCart('${c.id}')">Add to cart</button> <button class="btn ghost" onclick="buyWithPayPal('${c.id}')">Buy with PayPal →</button></p>`;
  } else if(c.price != null){
    buyHtml = `<p><span class="price">${money(c.price)}</span>${c.ship ? ` <span class="ship">${c.ship}</span>` : ""}</p>
      <p><button class="btn" onclick="${CATALOG.includes(c) ? "addCatalogToCart" : "addToCart"}('${c.id}')">Add to cart</button> <button class="btn ghost" onclick="buyWithPayPal('${c.id}')">Buy with PayPal →</button></p>`;
  }
  const detTotal = (c.imgs && c.imgs.length) || 3;
  const detHint = detTotal > 1
    ? `<p style="font-size:12px;color:var(--muted);margin:6px 0 0">📷 ${detTotal} photos — tap the photo, then use Prev / Next to browse</p>`
    : "";
  const videoHtml = c.video
    ? `<div style="margin-top:14px"><video src="${c.video}" controls muted playsinline preload="metadata" style="width:100%;border-radius:10px;background:#000"></video><p style="font-size:12px;color:var(--muted);margin:6px 0 0">🎬 Video — see it in action</p></div>`
    : "";
  det.innerHTML = `
    <p><a href="shop.html" onclick="hideDetail(event)">← Back to the full catalog</a></p>
    <div class="detail">
      <div>
        ${photoHTML(c,0)}
        ${detHint}
        ${videoHtml}
      </div>
      <div>
        <div class="tag">${c.tag}</div>
        <h1 style="font-size:30px">${c.name}</h1>
        ${c.desc ? `<p style="color:var(--muted)">${c.desc}</p>${piracyNoteHTML(c)}` : ""}
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
  const miniType = document.getElementById("qMiniType").value;
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
    "Name: " + name + "\nEmail: " + email + "\nMini type: " + miniType + "\nProject details: " + details +
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
async function boot(){
  injectChrome();
  syncProfileButton();
  await loadShopOverrides();
  const page = document.body.dataset.page || "";
  document.querySelectorAll("#mainNav a").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  renderPageSections();
  refreshOptPrices();
  updateCount();
  estimate();
  forgePreview();
  renderCart();
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

// Community sign-in state for the header button (spec §15): while signed
// in to the Community, the "Make a profile!" header button becomes a
// "Sign out" button instead. Signed out (or no profile on this device),
// it stays "Make a profile!". Signing out clears the Community device
// id — the account itself is untouched, so signing back in on the
// Community page restores it on that device.
function syncProfileButton() {
  var btn = document.querySelector('a.aml-btn[href="community.html"]');
  if (!btn) return;
  var deviceId = null;
  try { deviceId = localStorage.getItem("dwc-device-id"); } catch (e) {}
  if (!deviceId) return; // never signed in on this device — leave the button
  fetch("/api/profile?device_id=" + encodeURIComponent(deviceId))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || !data.profile) return; // device id exists but no profile
      notifDeviceId = deviceId;
      initNotifBell();
      var logo = btn.querySelector(".aml-logo");
      var sub = btn.querySelector(".aml-sub");
      if (logo) logo.textContent = "👋 Sign out";
      if (sub) sub.textContent = "@" + data.profile.username;
      btn.href = "#";
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        try { localStorage.removeItem("dwc-device-id"); } catch (e) {}
        location.reload();
      });
    })
    .catch(function () { /* offline — leave the button as-is */ });
}

/* ---------- notifications bell (v3.8) ----------
   A 🔔 in the header between the Sign out button and the Cart button,
   only when signed in to the Community. Badge = unread count; click
   opens a dropdown of the newest notifications. Polls every 60s. If the
   notifications table isn't live yet, the bell shows with no badge and
   an empty panel ("No notifications yet") — nothing breaks. */
var notifDeviceId = null;
var notifTimer = null;
var notifOpen = false;
function notifEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function notifKindIcon(kind) {
  switch (kind) {
    case "message": return "💬";
    case "reply": return "↩️";
    case "comment": return "💬";
    case "heart": return "❤️";
    case "like": return "👍";
    case "friend": return "🤝";
    case "favorite": return "⭐";
    case "mention": return "@";
    case "tag": return "🏷️";
    case "follow": return "➕";
    case "unfollow": return "➖";
    case "new_member": return "👋";
    case "new_content": return "🛒";
    case "new_post": return "📝";
    case "team": return "🪙";
    default: return "🔔";
  }
}
function notifTime(ms) {
  if (!ms) return "";
  var diff = Date.now() - Number(ms);
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  return new Date(ms).toLocaleDateString();
}
function notifLinkHref(link) {
  if (!link) return "community.html";
  if (location.pathname.indexOf("community.html") !== -1) return link;
  return "community.html" + link;
}
function renderNotifPanel(list) {
  var panel = document.getElementById("notifPanel");
  if (!panel) return;
  var body = panel.querySelector(".notif-list");
  if (!body) return;
  if (!list || !list.length) {
    body.innerHTML = '<p class="notif-empty">No notifications yet.</p>';
    return;
  }
  // Team pings first (the server already sorts them first — this keeps
  // the panel right even if a list arrives from an older fetch).
  var sorted = list.slice().sort(function (a, b) {
    var ta = a.kind === "team" ? 0 : 1, tb = b.kind === "team" ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return (b.created_at || 0) - (a.created_at || 0);
  });
  body.innerHTML = sorted.map(function (n) {
    var isTeam = n.kind === "team";
    return '<a class="notif-item' + (n.read ? "" : " unread") + (isTeam ? " team" : "") + '" href="' + notifEsc(notifLinkHref(n.link)) + '" data-notif-id="' + n.id + '">' +
      '<span class="notif-ic">' + notifKindIcon(n.kind) + '</span>' +
      '<span class="notif-tx">' + (isTeam ? '<span class="notif-team-tag">Team</span> ' : "") + notifEsc(n.text || "") + '<em>' + notifTime(n.created_at) + '</em></span>' +
      '</a>';
  }).join("");
}
/* ---------- notification sound (v3.17) — arcade coin ding ----------
   Two-tone coin, synthesized with the Web Audio API (no audio files):
   B5 then E6, short and bright. Plays only when a NEW team/priority
   notification arrives while the page is open — never for old ones on
   page load, never for non-team notifications. Toggle persists in
   localStorage ("dwc-notif-sound" = "off" disables it), default ON.
   The bell poll (60s) owns the sound; the Alerts app shares the same
   toggle key so one switch controls both. */
var notifSeenIds = null; // null until the first fetch seeds it (no sound on load)
var notifAudioCtx = null;
function notifSoundOn() {
  try { return localStorage.getItem("dwc-notif-sound") !== "off"; } catch (e) { return true; }
}
function notifSoundSet(on) {
  try { localStorage.setItem("dwc-notif-sound", on ? "on" : "off"); } catch (e) {}
  updateNotifSoundBtn();
}
function updateNotifSoundBtn() {
  var b = document.getElementById("notifSoundToggle");
  if (b) b.textContent = notifSoundOn() ? "🔊 Sound on" : "🔇 Sound off";
}
function playCoinSound() {
  if (!notifSoundOn()) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!notifAudioCtx) notifAudioCtx = new AC();
    var ctx = notifAudioCtx;
    if (ctx.state === "suspended") { ctx.resume().catch(function () {}); }
    if (ctx.state !== "running") return; // no user gesture yet — browsers keep it suspended; skip quietly
    var t = ctx.currentTime;
    // B5 (987.77 Hz) short, then E6 (1318.51 Hz) longer — classic coin.
    [[987.77, 0, 0.09], [1318.51, 0.09, 0.4]].forEach(function (note) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = note[0];
      gain.gain.setValueAtTime(0.0001, t + note[1]);
      gain.gain.exponentialRampToValueAtTime(0.12, t + note[1] + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note[1] + note[2]);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + note[1]);
      osc.stop(t + note[1] + note[2] + 0.05);
    });
  } catch (e) { /* audio unavailable — never break the bell */ }
}
function fetchNotifs() {
  if (!notifDeviceId) return Promise.resolve(null);
  return fetch("/api/notifications?device_id=" + encodeURIComponent(notifDeviceId))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var list = (data && data.notifications) || [];
      var unread = (data && typeof data.unread === "number")
        ? data.unread
        : list.filter(function (n) { return !n.read; }).length;
      var badge = document.getElementById("notifBadge");
      if (badge) {
        badge.textContent = unread > 99 ? "99+" : String(unread);
        badge.hidden = unread <= 0;
      }
      // Coin ding: only for team pings that arrived AFTER this page
      // loaded. The first fetch just seeds the seen set (no sound).
      var freshTeam = false;
      if (notifSeenIds === null) {
        notifSeenIds = {};
        list.forEach(function (n) { notifSeenIds[n.id] = true; });
      } else {
        list.forEach(function (n) {
          if (n.kind === "team" && !n.read && !notifSeenIds[n.id]) freshTeam = true;
          notifSeenIds[n.id] = true;
        });
        if (freshTeam) playCoinSound();
      }
      if (notifOpen) renderNotifPanel(list);
      return data;
    })
    .catch(function () { return null; });
}
function markAllNotifRead() {
  if (!notifDeviceId) return;
  fetch("/api/notifications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_id: notifDeviceId, action: "read_all" }),
  }).then(function () { fetchNotifs(); }).catch(function () {});
}
function toggleNotifPanel() {
  var panel = document.getElementById("notifPanel");
  if (!panel) return;
  notifOpen = !notifOpen;
  panel.hidden = !notifOpen;
  if (notifOpen) fetchNotifs();
}
function initNotifBell() {
  if (document.getElementById("notifBell")) return;
  var cartBtn = document.querySelector(".head-actions .cart-btn");
  if (!cartBtn) return;
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "notif-bell";
  btn.id = "notifBell";
  btn.setAttribute("aria-label", "Notifications");
  btn.innerHTML = '🔔<span class="notif-badge" id="notifBadge" hidden>0</span>';
  btn.addEventListener("click", function (ev) {
    ev.stopPropagation();
    toggleNotifPanel();
  });
  cartBtn.parentNode.insertBefore(btn, cartBtn);
  var panel = document.createElement("div");
  panel.className = "notif-panel";
  panel.id = "notifPanel";
  panel.hidden = true;
  panel.innerHTML =
    '<div class="notif-head"><b>🔔 Notifications</b><span><button type="button" class="btn ghost small" id="notifSoundToggle">🔊 Sound on</button> <button type="button" class="btn ghost small" id="notifMarkAll">Mark all read</button></span></div>' +
    '<div class="notif-list"><p class="notif-empty">No notifications yet.</p></div>';
  document.body.appendChild(panel);
  updateNotifSoundBtn();
  panel.querySelector("#notifSoundToggle").addEventListener("click", function () { notifSoundSet(!notifSoundOn()); });
  panel.querySelector("#notifMarkAll").addEventListener("click", function () { markAllNotifRead(); });
  // Tapping a notification marks it read (fire-and-forget) then follows the link.
  panel.addEventListener("click", function (ev) {
    var item = ev.target.closest ? ev.target.closest("[data-notif-id]") : null;
    if (!item || !notifDeviceId) return;
    fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_id: notifDeviceId, action: "read", id: Number(item.getAttribute("data-notif-id")) }),
    }).catch(function () {});
  });
  // Clicking anywhere else closes the panel.
  document.addEventListener("click", function (ev) {
    var p = document.getElementById("notifPanel");
    if (!p || p.hidden) return;
    if (ev.target.closest && (ev.target.closest("#notifPanel") || ev.target.closest("#notifBell"))) return;
    p.hidden = true;
    notifOpen = false;
  });
  fetchNotifs();
  if (!notifTimer) notifTimer = setInterval(fetchNotifs, 60000);
}

/* ============================================================
   Rare Candy loading bar (2026-11-21)
   Shared component — any loading flow can show it. A small, short
   bar: a piece of rare candy (🍬) beside a slim track that fills
   with color, with the percentage at the right.
   - RCRloader.show() — indeterminate fill (slides; no fake %).
     Use when the flow has no progress events (every fetch-based
     flow: saves, uploads, page loads). Delayed 200ms so fast
     loads never flash the bar. Safe to call repeatedly; hide()
     only clears it once every show() has been matched.
   - RCRloader.set(pct) — real percentage (0-100) for flows that
     DO have progress events. Call show({percent: n}) first, or
     set() shows the bar immediately at that %.
   - RCRloader.hide() — done.
   ============================================================ */
window.RCRloader = (function () {
  var el = null, fillEl = null, pctEl = null, timer = null, count = 0;
  function ensure() {
    if (el) return;
    el = document.createElement("div");
    el.className = "rcr-loader";
    el.id = "rcr-loader";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<span class="rcr-loader-candy">🍬</span><div class="rcr-loader-track"><div class="rcr-loader-fill"></div></div><span class="rcr-loader-pct"></span>';
    document.body.appendChild(el);
    fillEl = el.querySelector(".rcr-loader-fill");
    pctEl = el.querySelector(".rcr-loader-pct");
  }
  function show(opts) {
    opts = opts || {};
    ensure();
    count++;
    if (typeof opts.percent === "number") { set(opts.percent); return; }
    el.classList.add("indet");
    pctEl.textContent = "Loading…";
    clearTimeout(timer);
    timer = setTimeout(function () { el.classList.add("on"); }, 200);
  }
  function set(p) {
    ensure();
    p = Math.max(0, Math.min(100, Math.round(p)));
    el.classList.remove("indet");
    fillEl.style.width = p + "%";
    pctEl.textContent = p + "%";
    el.classList.add("on");
  }
  function hide() {
    count = Math.max(0, count - 1);
    if (count > 0) return;
    clearTimeout(timer);
    if (el) el.classList.remove("on");
  }
  return { show: show, set: set, hide: hide };
})();
