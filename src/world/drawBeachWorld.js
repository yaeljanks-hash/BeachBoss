// The scenery of the wide beach: sky, ocean, sand, the restaurant deck and
// decorations. Everything here is decoration only: nothing is interactive and
// nothing changes during a shift. All artwork is original, drawn with Phaser
// graphics.
//
// Far-away layers (sun, clouds, island) scroll slower than the beach
// (scroll factor < 1), which gives the scene some depth.
//
// Each layer is drawn once into an off-screen Graphics object and baked into a
// texture shown as a plain image. Graphics objects replay every drawing command
// on every frame (tens of thousands here), which is far too slow for phones;
// an image costs a single draw. The textures are kept, so restarting a level
// reuses them instead of drawing again.
import Phaser from 'phaser';
import { WORLD, LAYOUT, GAME_WIDTH, DEPTH } from '../config.js';

const W = WORLD.width;
const H = WORLD.height;

// Scroll factor of each layer, back to front: sky, sun, clouds, islands, beach
const LAYER_FACTORS = [0, 0.08, 0.25, 0.45, 1];
const textureKey = factor => `beach-world-${factor}`;

let layers = null; // factor -> Graphics, only while drawing

const COLORS = {
  skyTop: 0x6ec6f0,
  skyBottom: 0xbfe9fb,
  sun: 0xfff176,
  cloud: 0xffffff,
  island: 0x3f9b78,
  islandFar: 0x6bb7a0,
  oceanFar: 0x4fc8d8,
  ocean: 0x2fb5c9,
  oceanNear: 0x45cfd6,
  foam: 0xffffff,
  wetSand: 0xe2bf7f,
  sand: 0xf4d79b,
  sandShade: 0xe8c886,
  deck: 0xc8935f,
  deckDark: 0xa8764a,
  deckLight: 0xdcab78,
  wood: 0x8b5a3c,
  woodDark: 0x6b4129,
  rope: 0xcaa472,
  trunk: 0x9c6b3f,
  trunkDark: 0x7f532e,
  leaf: 0x43a047,
  leafDark: 0x2e7d32,
  coconut: 0x6d4c41
};

/** The drawing surface for the layer that scrolls at `factor` speed. */
function layer(scene, factor = 1) {
  return layers.get(factor);
}

/** How wide a layer with this scroll factor must be to cover the whole world. */
function layerWidth(factor) {
  return (W - GAME_WIDTH) * factor + GAME_WIDTH;
}

/** Texture size for a layer: distant layers only cover the sky. */
function layerSize(factor) {
  if (factor === 1) return { width: W, height: H };
  return { width: Math.ceil(layerWidth(factor)), height: LAYOUT.horizonY + 30 };
}

export function drawBeachWorld(scene) {
  scene.cameras.main.setBackgroundColor(COLORS.skyBottom);

  const alreadyBaked = LAYER_FACTORS.every(f => scene.textures.exists(textureKey(f)));
  if (!alreadyBaked) {
    layers = new Map(LAYER_FACTORS.map(f => [f, scene.make.graphics({}, false)]));
    drawSky(scene);
    drawOcean(scene);
    drawSand(scene);
    drawBackPalms(scene);
    drawDeck(scene);
    drawStringLights(scene);
    drawWaitingArea(scene);
    drawBeachDecor(scene);

    layers.forEach((g, factor) => {
      const { width, height } = layerSize(factor);
      g.generateTexture(textureKey(factor), width, height);
      g.destroy();
    });
    layers = null;
  }

  LAYER_FACTORS.forEach(factor => {
    scene.add.image(0, 0, textureKey(factor)).setOrigin(0).setScrollFactor(factor, 1).setDepth(DEPTH.background);
  });
  addSignText(scene);
}

/** Sign lettering stays as real text on top of the baked scenery. */
function addSignText(scene) {
  const front = LAYOUT.queueSpots[0];
  scene.add
    .text(front.x + 2, WAIT_SIGN_Y, 'WAIT HERE', { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' })
    .setOrigin(0.5)
    .setDepth(DEPTH.background);

  const { left, right, top } = entranceArch();
  scene.add
    .text((left + right) / 2, top - 19, 'BEACH BOSS', { fontSize: '28px', color: '#ffffff', fontStyle: 'bold' })
    .setOrigin(0.5)
    .setStroke('#8d5a2b', 5)
    .setDepth(DEPTH.background);
}

const WAIT_SIGN_Y = 292;

/** Where the entrance arch stands: just past the back of the line. */
function entranceArch() {
  const back = LAYOUT.queueSpots[LAYOUT.queueSpots.length - 1];
  const left = back.x + 130;
  return { left, right: left + 190, top: 250, baseY: 452 };
}

// --- Sky and distance -------------------------------------------------------

function drawSky(scene) {
  // Fixed gradient behind everything
  const sky = layer(scene, 0);
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(COLORS.skyTop),
      Phaser.Display.Color.ValueToColor(COLORS.skyBottom),
      bands - 1,
      i
    );
    sky.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
    sky.fillRect(0, (i * LAYOUT.horizonY) / bands, GAME_WIDTH, LAYOUT.horizonY / bands + 1);
  }

  // Sun, barely moving
  const sun = layer(scene, 0.08);
  sun.fillStyle(COLORS.sun, 0.35);
  sun.fillCircle(560, 58, 42);
  sun.fillStyle(COLORS.sun);
  sun.fillCircle(560, 58, 30);

  // Clouds
  const clouds = layer(scene, 0.25);
  const cloudsWidth = layerWidth(0.25);
  for (let x = 120, i = 0; x < cloudsWidth; x += 330 + (i % 3) * 70, i++) {
    drawCloud(clouds, x, 34 + (i % 2) * 26, 0.8 + (i % 3) * 0.2);
  }

  // Islands on the horizon
  const islands = layer(scene, 0.45);
  const islandsWidth = layerWidth(0.45);
  const y = LAYOUT.horizonY + 1;
  for (let x = 260, i = 0; x < islandsWidth; x += 620 + (i % 2) * 180, i++) {
    islands.fillStyle(COLORS.islandFar);
    islands.fillEllipse(x + 90, y, 220, 34);
    islands.fillStyle(COLORS.island);
    islands.fillEllipse(x, y, 150, 44);
    drawPalm(islands, x + 18, y - 14, 34, 0.3, 0.35);
  }
}

function drawCloud(g, x, y, s) {
  g.fillStyle(COLORS.cloud, 0.9);
  g.fillEllipse(x, y, 70 * s, 24 * s);
  g.fillEllipse(x - 22 * s, y + 4 * s, 44 * s, 18 * s);
  g.fillEllipse(x + 14 * s, y - 8 * s, 46 * s, 26 * s);
  g.fillEllipse(x + 32 * s, y + 3 * s, 40 * s, 16 * s);
}

// --- Ocean -------------------------------------------------------------------

function drawOcean(scene) {
  const g = layer(scene);
  const top = LAYOUT.horizonY;
  const shore = LAYOUT.sandTop;

  g.fillStyle(COLORS.oceanFar);
  g.fillRect(0, top, W, 50);
  g.fillStyle(COLORS.ocean);
  g.fillRect(0, top + 50, W, shore - top - 50);
  g.fillStyle(COLORS.oceanNear);
  g.fillRect(0, shore - 40, W, 40);

  // Light glints in rows that get bigger closer to the beach
  const rng = new Phaser.Math.RandomDataGenerator(['beach-waves']);
  for (let row = 0; row < 6; row++) {
    const y = top + 22 + row * 34;
    const size = 8 + row * 3;
    g.lineStyle(2 + row * 0.4, COLORS.foam, 0.25 + row * 0.04);
    for (let x = rng.between(0, 160); x < W; x += rng.between(150, 260)) {
      g.beginPath();
      g.arc(x, y, size, Math.PI * 1.15, Math.PI * 1.85);
      g.strokePath();
    }
  }

  // Foam where the waves meet the sand
  g.fillStyle(COLORS.foam, 0.85);
  for (let x = 0; x < W; x += 36) g.fillEllipse(x + 18, shore - 2, 46, 10);
}

// --- Sand ---------------------------------------------------------------------

function drawSand(scene) {
  const g = layer(scene);
  const top = LAYOUT.sandTop;

  g.fillStyle(COLORS.wetSand);
  g.fillRect(0, top, W, 16);
  g.fillStyle(COLORS.sand);
  g.fillRect(0, top + 14, W, H - top - 14);

  // Ripples and speckles
  const rng = new Phaser.Math.RandomDataGenerator(['beach-sand']);
  g.fillStyle(COLORS.sandShade, 0.8);
  for (let i = 0; i < 160; i++) {
    g.fillEllipse(rng.between(0, W), rng.between(top + 22, H - 4), rng.between(10, 26), 3);
  }
}

// --- Restaurant deck --------------------------------------------------------

function drawDeck(scene) {
  const g = layer(scene);
  const { minX, maxX, top } = LAYOUT.deck;

  // Back railing (behind the furniture)
  const railTop = top - 34;
  g.fillStyle(COLORS.woodDark);
  for (let x = minX + 6; x <= maxX; x += 64) g.fillRect(x, railTop, 6, 36);
  g.fillStyle(COLORS.wood);
  g.fillRoundedRect(minX, railTop - 4, maxX - minX, 8, 3);
  g.fillRect(minX, railTop + 16, maxX - minX, 4);

  // Floor planks
  g.fillStyle(COLORS.deck);
  g.fillRect(minX, top, maxX - minX, H - top);
  g.fillStyle(COLORS.deckLight);
  g.fillRect(minX, top, maxX - minX, 5);
  g.lineStyle(2, COLORS.deckDark, 0.6);
  for (let y = top + 24; y < H; y += 26) g.lineBetween(minX, y, maxX, y);
  for (let row = 0, y = top + 5; y < H; row++, y += 26) {
    for (let x = minX + (row % 2) * 70 + 40; x < maxX; x += 140) g.lineBetween(x, y, x, y + 19);
  }

  // Front edge and steps down to the sand at the right end
  g.fillStyle(COLORS.deckDark);
  g.fillRect(maxX - 4, top, 8, H - top);
  g.fillStyle(COLORS.deckLight);
  g.fillRect(maxX + 4, top + 40, 22, 8);
  g.fillRect(maxX + 4, top + 82, 36, 8);
}

/** Festoon lights strung from the bar to a pole at the end of the deck. */
function drawStringLights(scene) {
  const g = layer(scene);
  // Poles by the bar, between the tables and at the end of the deck
  const [t1, t2, t3] = LAYOUT.tableXs;
  const poles = [440, (t1 + t2) / 2, (t2 + t3) / 2, LAYOUT.deck.maxX - 10];
  const top = 236;

  g.fillStyle(COLORS.woodDark);
  poles.forEach(x => g.fillRect(x - 4, top - 6, 8, LAYOUT.deck.top - top + 6));

  const bulbColors = [0xffeb3b, 0xff7043, 0x4fc3f7, 0x81c784, 0xf06292];
  let bulb = 0;
  for (let i = 0; i < poles.length - 1; i++) {
    const x1 = poles[i];
    const x2 = poles[i + 1];
    const sag = 34;
    const points = [];
    for (let t = 0; t <= 1.0001; t += 0.05) points.push({ x: x1 + (x2 - x1) * t, y: top + sag * 4 * t * (1 - t) });

    g.lineStyle(2, 0x4e342e);
    g.strokePoints(points);
    points.forEach((p, j) => {
      if (j === 0 || j === points.length - 1 || j % 2) return;
      g.fillStyle(bulbColors[bulb++ % bulbColors.length]);
      g.fillCircle(p.x, p.y + 6, 5);
    });
  }
}

// --- Waiting area and entrance -----------------------------------------------

function drawWaitingArea(scene) {
  const g = layer(scene);
  const spots = LAYOUT.queueSpots;
  const front = spots[0];
  const back = spots[spots.length - 1];
  const y = front.y;

  // Mat under the line
  g.fillStyle(0xd84315, 0.35);
  g.fillRoundedRect(front.x - 50, y - 12, back.x - front.x + 100, 24, 10);

  // Rope barrier behind the line
  const ropeY = y - 52;
  const postXs = [front.x - 55, (front.x + back.x) / 2, back.x + 55];
  g.lineStyle(4, COLORS.rope);
  g.beginPath();
  g.moveTo(postXs[0], ropeY);
  for (let i = 1; i < postXs.length; i++) {
    const mid = (postXs[i - 1] + postXs[i]) / 2;
    g.lineTo(mid, ropeY + 12);
    g.lineTo(postXs[i], ropeY);
  }
  g.strokePath();
  postXs.forEach(x => {
    g.fillStyle(COLORS.woodDark);
    g.fillRect(x - 4, ropeY - 6, 8, y - ropeY - 4);
    g.fillStyle(COLORS.wood);
    g.fillCircle(x, ropeY - 6, 6);
  });

  // "Wait here" sign behind the front of the line, pointing at the restaurant.
  // The board is high enough to stay clear of the guests' heads.
  const signX = front.x;
  const boardY = WAIT_SIGN_Y;
  g.fillStyle(COLORS.woodDark);
  g.fillRect(signX - 3, boardY, 6, ropeY - boardY);
  g.fillStyle(COLORS.wood);
  g.fillPoints(
    [
      { x: signX - 56, y: boardY - 16 },
      { x: signX + 62, y: boardY - 16 },
      { x: signX + 62, y: boardY + 16 },
      { x: signX - 56, y: boardY + 16 },
      { x: signX - 72, y: boardY }
    ],
    true
  );

  // Entrance arch the guests walk through (its lettering is added as text later)
  const { left: archLeft, right: archRight, top: archTop, baseY } = entranceArch();
  g.fillStyle(COLORS.trunk);
  g.fillRect(archLeft - 8, archTop, 16, baseY - archTop);
  g.fillRect(archRight - 8, archTop, 16, baseY - archTop);
  g.fillStyle(0xd4a35a);
  g.fillRoundedRect(archLeft - 30, archTop - 46, archRight - archLeft + 60, 54, 10);
  g.fillStyle(0xc28e45);
  for (let fx = archLeft - 30; fx < archRight + 30; fx += 12) g.fillTriangle(fx, archTop + 8, fx + 12, archTop + 8, fx + 6, archTop + 16);
  // Flowers on the posts
  [0xff4081, 0xffeb3b, 0xff7043].forEach((color, i) => {
    g.fillStyle(color);
    g.fillCircle(archLeft, archTop + 30 + i * 40, 7);
    g.fillCircle(archRight, archTop + 50 + i * 40, 7);
  });
}

// --- Decorations ---------------------------------------------------------------

/** Palms drawn before the deck, so the deck railing and the bar stand in front. */
function drawBackPalms(scene) {
  const g = layer(scene);
  drawPalm(g, 22, 410, 250, -0.25);
  drawPalm(g, LAYOUT.deck.maxX - 52, 400, 230, 0.12);
}

function drawBeachDecor(scene) {
  const g = layer(scene);
  const sandY = LAYOUT.sandTop;

  // Past the entrance arch: an umbrella, surfboards, a palm and some toys
  const beachX = entranceArch().right + 85;
  drawTowel(g, beachX, sandY + 52, 0x26c6da);
  drawUmbrella(g, beachX + 30, sandY + 64, [0xef5350, 0xffffff]);
  drawSurfboard(g, beachX + 95, 455, 0x29b6f6, 0xffffff);
  drawSurfboard(g, beachX + 127, 450, 0xff7043, 0xfff176);
  drawPalm(g, beachX + 180, 425, 250, -0.25);
  drawSandcastle(g, beachX + 45, 522);
  drawBeachBall(g, beachX - 35, 516);
  drawBucket(g, beachX + 105, 526);

  // Shells and starfish near the front edge
  const rng = new Phaser.Math.RandomDataGenerator(['beach-shells']);
  for (let x = LAYOUT.deck.maxX + 60; x < W; x += rng.between(70, 140)) {
    const y = rng.between(510, 536);
    if (rng.frac() < 0.4) drawStarfish(g, x, y);
    else {
      g.fillStyle(0xffe0b2);
      g.fillEllipse(x, y, 9, 6);
      g.fillStyle(0xffccbc);
      g.fillEllipse(x + 1, y + 1, 5, 3);
    }
  }

  // Potted plant at the start of the deck
  g.fillStyle(0xbf6b3a);
  g.fillPoints([{ x: 395, y: 408 }, { x: 425, y: 408 }, { x: 420, y: 438 }, { x: 400, y: 438 }], true);
  g.fillStyle(COLORS.leaf);
  g.fillEllipse(402, 398, 14, 26);
  g.fillEllipse(418, 398, 14, 26);
  g.fillStyle(COLORS.leafDark);
  g.fillEllipse(410, 392, 14, 30);
}

/** A curved palm tree whose trunk base is at (x, baseY). */
function drawPalm(g, x, baseY, height, lean, scale = 1) {
  const h = height * scale;
  const topX = x + lean * h;
  const topY = baseY - h;
  const ctrlX = x + lean * h * 0.15;
  const ctrlY = baseY - h * 0.55;
  const at = t => ({
    x: (1 - t) * (1 - t) * x + 2 * (1 - t) * t * ctrlX + t * t * topX,
    y: (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * ctrlY + t * t * topY
  });

  // Tapered trunk with ring marks
  const halfWidth = t => (10 - t * 4) * scale;
  const left = [];
  const right = [];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const p = at(t);
    left.push({ x: p.x - halfWidth(t), y: p.y });
    right.push({ x: p.x + halfWidth(t), y: p.y });
  }
  g.fillStyle(COLORS.trunk);
  g.fillPoints([...left, ...right.reverse()], true);
  const rings = Math.max(5, Math.round(h / 16));
  g.lineStyle(Math.max(1, 2 * scale), COLORS.trunkDark);
  for (let i = 1; i < rings; i++) {
    const t = i / rings;
    const p = at(t);
    const w = halfWidth(t);
    g.beginPath();
    g.arc(p.x, p.y - w * 0.6, w * 1.15, Math.PI * 0.2, Math.PI * 0.8);
    g.strokePath();
  }

  // Fronds
  const angles = [-2.9, -2.3, -1.6, -0.9, -0.25, 0.35, 2.75];
  angles.forEach((a, i) => drawFrond(g, topX, topY, a, (70 + (i % 3) * 12) * scale, i % 2 ? COLORS.leaf : COLORS.leafDark));

  // Coconuts
  g.fillStyle(COLORS.coconut);
  g.fillCircle(topX - 6 * scale, topY + 6 * scale, 6 * scale);
  g.fillCircle(topX + 6 * scale, topY + 7 * scale, 6 * scale);
}

function drawFrond(g, cx, cy, angle, length, color) {
  const tipX = cx + Math.cos(angle) * length;
  const tipY = cy + Math.sin(angle) * length * 0.6 + length * 0.35; // fronds droop
  const ctrlX = cx + Math.cos(angle) * length * 0.55;
  const ctrlY = cy + Math.sin(angle) * length * 0.55 - length * 0.12;
  const width = length * 0.16;

  const left = [];
  const right = [];
  for (let t = 0; t <= 1.0001; t += 0.1) {
    const px = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * ctrlX + t * t * tipX;
    const py = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * ctrlY + t * t * tipY;
    const dx = 2 * (1 - t) * (ctrlX - cx) + 2 * t * (tipX - ctrlX);
    const dy = 2 * (1 - t) * (ctrlY - cy) + 2 * t * (tipY - ctrlY);
    const len = Math.hypot(dx, dy) || 1;
    const w = width * Math.sin(Math.PI * Math.min(1, t * 1.1));
    left.push({ x: px - (dy / len) * w, y: py + (dx / len) * w });
    right.push({ x: px + (dy / len) * w, y: py - (dx / len) * w });
  }
  g.fillStyle(color);
  g.fillPoints([...left, ...right.reverse()], true);
}

function drawSurfboard(g, x, baseY, color, stripe) {
  g.fillStyle(color);
  g.fillEllipse(x, baseY - 55, 26, 120);
  g.fillStyle(stripe);
  g.fillRect(x - 2, baseY - 110, 4, 110);
  g.fillStyle(COLORS.sandShade);
  g.fillEllipse(x, baseY, 34, 8);
}

function drawUmbrella(g, x, baseY, colors) {
  const top = baseY - 120;
  g.lineStyle(4, 0xeeeeee);
  g.lineBetween(x, baseY, x + 6, top);
  const wedges = 6;
  for (let i = 0; i < wedges; i++) {
    g.fillStyle(colors[i % colors.length]);
    g.slice(x + 6, top + 16, 70, Math.PI + (i * Math.PI) / wedges, Math.PI + ((i + 1) * Math.PI) / wedges, false);
    g.fillPath();
  }
  g.fillStyle(0x000000, 0.12);
  g.fillEllipse(x + 6, baseY + 4, 120, 14);
}

function drawTowel(g, x, y, color) {
  g.fillStyle(color);
  g.fillRoundedRect(x - 55, y - 8, 110, 22, 4);
  g.fillStyle(0xffffff, 0.6);
  g.fillRect(x - 40, y - 8, 8, 22);
  g.fillRect(x + 32, y - 8, 8, 22);
}

function drawSandcastle(g, x, baseY) {
  g.fillStyle(0xe0b872);
  g.fillRect(x - 30, baseY - 26, 60, 26);
  g.fillRect(x - 10, baseY - 44, 20, 18);
  [-30, -18, 18, 30].forEach(dx => g.fillRect(x + dx - (dx < 0 ? 0 : 6), baseY - 32, 6, 6));
  g.fillStyle(0xff5252);
  g.fillTriangle(x, baseY - 62, x, baseY - 52, x + 12, baseY - 57);
  g.lineStyle(2, 0x5d4037);
  g.lineBetween(x, baseY - 44, x, baseY - 62);
  g.fillStyle(0x8d6e63);
  g.fillRoundedRect(x - 6, baseY - 14, 12, 14, { tl: 6, tr: 6, bl: 0, br: 0 });
}

function drawBeachBall(g, x, y) {
  const colors = [0xef5350, 0xffffff, 0x42a5f5, 0xffffff, 0xffeb3b, 0xffffff];
  colors.forEach((color, i) => {
    g.fillStyle(color);
    g.slice(x, y - 14, 14, (i * Math.PI * 2) / 6, ((i + 1) * Math.PI * 2) / 6, false);
    g.fillPath();
  });
}

function drawBucket(g, x, baseY) {
  g.fillStyle(0x42a5f5);
  g.fillPoints([{ x: x - 12, y: baseY - 22 }, { x: x + 12, y: baseY - 22 }, { x: x + 9, y: baseY }, { x: x - 9, y: baseY }], true);
  g.lineStyle(2, 0x1e88e5);
  g.beginPath();
  g.arc(x, baseY - 22, 11, Math.PI, 0);
  g.strokePath();
}

function drawStarfish(g, x, y) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 3 : 8;
    points.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.6 });
  }
  g.fillStyle(0xff8a65);
  g.fillPoints(points, true);
}
