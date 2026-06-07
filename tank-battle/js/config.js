// ─── Tile types ───────────────────────────────────────────────────────────────
const TILE = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, GRASS: 4, ICE: 5, EAGLE: 6, EAGLE_DEAD: 7 };

// ─── Directions ───────────────────────────────────────────────────────────────
const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };

// ─── Enemy types ──────────────────────────────────────────────────────────────
const ETYPE = { BASIC: 0, FAST: 1, POWER: 2, ARMOR: 3 };

// ─── Power-up types ───────────────────────────────────────────────────────────
const PUP = { STAR: 0, SHIELD: 1, TANK: 2, SHOVEL: 3, BOMB: 4, CLOCK: 5 };

// ─── Main config ──────────────────────────────────────────────────────────────
const CFG = {
  TS: 32,           // tile size in px
  COLS: 13,
  ROWS: 13,
  GW: 416,          // game canvas width  (13 * 32)
  GH: 416,          // game canvas height
  HW: 160,          // HUD width

  PLAYER_SPEED:          2.5,
  PLAYER_BULLET_SPEED:   8,
  PLAYER_MAX_BULLETS:    1,
  PLAYER_SHOOT_CD:       320,

  ENEMY_SPEED:       [1.6, 2.8, 1.2, 1.5],
  ENEMY_BSPEED:      [5,   5,   4,   5  ],
  ENEMY_HP:          [1,   1,   1,   4  ],
  ENEMY_BPOWER:      [1,   1,   2,   1  ],
  ENEMY_SHOOT_INT:   [2200,2600,1600,2100],
  ENEMY_PTS:         [100, 200, 300, 400 ],
  ENEMY_HAS_PUP:     [false,false,false,true],

  MAX_ON_SCREEN:     4,
  SPAWN_INTERVAL:    3000,
  RESPAWN_DELAY:     2500,
  SPAWN_SHIELD:      2000,

  EXPL_DURATION:     640,
  SHIELD_DURATION:   8000,
  STAR_DURATION:     10000,
  STAR_CD:           140,
  STAR_MAX_B:        3,
  SHOVEL_DURATION:   15000,
  CLOCK_DURATION:    8000,

  // ─── Level maps (13 × 13, chars: . B S W G I E) ─────────────────────────────
  // . = empty   B = brick   S = steel   W = water   G = grass   I = ice   E = eagle
  // Eagle is always at col 6, row 12.
  // Spawn cols 0,6,12 row 0 and player col 2 row 12 are auto-cleared in code.
  LEVELS: [
    // ── Level 1  (easy intro) ───────────────────────────────────────────────
    [
      ".............",
      ".BB...BB.....",
      ".B..B..B.B...",
      "..BBB....BBB.",
      ".............",
      "...SS..B.....",
      ".............",
      ".B.......B...",
      ".BBB.BBB.B...",
      "...........B.",
      ".B..B..B.B...",
      ".....B.......",
      "......E......"
    ],
    // ── Level 2 ─────────────────────────────────────────────────────────────
    [
      ".............",
      "BB.BBB.BBB.BB",
      "B..B...B...B.",
      "B.BB.B.B.BB.B",
      "B..........B.",
      "..SSSS...SS..",
      ".............",
      ".BB.....BBB..",
      "..BB.B.BB....",
      "BBB...B....B.",
      "...B...B...B.",
      "BB.B...B.BB..",
      "......E......"
    ],
    // ── Level 3 ─────────────────────────────────────────────────────────────
    [
      ".............",
      ".B.B.B.B.B.B.",
      "B...B...B...B",
      ".B.BBB.BBB.B.",
      "...........B.",
      "SSSS...SSSS..",
      "S...........S",
      "SSSS...SSSS..",
      ".............",
      ".BBB.B.B.BBB.",
      "B...B...B...B",
      ".B.B.B.B.B.B.",
      "......E......"
    ],
    // ── Level 4 ─────────────────────────────────────────────────────────────
    [
      ".............",
      "BBBBB.BBBBBBB",
      "B...B.B.....B",
      "B.B.B.B.BBBBB",
      "B.B.....B...B",
      "B.BSSSS.B.B.B",
      "B.....SSB.B.B",
      "B.B.B.B.B.B.B",
      "B...B...B...B",
      "BBBBB.BBBBBBB",
      "...B.....B...",
      "BB...BBB...BB",
      "......E......"
    ],
    // ── Level 5  (hard) ─────────────────────────────────────────────────────
    [
      ".............",
      "BBBBB.B.BBBBB",
      "B...B.B.B...B",
      "B.S.B.B.B.S.B",
      "B...B...B...B",
      "BBBBB.S.BBBBB",
      "...........S.",
      "BBBBB.S.BBBBB",
      "B...B...B...B",
      "B.S.B.B.B.S.B",
      "B...B.B.B...B",
      "BBBBB.B.BBBBB",
      "......E......"
    ]
  ],

  // Enemies per level: array of {type, count}
  WAVES: [
    [ {t:0,n:20} ],
    [ {t:0,n:12}, {t:1,n:8} ],
    [ {t:0,n:8},  {t:1,n:6}, {t:2,n:6} ],
    [ {t:0,n:6},  {t:1,n:6}, {t:2,n:4}, {t:3,n:4} ],
    [ {t:1,n:6},  {t:2,n:6}, {t:3,n:8} ]
  ]
};
