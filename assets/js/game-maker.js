/* ============================================================================
   RCR Game Maker — v1
   A tiny retro RPG maker for Rare Candy Reserve. Tile-based, playable in the
   browser, no coding needed. Plain script, no modules, no imports, no
   external assets or CDN. Everything is drawn on canvas with code.

   Public API (window.RCRGame):
     createEmptyGame(name)      -> fresh game object (starter map)
     loadGame(input)            -> { game, errors } — parses + normalizes JSON
     validateGame(game)         -> array of error strings (empty = valid)
     encodeGame(game)           -> base64url string (for ?data= links / codes)
     decodeGame(str)            -> game object (throws on bad input)
     resizeMap(game, w, h)      -> game with a new-sized tile grid
     battleAttack(player, enemy)-> one exchange of a battle (pure, testable)
     checkGoal(game, state)     -> true when the win condition is met
     isBlocked(game, state, x, y) -> collision check (pure, testable)
     playGame(container, game)  -> starts the play engine, returns engine
     initEditor(options)        -> wires up the editor page (game-maker.html)
     storage helpers: saveNamed(name, game), listSaves(), loadNamed(name),
       deleteSave(name), autosave(game), loadAutosave()

   v1 limits (deliberate): no sound, no scripting, no multiplayer, saves are
   localStorage + file only (no site-side save). See the report for details.
   ========================================================================== */
(function (global) {
'use strict';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

var TILE = { GRASS: 0, PATH: 1, WATER: 2, WALL: 3, BRIDGE: 4, FLOOR: 5 };
var TILE_NAMES = ['grass', 'path', 'water', 'wall', 'bridge', 'floor'];
var TILE_SIZE = 32;
var MIN_SIZE = 10, MAX_SIZE = 30;
var DEFAULT_W = 20, DEFAULT_H = 15;
var MOVE_COOLDOWN_MS = 150;          // grid-step cooldown: retro, not frantic
var PLAYER_COLORS = ['#ff2d95', '#00e5ff', '#ffd23f', '#39ff88', '#ff9a00', '#7c4dff'];
var ITEM_KINDS = ['key', 'coin', 'potion'];
var STORAGE_AUTOSAVE = 'rcrgm_autosave_v1';
var STORAGE_SAVES = 'rcrgm_saves_v1';

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

/* Deterministic 0..1 hash from tile coords — speckles stay put between
   frames instead of flickering every repaint. */
function hash2(x, y) {
  var h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function inBounds(game, x, y) {
  return x >= 0 && y >= 0 && x < game.width && y < game.height;
}

function tileAt(game, x, y) {
  if (!inBounds(game, x, y)) return TILE.WALL; // off-map reads as solid
  return game.tiles[y * game.width + x];
}

function setTile(game, x, y, code) {
  if (inBounds(game, x, y)) game.tiles[y * game.width + x] = code;
}

/* Find the first object of a list at a cell, or null. */
function objectAt(list, x, y) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].x === x && list[i].y === y) return { obj: list[i], index: i };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Game model                                                          */
/* ------------------------------------------------------------------ */

/* Game JSON format (v1):
   {
     "version": 1,
     "name": "My Adventure",
     "width": 20, "height": 15,
     "tiles": [ 0,0,3,... ],              // width*height, row-major
     "playerStart": { "x": 2, "y": 2 },
     "playerColor": "#ff2d95",
     "npcs":    [{ "x":5,"y":5,"name":"Elder","color":"#7c4dff",
                   "dialogue": ["Hello, traveller.", "Good luck!"] }],
     "items":   [{ "x":3,"y":3,"kind":"key"|"coin"|"potion","name":"Rusty Key" }],
     "doors":   [{ "x":9,"y":7,"needs":"key" }],
     "chests":  [{ "x":4,"y":4,"contains":"potion"|"coin","opened":false }],
     "signs":   [{ "x":6,"y":6,"text":"Beware the slime!" }],
     "enemies": [{ "x":8,"y":8,"name":"Slime","hp":10,"atk":2,"color":"#39ff88" }],
     "goal":    { "type":"exit"|"collect", "x":17,"y":12, "count":5 },
     "winText": "You did it! The kingdom is saved!"
   }
   Tile codes: 0 grass, 1 path, 2 water, 3 wall, 4 bridge, 5 floor.
   Goal type "exit": stand on goal.x,goal.y. Type "collect": gather
   goal.count coins anywhere on the map. */

function createEmptyGame(name) {
  var w = DEFAULT_W, h = DEFAULT_H;
  var tiles = [];
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      // Border walls, grass inside.
      tiles.push((x === 0 || y === 0 || x === w - 1 || y === h - 1) ? TILE.WALL : TILE.GRASS);
    }
  }
  var game = {
    version: 1,
    name: name || 'My Adventure',
    width: w, height: h,
    tiles: tiles,
    playerStart: { x: 2, y: 2 },
    playerColor: PLAYER_COLORS[0],
    npcs: [{ x: 5, y: 3, name: 'Elder Mira', color: '#7c4dff',
             dialogue: ['Hello, traveller! Welcome to our village.',
                        'A slime blocks the road east. Beat it and the exit portal will open... well, it is already open. Go on!'] }],
    items: [
      { x: 3, y: 5, kind: 'key', name: 'Rusty Key' },
      { x: 10, y: 10, kind: 'coin', name: 'Gold Coin' },
      { x: 12, y: 4, kind: 'coin', name: 'Gold Coin' },
      { x: 7, y: 11, kind: 'potion', name: 'Healing Potion' }
    ],
    doors: [{ x: 10, y: 7, needs: 'key' }],
    chests: [{ x: 16, y: 3, contains: 'potion', opened: false }],
    signs: [{ x: 4, y: 2, text: 'Village of Rare Candy — mind the slime!' }],
    enemies: [{ x: 13, y: 7, name: 'Slime', hp: 10, atk: 2, color: '#39ff88' }],
    goal: { type: 'exit', x: 17, y: 12, count: 0 },
    winText: 'You did it! The kingdom is saved!'
  };
  // A little starter path + a pond, so the first map already looks alive.
  for (var px = 2; px <= 17; px++) setTile(game, px, 7, TILE.PATH);
  setTile(game, 10, 7, TILE.PATH); // path under the door
  setTile(game, 14, 10, TILE.WATER); setTile(game, 15, 10, TILE.WATER);
  setTile(game, 14, 11, TILE.WATER); setTile(game, 15, 11, TILE.WATER);
  setTile(game, 15, 12, TILE.BRIDGE);
  return game;
}

/* Normalize any parsed JSON into a full, safe game object. Missing fields
   get defaults; out-of-range values are clamped. Never throws. */
function normalizeGame(raw) {
  var g = (raw && typeof raw === 'object') ? raw : {};
  var game = createEmptyGame(typeof g.name === 'string' && g.name ? g.name : 'My Adventure');
  if (typeof g.name === 'string' && g.name.trim()) game.name = g.name.trim().slice(0, 80);
  game.width = clamp(parseInt(g.width, 10) || DEFAULT_W, MIN_SIZE, MAX_SIZE);
  game.height = clamp(parseInt(g.height, 10) || DEFAULT_H, MIN_SIZE, MAX_SIZE);
  if (Array.isArray(g.tiles) && g.tiles.length === game.width * game.height) {
    game.tiles = g.tiles.map(function (t) {
      var n = parseInt(t, 10);
      return (n >= 0 && n <= 5) ? n : TILE.GRASS;
    });
  } else {
    game.tiles = [];
    for (var i = 0; i < game.width * game.height; i++) game.tiles.push(TILE.GRASS);
  }
  if (g.playerStart && typeof g.playerStart === 'object') {
    game.playerStart = {
      x: clamp(parseInt(g.playerStart.x, 10) || 2, 0, game.width - 1),
      y: clamp(parseInt(g.playerStart.y, 10) || 2, 0, game.height - 1)
    };
  }
  if (typeof g.playerColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(g.playerColor)) {
    game.playerColor = g.playerColor;
  }
  function cleanList(key, clean) {
    if (!Array.isArray(g[key])) return;
    game[key] = [];
    g[key].forEach(function (o) {
      if (!o || typeof o !== 'object') return;
      var c = clean(o);
      if (c && inBounds(game, c.x, c.y)) game[key].push(c);
    });
  }
  cleanList('npcs', function (o) {
    return {
      x: parseInt(o.x, 10) || 0, y: parseInt(o.y, 10) || 0,
      name: String(o.name || 'Villager').slice(0, 40),
      color: (typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color)) ? o.color : '#7c4dff',
      dialogue: Array.isArray(o.dialogue) && o.dialogue.length
        ? o.dialogue.map(function (l) { return String(l).slice(0, 280); })
        : ['Hello!']
    };
  });
  cleanList('items', function (o) {
    var kind = ITEM_KINDS.indexOf(o.kind) >= 0 ? o.kind : 'coin';
    return { x: parseInt(o.x, 10) || 0, y: parseInt(o.y, 10) || 0,
             kind: kind, name: String(o.name || kind).slice(0, 40) };
  });
  cleanList('doors', function (o) {
    return { x: parseInt(o.x, 10) || 0, y: parseInt(o.y, 10) || 0,
             needs: o.needs === 'key' ? 'key' : 'key' };
  });
  cleanList('chests', function (o) {
    return { x: parseInt(o.x, 10) || 0, y: parseInt(o.y, 10) || 0,
             contains: (o.contains === 'potion' || o.contains === 'coin') ? o.contains : 'coin',
             opened: !!o.opened };
  });
  cleanList('signs', function (o) {
    return { x: parseInt(o.x, 10) || 0, y: parseInt(o.y, 10) || 0,
             text: String(o.text || '').slice(0, 280) };
  });
  cleanList('enemies', function (o) {
    return { x: parseInt(o.x, 10) || 0, y: parseInt(o.y, 10) || 0,
             name: String(o.name || 'Slime').slice(0, 40),
             hp: clamp(parseInt(o.hp, 10) || 10, 1, 999),
             atk: clamp(parseInt(o.atk, 10) || 2, 0, 99),
             color: (typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color)) ? o.color : '#39ff88' };
  });
  if (g.goal && typeof g.goal === 'object') {
    game.goal = {
      type: g.goal.type === 'collect' ? 'collect' : 'exit',
      x: clamp(parseInt(g.goal.x, 10) || 0, 0, game.width - 1),
      y: clamp(parseInt(g.goal.y, 10) || 0, 0, game.height - 1),
      count: clamp(parseInt(g.goal.count, 10) || 0, 0, 99)
    };
  }
  if (typeof g.winText === 'string') game.winText = g.winText.slice(0, 280);
  return game;
}

/* Parse JSON (string or object) into a normalized game. */
function loadGame(input) {
  var raw = input;
  if (typeof input === 'string') {
    try { raw = JSON.parse(input); }
    catch (e) { return { game: null, errors: ['That file is not valid JSON: ' + e.message] }; }
  }
  var game = normalizeGame(raw);
  return { game: game, errors: validateGame(game) };
}

/* Check a game for problems. Returns an array of human-readable errors. */
function validateGame(game) {
  var errors = [];
  if (!game || typeof game !== 'object') return ['Game is missing.'];
  if (!game.tiles || game.tiles.length !== game.width * game.height) {
    errors.push('Tile grid does not match the map size.');
  }
  if (!inBounds(game, game.playerStart.x, game.playerStart.y)) {
    errors.push('Player start is outside the map.');
  } else if (tileAt(game, game.playerStart.x, game.playerStart.y) === TILE.WALL ||
             tileAt(game, game.playerStart.x, game.playerStart.y) === TILE.WATER) {
    errors.push('Player start is on a wall or water tile.');
  }
  if (game.goal.type === 'exit' && !inBounds(game, game.goal.x, game.goal.y)) {
    errors.push('Exit goal is outside the map.');
  }
  if (game.goal.type === 'collect' && game.goal.count < 1) {
    errors.push('Collect goal needs a coin count of at least 1.');
  }
  game.enemies.forEach(function (e, i) {
    if (e.hp < 1) errors.push('Enemy #' + (i + 1) + ' (' + e.name + ') has no HP.');
  });
  return errors;
}

/* Resize the tile grid, keeping whatever already fits. */
function resizeMap(game, w, h) {
  w = clamp(parseInt(w, 10) || game.width, MIN_SIZE, MAX_SIZE);
  h = clamp(parseInt(h, 10) || game.height, MIN_SIZE, MAX_SIZE);
  var old = game.tiles, ow = game.width;
  var tiles = [];
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      tiles.push((x < ow && y < game.height) ? old[y * ow + x] : TILE.GRASS);
    }
  }
  game.width = w; game.height = h; game.tiles = tiles;
  // Clamp anything that now hangs off the edge.
  function clampObj(o) { o.x = clamp(o.x, 0, w - 1); o.y = clamp(o.y, 0, h - 1); }
  game.playerStart.x = clamp(game.playerStart.x, 0, w - 1);
  game.playerStart.y = clamp(game.playerStart.y, 0, h - 1);
  game.goal.x = clamp(game.goal.x, 0, w - 1);
  game.goal.y = clamp(game.goal.y, 0, h - 1);
  ['npcs', 'items', 'doors', 'chests', 'signs', 'enemies'].forEach(function (k) {
    game[k].forEach(clampObj);
  });
  return game;
}

/* ------------------------------------------------------------------ */
/* Encoding (share links + paste codes)                                */
/* ------------------------------------------------------------------ */

/* base64url of the JSON — safe to put in a URL query string. */
function encodeGame(game) {
  var json = JSON.stringify(game);
  var b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeGame(str) {
  var b64 = String(str).trim().replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  var json = decodeURIComponent(escape(atob(b64)));
  var parsed = JSON.parse(json);
  return normalizeGame(parsed);
}

/* ------------------------------------------------------------------ */
/* Pure play logic (no DOM — this is what the smoke test exercises)    */
/* ------------------------------------------------------------------ */

/* Run-time state, fresh per play session. Kept separate from the game
   JSON so editing never fights with playing. */
function newPlayState(game) {
  return {
    x: game.playerStart.x, y: game.playerStart.y,
    facing: { dx: 0, dy: 1 },           // start facing down
    hp: 20, maxHp: 20, atk: 4,
    keys: 0, coins: 0, potions: 0,
    openedChests: {},                   // "x,y" -> true
    openedDoors: {},                    // "x,y" -> true
    defeated: {},                       // "x,y" -> true
    collected: {},                      // "x,y" -> true (items picked up)
    won: false, lost: false
  };
}

function cellKey(x, y) { return x + ',' + y; }

/* Is a tile itself solid? Walls and water block; bridges and paths don't. */
function tileIsSolid(code) { return code === TILE.WALL || code === TILE.WATER; }

/* Full collision check for the player stepping onto (x, y). Doors block
   until opened; everything else solid is the tile itself. Enemies do NOT
   block — walking into one starts a battle. */
function isBlocked(game, state, x, y) {
  if (!inBounds(game, x, y)) return true;
  if (tileIsSolid(tileAt(game, x, y))) return true;
  var door = objectAt(game.doors, x, y);
  if (door && !state.openedDoors[cellKey(x, y)]) return true;
  return false;
}

/* Can the player open this door right now? (Has a key.) */
function canOpenDoor(game, state, x, y) {
  var door = objectAt(game.doors, x, y);
  return !!door && !state.openedDoors[cellKey(x, y)] && state.keys > 0;
}

/* One exchange of a battle. Player hits first; if the enemy survives it
   hits back. Damage has a small random swing (+0..2 player, +0..1 enemy).
   Returns { enemyHp, playerHp, dmgDealt, dmgTaken, enemyDead, playerDead }.
   Pure — no DOM, no randomness outside the swing. */
function battleAttack(player, enemy) {
  var dmgDealt = Math.max(1, player.atk + randInt(0, 2));
  var enemyHp = enemy.hp - dmgDealt;
  var dmgTaken = 0, playerHp = player.hp;
  if (enemyHp > 0) {
    dmgTaken = Math.max(0, enemy.atk + randInt(0, 1) - (player.def || 0));
    playerHp = player.hp - dmgTaken;
  }
  return {
    enemyHp: enemyHp, playerHp: playerHp,
    dmgDealt: dmgDealt, dmgTaken: dmgTaken,
    enemyDead: enemyHp <= 0, playerDead: playerHp <= 0
  };
}

/* Win condition check. "exit": standing on the goal tile. "collect":
   gathered at least goal.count coins. */
function checkGoal(game, state) {
  if (state.won) return true;
  if (game.goal.type === 'collect') return state.coins >= game.goal.count;
  return state.x === game.goal.x && state.y === game.goal.y;
}

/* How many coins exist on the map (placed + in chests), for the HUD. */
function totalCoinsOnMap(game) {
  var n = 0;
  game.items.forEach(function (it) { if (it.kind === 'coin') n++; });
  game.chests.forEach(function (c) { if (c.contains === 'coin' && !c.opened) n++; });
  return n;
}

/* ------------------------------------------------------------------ */
/* Renderer — everything is drawn with code, no image assets           */
/* ------------------------------------------------------------------ */

/* Limited 16-bit-ish palette, per tile. */
var PALETTE = {
  grass:      ['#3f9e4d', '#35873f', '#4cb45c', '#2f7a38'],
  grassBlade: '#6fd07e',
  path:       '#c9a86a', pathDark: '#a9854f', pathStone: '#d8bd85',
  water:      '#2b6fd6', waterDark: '#1e4fa8', waterLight: '#7fb2f0',
  wall:       '#8a4b3a', wallDark: '#6e3527', mortar: '#d8c8b8',
  bridge:     '#8a5a2b', bridgeDark: '#6b4420', bridgeLight: '#b07a3e',
  floor:      '#9a9ab0', floorDark: '#77778c', floorLine: '#6a6a80'
};

function drawTile(ctx, code, px, py, tick) {
  var s = TILE_SIZE, r;
  if (code === TILE.GRASS) {
    ctx.fillStyle = PALETTE.grass[0]; ctx.fillRect(px, py, s, s);
    // Speckles + a blade or two, seeded by position so they don't flicker.
    for (var i = 0; i < 4; i++) {
      var h = hash2(px + i * 7, py + i * 13);
      ctx.fillStyle = h > 0.66 ? PALETTE.grass[2] : (h > 0.33 ? PALETTE.grass[1] : PALETTE.grass[3]);
      ctx.fillRect(px + 3 + Math.floor(h * 24), py + 3 + Math.floor(hash2(px + i, py) * 24), 3, 3);
    }
    if (hash2(px, py) > 0.82) { // occasional flower
      ctx.fillStyle = '#ff8fd0';
      ctx.fillRect(px + 14, py + 12, 4, 4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + 15, py + 13, 2, 2);
    }
  } else if (code === TILE.PATH) {
    ctx.fillStyle = PALETTE.path; ctx.fillRect(px, py, s, s);
    ctx.fillStyle = PALETTE.pathDark;
    ctx.fillRect(px + 4, py + 20, 8, 3); ctx.fillRect(px + 18, py + 8, 9, 3);
    ctx.fillStyle = PALETTE.pathStone;
    ctx.fillRect(px + 20, py + 22, 7, 5); ctx.fillRect(px + 6, py + 6, 6, 4);
  } else if (code === TILE.WATER) {
    ctx.fillStyle = PALETTE.water; ctx.fillRect(px, py, s, s);
    // Wavy lines that drift with the animation tick.
    ctx.strokeStyle = PALETTE.waterLight; ctx.lineWidth = 2;
    for (var w = 0; w < 2; w++) {
      var yy = py + 9 + w * 12, off = Math.sin(tick / 500 + px / 16 + w * 2) * 3;
      ctx.beginPath();
      ctx.moveTo(px + 4, yy);
      ctx.quadraticCurveTo(px + 12, yy + off, px + 20, yy);
      ctx.quadraticCurveTo(px + 26, yy - off, px + 28, yy);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.waterDark;
    ctx.fillRect(px + 5, py + 26, 5, 3);
  } else if (code === TILE.WALL) {
    ctx.fillStyle = PALETTE.wall; ctx.fillRect(px, py, s, s);
    ctx.fillStyle = PALETTE.wallDark;
    ctx.fillRect(px, py, s, 4); ctx.fillRect(px, py + 28, s, 4);
    ctx.strokeStyle = PALETTE.mortar; ctx.lineWidth = 1;
    ctx.strokeRect(px + 1.5, py + 6.5, 13, 8);
    ctx.strokeRect(px + 16.5, py + 6.5, 13, 8);
    ctx.strokeRect(px + 8.5, py + 17.5, 13, 8);
    ctx.strokeRect(px + 23.5, py + 17.5, 13, 8);
  } else if (code === TILE.BRIDGE) {
    ctx.fillStyle = PALETTE.waterDark; ctx.fillRect(px, py, s, s);
    ctx.fillStyle = PALETTE.bridge;
    ctx.fillRect(px, py + 4, s, 24);
    ctx.fillStyle = PALETTE.bridgeDark;
    ctx.fillRect(px, py + 4, s, 2); ctx.fillRect(px, py + 12, s, 2);
    ctx.fillRect(px, py + 20, s, 2); ctx.fillRect(px, py + 26, s, 2);
    ctx.fillStyle = PALETTE.bridgeLight;
    ctx.fillRect(px + 3, py + 6, 2, 20); ctx.fillRect(px + 27, py + 6, 2, 20);
  } else if (code === TILE.FLOOR) {
    ctx.fillStyle = PALETTE.floor; ctx.fillRect(px, py, s, s);
    ctx.strokeStyle = PALETTE.floorLine; ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
    ctx.beginPath(); ctx.moveTo(px, py + 16); ctx.lineTo(px + s, py + 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 16, py); ctx.lineTo(px + 16, py + s); ctx.stroke();
    ctx.fillStyle = PALETTE.floorDark;
    ctx.fillRect(px + 4, py + 4, 3, 3); ctx.fillRect(px + 24, py + 24, 3, 3);
  }
}

/* --- Entities (all chunky retro shapes, drawn at tile px,py) --- */

function drawHero(ctx, px, py, color, facing) {
  var s = TILE_SIZE, cx = px + s / 2;
  ctx.fillStyle = '#222';                       // shadow
  ctx.fillRect(px + 8, py + 26, 16, 4);
  ctx.fillStyle = color;                        // tunic
  ctx.fillRect(px + 9, py + 15, 14, 12);
  ctx.fillStyle = '#f2c89b';                    // face
  ctx.fillRect(px + 10, py + 6, 12, 10);
  ctx.fillStyle = color;                        // hair cap
  ctx.fillRect(px + 9, py + 3, 14, 5);
  ctx.fillStyle = '#1a1a2e';                    // eyes
  var ex = facing.dx < 0 ? -1 : (facing.dx > 0 ? 1 : 0);
  ctx.fillRect(px + 12 + ex, py + 10, 2, 3);
  ctx.fillRect(px + 18 + ex, py + 10, 2, 3);
  ctx.fillStyle = '#5a3a1a';                    // boots
  ctx.fillRect(px + 10, py + 27, 4, 3); ctx.fillRect(px + 18, py + 27, 4, 3);
  ctx.fillStyle = '#ffd23f';                    // belt buckle
  ctx.fillRect(px + 14, py + 21, 4, 3);
}

function drawNPC(ctx, px, py, color) {
  var s = TILE_SIZE;
  ctx.fillStyle = '#222';
  ctx.fillRect(px + 8, py + 26, 16, 4);
  ctx.fillStyle = color;                        // robe
  ctx.fillRect(px + 8, py + 12, 16, 16);
  ctx.fillStyle = '#f2c89b';                    // face
  ctx.fillRect(px + 11, py + 6, 10, 8);
  ctx.fillStyle = color;                        // hood
  ctx.fillRect(px + 9, py + 2, 14, 6);
  ctx.fillRect(px + 9, py + 2, 3, 10); ctx.fillRect(px + 20, py + 2, 3, 10);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(px + 13, py + 9, 2, 2); ctx.fillRect(px + 17, py + 9, 2, 2);
  ctx.fillStyle = '#ffd23f';                    // robe trim
  ctx.fillRect(px + 8, py + 24, 16, 2);
}

function drawSlime(ctx, px, py, color, tick) {
  var s = TILE_SIZE, wob = Math.sin(tick / 220 + px) * 2;
  ctx.fillStyle = '#222';
  ctx.fillRect(px + 8, py + 26, 16, 4);
  ctx.fillStyle = color;
  ctx.beginPath();                              // blobby body
  ctx.moveTo(px + 6, py + 26);
  ctx.quadraticCurveTo(px + 4, py + 12 + wob, px + 16, py + 10 + wob);
  ctx.quadraticCurveTo(px + 28, py + 12 - wob, px + 26, py + 26);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffffcc';
  ctx.fillRect(px + 10, py + 13, 4, 3);         // shine
  ctx.fillStyle = '#1a1a2e';                    // eyes
  ctx.fillRect(px + 11, py + 17, 3, 4); ctx.fillRect(px + 18, py + 17, 3, 4);
  ctx.fillStyle = '#1a1a2e';                    // frown
  ctx.fillRect(px + 13, py + 23, 6, 1);
}

function drawChest(ctx, px, py, opened) {
  ctx.fillStyle = '#222';
  ctx.fillRect(px + 6, py + 26, 20, 4);
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(px + 6, py + 14, 20, 13);
  ctx.fillStyle = opened ? '#5a3a1a' : '#b07a3e';   // lid
  ctx.fillRect(px + 6, py + (opened ? 6 : 10), 20, 6);
  ctx.fillStyle = '#ffd23f';                        // lock / trim
  ctx.fillRect(px + 14, py + 15, 4, 6);
  ctx.fillRect(px + 6, py + 19, 20, 2);
  if (opened) {
    ctx.fillStyle = '#fff6b0';                      // glow from inside
    ctx.fillRect(px + 9, py + 11, 14, 3);
  }
}

function drawKey(ctx, px, py) {
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(px + 12, py + 12, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0b0b14';
  ctx.beginPath(); ctx.arc(px + 12, py + 12, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(px + 15, py + 10, 11, 4);
  ctx.fillRect(px + 22, py + 14, 3, 4); ctx.fillRect(px + 17, py + 14, 3, 3);
}

function drawCoin(ctx, px, py, tick) {
  var bob = Math.sin(tick / 300 + px) * 1.5;
  ctx.fillStyle = '#c98a00';
  ctx.beginPath(); ctx.ellipse(px + 16, py + 17 + bob, 8, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.ellipse(px + 16, py + 16 + bob, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c98a00';
  ctx.fillRect(px + 14, py + 13 + bob, 4, 6);
}

function drawPotion(ctx, px, py) {
  ctx.fillStyle = '#e8e8f2';
  ctx.fillRect(px + 13, py + 7, 6, 4);             // cork
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(px + 14, py + 5, 4, 3);
  ctx.fillStyle = '#ff2d95';                       // bottle
  ctx.fillRect(px + 10, py + 11, 12, 14);
  ctx.fillStyle = '#ff8fd0';
  ctx.fillRect(px + 12, py + 13, 3, 10);
  ctx.fillStyle = '#fff';
  ctx.fillRect(px + 12, py + 17, 8, 2);            // label
}

function drawDoor(ctx, px, py, opened) {
  if (opened) {
    ctx.fillStyle = '#1a1a2e';                     // open doorway
    ctx.fillRect(px + 6, py + 4, 20, 26);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(px + 6, py + 4, 2, 26); ctx.fillRect(px + 24, py + 4, 2, 26);
    return;
  }
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(px + 5, py + 2, 22, 28);
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(px + 7, py + 4, 18, 24);
  ctx.fillStyle = '#6b4420';
  ctx.fillRect(px + 7, py + 12, 18, 2); ctx.fillRect(px + 7, py + 20, 18, 2);
  ctx.fillStyle = '#ffd23f';                       // keyhole + knob
  ctx.fillRect(px + 14, py + 15, 4, 5);
  ctx.fillRect(px + 22, py + 17, 3, 3);
}

function drawSign(ctx, px, py) {
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(px + 14, py + 16, 4, 12);
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(px + 7, py + 6, 18, 12);
  ctx.fillStyle = '#d8c8b8';
  ctx.fillRect(px + 10, py + 10, 12, 2); ctx.fillRect(px + 10, py + 14, 8, 2);
}

function drawPortal(ctx, px, py, tick) {
  var pulse = 0.5 + 0.5 * Math.sin(tick / 300);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(px + 4, py + 2, 24, 28);
  ctx.fillStyle = 'rgba(0,229,255,' + (0.35 + pulse * 0.4) + ')';
  ctx.fillRect(px + 7, py + 5, 18, 22);
  ctx.fillStyle = '#7c4dff';
  ctx.fillRect(px + 10, py + 8, 12, 16);
  ctx.fillStyle = '#00e5ff';
  var sw = Math.sin(tick / 200) * 2;
  ctx.fillRect(px + 13 + sw, py + 11, 6, 10);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(px + 4, py + 2, 24, 2); ctx.fillRect(px + 4, py + 28, 24, 2);
}

/* Draw the whole map (tiles + objects + player) onto a canvas context.
   `state` is a play state (or null for the editor, which draws the player
   start marker instead). `opts` may carry { highlight: {x,y}, tick }. */
function drawGame(ctx, game, state, opts) {
  opts = opts || {};
  var tick = opts.tick || 0;
  for (var y = 0; y < game.height; y++) {
    for (var x = 0; x < game.width; x++) {
      drawTile(ctx, tileAt(game, x, y), x * TILE_SIZE, y * TILE_SIZE, tick);
    }
  }
  // Goal portal (exit type only).
  if (game.goal.type === 'exit') {
    drawPortal(ctx, game.goal.x * TILE_SIZE, game.goal.y * TILE_SIZE, tick);
  }
  game.doors.forEach(function (d) {
    var opened = state && state.openedDoors[cellKey(d.x, d.y)];
    drawDoor(ctx, d.x * TILE_SIZE, d.y * TILE_SIZE, !!opened);
  });
  game.chests.forEach(function (c) {
    var opened = (state && state.openedChests[cellKey(c.x, c.y)]) || c.opened;
    drawChest(ctx, c.x * TILE_SIZE, c.y * TILE_SIZE, !!opened);
  });
  game.signs.forEach(function (s) { drawSign(ctx, s.x * TILE_SIZE, s.y * TILE_SIZE); });
  game.items.forEach(function (it) {
    if (state && state.collected[cellKey(it.x, it.y)]) return;
    var px = it.x * TILE_SIZE, py = it.y * TILE_SIZE;
    if (it.kind === 'key') drawKey(ctx, px, py);
    else if (it.kind === 'coin') drawCoin(ctx, px, py, tick);
    else drawPotion(ctx, px, py);
  });
  game.npcs.forEach(function (n) { drawNPC(ctx, n.x * TILE_SIZE, n.y * TILE_SIZE, n.color); });
  game.enemies.forEach(function (e) {
    if (state && state.defeated[cellKey(e.x, e.y)]) return;
    drawSlime(ctx, e.x * TILE_SIZE, e.y * TILE_SIZE, e.color, tick);
  });
  if (state) {
    drawHero(ctx, state.x * TILE_SIZE, state.y * TILE_SIZE, game.playerColor, state.facing);
  } else {
    // Editor: show where the player starts (hero outline + "P" flag).
    var sx = game.playerStart.x * TILE_SIZE, sy = game.playerStart.y * TILE_SIZE;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillText('START', sx + TILE_SIZE / 2, sy + TILE_SIZE - 6);
  }
  if (opts.highlight) {
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 3;
    ctx.strokeRect(opts.highlight.x * TILE_SIZE + 1, opts.highlight.y * TILE_SIZE + 1,
                   TILE_SIZE - 2, TILE_SIZE - 2);
  }
}

/* ------------------------------------------------------------------ */
/* Play engine                                                         */
/* ------------------------------------------------------------------ */

/* Engine(canvas, game, opts)
   opts: { host } — an element the engine may append HUD + overlay divs
   to (positioned over the canvas). If host is missing, overlays go on
   the canvas's parent. The engine owns keyboard input while running. */
function Engine(canvas, game, opts) {
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.game = clone(game);
  this.opts = opts || {};
  this.host = this.opts.host || canvas.parentNode;
  this.state = newPlayState(this.game);
  this.tick = 0;
  this.lastMove = 0;
  this.running = false;
  this.rafId = null;
  this.dialogue = null;      // { title, lines, index }
  this.battle = null;        // { enemy, enemyHp, log[] }
  this.message = null;       // { text, until }
  this.onWin = this.opts.onWin || null;
  this.onLose = this.opts.onLose || null;
  this._keyHandler = this._onKey.bind(this);
  this._buildUI();
  this._resizeCanvas();
}

Engine.prototype._resizeCanvas = function () {
  this.canvas.width = this.game.width * TILE_SIZE;
  this.canvas.height = this.game.height * TILE_SIZE;
};

Engine.prototype._buildUI = function () {
  var host = this.host;
  if (host && getComputedStyle(host).position === 'static') host.style.position = 'relative';

  // HUD bar above the canvas.
  this.hud = document.createElement('div');
  this.hud.className = 'rcrgm-hud';
  host.insertBefore(this.hud, this.canvas);

  // Dialogue box (bottom overlay).
  this.dlg = document.createElement('div');
  this.dlg.className = 'rcrgm-dlg';
  this.dlg.style.display = 'none';
  this.dlg.addEventListener('click', this._advanceDialogue.bind(this));
  host.appendChild(this.dlg);

  // Battle screen (center overlay).
  this.battleBox = document.createElement('div');
  this.battleBox.className = 'rcrgm-battle';
  this.battleBox.style.display = 'none';
  host.appendChild(this.battleBox);

  // Toast message (top overlay, fades).
  this.toast = document.createElement('div');
  this.toast.className = 'rcrgm-toast';
  this.toast.style.display = 'none';
  host.appendChild(this.toast);

  // End screen (win / game over).
  this.endBox = document.createElement('div');
  this.endBox.className = 'rcrgm-end';
  this.endBox.style.display = 'none';
  host.appendChild(this.endBox);

  // On-screen d-pad for touch / mouse players.
  this.dpad = document.createElement('div');
  this.dpad.className = 'rcrgm-dpad';
  var self = this;
  [['▲', 0, -1], ['◀', -1, 0], ['▼', 0, 1], ['▶', 1, 0]].forEach(function (b) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = b[0];
    btn.setAttribute('aria-label', 'Move ' + b[0]);
    btn.addEventListener('click', function () { self.tryMove(b[1], b[2]); });
    self.dpad.appendChild(btn);
  });
  var talkBtn = document.createElement('button');
  talkBtn.type = 'button';
  talkBtn.textContent = 'TALK';
  talkBtn.className = 'rcrgm-talkbtn';
  talkBtn.addEventListener('click', function () { self.tryTalk(); });
  this.dpad.appendChild(talkBtn);
  host.appendChild(this.dpad);
};

Engine.prototype._destroyUI = function () {
  [this.hud, this.dlg, this.battleBox, this.toast, this.endBox, this.dpad].forEach(function (el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });
};

Engine.prototype.start = function () {
  if (this.running) return;
  this.running = true;
  document.addEventListener('keydown', this._keyHandler);
  this._updateHUD();
  var self = this;
  function loop(t) {
    if (!self.running) return;
    self.tick = t;
    self._render();
    self.rafId = requestAnimationFrame(loop);
  }
  this.rafId = requestAnimationFrame(loop);
};

Engine.prototype.stop = function () {
  this.running = false;
  if (this.rafId) cancelAnimationFrame(this.rafId);
  document.removeEventListener('keydown', this._keyHandler);
  this._destroyUI();
};

Engine.prototype.restart = function () {
  this.state = newPlayState(this.game);
  this.dialogue = null; this.battle = null; this.message = null;
  this.endBox.style.display = 'none';
  this.battleBox.style.display = 'none';
  this.dlg.style.display = 'none';
  this._updateHUD();
};

/* --- input --- */

Engine.prototype._onKey = function (e) {
  if (!this.running) return;
  var k = e.key;
  if (this.dialogue) {
    if (k === ' ' || k === 'Enter' || k === 'e' || k === 'E') { e.preventDefault(); this._advanceDialogue(); }
    return;
  }
  if (this.battle) return; // battle uses its own buttons
  if (this.state.won || this.state.lost) {
    if (k === 'Enter') this.restart();
    return;
  }
  var moved = false;
  if (k === 'ArrowUp' || k === 'w' || k === 'W') { this.tryMove(0, -1); moved = true; }
  else if (k === 'ArrowDown' || k === 's' || k === 'S') { this.tryMove(0, 1); moved = true; }
  else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { this.tryMove(-1, 0); moved = true; }
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') { this.tryMove(1, 0); moved = true; }
  else if (k === ' ' || k === 'e' || k === 'E' || k === 'Enter') { this.tryTalk(); moved = true; }
  if (moved) e.preventDefault(); // keep arrows from scrolling the page
};

Engine.prototype.tryMove = function (dx, dy) {
  if (!this.running || this.dialogue || this.battle || this.state.won || this.state.lost) return;
  var now = Date.now();
  if (now - this.lastMove < MOVE_COOLDOWN_MS) return;
  this.lastMove = now;
  var s = this.state, g = this.game;
  s.facing = { dx: dx, dy: dy };
  var nx = s.x + dx, ny = s.y + dy;

  // Walking into an enemy starts a battle instead of moving.
  var enemy = objectAt(g.enemies, nx, ny);
  if (enemy && !s.defeated[cellKey(nx, ny)]) { this._startBattle(enemy.obj); return; }

  // A closed door with a key in hand opens on approach.
  var door = objectAt(g.doors, nx, ny);
  if (door && !s.openedDoors[cellKey(nx, ny)]) {
    if (s.keys > 0) {
      s.keys--;
      s.openedDoors[cellKey(nx, ny)] = true;
      this._showMessage('You unlocked the door! (-1 key)');
    } else {
      this._showMessage('Locked! You need a key.');
      this._updateHUD();
      return;
    }
  }
  if (isBlocked(g, s, nx, ny)) return;

  s.x = nx; s.y = ny;
  this._afterStep();
};

Engine.prototype._afterStep = function () {
  var s = this.state, g = this.game;
  // Pick up items.
  var item = objectAt(g.items, s.x, s.y);
  if (item && !s.collected[cellKey(s.x, s.y)]) {
    s.collected[cellKey(s.x, s.y)] = true;
    if (item.obj.kind === 'key') { s.keys++; this._showMessage('Picked up: ' + item.obj.name + '!'); }
    else if (item.obj.kind === 'coin') { s.coins++; this._showMessage('Picked up a coin! (' + s.coins + ' total)'); }
    else { s.potions++; this._showMessage('Picked up: ' + item.obj.name + '!'); }
  }
  // Open chests by walking onto them.
  var chest = objectAt(g.chests, s.x, s.y);
  if (chest && !s.openedChests[cellKey(s.x, s.y)]) {
    s.openedChests[cellKey(s.x, s.y)] = true;
    if (chest.obj.contains === 'potion') { s.potions++; this._showMessage('Chest opened! Found a potion!'); }
    else { s.coins++; this._showMessage('Chest opened! Found a coin!'); }
  }
  this._updateHUD();
  if (checkGoal(g, s)) this._win();
};

/* Talk to an NPC or read a sign in front of the player (or adjacent). */
Engine.prototype.tryTalk = function () {
  if (!this.running || this.dialogue || this.battle || this.state.won || this.state.lost) return;
  var s = this.state, g = this.game;
  var fx = s.x + s.facing.dx, fy = s.y + s.facing.dy;
  var npc = objectAt(g.npcs, fx, fy) || objectAt(g.npcs, s.x, s.y);
  if (npc) {
    this.dialogue = { title: npc.obj.name, lines: npc.obj.dialogue.slice(), index: 0 };
    this._showDialogue();
    return;
  }
  var sign = objectAt(g.signs, fx, fy) || objectAt(g.signs, s.x, s.y);
  if (sign) {
    this.dialogue = { title: 'Sign', lines: [sign.obj.text], index: 0 };
    this._showDialogue();
  }
};

Engine.prototype._showDialogue = function () {
  var d = this.dialogue;
  this.dlg.innerHTML = '';
  var title = document.createElement('div');
  title.className = 'rcrgm-dlg-title';
  title.textContent = d.title;
  var body = document.createElement('div');
  body.className = 'rcrgm-dlg-body';
  body.textContent = d.lines[d.index];
  var hint = document.createElement('div');
  hint.className = 'rcrgm-dlg-hint';
  hint.textContent = (d.index < d.lines.length - 1) ? '▼ Space / click for more' : '▼ Space / click to close';
  this.dlg.appendChild(title); this.dlg.appendChild(body); this.dlg.appendChild(hint);
  this.dlg.style.display = 'block';
};

Engine.prototype._advanceDialogue = function () {
  if (!this.dialogue) return;
  this.dialogue.index++;
  if (this.dialogue.index >= this.dialogue.lines.length) {
    this.dialogue = null;
    this.dlg.style.display = 'none';
  } else {
    this._showDialogue();
  }
};

/* --- battle --- */

Engine.prototype._startBattle = function (enemy) {
  this.battle = { enemy: enemy, enemyHp: enemy.hp, log: ['A wild ' + enemy.name + ' appears!'] };
  this._renderBattle();
};

Engine.prototype._renderBattle = function () {
  var b = this.battle, s = this.state;
  var box = this.battleBox;
  box.innerHTML = '';
  var title = document.createElement('h3');
  title.textContent = '⚔ ' + b.enemy.name;
  var hp = document.createElement('p');
  hp.innerHTML = '<b>' + b.enemy.name + ' HP:</b> ' + Math.max(0, b.enemyHp) + ' / ' + b.enemy.hp +
    '<br><b>You HP:</b> ' + Math.max(0, s.hp) + ' / ' + s.maxHp +
    ' &nbsp; <b>Potions:</b> ' + s.potions;
  var log = document.createElement('p');
  log.className = 'rcrgm-battle-log';
  log.textContent = b.log[b.log.length - 1];
  var row = document.createElement('div');
  row.className = 'rcrgm-battle-btns';
  var self = this;
  var atkBtn = document.createElement('button');
  atkBtn.type = 'button'; atkBtn.className = 'rcrgm-btn'; atkBtn.textContent = '⚔ Attack';
  atkBtn.addEventListener('click', function () { self._battleAction('attack'); });
  var potBtn = document.createElement('button');
  potBtn.type = 'button'; potBtn.className = 'rcrgm-btn'; potBtn.textContent = '🧪 Potion (' + s.potions + ')';
  potBtn.disabled = s.potions <= 0;
  potBtn.addEventListener('click', function () { self._battleAction('potion'); });
  var runBtn = document.createElement('button');
  runBtn.type = 'button'; runBtn.className = 'rcrgm-btn'; runBtn.textContent = '🏃 Run';
  runBtn.addEventListener('click', function () { self._battleAction('run'); });
  row.appendChild(atkBtn); row.appendChild(potBtn); row.appendChild(runBtn);
  box.appendChild(title); box.appendChild(hp); box.appendChild(log); box.appendChild(row);
  box.style.display = 'block';
};

Engine.prototype._battleAction = function (action) {
  var b = this.battle, s = this.state;
  if (!b) return;
  if (action === 'run') {
    if (Math.random() < 0.6) {
      this._showMessage('You ran away!');
      this.battle = null;
      this.battleBox.style.display = 'none';
    } else {
      var hit = Math.max(1, b.enemy.atk);
      s.hp -= hit;
      b.log.push('Could not escape! ' + b.enemy.name + ' hits you for ' + hit + '.');
      if (s.hp <= 0) { this._lose(); return; }
      this._renderBattle();
    }
    this._updateHUD();
    return;
  }
  if (action === 'potion') {
    if (s.potions <= 0) return;
    s.potions--;
    var healed = Math.min(s.maxHp - s.hp, 8);
    s.hp += healed;
    // Drinking a potion costs your turn: the enemy still attacks.
    var dmg = Math.max(0, b.enemy.atk + randInt(0, 1));
    s.hp -= dmg;
    b.log.push('You drink a potion (+' + healed + ' HP). ' + b.enemy.name + ' hits you for ' + dmg + '.');
    if (s.hp <= 0) { this._lose(); return; }
    this._updateHUD();
    this._renderBattle();
    return;
  }
  // Attack.
  var res = battleAttack({ hp: s.hp, atk: s.atk, def: 0 }, { hp: b.enemyHp, atk: b.enemy.atk });
  s.hp = res.playerHp;
  b.enemyHp = res.enemyHp;
  if (res.enemyDead) {
    b.log.push('You hit ' + b.enemy.name + ' for ' + res.dmgDealt + '. It is defeated!');
    s.defeated[cellKey(b.enemy.x, b.enemy.y)] = true;
    if (Math.random() < 0.5) { s.coins++; b.log.push('It dropped a coin!'); }
    this.battle = null;
    this.battleBox.style.display = 'none';
    this._showMessage(b.enemy.name + ' defeated!');
    this._updateHUD();
    return;
  }
  b.log.push('You hit ' + b.enemy.name + ' for ' + res.dmgDealt + '. It hits you for ' + res.dmgTaken + '.');
  if (res.playerDead) { this._lose(); return; }
  this._updateHUD();
  this._renderBattle();
};

/* --- win / lose / messages / HUD / render --- */

Engine.prototype._win = function () {
  this.state.won = true;
  this._showEnd(true, this.game.winText || 'You win!');
  if (this.onWin) this.onWin();
};

Engine.prototype._lose = function () {
  this.state.lost = true;
  this.battle = null;
  this.battleBox.style.display = 'none';
  this._showEnd(false, 'Game over! Your hero has fallen.');
  if (this.onLose) this.onLose();
};

Engine.prototype._showEnd = function (won, text) {
  var box = this.endBox;
  box.innerHTML = '';
  var h = document.createElement('h2');
  h.textContent = won ? '★ You win! ★' : 'Game Over';
  var p = document.createElement('p');
  p.textContent = text;
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'rcrgm-btn'; btn.textContent = '↻ Play again';
  var self = this;
  btn.addEventListener('click', function () { self.restart(); });
  box.appendChild(h); box.appendChild(p); box.appendChild(btn);
  box.style.display = 'block';
};

Engine.prototype._showMessage = function (text) {
  this.message = { text: text, until: Date.now() + 2600 };
  this.toast.textContent = text;
  this.toast.style.display = 'block';
  var self = this;
  setTimeout(function () {
    if (self.message && Date.now() >= self.message.until) self.toast.style.display = 'none';
  }, 2700);
};

Engine.prototype._updateHUD = function () {
  var s = this.state, g = this.game;
  var goalText = g.goal.type === 'collect'
    ? 'Goal: ' + s.coins + ' / ' + g.goal.count + ' coins'
    : 'Goal: reach the portal';
  var hearts = '';
  for (var i = 0; i < s.maxHp; i += 5) hearts += (s.hp > i) ? '♥' : '♡';
  this.hud.innerHTML =
    '<span title="Health">❤ ' + Math.max(0, s.hp) + '/' + s.maxHp + ' ' + hearts + '</span>' +
    '<span title="Keys">🗝 ' + s.keys + '</span>' +
    '<span title="Coins">🪙 ' + s.coins + '</span>' +
    '<span title="Potions">🧪 ' + s.potions + '</span>' +
    '<span class="rcrgm-goal">' + goalText + '</span>';
};

Engine.prototype._render = function () {
  drawGame(this.ctx, this.game, this.state, { tick: this.tick });
};

/* Start a play session on a container element. The engine builds its own
   canvas + HUD + overlays inside the container. Returns the engine. */
function playGame(container, game) {
  var canvas = document.createElement('canvas');
  canvas.className = 'rcrgm-canvas';
  container.appendChild(canvas);
  var engine = new Engine(canvas, game, { host: container });
  engine.start();
  return engine;
}

/* ------------------------------------------------------------------ */
/* Storage (localStorage + file — no site-side save in v1)             */
/* ------------------------------------------------------------------ */

function autosave(game) {
  try { localStorage.setItem(STORAGE_AUTOSAVE, JSON.stringify(game)); } catch (e) { /* storage full/blocked */ }
}

function loadAutosave() {
  try {
    var raw = localStorage.getItem(STORAGE_AUTOSAVE);
    if (!raw) return null;
    var res = loadGame(raw);
    return res.game;
  } catch (e) { return null; }
}

function saveNamed(name, game) {
  var saves = listSavesRaw();
  saves[name] = clone(game);
  try { localStorage.setItem(STORAGE_SAVES, JSON.stringify(saves)); } catch (e) { /* storage full */ }
}

function listSavesRaw() {
  try { return JSON.parse(localStorage.getItem(STORAGE_SAVES) || '{}') || {}; }
  catch (e) { return {}; }
}

function listSaves() { return Object.keys(listSavesRaw()).sort(); }

function loadNamed(name) {
  var saves = listSavesRaw();
  return saves[name] ? clone(saves[name]) : null;
}

function deleteSave(name) {
  var saves = listSavesRaw();
  delete saves[name];
  try { localStorage.setItem(STORAGE_SAVES, JSON.stringify(saves)); } catch (e) { /* ignore */ }
}

/* Trigger a browser download of the game as a .rpg.json file. */
function downloadGame(game) {
  var blob = new Blob([JSON.stringify(game, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  var safeName = (game.name || 'my-game').replace(/[^a-z0-9\-_]+/gi, '-').toLowerCase();
  a.href = URL.createObjectURL(blob);
  a.download = safeName + '.rpg.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* Build a play-game.html URL carrying the game in ?data=. Returns null
   when the URL would be too long for browsers to handle reliably
   (~2000 chars) — callers should fall back to copying the raw code. */
function buildPlayLink(game) {
  var code = encodeGame(game);
  var base = location.href.replace(/game-maker\.html.*$/, 'play-game.html');
  var url = base + '?data=' + code;
  return url.length > 2000 ? null : url;
}

/* Copy text to the clipboard, with a textarea fallback for older setups. */
function copyText(text, done) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallbackCopy(text, done); });
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, done) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  done(ok);
}

/* ------------------------------------------------------------------ */
/* Editor (game-maker.html)                                            */
/* ------------------------------------------------------------------ */

/* initEditor(opts) — opts element ids (all optional; defaults match
   game-maker.html):
     canvas, host, nameInput, widthInput, heightInput, colorInput,
     palette, objectBar, inspector, status,
     playBtn, stopBtn, saveBtn, saveNameInput, savesList,
     downloadBtn, loadFileInput, copyLinkBtn, copyCodeBtn, newBtn
   The editor owns the canvas; Play-test swaps the same canvas into a
   live Engine and swaps it back on Stop, map intact. */
function initEditor(opts) {
  opts = opts || {};
  function $(id, fallback) { return document.getElementById(id || fallback); }

  var canvas = $(opts.canvas, 'gm-canvas');
  var host = $(opts.host, 'gm-host');
  var ctx = canvas.getContext('2d');
  var game = loadAutosave() || createEmptyGame('My Adventure');
  var ed = {
    game: game,
    tool: 'paint',            // paint | select | npc | sign | chest | item | door | enemy | start | goal
    tile: TILE.GRASS,
    itemKind: 'key',
    selected: null,           // { type, index } — object being edited
    painting: false,
    engine: null,             // live play-test engine, or null
    tick: 0
  };

  /* --- rendering --- */
  function resizeCanvas() {
    canvas.width = game.width * TILE_SIZE;
    canvas.height = game.height * TILE_SIZE;
  }
  function draw() {
    resizeCanvas();
    var highlight = null;
    if (ed.selected) {
      var list = game[ed.selected.type + 's'] || game[ed.selected.type];
      var obj = list && list[ed.selected.index];
      if (obj) highlight = { x: obj.x, y: obj.y };
    }
    drawGame(ctx, game, null, { tick: ed.tick, highlight: highlight });
  }
  function renderLoop(t) {
    if (ed.engine) return; // engine owns the loop while play-testing
    ed.tick = t || 0;
    draw();
    requestAnimationFrame(renderLoop);
  }

  /* --- change bookkeeping --- */
  var saveTimer = null;
  function changed() {
    autosave(game);
    draw();
    renderInspector();
    updateStatus();
    if (saveTimer) clearTimeout(saveTimer);
  }
  function updateStatus() {
    var el = $(opts.status, 'gm-status');
    if (el) {
      var errs = validateGame(game);
      el.textContent = errs.length ? '⚠ ' + errs.join(' ') : '✓ Map looks good — ' + game.width + '×' + game.height + ' tiles.';
    }
  }

  /* --- toolbar: tile palette + object tools --- */
  function buildPalette() {
    var pal = $(opts.palette, 'gm-palette');
    if (!pal) return;
    pal.innerHTML = '';
    TILE_NAMES.forEach(function (name, code) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'gm-tool' + (ed.tool === 'paint' && ed.tile === code ? ' active' : '');
      b.textContent = name;
      b.dataset.tool = 'paint';
      b.dataset.tile = code;
      b.addEventListener('click', function () {
        ed.tool = 'paint'; ed.tile = code; ed.erase = false; ed.selected = null;
        refreshTools(); draw(); renderInspector();
      });
      pal.appendChild(b);
    });
    var erase = document.createElement('button');
    erase.type = 'button';
    erase.className = 'gm-tool' + (ed.tool === 'paint' && ed.erase ? ' active' : '');
    erase.textContent = '⌫ erase';
    erase.dataset.tool = 'paint';
    erase.dataset.erase = 'true';
    erase.addEventListener('click', function () {
      ed.tool = 'paint'; ed.tile = TILE.GRASS; ed.erase = true; ed.selected = null;
      refreshTools(); draw(); renderInspector();
    });
    pal.appendChild(erase);
  }

  var OBJECT_TOOLS = [
    { tool: 'select', label: '✎ select / edit' },
    { tool: 'npc', label: '🧑 NPC' },
    { tool: 'sign', label: '🪧 sign' },
    { tool: 'chest', label: '🧰 chest' },
    { tool: 'item', label: '🔑 item' },
    { tool: 'door', label: '🚪 door' },
    { tool: 'enemy', label: '👾 enemy' },
    { tool: 'start', label: '▶ player start' },
    { tool: 'goal', label: '★ exit / goal' }
  ];
  function buildObjectBar() {
    var bar = $(opts.objectBar, 'gm-objects');
    if (!bar) return;
    bar.innerHTML = '';
    OBJECT_TOOLS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'gm-tool' + (ed.tool === t.tool ? ' active' : '');
      b.textContent = t.label;
      b.dataset.tool = t.tool;
      b.addEventListener('click', function () {
        ed.tool = t.tool; ed.selected = null;
        refreshTools(); draw(); renderInspector();
      });
      bar.appendChild(b);
    });
    // Item-kind picker, shown when the item tool is active.
    var kindWrap = document.createElement('span');
    kindWrap.className = 'gm-kindwrap';
    kindWrap.textContent = ' item: ';
    ITEM_KINDS.forEach(function (kind) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'gm-tool small' + (ed.itemKind === kind ? ' active' : '');
      b.textContent = kind;
      b.dataset.kind = kind;
      b.addEventListener('click', function () {
        ed.itemKind = kind; ed.tool = 'item';
        refreshTools(); renderInspector();
      });
      kindWrap.appendChild(b);
    });
    bar.appendChild(kindWrap);
  }
  function refreshTools() {
    document.querySelectorAll('.gm-tool').forEach(function (b) {
      var t = b.dataset.tool;
      var active = false;
      if (t === 'paint') {
        if (b.dataset.erase) active = ed.tool === 'paint' && !!ed.erase;
        else active = ed.tool === 'paint' && !ed.erase && parseInt(b.dataset.tile, 10) === ed.tile;
      }
      else if (t) active = ed.tool === t;
      else if (b.dataset.kind) active = ed.tool === 'item' && ed.itemKind === b.dataset.kind;
      b.classList.toggle('active', active);
    });
  }

  /* --- canvas interaction (pointer events cover mouse + touch) --- */
  function cellFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    var x = Math.floor((e.clientX - rect.left) / rect.width * game.width);
    var y = Math.floor((e.clientY - rect.top) / rect.height * game.height);
    return { x: clamp(x, 0, game.width - 1), y: clamp(y, 0, game.height - 1) };
  }

  function placeObjectAt(cell) {
    var g = game;
    function removeAt(list, x, y) {
      var hit = objectAt(list, x, y);
      if (hit) list.splice(hit.index, 1);
    }
    switch (ed.tool) {
      case 'npc':
        removeAt(g.npcs, cell.x, cell.y);
        g.npcs.push({ x: cell.x, y: cell.y, name: 'Villager', color: '#7c4dff', dialogue: ['Hello!'] });
        ed.selected = { type: 'npc', index: g.npcs.length - 1 };
        break;
      case 'sign':
        removeAt(g.signs, cell.x, cell.y);
        g.signs.push({ x: cell.x, y: cell.y, text: 'Read me!' });
        ed.selected = { type: 'sign', index: g.signs.length - 1 };
        break;
      case 'chest':
        removeAt(g.chests, cell.x, cell.y);
        g.chests.push({ x: cell.x, y: cell.y, contains: 'coin', opened: false });
        ed.selected = { type: 'chest', index: g.chests.length - 1 };
        break;
      case 'item':
        removeAt(g.items, cell.x, cell.y);
        g.items.push({ x: cell.x, y: cell.y, kind: ed.itemKind,
                       name: ed.itemKind === 'key' ? 'Rusty Key' : (ed.itemKind === 'coin' ? 'Gold Coin' : 'Healing Potion') });
        ed.selected = { type: 'item', index: g.items.length - 1 };
        break;
      case 'door':
        removeAt(g.doors, cell.x, cell.y);
        g.doors.push({ x: cell.x, y: cell.y, needs: 'key' });
        ed.selected = { type: 'door', index: g.doors.length - 1 };
        break;
      case 'enemy':
        removeAt(g.enemies, cell.x, cell.y);
        g.enemies.push({ x: cell.x, y: cell.y, name: 'Slime', hp: 10, atk: 2, color: '#39ff88' });
        ed.selected = { type: 'enemy', index: g.enemies.length - 1 };
        break;
      case 'start':
        g.playerStart = { x: cell.x, y: cell.y };
        ed.selected = null;
        break;
      case 'goal':
        g.goal.type = 'exit';
        g.goal.x = cell.x; g.goal.y = cell.y;
        ed.selected = null;
        break;
      default:
        break;
    }
  }

  function selectObjectAt(cell) {
    // Check every object list, topmost first.
    var lists = ['enemies', 'npcs', 'chests', 'items', 'doors', 'signs'];
    for (var i = 0; i < lists.length; i++) {
      var hit = objectAt(game[lists[i]], cell.x, cell.y);
      if (hit) {
        var singular = lists[i].replace(/s$/, '');
        if (lists[i] === 'enemies') singular = 'enemy';
        if (lists[i] === 'npcs') singular = 'npc';
        ed.selected = { type: singular, index: hit.index };
        return true;
      }
    }
    if (game.playerStart.x === cell.x && game.playerStart.y === cell.y) {
      ed.selected = { type: 'playerStart', index: -1 };
      return true;
    }
    if (game.goal.type === 'exit' && game.goal.x === cell.x && game.goal.y === cell.y) {
      ed.selected = { type: 'goal', index: -1 };
      return true;
    }
    ed.selected = null;
    return false;
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (ed.engine) return;
    e.preventDefault();
    var cell = cellFromEvent(e);
    if (ed.tool === 'paint') {
      ed.painting = true;
      setTile(game, cell.x, cell.y, ed.tile);
      changed();
    } else if (ed.tool === 'select') {
      selectObjectAt(cell);
      draw(); renderInspector();
    } else {
      placeObjectAt(cell);
      changed();
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!ed.painting || ed.engine) return;
    var cell = cellFromEvent(e);
    setTile(game, cell.x, cell.y, ed.tile);
    draw();
    autosave(game);
  });
  window.addEventListener('pointerup', function () { ed.painting = false; });

  /* --- inspector (side panel for the selected object) --- */
  function field(label, input) {
    var wrap = document.createElement('label');
    wrap.className = 'gm-field';
    var span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(span);
    wrap.appendChild(input);
    return wrap;
  }
  function textInput(value, onChange) {
    var input = document.createElement('input');
    input.type = 'text'; input.value = value;
    input.addEventListener('input', function () { onChange(input.value); autosave(game); });
    return input;
  }
  function numInput(value, min, max, onChange) {
    var input = document.createElement('input');
    input.type = 'number'; input.value = value; input.min = min; input.max = max;
    input.addEventListener('input', function () {
      onChange(clamp(parseInt(input.value, 10) || min, min, max));
      autosave(game); draw();
    });
    return input;
  }
  function colorInput(value, onChange) {
    var input = document.createElement('input');
    input.type = 'color'; input.value = value;
    input.addEventListener('input', function () { onChange(input.value); autosave(game); draw(); });
    return input;
  }
  function selectInput(options, value, onChange) {
    var sel = document.createElement('select');
    options.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o; opt.textContent = o;
      if (o === value) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function () { onChange(sel.value); autosave(game); draw(); });
    return sel;
  }
  function deleteButton(onDelete) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'gm-tool danger';
    b.textContent = '🗑 Delete this object';
    b.addEventListener('click', onDelete);
    return b;
  }

  function renderInspector() {
    var panel = $(opts.inspector, 'gm-inspector');
    if (!panel) return;
    panel.innerHTML = '';
    if (!ed.selected) {
      var hint = document.createElement('p');
      hint.className = 'gm-hint';
      hint.textContent = 'Pick a tool, then click the map. Click an object with the ✎ select tool to edit it here.';
      panel.appendChild(hint);
      return;
    }
    var sel = ed.selected;
    var title = document.createElement('h3');
    title.textContent = 'Edit ' + sel.type;
    panel.appendChild(title);

    function listFor(type) {
      if (type === 'npc') return game.npcs;
      if (type === 'sign') return game.signs;
      if (type === 'chest') return game.chests;
      if (type === 'item') return game.items;
      if (type === 'door') return game.doors;
      if (type === 'enemy') return game.enemies;
      return null;
    }
    var list = listFor(sel.type);
    var obj = list ? list[sel.index] : null;

    if (sel.type === 'playerStart') {
      panel.appendChild(field('Position', (function () {
        var s = document.createElement('span');
        s.textContent = game.playerStart.x + ', ' + game.playerStart.y + ' — click the map with the ▶ start tool to move it.';
        return s;
      })()));
      return;
    }
    if (sel.type === 'goal') {
      panel.appendChild(field('Goal type', selectInput(['exit', 'collect'], game.goal.type, function (v) {
        game.goal.type = v; changed();
      })));
      if (game.goal.type === 'collect') {
        panel.appendChild(field('Coins to collect', numInput(game.goal.count || 5, 1, 99, function (v) {
          game.goal.count = v; changed();
        })));
      } else {
        panel.appendChild(field('Exit tile', (function () {
          var s = document.createElement('span');
          s.textContent = game.goal.x + ', ' + game.goal.y + ' — click the map with the ★ goal tool to move it.';
          return s;
        })()));
      }
      panel.appendChild(field('Win text', textInput(game.winText, function (v) { game.winText = v; })));
      return;
    }
    if (!obj) { ed.selected = null; renderInspector(); return; }

    if (sel.type === 'npc') {
      panel.appendChild(field('Name', textInput(obj.name, function (v) { obj.name = v; })));
      panel.appendChild(field('Robe color', colorInput(obj.color, function (v) { obj.color = v; })));
      var dlgLabel = document.createElement('label');
      dlgLabel.className = 'gm-field';
      var dlgSpan = document.createElement('span');
      dlgSpan.textContent = 'Dialogue (one line per row)';
      dlgLabel.appendChild(dlgSpan);
      var ta = document.createElement('textarea');
      ta.rows = 4;
      ta.value = obj.dialogue.join('\n');
      ta.addEventListener('input', function () {
        obj.dialogue = ta.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        if (!obj.dialogue.length) obj.dialogue = ['Hello!'];
        autosave(game);
      });
      dlgLabel.appendChild(ta);
      panel.appendChild(dlgLabel);
    }
    if (sel.type === 'sign') {
      panel.appendChild(field('Sign text', textInput(obj.text, function (v) { obj.text = v; })));
    }
    if (sel.type === 'chest') {
      panel.appendChild(field('Contains', selectInput(['coin', 'potion'], obj.contains, function (v) { obj.contains = v; })));
    }
    if (sel.type === 'item') {
      panel.appendChild(field('Kind', selectInput(ITEM_KINDS, obj.kind, function (v) { obj.kind = v; })));
      panel.appendChild(field('Name', textInput(obj.name, function (v) { obj.name = v; })));
    }
    if (sel.type === 'door') {
      var note = document.createElement('p');
      note.className = 'gm-hint';
      note.textContent = 'Doors need a key. The player picks keys up by walking over them.';
      panel.appendChild(note);
    }
    if (sel.type === 'enemy') {
      panel.appendChild(field('Name', textInput(obj.name, function (v) { obj.name = v; })));
      panel.appendChild(field('Color', colorInput(obj.color, function (v) { obj.color = v; })));
      panel.appendChild(field('HP', numInput(obj.hp, 1, 999, function (v) { obj.hp = v; })));
      panel.appendChild(field('Attack', numInput(obj.atk, 0, 99, function (v) { obj.atk = v; })));
    }
    panel.appendChild(deleteButton(function () {
      list.splice(sel.index, 1);
      ed.selected = null;
      changed();
    }));
  }

  /* --- header controls: name, size, hero color --- */
  var nameInput = $(opts.nameInput, 'gm-name');
  if (nameInput) {
    nameInput.value = game.name;
    nameInput.addEventListener('input', function () { game.name = nameInput.value.slice(0, 80); autosave(game); });
  }
  var wInput = $(opts.widthInput, 'gm-width');
  var hInput = $(opts.heightInput, 'gm-height');
  if (wInput) wInput.value = game.width;
  if (hInput) hInput.value = game.height;
  function applySize() {
    resizeMap(game, wInput ? wInput.value : game.width, hInput ? hInput.value : game.height);
    if (wInput) wInput.value = game.width;
    if (hInput) hInput.value = game.height;
    changed();
  }
  if (wInput) wInput.addEventListener('change', applySize);
  if (hInput) hInput.addEventListener('change', applySize);

  var colorInputEl = $(opts.colorInput, 'gm-color');
  if (colorInputEl) {
    colorInputEl.value = game.playerColor;
    colorInputEl.addEventListener('input', function () {
      game.playerColor = colorInputEl.value; autosave(game); draw();
    });
  }

  /* --- play-test --- */
  var playBtn = $(opts.playBtn, 'gm-play');
  var stopBtn = $(opts.stopBtn, 'gm-stop');
  function startTest() {
    if (ed.engine) return;
    ed.engine = new Engine(canvas, game, { host: host });
    ed.engine.start();
    if (playBtn) playBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-block';
  }
  function stopTest() {
    if (!ed.engine) return;
    ed.engine.stop();
    ed.engine = null;
    draw();
    if (playBtn) playBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'none';
  }
  if (playBtn) playBtn.addEventListener('click', startTest);
  if (stopBtn) { stopBtn.style.display = 'none'; stopBtn.addEventListener('click', stopTest); }

  /* --- saves: named list, download, load file, share --- */
  function renderSaves() {
    var list = $(opts.savesList, 'gm-saves');
    if (!list) return;
    list.innerHTML = '';
    var names = listSaves();
    if (!names.length) {
      var empty = document.createElement('li');
      empty.textContent = 'No named saves yet.';
      list.appendChild(empty);
      return;
    }
    names.forEach(function (name) {
      var li = document.createElement('li');
      var label = document.createElement('span');
      label.textContent = name + ' ';
      var loadB = document.createElement('button');
      loadB.type = 'button'; loadB.className = 'gm-tool small'; loadB.textContent = 'Load';
      loadB.addEventListener('click', function () {
        var loaded = loadNamed(name);
        if (loaded) {
          game = normalizeGame(loaded); ed.game = game; ed.selected = null;
          syncHeader(); changed();
        }
      });
      var delB = document.createElement('button');
      delB.type = 'button'; delB.className = 'gm-tool small danger'; delB.textContent = 'Delete';
      delB.addEventListener('click', function () { deleteSave(name); renderSaves(); });
      li.appendChild(label); li.appendChild(loadB); li.appendChild(delB);
      list.appendChild(li);
    });
  }
  function syncHeader() {
    if (nameInput) nameInput.value = game.name;
    if (wInput) wInput.value = game.width;
    if (hInput) hInput.value = game.height;
    if (colorInputEl) colorInputEl.value = game.playerColor;
  }
  var saveBtn = $(opts.saveBtn, 'gm-save');
  var saveNameInput = $(opts.saveNameInput, 'gm-savename');
  if (saveBtn) saveBtn.addEventListener('click', function () {
    var name = (saveNameInput ? saveNameInput.value : '').trim() || game.name;
    saveNamed(name, game);
    renderSaves();
    updateStatus();
  });
  var dlBtn = $(opts.downloadBtn, 'gm-download');
  if (dlBtn) dlBtn.addEventListener('click', function () { downloadGame(game); });
  var fileInput = $(opts.loadFileInput, 'gm-loadfile');
  if (fileInput) fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var res = loadGame(String(reader.result));
      if (res.game) {
        game = res.game; ed.game = game; ed.selected = null;
        syncHeader(); changed();
        if (res.errors.length) alert('Loaded with warnings:\n' + res.errors.join('\n'));
      } else {
        alert('Could not load that file:\n' + res.errors.join('\n'));
      }
      fileInput.value = '';
    };
    reader.readAsText(f);
  });
  var copyLinkBtn = $(opts.copyLinkBtn, 'gm-copylink');
  if (copyLinkBtn) copyLinkBtn.addEventListener('click', function () {
    var url = buildPlayLink(game);
    if (url) {
      copyText(url, function (ok) {
        alert(ok ? 'Play link copied! Share it and anyone can play your game.' : 'Could not copy automatically — here is the link:\n' + url);
      });
    } else {
      // Too long for a URL — fall back to the raw game code.
      copyText(encodeGame(game), function (ok) {
        alert(ok
          ? 'This game is too big for a link, so the game CODE was copied instead. Paste it into the code box on the play page.'
          : 'Game too big for a link. Copy the code from the "Copy game code" button instead.');
      });
    }
  });
  var copyCodeBtn = $(opts.copyCodeBtn, 'gm-copycode');
  if (copyCodeBtn) copyCodeBtn.addEventListener('click', function () {
    copyText(encodeGame(game), function (ok) {
      alert(ok ? 'Game code copied! Paste it into the code box on the play page.' : 'Copy failed — your browser blocked the clipboard.');
    });
  });
  var newBtn = $(opts.newBtn, 'gm-new');
  if (newBtn) newBtn.addEventListener('click', function () {
    if (!confirm('Start a fresh map? Your current map stays in autosave until you change it.')) return;
    game = createEmptyGame('My Adventure'); ed.game = game; ed.selected = null;
    syncHeader(); changed();
  });

  /* --- boot --- */
  buildPalette();
  buildObjectBar();
  renderInspector();
  renderSaves();
  syncHeader();
  updateStatus();
  requestAnimationFrame(renderLoop);
  return ed;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

var RCRGame = {
  TILE: TILE,
  TILE_NAMES: TILE_NAMES,
  TILE_SIZE: TILE_SIZE,
  MIN_SIZE: MIN_SIZE,
  MAX_SIZE: MAX_SIZE,
  createEmptyGame: createEmptyGame,
  loadGame: loadGame,
  validateGame: validateGame,
  normalizeGame: normalizeGame,
  resizeMap: resizeMap,
  encodeGame: encodeGame,
  decodeGame: decodeGame,
  newPlayState: newPlayState,
  isBlocked: isBlocked,
  canOpenDoor: canOpenDoor,
  battleAttack: battleAttack,
  checkGoal: checkGoal,
  totalCoinsOnMap: totalCoinsOnMap,
  drawGame: drawGame,
  Engine: Engine,
  playGame: playGame,
  initEditor: initEditor,
  autosave: autosave,
  loadAutosave: loadAutosave,
  saveNamed: saveNamed,
  listSaves: listSaves,
  loadNamed: loadNamed,
  deleteSave: deleteSave,
  downloadGame: downloadGame,
  buildPlayLink: buildPlayLink
};

global.RCRGame = RCRGame;
if (typeof module !== 'undefined' && module.exports) module.exports = RCRGame;

})(typeof window !== 'undefined' ? window : globalThis);
