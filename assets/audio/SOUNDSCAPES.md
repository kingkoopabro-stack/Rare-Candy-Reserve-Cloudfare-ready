# Profile soundscapes — sources, licenses, attribution

All files live in `assets/audio/` and are referenced by the profile code
(`SOUNDSCAPES` in `assets/js/community.js`). Nothing is hotlinked. The seven
ambient tracks are 60-second seamless loops (57s for storm); the two classical
pieces are the full recordings, loudness-normalized. All sourced, none
generated — there is no audio-generation tool in this environment.

## Ambient loops (60s, MP3 96kbps, loudnorm -16 LUFS)

| File | Source recording | Author | License |
|---|---|---|---|
| `rain.mp3` | "Soft Rain Ambience" (Freesound 573335) | visionear | CC0 1.0 |
| `storm.mp3` | "Thunderstorm with heavy rain2" (Freesound 425173) | Audeption | CC0 1.0 |
| `night.mp3` | "Crickets Night 2" (Freesound 245834) | PhilllChabbb | CC0 1.0 |
| `city.mp3` | "New York City Ambience" (Freesound 615281) | logancircle2 | CC BY 3.0 |
| `cafe.mp3` | "cafe - takk, northern quarter, manchester" (Freesound 387030) | AntonyBK | CC0 1.0 |
| `paris.mp3` | "Place Pigalle ambience Paris" (Freesound 162852) | beman87 | CC BY 3.0 |
| `violin.mp3` | "Hang drum and violin" (Freesound 321166) | VlatkoBlazek | CC BY 3.0 |

## Classical pieces (full, MP3 128kbps, loudnorm -16 LUFS)

| File | Source recording | License |
|---|---|---|
| `canon.mp3` (4:25) | "Canon in D Major (ISRC USUAN1100301)" by Kevin MacLeod, via Wikimedia Commons | CC BY 3.0 |
| `fur-elise.mp3` (2:57) | "Für Elise", performed by V. Gao (Gaodifan), via Wikimedia Commons `File:FurElise.ogg` | CC0 1.0 |

## Honest notes

- **Canon is synthesized, not a live orchestra.** No free-license acoustic-ensemble
  recording of Pachelbel's Canon in D could be found (Musopen's page is a JS shell
  with no extractable download; the Commons alternatives are all synthesized).
  Kevin MacLeod's version is a full string-ensemble arrangement (three violins
  plus bass continuo, harp doubling the parts) realized on synthesizers — the
  closest free-license fit to "wedding quality, full instruments together". Do
  not describe it as a real orchestra.
- **Für Elise is a real piano performance** (V. Gao), public domain, CC0.
- **Violin:** the recording is the duo Skarabej — Matija Krečič (violin) and
  Boris Magdalenc (hang drum) — playing their song "The Way Out is Through" on
  the street during Špancirfest, Varaždin, Croatia, 27 August 2015. Credit the
  duo as well as VlatkoBlazek wherever credits are shown.
- **Sourcing hiccup:** `upload.wikimedia.org` returned HTTP 429 (too many
  requests) for this machine while fetching the two classical pieces. Both were
  recovered from the Wayback Machine (Canon: exact 5,226,209-byte file;
  Für Elise: 2010 snapshot, byte-identical to the current Commons file).

## CC-BY attribution (show wherever credits are listed)

- "New York City Ambience" by logancircle2, CC BY 3.0 — freesound.org/people/logancircle2/sounds/615281/
- "Place Pigalle ambience Paris" by beman87, CC BY 3.0 — freesound.org/people/beman87/sounds/162852/
- "Hang drum and violin" by VlatkoBlazek, CC BY 3.0 (performers: Skarabej) — freesound.org/people/VlatkoBlazek/sounds/321166/
- "Canon in D Major" by Kevin MacLeod, CC BY 3.0 — incompetech.com / commons.wikimedia.org/wiki/File:Canon_in_D_Major_(ISRC_USUAN1100301).mp3
