// Small original icons drawn with Phaser graphics.
//
// Menu icons are bottom-anchored: (0, 0) is the middle of the item's base, and
// the item is roughly 32px wide and 30-36px tall. That makes them easy to stand
// on a counter, a table or the waitress's tray.

const GLASS = 0xe1f5fe;
const STRAW = 0xff5252;

function drawGlass(g, { liquid = 0xffffff, garnish } = {}) {
  // Glass and drink
  g.fillStyle(GLASS, 0.7);
  g.fillPoints([{ x: -10, y: -27 }, { x: 10, y: -27 }, { x: 7, y: 0 }, { x: -7, y: 0 }], true);
  g.fillStyle(liquid);
  g.fillPoints([{ x: -9, y: -21 }, { x: 9, y: -21 }, { x: 6.5, y: -2 }, { x: -6.5, y: -2 }], true);
  g.fillStyle(0xffffff, 0.35);
  g.fillRect(-6, -19, 3, 14);

  // Straw
  g.lineStyle(2.5, STRAW);
  g.lineBetween(3, -18, 9, -34);

  switch (garnish) {
    case 'lemon':
      g.fillStyle(0xfbc02d);
      g.fillCircle(-9, -26, 6);
      g.fillStyle(0xfff59d);
      g.fillCircle(-9, -26, 4.5);
      break;
    case 'mango':
      g.fillStyle(0xff8f00);
      g.fillEllipse(-9, -27, 11, 7);
      g.fillStyle(0x66bb6a);
      g.fillEllipse(-13, -31, 6, 3);
      break;
    case 'strawberry':
      g.fillStyle(0xe53935);
      g.fillTriangle(-15, -30, -5, -30, -10, -20);
      g.fillCircle(-10, -29, 5);
      g.fillStyle(0x43a047);
      g.fillTriangle(-14, -33, -6, -33, -10, -29);
      break;
    case 'ice':
      g.fillStyle(0xffffff, 0.85);
      g.fillRect(-6, -19, 5, 5);
      g.fillRect(1, -15, 5, 5);
      g.fillStyle(0xfff3e0);
      g.fillEllipse(0, -22, 18, 5);
      break;
    default:
      break;
  }
}

function drawCoconut(g) {
  g.fillStyle(0x8d6e63);
  g.fillCircle(0, -12, 12);
  g.fillStyle(0x6d4c41);
  g.fillCircle(-4, -8, 2);
  g.fillStyle(0xfff8e1);
  g.fillEllipse(0, -21, 15, 5);

  // Straw and a little paper umbrella
  g.lineStyle(2.5, STRAW);
  g.lineBetween(2, -21, 7, -33);
  g.lineStyle(1.5, 0x8d6e63);
  g.lineBetween(-4, -21, -8, -33);
  g.fillStyle(0xec407a);
  g.fillTriangle(-17, -31, 1, -35, -9, -41);
}

function drawPlate(g) {
  g.fillStyle(0xb0bec5);
  g.fillEllipse(0, -2, 34, 8);
  g.fillStyle(0xffffff);
  g.fillEllipse(0, -3, 30, 6);
}

function drawWatermelon(g) {
  drawPlate(g);
  [-7, 7].forEach((cx, i) => {
    const cy = -5 - i;
    g.fillStyle(0x43a047);
    g.beginPath();
    g.arc(cx, cy, 10, Math.PI, Math.PI * 2);
    g.fillPath();
    g.fillStyle(0xe8f5e9);
    g.beginPath();
    g.arc(cx, cy, 8.5, Math.PI, Math.PI * 2);
    g.fillPath();
    g.fillStyle(0xef5350);
    g.beginPath();
    g.arc(cx, cy, 7.5, Math.PI, Math.PI * 2);
    g.fillPath();
    g.fillStyle(0x212121);
    g.fillCircle(cx - 3, cy - 3, 1);
    g.fillCircle(cx + 2, cy - 4, 1);
    g.fillCircle(cx, cy - 1.5, 1);
  });
}

function drawFries(g, { box = 0x29b6f6 } = {}) {
  // Fries sticking out of the carton
  g.fillStyle(0xffca28);
  [-6, -2.5, 1, 4.5, -4, 2.5].forEach((x, i) => {
    const top = i < 4 ? -28 + (i % 2) * 3 : -25;
    g.fillRect(x, top, 3, 14);
  });
  g.fillStyle(0xffb300);
  g.fillRect(-0.5, -27, 2, 3);

  // Carton with a white wave stripe
  g.fillStyle(box);
  g.fillPoints([{ x: -10, y: -16 }, { x: 10, y: -16 }, { x: 7, y: 0 }, { x: -7, y: 0 }], true);
  g.fillStyle(0xffffff);
  g.fillEllipse(0, -8, 14, 4);
}

function drawFruitBowl(g, { fruits = [0xef5350, 0xffca28, 0x66bb6a] } = {}) {
  // Fruit pieces piled above the rim
  const spots = [[-8, -14], [-2, -17], [5, -15], [10, -13], [-4, -12], [2, -12]];
  spots.forEach(([x, y], i) => {
    g.fillStyle(fruits[i % fruits.length]);
    g.fillCircle(x, y, 4);
  });

  // Bowl
  g.fillStyle(0xffffff);
  g.beginPath();
  g.arc(0, -12, 14, 0, Math.PI);
  g.fillPath();
  g.fillStyle(0x4dd0e1);
  g.fillRect(-13, -9, 26, 2);
}

function drawFallback(g) {
  g.fillStyle(0xffffff);
  g.fillCircle(0, -14, 13);
  g.lineStyle(2, 0x9e9e9e);
  g.strokeCircle(0, -14, 13);
}

// Add a new shape here, then reference it from a menu item's `icon.shape`
const ICON_RENDERERS = {
  glass: drawGlass,
  coconut: drawCoconut,
  watermelon: drawWatermelon,
  fries: drawFries,
  fruitBowl: drawFruitBowl
};

/** Create a Graphics object showing the given menu item. */
export function createMenuIcon(scene, item) {
  const g = scene.add.graphics();
  const { shape, ...options } = item.icon ?? {};
  const render = ICON_RENDERERS[shape];
  if (!render) console.warn(`[menu] no icon renderer for shape "${shape}" (${item.id})`);
  (render ?? drawFallback)(g, options);
  return g;
}

export function hasIconRenderer(shape) {
  return shape in ICON_RENDERERS;
}

/** A gold coin centred on (x, y). */
export function drawCoin(g, x, y, r = 10) {
  g.fillStyle(0xf9a825);
  g.fillCircle(x, y, r);
  g.fillStyle(0xffd54f);
  g.fillCircle(x, y, r * 0.75);
  g.fillStyle(0xfff59d);
  g.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.22);
  g.fillStyle(0xf9a825);
  g.fillRect(x - r * 0.12, y - r * 0.45, r * 0.24, r * 0.9);
}

/** A broom, centred roughly on (0, 0). Used for the dirty-table bubble. */
export function drawBroom(g) {
  g.lineStyle(3, 0x8d6e63);
  g.lineBetween(-7, -9, 4, 4);
  g.fillStyle(0xfbc02d);
  g.fillTriangle(1, 2, 10, 0, 9, 11);
  g.fillStyle(0xf57f17);
  g.fillRect(1, 1, 5, 3);
}

/** A notepad ticket, centred roughly on (0, 0). */
export function drawNotepad(g) {
  g.fillStyle(0xffffff);
  g.fillRoundedRect(-7, -9, 14, 18, 2);
  g.lineStyle(1.5, 0x90a4ae);
  [-4, 0, 4].forEach(y => g.lineBetween(-4, y, 4, y));
  g.fillStyle(0xef5350);
  g.fillRect(-7, -9, 14, 3);
}

/** A broken heart, centred roughly on (0, 0). Shown when a guest leaves unhappy. */
export function drawBrokenHeart(g) {
  g.fillStyle(0xe53935);
  g.fillCircle(-5, -3, 6);
  g.fillCircle(5, -3, 6);
  g.fillTriangle(-11, -1, 11, -1, 0, 11);
  g.lineStyle(2, 0xffffff);
  g.beginPath();
  g.moveTo(0, -7);
  g.lineTo(-2, -2);
  g.lineTo(2, 2);
  g.lineTo(-1, 6);
  g.lineTo(0, 10);
  g.strokePath();
}
