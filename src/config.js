// Shared layout and tuning values.
//
// The screen (viewport) is 960x540 game units; Phaser's FIT scale mode stretches
// it to whatever screen the game runs on. The world is much wider than the
// screen and the camera scrolls sideways across it. All LAYOUT coordinates are
// world coordinates.
//
// Menu items live in ./data/menu.js; per-level difficulty lives in ./data/levels.js.

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

// The whole beach. Only the width is larger than the screen: the camera never
// scrolls vertically.
export const WORLD = {
  width: 2400,
  height: GAME_HEIGHT
};

// Characters, tables and the bar are drawn at their original size and scaled up
// by these factors, so their artwork and hit boxes stay in proportion.
export const SCALE = {
  character: 1.5,
  table: 1.5,
  bar: 1.5
};

export const LAYOUT = {
  horizonY: 105, // top of the ocean
  sandTop: 330,

  // Wooden deck the restaurant stands on
  deck: { minX: 30, maxX: 1480, top: 418 },

  // The waitress walks in a lane in front of all furniture, so she can never
  // pass through a table or the bar. Everything she visits is inside this band.
  walkArea: { minX: 40, maxX: 2340, minY: 470, maxY: 528 },
  serviceY: 478, // where she stands to use a table or the bar

  // Tables stand on this floor line, behind the walking lane
  tableFloorY: 440,
  tableXs: [620, 950, 1280],

  // Beach bar footprint (left edge and bottom), and where the waitress stands
  // to use it (in front of the counter)
  bar: { x: 70, bottom: 440, width: 180, height: 145 },
  barServiceSpot: { x: 300, y: 478 },

  // Guests arrive from the right edge and line up facing the restaurant
  // (index 0 = front of the line)
  spawnPoint: { x: WORLD.width + 60, y: 482 },
  queueSpots: [
    { x: 1600, y: 482 },
    { x: 1690, y: 482 },
    { x: 1780, y: 482 }
  ],
  // Seated guests walk along this line, then step up to their stool
  guestWalkY: 482,

  // Leaving guests walk down to this lane, then off the right edge
  exitLaneY: 528,
  exitX: WORLD.width + 70,

  waitressStart: { x: 800, y: 500 }
};

// Movement speeds in world units per second. They are scaled with the
// characters so trips take about as long as in v1.0 (bar -> farthest table
// is about 2.1 s, against 2.0 s before the world got bigger).
export const SPEED = {
  waitress: 520,
  customer: 240
};

// Camera behaviour (distances in screen units)
export const CAMERA = {
  dragThreshold: 12, // a press that moves less than this is a tap
  followMargin: 170, // keep the waitress at least this far from the screen edges
  followSharpness: 6, // how quickly the camera catches up while following (per second)
  flingFriction: 4, // how quickly a swipe's momentum dies away (per second)
  maxFlingSpeed: 3000, // units per second
  wheelSpeed: 1 // mouse wheel / trackpad scroll multiplier
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
