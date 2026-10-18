// Shared layout and tuning values. All coordinates are in the 960x540 game space;
// Phaser's FIT scale mode stretches that space to whatever screen the game runs on.
// Menu items live in ./data/menu.js; per-level difficulty lives in ./data/levels.js.

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const LAYOUT = {
  sandTop: 360,

  // Area of the sand the waitress is allowed to walk on
  walkArea: { minX: 20, maxX: 940, minY: 420, maxY: 528 },

  // Tables stand on this floor line
  tableFloorY: 440,
  tableXs: [380, 580, 780],

  // Beach bar footprint and where the waitress stands to use it
  bar: { x: 40, y: 270, width: 180, height: 145 },
  barServiceSpot: { x: 250, y: 425 },

  // Where customers enter, and where they line up (index 0 = front of the line)
  spawnPoint: { x: -40, y: 505 },
  queueSpots: [
    { x: 180, y: 505 },
    { x: 125, y: 505 },
    { x: 70, y: 505 }
  ],

  // Leaving guests walk down to this lane, then off the right edge
  exitLaneY: 528,
  exitX: 1010,

  waitressStart: { x: 480, y: 500 }
};

// Movement speeds in pixels per second
export const SPEED = {
  waitress: 300,
  customer: 130
};

// Arrival timing shared by all levels. How many guests open the shift and how
// often they arrive afterwards is set per level.
export const CUSTOMERS = {
  firstArrivalMs: 800,
  initialIntervalMs: 2000, // spacing of the opening wave
  retryWhenLineFullMs: 2000 // when the line is full, check again this often
};

export const PATIENCE = {
  orderTakenRefill: 0.2, // taking an order restores this much of the seated meter
  warningBelow: 0.5, // meter turns yellow
  criticalBelow: 0.25, // meter turns red and pulses
  unhappySpeedMultiplier: 1.4 // unhappy guests stomp off a bit faster
};

export const SHIFT = {
  lowTimeWarningMs: 15000 // timer turns red and pulses for the last few seconds
};

// Gameplay timing, in milliseconds
export const TIMING = {
  browseMenuMs: { min: 2500, max: 4500 }, // seated -> ready to order
  consumeMs: { drink: 4000, food: 6000 }, // eating / drinking time per category
  cleaningMs: 1800,
  leaveDelayMs: 700 // pause after paying before the guest stands up
};

export const DEPTH = {
  background: 0,
  effects: 900,
  hud: 1000
};
