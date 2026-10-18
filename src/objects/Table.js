import Phaser from 'phaser';

const WOOD = 0x8b5a3c;
const WOOD_DARK = 0x6b4129;
const WOOD_LIGHT = 0xa8714d;

/**
 * A beach table with a stool on its left. The container origin is the floor
 * point under the table's centre.
 */
export default class Table extends Phaser.GameObjects.Container {
  constructor(scene, x, floorY, number) {
    super(scene, x, floorY);

    this.number = number;
    this.customer = null;

    // Where a guest sits and where the waitress stands to serve
    this.seatSpot = { x: x - 75, y: floorY };
    this.serviceSpot = { x: x + 78, y: floorY + 8 };

    this.hint = scene.add.ellipse(-10, 0, 190, 26, 0x66bb6a, 0.35).setVisible(false);
    this.indicator = this.createIndicator(scene);

    this.add([
      this.hint,
      this.drawFurniture(scene),
      scene.add
        .text(0, 16, `Table ${number}`, { fontSize: '14px', color: '#6b4a2b', fontStyle: 'bold' })
        .setOrigin(0.5, 0),
      this.indicator
    ]);

    // Tables sit just behind anyone standing on the same floor line
    this.setDepth(floorY - 1);
    scene.add.existing(this);
  }

  get isOccupied() {
    return this.customer !== null;
  }

  /** Tap area covers the table, the stool and a little margin for fingers. */
  containsPoint(px, py) {
    return px >= this.x - 100 && px <= this.x + 65 && py >= this.y - 75 && py <= this.y + 35;
  }

  /** Claim the table for a guest who is on their way. */
  reserve(customer) {
    this.customer = customer;
    this.setHint(false);
  }

  /** Soft glow that tells the player this table can take a guest. */
  setHint(visible) {
    if (this.hint.visible === visible) return;
    this.hint.setVisible(visible);
    this.scene.tweens.killTweensOf(this.hint);
    if (visible) {
      this.hint.setAlpha(1);
      this.scene.tweens.add({ targets: this.hint, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
    }
  }

  showIndicator() {
    const bubble = this.indicator;
    bubble.setVisible(true).setScale(0);
    this.scene.tweens.add({ targets: bubble, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: bubble,
      y: bubble.y - 5,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  drawFurniture(scene) {
    const g = scene.add.graphics();

    // Shadows
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(0, 0, 120, 12);
    g.fillEllipse(-75, 0, 36, 8);

    // Table: centre post, foot and top
    g.fillStyle(WOOD_DARK);
    g.fillRect(-4, -46, 8, 46);
    g.fillRoundedRect(-20, -5, 40, 5, 2);
    g.fillStyle(WOOD);
    g.fillRoundedRect(-55, -54, 110, 10, 3);
    g.fillStyle(WOOD_LIGHT);
    g.fillRect(-52, -54, 104, 3);

    // Little coconut drink as decoration
    g.fillStyle(0x795548);
    g.fillCircle(30, -60, 6);
    g.lineStyle(2, 0xff4081);
    g.lineBetween(30, -60, 36, -72);

    // Stool
    g.fillStyle(WOOD_DARK);
    g.fillRect(-77, -22, 4, 22);
    g.fillRoundedRect(-87, -3, 24, 3, 1);
    g.fillStyle(WOOD);
    g.fillRoundedRect(-90, -26, 30, 6, 2);

    return g;
  }

  /** Speech bubble shown above an occupied table. */
  createIndicator(scene) {
    const g = scene.add.graphics();

    g.fillStyle(0x000000, 0.15);
    g.fillRoundedRect(-22, -12, 48, 28, 10);
    g.fillStyle(0xffffff);
    g.fillRoundedRect(-24, -15, 48, 28, 10);
    g.fillTriangle(-16, 11, -4, 11, -18, 22);

    // Three dots: "guest is seated and settling in"
    [0x29b6f6, 0x66bb6a, 0xffa726].forEach((color, i) => {
      g.fillStyle(color);
      g.fillCircle(-11 + i * 11, -1, 4);
    });

    return scene.add.container(-30, -112, [g]).setVisible(false);
  }
}
