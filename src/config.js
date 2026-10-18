// Shared layout and tuning values. All coordinates are in the 960x540 game space;
// Phaser's FIT scale mode stretches that space to whatever screen the game runs on.

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const LAYOUT = {
  sandTop: 360,

  // Area of the sand the waitress is allowed to walk on
  walkArea: { minX: 20, maxX: 940, minY: 420, maxY: 528 },

  // Tables stand on this floor line
  tableFloorY: 440,
  tableXs: [380, 580, 780],

  // Where customers enter, and where they line up (index 0 = front of the line)
  spawnPoint: { x: -40, y: 505 },
  queueSpots: [
    { x: 180, y: 505 },
    { x: 125, y: 505 },
    { x: 70, y: 505 }
  ],

  waitressStart: { x: 480, y: 500 }
};

// Movement speeds in pixels per second
export const SPEED = {
  waitress: 300,
  customer: 130
};

export const CUSTOMERS = {
  count: 3,
  firstArrivalMs: 800,
  arrivalIntervalMs: 2000
};

export const DEPTH = {
  background: 0,
  hud: 1000
};
